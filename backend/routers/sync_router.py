from fastapi import APIRouter
from backend.services.sync import start_sync, cancel_sync, get_active_job, get_last_job

router = APIRouter()


@router.post("/sync/start")
def start(body: dict = None):
    body = body or {}
    job_id = start_sync(skip_analytics=bool(body.get("skip_analytics", False)))
    return {"status": "ok", "job_id": job_id}


@router.get("/sync/status")
def status():
    active = get_active_job()
    if active:
        return {"active": True, "job": active}
    last = get_last_job()
    return {"active": False, "job": last}


@router.post("/sync/cancel/{job_id}")
def cancel(job_id: int):
    cancel_sync(job_id)
    return {"status": "ok"}
