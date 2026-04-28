import json
import logging
import time
from datetime import datetime
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.facebook.com/v19.0"


def publish_to_instagram(image_url: str, caption: str, ig_user_id: str, access_token: str) -> dict:
    """
    Publica una imagen en Instagram via Meta Graph API.
    Two-step: create container -> publish container.
    """
    if not (image_url and ig_user_id and access_token):
        return {"status": "error", "error": "faltan parámetros (image_url, ig_user_id o access_token)"}
    try:
        r1 = httpx.post(
            f"{GRAPH_BASE}/{ig_user_id}/media",
            data={
                "image_url": image_url,
                "caption": caption[:2200] if caption else "",
                "access_token": access_token,
            },
            timeout=30,
        )
        if r1.status_code >= 400:
            return {"status": "error", "error": f"create container failed: {r1.text[:200]}"}
        container_id = r1.json().get("id")
        if not container_id:
            return {"status": "error", "error": "no container id"}

        time.sleep(2)
        r2 = httpx.post(
            f"{GRAPH_BASE}/{ig_user_id}/media_publish",
            data={"creation_id": container_id, "access_token": access_token},
            timeout=30,
        )
        if r2.status_code >= 400:
            return {"status": "error", "error": f"publish failed: {r2.text[:200]}"}
        media_id = r2.json().get("id")
        return {"status": "ok", "media_id": media_id, "url": f"https://www.instagram.com/p/{media_id}"}
    except Exception as e:
        logger.warning(f"publish_to_instagram failed: {e}")
        return {"status": "error", "error": str(e)}


def publish_proposal(conn, proposal_id: int, config: dict) -> dict:
    """Publica una propuesta en su plataforma. Marca como publicada."""
    row = conn.execute(
        "SELECT id, topic, platform, caption_draft, hashtags, image_urls, status, auto_publish FROM content_proposals WHERE id = ?",
        (proposal_id,),
    ).fetchone()
    if not row:
        return {"status": "error", "error": "propuesta no encontrada"}
    pid, topic, platform, caption, hashtags, image_urls_json, status, auto_publish = row

    if status == "published":
        return {"status": "skipped", "reason": "ya publicada"}

    try:
        urls = json.loads(image_urls_json) if image_urls_json else []
    except Exception:
        urls = []
    if not urls:
        return {"status": "error", "error": "propuesta sin imagen"}

    full_caption = (caption or "") + ("\n\n" + hashtags if hashtags else "")
    plat = (platform or "").lower()

    if plat == "instagram":
        result = publish_to_instagram(
            image_url=urls[0],
            caption=full_caption,
            ig_user_id=config.get("meta_ig_user_id", ""),
            access_token=config.get("meta_access_token", ""),
        )
    else:
        try:
            from backend.services.notifications import create_notification
            create_notification(
                type="manual_publish_required",
                title=f"Publicar manualmente en {platform}",
                message=topic or "",
                item_type="proposal",
                item_id=pid,
            )
        except Exception:
            pass
        return {"status": "manual", "reason": f"{platform} requiere publicación manual"}

    if result.get("status") == "ok":
        try:
            conn.execute(
                "UPDATE content_proposals SET status = 'published', published_at = ?, published_url = ? WHERE id = ?",
                (datetime.now().isoformat(), result.get("url", ""), pid),
            )
            conn.commit()
            from backend.services.notifications import create_notification
            create_notification(
                type="auto_published",
                title=f"Publicado en {platform}",
                message=topic or "",
                item_type="proposal",
                item_id=pid,
            )
        except Exception as e:
            logger.warning(f"failed to mark published: {e}")
    return result


def run_auto_publish_cycle(conn, config: dict) -> dict:
    """Job programado: publica propuestas auto_publish=1, status=approved, fecha <= hoy."""
    if not config.get("auto_publish_enabled", False):
        return {"status": "skipped", "reason": "auto-publicación deshabilitada globalmente"}
    today = datetime.now().strftime("%Y-%m-%d")
    rows = conn.execute(
        """SELECT id FROM content_proposals
           WHERE auto_publish = 1 AND status = 'approved' AND suggested_date <= ?""",
        (today,),
    ).fetchall()
    published = 0
    errors = []
    for r in rows:
        result = publish_proposal(conn, r[0], config)
        if result.get("status") == "ok":
            published += 1
        elif result.get("status") not in ("skipped", "manual"):
            errors.append({"id": r[0], "error": result.get("error")})
    return {"status": "ok", "published": published, "errors": errors, "total_pending": len(rows)}
