import logging
from datetime import datetime, timedelta
from backend.database import get_db

logger = logging.getLogger(__name__)


def get_overview() -> dict:
    conn = get_db()
    today = datetime.now()
    week_ago = (today - timedelta(days=7)).isoformat()
    month_start = today.replace(day=1).isoformat()

    metrics = []
    for platform in ("Instagram", "TikTok", "LinkedIn"):
        latest = conn.execute(
            "SELECT followers, reach, engagement_rate FROM metrics WHERE platform = ? ORDER BY recorded_at DESC LIMIT 1",
            (platform,),
        ).fetchone()
        if latest:
            prev = conn.execute(
                "SELECT followers FROM metrics WHERE platform = ? AND recorded_at < datetime('now', '-7 days') ORDER BY recorded_at DESC LIMIT 1",
                (platform,),
            ).fetchone()
            delta = (latest[0] - prev[0]) if prev else 0
            metrics.append({
                "platform": platform,
                "followers": latest[0],
                "delta_followers_7d": delta,
                "reach": latest[1],
                "engagement_rate": latest[2],
            })

    rows = conn.execute(
        """SELECT id, title_es, title, source, relevance_score, url, fetched_at
           FROM articles WHERE fetched_at >= ? ORDER BY relevance_score DESC, fetched_at DESC LIMIT 3""",
        (week_ago,),
    ).fetchall()
    top_articles = [
        {"id": r[0], "title": r[1] or r[2], "source": r[3], "score": r[4], "url": r[5], "fetched_at": r[6]}
        for r in rows
    ]

    rows = conn.execute(
        """SELECT id, keyword, platform, post_idea, source_url
           FROM trends WHERE fetched_at >= datetime('now', '-2 days') ORDER BY fetched_at DESC LIMIT 3"""
    ).fetchall()
    top_trends = [
        {"id": r[0], "keyword": r[1], "platform": r[2], "post_idea": r[3], "source_url": r[4]}
        for r in rows
    ]

    rows = conn.execute(
        "SELECT id, title, date, event_type FROM events WHERE date >= ? ORDER BY date LIMIT 5",
        (today.strftime("%Y-%m-%d"),),
    ).fetchall()
    upcoming_events = [{"id": r[0], "title": r[1], "date": r[2], "type": r[3]} for r in rows]

    rows = conn.execute(
        """SELECT id, topic, platform, format, suggested_date, status
           FROM content_proposals WHERE status IN ('approved', 'proposed') AND suggested_date >= ?
           ORDER BY suggested_date LIMIT 5""",
        (today.strftime("%Y-%m-%d"),),
    ).fetchall()
    upcoming_posts = [
        {"id": r[0], "topic": r[1], "platform": r[2], "format": r[3], "suggested_date": r[4], "status": r[5]}
        for r in rows
    ]

    proposals_pending = conn.execute(
        "SELECT COUNT(*) FROM content_proposals WHERE status = 'proposed'"
    ).fetchone()[0]
    trends_unsaved = conn.execute(
        """SELECT COUNT(*) FROM trends t WHERE t.fetched_at >= datetime('now', '-3 days')
           AND NOT EXISTS (SELECT 1 FROM saved_items s WHERE s.item_type = 'trend' AND s.title = t.keyword)"""
    ).fetchone()[0]
    notif_unread = conn.execute(
        "SELECT COUNT(*) FROM notifications WHERE read_at IS NULL OR read_at = ''"
    ).fetchone()[0]

    actions = []
    if proposals_pending > 0:
        actions.append({"label": f"{proposals_pending} propuestas esperando aprobación", "to": "/planner", "type": "review"})
    if trends_unsaved > 5:
        actions.append({"label": f"{trends_unsaved} tendencias nuevas sin revisar", "to": "/trends", "type": "info"})
    if notif_unread > 0:
        actions.append({"label": f"{notif_unread} notificaciones sin leer", "to": "/", "type": "alert"})

    month_proposals = conn.execute(
        "SELECT COUNT(*) FROM content_proposals WHERE created_at >= ?", (month_start,)
    ).fetchone()[0]
    month_published = conn.execute(
        "SELECT COUNT(*) FROM content_proposals WHERE status = 'published' AND created_at >= ?",
        (month_start,),
    ).fetchone()[0]
    month_ai_cost = conn.execute(
        "SELECT SUM(cost_usd) FROM ai_usage_log WHERE created_at >= ?", (month_start,)
    ).fetchone()[0] or 0
    month_articles_saved = conn.execute(
        "SELECT COUNT(*) FROM saved_items WHERE item_type = 'article' AND saved_at >= ?", (month_start,)
    ).fetchone()[0]

    return {
        "now": today.isoformat(),
        "metrics": metrics,
        "top_articles": top_articles,
        "top_trends": top_trends,
        "upcoming_events": upcoming_events,
        "upcoming_posts": upcoming_posts,
        "actions": actions,
        "month_stats": {
            "proposals": month_proposals,
            "published": month_published,
            "ai_cost_usd": round(month_ai_cost, 2),
            "articles_saved": month_articles_saved,
        },
    }
