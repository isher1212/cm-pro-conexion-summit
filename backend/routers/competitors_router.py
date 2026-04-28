import logging
from fastapi import APIRouter
from backend.config import load_config
from backend.services.competitors import (
    list_competitors, create_competitor, update_competitor, delete_competitor,
    list_posts, add_post, analyze_competitor_with_gpt, suggest_with_gpt,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _openai_client(config):
    key = config.get("openai_api_key", "")
    if not key:
        return None
    try:
        from openai import OpenAI
        return OpenAI(api_key=key)
    except Exception:
        return None


@router.get("/competitors")
def get_competitors(scope: str = "", active_only: bool = True):
    return list_competitors(scope=scope, active_only=active_only)


@router.post("/competitors")
def post_competitor(body: dict):
    cid = create_competitor(body)
    return {"status": "ok", "id": cid}


@router.patch("/competitors/{competitor_id}")
def patch_competitor(competitor_id: int, body: dict):
    ok = update_competitor(competitor_id, body)
    return {"status": "ok" if ok else "noop"}


@router.delete("/competitors/{competitor_id}")
def del_competitor(competitor_id: int):
    delete_competitor(competitor_id)
    return {"status": "ok"}


@router.get("/competitors/{competitor_id}/posts")
def get_posts(competitor_id: int, limit: int = 50):
    return list_posts(competitor_id, limit)


@router.post("/competitors/{competitor_id}/posts")
def post_post(competitor_id: int, body: dict):
    pid = add_post(competitor_id, body)
    return {"status": "ok", "id": pid}


@router.post("/competitors/{competitor_id}/analyze")
def analyze_competitor(competitor_id: int):
    config = load_config()
    client = _openai_client(config)
    if not client:
        return {"error": "OpenAI API key no configurada"}
    return analyze_competitor_with_gpt(competitor_id, client, config.get("brand_context", ""))


@router.post("/competitors/suggest")
def suggest_competitors(body: dict):
    config = load_config()
    client = _openai_client(config)
    if not client:
        return {"error": "OpenAI API key no configurada"}
    return suggest_with_gpt(
        scope=body.get("scope", "national"),
        category=body.get("category", ""),
        openai_client=client,
        brand_context=config.get("brand_context", ""),
    )
