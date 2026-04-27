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
from backend.routers.trends_router import router as trends_router
from backend.routers.analytics_router import router as analytics_router
from backend.routers.planner_router import router as planner_router
from backend.routers.reports_router import router as reports_router
from backend.services.intelligence import run_intelligence_cycle
from backend.services.trends import run_trends_cycle
from backend.services.reports import (
    run_daily_intelligence_telegram, run_daily_trends_telegram,
    run_daily_email_job, run_weekly_email_job, run_weekly_telegram_job,
)


def _schedule_intelligence_job():
    from backend.database import get_db as _get_db
    conn = _get_db()
    config = load_config()
    client = _get_openai_client(config)
    run_intelligence_cycle(conn, config, client)


def _schedule_trends_job():
    from backend.database import get_db as _get_db
    from backend.routers.trends_router import _get_openai_client as _get_oa
    conn = _get_db()
    config = load_config()
    client = _get_oa(config)
    run_trends_cycle(conn, config, client)


def _schedule_daily_email():
    from backend.database import get_db as _get_db
    from backend.routers.reports_router import _get_openai_client as _get_oa
    conn = _get_db()
    config = load_config()
    run_daily_email_job(conn, config, _get_oa(config))


def _schedule_daily_telegram_intelligence():
    from backend.database import get_db as _get_db
    conn = _get_db()
    config = load_config()
    run_daily_intelligence_telegram(conn, config)


def _schedule_daily_telegram_trends():
    from backend.database import get_db as _get_db
    conn = _get_db()
    config = load_config()
    run_daily_trends_telegram(conn, config)


def _schedule_weekly_email():
    from backend.database import get_db as _get_db
    from backend.routers.reports_router import _get_openai_client as _get_oa
    conn = _get_db()
    config = load_config()
    run_weekly_email_job(conn, config, _get_oa(config))


def _schedule_weekly_telegram():
    from backend.database import get_db as _get_db
    conn = _get_db()
    config = load_config()
    run_weekly_telegram_job(conn, config)


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_db()
    scheduler = get_scheduler()

    scheduler.add_job(_schedule_intelligence_job, trigger="interval", hours=6, id="intelligence_cycle", replace_existing=True)
    scheduler.add_job(_schedule_trends_job, trigger="interval", hours=24, id="trends_cycle", replace_existing=True)
    scheduler.add_job(_schedule_daily_email, trigger="cron", hour=7, minute=0, id="daily_email", replace_existing=True)
    scheduler.add_job(_schedule_daily_telegram_intelligence, trigger="cron", hour=7, minute=0, id="daily_telegram_intelligence", replace_existing=True)
    scheduler.add_job(_schedule_daily_telegram_trends, trigger="cron", hour=9, minute=0, id="daily_telegram_trends", replace_existing=True)
    scheduler.add_job(_schedule_weekly_email, trigger="cron", day_of_week="mon", hour=8, minute=0, id="weekly_email", replace_existing=True)
    scheduler.add_job(_schedule_weekly_telegram, trigger="cron", day_of_week="mon", hour=8, minute=30, id="weekly_telegram", replace_existing=True)

    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="CM Pro", lifespan=lifespan)

app.include_router(health_router, prefix="/api")
app.include_router(config_router, prefix="/api")
app.include_router(intelligence_router, prefix="/api")
app.include_router(trends_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(planner_router, prefix="/api")
app.include_router(reports_router, prefix="/api")

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
