from fastapi import APIRouter
from backend.scheduler import get_scheduler

router = APIRouter()

@router.get("/health")
def health():
    scheduler = get_scheduler()
    return {
        "status": "ok",
        "version": "1.0.0",
        "scheduler_running": scheduler.running,
    }
