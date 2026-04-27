import pytest
import json
import os
import tempfile
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

def test_config_loads_defaults_when_no_file():
    from backend.config import load_config
    cfg = load_config("/nonexistent/path/config.json")
    assert cfg["openai_api_key"] == ""
    assert cfg["email_sender"] == ""
    assert cfg["telegram_bot_token"] == ""
    assert isinstance(cfg["rss_sources"], list)
    assert isinstance(cfg["content_pillars"], list)
    assert isinstance(cfg["schedules"], dict)
    assert len(cfg["content_pillars"]) > 0

def test_config_saves_and_reloads():
    from backend.config import load_config, save_config
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
        path = f.name
    try:
        cfg = load_config(path)
        cfg["openai_api_key"] = "sk-test-123"
        save_config(cfg, path)
        reloaded = load_config(path)
        assert reloaded["openai_api_key"] == "sk-test-123"
    finally:
        os.unlink(path)

def test_config_rss_sources_have_required_fields():
    from backend.config import load_config
    cfg = load_config("/nonexistent/path/config.json")
    for source in cfg["rss_sources"]:
        assert "name" in source
        assert "url" in source
        assert "active" in source
        assert "category" in source

def test_config_schedules_have_all_keys():
    from backend.config import load_config
    cfg = load_config("/nonexistent/path/config.json")
    schedules = cfg["schedules"]
    assert "daily_email_hour" in schedules
    assert "telegram_news_hour" in schedules
    assert "telegram_trends_hour" in schedules
    assert "weekly_email_day" in schedules
    assert "weekly_email_hour" in schedules
