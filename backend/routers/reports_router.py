from fastapi import APIRouter, Query
from backend.database import get_db
from backend.config import load_config
from backend.services.reports import (
    get_report_log, run_daily_email_job, run_weekly_email_job,
    run_daily_intelligence_telegram, run_daily_trends_telegram,
    run_weekly_telegram_job, send_monthly_report_email,
    run_weekly_intelligence_email,
)

router = APIRouter()


def _get_openai_client(config: dict):
    api_key = config.get("openai_api_key", "")
    if not api_key:
        return None
    from openai import OpenAI
    return OpenAI(api_key=api_key)


@router.get("/reports/log")
def report_log(limit: int = Query(50, ge=1, le=200)):
    conn = get_db()
    return {"log": get_report_log(conn, limit=limit)}


@router.post("/reports/send-daily-email")
def send_daily_email():
    conn = get_db()
    config = load_config()
    run_daily_email_job(conn, config, _get_openai_client(config))
    return {"status": "ok"}


@router.post("/reports/send-weekly-email")
def send_weekly_email():
    conn = get_db()
    config = load_config()
    run_weekly_email_job(conn, config, _get_openai_client(config))
    return {"status": "ok"}


@router.post("/reports/send-daily-telegram")
def send_daily_telegram():
    conn = get_db()
    config = load_config()
    run_daily_intelligence_telegram(conn, config)
    run_daily_trends_telegram(conn, config)
    return {"status": "ok"}


@router.post("/reports/send-weekly-telegram")
def send_weekly_telegram():
    conn = get_db()
    config = load_config()
    run_weekly_telegram_job(conn, config)
    return {"status": "ok"}


@router.post("/reports/send-monthly")
def send_monthly():
    conn = get_db()
    config = load_config()
    return send_monthly_report_email(conn, config)


@router.post("/reports/send-weekly-intelligence")
def send_weekly_intelligence():
    conn = get_db()
    config = load_config()
    return run_weekly_intelligence_email(conn, config)
