from fastapi import APIRouter
from backend.services.brand import (
    list_brands, get_brand, upsert_brand, delete_brand, set_current_brand, get_current_brand,
)

router = APIRouter()


@router.get("/brand/current")
def current():
    b = get_current_brand()
    return b or {}


@router.get("/brand/all")
def get_all():
    return list_brands()


@router.get("/brand/{brand_id}")
def get_one(brand_id: int):
    return get_brand(brand_id) or {"error": "no encontrada"}


@router.post("/brand")
def post_brand(body: dict):
    return {"status": "ok", "id": upsert_brand(body)}


@router.patch("/brand/{brand_id}")
def patch_brand(brand_id: int, body: dict):
    body["id"] = brand_id
    return {"status": "ok", "id": upsert_brand(body)}


@router.delete("/brand/{brand_id}")
def del_brand(brand_id: int):
    delete_brand(brand_id)
    return {"status": "ok"}


@router.post("/brand/{brand_id}/activate")
def activate(brand_id: int):
    set_current_brand(brand_id)
    return {"status": "ok"}
