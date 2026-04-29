from fastapi import APIRouter
from backend.services.brand import (
    list_brands, get_brand, upsert_brand, delete_brand, set_current_brand, get_current_brand,
)

router = APIRouter()


@router.get("/brand/current")
def current():
    b = get_current_brand()
    return b or {}


@router.get("/brand/all")
def get_all():
    return list_brands()


@router.get("/brand/{brand_id}")
def get_one(brand_id: int):
    return get_brand(brand_id) or {"error": "no encontrada"}


@router.post("/brand")
def post_brand(body: dict):
    return {"status": "ok", "id": upsert_brand(body)}


@router.patch("/brand/{brand_id}")
def patch_brand(brand_id: int, body: dict):
    body["id"] = brand_id
    return {"status": "ok", "id": upsert_brand(body)}


@router.delete("/brand/{brand_id}")
def del_brand(brand_id: int):
    delete_brand(brand_id)
    return {"status": "ok"}


@router.post("/brand/{brand_id}/activate")
def activate(brand_id: int):
    set_current_brand(brand_id)
    return {"status": "ok"}


@router.post("/brand/preset-summit")
def preset_summit():
    """Returns preloaded Conexión Summit brand info."""
    return {
        "name": "Conexión Summit",
        "tagline": "Conectando el ecosistema emprendedor de LATAM",
        "mission": "Impulsar el crecimiento del ecosistema emprendedor latinoamericano conectando startups, corporativos, inversionistas y mentores en un evento anual de alto impacto.",
        "vision": "Ser el evento referente del emprendimiento en LATAM, donde se forjen las alianzas y conexiones que definen el futuro de la innovación regional.",
        "values_text": "Innovación · Colaboración · Diversidad · Impacto · Excelencia",
        "tone": "Inspirador, profesional, cercano y orientado a la acción. Habla con autoridad pero sin distancia. Celebra logros y comunica oportunidades reales.",
        "style_guide": "Frases cortas y directas. Datos concretos cuando aporten. Emojis con moderación (🚀 ✨ 🔥 💡). Llamados a la acción claros. Storytelling sobre casos reales del ecosistema.",
        "target_audience": "Emprendedores en etapa temprana y crecimiento, fundadores de startups, líderes de innovación corporativa, inversionistas ángeles y de venture capital, mentores y aceleradoras de LATAM.",
        "differentiators": "Foco en el ecosistema LATAM (no solo Colombia). Conexiones reales 1-a-1, no solo charlas. Curaduría de speakers internacionales con casos aplicables a la región. Plataforma de relacionamiento durante todo el año, no solo el evento.",
        "avoid_topics": "Política partidista. Comparaciones negativas con otros eventos o ecosistemas. Promesas de retornos financieros específicos. Crítica directa a startups o líderes del ecosistema.",
        "primary_color": "#6366F1",
        "secondary_color": "#8B5CF6",
        "accent_color": "#F59E0B",
        "font_primary": "Inter",
        "font_secondary": "Inter",
    }


@router.post("/brand/ai-fill")
def ai_fill(body: dict):
    """Use OpenAI to fill empty brand fields based on existing context.
    Body: { current_brand: {...}, target_field: "mission" (optional, fills all empty if absent) }
    """
    from backend.config import load_config
    config = load_config()
    api_key = config.get("openai_api_key", "")
    if not api_key:
        return {"error": "OpenAI API key not configured"}
    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    brand = body.get("current_brand", {}) or {}
    target = body.get("target_field", "")

    field_descriptions = {
        "tagline": "Una frase corta de 5-10 palabras que resuma la esencia de la marca",
        "mission": "Misión de la marca en 2-3 oraciones, qué hace y para quién",
        "vision": "Visión a largo plazo en 1-2 oraciones, qué quiere lograr",
        "values_text": "Valores de la marca separados por · (5 valores máximo)",
        "tone": "Tono de voz de la marca en 1-2 oraciones",
        "style_guide": "Guía de estilo de redacción en 2-3 oraciones",
        "target_audience": "Audiencia objetivo en 1-2 oraciones",
        "differentiators": "Diferenciadores clave en 2-3 oraciones",
        "avoid_topics": "Temas que la marca debe evitar, separados por punto",
    }

    fields_to_fill = [target] if target and target in field_descriptions else [
        k for k in field_descriptions if not (brand.get(k) or "").strip()
    ]
    if not fields_to_fill:
        return {"error": "No hay campos vacíos para completar."}

    context_lines = [f"{k}: {v}" for k, v in brand.items() if v and isinstance(v, str)]
    context = "\n".join(context_lines) if context_lines else "(marca sin información aún)"

    results = {}
    for field in fields_to_fill:
        try:
            prompt = f"""Eres un experto en branding y comunicación. Basándote en la información existente de la marca, genera el campo solicitado.

INFORMACIÓN ACTUAL DE LA MARCA:
{context}

CAMPO A GENERAR: {field}
DESCRIPCIÓN: {field_descriptions[field]}

Responde ÚNICAMENTE con el contenido del campo, sin etiquetas, sin comillas, sin explicaciones. Mantén el tono profesional y coherente con la información existente."""
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.7,
            )
            try:
                from backend.services.ai_usage import log_openai_usage
                log_openai_usage("gpt-4o-mini", response, context=f"brand/ai-fill/{field}")
            except Exception:
                pass
            text = (response.choices[0].message.content or "").strip()
            if text:
                results[field] = text
        except Exception as e:
            import logging
            logging.warning(f"brand/ai-fill {field} failed: {e}")
    return {"filled": results}


@router.post("/brand/upload-logo")
def upload_logo(body: dict):
    """Receives base64 data URL of logo, stores in brand record."""
    brand_id = body.get("brand_id")
    data_url = body.get("data_url", "")
    if not brand_id or not data_url:
        return {"error": "brand_id and data_url required"}
    if len(data_url) > 1500000:  # ~1MB after base64
        return {"error": "Logo demasiado grande (máx ~1MB)"}
    from backend.services.brand import get_brand, upsert_brand
    brand = get_brand(int(brand_id))
    if not brand:
        return {"error": "brand not found"}
    brand["logo_url"] = data_url
    brand["id"] = int(brand_id)
    upsert_brand(brand)
    return {"status": "ok"}
