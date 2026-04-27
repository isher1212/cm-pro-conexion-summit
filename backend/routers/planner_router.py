from fastapi import APIRouter, Query
from backend.database import get_db
from backend.config import load_config
from backend.services.planner import (
    store_event, get_events, delete_event,
    store_proposal, get_proposals, update_proposal_status,
    update_proposal, generate_proposals,
)

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
