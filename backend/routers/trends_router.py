import logging
from fastapi import APIRouter, Query
from backend.database import get_db
from backend.config import load_config
from backend.services.trends import get_trends, run_trends_cycle

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/trends")
def list_trends(
    limit: int = Query(20, ge=1, le=100),
    platform: str = Query(""),
):
    conn = get_db()
    trends = get_trends(conn, limit=limit, platform=platform)
    return {"trends": trends, "total": len(trends)}


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
    Body: { keywords: list[str], limit: int }
    Runs a mini trends cycle for the given keywords.
    """
    keywords = body.get("keywords", [])
    limit = min(int(body.get("limit", 5)), 20)
    if not keywords:
        return {"error": "Se requieren palabras clave"}
    config = load_config()
    config_override = dict(config)
    config_override["google_news_keywords"] = keywords
    config_override["max_trends_google"] = limit
    config_override["max_trends_youtube"] = 0
    client = _get_openai_client(config_override)
    try:
        new_count = run_trends_cycle(get_db(), config_override, client)
        return {"status": "ok", "new_trends": new_count}
    except Exception as e:
        logger.warning(f"manual trend search failed: {e}")
        return {"error": str(e)}
