# tests/test_reports.py
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_log_and_retrieve_report(tmp_path):
    from datetime import datetime
    from backend.database import init_db
    from backend.services.reports import log_report, get_report_log

    conn = init_db(str(tmp_path / "test.db"))
    log_report(conn, report_type="daily_email", channel="email", status="sent")
    log_report(conn, report_type="daily_telegram", channel="telegram", status="sent")
    log = get_report_log(conn, limit=10)
    assert len(log) == 2
    assert log[0]["report_type"] in ("daily_telegram", "daily_email")
    conn.close()


def test_log_report_with_error(tmp_path):
    from backend.database import init_db
    from backend.services.reports import log_report, get_report_log

    conn = init_db(str(tmp_path / "test.db"))
    log_report(conn, report_type="weekly_email", channel="email", status="error", error_message="SMTP auth failed")
    log = get_report_log(conn, limit=10)
    assert len(log) == 1
    assert log[0]["status"] == "error"
    assert "SMTP" in log[0]["error_message"]
    conn.close()


def test_build_daily_email_contains_sections():
    from backend.services.reports import build_daily_email

    articles = [
        {"title": "Colombia lidera startups", "source": "iNNpulsa", "summary": "Resumen breve", "url": "https://example.com", "relevance": "Alta"}
    ]
    trends = [
        {"keyword": "IA en startups", "platform": "Google Trends", "how_to_apply": "Aplicar a Conexión Summit", "post_idea": "Post idea concreta"}
    ]
    html = build_daily_email(articles=articles, trends=trends, anomalies=[])
    assert "Colombia lidera startups" in html
    assert "IA en startups" in html
    assert "<html" in html.lower() or "<!DOCTYPE" in html.lower() or "<div" in html.lower()


def test_build_weekly_email_contains_sections():
    from backend.services.reports import build_weekly_email

    html = build_weekly_email(
        articles=[{"title": "Noticia semanal", "source": "Wayra", "summary": "Resumen", "url": "https://example.com", "relevance": "Alta"}],
        trends=[{"keyword": "emprendimiento", "platform": "Google Trends", "how_to_apply": "Aplica bien", "post_idea": "Post semanal"}],
        metrics_summary=[{"platform": "Instagram", "followers": 5000, "engagement_rate": 8.0, "week_label": "2026-W17"}],
        proposals=[{"topic": "Propuesta semanal", "platform": "Instagram", "format": "Carrusel", "suggested_date": "2026-05-10", "caption_draft": "Caption"}],
        anomalies=[],
    )
    assert "Noticia semanal" in html
    assert "emprendimiento" in html
    assert "Instagram" in html


def test_build_telegram_message_length():
    from backend.services.reports import build_telegram_intelligence_message

    articles = [
        {"title": f"Artículo {i}", "source": "iNNpulsa", "summary": "Resumen corto", "url": "https://example.com", "relevance": "Alta"}
        for i in range(5)
    ]
    msg = build_telegram_intelligence_message(articles)
    assert len(msg) <= 4096
    assert "Artículo" in msg


def test_get_report_log_empty(tmp_path):
    from backend.database import init_db
    from backend.services.reports import get_report_log

    conn = init_db(str(tmp_path / "test.db"))
    assert get_report_log(conn) == []
    conn.close()
