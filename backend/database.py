import sqlite3
import os

DB_PATH = os.environ.get("CM_DB_PATH", "cm_pro.db")

def init_db(db_path: str = DB_PATH) -> sqlite3.Connection:
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
    return conn

_conn: sqlite3.Connection | None = None

def get_db() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = init_db()
    return _conn
