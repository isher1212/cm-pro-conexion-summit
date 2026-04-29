import logging
from backend.database import get_db
from backend.config import load_config, save_config, DEFAULT_CONFIG

logger = logging.getLogger(__name__)

DATA_TABLES_TO_CLEAR = [
    "articles", "trends", "content_proposals", "saved_items", "metrics", "posts", "events",
    "report_log", "image_library", "ai_usage_log", "notifications", "competitors", "competitor_posts",
    "sentiment_analyses", "speakers", "sponsors", "key_people",
    "summit_milestones", "event_goals", "event_editions", "post_comments",
]


def reset_for_new_brand(new_brand_data: dict, keep_config_keys: list = None) -> dict:
    if keep_config_keys is None:
        keep_config_keys = [
            "openai_api_key", "kie_ai_api_key", "kie_ai_model", "kie_ai_resolution",
            "email_sender", "email_sender_password", "email_recipient",
            "telegram_bot_token", "telegram_chat_id",
            "schedules", "active_platforms", "max_articles_per_feed", "max_articles_age_days",
            "max_trends_google", "max_trends_youtube", "max_trends_tiktok", "max_trends_linkedin",
            "count_articles_colombia", "count_articles_latam", "count_articles_global",
            "duplicate_window_days", "notification_score_threshold", "notify_on_new_trend",
            "monthly_report_day", "monthly_report_hour", "count_weekly_top_articles",
            "auto_publish_enabled", "auto_publish_platforms",
        ]
    conn = get_db()
    counts_before = {}
    for tbl in DATA_TABLES_TO_CLEAR:
        try:
            row = conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()
            counts_before[tbl] = row[0] if row else 0
        except Exception:
            counts_before[tbl] = 0
    for tbl in DATA_TABLES_TO_CLEAR:
        try:
            conn.execute(f"DELETE FROM {tbl}")
        except Exception as e:
            logger.warning(f"clear {tbl} failed: {e}")
    conn.commit()

    config = load_config()
    new_config = {k: config[k] for k in keep_config_keys if k in config}
    for k, v in DEFAULT_CONFIG.items():
        new_config.setdefault(k, v)

    from backend.services.brand import upsert_brand, set_current_brand
    new_id = upsert_brand({**new_brand_data, "active": True})
    new_config["current_brand_id"] = new_id
    save_config(new_config)
    set_current_brand(new_id)

    return {"status": "ok", "new_brand_id": new_id, "cleared": counts_before}
