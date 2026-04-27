import io
import csv
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_db
from backend.services.instagram_import import parse_instagram_account_csv, parse_instagram_posts_csv

client = TestClient(app)


def _make_account_csv(rows: list[dict]) -> str:
    if not rows:
        return ""
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=rows[0].keys())
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue()


def test_parse_account_csv_standard_columns():
    csv_data = _make_account_csv([
        {"Date": "2026-04-21", "Followers": "6200", "Reach": "15000", "Impressions": "48000", "Profile Views": "320"},
        {"Date": "2026-04-14", "Followers": "6050", "Reach": "13500", "Impressions": "42000", "Profile Views": "280"},
    ])
    rows = parse_instagram_account_csv(csv_data)
    assert len(rows) == 2
    assert rows[0]["platform"] == "instagram"
    assert rows[0]["followers"] == 6200
    assert rows[0]["reach"] == 15000
    assert rows[0]["impressions"] == 48000


def test_parse_account_csv_alternate_columns():
    csv_data = _make_account_csv([
        {"Fecha": "2026-04-21", "Seguidores": "6200", "Alcance": "15000", "Impresiones": "48000"},
    ])
    rows = parse_instagram_account_csv(csv_data)
    assert len(rows) == 1
    assert rows[0]["followers"] == 6200


def test_parse_account_csv_missing_optional_columns():
    csv_data = _make_account_csv([
        {"Date": "2026-04-21", "Followers": "5800"},
    ])
    rows = parse_instagram_account_csv(csv_data)
    assert len(rows) == 1
    assert rows[0]["followers"] == 5800
    assert rows[0]["reach"] == 0


def test_parse_posts_csv_standard_columns():
    csv_data = _make_account_csv([
        {"Description": "Post 1", "Permalink": "https://ig.com/p/abc", "Date": "2026-04-20",
         "Likes": "320", "Comments": "45", "Saves": "80", "Shares": "12",
         "Reach": "4200", "Impressions": "5100"},
    ])
    rows = parse_instagram_posts_csv(csv_data)
    assert len(rows) == 1
    assert rows[0]["platform"] == "instagram"
    assert rows[0]["likes"] == 320
    assert rows[0]["reach"] == 4200


def test_parse_posts_csv_empty():
    rows = parse_instagram_posts_csv("")
    assert rows == []


def test_parse_account_csv_empty():
    rows = parse_instagram_account_csv("")
    assert rows == []


from backend.services.instagram_api import (
    is_meta_configured, get_meta_status, fetch_meta_account_metrics,
)


def test_meta_not_configured_when_no_token():
    config = {}
    assert is_meta_configured(config) is False


def test_meta_configured_when_token_present():
    config = {"meta_access_token": "abc123", "meta_ig_user_id": "12345678"}
    assert is_meta_configured(config) is True


def test_get_meta_status_not_configured():
    config = {}
    status = get_meta_status(config)
    assert status["configured"] is False
    assert status["status"] == "not_configured"


def test_fetch_meta_account_metrics_not_configured():
    config = {}
    result = fetch_meta_account_metrics(config)
    assert result is None
