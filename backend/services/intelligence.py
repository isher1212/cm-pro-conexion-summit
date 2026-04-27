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


def build_summary_prompt(title: str, content: str, source: str, brand_context: str = "") -> str:
    """Build the GPT prompt for summarizing a single article."""
    context_line = f"\nContexto de la marca: {brand_context}" if brand_context else ""
    return f"""Eres el asistente de análisis de contenido para Conexión Summit, una plataforma de emprendimiento e innovación en LATAM.{context_line}

Analiza el siguiente artículo y responde en español con este formato exacto:

RESUMEN: [3 líneas máximo resumiendo el artículo]
RELEVANCIA: [1 línea explicando si este artículo es relevante para Conexión Summit y por qué]

Artículo:
Título: {title}
Fuente: {source}
Contenido: {content[:2000]}"""


def summarize_article(title: str, content: str, source: str, openai_client: Any, brand_context: str = "") -> dict:
    """Call GPT-4o mini to generate summary and relevance for an article."""
    try:
        prompt = build_summary_prompt(title, content, source, brand_context)
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.3,
        )
        text = response.choices[0].message.content or ""
        summary = ""
        relevance = ""
        for line in text.split("\n"):
            if line.startswith("RESUMEN:"):
                summary = line.replace("RESUMEN:", "").strip()
            elif line.startswith("RELEVANCIA:"):
                relevance = line.replace("RELEVANCIA:", "").strip()
        return {"summary": summary, "relevance": relevance}
    except Exception as e:
        logger.warning(f"Failed to summarize article '{title}': {e}")
        return {"summary": "", "relevance": ""}


def store_article(conn: sqlite3.Connection, article: dict) -> None:
    """Insert article into DB. Silently ignores duplicates (url is UNIQUE)."""
    try:
        conn.execute(
            """INSERT OR IGNORE INTO articles
               (title, source, url, summary, relevance, category, fetched_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                article["title"],
                article["source"],
                article["url"],
                article.get("summary", ""),
                article.get("relevance", ""),
                article.get("category", ""),
                article.get("fetched_at", datetime.now().isoformat()),
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

    for source in sources:
        articles = parse_rss_feed(source["url"], source_name=source["name"], max_items=10)
        for article in articles:
            article["category"] = source.get("category", "")
            if openai_client:
                result = summarize_article(
                    article["title"], article["content"], article["source"],
                    openai_client, brand_context
                )
                article["summary"] = result["summary"]
                article["relevance"] = result["relevance"]
            article["fetched_at"] = datetime.now().isoformat()
            before = _count_articles(conn)
            store_article(conn, article)
            after = _count_articles(conn)
            if after > before:
                stored_count += 1

    return stored_count


def _count_articles(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM articles").fetchone()[0]
