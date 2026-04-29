import logging
from fastapi import APIRouter
from backend.config import load_config
from backend.services.competitors import (
    list_competitors, create_competitor, update_competitor, delete_competitor,
    list_posts, add_post, analyze_competitor_with_gpt, suggest_with_gpt,
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


@router.get("/competitors")
def get_competitors(scope: str = "", active_only: bool = True):
    return list_competitors(scope=scope, active_only=active_only)


@router.post("/competitors")
def post_competitor(body: dict):
    cid = create_competitor(body)
    return {"status": "ok", "id": cid}


@router.patch("/competitors/{competitor_id}")
def patch_competitor(competitor_id: int, body: dict):
    ok = update_competitor(competitor_id, body)
    return {"status": "ok" if ok else "noop"}


@router.delete("/competitors/{competitor_id}")
def del_competitor(competitor_id: int):
    delete_competitor(competitor_id)
    return {"status": "ok"}


@router.get("/competitors/{competitor_id}/posts")
def get_posts(competitor_id: int, limit: int = 50):
    return list_posts(competitor_id, limit)


@router.post("/competitors/{competitor_id}/posts")
def post_post(competitor_id: int, body: dict):
    pid = add_post(competitor_id, body)
    return {"status": "ok", "id": pid}


@router.post("/competitors/{competitor_id}/analyze")
def analyze_competitor(competitor_id: int):
    config = load_config()
    client = _openai_client(config)
    if not client:
        return {"error": "OpenAI API key no configurada"}
    return analyze_competitor_with_gpt(competitor_id, client, config.get("brand_context", ""))


@router.post("/competitors/suggest")
def suggest_competitors(body: dict):
    config = load_config()
    client = _openai_client(config)
    if not client:
        return {"error": "OpenAI API key no configurada"}
    return suggest_with_gpt(
        scope=body.get("scope", "national"),
        category=body.get("category", ""),
        openai_client=client,
        brand_context=config.get("brand_context", ""),
    )


PRESET_REFERENTES = {
    "national": [
        {"name": "iNNpulsa Colombia", "category": "Aceleradora", "instagram_handle": "innpulsa_col", "linkedin_handle": "innpulsa-colombia", "website": "https://innpulsacolombia.com", "notes": "Agencia del gobierno colombiano para emprendimiento e innovación. Referente en programas de aceleración."},
        {"name": "Endeavor Colombia", "category": "Aceleradora", "instagram_handle": "endeavorcol", "linkedin_handle": "endeavor-colombia", "website": "https://endeavor.org.co", "notes": "Selecciona y apoya emprendedores de alto impacto. Eventos de alto nivel."},
        {"name": "Rockstart", "category": "Aceleradora", "instagram_handle": "rockstart", "linkedin_handle": "rockstart", "website": "https://rockstart.com", "notes": "Aceleradora con programas verticalizados (energía, agrifood, emerging tech)."},
        {"name": "Bancóldex", "category": "Financiamiento", "instagram_handle": "bancoldex", "linkedin_handle": "bancoldex", "website": "https://www.bancoldex.com", "notes": "Banco de desarrollo, ofrece financiamiento y programas de apoyo."},
        {"name": "Ruta N Medellín", "category": "Hub innovación", "instagram_handle": "rutanmedellin", "linkedin_handle": "rutan-medellin", "website": "https://www.rutanmedellin.org", "notes": "Centro de innovación y negocios de Medellín."},
        {"name": "ProColombia", "category": "Promoción", "instagram_handle": "procolombiaco", "linkedin_handle": "procolombia", "website": "https://procolombia.co", "notes": "Promoción de exportaciones, turismo, inversión y marca país."},
        {"name": "Wayra Colombia", "category": "Aceleradora corporativa", "instagram_handle": "wayraco", "linkedin_handle": "wayra-hispam", "website": "https://www.wayra.com", "notes": "Aceleradora de Telefónica/Movistar para startups en LATAM."},
        {"name": "Cube Ventures", "category": "VC", "instagram_handle": "cubeventures", "linkedin_handle": "cube-ventures", "website": "https://cubeventures.co", "notes": "Fondo de venture capital en Colombia."},
        {"name": "Colombia Fintech", "category": "Asociación", "instagram_handle": "colombiafintech", "linkedin_handle": "colombia-fintech", "website": "https://www.colombiafintech.co", "notes": "Asociación de la industria fintech colombiana."},
        {"name": "Camara de Comercio de Bogotá", "category": "Cámara", "instagram_handle": "ccbogota", "linkedin_handle": "camara-de-comercio-de-bogota", "website": "https://www.ccb.org.co", "notes": "Programa Bogotá Emprende, eventos y networking."},
    ],
    "international": [
        {"name": "Y Combinator", "category": "Aceleradora top mundial", "instagram_handle": "ycombinator", "linkedin_handle": "y-combinator", "website": "https://www.ycombinator.com", "notes": "La aceleradora más reconocida del mundo. Referente en cultura startup."},
        {"name": "Endeavor Global", "category": "Red emprendedores", "instagram_handle": "endeavorglobal", "linkedin_handle": "endeavor", "website": "https://endeavor.org", "notes": "Casa matriz de Endeavor, presencia en 35+ países."},
        {"name": "Web Summit", "category": "Evento global", "instagram_handle": "websummit", "linkedin_handle": "web-summit", "website": "https://websummit.com", "notes": "Uno de los eventos de tecnología más grandes del mundo."},
        {"name": "TechCrunch Disrupt", "category": "Evento startups", "instagram_handle": "techcrunch", "linkedin_handle": "techcrunch", "website": "https://techcrunch.com/events", "notes": "Evento estrella del ecosistema, compite startups y reúne inversores."},
        {"name": "Slush", "category": "Evento startups", "instagram_handle": "slushhq", "linkedin_handle": "slush", "website": "https://slush.org", "notes": "Evento de startups y tech con foco en founders y investors."},
        {"name": "South Summit", "category": "Evento startups", "instagram_handle": "southsummit", "linkedin_handle": "southsummit", "website": "https://www.southsummit.co", "notes": "Encuentro líder de innovación abierta y emprendimiento en habla hispana."},
        {"name": "a16z (Andreessen Horowitz)", "category": "VC top", "instagram_handle": "a16z", "linkedin_handle": "andreessen-horowitz", "website": "https://a16z.com", "notes": "Fondo de venture capital top global, gran productor de contenido."},
        {"name": "Sequoia Capital", "category": "VC top", "instagram_handle": "sequoia_capital", "linkedin_handle": "sequoia-capital", "website": "https://www.sequoiacap.com", "notes": "Fondo histórico de VC, inversores legendarios."},
        {"name": "First Round Capital", "category": "VC", "instagram_handle": "firstround", "linkedin_handle": "first-round-capital", "website": "https://firstround.com", "notes": "VC con excelente contenido educativo y comunidad founders."},
        {"name": "500 Global", "category": "Aceleradora/VC", "instagram_handle": "500global", "linkedin_handle": "500global", "website": "https://500.co", "notes": "Programas de aceleración en LATAM y emergentes."},
    ],
}


@router.get("/competitors/presets")
def list_presets(scope: str = ""):
    """Returns curated preset references that can be added with one click."""
    if scope and scope in PRESET_REFERENTES:
        return {"presets": PRESET_REFERENTES[scope]}
    return {"presets": PRESET_REFERENTES["national"] + PRESET_REFERENTES["international"], "national": PRESET_REFERENTES["national"], "international": PRESET_REFERENTES["international"]}


@router.post("/competitors/{competitor_id}/monitor")
def monitor_competitor(competitor_id: int, body: dict = None):
    """Use AI to summarize recent activity and trends of a referente based on its profile.
    Note: actual scraping of social media is not implemented here. The AI uses public knowledge
    about the brand to provide a useful "what they're likely doing right now" analysis.
    """
    from backend.config import load_config
    from backend.services.competitors import get_competitor
    config = load_config()
    api_key = config.get("openai_api_key", "")
    if not api_key:
        return {"error": "OpenAI API key no configurada"}
    item = get_competitor(competitor_id)
    if not item:
        return {"error": "Referente no encontrado"}

    from openai import OpenAI
    client = OpenAI(api_key=api_key)

    handles = []
    if item.get("instagram_handle"): handles.append(f"Instagram: @{item['instagram_handle']}")
    if item.get("linkedin_handle"): handles.append(f"LinkedIn: {item['linkedin_handle']}")
    if item.get("website"): handles.append(f"Web: {item['website']}")

    brand = config.get("brand_context", "")

    prompt = f"""Eres analista de social media y tendencias del ecosistema emprendedor LATAM. Analiza este referente de Conexión Summit y dame un panorama útil de lo que están haciendo en redes y qué tendencias siguen.

REFERENTE: {item.get('name')}
ALCANCE: {item.get('scope', 'national')}
CATEGORÍA: {item.get('category', '')}
NOTAS: {item.get('notes', '')}
PERFILES: {' · '.join(handles) if handles else 'no disponibles'}
{f"CONTEXTO DE MARCA SUMMIT: {brand}" if brand else ""}

Basándote en el conocimiento público sobre esta marca y el ecosistema emprendedor (NO inventes posts específicos), genera un análisis útil para el equipo de marketing de Conexión Summit.

Responde EXACTAMENTE en este formato JSON:
{{
  "estilo_comunicacion": "Cómo se comunican típicamente (tono, frecuencia, formatos preferidos)",
  "temas_recurrentes": ["tema 1", "tema 2", "tema 3"],
  "tendencias_que_siguen": ["tendencia 1 con breve explicación", "tendencia 2", "tendencia 3"],
  "lo_destacado": "1-2 logros, eventos o iniciativas notables que han hecho recientemente o suelen hacer",
  "que_aplicar_a_summit": ["acción concreta 1 que Summit puede aplicar inspirándose en ellos", "acción 2", "acción 3"],
  "como_superarlos": "1-2 ideas de cómo Summit puede ir un paso más allá y diferenciarse",
  "links_recomendados": ["link relevante 1 (si conoces algún caso público específico)", "link 2"]
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1100,
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        try:
            from backend.services.ai_usage import log_openai_usage
            log_openai_usage("gpt-4o-mini", response, context="competitors/monitor")
        except Exception:
            pass
        import json
        return json.loads(response.choices[0].message.content or "{}")
    except Exception as e:
        import logging
        logging.warning(f"competitors monitor failed: {e}")
        return {"error": f"Error: {e}"}
