import json
import logging
from datetime import datetime
from fastapi import APIRouter
from backend.database import get_db
from backend.config import load_config
from backend.services.image_gen import (
    generate_images, generate_video_script, get_youtube_thumbnail,
)
from backend.services.planner import update_proposal, store_proposal

router = APIRouter()
logger = logging.getLogger(__name__)


def _kie(config: dict) -> dict:
    return {
        "api_key": config.get("kie_ai_api_key", ""),
        "model": config.get("kie_ai_model", "nano-banana-2"),
        "resolution": config.get("kie_ai_resolution", "1K"),
    }


def _openai(config: dict):
    key = config.get("openai_api_key", "")
    if not key:
        return None
    from openai import OpenAI
    return OpenAI(api_key=key)


@router.post("/images/generate")
def generate_proposal_images(body: dict):
    """
    Body: { proposal_id, topic, platform, caption_draft, extra_specs, n }
    Returns: { urls, proposal_id }
    """
    config = load_config()
    kie = _kie(config)
    if not kie["api_key"]:
        return {"error": "Kie AI API key not configured", "urls": []}

    n = max(1, min(10, int(body.get("n", 1))))
    urls = generate_images(
        topic=body.get("topic", ""),
        platform=body.get("platform", "Instagram"),
        caption=body.get("caption_draft", ""),
        api_key=kie["api_key"],
        model=kie["model"],
        resolution=kie["resolution"],
        extra_specs=body.get("extra_specs", ""),
        brand_context=config.get("brand_context", ""),
        n=n,
    )

    proposal_id = body.get("proposal_id")
    if proposal_id and urls:
        update_proposal(get_db(), proposal_id, {"image_urls": json.dumps(urls)})

    return {"urls": urls, "proposal_id": proposal_id}


@router.post("/images/video-script")
def generate_proposal_script(body: dict):
    """
    Body: { proposal_id, topic, platform, caption_draft, hashtags }
    Returns: { hook, desarrollo, cta, voz_en_off, duracion, proposal_id }
    """
    config = load_config()
    client = _openai(config)
    if not client:
        return {"error": "OpenAI API key not configured"}

    script = generate_video_script(
        topic=body.get("topic", ""),
        platform=body.get("platform", ""),
        caption=body.get("caption_draft", ""),
        hashtags=body.get("hashtags", ""),
        openai_client=client,
        brand_context=config.get("brand_context", ""),
    )

    proposal_id = body.get("proposal_id")
    if proposal_id:
        update_proposal(get_db(), proposal_id, {"video_script": json.dumps(script)})

    return {**script, "proposal_id": proposal_id}


@router.post("/images/replicate-trend")
def replicate_trend(body: dict):
    """
    Body: {
      keyword, platform_origin, trend_url, target_platform,
      mode ("image"|"video_script"), extra_specs, send_to_parrilla
    }
    Returns: { urls?, script?, proposal_created? }
    """
    config = load_config()
    kie = _kie(config)
    client = _openai(config)
    keyword = body.get("keyword", "")
    target_platform = body.get("target_platform", "Instagram")
    mode = body.get("mode", "image")
    trend_url = body.get("trend_url", "")
    extra_specs = body.get("extra_specs", "")
    brand_context = config.get("brand_context", "")
    result: dict = {}

    if mode == "video_script":
        if not client:
            return {"error": "OpenAI API key not configured"}
        script = generate_video_script(
            topic=keyword,
            platform=target_platform,
            caption="",
            hashtags="",
            openai_client=client,
            brand_context=brand_context,
        )
        result["script"] = script

    else:
        if not kie["api_key"]:
            return {"error": "Kie AI API key not configured", "urls": []}
        thumb = get_youtube_thumbnail(trend_url) if trend_url else None
        image_input = [thumb] if thumb else None
        urls = generate_images(
            topic=keyword,
            platform=target_platform,
            caption="",
            api_key=kie["api_key"],
            model=kie["model"],
            resolution=kie["resolution"],
            extra_specs=extra_specs,
            brand_context=brand_context,
            n=1,
            image_input_urls=image_input,
        )
        result["urls"] = urls

    if body.get("send_to_parrilla") and client:
        from datetime import timedelta
        suggested_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        proposal = {
            "topic": keyword,
            "format": "Reel" if mode == "video_script" else "Post",
            "platform": target_platform,
            "suggested_date": suggested_date,
            "caption_draft": "",
            "hashtags": "",
            "status": "proposed",
            "created_at": datetime.now().isoformat(),
            "image_urls": json.dumps(result.get("urls", [])),
            "video_script": json.dumps(result.get("script", {})),
        }
        store_proposal(get_db(), proposal)
        result["proposal_created"] = True

    return result
