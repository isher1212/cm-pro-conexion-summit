import logging
from fastapi import APIRouter, Query
from backend.database import get_db
from backend.config import load_config
from backend.services.planner import (
    store_event, get_events, delete_event,
    store_proposal, get_proposals, update_proposal_status,
    update_proposal, generate_proposals,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/planner/events")
def list_events(from_date: str = Query("")):
    conn = get_db()
    events = get_events(conn, from_date=from_date, limit=50)
    return {"events": events}


@router.post("/planner/events")
def add_event(body: dict):
    conn = get_db()
    store_event(conn, body)
    return {"status": "ok"}


@router.delete("/planner/events/{event_id}")
def remove_event(event_id: int):
    conn = get_db()
    delete_event(conn, event_id)
    return {"status": "ok"}


@router.get("/planner/proposals")
def list_proposals(
    status: str = Query(""),
    limit: int = Query(100, ge=1, le=200),
):
    conn = get_db()
    proposals = get_proposals(conn, status=status, limit=limit)
    return {"proposals": proposals, "total": len(proposals)}


@router.post("/planner/proposals")
def add_proposal(body: dict):
    conn = get_db()
    store_proposal(conn, body)
    return {"status": "ok"}


@router.patch("/planner/proposals/{proposal_id}/status")
def set_proposal_status(proposal_id: int, body: dict):
    conn = get_db()
    update_proposal_status(conn, proposal_id, body.get("status", "proposed"))
    return {"status": "ok"}


@router.patch("/planner/proposals/{proposal_id}")
def edit_proposal(proposal_id: int, body: dict):
    conn = get_db()
    update_proposal(conn, proposal_id, body)
    return {"status": "ok"}


@router.post("/planner/generate")
def generate(body: dict = {}):
    conn = get_db()
    config = load_config()
    openai_client = _get_openai_client(config)
    n = body.get("n_proposals", 5)
    count = generate_proposals(conn, config, openai_client, n_proposals=n)
    return {"generated": count, "status": "ok"}


def _get_openai_client(config: dict):
    api_key = config.get("openai_api_key", "")
    if not api_key:
        return None
    from openai import OpenAI
    return OpenAI(api_key=api_key)


@router.patch("/planner/proposals/reorder")
def reorder_proposals(body: dict):
    """
    Body: { ordered_ids: [int, ...] }
    Asigna order_index = 0..N-1 según el orden recibido.
    """
    ordered_ids = body.get("ordered_ids", [])
    if not isinstance(ordered_ids, list):
        return {"error": "ordered_ids debe ser lista"}
    conn = get_db()
    try:
        for idx, pid in enumerate(ordered_ids):
            try:
                conn.execute("UPDATE content_proposals SET order_index = ? WHERE id = ?", (idx, int(pid)))
            except (ValueError, TypeError):
                continue
        conn.commit()
        return {"status": "ok", "count": len(ordered_ids)}
    except Exception as e:
        logger.warning(f"reorder failed: {e}")
        return {"error": str(e)}
