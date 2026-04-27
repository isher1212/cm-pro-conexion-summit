# tests/test_intelligence.py
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_parse_rss_returns_list_of_articles():
    from backend.services.intelligence import parse_rss_feed
    articles = parse_rss_feed("https://feeds.bbci.co.uk/news/technology/rss.xml", max_items=3)
    assert isinstance(articles, list)
    assert len(articles) <= 3
    if articles:
        assert "title" in articles[0]
        assert "url" in articles[0]
        assert "source" in articles[0]
        assert "published" in articles[0]


def test_parse_rss_returns_empty_on_bad_url():
    from backend.services.intelligence import parse_rss_feed
    articles = parse_rss_feed("https://this-url-does-not-exist-at-all.xyz/feed", max_items=5)
    assert articles == []


def test_build_summary_prompt_contains_article_title():
    from backend.services.intelligence import build_summary_prompt
    prompt = build_summary_prompt(
        title="Startup colombiana levanta $10M",
        content="Una startup de Medellín anunció una ronda de inversión...",
        source="iNNpulsa",
        brand_context="Conexión Summit conecta startups con corporativos en LATAM"
    )
    assert "Startup colombiana levanta $10M" in prompt
    assert "iNNpulsa" in prompt
    assert "Conexión Summit" in prompt


def test_article_is_stored_and_retrieved(tmp_path):
    from datetime import datetime
    from backend.database import init_db
    from backend.services.intelligence import store_article, get_articles

    db_path = str(tmp_path / "test.db")
    conn = init_db(db_path)

    article = {
        "title": "Test Article",
        "source": "Test Source",
        "url": "https://example.com/article-unique-123",
        "summary": "This is a summary",
        "relevance": "High relevance for Conexión Summit",
        "category": "Colombia",
        "fetched_at": datetime.now().isoformat(),
    }
    store_article(conn, article)
    articles = get_articles(conn, limit=10)
    assert len(articles) == 1
    assert articles[0]["title"] == "Test Article"
    assert articles[0]["url"] == "https://example.com/article-unique-123"
    conn.close()


def test_duplicate_article_is_not_stored_twice(tmp_path):
    from datetime import datetime
    from backend.database import init_db
    from backend.services.intelligence import store_article, get_articles

    db_path = str(tmp_path / "test.db")
    conn = init_db(db_path)

    article = {
        "title": "Duplicate Article",
        "source": "Test",
        "url": "https://example.com/duplicate-999",
        "summary": "Summary",
        "relevance": "Relevant",
        "category": "LATAM",
        "fetched_at": datetime.now().isoformat(),
    }
    store_article(conn, article)
    store_article(conn, article)
    articles = get_articles(conn, limit=10)
    assert len(articles) == 1
    conn.close()


def test_get_articles_endpoint_returns_list():
    import os, tempfile
    tmp = os.path.join(tempfile.gettempdir(), "test_intel_cfg.json")
    if os.path.exists(tmp): os.unlink(tmp)
    os.environ["CM_CONFIG_PATH"] = tmp
    from fastapi.testclient import TestClient
    # Force fresh import
    import importlib, backend.main as m
    importlib.reload(m)
    from backend.main import app
    client = TestClient(app)
    response = client.get("/api/intelligence/articles")
    assert response.status_code == 200
    data = response.json()
    assert "articles" in data
    assert isinstance(data["articles"], list)
    assert "total" in data


def test_get_articles_with_search_filter():
    import os, tempfile
    tmp = os.path.join(tempfile.gettempdir(), "test_intel_search_cfg.json")
    if os.path.exists(tmp): os.unlink(tmp)
    os.environ["CM_CONFIG_PATH"] = tmp
    from fastapi.testclient import TestClient
    from backend.main import app
    client = TestClient(app)
    response = client.get("/api/intelligence/articles?search=startup")
    assert response.status_code == 200
    data = response.json()
    assert "articles" in data


def test_refresh_endpoint_exists():
    import os, tempfile
    tmp = os.path.join(tempfile.gettempdir(), "test_intel_refresh_cfg.json")
    if os.path.exists(tmp): os.unlink(tmp)
    os.environ["CM_CONFIG_PATH"] = tmp
    from fastapi.testclient import TestClient
    from backend.main import app
    client = TestClient(app)
    response = client.post("/api/intelligence/refresh")
    assert response.status_code == 200
    data = response.json()
    assert "new_articles" in data
