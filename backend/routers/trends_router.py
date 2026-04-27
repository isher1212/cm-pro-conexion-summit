from fastapi import APIRouter, Query
from backend.database import get_db
from backend.config import load_config
from backend.services.trends import get_trends, run_trends_cycle

router = APIRouter()


@router.get("/trends")
def list_trends(
    limit: int = Query(20, ge=1, le=100),
    platform: str = Query(""),
):
    conn = get_db()
    trends = get_trends(conn, limit=limit, platform=platform)
    return {"trends": trends, "total": len(trends)}


@router.post("/trends/refresh")
def refresh_trends():
    conn = get_db()
    config = load_config()
    openai_client = _get_openai_client(config)
    new_count = run_trends_cycle(conn, config, openai_client)
    return {"new_trends": new_count, "status": "ok"}


def _get_openai_client(config: dict):
    api_key = config.get("openai_api_key", "")
    if not api_key:
        return None
    from openai import OpenAI
    return OpenAI(api_key=api_key)
