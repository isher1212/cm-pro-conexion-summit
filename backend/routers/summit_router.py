import logging
from fastapi import APIRouter
from backend.config import load_config
from backend.services.summit import (
    list_editions, get_edition, upsert_edition, delete_edition, get_or_create_edition_by_year,
    list_items, create_item, update_item, delete_item,
    edition_panorama, historical_overview,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _openai_client(config):
    key = config.get("openai_api_key", "")
    if not key:
        return None
    try:
        from openai import OpenAI
        return OpenAI(api_key=key)
    except Exception:
        return None


@router.get("/summit/editions")
def get_editions():
    return list_editions()


@router.get("/summit/editions/current")
def current_edition():
    config = load_config()
    year = int(config.get("current_edition_year", 2026))
    eid = get_or_create_edition_by_year(year)
    return get_edition(eid)


@router.get("/summit/editions/{edition_id}")
def get_one_edition(edition_id: int):
    e = get_edition(edition_id)
    return e or {"error": "no encontrada"}


@router.post("/summit/editions")
def post_edition(body: dict):
    eid = upsert_edition(body)
    return {"status": "ok", "id": eid}


@router.patch("/summit/editions/{edition_id}")
def patch_edition(edition_id: int, body: dict):
    body["id"] = edition_id
    eid = upsert_edition(body)
    return {"status": "ok", "id": eid}


@router.delete("/summit/editions/{edition_id}")
def del_edition(edition_id: int):
    delete_edition(edition_id)
    return {"status": "ok"}


@router.get("/summit/editions/{edition_id}/{table}")
def get_items(edition_id: int, table: str):
    return list_items(table, edition_id)


@router.post("/summit/editions/{edition_id}/{table}")
def post_item(edition_id: int, table: str, body: dict):
    iid = create_item(table, edition_id, body)
    return {"status": "ok", "id": iid}


@router.patch("/summit/{table}/{item_id}")
def patch_item(table: str, item_id: int, body: dict):
    ok = update_item(table, item_id, body)
    return {"status": "ok" if ok else "noop"}


@router.delete("/summit/{table}/{item_id}")
def del_item(table: str, item_id: int):
    delete_item(table, item_id)
    return {"status": "ok"}


@router.post("/summit/editions/{edition_id}/panorama")
def edition_ai_panorama(edition_id: int):
    config = load_config()
    client = _openai_client(config)
    if not client:
        return {"error": "OpenAI API key no configurada"}
    return edition_panorama(edition_id, client, config.get("brand_context", ""))


@router.post("/summit/historical-overview")
def historical_ai_overview():
    config = load_config()
    client = _openai_client(config)
    if not client:
        return {"error": "OpenAI API key no configurada"}
    return historical_overview(client, config.get("brand_context", ""))


@router.post("/summit/{table}/{item_id}/analyze")
def analyze_summit_item(table: str, item_id: int, body: dict = None):
    """Analyze a single Summit item with AI to generate insights, content ideas, and recommendations."""
    config = load_config()
    client = _openai_client(config)
    if not client:
        return {"error": "OpenAI API key no configurada"}

    from backend.services.summit import get_item_by_id
    item = get_item_by_id(table, item_id)
    if not item:
        return {"error": "Item no encontrado"}

    brand_context = config.get("brand_context", "")

    type_label = {
        "speakers": "speaker (ponente)",
        "sponsors": "sponsor (patrocinador)",
        "key_people": "persona clave del equipo",
        "summit_milestones": "hito del evento",
        "event_goals": "meta del evento",
    }.get(table, "item")

    item_summary = "\n".join(f"{k}: {v}" for k, v in item.items() if v not in (None, "", 0) and k not in ("id", "edition_id", "created_at"))

    prompt = f"""Eres consultor estratégico de Conexión Summit (plataforma de emprendimiento en LATAM).
{f"Contexto de marca: {brand_context}" if brand_context else ""}

Analiza este {type_label} del evento y genera información valiosa para que el equipo de marketing pueda crear contenido y mejorar conexiones:

{item_summary}

Responde EXACTAMENTE en este formato JSON (solo JSON, sin texto adicional):
{{
  "perfil": "1-2 oraciones describiendo quién/qué es y por qué importa al evento",
  "puntos_fuertes": ["punto 1", "punto 2", "punto 3"],
  "ideas_contenido": ["idea concreta de post o pieza de contenido 1", "idea 2", "idea 3"],
  "como_potenciar": "2-3 oraciones con acciones específicas para sacarle más provecho a este {type_label} antes/durante/después del evento",
  "preguntas_clave": ["pregunta interesante para entrevista o conversación 1", "pregunta 2", "pregunta 3"],
  "riesgos_o_alertas": "1-2 oraciones (puede ser 'ninguno detectado' si no aplica)"
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=900,
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        try:
            from backend.services.ai_usage import log_openai_usage
            log_openai_usage("gpt-4o-mini", response, context=f"summit/analyze/{table}")
        except Exception:
            pass
        import json
        text = response.choices[0].message.content or "{}"
        data = json.loads(text)
        return data
    except Exception as e:
        logger.warning(f"summit analyze {table}/{item_id} failed: {e}")
        return {"error": f"Error al analizar: {e}"}
