from datetime import datetime
from fastapi import APIRouter, Query
from backend.database import get_db
from backend.config import load_config
from backend.services.intelligence import get_articles, run_intelligence_cycle
from backend.services.image_gen import generate_proposal_from_article
from backend.services.planner import store_proposal

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


@router.post("/intelligence/to-proposal")
def article_to_proposal(body: dict):
    """
    Body: { title: str, summary: str, source: str }
    Uses OpenAI to generate a Parrilla proposal from an article.
    Returns: { status: "ok" } or { error: str }
    """
    config = load_config()
    key = config.get("openai_api_key", "")
    if not key:
        return {"error": "OpenAI API key not configured"}
    from openai import OpenAI
    client = OpenAI(api_key=key)

    proposal = generate_proposal_from_article(
        title=body.get("title", ""),
        summary=body.get("summary", ""),
        source=body.get("source", ""),
        openai_client=client,
        brand_context=config.get("brand_context", ""),
    )
    if not proposal.get("topic"):
        return {"error": "Could not generate proposal from article"}

    proposal["status"] = "proposed"
    proposal["created_at"] = datetime.now().isoformat()
    proposal["image_urls"] = "[]"
    proposal["video_script"] = ""
    store_proposal(get_db(), proposal)
    return {"status": "ok"}
