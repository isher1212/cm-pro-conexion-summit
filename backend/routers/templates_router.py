import logging
from fastapi import APIRouter
from backend.services.templates import list_templates, create_template, update_template, delete_template, render_template

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/templates")
def get_templates(pillar: str = "", search: str = ""):
    return list_templates(pillar=pillar, search=search)


@router.post("/templates")
def post_template(body: dict):
    tid = create_template(body)
    return {"status": "ok", "id": tid}


@router.patch("/templates/{template_id}")
def patch_template(template_id: int, body: dict):
    ok = update_template(template_id, body)
    return {"status": "ok" if ok else "noop"}


@router.delete("/templates/{template_id}")
def del_template(template_id: int):
    delete_template(template_id)
    return {"status": "ok"}


@router.post("/templates/{template_id}/render")
def render(template_id: int, body: dict):
    values = body.get("values", {}) if isinstance(body, dict) else {}
    return render_template(template_id, values)
