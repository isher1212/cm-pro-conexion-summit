import logging
from datetime import datetime
from backend.database import get_db

logger = logging.getLogger(__name__)


def list_members(active_only: bool = True):
    conn = get_db()
    query = "SELECT id, name, email, role, avatar_url, phone, notes, active, created_at FROM team_members"
    if active_only:
        query += " WHERE active = 1"
    query += " ORDER BY name"
    rows = conn.execute(query).fetchall()
    cols = ["id", "name", "email", "role", "avatar_url", "phone", "notes", "active", "created_at"]
    return [dict(zip(cols, r)) for r in rows]


def create_member(data: dict) -> int:
    conn = get_db()
    cur = conn.execute(
        """INSERT INTO team_members (name, email, role, avatar_url, phone, notes, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            data.get("name", ""), data.get("email", ""), data.get("role", "editor"),
            data.get("avatar_url", ""), data.get("phone", ""), data.get("notes", ""),
            1 if data.get("active", True) else 0, datetime.now().isoformat(),
        ),
    )
    conn.commit()
    return cur.lastrowid


def update_member(member_id: int, data: dict) -> bool:
    conn = get_db()
    allowed = {"name", "email", "role", "avatar_url", "phone", "notes", "active"}
    fields = {}
    for k, v in data.items():
        if k not in allowed:
            continue
        if k == "active":
            fields[k] = 1 if v else 0
        else:
            fields[k] = v
    if not fields:
        return False
    sets = ", ".join(f"{k} = ?" for k in fields)
    conn.execute(f"UPDATE team_members SET {sets} WHERE id = ?", list(fields.values()) + [member_id])
    conn.commit()
    return True


def delete_member(member_id: int):
    conn = get_db()
    conn.execute("DELETE FROM team_members WHERE id = ?", (member_id,))
    conn.commit()
