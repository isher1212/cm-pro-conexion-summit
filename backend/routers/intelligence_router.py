import json
import logging
from datetime import datetime
from fastapi import APIRouter, Query

logger = logging.getLogger(__name__)
from backend.database import get_db
from backend.config import load_config
from backend.services.intelligence import get_articles as svc_get_articles, run_intelligence_cycle
from backend.services.image_gen import generate_proposal_from_article
from backend.services.planner import store_proposal

router = APIRouter()


@router.get("/intelligence/articles")
def get_articles(limit: int = 50, category: str = "", search: str = "", sort: str = "recent"):
    config = load_config()
    age_days = config.get("max_articles_age_days", 30)
    conn = get_db()
    query = """SELECT id, title, title_es, source, url, summary, relevance, relevance_score, category, fetched_at
               FROM articles
               WHERE fetched_at >= datetime('now', ?)"""
    params: list = [f"-{age_days} days"]
    if category:
        query += " AND category = ?"
        params.append(category)
    if search:
        query += " AND (title LIKE ? OR title_es LIKE ? OR summary LIKE ?)"
        params += [f"%{search}%", f"%{search}%", f"%{search}%"]
    if sort == "relevance":
        query += " ORDER BY relevance_score DESC, fetched_at DESC"
    else:
        query += " ORDER BY fetched_at DESC"
    query += " LIMIT ?"
    params.append(min(limit, 200))
    rows = conn.execute(query, params).fetchall()
    cols = ["id", "title", "title_es", "source", "url", "summary", "relevance", "relevance_score", "category", "fetched_at"]
    return [dict(zip(cols, r)) for r in rows]


@router.post("/intelligence/refresh")
def refresh_articles():
    conn = get_db()
    config = load_config()
    openai_client = _get_openai_client(config)
    new_count = run_intelligence_cycle(conn, config, openai_client)
    return {"new_articles": new_count, "status": "ok"}


def _get_openai_client(config: dict):
    api_key = config.get("openai_api_key", "")
    if not api_key:
        return None
    from openai import OpenAI
    return OpenAI(api_key=api_key)


@router.post("/intelligence/to-proposal")
def article_to_proposal(body: dict):
    """
    Body: { title: str, summary: str, source: str }
    Uses OpenAI to generate a Parrilla proposal from an article.
    Returns: { status: "ok" } or { error: str }
    """
    config = load_config()
    client = _get_openai_client(config)
    if not client:
        return {"error": "OpenAI API key not configured"}

    proposal = generate_proposal_from_article(
        title=body.get("title", ""),
        summary=body.get("summary", ""),
        source=body.get("source", ""),
        openai_client=client,
        brand_context=config.get("brand_context", ""),
    )
    if not proposal.get("topic"):
        return {"error": "Could not generate proposal from article"}

    proposal["status"] = "proposed"
    proposal["created_at"] = datetime.now().isoformat()
    proposal["image_urls"] = "[]"
    proposal["video_script"] = json.dumps({})
    store_proposal(get_db(), proposal)
    return {"status": "ok"}


@router.post("/intelligence/analyze")
def analyze_article(body: dict):
    """
    Body: { title: str, summary: str, source: str, relevance: str }
    Returns: { resumen, aplicacion, alcance, como_abordarlo, como_promoverlo }
    """
    config = load_config()
    client = _get_openai_client(config)
    if not client:
        return {"error": "OpenAI API key no configurada"}
    brand_context = config.get("brand_context", "")
    context_line = f"\nContexto de marca: {brand_context}" if brand_context else ""

    prompt = f"""Eres analista de contenido para Conexión Summit (plataforma de emprendimiento LATAM).{context_line}

Artículo: {body.get('title', '')}
Fuente: {body.get('source', '')}
Resumen: {body.get('summary', '')}

Responde EXACTAMENTE en este formato (en español, todo corto):

RESUMEN: [qué pasó, máx 2 líneas]
APLICACION: [cómo aplica a Conexión Summit, máx 2 líneas]
ALCANCE: [impacto en el mercado LATAM/Colombia, máx 1 línea]
COMO_ABORDARLO: [ángulo editorial recomendado, máx 2 líneas]
COMO_PROMOVERLO: [cómo mostrarlo en redes/la marca, máx 2 líneas]"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.4,
        )
        text = response.choices[0].message.content or ""
        result = {"resumen": "", "aplicacion": "", "alcance": "", "como_abordarlo": "", "como_promoverlo": ""}
        for line in text.split("\n"):
            line = line.strip()
            for key_field, dict_key in [("RESUMEN:", "resumen"), ("APLICACION:", "aplicacion"),
                                         ("ALCANCE:", "alcance"), ("COMO_ABORDARLO:", "como_abordarlo"),
                                         ("COMO_PROMOVERLO:", "como_promoverlo")]:
                if line.startswith(key_field):
                    result[dict_key] = line.replace(key_field, "").strip()
        return result
    except Exception as e:
        logger.warning(f"analyze_article failed: {e}")
        return {"error": "No se pudo generar el análisis"}


@router.post("/intelligence/reprocess")
def reprocess_articles(body: dict = None):
    """Re-procesa artículos viejos sin title_es o relevance_score."""
    config = load_config()
    client = _get_openai_client(config)
    if not client:
        return {"error": "OpenAI API key no configurada"}
    conn = get_db()
    rows = conn.execute(
        """SELECT id, title, source, summary
           FROM articles
           WHERE (title_es IS NULL OR title_es = '' OR relevance_score IS NULL OR relevance_score = 0)
           ORDER BY fetched_at DESC LIMIT 50"""
    ).fetchall()
    from backend.services.intelligence import build_summary_prompt
    updated = 0
    for row in rows:
        article_id, title, source, existing_summary = row
        prompt = build_summary_prompt(title, source, existing_summary or title, config.get("brand_context", ""))
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.4,
            )
            text = response.choices[0].message.content or ""
            title_es = ""; summary = ""; relevance = ""; score = 0
            for line in text.split("\n"):
                line = line.strip()
                if line.startswith("TITULO_ES:"):
                    title_es = line.replace("TITULO_ES:", "").strip()
                elif line.startswith("RELEVANCIA_SCORE:"):
                    try:
                        num = int(''.join(c for c in line.replace("RELEVANCIA_SCORE:", "") if c.isdigit()))
                        score = max(1, min(10, num))
                    except Exception:
                        score = 5
                elif line.startswith("RESUMEN:"):
                    summary = line.replace("RESUMEN:", "").strip()
                elif line.startswith("RELEVANCIA:"):
                    relevance = line.replace("RELEVANCIA:", "").strip()
            conn.execute(
                """UPDATE articles SET
                       title_es = CASE WHEN (title_es IS NULL OR title_es = '') THEN ? ELSE title_es END,
                       summary = CASE WHEN (summary IS NULL OR summary = '') THEN ? ELSE summary END,
                       relevance = CASE WHEN (relevance IS NULL OR relevance = '') THEN ? ELSE relevance END,
                       relevance_score = CASE WHEN (relevance_score IS NULL OR relevance_score = 0) THEN ? ELSE relevance_score END
                   WHERE id = ?""",
                (title_es, summary, relevance, score, article_id),
            )
            conn.commit()
            updated += 1
        except Exception as e:
            logger.warning(f"reprocess failed for article {article_id}: {e}")
    return {"status": "ok", "updated": updated}
