from fastapi import APIRouter
from backend.services.cleanup import run_cleanup, get_db_stats, get_recent_cleanup_log

router = APIRouter()


@router.post("/cleanup/run")
def run(body: dict = None):
    body = body or {}
    return run_cleanup(dry_run=bool(body.get("dry_run", False)))


@router.get("/cleanup/stats")
def stats():
    return get_db_stats()


@router.get("/cleanup/log")
def cleanup_log(limit: int = 30):
    return get_recent_cleanup_log(limit)
