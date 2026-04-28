import logging
from datetime import datetime
from backend.database import get_db
from backend.config import load_config

logger = logging.getLogger(__name__)


def _safe_delete(conn, table: str, where: str, params: tuple, criteria: str) -> int:
    try:
        cur = conn.execute(f"DELETE FROM {table} WHERE {where}", params)
        deleted = cur.rowcount or 0
        conn.execute(
            "INSERT INTO cleanup_log (table_name, deleted_count, criteria, run_at) VALUES (?, ?, ?, ?)",
            (table, deleted, criteria, datetime.now().isoformat()),
        )
        conn.commit()
        return deleted
    except Exception as e:
        logger.warning(f"cleanup {table} failed: {e}")
        return 0


def run_cleanup(dry_run: bool = False) -> dict:
    config = load_config()
    conn = get_db()
    results = {}

    if config.get("cleanup_articles_enabled", False):
        days = int(config.get("cleanup_articles_days", 90))
        criteria = f"age > {days}d, no saved"
        where = "fetched_at < datetime('now', ?) AND url NOT IN (SELECT url FROM saved_items WHERE item_type = 'article')"
        params = (f"-{days} days",)
        if dry_run:
            row = conn.execute(f"SELECT COUNT(*) FROM articles WHERE {where}", params).fetchone()
            results["articles"] = row[0] if row else 0
        else:
            results["articles"] = _safe_delete(conn, "articles", where, params, criteria)

    if config.get("cleanup_trends_enabled", False):
        days = int(config.get("cleanup_trends_days", 60))
        criteria = f"age > {days}d, no saved"
        where = "fetched_at < datetime('now', ?) AND keyword NOT IN (SELECT title FROM saved_items WHERE item_type = 'trend')"
        params = (f"-{days} days",)
        if dry_run:
            row = conn.execute(f"SELECT COUNT(*) FROM trends WHERE {where}", params).fetchone()
            results["trends"] = row[0] if row else 0
        else:
            results["trends"] = _safe_delete(conn, "trends", where, params, criteria)

    if config.get("cleanup_images_enabled", False):
        days = int(config.get("cleanup_images_days", 180))
        criteria = f"age > {days}d, no atadas a propuestas"
        where = "created_at < datetime('now', ?) AND (proposal_id IS NULL OR proposal_id = 0)"
        params = (f"-{days} days",)
        if dry_run:
            row = conn.execute(f"SELECT COUNT(*) FROM image_library WHERE {where}", params).fetchone()
            results["image_library"] = row[0] if row else 0
        else:
            results["image_library"] = _safe_delete(conn, "image_library", where, params, criteria)

    if config.get("cleanup_notifications_enabled", True):
        days = int(config.get("cleanup_notifications_days", 30))
        criteria = f"age > {days}d, leídas"
        where = "created_at < datetime('now', ?) AND read_at IS NOT NULL AND read_at != ''"
        params = (f"-{days} days",)
        if dry_run:
            row = conn.execute(f"SELECT COUNT(*) FROM notifications WHERE {where}", params).fetchone()
            results["notifications"] = row[0] if row else 0
        else:
            results["notifications"] = _safe_delete(conn, "notifications", where, params, criteria)

    if config.get("cleanup_ai_usage_enabled", False):
        days = int(config.get("cleanup_ai_usage_days", 365))
        criteria = f"age > {days}d"
        where = "created_at < datetime('now', ?)"
        params = (f"-{days} days",)
        if dry_run:
            row = conn.execute(f"SELECT COUNT(*) FROM ai_usage_log WHERE {where}", params).fetchone()
            results["ai_usage_log"] = row[0] if row else 0
        else:
            results["ai_usage_log"] = _safe_delete(conn, "ai_usage_log", where, params, criteria)

    return results


def get_db_stats() -> dict:
    conn = get_db()
    tables = ["articles", "trends", "content_proposals", "saved_items", "image_library", "ai_usage_log",
              "notifications", "metrics", "posts", "events", "competitors", "speakers", "sponsors", "post_comments"]
    stats = {}
    for t in tables:
        try:
            row = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()
            stats[t] = row[0] if row else 0
        except Exception:
            stats[t] = 0
    return stats


def get_recent_cleanup_log(limit: int = 30) -> list:
    conn = get_db()
    rows = conn.execute(
        "SELECT id, table_name, deleted_count, criteria, run_at FROM cleanup_log ORDER BY id DESC LIMIT ?",
        (min(limit, 100),),
    ).fetchall()
    cols = ["id", "table_name", "deleted_count", "criteria", "run_at"]
    return [dict(zip(cols, r)) for r in rows]
