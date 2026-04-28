import feedparser
import httpx
from datetime import datetime
from typing import Any
import sqlite3
import logging

logger = logging.getLogger(__name__)


def parse_rss_feed(url: str, source_name: str = "", max_items: int = 10) -> list[dict]:
    """Fetch and parse an RSS feed, returning a list of article dicts."""
    try:
        feed = feedparser.parse(url, request_headers={"User-Agent": "CMPro/1.0"})
        articles = []
        for entry in feed.entries[:max_items]:
            articles.append({
                "title": entry.get("title", "").strip(),
                "url": entry.get("link", ""),
                "source": source_name or feed.feed.get("title", url),
                "published": entry.get("published", datetime.now().isoformat()),
                "content": _extract_content(entry),
            })
        return articles
    except Exception as e:
        logger.warning(f"Failed to parse RSS feed {url}: {e}")
        return []


def _extract_content(entry: Any) -> str:
    """Extract the best available text content from a feed entry."""
    if hasattr(entry, "content") and entry.content:
        return entry.content[0].get("value", "")
    if hasattr(entry, "summary"):
        return entry.summary or ""
    return ""


def build_summary_prompt(title: str, source: str, content: str, brand_context: str = "") -> str:
    """Build the GPT prompt for summarizing a single article."""
    context_line = f"\nContexto de marca: {brand_context}" if brand_context else ""
    return f"""Eres analista de contenido para Conexión Summit (plataforma de emprendimiento LATAM).{context_line}

Artículo:
TÍTULO: {title}
FUENTE: {source}
CONTENIDO: {content[:800]}

Responde EXACTAMENTE en este formato (sin texto adicional, en español):

TITULO_ES: [título traducido al español, natural, máx 12 palabras]
RESUMEN: [resumen en español, máx 2 líneas, enfocado en el ecosistema emprendedor LATAM]
RELEVANCIA: [cómo este artículo impacta o se relaciona con Conexión Summit, máx 1 línea]
RELEVANCIA_SCORE: [número entero del 1 al 10. 10=muy relevante para Conexión Summit (startups/innovación/LATAM/conexiones B2B). 1=irrelevante. Considera: cercanía al ecosistema emprendedor de Colombia/LATAM, valor para community manager, potencial de contenido]"""


def summarize_article(title: str, content: str, source: str, openai_client: Any, brand_context: str = "") -> dict:
    """Call GPT-4o mini to generate summary and relevance for an article."""
    try:
        prompt = build_summary_prompt(title, source, content, brand_context)
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.3,
        )
        text = response.choices[0].message.content or ""
        result = {"title_es": "", "summary": "", "relevance": "", "relevance_score": 0}
        for line in text.split("\n"):
            line = line.strip()
            if line.startswith("TITULO_ES:"):
                result["title_es"] = line.replace("TITULO_ES:", "").strip()
            elif line.startswith("RELEVANCIA_SCORE:"):
                try:
                    num = int(''.join(c for c in line.replace("RELEVANCIA_SCORE:", "") if c.isdigit()))
                    result["relevance_score"] = max(1, min(10, num))
                except Exception:
                    result["relevance_score"] = 5
            elif line.startswith("RESUMEN:"):
                result["summary"] = line.replace("RESUMEN:", "").strip()
            elif line.startswith("RELEVANCIA:"):
                result["relevance"] = line.replace("RELEVANCIA:", "").strip()
        return result
    except Exception as e:
        logger.warning(f"Failed to summarize article '{title}': {e}")
        return {"title_es": "", "summary": "", "relevance": "", "relevance_score": 0}


def store_article(conn: sqlite3.Connection, article: dict) -> None:
    """Insert article into DB. Silently ignores duplicates (url is UNIQUE)."""
    try:
        conn.execute(
            """INSERT OR IGNORE INTO articles
               (title, title_es, source, url, summary, relevance, relevance_score, category, fetched_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                article["title"],
                article.get("title_es", ""),
                article["source"],
                article["url"],
                article.get("summary", ""),
                article.get("relevance", ""),
                article.get("relevance_score", 0),
                article.get("category", ""),
                article.get("fetched_at", datetime.now().isoformat()),
            ),
        )
        # Backfill: si ya existía, rellena campos vacíos
        conn.execute(
            """UPDATE articles
               SET title_es = CASE WHEN (title_es IS NULL OR title_es = '') THEN ? ELSE title_es END,
                   summary = CASE WHEN (summary IS NULL OR summary = '') THEN ? ELSE summary END,
                   relevance = CASE WHEN (relevance IS NULL OR relevance = '') THEN ? ELSE relevance END,
                   relevance_score = CASE WHEN (relevance_score IS NULL OR relevance_score = 0) THEN ? ELSE relevance_score END
               WHERE url = ?""",
            (
                article.get("title_es", ""),
                article.get("summary", ""),
                article.get("relevance", ""),
                article.get("relevance_score", 0),
                article["url"],
            ),
        )
        conn.commit()
    except Exception as e:
        logger.warning(f"Failed to store article {article.get('url')}: {e}")


def get_articles(conn: sqlite3.Connection, limit: int = 50, category: str = "", search: str = "") -> list[dict]:
    """Retrieve articles from DB with optional category filter and search."""
    query = "SELECT * FROM articles"
    params: list[Any] = []
    conditions = []
    if category:
        conditions.append("category = ?")
        params.append(category)
    if search:
        conditions.append("(title LIKE ? OR summary LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY fetched_at DESC LIMIT ?"
    params.append(limit)
    cursor = conn.execute(query, params)
    return [dict(row) for row in cursor.fetchall()]


def run_intelligence_cycle(conn: sqlite3.Connection, config: dict, openai_client: Any | None = None) -> int:
    """
    Main cycle: fetch all active RSS sources, summarize new articles, store them.
    Returns number of new articles stored.
    """
    sources = [s for s in config.get("rss_sources", []) if s.get("active", True)]
    brand_context = config.get("brand_context", "")
    stored_count = 0

    limits_by_category = {
        "Colombia": config.get("count_articles_colombia", 5),
        "LATAM": config.get("count_articles_latam", 5),
        "Global": config.get("count_articles_global", 5),
    }
    counts_by_category: dict[str, int] = {"Colombia": 0, "LATAM": 0, "Global": 0}
    max_per_feed = config.get("max_articles_per_feed", 10)

    for source in sources:
        cat = source.get("category", "Global")
        cat_limit = limits_by_category.get(cat, 5)
        cat_count = counts_by_category.get(cat, 0)
        if cat_count >= cat_limit:
            continue
        remaining = cat_limit - cat_count
        take = min(max_per_feed, remaining)

        articles = parse_rss_feed(source["url"], source_name=source["name"], max_items=take)
        for article in articles:
            article["category"] = cat
            if openai_client:
                result = summarize_article(
                    article["title"], article["content"], article["source"],
                    openai_client, brand_context
                )
                article["title_es"] = result.get("title_es", "")
                article["summary"] = result.get("summary", "")
                article["relevance"] = result.get("relevance", "")
                article["relevance_score"] = result.get("relevance_score", 0)
            article["fetched_at"] = datetime.now().isoformat()
            before = _count_articles(conn)
            store_article(conn, article)
            after = _count_articles(conn)
            if after > before:
                stored_count += 1
                counts_by_category[cat] = counts_by_category.get(cat, 0) + 1

    return stored_count


def _count_articles(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM articles").fetchone()[0]
