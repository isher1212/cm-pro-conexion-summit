from fastapi import APIRouter
from datetime import datetime, timedelta
from backend.database import get_db

router = APIRouter()


@router.get("/ai-usage/summary")
def get_usage_summary(days: int = 30):
    conn = get_db()
    since = (datetime.now() - timedelta(days=days)).isoformat()
    rows = conn.execute(
        """SELECT service, model, COUNT(*) as calls, SUM(tokens_in) as tokens_in, SUM(tokens_out) as tokens_out, SUM(cost_usd) as total_cost
           FROM ai_usage_log WHERE created_at >= ?
           GROUP BY service, model ORDER BY total_cost DESC""",
        (since,),
    ).fetchall()
    return [
        {"service": r[0], "model": r[1], "calls": r[2], "tokens_in": r[3] or 0, "tokens_out": r[4] or 0, "total_cost_usd": round(r[5] or 0, 4)}
        for r in rows
    ]


@router.get("/ai-usage/recent")
def get_usage_recent(limit: int = 50):
    conn = get_db()
    rows = conn.execute(
        """SELECT id, service, model, tokens_in, tokens_out, cost_usd, context, created_at
           FROM ai_usage_log ORDER BY created_at DESC LIMIT ?""",
        (min(limit, 500),),
    ).fetchall()
    cols = ["id", "service", "model", "tokens_in", "tokens_out", "cost_usd", "context", "created_at"]
    return [dict(zip(cols, r)) for r in rows]
