import logging
import re
import time
from datetime import datetime, timedelta
from typing import Any

import httpx

logger = logging.getLogger(__name__)

KIE_BASE = "https://api.kie.ai"
_ASPECT_RATIO = {
    "Instagram": "1:1",
    "TikTok": "9:16",
    "LinkedIn": "16:9",
    "YouTube": "16:9",
}


def get_aspect_ratio(platform: str) -> str:
    return _ASPECT_RATIO.get(platform, "1:1")


def get_youtube_thumbnail(url: str) -> str | None:
    """Extract YouTube thumbnail URL from a video URL. Returns None if not a YouTube URL."""
    if not url:
        return None
    m = re.search(r"(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})", url)
    if m:
        return f"https://img.youtube.com/vi/{m.group(1)}/hqdefault.jpg"
    return None


def build_image_prompt(
    topic: str,
    platform: str,
    caption: str,
    brand_context: str = "",
    extra_specs: str = "",
) -> str:
    parts = [
        f"Imagen profesional para redes sociales ({platform}) sobre: {topic}.",
        "Estilo moderno, corporativo, inspirador. Sin texto superpuesto.",
    ]
    if caption:
        parts.append(f"Contexto del post: {caption}")
    if brand_context:
        parts.append(f"Marca: {brand_context}")
    if extra_specs:
        parts.append(f"Especificaciones adicionales: {extra_specs}")
    return " ".join(parts)


def parse_task_works(data: dict) -> list[str]:
    if data.get("status") != "succeed":
        return []
    return [w["url"] for w in data.get("works", []) if w.get("url")]


def _create_task(
    prompt: str,
    model: str,
    resolution: str,
    aspect_ratio: str,
    api_key: str,
    image_input_urls: list[str] | None = None,
) -> str | None:
    body: dict = {
        "model": model,
        "prompt": prompt,
        "resolution": resolution,
        "aspect_ratio": aspect_ratio,
        "output_format": "JPG",
    }
    if image_input_urls:
        body["image_input"] = image_input_urls
    try:
        resp = httpx.post(
            f"{KIE_BASE}/api/v1/jobs/createTask",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=body,
            timeout=30,
        )
        if resp.status_code >= 400:
            logger.warning(f"Kie AI createTask HTTP {resp.status_code}")
            return None
        return resp.json().get("data", {}).get("taskId")
    except Exception as e:
        logger.warning(f"Kie AI createTask failed: {e}")
        return None


def _poll_task(task_id: str, api_key: str, timeout: int = 120) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            resp = httpx.get(
                f"{KIE_BASE}/api/v1/jobs/getTask",
                headers={"Authorization": f"Bearer {api_key}"},
                params={"taskId": task_id},
                timeout=15,
            )
            if resp.status_code >= 400:
                logger.warning(f"Kie AI getTask HTTP {resp.status_code} for task {task_id}")
                return {}
            data = resp.json().get("data", {})
            if data.get("status") in ("succeed", "failed"):
                return data
        except Exception as e:
            logger.warning(f"Kie AI poll error: {e}")
        time.sleep(3)
    return {}


def generate_images(
    topic: str,
    platform: str,
    caption: str,
    api_key: str,
    model: str = "nano-banana-2",
    resolution: str = "1K",
    extra_specs: str = "",
    brand_context: str = "",
    n: int = 1,
    image_input_urls: list[str] | None = None,
) -> list[str]:
    """Generate n images via Kie AI. Pass image_input_urls for image-to-image mode."""
    aspect_ratio = get_aspect_ratio(platform)
    all_urls: list[str] = []
    prompt = build_image_prompt(topic, platform, caption, brand_context, extra_specs)
    for _ in range(n):
        task_id = _create_task(prompt, model, resolution, aspect_ratio, api_key, image_input_urls)
        if not task_id:
            continue
        data = _poll_task(task_id, api_key)
        urls = parse_task_works(data)
        all_urls.extend(urls)
        # Phase 12: registrar en image_library
        if urls:
            try:
                from backend.database import get_db
                conn = get_db()
                for url in urls:
                    conn.execute(
                        """INSERT INTO image_library (url, prompt, platform, aspect_ratio, model, resolution, created_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?)""",
                        (url, prompt, platform, aspect_ratio, model, resolution, datetime.now().isoformat()),
                    )
                conn.commit()
            except Exception as e:
                logger.warning(f"image_library insert failed: {e}")
    return all_urls


def build_video_script_prompt(
    topic: str,
    platform: str,
    caption: str,
    hashtags: str,
    brand_context: str = "",
) -> str:
    context_line = f"\nContexto de marca: {brand_context}" if brand_context else ""
    return f"""Eres el estratega de contenido de Conexión Summit, plataforma de emprendimiento en LATAM.{context_line}

Crea un guión corto para un video de {platform} sobre: {topic}
Copy base: {caption}
Hashtags: {hashtags}

Responde EXACTAMENTE en este formato (sin texto adicional):

HOOK: [primera frase impactante, máx 2 líneas, engancha en los primeros 3 segundos]
DESARROLLO: [explicación del tema, 3-4 líneas, datos o historia concreta]
CTA: [llamada a la acción final, máx 1 línea]
VOZ_EN_OFF: [guión completo en prosa para leer en off, natural, máx 150 palabras]
DURACION: [duración sugerida en segundos, ej: 45]"""


def generate_video_script(
    topic: str,
    platform: str,
    caption: str,
    hashtags: str,
    openai_client: Any,
    brand_context: str = "",
) -> dict:
    result = {"hook": "", "desarrollo": "", "cta": "", "voz_en_off": "", "duracion": ""}
    if not openai_client:
        return result
    try:
        prompt = build_video_script_prompt(topic, platform, caption, hashtags, brand_context)
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600,
            temperature=0.5,
        )
        text = response.choices[0].message.content or ""
        for line in text.split("\n"):
            line = line.strip()
            if line.startswith("HOOK:"):
                result["hook"] = line.replace("HOOK:", "").strip()
            elif line.startswith("DESARROLLO:"):
                result["desarrollo"] = line.replace("DESARROLLO:", "").strip()
            elif line.startswith("CTA:"):
                result["cta"] = line.replace("CTA:", "").strip()
            elif line.startswith("VOZ_EN_OFF:"):
                result["voz_en_off"] = line.replace("VOZ_EN_OFF:", "").strip()
            elif line.startswith("DURACION:"):
                result["duracion"] = line.replace("DURACION:", "").strip()
    except Exception as e:
        logger.warning(f"Video script generation failed: {e}")
    return result


def build_article_proposal_prompt(
    title: str,
    summary: str,
    source: str,
    brand_context: str = "",
) -> str:
    context_line = f"\nContexto de marca: {brand_context}" if brand_context else ""
    suggested = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
    return f"""Eres el estratega de contenido de Conexión Summit, plataforma de emprendimiento en LATAM.{context_line}

Convierte este artículo de noticias en una propuesta de contenido para redes sociales:

TÍTULO: {title}
FUENTE: {source}
RESUMEN: {summary}

Responde EXACTAMENTE en este formato:

TOPIC: [tema principal adaptado a la marca, 1 línea]
FORMAT: [Reel|Carrusel|Post]
PLATFORM: [Instagram|LinkedIn|TikTok]
DATE: [{suggested}]
CAPTION: [caption borrador completo, máx 3 líneas, tono de Conexión Summit]
HASHTAGS: [#hashtag1 #hashtag2 #hashtag3 máx 5]"""


def generate_proposal_from_article(
    title: str,
    summary: str,
    source: str,
    openai_client: Any,
    brand_context: str = "",
) -> dict:
    result = {"topic": "", "format": "", "platform": "", "suggested_date": "", "caption_draft": "", "hashtags": ""}
    if not openai_client:
        return result
    try:
        prompt = build_article_proposal_prompt(title, summary, source, brand_context)
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.5,
        )
        text = response.choices[0].message.content or ""
        for line in text.split("\n"):
            line = line.strip()
            if line.startswith("TOPIC:"):
                result["topic"] = line.replace("TOPIC:", "").strip()
            elif line.startswith("FORMAT:"):
                result["format"] = line.replace("FORMAT:", "").strip()
            elif line.startswith("PLATFORM:"):
                result["platform"] = line.replace("PLATFORM:", "").strip()
            elif line.startswith("DATE:"):
                result["suggested_date"] = line.replace("DATE:", "").strip()
            elif line.startswith("CAPTION:"):
                result["caption_draft"] = line.replace("CAPTION:", "").strip()
            elif line.startswith("HASHTAGS:"):
                result["hashtags"] = line.replace("HASHTAGS:", "").strip()
    except Exception as e:
        logger.warning(f"Article-to-proposal generation failed: {e}")
    return result
