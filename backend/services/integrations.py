import json
import logging
from datetime import datetime
from backend.database import get_db

logger = logging.getLogger(__name__)

DEFAULT_INTEGRATIONS = [
    {"provider": "notion", "name": "Notion", "fields": ["api_token", "database_id"]},
    {"provider": "slack", "name": "Slack", "fields": ["webhook_url"]},
    {"provider": "buffer", "name": "Buffer", "fields": ["api_token"]},
    {"provider": "canva", "name": "Canva", "fields": ["api_token"]},
    {"provider": "whatsapp", "name": "WhatsApp Business", "fields": ["phone_number_id", "access_token"]},
    {"provider": "zapier", "name": "Zapier (webhook)", "fields": ["webhook_url"]},
]


def list_integrations():
    conn = get_db()
    rows = conn.execute(
        """SELECT id, name, provider, config_json, enabled, connected_at, created_at FROM integrations ORDER BY name"""
    ).fetchall()
    cols = ["id", "name", "provider", "config_json", "enabled", "connected_at", "created_at"]
    out = []
    for r in rows:
        d = dict(zip(cols, r))
        try:
            d["config"] = json.loads(d.pop("config_json") or "{}")
        except Exception:
            d["config"] = {}
        out.append(d)
    return out


def get_or_create_integration(provider: str) -> dict:
    conn = get_db()
    row = conn.execute("SELECT id FROM integrations WHERE provider = ?", (provider,)).fetchone()
    if row:
        return {"id": row[0]}
    default = next((d for d in DEFAULT_INTEGRATIONS if d["provider"] == provider), None)
    name = default["name"] if default else provider
    cur = conn.execute(
        """INSERT INTO integrations (name, provider, config_json, enabled, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (name, provider, "{}", 0, datetime.now().isoformat()),
    )
    conn.commit()
    return {"id": cur.lastrowid}


def update_integration(integration_id: int, data: dict) -> bool:
    conn = get_db()
    sets_parts = []
    values = []
    if "config" in data:
        sets_parts.append("config_json = ?")
        values.append(json.dumps(data["config"], ensure_ascii=False))
    if "enabled" in data:
        sets_parts.append("enabled = ?")
        values.append(1 if data["enabled"] else 0)
        if data["enabled"]:
            sets_parts.append("connected_at = ?")
            values.append(datetime.now().isoformat())
    if "name" in data:
        sets_parts.append("name = ?")
        values.append(data["name"])
    if not sets_parts:
        return False
    values.append(integration_id)
    conn.execute(f"UPDATE integrations SET {', '.join(sets_parts)} WHERE id = ?", values)
    conn.commit()
    return True


def list_available_providers():
    return DEFAULT_INTEGRATIONS
