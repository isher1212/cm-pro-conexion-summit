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
