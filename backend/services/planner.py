import hashlib
import logging
import re
import sqlite3
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


def _proposal_hash(topic: str, platform: str) -> str:
    txt = re.sub(r'\s+', ' ', re.sub(r'[^\w\s]', '', (topic + " " + platform).lower())).strip()
    return hashlib.md5(txt.encode("utf-8")).hexdigest()[:16]


# ── Events ────────────────────────────────────────────────────────────────────

def store_event(conn: sqlite3.Connection, event: dict) -> None:
    try:
        conn.execute(
            """INSERT INTO events (title, date, description, event_type, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (
                event["title"],
                event["date"],
                event.get("description", ""),
                event.get("event_type", ""),
                event.get("created_at", datetime.now().isoformat()),
            ),
        )
        conn.commit()
    except Exception as e:
        logger.warning(f"Failed to store event '{event.get('title')}': {e}")


def get_events(conn: sqlite3.Connection, from_date: str = "", limit: int = 50) -> list[dict]:
    if from_date:
        cursor = conn.execute(
            "SELECT * FROM events WHERE date >= ? ORDER BY date ASC LIMIT ?",
            (from_date, limit),
        )
    else:
        cursor = conn.execute(
            "SELECT * FROM events ORDER BY date ASC LIMIT ?", (limit,)
        )
    return [dict(row) for row in cursor.fetchall()]


def delete_event(conn: sqlite3.Connection, event_id: int) -> None:
    try:
        conn.execute("DELETE FROM events WHERE id = ?", (event_id,))
        conn.commit()
    except Exception as e:
        logger.warning(f"Failed to delete event {event_id}: {e}")


# ── Proposals ─────────────────────────────────────────────────────────────────

def store_proposal(conn: sqlite3.Connection, proposal: dict) -> None:
    try:
        h = _proposal_hash(proposal.get("topic", ""), proposal.get("platform", ""))
        proposal["content_hash"] = h

        from backend.config import load_config
        config = load_config()
        window = config.get("duplicate_window_days", 7)
        if not proposal.get("force", False):
            existing = conn.execute(
                "SELECT id FROM content_proposals WHERE content_hash = ? AND created_at >= datetime('now', ?) LIMIT 1",
                (h, f"-{window} days"),
            ).fetchone()
            if existing:
                logger.info(f"Skipping duplicate proposal: {proposal.get('topic')}")
                return

        conn.execute(
            """INSERT INTO content_proposals
               (topic, format, platform, suggested_date, caption_draft, hashtags, status, created_at, image_urls, video_script, content_hash)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                proposal["topic"],
                proposal.get("format", ""),
                proposal.get("platform", ""),
                proposal.get("suggested_date", ""),
                proposal.get("caption_draft", ""),
                proposal.get("hashtags", ""),
                proposal.get("status", "proposed"),
                proposal.get("created_at", datetime.now().isoformat()),
                proposal.get("image_urls", "[]"),
                proposal.get("video_script", ""),
                h,
            ),
        )
        conn.commit()
    except Exception as e:
        logger.warning(f"Failed to store proposal '{proposal.get('topic')}': {e}")


def get_proposals(conn: sqlite3.Connection, status: str = "", limit: int = 100) -> list[dict]:
    if status:
        cursor = conn.execute(
            "SELECT * FROM content_proposals WHERE status = ? ORDER BY order_index ASC, created_at DESC LIMIT ?",
            (status, limit),
        )
    else:
        cursor = conn.execute(
            "SELECT * FROM content_proposals ORDER BY order_index ASC, created_at DESC LIMIT ?",
            (limit,),
        )
    return [dict(row) for row in cursor.fetchall()]


def update_proposal_status(conn: sqlite3.Connection, proposal_id: int, status: str) -> None:
    try:
        conn.execute(
            "UPDATE content_proposals SET status = ? WHERE id = ?",
            (status, proposal_id),
        )
        conn.commit()
    except Exception as e:
        logger.warning(f"Failed to update status for proposal {proposal_id}: {e}")


def update_proposal(conn: sqlite3.Connection, proposal_id: int, updates: dict) -> None:
    allowed = {"caption_draft", "suggested_date", "hashtags", "format", "platform", "topic", "image_urls", "video_script"}
    fields = {k: v for k, v in updates.items() if k in allowed}
    if not fields:
        return
    try:
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values()) + [proposal_id]
        conn.execute(
            f"UPDATE content_proposals SET {set_clause} WHERE id = ?", values
        )
        conn.commit()
    except Exception as e:
        logger.warning(f"Failed to update proposal {proposal_id}: {e}")


# ── AI Proposal Generation ────────────────────────────────────────────────────

def build_proposals_prompt(
    events: list[dict],
    trends: list[dict],
    articles: list[dict],
    pillars: list,
    brand_context: str = "",
    n_proposals: int = 5,
) -> str:
    context_line = f"\nContexto adicional de la marca: {brand_context}" if brand_context else ""

    pillar_names = []
    for p in pillars:
        if isinstance(p, dict):
            pillar_names.append(p.get("name", str(p)))
        else:
            pillar_names.append(str(p))
    pillars_text = "\n".join(f"- {p}" for p in pillar_names)

    events_text = "\n".join(
        f"- {e['title']} ({e['date']}) [{e.get('event_type', '')}]" for e in events[:5]
    ) or "Sin eventos próximos registrados"

    trends_text = "\n".join(
        f"- {t['keyword']} ({t['platform']}): {t.get('how_to_apply', '')}" for t in trends[:5]
    ) or "Sin tendencias recientes"

    articles_text = "\n".join(
        f"- {a['title']} ({a.get('source', '')}): {a.get('summary', '')[:100]}" for a in articles[:5]
    ) or "Sin noticias recientes"

    return f"""Eres el estratega de contenido de Conexión Summit, plataforma de emprendimiento en LATAM que conecta startups con corporativos.{context_line}

Genera exactamente {n_proposals} propuestas de contenido para las próximas semanas, cruzando los siguientes datos:

PILARES DE CONTENIDO:
{pillars_text}

EVENTOS PRÓXIMOS:
{events_text}

TENDENCIAS ACTIVAS:
{trends_text}

NOTICIAS RELEVANTES:
{articles_text}

Para cada propuesta responde EXACTAMENTE en este formato (separadas por ---):

TOPIC: [tema principal en 1 línea]
FORMAT: [Reel|Carrusel|Post|Historia|Video]
PLATFORM: [Instagram|TikTok|LinkedIn]
DATE: [fecha sugerida YYYY-MM-DD]
CAPTION: [caption borrador completo, máx 3 líneas]
HASHTAGS: [#hashtag1 #hashtag2 #hashtag3 máx 5]

---"""


def generate_proposals(
    conn: sqlite3.Connection,
    config: dict,
    openai_client: Any,
    n_proposals: int = 5,
) -> int:
    if not openai_client:
        logger.warning("No OpenAI client — skipping proposal generation")
        return 0

    from backend.services.trends import get_trends
    from backend.services.intelligence import get_articles

    trends = get_trends(conn, limit=5)
    articles = get_articles(conn, limit=5)
    today = datetime.now().strftime("%Y-%m-%d")
    events = get_events(conn, from_date=today, limit=5)
    pillars = config.get("content_pillars", [])
    brand_context = config.get("brand_context", "")

    prompt = build_proposals_prompt(events, trends, articles, pillars, brand_context, n_proposals)

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1200,
            temperature=0.6,
        )
        text = response.choices[0].message.content or ""
    except Exception as e:
        logger.warning(f"GPT proposal generation failed: {e}")
        return 0

    blocks = [b.strip() for b in text.split("---") if b.strip()]
    stored = 0
    for block in blocks:
        proposal = _parse_proposal_block(block)
        if proposal.get("topic"):
            proposal["status"] = "proposed"
            proposal["created_at"] = datetime.now().isoformat()
            store_proposal(conn, proposal)
            stored += 1

    return stored


def _parse_proposal_block(block: str) -> dict:
    result = {"topic": "", "format": "", "platform": "", "suggested_date": "", "caption_draft": "", "hashtags": ""}
    for line in block.split("\n"):
        line = line.strip()
        if line.startswith("TOPIC:"):
            result["topic"] = line.replace("TOPIC:", "").strip()
        elif line.startswith("FORMAT:"):
            result["format"] = line.replace("FORMAT:", "").strip()
        elif line.startswith("PLATFORM:"):
            result["platform"] = line.replace("PLATFORM:", "").strip()
        elif line.startswith("DATE:"):
            result["suggested_date"] = line.replace("DATE:", "").strip()
        elif line.startswith("CAPTION:"):
            result["caption_draft"] = line.replace("CAPTION:", "").strip()
        elif line.startswith("HASHTAGS:"):
            result["hashtags"] = line.replace("HASHTAGS:", "").strip()
    return result
