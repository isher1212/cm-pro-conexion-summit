import logging
import sqlite3
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


# ── Google Trends ──────────────────────────────────────────────────────────────

def fetch_google_trends(keywords: list[str], geo: str = "CO") -> list[dict]:
    """Fetch daily trending searches from Google Trends — no pandas required."""
    try:
        import httpx
        import json
        from datetime import datetime as _dt
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "es-CO,es;q=0.9",
        }
        today = _dt.now().strftime("%Y%m%d")
        url = f"https://trends.google.com/trends/api/dailytrends?hl=es-419&geo={geo}&ed={today}&ns=15"
        resp = httpx.get(url, headers=headers, timeout=15, follow_redirects=True)
        text = resp.text.lstrip(")]}'\n")
        data = json.loads(text)
        trending_days = data.get("default", {}).get("trendingSearchesDays", [])
        results = []
        for day in trending_days:
            for search in day.get("trendingSearches", []):
                title = search.get("title", {}).get("query", "").strip()
                if title and len(results) < 5:
                    results.append({
                        "keyword": title,
                        "platform": "Google Trends",
                        "interest_score": search.get("formattedTraffic", ""),
                    })
            if len(results) >= 5:
                break
        if not results:
            # Fallback: use configured keywords directly
            results = [{"keyword": kw, "platform": "Google Trends", "interest_score": 0} for kw in keywords[:5]]
        return results
    except Exception as e:
        logger.warning(f"Google Trends unavailable: {e}")
        keywords_default = keywords or ["emprendimiento Colombia", "startups LATAM", "innovacion empresas"]
        return [{"keyword": kw, "platform": "Google Trends", "interest_score": 0} for kw in keywords_default[:5]]


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


_YT_UI_NOISE = {
    "general", "reproducción", "principal", "combinaciones de teclas",
    "busca algo para comenzar", "inicio", "shorts", "suscripciones",
    "biblioteca", "historial", "explorar", "tendencias", "música",
    "películas", "videojuegos", "noticias", "deportes", "aprendizaje",
    "moda", "podcasts", "en vivo",
}

def _fetch_youtube_via_search(max_items: int = 5) -> list[dict]:
    """Fallback: scrape YouTube trending page for real video titles."""
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
        # Match video titles from YouTube's JSON payload — longer strings are real titles
        titles = re.findall(r'"title":\{"runs":\[\{"text":"([^"]{15,120})"\}', resp.text)
        seen = set()
        unique = []
        for t in titles:
            t_clean = t.strip()
            if t_clean.lower() in _YT_UI_NOISE:
                continue
            if t_clean not in seen:
                seen.add(t_clean)
                unique.append(t_clean)
                if len(unique) >= max_items:
                    break
        return [{"keyword": t, "platform": "YouTube"} for t in unique]
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

def store_trend(conn: sqlite3.Connection, trend: dict) -> bool:
    """Store a trend. Returns True if inserted, False if duplicate (same keyword+platform+day)."""
    try:
        cursor = conn.execute(
            """INSERT OR IGNORE INTO trends (keyword, platform, description, why_trending, how_to_apply, post_idea, fetched_at)
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
        return cursor.rowcount > 0
    except Exception as e:
        logger.warning(f"Failed to store trend '{trend.get('keyword')}': {e}")
        return False


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
        if store_trend(conn, item):
            stored_count += 1

    # YouTube Trending
    yt_items = fetch_youtube_trending(max_items=5)
    for item in yt_items:
        if openai_client:
            analysis = analyze_trend(item["keyword"], item["platform"], openai_client, brand_context)
            item.update(analysis)
        item["fetched_at"] = datetime.now().isoformat()
        if store_trend(conn, item):
            stored_count += 1

    return stored_count
