from fastapi import APIRouter, Query, UploadFile, File
from backend.database import get_db
from backend.services.analytics import (
    store_metrics, get_metrics, get_weekly_summary,
    detect_anomaly, store_post, get_posts,
)
from backend.config import load_config
from backend.services.instagram_import import parse_instagram_account_csv, parse_instagram_posts_csv
from backend.services.instagram_api import get_meta_status, fetch_meta_account_metrics, fetch_meta_posts

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


@router.post("/analytics/import/instagram-csv")
async def import_instagram_csv(
    file_type: str = Query("account", pattern="^(account|posts)$"),
    file: UploadFile = File(...),
):
    content = await file.read()
    csv_data = content.decode("utf-8-sig")
    conn = get_db()

    if file_type == "account":
        rows = parse_instagram_account_csv(csv_data)
        imported = 0
        for row in rows:
            try:
                store_metrics(conn, row)
                imported += 1
            except Exception:
                pass
        return {"imported": imported, "total": len(rows), "type": "account"}

    rows = parse_instagram_posts_csv(csv_data)
    imported = 0
    for row in rows:
        try:
            store_post(conn, row)
            imported += 1
        except Exception:
            pass
    return {"imported": imported, "total": len(rows), "type": "posts"}


@router.get("/analytics/instagram/status")
def instagram_connection_status():
    config = load_config()
    return get_meta_status(config)


@router.post("/analytics/instagram/sync")
def instagram_sync():
    config = load_config()
    conn = get_db()

    account_rows = fetch_meta_account_metrics(config)
    if account_rows is None:
        return {"status": "not_configured",
                "message": "Meta API no configurada. Agrega meta_access_token en Configuración."}

    metrics_imported = 0
    for row in account_rows:
        try:
            store_metrics(conn, row)
            metrics_imported += 1
        except Exception:
            pass

    posts = fetch_meta_posts(config) or []
    posts_imported = 0
    for post in posts:
        try:
            store_post(conn, post)
            posts_imported += 1
        except Exception:
            pass

    return {"status": "ok", "metrics_imported": metrics_imported, "posts_imported": posts_imported}
