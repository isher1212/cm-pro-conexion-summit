import logging
from fastapi import APIRouter, Query
from backend.database import get_db
from backend.config import load_config
from backend.services.trends import get_trends, run_trends_cycle, _analyze_keyword_with_gpt, store_trend

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/trends")
def list_trends(
    limit: int = 20, platform: str = "",
    from_date: str = "", to_date: str = "", view: str = "active",
):
    conn = get_db()
    query = """SELECT id, keyword, platform, description, why_trending, how_to_apply, post_idea,
                      source_url, fetched_at, COALESCE(discarded, 0) as discarded
               FROM trends WHERE 1=1"""
    params = []
    if from_date:
        query += " AND fetched_at >= ?"
        params.append(from_date)
    if to_date:
        query += " AND fetched_at <= ?"
        params.append(to_date + " 23:59:59")
    if view == "active":
        query += " AND (discarded IS NULL OR discarded = 0)"
    elif view == "discarded":
        query += " AND discarded = 1"
    elif view == "saved":
        query += " AND keyword IN (SELECT title FROM saved_items WHERE item_type = 'trend')"
    if platform:
        query += " AND platform = ?"
        params.append(platform)
    query += " ORDER BY fetched_at DESC LIMIT ?"
    params.append(min(limit, 500))
    rows = conn.execute(query, params).fetchall()
    cols = ["id", "keyword", "platform", "description", "why_trending", "how_to_apply", "post_idea", "source_url", "fetched_at", "discarded"]
    return [dict(zip(cols, r)) for r in rows]


@router.post("/trends/refresh")
def refresh_trends():
    conn = get_db()
    config = load_config()
    openai_client = _get_openai_client(config)
    new_count = run_trends_cycle(conn, config, openai_client)
    return {"new_trends": new_count, "status": "ok"}


def _get_openai_client(config: dict):
    api_key = config.get("openai_api_key", "")
    if not api_key:
        return None
    from openai import OpenAI
    return OpenAI(api_key=api_key)


@router.post("/trends/analyze")
def analyze_trend(body: dict):
    """
    Body: { keyword, description, why_trending, how_to_apply, post_idea }
    Returns: { resumen, usos, oportunidades, como_abordarlo, como_promoverlo }
    """
    config = load_config()
    client = _get_openai_client(config)
    if not client:
        return {"error": "OpenAI API key no configurada"}
    brand_context = config.get("brand_context", "")
    context_line = f"\nContexto de marca: {brand_context}" if brand_context else ""

    prompt = f"""Eres estratega de contenido para Conexión Summit (plataforma de emprendimiento LATAM).{context_line}

Tendencia: {body.get('keyword', '')}
Descripción: {body.get('description', '')}
Por qué es tendencia: {body.get('why_trending', '')}

Responde EXACTAMENTE en este formato (en español, todo corto):

RESUMEN: [qué es esta tendencia, máx 2 líneas]
USOS: [posibles usos para contenido de Conexión Summit, máx 3 ideas]
OPORTUNIDADES: [oportunidades de posicionamiento, máx 2 líneas]
COMO_ABORDARLO: [tono y ángulo editorial, máx 2 líneas]
COMO_PROMOVERLO: [formatos y plataformas recomendados, máx 2 líneas]"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.4,
        )
        try:
            from backend.services.ai_usage import log_openai_usage
            log_openai_usage("gpt-4o-mini", response, context="trends/analyze")
        except Exception:
            pass
        text = response.choices[0].message.content or ""
        result = {"resumen": "", "usos": "", "oportunidades": "", "como_abordarlo": "", "como_promoverlo": ""}
        for line in text.split("\n"):
            line = line.strip()
            for key_field, dict_key in [("RESUMEN:", "resumen"), ("USOS:", "usos"),
                                         ("OPORTUNIDADES:", "oportunidades"), ("COMO_ABORDARLO:", "como_abordarlo"),
                                         ("COMO_PROMOVERLO:", "como_promoverlo")]:
                if line.startswith(key_field):
                    result[dict_key] = line.replace(key_field, "").strip()
        return result
    except Exception as e:
        logger.warning(f"analyze_trend failed: {e}")
        return {"error": "No se pudo generar el análisis"}


@router.post("/trends/search")
def search_trends_manual(body: dict):
    """
    Body: { keywords: list[str], limit: int, platform: str }
    Analyzes keywords with GPT for the given platform and stores them.
    """
    keywords = body.get("keywords", [])
    limit = min(int(body.get("limit", 5)), 20)
    platform = body.get("platform", "Google Trends")
    if not keywords:
        return {"error": "Se requieren palabras clave"}
    config = load_config()
    client = _get_openai_client(config)
    if not client:
        return {"error": "OpenAI no configurada"}
    brand_context = config.get("brand_context", "")
    url_map_templates = {
        "Google Trends": "https://trends.google.com/trends/explore?q={kw}&geo=CO",
        "YouTube": "https://www.youtube.com/results?search_query={kw}",
        "TikTok": "https://www.tiktok.com/search?q={kw}",
        "LinkedIn": "https://www.linkedin.com/search/results/content/?keywords={kw}",
    }
    new_count = 0
    conn = get_db()
    from datetime import datetime as _dt
    for kw in keywords[:limit]:
        safe_kw = kw.replace(" ", "%20")
        template = url_map_templates.get(platform, "")
        source_url = template.replace("{kw}", safe_kw) if template else ""
        trend_data = {
            "keyword": kw,
            "platform": platform,
            "source_url": source_url,
            "fetched_at": _dt.now().isoformat(),
        }
        ai = _analyze_keyword_with_gpt(kw, platform, client, brand_context)
        trend_data.update(ai)
        try:
            if store_trend(conn, trend_data):
                new_count += 1
        except Exception as e:
            logger.warning(f"manual search store failed: {e}")
    return {"status": "ok", "new_trends": new_count}


@router.post("/trends/{trend_id}/discard")
def discard_trend(trend_id: int):
    from datetime import datetime
    conn = get_db()
    conn.execute("UPDATE trends SET discarded = 1, discarded_at = ? WHERE id = ?",
                 (datetime.now().isoformat(), trend_id))
    conn.commit()
    return {"status": "ok"}


@router.post("/trends/{trend_id}/restore")
def restore_trend(trend_id: int):
    conn = get_db()
    conn.execute("UPDATE trends SET discarded = 0, discarded_at = NULL WHERE id = ?", (trend_id,))
    conn.commit()
    return {"status": "ok"}


@router.get("/trends/archive-by-month")
def trends_archive():
    conn = get_db()
    rows = conn.execute(
        """SELECT substr(fetched_at, 1, 7) AS month, COUNT(*) as count
           FROM trends WHERE COALESCE(discarded, 0) = 0
           GROUP BY month ORDER BY month DESC LIMIT 24"""
    ).fetchall()
    return [{"month": r[0], "count": r[1]} for r in rows]


@router.get("/trends/history")
def trends_history(weeks: int = 12, platform: str = ""):
    """Histórico de tendencias agrupado por (keyword, platform, fecha)."""
    from collections import defaultdict
    conn = get_db()
    query = """SELECT keyword, platform, fetched_at FROM trends
               WHERE fetched_at >= datetime('now', ?)"""
    params = [f"-{weeks * 7} days"]
    if platform:
        query += " AND platform = ?"
        params.append(platform)
    query += " ORDER BY fetched_at"
    rows = conn.execute(query, params).fetchall()
    bucket = defaultdict(int)
    for kw, plat, fa in rows:
        wk = fa[:10] if fa else ""
        bucket[(kw, plat, wk)] += 1
    return [
        {"keyword": k[0], "platform": k[1], "date": k[2], "count": v}
        for k, v in bucket.items()
    ]
