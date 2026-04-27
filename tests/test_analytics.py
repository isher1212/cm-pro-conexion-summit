# tests/test_analytics.py
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_store_and_retrieve_metrics(tmp_path):
    from datetime import datetime
    from backend.database import init_db
    from backend.services.analytics import store_metrics, get_weekly_summary

    conn = init_db(str(tmp_path / "test.db"))
    metrics = {
        "platform": "Instagram",
        "followers": 5000,
        "reach": 12000,
        "impressions": 18000,
        "likes": 800,
        "comments": 120,
        "shares": 60,
        "engagement_rate": 8.2,
        "recorded_at": datetime.now().isoformat(),
        "week_label": "2026-W17",
    }
    store_metrics(conn, metrics)
    summary = get_weekly_summary(conn)
    assert any(m["platform"] == "Instagram" for m in summary)
    ig = next(m for m in summary if m["platform"] == "Instagram")
    assert ig["followers"] == 5000
    conn.close()


def test_duplicate_week_metrics_upserts(tmp_path):
    from datetime import datetime
    from backend.database import init_db
    from backend.services.analytics import store_metrics, get_metrics

    conn = init_db(str(tmp_path / "test.db"))
    base = {
        "platform": "TikTok",
        "followers": 3000,
        "reach": 5000,
        "impressions": 7000,
        "likes": 400,
        "comments": 50,
        "shares": 30,
        "engagement_rate": 6.5,
        "recorded_at": datetime.now().isoformat(),
        "week_label": "2026-W17",
    }
    store_metrics(conn, base)
    updated = {**base, "followers": 3200, "engagement_rate": 7.1}
    store_metrics(conn, updated)
    history = get_metrics(conn, platform="TikTok", limit=10)
    assert len(history) == 1
    assert history[0]["followers"] == 3200
    conn.close()


def test_detect_anomaly_drop(tmp_path):
    from backend.database import init_db
    from backend.services.analytics import detect_anomaly

    conn = init_db(str(tmp_path / "test.db"))
    conn.execute(
        """INSERT INTO metrics (platform, followers, reach, impressions, likes, comments, shares,
           engagement_rate, recorded_at, week_label) VALUES (?,?,?,?,?,?,?,?,?,?)""",
        ("Instagram", 5000, 10000, 15000, 600, 80, 40, 8.0, "2026-04-14T10:00:00", "2026-W15"),
    )
    conn.execute(
        """INSERT INTO metrics (platform, followers, reach, impressions, likes, comments, shares,
           engagement_rate, recorded_at, week_label) VALUES (?,?,?,?,?,?,?,?,?,?)""",
        ("Instagram", 5100, 10000, 15000, 400, 40, 20, 4.0, "2026-04-21T10:00:00", "2026-W16"),
    )
    conn.commit()
    result = detect_anomaly(conn, "Instagram", threshold_pct=20)
    assert result["has_anomaly"] is True
    assert result["direction"] == "drop"
    conn.close()


def test_detect_no_anomaly(tmp_path):
    from backend.database import init_db
    from backend.services.analytics import detect_anomaly

    conn = init_db(str(tmp_path / "test.db"))
    conn.execute(
        """INSERT INTO metrics (platform, followers, reach, impressions, likes, comments, shares,
           engagement_rate, recorded_at, week_label) VALUES (?,?,?,?,?,?,?,?,?,?)""",
        ("Instagram", 5000, 10000, 15000, 600, 80, 40, 8.0, "2026-04-14T10:00:00", "2026-W15"),
    )
    conn.execute(
        """INSERT INTO metrics (platform, followers, reach, impressions, likes, comments, shares,
           engagement_rate, recorded_at, week_label) VALUES (?,?,?,?,?,?,?,?,?,?)""",
        ("Instagram", 5100, 10000, 15000, 620, 82, 41, 8.3, "2026-04-21T10:00:00", "2026-W16"),
    )
    conn.commit()
    result = detect_anomaly(conn, "Instagram", threshold_pct=20)
    assert result["has_anomaly"] is False
    conn.close()


def test_store_and_retrieve_post(tmp_path):
    from datetime import datetime
    from backend.database import init_db
    from backend.services.analytics import store_post, get_posts

    conn = init_db(str(tmp_path / "test.db"))
    post = {
        "platform": "Instagram",
        "post_description": "Lanzamiento alianza startup-corporativo",
        "published_at": "2026-04-20T14:00:00",
        "reach": 4500,
        "impressions": 6000,
        "likes": 310,
        "comments": 45,
        "shares": 22,
        "engagement_rate": 8.4,
        "recorded_at": datetime.now().isoformat(),
    }
    store_post(conn, post)
    posts = get_posts(conn, platform="Instagram", limit=10)
    assert len(posts) == 1
    assert posts[0]["post_description"] == "Lanzamiento alianza startup-corporativo"
    conn.close()


def test_get_metrics_empty_returns_list(tmp_path):
    from backend.database import init_db
    from backend.services.analytics import get_metrics

    conn = init_db(str(tmp_path / "test.db"))
    result = get_metrics(conn, platform="LinkedIn", limit=10)
    assert result == []
    conn.close()
