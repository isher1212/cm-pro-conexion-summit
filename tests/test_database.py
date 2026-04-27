import pytest
import sqlite3
import os
import tempfile
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

def test_database_creates_tables():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    try:
        from backend.database import init_db
        conn = init_db(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}
        assert "articles" in tables
        assert "trends" in tables
        assert "metrics" in tables
        assert "content_proposals" in tables
        assert "events" in tables
        assert "report_log" in tables
        conn.close()
    finally:
        os.unlink(db_path)

def test_database_articles_schema():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    try:
        from backend.database import init_db
        conn = init_db(db_path)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(articles)")
        columns = {row[1] for row in cursor.fetchall()}
        assert "id" in columns
        assert "title" in columns
        assert "source" in columns
        assert "url" in columns
        assert "summary" in columns
        assert "relevance" in columns
        assert "fetched_at" in columns
        conn.close()
    finally:
        os.unlink(db_path)
