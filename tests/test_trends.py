# tests/test_trends.py
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_build_trend_prompt_contains_keyword():
    from backend.services.trends import build_trend_prompt
    prompt = build_trend_prompt(
        keyword="inteligencia artificial startups",
        platform="Google Trends",
        brand_context="Conexión Summit conecta startups con corporativos en LATAM"
    )
    assert "inteligencia artificial startups" in prompt
    assert "Conexión Summit" in prompt
    assert "Google Trends" in prompt


def test_trend_is_stored_and_retrieved(tmp_path):
    from datetime import datetime
    from backend.database import init_db
    from backend.services.trends import store_trend, get_trends

    db_path = str(tmp_path / "test.db")
    conn = init_db(db_path)

    trend = {
        "keyword": "IA en emprendimiento",
        "platform": "Google Trends",
        "description": "La IA está revolucionando startups LATAM",
        "why_trending": "Lanzamiento de herramientas IA para pymes",
        "how_to_apply": "Post sobre cómo startups usan IA",
        "post_idea": "5 herramientas IA que todo emprendedor debe conocer",
        "fetched_at": datetime.now().isoformat(),
    }
    store_trend(conn, trend)
    trends = get_trends(conn, limit=10)
    assert len(trends) == 1
    assert trends[0]["keyword"] == "IA en emprendimiento"
    conn.close()


def test_duplicate_trend_keyword_same_day_not_stored_twice(tmp_path):
    from datetime import datetime
    from backend.database import init_db
    from backend.services.trends import store_trend, get_trends

    db_path = str(tmp_path / "test.db")
    conn = init_db(db_path)
    today = datetime.now().strftime("%Y-%m-%d")

    trend = {
        "keyword": "emprendimiento sostenible",
        "platform": "Google Trends",
        "description": "desc",
        "why_trending": "why",
        "how_to_apply": "how",
        "post_idea": "idea",
        "fetched_at": f"{today}T10:00:00",
    }
    store_trend(conn, trend)
    store_trend(conn, trend)
    trends = get_trends(conn, limit=10)
    assert len(trends) == 1
    conn.close()


def test_fetch_google_trends_returns_list():
    from backend.services.trends import fetch_google_trends
    # Uses pytrends with a broad keyword — may return empty if rate limited
    keywords = ["startup", "innovación"]
    results = fetch_google_trends(keywords, geo="CO")
    assert isinstance(results, list)
    # Each item must have keyword field if any results
    for item in results:
        assert "keyword" in item
        assert "platform" in item


def test_get_trends_returns_empty_when_no_data(tmp_path):
    from backend.database import init_db
    from backend.services.trends import get_trends

    db_path = str(tmp_path / "test.db")
    conn = init_db(db_path)
    trends = get_trends(conn, limit=10)
    assert trends == []
    conn.close()


def test_trends_api_returns_list():
    import os, tempfile
    tmp = os.path.join(tempfile.gettempdir(), "test_trends_cfg.json")
    if os.path.exists(tmp): os.unlink(tmp)
    os.environ["CM_CONFIG_PATH"] = tmp
    from fastapi.testclient import TestClient
    import importlib
    import backend.main
    importlib.reload(backend.main)
    from backend.main import app
    client = TestClient(app)
    response = client.get("/api/trends")
    assert response.status_code == 200
    data = response.json()
    assert "trends" in data
    assert "total" in data
    assert isinstance(data["trends"], list)


def test_trends_refresh_endpoint():
    import os, tempfile
    tmp = os.path.join(tempfile.gettempdir(), "test_trends_refresh_cfg.json")
    if os.path.exists(tmp): os.unlink(tmp)
    os.environ["CM_CONFIG_PATH"] = tmp
    from fastapi.testclient import TestClient
    from backend.main import app
    client = TestClient(app)
    response = client.post("/api/trends/refresh")
    assert response.status_code == 200
    data = response.json()
    assert "new_trends" in data
