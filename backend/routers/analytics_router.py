from fastapi import APIRouter, Query
from backend.database import get_db
from backend.services.analytics import (
    store_metrics, get_metrics, get_weekly_summary,
    detect_anomaly, store_post, get_posts,
)
from backend.config import load_config

router = APIRouter()


@router.get("/analytics")
def analytics_summary():
    conn = get_db()
    summary = get_weekly_summary(conn)
    config = load_config()
    threshold = config.get("alert_threshold_pct", 20)
    anomalies = []
    for row in summary:
        result = detect_anomaly(conn, row["platform"], threshold)
        if result["has_anomaly"]:
            anomalies.append({"platform": row["platform"], **result})
    return {"summary": summary, "anomalies": anomalies}


@router.get("/analytics/history")
def analytics_history(
    platform: str = Query(""),
    weeks: int = Query(12, ge=1, le=52),
):
    conn = get_db()
    history = get_metrics(conn, platform=platform, limit=weeks)
    return {"history": history}


@router.post("/analytics/metrics")
def add_metrics(body: dict):
    conn = get_db()
    store_metrics(conn, body)
    return {"status": "ok"}


@router.get("/analytics/posts")
def list_posts(
    platform: str = Query(""),
    limit: int = Query(10, ge=1, le=50),
):
    conn = get_db()
    posts = get_posts(conn, platform=platform, limit=limit)
    return {"posts": posts, "total": len(posts)}


@router.post("/analytics/posts")
def add_post(body: dict):
    conn = get_db()
    store_post(conn, body)
    return {"status": "ok"}
