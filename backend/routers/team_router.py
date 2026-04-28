from fastapi import APIRouter
from backend.services.team import list_members, create_member, update_member, delete_member

router = APIRouter()


@router.get("/team")
def get_team(active_only: bool = True):
    return list_members(active_only=active_only)


@router.post("/team")
def post_member(body: dict):
    return {"status": "ok", "id": create_member(body)}


@router.patch("/team/{member_id}")
def patch_member(member_id: int, body: dict):
    return {"status": "ok" if update_member(member_id, body) else "noop"}


@router.delete("/team/{member_id}")
def del_member(member_id: int):
    delete_member(member_id)
    return {"status": "ok"}
