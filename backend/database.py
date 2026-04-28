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
    # Phase 12 migrations
    try:
        conn.execute("ALTER TABLE content_proposals ADD COLUMN order_index INTEGER DEFAULT 0")
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE content_proposals ADD COLUMN content_hash TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE articles ADD COLUMN content_hash TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE trends ADD COLUMN content_hash TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS image_library (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                prompt TEXT,
                platform TEXT,
                aspect_ratio TEXT,
                model TEXT,
                resolution TEXT,
                proposal_id INTEGER,
                tags TEXT DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_usage_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service TEXT NOT NULL,
                model TEXT,
                tokens_in INTEGER DEFAULT 0,
                tokens_out INTEGER DEFAULT 0,
                cost_usd REAL DEFAULT 0,
                context TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    # Phase 13 migrations
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT,
                item_type TEXT,
                item_id INTEGER,
                read_at TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE content_proposals ADD COLUMN auto_publish INTEGER DEFAULT 0")
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE content_proposals ADD COLUMN published_at TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE content_proposals ADD COLUMN published_url TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass
    # Phase 14 migrations
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS competitors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                scope TEXT NOT NULL DEFAULT 'national',
                category TEXT,
                instagram_handle TEXT,
                linkedin_handle TEXT,
                website TEXT,
                notes TEXT,
                active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS competitor_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                competitor_id INTEGER NOT NULL,
                platform TEXT,
                post_url TEXT,
                content TEXT,
                likes INTEGER DEFAULT 0,
                comments INTEGER DEFAULT 0,
                posted_at TEXT,
                captured_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS copy_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                pillar TEXT,
                variables TEXT DEFAULT '[]',
                tags TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT
            )
        """)
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sentiment_analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT,
                post_id INTEGER,
                positive_count INTEGER DEFAULT 0,
                neutral_count INTEGER DEFAULT 0,
                negative_count INTEGER DEFAULT 0,
                summary TEXT,
                top_themes TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    # Phase 15 migrations — Summit hub
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS event_editions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                year INTEGER NOT NULL UNIQUE,
                theme TEXT,
                date_start TEXT,
                date_end TEXT,
                location TEXT,
                description TEXT,
                summary_post_event TEXT,
                attendees_count INTEGER DEFAULT 0,
                satisfaction_score REAL DEFAULT 0,
                notes TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS speakers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                edition_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                bio TEXT,
                photo_url TEXT,
                role TEXT,
                company TEXT,
                talk_title TEXT,
                instagram TEXT,
                linkedin TEXT,
                twitter TEXT,
                website TEXT,
                notes TEXT,
                confirmed INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sponsors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                edition_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                tier TEXT DEFAULT 'partner',
                logo_url TEXT,
                contact_name TEXT,
                contact_email TEXT,
                agreement_value REAL DEFAULT 0,
                deliverables TEXT,
                notes TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS key_people (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                edition_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                role TEXT,
                bio TEXT,
                photo_url TEXT,
                contact TEXT,
                notes TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS summit_milestones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                edition_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                phase TEXT DEFAULT 'pre',
                date TEXT,
                description TEXT,
                completed INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS event_goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                edition_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                target_value REAL DEFAULT 0,
                current_value REAL DEFAULT 0,
                unit TEXT,
                deadline TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS post_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                external_id TEXT,
                author TEXT,
                content TEXT,
                created_at TEXT
            )
        """)
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE posts ADD COLUMN external_id TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass
    # Phase 16 migrations
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS brand_profile (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                tagline TEXT,
                mission TEXT,
                vision TEXT,
                values_text TEXT,
                tone TEXT,
                style_guide TEXT,
                primary_color TEXT,
                secondary_color TEXT,
                accent_color TEXT,
                font_primary TEXT,
                font_secondary TEXT,
                logo_url TEXT,
                target_audience TEXT,
                differentiators TEXT,
                avoid_topics TEXT,
                website TEXT,
                instagram TEXT,
                tiktok TEXT,
                linkedin TEXT,
                youtube TEXT,
                active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT
            )
        """)
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS team_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT,
                role TEXT DEFAULT 'editor',
                avatar_url TEXT,
                phone TEXT,
                notes TEXT,
                active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS integrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                provider TEXT NOT NULL,
                config_json TEXT DEFAULT '{}',
                enabled INTEGER DEFAULT 0,
                connected_at TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
    except Exception:
        pass
    # Phase 18 migration
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sync_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status TEXT NOT NULL DEFAULT 'running',
                progress_pct INTEGER DEFAULT 0,
                current_step TEXT DEFAULT '',
                step_index INTEGER DEFAULT 0,
                total_steps INTEGER DEFAULT 0,
                results_json TEXT DEFAULT '{}',
                error_message TEXT,
                cancelled INTEGER DEFAULT 0,
                started_at TEXT NOT NULL,
                finished_at TEXT
            )
        """)
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
