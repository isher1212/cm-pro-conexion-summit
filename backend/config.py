import json
import os
from typing import Any
from backend.app_paths import get_user_data_dir


def _get_config_path() -> str:
    env = os.environ.get("CM_CONFIG_PATH")
    if env:
        return env
    return str(get_user_data_dir() / "config.json")

DEFAULT_CONFIG: dict[str, Any] = {
    "openai_api_key": "",
    "kie_ai_api_key": "",
    "kie_ai_model": "nano-banana-2",
    "kie_ai_resolution": "1K",
    "email_sender": "",
    "email_sender_password": "",
    "email_recipient": "",
    "telegram_bot_token": "",
    "telegram_chat_id": "",
    "google_drive_enabled": False,
    "instagram_api_key": "",
    "meta_access_token": "",
    "meta_ig_user_id": "",
    "meta_app_id": "",
    "meta_app_secret": "",
    "tiktok_api_key": "",
    "linkedin_api_key": "",
    "alert_threshold_pct": 20,
    "brand_context": "",
    "max_articles_per_feed": 10,
    "max_articles_age_days": 30,
    "max_trends_google": 5,
    "max_trends_youtube": 5,
    "count_articles_colombia": 5,
    "count_articles_latam": 5,
    "count_articles_global": 5,
    "trend_keywords_tiktok": ["tiktok viral", "trending tiktok"],
    "trend_keywords_linkedin": ["liderazgo empresarial", "tendencias laborales"],
    "max_trends_tiktok": 3,
    "max_trends_linkedin": 3,
    "count_weekly_top_articles": 5,
    "monthly_report_day": 1,
    "monthly_report_hour": 9,
    "duplicate_window_days": 7,
    "auto_publish_enabled": False,
    "auto_publish_platforms": ["Instagram"],
    "notification_score_threshold": 8,
    "notify_on_new_trend": True,
    "rss_sources": [
        {"name": "iNNpulsa Colombia", "url": "https://innpulsacolombia.com/feed", "active": True, "category": "Colombia"},
        {"name": "Endeavor Colombia", "url": "https://endeavor.org.co/feed", "active": True, "category": "Colombia"},
        {"name": "LAVCA", "url": "https://lavca.org/feed", "active": True, "category": "LATAM"},
        {"name": "Ruta N", "url": "https://www.rutanmedellin.org/feed", "active": True, "category": "Colombia"},
        {"name": "Wayra", "url": "https://wayra.com/feed", "active": True, "category": "LATAM"},
        {"name": "TechCrunch Español", "url": "https://techcrunch.com/feed/", "active": True, "category": "Global"},
    ],
    "google_news_keywords": [
        "innovación Colombia",
        "startups LATAM",
        "emprendimiento Colombia",
        "inversión startup Colombia",
        "ecosistema emprendedor",
    ],
    "content_pillars": [
        {
            "name": "Ecosistema Emprendedor LATAM",
            "description": "Noticias, datos y tendencias del ecosistema de startups en LATAM",
            "example": "Post sobre el estado del ecosistema startup en Colombia 2026",
            "weight": 3,
            "active": True,
        },
        {
            "name": "Conexiones Corporativo ↔ Startup",
            "description": "Historias y casos de alianzas entre grandes empresas y startups",
            "example": "Caso de éxito: cómo una startup resolvió un problema de una corporación",
            "weight": 3,
            "active": True,
        },
        {
            "name": "Speakers e Historias de Impacto",
            "description": "Contenido sobre los speakers, aliados y participantes del evento",
            "example": "Entrevista o quote de un speaker confirmado",
            "weight": 2,
            "active": True,
        },
        {
            "name": "Educación e Innovación",
            "description": "Contenido educativo sobre innovación, metodologías y tendencias",
            "example": "Qué es la innovación abierta y por qué importa",
            "weight": 2,
            "active": True,
        },
        {
            "name": "Behind the Scenes",
            "description": "Contenido interno: preparación del evento, equipo, proceso",
            "example": "Así preparamos la rueda de negocios del Summit",
            "weight": 1,
            "active": True,
        },
    ],
    "schedules": {
        "daily_email_hour": 7,
        "telegram_news_hour": 7,
        "telegram_trends_hour": 9,
        "weekly_email_day": "monday",
        "weekly_email_hour": 8,
        "weekly_telegram_hour": 8,
        "weekly_telegram_minute": 30,
    },
    "active_platforms": {
        "instagram": True,
        "tiktok": True,
        "linkedin": True,
    },
    "custom_metrics": [],
}


def load_config(path: str | None = None) -> dict[str, Any]:
    if path is None:
        path = _get_config_path()
    if not os.path.exists(path):
        return dict(DEFAULT_CONFIG)
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read().strip()
    if not raw:
        return dict(DEFAULT_CONFIG)
    stored = json.loads(raw)
    # Merge with defaults so new keys always exist
    merged = dict(DEFAULT_CONFIG)
    merged.update(stored)
    return merged


def save_config(cfg: dict[str, Any], path: str | None = None) -> None:
    if path is None:
        path = _get_config_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
