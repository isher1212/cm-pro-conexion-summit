import logging
from datetime import datetime
from fastapi import APIRouter
from backend.database import get_db

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/saved")
def save_item(body: dict):
    """
    Body: { item_type, title, url, summary, source, category, platform }
    Returns: { status: "ok", id }
    """
    conn = get_db()
    try:
        cur = conn.execute(
            """INSERT INTO saved_items (item_type, title, url, summary, source, category, platform, saved_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                body.get("item_type", "article"),
                body.get("title", ""),
                body.get("url", ""),
                body.get("summary", ""),
                body.get("source", ""),
                body.get("category", ""),
                body.get("platform", ""),
                datetime.now().isoformat(),
            ),
        )
        conn.commit()
        return {"status": "ok", "id": cur.lastrowid}
    except Exception as e:
        logger.warning(f"save_item failed: {e}")
        return {"error": str(e)}


@router.get("/saved")
def list_saved(item_type: str = "", search: str = "", limit: int = 100):
    conn = get_db()
    query = "SELECT id, item_type, title, url, summary, source, category, platform, saved_at FROM saved_items"
    params: list = []
    conditions = []
    if item_type:
        conditions.append("item_type = ?")
        params.append(item_type)
    if search:
        conditions.append("(title LIKE ? OR summary LIKE ?)")
        params += [f"%{search}%", f"%{search}%"]
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY saved_at DESC LIMIT ?"
    params.append(min(limit, 500))
    rows = conn.execute(query, params).fetchall()
    cols = ["id", "item_type", "title", "url", "summary", "source", "category", "platform", "saved_at"]
    return [dict(zip(cols, r)) for r in rows]


@router.delete("/saved/{item_id}")
def delete_saved(item_id: int):
    conn = get_db()
    try:
        conn.execute("DELETE FROM saved_items WHERE id = ?", (item_id,))
        conn.commit()
        return {"status": "ok"}
    except Exception as e:
        logger.warning(f"delete_saved failed: {e}")
        return {"error": str(e)}
