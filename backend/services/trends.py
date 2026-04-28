import hashlib
import logging
import re
import sqlite3
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


def _normalize_text(text: str) -> str:
    if not text:
        return ""
    return re.sub(r'\s+', ' ', re.sub(r'[^\w\s]', '', text.lower())).strip()


def _content_hash(*parts: str) -> str:
    combined = "|".join(_normalize_text(p) for p in parts if p)
    return hashlib.md5(combined.encode("utf-8")).hexdigest()[:16]


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
            video_link = entry.get("link", "")
            # Extract video id for a canonical watch URL if possible
            video_id = entry.get("yt_videoid", "")
            source_url = f"https://www.youtube.com/watch?v={video_id}" if video_id else video_link
            results.append({
                "keyword": entry.get("title", "").strip(),
                "platform": "YouTube",
                "source_url": source_url,
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
        try:
            from backend.services.ai_usage import log_openai_usage
            log_openai_usage("gpt-4o-mini", response, context="trends/analyze-keyword")
        except Exception:
            pass
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
    """Store a trend. Returns True if inserted, False if duplicate (same keyword+platform+day or content_hash)."""
    try:
        h = _content_hash(trend.get("keyword", ""), trend.get("platform", ""))
        trend["content_hash"] = h

        from backend.config import load_config
        config = load_config()
        window = config.get("duplicate_window_days", 7)
        existing = conn.execute(
            "SELECT id FROM trends WHERE content_hash = ? AND fetched_at >= datetime('now', ?) LIMIT 1",
            (h, f"-{window} days"),
        ).fetchone()
        if existing:
            return False

        cursor = conn.execute(
            """INSERT OR IGNORE INTO trends
               (keyword, platform, description, why_trending, how_to_apply, post_idea, source_url, fetched_at, content_hash)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                trend["keyword"],
                trend["platform"],
                trend.get("description", ""),
                trend.get("why_trending", ""),
                trend.get("how_to_apply", ""),
                trend.get("post_idea", ""),
                trend.get("source_url", ""),
                trend.get("fetched_at", datetime.now().isoformat()),
                h,
            ),
        )
        conn.commit()
        # Phase 13: notif nueva tendencia
        try:
            from backend.config import load_config
            cfg = load_config()
            if cfg.get("notify_on_new_trend", True):
                from backend.services.notifications import trigger_new_trend
                cur = conn.execute("SELECT id FROM trends WHERE keyword = ? AND platform = ? ORDER BY id DESC LIMIT 1", (trend["keyword"], trend["platform"])).fetchone()
                if cur:
                    trigger_new_trend(cur[0], trend["keyword"], trend["platform"])
        except Exception as e:
            logger.warning(f"notif trigger trend failed: {e}")
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


# ── Keyword GPT Helper ────────────────────────────────────────────────────────

def _analyze_keyword_with_gpt(keyword: str, platform: str, client: Any, brand_context: str = "") -> dict:
    """Generates description, why_trending, how_to_apply, post_idea using GPT."""
    if not client:
        return {"description": "", "why_trending": "", "how_to_apply": "", "post_idea": ""}
    context_line = f"\nContexto de marca: {brand_context}" if brand_context else ""
    prompt = f"""Eres analista de tendencias para Conexión Summit (plataforma de emprendimiento LATAM).{context_line}

Tendencia/keyword: {keyword}
Plataforma: {platform}

Responde EXACTAMENTE en este formato (en español, conciso):

DESCRIPCION: [qué es esta tendencia o tema en {platform}, máx 2 líneas]
POR_QUE: [por qué es relevante o está creciendo en {platform}, máx 1 línea]
COMO_APLICARLO: [cómo Conexión Summit puede aprovecharla, máx 2 líneas]
IDEA_POST: [idea concreta de post para esta tendencia, máx 1 línea]"""
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.5,
        )
        try:
            from backend.services.ai_usage import log_openai_usage
            log_openai_usage("gpt-4o-mini", response, context="trends/analyze-keyword")
        except Exception:
            pass
        text = response.choices[0].message.content or ""
        result = {"description": "", "why_trending": "", "how_to_apply": "", "post_idea": ""}
        for line in text.split("\n"):
            line = line.strip()
            if line.startswith("DESCRIPCION:"):
                result["description"] = line.replace("DESCRIPCION:", "").strip()
            elif line.startswith("POR_QUE:"):
                result["why_trending"] = line.replace("POR_QUE:", "").strip()
            elif line.startswith("COMO_APLICARLO:"):
                result["how_to_apply"] = line.replace("COMO_APLICARLO:", "").strip()
            elif line.startswith("IDEA_POST:"):
                result["post_idea"] = line.replace("IDEA_POST:", "").strip()
        return result
    except Exception as e:
        logger.warning(f"_analyze_keyword_with_gpt failed for {keyword}: {e}")
        return {"description": "", "why_trending": "", "how_to_apply": "", "post_idea": ""}


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

    max_google = config.get("max_trends_google", 5)
    max_youtube = config.get("max_trends_youtube", 5)

    # Google Trends
    google_items = fetch_google_trends(keywords, geo="CO")[:max_google]
    for item in google_items:
        kw_url_encoded = item["keyword"].replace(" ", "%20")
        item["source_url"] = f"https://trends.google.com/trends/explore?q={kw_url_encoded}&geo=CO"
        if openai_client:
            analysis = analyze_trend(item["keyword"], item["platform"], openai_client, brand_context)
            item.update(analysis)
        item["fetched_at"] = datetime.now().isoformat()
        if store_trend(conn, item):
            stored_count += 1

    # YouTube Trending
    yt_items = fetch_youtube_trending(max_items=max_youtube)
    for item in yt_items:
        if openai_client:
            analysis = analyze_trend(item["keyword"], item["platform"], openai_client, brand_context)
            item.update(analysis)
        item["fetched_at"] = datetime.now().isoformat()
        if store_trend(conn, item):
            stored_count += 1

    # TikTok keywords trends (analyzed by GPT, no real TikTok scraping)
    tiktok_kw = config.get("trend_keywords_tiktok", [])
    max_tiktok = config.get("max_trends_tiktok", 3)
    for kw in tiktok_kw[:max_tiktok]:
        safe_kw = kw.replace(" ", "%20")
        trend_data = {
            "keyword": kw,
            "platform": "TikTok",
            "source_url": f"https://www.tiktok.com/search?q={safe_kw}",
            "fetched_at": datetime.now().isoformat(),
        }
        ai_fields = _analyze_keyword_with_gpt(kw, "TikTok", openai_client, brand_context)
        trend_data.update(ai_fields)
        if store_trend(conn, trend_data):
            stored_count += 1

    # LinkedIn keywords trends
    linkedin_kw = config.get("trend_keywords_linkedin", [])
    max_linkedin = config.get("max_trends_linkedin", 3)
    for kw in linkedin_kw[:max_linkedin]:
        safe_kw = kw.replace(" ", "%20")
        trend_data = {
            "keyword": kw,
            "platform": "LinkedIn",
            "source_url": f"https://www.linkedin.com/search/results/content/?keywords={safe_kw}",
            "fetched_at": datetime.now().isoformat(),
        }
        ai_fields = _analyze_keyword_with_gpt(kw, "LinkedIn", openai_client, brand_context)
        trend_data.update(ai_fields)
        if store_trend(conn, trend_data):
            stored_count += 1

    return stored_count
