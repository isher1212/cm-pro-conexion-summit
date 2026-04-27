import logging
import sqlite3
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)

PLATFORMS = ["Instagram", "TikTok", "LinkedIn"]


# ── Weekly metrics ─────────────────────────────────────────────────────────────

def store_metrics(conn: sqlite3.Connection, metrics: dict) -> None:
    """
    Upsert weekly platform metrics. If same platform + week_label already exists,
    update with new values (INSERT OR REPLACE via unique index).
    """
    try:
        conn.execute(
            """INSERT OR REPLACE INTO metrics
               (platform, followers, reach, impressions, likes, comments, shares,
                engagement_rate, recorded_at, week_label)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                metrics["platform"],
                metrics.get("followers", 0),
                metrics.get("reach", 0),
                metrics.get("impressions", 0),
                metrics.get("likes", 0),
                metrics.get("comments", 0),
                metrics.get("shares", 0),
                metrics.get("engagement_rate", 0.0),
                metrics.get("recorded_at", datetime.now().isoformat()),
                metrics.get("week_label", ""),
            ),
        )
        conn.commit()
    except Exception as e:
        logger.warning(f"Failed to store metrics for {metrics.get('platform')}: {e}")


def get_metrics(conn: sqlite3.Connection, platform: str = "", limit: int = 12) -> list[dict]:
    """Retrieve metrics history, most recent first. Optionally filtered by platform."""
    query = "SELECT * FROM metrics"
    params: list[Any] = []
    if platform:
        query += " WHERE platform = ?"
        params.append(platform)
    query += " ORDER BY recorded_at DESC LIMIT ?"
    params.append(limit)
    cursor = conn.execute(query, params)
    return [dict(row) for row in cursor.fetchall()]


def get_weekly_summary(conn: sqlite3.Connection) -> list[dict]:
    """Return the latest metric row per platform."""
    rows = []
    for platform in PLATFORMS:
        cursor = conn.execute(
            "SELECT * FROM metrics WHERE platform = ? ORDER BY recorded_at DESC LIMIT 1",
            (platform,),
        )
        row = cursor.fetchone()
        if row:
            rows.append(dict(row))
    return rows


# ── Anomaly detection ──────────────────────────────────────────────────────────

def detect_anomaly(conn: sqlite3.Connection, platform: str, threshold_pct: float = 20.0) -> dict:
    """
    Compare the two most recent weeks' engagement_rate for a platform.
    Returns has_anomaly, direction ('drop'|'spike'|None), current, previous values.
    """
    cursor = conn.execute(
        "SELECT engagement_rate, week_label FROM metrics WHERE platform = ? ORDER BY recorded_at DESC LIMIT 2",
        (platform,),
    )
    rows = cursor.fetchall()
    if len(rows) < 2:
        return {"has_anomaly": False, "direction": None, "current": None, "previous": None}

    current = rows[0]["engagement_rate"] or 0.0
    previous = rows[1]["engagement_rate"] or 0.0

    if previous == 0:
        return {"has_anomaly": False, "direction": None, "current": current, "previous": previous}

    change_pct = ((current - previous) / previous) * 100
    if change_pct <= -threshold_pct:
        return {"has_anomaly": True, "direction": "drop", "current": current, "previous": previous, "change_pct": round(change_pct, 1)}
    if change_pct >= threshold_pct:
        return {"has_anomaly": True, "direction": "spike", "current": current, "previous": previous, "change_pct": round(change_pct, 1)}
    return {"has_anomaly": False, "direction": None, "current": current, "previous": previous, "change_pct": round(change_pct, 1)}


# ── Per-post metrics ───────────────────────────────────────────────────────────

def store_post(conn: sqlite3.Connection, post: dict) -> None:
    """Store individual post metrics."""
    try:
        conn.execute(
            """INSERT INTO posts
               (platform, post_description, published_at, reach, impressions,
                likes, comments, shares, engagement_rate, recorded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                post["platform"],
                post.get("post_description", ""),
                post.get("published_at", ""),
                post.get("reach", 0),
                post.get("impressions", 0),
                post.get("likes", 0),
                post.get("comments", 0),
                post.get("shares", 0),
                post.get("engagement_rate", 0.0),
                post.get("recorded_at", datetime.now().isoformat()),
            ),
        )
        conn.commit()
    except Exception as e:
        logger.warning(f"Failed to store post: {e}")


def get_posts(conn: sqlite3.Connection, platform: str = "", limit: int = 10) -> list[dict]:
    """Retrieve posts, most recent first. Optionally filtered by platform."""
    query = "SELECT * FROM posts"
    params: list[Any] = []
    if platform:
        query += " WHERE platform = ?"
        params.append(platform)
    query += " ORDER BY recorded_at DESC LIMIT ?"
    params.append(limit)
    cursor = conn.execute(query, params)
    return [dict(row) for row in cursor.fetchall()]
