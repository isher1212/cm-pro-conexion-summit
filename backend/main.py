import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.database import get_db
from backend.config import load_config
from backend.scheduler import get_scheduler, start_scheduler, stop_scheduler
from backend.routers.health_router import router as health_router
from backend.routers.config_router import router as config_router
from backend.routers.intelligence_router import router as intelligence_router, _get_openai_client
from backend.services.intelligence import run_intelligence_cycle


def _schedule_intelligence_job():
    from backend.database import get_db as _get_db
    conn = _get_db()
    config = load_config()
    client = _get_openai_client(config)
    run_intelligence_cycle(conn, config, client)


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_db()
    scheduler = get_scheduler()
    scheduler.add_job(
        _schedule_intelligence_job,
        trigger="interval",
        hours=6,
        id="intelligence_cycle",
        replace_existing=True,
    )
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(title="CM Pro", lifespan=lifespan)

app.include_router(health_router, prefix="/api")
app.include_router(config_router, prefix="/api")
app.include_router(intelligence_router, prefix="/api")

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
