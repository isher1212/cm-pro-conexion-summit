import logging
from fastapi import APIRouter
from backend.services.templates import list_templates, create_template, update_template, delete_template, render_template

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/templates")
def get_templates(pillar: str = "", search: str = ""):
    return list_templates(pillar=pillar, search=search)


@router.post("/templates")
def post_template(body: dict):
    tid = create_template(body)
    return {"status": "ok", "id": tid}


@router.patch("/templates/{template_id}")
def patch_template(template_id: int, body: dict):
    ok = update_template(template_id, body)
    return {"status": "ok" if ok else "noop"}


@router.delete("/templates/{template_id}")
def del_template(template_id: int):
    delete_template(template_id)
    return {"status": "ok"}


@router.post("/templates/{template_id}/render")
def render(template_id: int, body: dict):
    values = body.get("values", {}) if isinstance(body, dict) else {}
    return render_template(template_id, values)


@router.post("/templates/seed")
def seed_endpoint():
    from backend.services.templates import seed_default_templates
    n = seed_default_templates()
    return {"status": "ok", "inserted": n}


@router.post("/templates/generate")
def generate_template_ai(body: dict):
    """Generate template content with AI based on use case + keywords.
    Body: { use_case, keywords, tone (opt), pillar (opt) }
    Returns: { name, content, variables, pillar, tags }
    """
    from backend.config import load_config
    config = load_config()
    api_key = config.get("openai_api_key", "")
    if not api_key:
        return {"error": "OpenAI API key no configurada"}
    from openai import OpenAI
    client = OpenAI(api_key=api_key)

    use_case = body.get("use_case", "").strip()
    keywords = body.get("keywords", "").strip()
    tone = body.get("tone", "").strip() or "profesional, cercano, inspirador"
    pillar = body.get("pillar", "").strip()
    brand = config.get("brand_context", "")

    if not use_case:
        return {"error": "Falta el caso de uso"}

    prompt = f"""Eres un copywriter experto. Crea una plantilla reutilizable de copy para redes sociales.

CASO DE USO: {use_case}
{f"PALABRAS CLAVE: {keywords}" if keywords else ""}
TONO: {tone}
{f"PILAR: {pillar}" if pillar else ""}
{f"CONTEXTO DE MARCA: {brand}" if brand else ""}

Genera una plantilla con variables tipo {{{{nombre_speaker}}}}, {{{{fecha}}}}, {{{{tema}}}}, etc. Las variables deben ser claras y reutilizables.

Responde EXACTAMENTE en este formato JSON (solo JSON, sin texto adicional):
{{
  "name": "Nombre corto descriptivo (ej: Anuncio de speaker)",
  "content": "El texto completo de la plantilla con variables {{{{...}}}}, máximo 4-5 líneas, incluye emojis con moderación y un CTA al final",
  "variables_suggested": ["variable1", "variable2", "..."],
  "tags": "tag1, tag2, tag3"
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600,
            temperature=0.8,
            response_format={"type": "json_object"},
        )
        try:
            from backend.services.ai_usage import log_openai_usage
            log_openai_usage("gpt-4o-mini", response, context="templates/generate")
        except Exception:
            pass
        import json
        data = json.loads(response.choices[0].message.content or "{}")
        return {
            "name": data.get("name", ""),
            "content": data.get("content", ""),
            "tags": data.get("tags", ""),
            "pillar": pillar,
            "variables_suggested": data.get("variables_suggested", []),
        }
    except Exception as e:
        import logging
        logging.warning(f"templates/generate failed: {e}")
        return {"error": f"Error al generar: {e}"}
