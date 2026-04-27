import logging
import sqlite3
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


# ── Google Trends ──────────────────────────────────────────────────────────────

def fetch_google_trends(keywords: list[str], geo: str = "CO") -> list[dict]:
    """Fetch trending keywords from Google Trends for the given geo."""
    try:
        from pytrends.request import TrendReq
        pytrends = TrendReq(hl="es-CO", tz=300, timeout=(10, 25))
        results = []
        # Process in batches of 5 (pytrends limit)
        for i in range(0, len(keywords), 5):
            batch = keywords[i:i + 5]
            try:
                pytrends.build_payload(batch, geo=geo, timeframe="now 7-d")
                interest = pytrends.interest_over_time()
                if interest.empty:
                    continue
                for kw in batch:
                    if kw in interest.columns:
                        avg_interest = int(interest[kw].mean())
                        if avg_interest > 0:
                            results.append({
                                "keyword": kw,
                                "platform": "Google Trends",
                                "interest_score": avg_interest,
                            })
            except Exception as e:
                logger.warning(f"Google Trends batch failed for {batch}: {e}")
        return results
    except Exception as e:
        logger.warning(f"Google Trends unavailable: {e}")
        return []


# ── YouTube Trending ───────────────────────────────────────────────────────────

def fetch_youtube_trending(max_items: int = 5) -> list[dict]:
    """
    Fetch trending YouTube videos for Colombia via RSS (no API key required).
    Uses YouTube's public trending RSS feed.
    """
    try:
        import feedparser
        # YouTube trending RSS for Colombia region
        url = "https://www.youtube.com/feeds/videos.xml?chart=mostPopular&regionCode=CO&hl=es"
        feed = feedparser.parse(url)
        results = []
        for entry in feed.entries[:max_items]:
            results.append({
                "keyword": entry.get("title", "").strip(),
                "platform": "YouTube",
                "url": entry.get("link", ""),
                "author": entry.get("author", ""),
            })
        if not results:
            # Fallback: general trending via search
            results = _fetch_youtube_via_search(max_items)
        return results
    except Exception as e:
        logger.warning(f"YouTube trending fetch failed: {e}")
        return []


def _fetch_youtube_via_search(max_items: int = 5) -> list[dict]:
    """Fallback: scrape YouTube trending page titles using httpx."""
    try:
        import httpx
        import re
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "es-CO,es;q=0.9",
        }
        resp = httpx.get(
            "https://www.youtube.com/trending",
            headers=headers,
            follow_redirects=True,
            timeout=15,
        )
        titles = re.findall(r'"title":\{"runs":\[\{"text":"([^"]{5,80})"\}', resp.text)
        seen = []
        for t in titles:
            if t not in seen:
                seen.append(t)
            if len(seen) >= max_items:
                break
        return [{"keyword": t, "platform": "YouTube"} for t in seen]
    except Exception as e:
        logger.warning(f"YouTube fallback scrape failed: {e}")
        return []


# ── AI Analysis ───────────────────────────────────────────────────────────────

def build_trend_prompt(keyword: str, platform: str, brand_context: str = "") -> str:
    """Build GPT prompt to analyze a trend and generate brand-specific content ideas."""
    context_line = f"\nContexto de la marca: {brand_context}" if brand_context else ""
    return f"""Eres el estratega de contenido de Conexión Summit, una plataforma de emprendimiento e innovación en LATAM que conecta startups con corporativos.{context_line}

Analiza la siguiente tendencia en {platform} y responde EXACTAMENTE en este formato (sin texto adicional):

DESCRIPCION: [1-2 líneas describiendo de qué trata esta tendencia]
POR_QUE_TRENDING: [1 línea explicando por qué está en auge ahora]
COMO_APLICAR: [1-2 líneas sobre cómo Conexión Summit puede usar esta tendencia en su contenido]
IDEA_POST: [1 idea concreta de post: formato + plataforma + tema específico]

Tendencia: {keyword}
Plataforma de origen: {platform}"""


def analyze_trend(keyword: str, platform: str, openai_client: Any, brand_context: str = "") -> dict:
    """Call GPT-4o mini to analyze a trend and generate content ideas."""
    try:
        prompt = build_trend_prompt(keyword, platform, brand_context)
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.4,
        )
        text = response.choices[0].message.content or ""
        result = {"description": "", "why_trending": "", "how_to_apply": "", "post_idea": ""}
        for line in text.split("\n"):
            line = line.strip()
            if line.startswith("DESCRIPCION:"):
                result["description"] = line.replace("DESCRIPCION:", "").strip()
            elif line.startswith("POR_QUE_TRENDING:"):
                result["why_trending"] = line.replace("POR_QUE_TRENDING:", "").strip()
            elif line.startswith("COMO_APLICAR:"):
                result["how_to_apply"] = line.replace("COMO_APLICAR:", "").strip()
            elif line.startswith("IDEA_POST:"):
                result["post_idea"] = line.replace("IDEA_POST:", "").strip()
        return result
    except Exception as e:
        logger.warning(f"Failed to analyze trend '{keyword}': {e}")
        return {"description": "", "why_trending": "", "how_to_apply": "", "post_idea": ""}


# ── Storage ───────────────────────────────────────────────────────────────────

def store_trend(conn: sqlite3.Connection, trend: dict) -> None:
    """Store a trend. Ignores duplicate keyword+platform on the same day."""
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        existing = conn.execute(
            "SELECT id FROM trends WHERE keyword = ? AND platform = ? AND date(fetched_at) = ?",
            (trend["keyword"], trend["platform"], today),
        ).fetchone()
        if existing:
            return
        conn.execute(
            """INSERT INTO trends (keyword, platform, description, why_trending, how_to_apply, post_idea, fetched_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                trend["keyword"],
                trend["platform"],
                trend.get("description", ""),
                trend.get("why_trending", ""),
                trend.get("how_to_apply", ""),
                trend.get("post_idea", ""),
                trend.get("fetched_at", datetime.now().isoformat()),
            ),
        )
        conn.commit()
    except Exception as e:
        logger.warning(f"Failed to store trend '{trend.get('keyword')}': {e}")


def get_trends(conn: sqlite3.Connection, limit: int = 20, platform: str = "") -> list[dict]:
    """Retrieve trends from DB, most recent first."""
    query = "SELECT * FROM trends"
    params: list[Any] = []
    if platform:
        query += " WHERE platform = ?"
        params.append(platform)
    query += " ORDER BY fetched_at DESC LIMIT ?"
    params.append(limit)
    cursor = conn.execute(query, params)
    return [dict(row) for row in cursor.fetchall()]


# ── Main Cycle ────────────────────────────────────────────────────────────────

def run_trends_cycle(conn: sqlite3.Connection, config: dict, openai_client: Any | None = None) -> int:
    """
    Main daily cycle: fetch Google Trends + YouTube trending, analyze with AI, store.
    Returns number of new trends stored.
    """
    keywords = config.get("google_news_keywords", [
        "startups Colombia", "innovación LATAM", "emprendimiento", "inversión startup", "tecnología empresas"
    ])
    brand_context = config.get("brand_context", "")
    stored_count = 0

    # Google Trends
    google_items = fetch_google_trends(keywords, geo="CO")
    for item in google_items:
        if openai_client:
            analysis = analyze_trend(item["keyword"], item["platform"], openai_client, brand_context)
            item.update(analysis)
        item["fetched_at"] = datetime.now().isoformat()
        before = _count_trends(conn)
        store_trend(conn, item)
        after = _count_trends(conn)
        if after > before:
            stored_count += 1

    # YouTube Trending
    yt_items = fetch_youtube_trending(max_items=5)
    for item in yt_items:
        if openai_client:
            analysis = analyze_trend(item["keyword"], item["platform"], openai_client, brand_context)
            item.update(analysis)
        item["fetched_at"] = datetime.now().isoformat()
        before = _count_trends(conn)
        store_trend(conn, item)
        after = _count_trends(conn)
        if after > before:
            stored_count += 1

    return stored_count


def _count_trends(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM trends").fetchone()[0]
