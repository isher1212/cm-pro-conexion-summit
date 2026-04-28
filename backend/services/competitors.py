import logging
from datetime import datetime
from backend.database import get_db

logger = logging.getLogger(__name__)


def list_competitors(scope: str = "", active_only: bool = True):
    conn = get_db()
    query = "SELECT id, name, scope, category, instagram_handle, linkedin_handle, website, notes, active, created_at FROM competitors"
    params = []
    conds = []
    if scope:
        conds.append("scope = ?")
        params.append(scope)
    if active_only:
        conds.append("active = 1")
    if conds:
        query += " WHERE " + " AND ".join(conds)
    query += " ORDER BY scope, name"
    rows = conn.execute(query, params).fetchall()
    cols = ["id", "name", "scope", "category", "instagram_handle", "linkedin_handle", "website", "notes", "active", "created_at"]
    return [dict(zip(cols, r)) for r in rows]


def create_competitor(data: dict) -> int:
    conn = get_db()
    cur = conn.execute(
        """INSERT INTO competitors (name, scope, category, instagram_handle, linkedin_handle, website, notes, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            data.get("name", ""),
            data.get("scope", "national"),
            data.get("category", ""),
            data.get("instagram_handle", ""),
            data.get("linkedin_handle", ""),
            data.get("website", ""),
            data.get("notes", ""),
            1 if data.get("active", True) else 0,
            datetime.now().isoformat(),
        ),
    )
    conn.commit()
    return cur.lastrowid


def update_competitor(competitor_id: int, data: dict) -> bool:
    conn = get_db()
    allowed = {"name", "scope", "category", "instagram_handle", "linkedin_handle", "website", "notes", "active"}
    fields = {k: (1 if k == "active" and isinstance(v, bool) and v else (0 if k == "active" and isinstance(v, bool) else v))
              for k, v in data.items() if k in allowed}
    if not fields:
        return False
    sets = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [competitor_id]
    conn.execute(f"UPDATE competitors SET {sets} WHERE id = ?", values)
    conn.commit()
    return True


def delete_competitor(competitor_id: int):
    conn = get_db()
    conn.execute("DELETE FROM competitor_posts WHERE competitor_id = ?", (competitor_id,))
    conn.execute("DELETE FROM competitors WHERE id = ?", (competitor_id,))
    conn.commit()


def list_posts(competitor_id: int, limit: int = 50):
    conn = get_db()
    rows = conn.execute(
        """SELECT id, competitor_id, platform, post_url, content, likes, comments, posted_at, captured_at
           FROM competitor_posts WHERE competitor_id = ? ORDER BY posted_at DESC LIMIT ?""",
        (competitor_id, min(limit, 200)),
    ).fetchall()
    cols = ["id", "competitor_id", "platform", "post_url", "content", "likes", "comments", "posted_at", "captured_at"]
    return [dict(zip(cols, r)) for r in rows]


def add_post(competitor_id: int, data: dict) -> int:
    conn = get_db()
    cur = conn.execute(
        """INSERT INTO competitor_posts (competitor_id, platform, post_url, content, likes, comments, posted_at, captured_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            competitor_id,
            data.get("platform", ""),
            data.get("post_url", ""),
            data.get("content", ""),
            int(data.get("likes", 0) or 0),
            int(data.get("comments", 0) or 0),
            data.get("posted_at", ""),
            datetime.now().isoformat(),
        ),
    )
    conn.commit()
    return cur.lastrowid


def analyze_competitor_with_gpt(competitor_id: int, openai_client, brand_context: str = "") -> dict:
    if not openai_client:
        return {"error": "OpenAI no configurada"}
    conn = get_db()
    comp = conn.execute("SELECT name, scope, category, notes FROM competitors WHERE id = ?", (competitor_id,)).fetchone()
    if not comp:
        return {"error": "Competidor no encontrado"}
    posts = conn.execute(
        "SELECT content, likes, comments FROM competitor_posts WHERE competitor_id = ? ORDER BY likes DESC LIMIT 10",
        (competitor_id,),
    ).fetchall()
    posts_block = "\n".join(f"- {(p[0] or '')[:200]} (likes: {p[1]}, comments: {p[2]})" for p in posts) or "(sin posts cargados)"
    context_line = f"\nContexto de marca: {brand_context}" if brand_context else ""
    prompt = f"""Eres analista de competencia para Conexión Summit (plataforma de emprendimiento LATAM).{context_line}

Competidor: {comp[0]} ({comp[1]} — {comp[2] or 'sin categoría'})
Notas: {comp[3] or '—'}

Posts más virales del competidor:
{posts_block}

Responde EXACTAMENTE en este formato (en español, conciso):

QUE_HACEN_BIEN: [1-2 líneas — patrones que funcionan]
QUE_PODEMOS_APLICAR: [2-3 ideas concretas para Conexión Summit]
DIFERENCIADORES: [cómo nos diferenciamos manteniendo identidad propia, máx 2 líneas]
RIESGOS: [qué evitar copiar, máx 1 línea]"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.4,
        )
        try:
            from backend.services.ai_usage import log_openai_usage
            log_openai_usage("gpt-4o-mini", response, context="competitors/analyze")
        except Exception:
            pass
        text = response.choices[0].message.content or ""
        result = {"que_hacen_bien": "", "que_podemos_aplicar": "", "diferenciadores": "", "riesgos": ""}
        for line in text.split("\n"):
            line = line.strip()
            for k, dk in [("QUE_HACEN_BIEN:", "que_hacen_bien"), ("QUE_PODEMOS_APLICAR:", "que_podemos_aplicar"),
                          ("DIFERENCIADORES:", "diferenciadores"), ("RIESGOS:", "riesgos")]:
                if line.startswith(k):
                    result[dk] = line.replace(k, "").strip()
        return result
    except Exception as e:
        logger.warning(f"competitor analyze failed: {e}")
        return {"error": "No se pudo generar análisis"}


def suggest_with_gpt(scope: str, category: str, openai_client, brand_context: str = "") -> dict:
    """Sugiere referentes (nacionales o internacionales) basado en categoría."""
    if not openai_client:
        return {"error": "OpenAI no configurada"}
    context_line = f"\nContexto de marca: {brand_context}" if brand_context else ""
    scope_label = "nacionales (Colombia)" if scope == "national" else "internacionales"
    cat_line = f"\nCategoría/nicho: {category}" if category else ""
    prompt = f"""Eres analista de marca para Conexión Summit (plataforma de emprendimiento LATAM).{context_line}

Sugiere 5-8 referentes {scope_label} que valga la pena monitorear.{cat_line}

Devuelve EXACTAMENTE este formato JSON (sin texto adicional):

{{
  "suggestions": [
    {{"name": "<nombre>", "category": "<categoría>", "instagram_handle": "<handle sin @>", "linkedin_handle": "<handle>", "website": "<url o vacío>", "why": "<por qué seguir, 1 línea>"}}
  ]
}}"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800, temperature=0.5,
        )
        try:
            from backend.services.ai_usage import log_openai_usage
            log_openai_usage("gpt-4o-mini", response, context="referentes/suggest")
        except Exception:
            pass
        import json
        text = response.choices[0].message.content or ""
        start = text.find("{"); end = text.rfind("}")
        if start < 0 or end < 0:
            return {"error": "No se pudo parsear sugerencias"}
        data = json.loads(text[start:end + 1])
        return data
    except Exception as e:
        logger.warning(f"suggest_with_gpt failed: {e}")
        return {"error": str(e)}
