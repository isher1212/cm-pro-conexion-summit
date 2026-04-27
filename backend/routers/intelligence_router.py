from fastapi import APIRouter, Query
from backend.database import get_db
from backend.config import load_config
from backend.services.intelligence import get_articles, run_intelligence_cycle

router = APIRouter()


@router.get("/intelligence/articles")
def list_articles(
    limit: int = Query(50, ge=1, le=200),
    category: str = Query(""),
    search: str = Query(""),
):
    conn = get_db()
    articles = get_articles(conn, limit=limit, category=category, search=search)
    return {"articles": articles, "total": len(articles)}


@router.post("/intelligence/refresh")
def refresh_articles():
    conn = get_db()
    config = load_config()
    openai_client = _get_openai_client(config)
    new_count = run_intelligence_cycle(conn, config, openai_client)
    return {"new_articles": new_count, "status": "ok"}


def _get_openai_client(config: dict):
    api_key = config.get("openai_api_key", "")
    if not api_key:
        return None
    from openai import OpenAI
    return OpenAI(api_key=api_key)
