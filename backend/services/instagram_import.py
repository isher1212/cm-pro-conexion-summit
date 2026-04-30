import csv
import io
from typing import Any
from datetime import datetime


_ACCOUNT_COLUMN_MAP = {
    "date": "date", "fecha": "date",
    "followers": "followers", "seguidores": "followers",
    "reach": "reach", "alcance": "reach",
    "impressions": "impressions", "impresiones": "impressions",
    "profile views": "profile_views", "visitas al perfil": "profile_views",
    "likes": "likes", "me gusta": "likes",
    "comments": "comments", "comentarios": "comments",
}

_POSTS_COLUMN_MAP = {
    "description": "description", "descripción": "description", "caption": "description",
    "permalink": "url", "enlace": "url",
    "date": "date", "fecha": "date",
    "likes": "likes", "me gusta": "likes",
    "comments": "comments", "comentarios": "comments",
    "saves": "saves", "guardados": "saves",
    "shares": "shares", "compartidos": "shares",
    "reach": "reach", "alcance": "reach",
    "impressions": "impressions", "impresiones": "impressions",
}


def _normalize_header(h: str) -> str:
    return h.strip().lower()


def _safe_int(val: str) -> int:
    try:
        return int(str(val).replace(",", "").replace(".", "").strip())
    except (ValueError, AttributeError):
        return 0


def _week_label(date_str: str) -> str:
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.strftime("%Y-W%W")
        except ValueError:
            continue
    return date_str.strip()


def parse_instagram_account_csv(csv_data: str) -> list[dict[str, Any]]:
    if not csv_data or not csv_data.strip():
        return []
    reader = csv.DictReader(io.StringIO(csv_data.strip()))
    results = []
    for row in reader:
        mapped: dict[str, Any] = {}
        for raw_col, val in row.items():
            norm = _normalize_header(raw_col)
            target = _ACCOUNT_COLUMN_MAP.get(norm)
            if target:
                mapped[target] = val
        if "date" not in mapped:
            continue
        results.append({
            "platform": "Instagram",
            "followers": _safe_int(mapped.get("followers", 0)),
            "reach": _safe_int(mapped.get("reach", 0)),
            "impressions": _safe_int(mapped.get("impressions", 0)),
            "likes": _safe_int(mapped.get("likes", 0)),
            "comments": _safe_int(mapped.get("comments", 0)),
            "shares": 0,
            "engagement_rate": 0.0,
            "recorded_at": mapped["date"].strip(),
            "week_label": _week_label(mapped["date"]),
        })
    return results


def parse_instagram_posts_csv(csv_data: str) -> list[dict[str, Any]]:
    if not csv_data or not csv_data.strip():
        return []
    reader = csv.DictReader(io.StringIO(csv_data.strip()))
    results = []
    for row in reader:
        mapped: dict[str, Any] = {}
        for raw_col, val in row.items():
            norm = _normalize_header(raw_col)
            target = _POSTS_COLUMN_MAP.get(norm)
            if target:
                mapped[target] = val
        if "date" not in mapped:
            continue
        likes = _safe_int(mapped.get("likes", 0))
        comments = _safe_int(mapped.get("comments", 0))
        shares = _safe_int(mapped.get("shares", 0))
        reach = _safe_int(mapped.get("reach", 0))
        eng = round((likes + comments + shares) / reach * 100, 2) if reach > 0 else 0.0
        results.append({
            "platform": "Instagram",
            "post_description": mapped.get("description", "")[:500],
            "published_at": mapped.get("date", "").strip(),
            "likes": likes,
            "comments": comments,
            "shares": shares,
            "reach": reach,
            "impressions": _safe_int(mapped.get("impressions", 0)),
            "engagement_rate": eng,
            "recorded_at": mapped.get("date", "").strip(),
        })
    return results
