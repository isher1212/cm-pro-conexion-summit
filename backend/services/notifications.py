import logging
from datetime import datetime
from backend.database import get_db

logger = logging.getLogger(__name__)


def create_notification(type: str, title: str, message: str = "", item_type: str = "", item_id: int = 0):
    try:
        conn = get_db()
        conn.execute(
            """INSERT INTO notifications (type, title, message, item_type, item_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (type, title, message, item_type, item_id, datetime.now().isoformat()),
        )
        conn.commit()
    except Exception as e:
        logger.warning(f"create_notification failed: {e}")


def trigger_relevant_article(article_id: int, title: str, score: int, threshold: int = 8):
    if score < threshold:
        return
    create_notification(
        type="article_relevant",
        title=f"Artículo de alta relevancia ({score}/10)",
        message=title,
        item_type="article",
        item_id=article_id,
    )


def trigger_new_trend(trend_id: int, keyword: str, platform: str):
    create_notification(
        type="new_trend",
        title=f"Nueva tendencia en {platform}",
        message=keyword,
        item_type="trend",
        item_id=trend_id,
    )
