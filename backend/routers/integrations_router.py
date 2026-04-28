from fastapi import APIRouter
from backend.services.integrations import (
    list_integrations, get_or_create_integration, update_integration, list_available_providers,
)

router = APIRouter()


@router.get("/integrations")
def get_all():
    return {
        "active": list_integrations(),
        "available": list_available_providers(),
    }


@router.post("/integrations/{provider}")
def upsert_provider(provider: str, body: dict):
    info = get_or_create_integration(provider)
    update_integration(info["id"], body)
    return {"status": "ok", "id": info["id"]}


@router.patch("/integrations/{integration_id}")
def patch_integration(integration_id: int, body: dict):
    return {"status": "ok" if update_integration(integration_id, body) else "noop"}
