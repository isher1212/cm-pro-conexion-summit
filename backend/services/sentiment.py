import json
import logging
from datetime import datetime
from backend.database import get_db

logger = logging.getLogger(__name__)


def analyze_sentiment(texts: list, source: str, openai_client, brand_context: str = "") -> dict:
    """Analiza una lista de comentarios/textos y devuelve sentimiento agregado."""
    if not openai_client:
        return {"error": "OpenAI no configurada"}
    if not texts:
        return {"error": "Sin textos para analizar"}
    cleaned = [str(t).strip()[:300] for t in texts if t and str(t).strip()][:50]
    if not cleaned:
        return {"error": "Sin textos válidos"}
    block = "\n".join(f"{i+1}. {t}" for i, t in enumerate(cleaned))
    context_line = f"\nMarca: {brand_context}" if brand_context else ""
    prompt = f"""Eres analista de comunidad de Conexión Summit.{context_line}

Clasifica los siguientes comentarios y devuelve un análisis agregado.

Comentarios:
{block}

Responde EXACTAMENTE en este formato JSON (sin texto adicional fuera del JSON):

{{
  "positive_count": <int>,
  "neutral_count": <int>,
  "negative_count": <int>,
  "summary": "<1-2 líneas en español sobre el sentimiento general>",
  "top_themes": ["<tema1>", "<tema2>", "<tema3>"]
}}"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.3,
        )
        try:
            from backend.services.ai_usage import log_openai_usage
            log_openai_usage("gpt-4o-mini", response, context="sentiment/analyze")
        except Exception:
            pass
        text = response.choices[0].message.content or ""
        try:
            start = text.find("{")
            end = text.rfind("}")
            if start < 0 or end < 0:
                raise ValueError("no JSON")
            data = json.loads(text[start:end + 1])
        except Exception:
            return {"error": "No se pudo parsear respuesta de IA"}

        try:
            conn = get_db()
            conn.execute(
                """INSERT INTO sentiment_analyses
                   (source, positive_count, neutral_count, negative_count, summary, top_themes, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    source,
                    int(data.get("positive_count", 0) or 0),
                    int(data.get("neutral_count", 0) or 0),
                    int(data.get("negative_count", 0) or 0),
                    data.get("summary", ""),
                    json.dumps(data.get("top_themes", []), ensure_ascii=False),
                    datetime.now().isoformat(),
                ),
            )
            conn.commit()
        except Exception as e:
            logger.warning(f"sentiment persist failed: {e}")
        return data
    except Exception as e:
        logger.warning(f"sentiment analyze failed: {e}")
        return {"error": str(e)}


def list_sentiment_history(limit: int = 30):
    conn = get_db()
    rows = conn.execute(
        """SELECT id, source, positive_count, neutral_count, negative_count, summary, top_themes, created_at
           FROM sentiment_analyses ORDER BY created_at DESC LIMIT ?""",
        (min(limit, 200),),
    ).fetchall()
    cols = ["id", "source", "positive_count", "neutral_count", "negative_count", "summary", "top_themes", "created_at"]
    out = []
    for r in rows:
        d = dict(zip(cols, r))
        try:
            d["top_themes"] = json.loads(d["top_themes"] or "[]")
        except Exception:
            d["top_themes"] = []
        out.append(d)
    return out


def fetch_post_comments_meta(post_external_id: str, access_token: str, limit: int = 50) -> list:
    """Trae comentarios de un post de Instagram via Meta Graph API."""
    if not (post_external_id and access_token):
        return []
    try:
        import httpx
        r = httpx.get(
            f"https://graph.facebook.com/v19.0/{post_external_id}/comments",
            params={"fields": "id,text,username,timestamp", "limit": min(limit, 100), "access_token": access_token},
            timeout=30,
        )
        if r.status_code >= 400:
            logger.warning(f"meta comments fetch {post_external_id} failed: {r.text[:200]}")
            return []
        return r.json().get("data", []) or []
    except Exception as e:
        logger.warning(f"fetch_post_comments_meta failed: {e}")
        return []


def analyze_post_sentiment_auto(post_id: int, openai_client, config: dict) -> dict:
    """
    Analiza sentimiento del post:
    1. Si tiene external_id y Meta token: trae comentarios reales
    2. Si no, usa los persistidos en post_comments
    3. Si no hay nada, devuelve mensaje informativo
    """
    if not openai_client:
        return {"error": "OpenAI no configurada"}
    conn = get_db()
    post = conn.execute(
        "SELECT id, external_id, post_description FROM posts WHERE id = ?",
        (post_id,),
    ).fetchone()
    if not post:
        return {"error": "Post no encontrado"}
    pid, ext_id, descr = post
    texts = []
    token = config.get("meta_access_token", "")
    if ext_id and token:
        meta_comments = fetch_post_comments_meta(ext_id, token, limit=50)
        for c in meta_comments:
            txt = c.get("text") or ""
            if txt.strip():
                texts.append(txt)
                try:
                    conn.execute(
                        """INSERT INTO post_comments (post_id, external_id, author, content, created_at)
                           VALUES (?, ?, ?, ?, ?)""",
                        (pid, c.get("id", ""), c.get("username", ""), txt, c.get("timestamp", "")),
                    )
                except Exception:
                    pass
        try:
            conn.commit()
        except Exception:
            pass
    if not texts:
        rows = conn.execute(
            "SELECT content FROM post_comments WHERE post_id = ? ORDER BY id DESC LIMIT 50",
            (pid,),
        ).fetchall()
        texts = [r[0] for r in rows if r[0]]
    if not texts:
        return {"error": "No hay comentarios para este post. Configura Meta API o asegúrate que el post tiene external_id."}
    return analyze_sentiment(texts, source=f"post:{pid}", openai_client=openai_client, brand_context=config.get("brand_context", ""))
