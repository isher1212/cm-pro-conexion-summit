import logging
from datetime import datetime
from fastapi import APIRouter
from backend.database import get_db

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/notifications")
def list_notifications(only_unread: bool = False, limit: int = 50):
    conn = get_db()
    query = "SELECT id, type, title, message, item_type, item_id, read_at, created_at FROM notifications"
    if only_unread:
        query += " WHERE read_at IS NULL OR read_at = ''"
    query += " ORDER BY created_at DESC LIMIT ?"
    rows = conn.execute(query, (min(limit, 200),)).fetchall()
    cols = ["id", "type", "title", "message", "item_type", "item_id", "read_at", "created_at"]
    return [dict(zip(cols, r)) for r in rows]


@router.get("/notifications/unread-count")
def unread_count():
    conn = get_db()
    row = conn.execute("SELECT COUNT(*) FROM notifications WHERE read_at IS NULL OR read_at = ''").fetchone()
    return {"count": row[0] if row else 0}


@router.post("/notifications/{notif_id}/read")
def mark_read(notif_id: int):
    conn = get_db()
    try:
        conn.execute("UPDATE notifications SET read_at = ? WHERE id = ?", (datetime.now().isoformat(), notif_id))
        conn.commit()
        return {"status": "ok"}
    except Exception as e:
        return {"error": str(e)}


@router.post("/notifications/mark-all-read")
def mark_all_read():
    conn = get_db()
    try:
        conn.execute("UPDATE notifications SET read_at = ? WHERE read_at IS NULL OR read_at = ''", (datetime.now().isoformat(),))
        conn.commit()
        return {"status": "ok"}
    except Exception as e:
        return {"error": str(e)}


@router.delete("/notifications/{notif_id}")
def delete_notification(notif_id: int):
    conn = get_db()
    try:
        conn.execute("DELETE FROM notifications WHERE id = ?", (notif_id,))
        conn.commit()
        return {"status": "ok"}
    except Exception as e:
        return {"error": str(e)}
