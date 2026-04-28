import csv
import io
import logging
from datetime import datetime
from backend.database import get_db

logger = logging.getLogger(__name__)


def import_comments_csv(csv_text: str) -> dict:
    """
    Importa comentarios de un CSV con cabeceras flexibles.
    Acepta: post_id/media_id, external_id/media_external_id/ig_post_id,
            text/comment/content/comentario, author/username/user, date/timestamp/created_at/fecha
    """
    conn = get_db()
    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames:
        return {"error": "CSV sin cabeceras"}

    headers = {h.strip().lower(): h for h in reader.fieldnames if h}
    def find(*opts):
        for o in opts:
            if o in headers:
                return headers[o]
        return None

    h_post = find("post_id", "post id", "media_id", "post")
    h_ext = find("external_id", "media_external_id", "ig_post_id", "post_external_id")
    h_text = find("text", "comment", "content", "comentario")
    h_author = find("author", "username", "user", "from")
    h_date = find("date", "timestamp", "created_at", "fecha")

    if not h_text:
        return {"error": "El CSV debe tener columna 'text', 'comment', 'content' o 'comentario'"}

    inserted = 0
    skipped = 0
    for row in reader:
        text = (row.get(h_text) or "").strip()
        if not text:
            skipped += 1
            continue
        post_id = 0
        if h_post and row.get(h_post):
            try:
                post_id = int(row.get(h_post))
            except Exception:
                pass
        elif h_ext and row.get(h_ext):
            ext = row.get(h_ext)
            r = conn.execute("SELECT id FROM posts WHERE external_id = ?", (ext,)).fetchone()
            if r:
                post_id = r[0]
        if not post_id:
            cur = conn.execute(
                """INSERT INTO posts (platform, post_description, recorded_at, external_id)
                   VALUES (?, ?, ?, ?)""",
                ("Instagram", "(post importado desde CSV)", datetime.now().isoformat(),
                 row.get(h_ext) if h_ext else ""),
            )
            post_id = cur.lastrowid
            conn.commit()
        author = (row.get(h_author) or "").strip() if h_author else ""
        date = (row.get(h_date) or "").strip() if h_date else ""
        try:
            conn.execute(
                """INSERT INTO post_comments (post_id, external_id, author, content, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (post_id, row.get(h_ext, "") if h_ext else "", author, text, date or datetime.now().isoformat()),
            )
            inserted += 1
        except Exception as e:
            logger.warning(f"insert comment failed: {e}")
            skipped += 1
    conn.commit()
    return {"status": "ok", "inserted": inserted, "skipped": skipped}
