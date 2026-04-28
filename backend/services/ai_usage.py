import logging
from datetime import datetime
from backend.database import get_db

logger = logging.getLogger(__name__)

# Pricing approx (USD)
PRICING = {
    "gpt-4o-mini": {"in": 0.15 / 1_000_000, "out": 0.60 / 1_000_000},
    "gpt-4o": {"in": 2.50 / 1_000_000, "out": 10.00 / 1_000_000},
    "kie-nano-banana-2-1k": {"per_image": 0.04},
    "kie-nano-banana-2-2k": {"per_image": 0.06},
    "kie-nano-banana-2-4k": {"per_image": 0.09},
}


def log_openai_usage(model: str, response, context: str = ""):
    """Llama después de cada llamada OpenAI para registrar uso."""
    try:
        usage = getattr(response, "usage", None)
        if not usage:
            return
        tokens_in = getattr(usage, "prompt_tokens", 0) or 0
        tokens_out = getattr(usage, "completion_tokens", 0) or 0
        pricing = PRICING.get(model, {"in": 0, "out": 0})
        cost = tokens_in * pricing.get("in", 0) + tokens_out * pricing.get("out", 0)
        conn = get_db()
        conn.execute(
            """INSERT INTO ai_usage_log (service, model, tokens_in, tokens_out, cost_usd, context, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            ("openai", model, tokens_in, tokens_out, cost, context, datetime.now().isoformat()),
        )
        conn.commit()
    except Exception as e:
        logger.warning(f"log_openai_usage failed: {e}")


def log_kie_usage(model: str, resolution: str, n_images: int, context: str = ""):
    try:
        key = f"kie-{model}-{resolution.lower()}"
        pricing = PRICING.get(key, {"per_image": 0.04})
        cost = pricing["per_image"] * n_images
        conn = get_db()
        conn.execute(
            """INSERT INTO ai_usage_log (service, model, tokens_in, tokens_out, cost_usd, context, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            ("kie_ai", model, 0, n_images, cost, context, datetime.now().isoformat()),
        )
        conn.commit()
    except Exception as e:
        logger.warning(f"log_kie_usage failed: {e}")
