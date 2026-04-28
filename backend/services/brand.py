import logging
from datetime import datetime
from backend.database import get_db
from backend.config import load_config, save_config

logger = logging.getLogger(__name__)

BRAND_FIELDS = [
    "name", "tagline", "mission", "vision", "values_text", "tone", "style_guide",
    "primary_color", "secondary_color", "accent_color", "font_primary", "font_secondary",
    "logo_url", "target_audience", "differentiators", "avoid_topics",
    "website", "instagram", "tiktok", "linkedin", "youtube", "active",
]


def list_brands(only_active: bool = False):
    conn = get_db()
    query = "SELECT id, " + ", ".join(BRAND_FIELDS) + ", created_at, updated_at FROM brand_profile"
    if only_active:
        query += " WHERE active = 1"
    query += " ORDER BY id DESC"
    rows = conn.execute(query).fetchall()
    cols = ["id"] + BRAND_FIELDS + ["created_at", "updated_at"]
    return [dict(zip(cols, r)) for r in rows]


def get_brand(brand_id: int):
    conn = get_db()
    row = conn.execute(
        "SELECT id, " + ", ".join(BRAND_FIELDS) + ", created_at, updated_at FROM brand_profile WHERE id = ?",
        (brand_id,),
    ).fetchone()
    if not row:
        return None
    cols = ["id"] + BRAND_FIELDS + ["created_at", "updated_at"]
    return dict(zip(cols, row))


def get_current_brand():
    config = load_config()
    bid = config.get("current_brand_id", 0)
    if bid:
        b = get_brand(bid)
        if b:
            return b
    brands = list_brands(only_active=True)
    return brands[0] if brands else None


def upsert_brand(data: dict) -> int:
    conn = get_db()
    bid = data.get("id")
    now = datetime.now().isoformat()
    if bid:
        fields = {k: v for k, v in data.items() if k in BRAND_FIELDS}
        if "active" in fields:
            fields["active"] = 1 if fields["active"] else 0
        if not fields:
            return int(bid)
        fields["updated_at"] = now
        sets = ", ".join(f"{k} = ?" for k in fields)
        conn.execute(f"UPDATE brand_profile SET {sets} WHERE id = ?", list(fields.values()) + [int(bid)])
        conn.commit()
        return int(bid)
    cols_to_insert = list(BRAND_FIELDS) + ["created_at", "updated_at"]
    values = []
    for c in cols_to_insert:
        if c in ("created_at", "updated_at"):
            values.append(now)
        elif c == "active":
            values.append(1 if data.get(c, True) else 0)
        else:
            values.append(data.get(c, ""))
    placeholders = ", ".join(["?"] * len(cols_to_insert))
    cur = conn.execute(f"INSERT INTO brand_profile ({', '.join(cols_to_insert)}) VALUES ({placeholders})", values)
    conn.commit()
    new_id = cur.lastrowid
    config = load_config()
    if not config.get("current_brand_id", 0):
        config["current_brand_id"] = new_id
        save_config(config)
    return new_id


def delete_brand(brand_id: int):
    conn = get_db()
    conn.execute("DELETE FROM brand_profile WHERE id = ?", (brand_id,))
    conn.commit()
    config = load_config()
    if config.get("current_brand_id") == brand_id:
        config["current_brand_id"] = 0
        save_config(config)


def set_current_brand(brand_id: int):
    config = load_config()
    config["current_brand_id"] = int(brand_id)
    b = get_brand(brand_id)
    if b:
        bits = []
        if b.get("name"): bits.append(f"Marca: {b['name']}")
        if b.get("tagline"): bits.append(b["tagline"])
        if b.get("mission"): bits.append(f"Misión: {b['mission']}")
        if b.get("tone"): bits.append(f"Tono: {b['tone']}")
        if b.get("target_audience"): bits.append(f"Audiencia: {b['target_audience']}")
        if b.get("differentiators"): bits.append(f"Diferenciadores: {b['differentiators']}")
        if b.get("avoid_topics"): bits.append(f"Evitar: {b['avoid_topics']}")
        config["brand_context"] = ". ".join(bits)[:1500]
    save_config(config)
