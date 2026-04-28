import json
import logging
import re
from datetime import datetime
from backend.database import get_db

logger = logging.getLogger(__name__)


def list_templates(pillar: str = "", search: str = ""):
    conn = get_db()
    query = "SELECT id, name, content, pillar, variables, tags, created_at, updated_at FROM copy_templates"
    params = []
    conds = []
    if pillar:
        conds.append("pillar = ?")
        params.append(pillar)
    if search:
        conds.append("(name LIKE ? OR content LIKE ?)")
        params += [f"%{search}%", f"%{search}%"]
    if conds:
        query += " WHERE " + " AND ".join(conds)
    query += " ORDER BY updated_at DESC, created_at DESC"
    rows = conn.execute(query, params).fetchall()
    cols = ["id", "name", "content", "pillar", "variables", "tags", "created_at", "updated_at"]
    out = []
    for r in rows:
        d = dict(zip(cols, r))
        try:
            d["variables"] = json.loads(d["variables"] or "[]")
        except Exception:
            d["variables"] = []
        out.append(d)
    return out


def _extract_variables(content: str):
    return list(set(re.findall(r"\{\{([\w\s_-]+?)\}\}", content)))


def create_template(data: dict) -> int:
    conn = get_db()
    content = data.get("content", "")
    variables = _extract_variables(content)
    now = datetime.now().isoformat()
    cur = conn.execute(
        """INSERT INTO copy_templates (name, content, pillar, variables, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            data.get("name", "Sin nombre"),
            content,
            data.get("pillar", ""),
            json.dumps(variables, ensure_ascii=False),
            data.get("tags", ""),
            now, now,
        ),
    )
    conn.commit()
    return cur.lastrowid


def update_template(template_id: int, data: dict) -> bool:
    conn = get_db()
    allowed = {"name", "content", "pillar", "tags"}
    fields = {k: v for k, v in data.items() if k in allowed}
    if not fields:
        return False
    if "content" in fields:
        fields["variables"] = json.dumps(_extract_variables(fields["content"]), ensure_ascii=False)
    fields["updated_at"] = datetime.now().isoformat()
    sets = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [template_id]
    conn.execute(f"UPDATE copy_templates SET {sets} WHERE id = ?", values)
    conn.commit()
    return True


def delete_template(template_id: int):
    conn = get_db()
    conn.execute("DELETE FROM copy_templates WHERE id = ?", (template_id,))
    conn.commit()


def render_template(template_id: int, values: dict) -> dict:
    conn = get_db()
    row = conn.execute("SELECT name, content FROM copy_templates WHERE id = ?", (template_id,)).fetchone()
    if not row:
        return {"error": "Plantilla no encontrada"}
    content = row[1]
    rendered = content
    for key, val in values.items():
        rendered = rendered.replace("{{" + key + "}}", str(val))
    return {"name": row[0], "rendered": rendered}


SEED_TEMPLATES = [
    {
        "name": "Anuncio de speaker",
        "pillar": "Speakers e Historias de Impacto",
        "content": "🎤 Tenemos confirmado a {{nombre_speaker}} en Conexión Summit.\n\n{{cargo}} en {{empresa}}, hablará sobre {{tema}} el {{fecha}}.\n\n¿Por qué no te lo puedes perder? {{razon}}\n\n#ConexionSummit #Emprendimiento",
        "tags": "speaker, evento, anuncio",
    },
    {
        "name": "Caso de éxito startup",
        "pillar": "Conexiones Corporativo ↔ Startup",
        "content": "🚀 La historia de {{nombre_startup}}:\n\nDe {{problema_inicial}} a {{logro_actual}} en {{tiempo}}.\n\nLa conexión con {{aliado}} fue el punto de inflexión. Lección: {{leccion}}.\n\n#StartupsLATAM #Innovacion",
        "tags": "caso, startup, exito",
    },
    {
        "name": "Tip educativo",
        "pillar": "Educación e Innovación",
        "content": "💡 {{tema}} en 3 puntos:\n\n1. {{punto1}}\n2. {{punto2}}\n3. {{punto3}}\n\n¿Cuál aplicarás primero? Coméntalo abajo 👇\n\n#Innovacion #Emprendedores",
        "tags": "tip, educativo",
    },
    {
        "name": "Behind the scenes preparación",
        "pillar": "Behind the Scenes",
        "content": "🎬 Así preparamos {{actividad}} para Conexión Summit.\n\n{{descripcion_proceso}}\n\nDetrás de cada gran evento hay un equipo construyendo la experiencia. Cuenta regresiva: {{dias}} días.\n\n#ConexionSummit",
        "tags": "behind, equipo",
    },
    {
        "name": "Dato del ecosistema LATAM",
        "pillar": "Ecosistema Emprendedor LATAM",
        "content": "📊 Dato del día:\n\n{{dato_principal}}\n\nFuente: {{fuente}}.\n\nLo que esto significa para emprendedores LATAM: {{interpretacion}}.\n\n#EcosistemaLATAM #Datos",
        "tags": "dato, ecosistema, latam",
    },
    {
        "name": "Invitación a registro",
        "pillar": "Ecosistema Emprendedor LATAM",
        "content": "📅 ¡Faltan {{dias}} días para Conexión Summit {{año}}!\n\n📍 {{lugar}}\n🎤 {{cantidad_speakers}}+ speakers confirmados\n🤝 Rueda de negocios startup-corporativo\n\nRegístrate aquí 👉 {{link_registro}}\n\n#ConexionSummit{{año}}",
        "tags": "invitacion, registro",
    },
    {
        "name": "Quote de speaker",
        "pillar": "Speakers e Historias de Impacto",
        "content": '"{{frase}}"\n\n— {{nombre_speaker}}, {{cargo}}\n\nSpeaker confirmado en Conexión Summit {{año}}. {{contexto_breve}}\n\n#ConexionSummit #Emprendimiento',
        "tags": "quote, speaker, frase",
    },
    {
        "name": "Recap de evento pasado",
        "pillar": "Behind the Scenes",
        "content": "🎉 ¡Cerramos Conexión Summit {{año}}!\n\nEn números:\n👥 {{asistentes}} asistentes\n🤝 {{conexiones}} conexiones generadas\n🎤 {{charlas}} charlas\n\nLo más viral: {{momento_destacado}}.\n\nGracias a quienes lo hicieron posible. Nos vemos en {{año_siguiente}}.",
        "tags": "recap, post-evento",
    },
]


def seed_default_templates() -> int:
    """Inserta plantillas de ejemplo si no hay ninguna."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM copy_templates").fetchone()[0]
    if count > 0:
        return 0
    inserted = 0
    for t in SEED_TEMPLATES:
        try:
            create_template(t)
            inserted += 1
        except Exception:
            pass
    return inserted
