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


@router.get("/reports/dashboard")
def reports_dashboard(period: str = "week", from_date: str = "", to_date: str = ""):
    """
    Dashboard data for Reports page.
    period: 'this_week', 'last_week', 'this_month', 'last_month', 'all', 'custom'
    from_date / to_date: YYYY-MM-DD (used when period='custom')
    """
    from datetime import datetime, timedelta
    conn = get_db()

    today = datetime.now().date()
    if period == "this_week":
        start = today - timedelta(days=today.weekday())
        end = today + timedelta(days=1)
    elif period == "last_week":
        start = today - timedelta(days=today.weekday() + 7)
        end = today - timedelta(days=today.weekday())
    elif period == "this_month":
        start = today.replace(day=1)
        end = today + timedelta(days=1)
    elif period == "last_month":
        first_this = today.replace(day=1)
        end = first_this
        start = (first_this - timedelta(days=1)).replace(day=1)
    elif period == "custom" and from_date and to_date:
        start = datetime.strptime(from_date, "%Y-%m-%d").date()
        end = datetime.strptime(to_date, "%Y-%m-%d").date() + timedelta(days=1)
    else:
        start = today - timedelta(days=365)
        end = today + timedelta(days=1)

    s, e = start.isoformat(), end.isoformat()

    def safe_count(table, date_col):
        try:
            r = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE {date_col} >= ? AND {date_col} < ?", (s, e)).fetchone()
            return r[0] if r else 0
        except Exception:
            return 0

    metrics = {
        "articles": safe_count("articles", "fetched_at"),
        "trends": safe_count("trends", "fetched_at"),
        "proposals": safe_count("content_proposals", "created_at"),
        "proposals_published": 0,
    }
    try:
        r = conn.execute(
            "SELECT COUNT(*) FROM content_proposals WHERE status = 'published' AND created_at >= ? AND created_at < ?",
            (s, e),
        ).fetchone()
        metrics["proposals_published"] = r[0] if r else 0
    except Exception:
        pass

    # Daily series for sparklines
    def daily_series(table, date_col, where_extra=""):
        try:
            q = f"SELECT substr({date_col}, 1, 10) AS d, COUNT(*) FROM {table} WHERE {date_col} >= ? AND {date_col} < ? {where_extra} GROUP BY d ORDER BY d"
            return [{"date": r[0], "count": r[1]} for r in conn.execute(q, (s, e)).fetchall()]
        except Exception:
            return []

    series = {
        "articles": daily_series("articles", "fetched_at"),
        "trends": daily_series("trends", "fetched_at"),
        "proposals": daily_series("content_proposals", "created_at"),
        "published": daily_series("content_proposals", "created_at", "AND status = 'published'"),
    }

    # Top 5 articles by relevance
    try:
        rows = conn.execute(
            """SELECT id, title, title_es, source, url, relevance_score, fetched_at, category
               FROM articles WHERE fetched_at >= ? AND fetched_at < ? AND COALESCE(discarded, 0) = 0
               ORDER BY relevance_score DESC, fetched_at DESC LIMIT 5""",
            (s, e),
        ).fetchall()
        top_articles = [{
            "id": r[0], "title": r[1], "title_es": r[2], "source": r[3], "url": r[4],
            "relevance_score": r[5], "fetched_at": r[6], "category": r[7],
        } for r in rows]
    except Exception:
        top_articles = []

    # Top trends per platform
    try:
        rows = conn.execute(
            """SELECT id, keyword, platform, description, post_idea, source_url, fetched_at
               FROM trends WHERE fetched_at >= ? AND fetched_at < ? AND COALESCE(discarded, 0) = 0
               ORDER BY fetched_at DESC LIMIT 12""",
            (s, e),
        ).fetchall()
        top_trends = [{
            "id": r[0], "keyword": r[1], "platform": r[2], "description": r[3],
            "post_idea": r[4], "source_url": r[5], "fetched_at": r[6],
        } for r in rows]
    except Exception:
        top_trends = []

    # Proposals
    try:
        rows = conn.execute(
            """SELECT id, topic, platform, format, status, suggested_date, created_at
               FROM content_proposals WHERE created_at >= ? AND created_at < ?
               ORDER BY created_at DESC LIMIT 20""",
            (s, e),
        ).fetchall()
        proposals = [{
            "id": r[0], "topic": r[1], "platform": r[2], "format": r[3],
            "status": r[4], "suggested_date": r[5], "created_at": r[6],
        } for r in rows]
    except Exception:
        proposals = []

    # AI costs
    try:
        rows = conn.execute(
            """SELECT service, COALESCE(SUM(cost_usd), 0), COUNT(*)
               FROM ai_usage_log WHERE created_at >= ? AND created_at < ?
               GROUP BY service""",
            (s, e),
        ).fetchall()
        ai_costs = [{"service": r[0], "cost_usd": float(r[1] or 0), "calls": r[2]} for r in rows]
    except Exception:
        ai_costs = []

    return {
        "period": period,
        "from": s,
        "to": e,
        "metrics": metrics,
        "series": series,
        "top_articles": top_articles,
        "top_trends": top_trends,
        "proposals": proposals,
        "ai_costs": ai_costs,
    }


@router.post("/reports/dashboard/summary")
def reports_dashboard_summary(body: dict):
    """Generate executive summary with AI for the given dashboard data."""
    config = load_config()
    client = _get_openai_client(config)
    if not client:
        return {"error": "OpenAI API key no configurada"}

    metrics = body.get("metrics", {})
    top_articles = body.get("top_articles", [])[:5]
    top_trends = body.get("top_trends", [])[:5]
    proposals = body.get("proposals", [])[:10]
    period_label = body.get("period_label", "el período seleccionado")
    brand = config.get("brand_context", "")

    arts = "\n".join(f"- {a.get('title_es') or a.get('title')} ({a.get('source','')}, score {a.get('relevance_score', 0)})" for a in top_articles) or "(ninguno)"
    trs = "\n".join(f"- {t.get('keyword')} ({t.get('platform','')})" for t in top_trends) or "(ninguno)"
    props = "\n".join(f"- [{p.get('status','')}] {p.get('topic','')} ({p.get('platform','')})" for p in proposals) or "(ninguno)"

    prompt = f"""Eres analista del community manager de Conexión Summit. Resume lo más importante de {period_label} en 4-5 puntos accionables y útiles.

MÉTRICAS DEL PERÍODO:
- Artículos capturados: {metrics.get('articles', 0)}
- Tendencias capturadas: {metrics.get('trends', 0)}
- Propuestas generadas: {metrics.get('proposals', 0)}
- Propuestas publicadas: {metrics.get('proposals_published', 0)}

TOP NOTICIAS:
{arts}

TOP TENDENCIAS:
{trs}

PARRILLA:
{props}

{f"CONTEXTO MARCA: {brand}" if brand else ""}

Responde EXACTAMENTE en este formato JSON:
{{
  "headline": "1 oración con la conclusión más importante del período",
  "puntos_clave": ["punto accionable 1", "punto 2", "punto 3", "punto 4"],
  "alerta": "Algo que requiera atención (puede ser 'ninguna' si no aplica)",
  "siguiente_paso": "1 acción concreta recomendada para la próxima semana"
}}"""
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600,
            temperature=0.6,
            response_format={"type": "json_object"},
        )
        try:
            from backend.services.ai_usage import log_openai_usage
            log_openai_usage("gpt-4o-mini", response, context="reports/dashboard-summary")
        except Exception:
            pass
        import json
        return json.loads(response.choices[0].message.content or "{}")
    except Exception as e:
        return {"error": f"Error: {e}"}
