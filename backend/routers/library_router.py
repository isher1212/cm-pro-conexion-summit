import logging
import json
from fastapi import APIRouter
from backend.database import get_db

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/library/images")
def list_images(platform: str = "", search: str = "", limit: int = 100,
               from_date: str = "", to_date: str = ""):
    conn = get_db()
    query = "SELECT id, url, prompt, platform, aspect_ratio, model, resolution, proposal_id, created_at FROM image_library WHERE 1=1"
    params = []
    if platform:
        query += " AND platform = ?"
        params.append(platform)
    if search:
        query += " AND prompt LIKE ?"
        params.append(f"%{search}%")
    if from_date:
        query += " AND created_at >= ?"
        params.append(from_date)
    if to_date:
        query += " AND created_at <= ?"
        params.append(to_date + " 23:59:59")
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(min(limit, 500))
    rows = conn.execute(query, params).fetchall()
    cols = ["id", "url", "prompt", "platform", "aspect_ratio", "model", "resolution", "proposal_id", "created_at"]
    return [dict(zip(cols, r)) for r in rows]


@router.get("/library/archive-by-month")
def library_archive():
    conn = get_db()
    rows = conn.execute(
        """SELECT substr(created_at, 1, 7) AS month, COUNT(*) as count
           FROM image_library GROUP BY month ORDER BY month DESC LIMIT 24"""
    ).fetchall()
    return [{"month": r[0], "count": r[1]} for r in rows]


@router.delete("/library/images/{image_id}")
def delete_image(image_id: int):
    conn = get_db()
    try:
        conn.execute("DELETE FROM image_library WHERE id = ?", (image_id,))
        conn.commit()
        return {"status": "ok"}
    except Exception as e:
        logger.warning(f"delete_image failed: {e}")
        return {"error": str(e)}


@router.post("/library/images/attach")
def attach_to_proposal(body: dict):
    """Reutiliza imagen existente en una propuesta."""
    from backend.services.planner import update_proposal
    conn = get_db()
    try:
        proposal_id = int(body.get("proposal_id", 0))
        image_id = int(body.get("image_id", 0))
    except (ValueError, TypeError):
        return {"error": "proposal_id e image_id deben ser numéricos"}
    if not proposal_id or not image_id:
        return {"error": "proposal_id e image_id requeridos"}
    row = conn.execute("SELECT url FROM image_library WHERE id = ?", (image_id,)).fetchone()
    if not row:
        return {"error": "Imagen no encontrada"}
    cur = conn.execute("SELECT image_urls FROM content_proposals WHERE id = ?", (proposal_id,)).fetchone()
    current = []
    if cur and cur[0]:
        try:
            current = json.loads(cur[0])
        except Exception:
            current = []
    if row[0] not in current:
        current.append(row[0])
    update_proposal(conn, proposal_id, {"image_urls": json.dumps(current)})
    return {"status": "ok", "urls": current}
