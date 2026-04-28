import sqlite3
import os
from backend.app_paths import get_user_data_dir


def _get_db_path() -> str:
    env = os.environ.get("CM_DB_PATH")
    if env:
        return env
    return str(get_user_data_dir() / "cm_pro.db")


def init_db(db_path: str | None = None) -> sqlite3.Connection:
    if db_path is None:
        db_path = _get_db_path()
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            source TEXT NOT NULL,
            url TEXT UNIQUE NOT NULL,
            summary TEXT,
            relevance TEXT,
            category TEXT,
            fetched_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS trends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            keyword TEXT NOT NULL,
            platform TEXT NOT NULL,
            description TEXT,
            why_trending TEXT,
            how_to_apply TEXT,
            post_idea TEXT,
            fetched_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            followers INTEGER,
            reach INTEGER,
            impressions INTEGER,
            likes INTEGER,
            comments INTEGER,
            shares INTEGER,
            engagement_rate REAL,
            recorded_at TEXT NOT NULL,
            week_label TEXT
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            post_description TEXT,
            published_at TEXT,
            reach INTEGER DEFAULT 0,
            impressions INTEGER DEFAULT 0,
            likes INTEGER DEFAULT 0,
            comments INTEGER DEFAULT 0,
            shares INTEGER DEFAULT 0,
            engagement_rate REAL DEFAULT 0.0,
            recorded_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS content_proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL,
            format TEXT,
            platform TEXT,
            suggested_date TEXT,
            caption_draft TEXT,
            hashtags TEXT,
            status TEXT DEFAULT 'proposed',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            description TEXT,
            event_type TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS report_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_type TEXT NOT NULL,
            channel TEXT NOT NULL,
            status TEXT NOT NULL,
            sent_at TEXT NOT NULL,
            error_message TEXT
        );
    """)
    conn.commit()
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_trends_day ON trends(keyword, platform, date(fetched_at))"
    )
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_week ON metrics(platform, week_label)"
    )
    conn.commit()
    # Phase 9 migration: image generation columns
    try:
        conn.execute("ALTER TABLE content_proposals ADD COLUMN image_urls TEXT DEFAULT '[]'")
        conn.commit()
    except Exception:
        pass  # column already exists
    try:
        conn.execute("ALTER TABLE content_proposals ADD COLUMN video_script TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass  # column already exists
    # Phase 10 migration: title_es column for articles
    try:
        conn.execute("ALTER TABLE articles ADD COLUMN title_es TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass
    # Phase 10 migration: saved_items table
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS saved_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type TEXT NOT NULL,
                title TEXT NOT NULL,
                url TEXT,
                summary TEXT,
                source TEXT,
                category TEXT,
                platform TEXT,
                saved_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    # Phase 11 migration: relevance_score on articles
    try:
        conn.execute("ALTER TABLE articles ADD COLUMN relevance_score INTEGER DEFAULT 0")
        conn.commit()
    except Exception:
        pass
    # Phase 11 migration: trend source URL
    try:
        conn.execute("ALTER TABLE trends ADD COLUMN source_url TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass
    return conn

_conn: sqlite3.Connection | None = None

def get_db() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = init_db()
    return _conn
