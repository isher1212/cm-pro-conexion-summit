import httpx
from typing import Any

_GRAPH_BASE = "https://graph.facebook.com/v19.0"


def is_meta_configured(config: dict) -> bool:
    return bool(config.get("meta_access_token") and config.get("meta_ig_user_id"))


def get_meta_status(config: dict) -> dict[str, Any]:
    if not is_meta_configured(config):
        return {"configured": False, "status": "not_configured",
                "message": "Configura meta_access_token y meta_ig_user_id en Configuración"}
    return {"configured": True, "status": "ready",
            "ig_user_id": config.get("meta_ig_user_id")}


def fetch_meta_account_metrics(config: dict) -> list[dict[str, Any]] | None:
    if not is_meta_configured(config):
        return None
    token = config["meta_access_token"]
    ig_id = config["meta_ig_user_id"]
    try:
        resp = httpx.get(
            f"{_GRAPH_BASE}/{ig_id}/insights",
            params={
                "metric": "follower_count,reach,impressions,profile_views",
                "period": "week",
                "access_token": token,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
        return _normalize_meta_insights(data)
    except Exception:
        return None


def fetch_meta_posts(config: dict) -> list[dict[str, Any]] | None:
    if not is_meta_configured(config):
        return None
    token = config["meta_access_token"]
    ig_id = config["meta_ig_user_id"]
    try:
        resp = httpx.get(
            f"{_GRAPH_BASE}/{ig_id}/media",
            params={
                "fields": "id,caption,timestamp,like_count,comments_count,"
                          "reach,impressions,shares,engagement",
                "access_token": token,
            },
            timeout=15,
        )
        resp.raise_for_status()
        media = resp.json().get("data", [])
        return [_normalize_meta_post(p) for p in media]
    except Exception:
        return None


def _normalize_meta_insights(data: list) -> list[dict[str, Any]]:
    from datetime import datetime
    metric_map: dict[str, dict] = {}
    for entry in data:
        metric_name = entry.get("name")
        for value in entry.get("values", []):
            end_time = value.get("end_time", "")[:10]
            if end_time not in metric_map:
                metric_map[end_time] = {"recorded_at": end_time}
            metric_map[end_time][metric_name] = value.get("value", 0)

    rows = []
    for date, m in sorted(metric_map.items()):
        try:
            dt = datetime.strptime(date, "%Y-%m-%d")
            week_label = dt.strftime("%Y-W%W")
        except ValueError:
            week_label = date
        rows.append({
            "platform": "instagram",
            "followers": m.get("follower_count", 0),
            "reach": m.get("reach", 0),
            "impressions": m.get("impressions", 0),
            "likes": 0,
            "comments": 0,
            "shares": 0,
            "engagement_rate": 0.0,
            "recorded_at": date,
            "week_label": week_label,
        })
    return rows


def _normalize_meta_post(p: dict) -> dict[str, Any]:
    likes = p.get("like_count", 0)
    comments = p.get("comments_count", 0)
    reach = p.get("reach", 0)
    eng = round((likes + comments) / reach * 100, 2) if reach > 0 else 0.0
    shares_raw = p.get("shares", {})
    shares = shares_raw.get("count", 0) if isinstance(shares_raw, dict) else 0
    return {
        "platform": "instagram",
        "post_description": (p.get("caption") or "")[:500],
        "published_at": (p.get("timestamp") or "")[:10],
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "reach": reach,
        "impressions": p.get("impressions", 0),
        "engagement_rate": eng,
        "recorded_at": (p.get("timestamp") or "")[:10],
    }
