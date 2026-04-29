import logging
from datetime import datetime
from backend.database import get_db

logger = logging.getLogger(__name__)


def list_editions():
    conn = get_db()
    rows = conn.execute(
        """SELECT id, year, theme, date_start, date_end, location, description,
                  summary_post_event, attendees_count, satisfaction_score, notes, created_at
           FROM event_editions ORDER BY year DESC"""
    ).fetchall()
    cols = ["id", "year", "theme", "date_start", "date_end", "location", "description",
            "summary_post_event", "attendees_count", "satisfaction_score", "notes", "created_at"]
    return [dict(zip(cols, r)) for r in rows]


def get_edition(edition_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM event_editions WHERE id = ?", (edition_id,)).fetchone()
    if not row:
        return None
    cols = [d[1] for d in conn.execute("PRAGMA table_info(event_editions)").fetchall()]
    return dict(zip(cols, row))


def get_or_create_edition_by_year(year: int) -> int:
    conn = get_db()
    row = conn.execute("SELECT id FROM event_editions WHERE year = ?", (year,)).fetchone()
    if row:
        return row[0]
    cur = conn.execute(
        "INSERT INTO event_editions (year, created_at) VALUES (?, ?)",
        (year, datetime.now().isoformat()),
    )
    conn.commit()
    return cur.lastrowid


def upsert_edition(data: dict) -> int:
    conn = get_db()
    eid = data.get("id")
    if eid:
        allowed = {"year", "theme", "date_start", "date_end", "location", "description",
                   "summary_post_event", "attendees_count", "satisfaction_score", "notes"}
        fields = {k: v for k, v in data.items() if k in allowed}
        if not fields:
            return int(eid)
        sets = ", ".join(f"{k} = ?" for k in fields)
        conn.execute(f"UPDATE event_editions SET {sets} WHERE id = ?", list(fields.values()) + [int(eid)])
        conn.commit()
        return int(eid)
    cur = conn.execute(
        """INSERT INTO event_editions (year, theme, date_start, date_end, location, description,
                                       summary_post_event, attendees_count, satisfaction_score, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            int(data.get("year", 0)), data.get("theme", ""), data.get("date_start", ""), data.get("date_end", ""),
            data.get("location", ""), data.get("description", ""), data.get("summary_post_event", ""),
            int(data.get("attendees_count", 0) or 0), float(data.get("satisfaction_score", 0) or 0),
            data.get("notes", ""), datetime.now().isoformat(),
        ),
    )
    conn.commit()
    return cur.lastrowid


def delete_edition(edition_id: int):
    conn = get_db()
    for table in ("speakers", "sponsors", "key_people", "summit_milestones", "event_goals"):
        conn.execute(f"DELETE FROM {table} WHERE edition_id = ?", (edition_id,))
    conn.execute("DELETE FROM event_editions WHERE id = ?", (edition_id,))
    conn.commit()


TABLES = {
    "speakers": ["id", "edition_id", "name", "bio", "photo_url", "role", "company", "talk_title",
                 "instagram", "linkedin", "twitter", "website", "notes", "confirmed", "created_at"],
    "sponsors": ["id", "edition_id", "name", "tier", "logo_url", "contact_name", "contact_email",
                 "agreement_value", "deliverables", "notes", "created_at"],
    "key_people": ["id", "edition_id", "name", "role", "bio", "photo_url", "contact", "notes", "created_at"],
    "summit_milestones": ["id", "edition_id", "title", "phase", "date", "description", "completed", "created_at"],
    "event_goals": ["id", "edition_id", "name", "target_value", "current_value", "unit", "deadline", "created_at"],
}


def list_items(table: str, edition_id: int):
    if table not in TABLES:
        return []
    conn = get_db()
    cols = TABLES[table]
    rows = conn.execute(f"SELECT {', '.join(cols)} FROM {table} WHERE edition_id = ? ORDER BY id DESC", (edition_id,)).fetchall()
    return [dict(zip(cols, r)) for r in rows]


def create_item(table: str, edition_id: int, data: dict) -> int:
    if table not in TABLES:
        return 0
    conn = get_db()
    cols = TABLES[table]
    insertable = [c for c in cols if c != "id"]
    values = []
    for c in insertable:
        if c == "edition_id":
            values.append(edition_id)
        elif c == "created_at":
            values.append(datetime.now().isoformat())
        elif c in ("confirmed", "completed"):
            values.append(1 if data.get(c, False) else 0)
        elif c in ("agreement_value", "target_value", "current_value"):
            try:
                values.append(float(data.get(c, 0) or 0))
            except Exception:
                values.append(0.0)
        else:
            values.append(data.get(c, ""))
    placeholders = ", ".join(["?"] * len(insertable))
    cur = conn.execute(f"INSERT INTO {table} ({', '.join(insertable)}) VALUES ({placeholders})", values)
    conn.commit()
    return cur.lastrowid


def update_item(table: str, item_id: int, data: dict) -> bool:
    if table not in TABLES:
        return False
    conn = get_db()
    cols = set(TABLES[table]) - {"id", "edition_id", "created_at"}
    fields = {}
    for k, v in data.items():
        if k not in cols:
            continue
        if k in ("confirmed", "completed"):
            fields[k] = 1 if v else 0
        elif k in ("agreement_value", "target_value", "current_value"):
            try:
                fields[k] = float(v or 0)
            except Exception:
                fields[k] = 0.0
        else:
            fields[k] = v
    if not fields:
        return False
    sets = ", ".join(f"{k} = ?" for k in fields)
    conn.execute(f"UPDATE {table} SET {sets} WHERE id = ?", list(fields.values()) + [item_id])
    conn.commit()
    return True


def delete_item(table: str, item_id: int):
    if table not in TABLES:
        return
    conn = get_db()
    conn.execute(f"DELETE FROM {table} WHERE id = ?", (item_id,))
    conn.commit()


def get_item_by_id(table: str, item_id: int) -> dict | None:
    if table not in {"speakers", "sponsors", "key_people", "summit_milestones", "event_goals"}:
        return None
    from backend.database import get_db
    conn = get_db()
    row = conn.execute(f"SELECT * FROM {table} WHERE id = ?", (item_id,)).fetchone()
    if not row:
        return None
    cols = [c[1] for c in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    return dict(zip(cols, row))


def edition_panorama(edition_id: int, openai_client, brand_context: str = "") -> dict:
    if not openai_client:
        return {"error": "OpenAI no configurada"}
    edition = get_edition(edition_id)
    if not edition:
        return {"error": "Edicion no encontrada"}
    speakers_count = len(list_items("speakers", edition_id))
    sponsors = list_items("sponsors", edition_id)
    sponsors_block = "\n".join(f"- {s['name']} ({s.get('tier','partner')}) — ${s.get('agreement_value',0)}" for s in sponsors[:15]) or "(sin sponsors)"
    goals = list_items("event_goals", edition_id)
    goals_block = "\n".join(f"- {g['name']}: {g.get('current_value',0)}/{g.get('target_value',0)} {g.get('unit','')}" for g in goals[:10]) or "(sin metas)"
    milestones = list_items("summit_milestones", edition_id)
    milestones_block = "\n".join(f"- [{'v' if m.get('completed') else '.'}] {m['title']} ({m.get('phase','pre')})" for m in milestones[:20]) or "(sin hitos)"
    context_line = f"\nContexto de marca: {brand_context}" if brand_context else ""
    prompt = f"""Eres director de eventos de Conexion Summit (plataforma de emprendimiento LATAM).{context_line}

Edicion {edition.get('year')} — {edition.get('theme', 'sin tema')}
Lugar: {edition.get('location', '—')}  Fechas: {edition.get('date_start', '—')} a {edition.get('date_end', '—')}
Asistentes: {edition.get('attendees_count', 0)}  Satisfaccion: {edition.get('satisfaction_score', 0)}/10
Resumen post-evento: {edition.get('summary_post_event', '—')}
Speakers confirmados: {speakers_count}

Sponsors:
{sponsors_block}

Hitos:
{milestones_block}

Metas:
{goals_block}

Responde EXACTAMENTE en este formato (en espanol, conciso):

DIAGNOSTICO: [estado general de esta edicion, max 2 lineas]
QUE_FUNCIONO: [2-3 puntos fuertes a mantener]
QUE_FALTA: [2-3 areas a fortalecer]
PROYECCIONES: [recomendaciones concretas para proximas ediciones, max 3 lineas]
RIESGOS: [riesgos a mitigar, max 2 lineas]"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500, temperature=0.4,
        )
        try:
            from backend.services.ai_usage import log_openai_usage
            log_openai_usage("gpt-4o-mini", response, context="summit/panorama")
        except Exception:
            pass
        text = response.choices[0].message.content or ""
        result = {"diagnostico": "", "que_funciono": "", "que_falta": "", "proyecciones": "", "riesgos": ""}
        for line in text.split("\n"):
            line = line.strip()
            for k, dk in [("DIAGNOSTICO:", "diagnostico"), ("QUE_FUNCIONO:", "que_funciono"),
                          ("QUE_FALTA:", "que_falta"), ("PROYECCIONES:", "proyecciones"), ("RIESGOS:", "riesgos")]:
                if line.startswith(k):
                    result[dk] = line.replace(k, "").strip()
        return result
    except Exception as e:
        logger.warning(f"edition_panorama failed: {e}")
        return {"error": "No se pudo generar el panorama"}


def historical_overview(openai_client, brand_context: str = "") -> dict:
    if not openai_client:
        return {"error": "OpenAI no configurada"}
    editions = list_editions()
    if not editions:
        return {"error": "No hay ediciones registradas"}
    block = []
    for e in editions[:8]:
        block.append(f"- {e['year']}: {e.get('theme','sin tema')} — {e.get('attendees_count',0)} asistentes, satisfaccion {e.get('satisfaction_score',0)}/10. Resumen: {(e.get('summary_post_event') or '—')[:200]}")
    block_text = "\n".join(block)
    context_line = f"\nContexto de marca: {brand_context}" if brand_context else ""
    prompt = f"""Eres director de eventos de Conexion Summit.{context_line}

Historico de ediciones:
{block_text}

Responde EXACTAMENTE en este formato (en espanol, conciso):

EVOLUCION: [como ha evolucionado el evento ano a ano, max 3 lineas]
FORTALEZAS: [2-3 fortalezas consistentes]
PATRONES: [1-2 patrones de crecimiento o decrecimiento]
PROYECCIONES: [proyecciones razonables para proxima edicion — asistentes, satisfaccion, sponsors, max 3 lineas]
PRIORIDADES: [3 prioridades estrategicas para la proxima edicion]"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600, temperature=0.4,
        )
        try:
            from backend.services.ai_usage import log_openai_usage
            log_openai_usage("gpt-4o-mini", response, context="summit/historical")
        except Exception:
            pass
        text = response.choices[0].message.content or ""
        result = {"evolucion": "", "fortalezas": "", "patrones": "", "proyecciones": "", "prioridades": ""}
        for line in text.split("\n"):
            line = line.strip()
            for k, dk in [("EVOLUCION:", "evolucion"), ("FORTALEZAS:", "fortalezas"),
                          ("PATRONES:", "patrones"), ("PROYECCIONES:", "proyecciones"), ("PRIORIDADES:", "prioridades")]:
                if line.startswith(k):
                    result[dk] = line.replace(k, "").strip()
        return result
    except Exception as e:
        logger.warning(f"historical_overview failed: {e}")
        return {"error": "No se pudo generar el panorama historico"}
