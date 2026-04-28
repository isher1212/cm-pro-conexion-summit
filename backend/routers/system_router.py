from fastapi import APIRouter
from backend.services.reset import reset_for_new_brand

router = APIRouter()


@router.post("/system/reset-for-new-brand")
def reset(body: dict):
    new_brand = body.get("brand", {})
    if not new_brand.get("name"):
        return {"error": "Se requiere al menos el nombre de la marca"}
    return reset_for_new_brand(new_brand)
