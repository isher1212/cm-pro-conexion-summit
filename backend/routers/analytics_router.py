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


@router.get("/analytics/heatmap")
def engagement_heatmap(days: int = 90):
    """Heatmap 7x24 con engagement promedio por día_semana × hora."""
    from datetime import datetime as dt
    conn = get_db()
    rows = conn.execute(
        """SELECT published_at, engagement_rate FROM posts
           WHERE published_at >= datetime('now', ?) AND engagement_rate IS NOT NULL""",
        (f"-{days} days",),
    ).fetchall()
    grid = [[{"sum": 0.0, "count": 0} for _ in range(24)] for _ in range(7)]
    for pub, eng in rows:
        if not pub:
            continue
        try:
            d = dt.fromisoformat(pub.replace("Z", "+00:00"))
        except Exception:
            try:
                d = dt.fromisoformat(pub)
            except Exception:
                continue
        wd = d.weekday()
        h = d.hour
        if 0 <= wd < 7 and 0 <= h < 24:
            grid[wd][h]["sum"] += float(eng or 0)
            grid[wd][h]["count"] += 1
    days_labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    result = []
    for wd in range(7):
        for h in range(24):
            cell = grid[wd][h]
            avg = cell["sum"] / cell["count"] if cell["count"] else 0
            result.append({
                "day": days_labels[wd],
                "day_index": wd,
                "hour": h,
                "avg_engagement": round(avg, 2),
                "samples": cell["count"],
            })
    return result


@router.get("/analytics/compare-months")
def compare_months():
    """Comparativa: mes actual vs mes anterior en KPIs principales."""
    from datetime import datetime as dt, timedelta
    conn = get_db()
    today = dt.now()
    cur_start = today.replace(day=1)
    prev_end = cur_start - timedelta(days=1)
    prev_start = prev_end.replace(day=1)

    def query_block(start, end_exclusive):
        s = start.isoformat()
        e = end_exclusive.isoformat()
        posts = conn.execute(
            """SELECT COUNT(*), AVG(reach), AVG(engagement_rate), SUM(likes), SUM(comments)
               FROM posts WHERE published_at >= ? AND published_at < ?""",
            (s, e),
        ).fetchone()
        followers = conn.execute(
            """SELECT followers FROM metrics WHERE recorded_at < ? ORDER BY recorded_at DESC LIMIT 1""",
            (e,),
        ).fetchone()
        return {
            "posts": posts[0] or 0,
            "avg_reach": round(posts[1] or 0, 1),
            "avg_engagement": round(posts[2] or 0, 2),
            "total_likes": posts[3] or 0,
            "total_comments": posts[4] or 0,
            "followers": followers[0] if followers else 0,
        }

    cur = query_block(cur_start, today + timedelta(days=1))
    prev = query_block(prev_start, cur_start)

    def delta_pct(a, b):
        if not b:
            return 0
        return round(((a - b) / b) * 100, 1)

    return {
        "current_month": cur_start.strftime("%Y-%m"),
        "previous_month": prev_start.strftime("%Y-%m"),
        "current": cur,
        "previous": prev,
        "deltas": {
            "posts": cur["posts"] - prev["posts"],
            "avg_reach_pct": delta_pct(cur["avg_reach"], prev["avg_reach"]),
            "avg_engagement_pct": delta_pct(cur["avg_engagement"], prev["avg_engagement"]),
            "total_likes_pct": delta_pct(cur["total_likes"], prev["total_likes"]),
            "followers_pct": delta_pct(cur["followers"], prev["followers"]),
        },
    }


@router.post("/analytics/analyze-sentiment")
def analyze_sentiment_endpoint(body: dict):
    from backend.services.sentiment import analyze_sentiment
    config = load_config()
    key = config.get("openai_api_key", "")
    if not key:
        return {"error": "OpenAI API key no configurada"}
    from openai import OpenAI
    client = OpenAI(api_key=key)
    texts = body.get("texts", [])
    source = body.get("source", "manual")
    return analyze_sentiment(texts, source, client, config.get("brand_context", ""))


@router.get("/analytics/sentiment-history")
def sentiment_history(limit: int = 30):
    from backend.services.sentiment import list_sentiment_history
    return list_sentiment_history(limit)


@router.post("/analytics/sentiment-post/{post_id}")
def sentiment_for_post(post_id: int):
    from backend.services.sentiment import analyze_post_sentiment_auto
    config = load_config()
    key = config.get("openai_api_key", "")
    if not key:
        return {"error": "OpenAI API key no configurada"}
    from openai import OpenAI
    client = OpenAI(api_key=key)
    return analyze_post_sentiment_auto(post_id, client, config)


@router.post("/analytics/import-comments-csv")
async def import_comments_csv_endpoint(file: UploadFile = File(...)):
    from backend.services.comments_import import import_comments_csv
    try:
        content = await file.read()
        text = content.decode("utf-8", errors="replace")
        return import_comments_csv(text)
    except Exception as e:
        return {"error": str(e)}
