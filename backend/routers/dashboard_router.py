from fastapi import APIRouter
from backend.services.dashboard import get_overview

router = APIRouter()


@router.get("/dashboard/overview")
def overview():
    return get_overview()
