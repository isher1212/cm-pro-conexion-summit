import logging
from fastapi import APIRouter
from backend.config import load_config
from backend.services.summit import (
    list_editions, get_edition, upsert_edition, delete_edition, get_or_create_edition_by_year,
    list_items, create_item, update_item, delete_item,
    edition_panorama, historical_overview,
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


@router.get("/summit/editions")
def get_editions():
    return list_editions()


@router.get("/summit/editions/current")
def current_edition():
    config = load_config()
    year = int(config.get("current_edition_year", 2026))
    eid = get_or_create_edition_by_year(year)
    return get_edition(eid)


@router.get("/summit/editions/{edition_id}")
def get_one_edition(edition_id: int):
    e = get_edition(edition_id)
    return e or {"error": "no encontrada"}


@router.post("/summit/editions")
def post_edition(body: dict):
    eid = upsert_edition(body)
    return {"status": "ok", "id": eid}


@router.patch("/summit/editions/{edition_id}")
def patch_edition(edition_id: int, body: dict):
    body["id"] = edition_id
    eid = upsert_edition(body)
    return {"status": "ok", "id": eid}


@router.delete("/summit/editions/{edition_id}")
def del_edition(edition_id: int):
    delete_edition(edition_id)
    return {"status": "ok"}


@router.get("/summit/editions/{edition_id}/{table}")
def get_items(edition_id: int, table: str):
    return list_items(table, edition_id)


@router.post("/summit/editions/{edition_id}/{table}")
def post_item(edition_id: int, table: str, body: dict):
    iid = create_item(table, edition_id, body)
    return {"status": "ok", "id": iid}


@router.patch("/summit/{table}/{item_id}")
def patch_item(table: str, item_id: int, body: dict):
    ok = update_item(table, item_id, body)
    return {"status": "ok" if ok else "noop"}


@router.delete("/summit/{table}/{item_id}")
def del_item(table: str, item_id: int):
    delete_item(table, item_id)
    return {"status": "ok"}


@router.post("/summit/editions/{edition_id}/panorama")
def edition_ai_panorama(edition_id: int):
    config = load_config()
    client = _openai_client(config)
    if not client:
        return {"error": "OpenAI API key no configurada"}
    return edition_panorama(edition_id, client, config.get("brand_context", ""))


@router.post("/summit/historical-overview")
def historical_ai_overview():
    config = load_config()
    client = _openai_client(config)
    if not client:
        return {"error": "OpenAI API key no configurada"}
    return historical_overview(client, config.get("brand_context", ""))
