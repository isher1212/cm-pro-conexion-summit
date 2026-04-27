# tests/test_planner.py
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_store_and_retrieve_event(tmp_path):
    from datetime import datetime
    from backend.database import init_db
    from backend.services.planner import store_event, get_events

    conn = init_db(str(tmp_path / "test.db"))
    event = {
        "title": "Demo día con Endeavor",
        "date": "2026-05-10",
        "description": "Presentación de startups seleccionadas",
        "event_type": "alianza",
        "created_at": datetime.now().isoformat(),
    }
    store_event(conn, event)
    events = get_events(conn, limit=10)
    assert len(events) == 1
    assert events[0]["title"] == "Demo día con Endeavor"
    conn.close()


def test_delete_event(tmp_path):
    from datetime import datetime
    from backend.database import init_db
    from backend.services.planner import store_event, get_events, delete_event

    conn = init_db(str(tmp_path / "test.db"))
    event = {
        "title": "Reunión aliados",
        "date": "2026-05-15",
        "description": "",
        "event_type": "reunion",
        "created_at": datetime.now().isoformat(),
    }
    store_event(conn, event)
    events = get_events(conn)
    event_id = events[0]["id"]
    delete_event(conn, event_id)
    assert get_events(conn) == []
    conn.close()


def test_store_and_retrieve_proposal(tmp_path):
    from datetime import datetime
    from backend.database import init_db
    from backend.services.planner import store_proposal, get_proposals

    conn = init_db(str(tmp_path / "test.db"))
    proposal = {
        "topic": "5 tendencias IA para startups LATAM",
        "format": "Carrusel",
        "platform": "Instagram",
        "suggested_date": "2026-05-12",
        "caption_draft": "La IA está transformando el ecosistema emprendedor...",
        "hashtags": "#startups #IA #LATAM",
        "status": "proposed",
        "created_at": datetime.now().isoformat(),
    }
    store_proposal(conn, proposal)
    proposals = get_proposals(conn, status="proposed")
    assert len(proposals) == 1
    assert proposals[0]["topic"] == "5 tendencias IA para startups LATAM"
    conn.close()


def test_update_proposal_status(tmp_path):
    from datetime import datetime
    from backend.database import init_db
    from backend.services.planner import store_proposal, get_proposals, update_proposal_status

    conn = init_db(str(tmp_path / "test.db"))
    proposal = {
        "topic": "Behind the scenes del evento",
        "format": "Reel",
        "platform": "Instagram",
        "suggested_date": "2026-05-20",
        "caption_draft": "Así se vive Conexión Summit por dentro...",
        "hashtags": "#ConexionSummit",
        "status": "proposed",
        "created_at": datetime.now().isoformat(),
    }
    store_proposal(conn, proposal)
    proposals = get_proposals(conn, status="proposed")
    pid = proposals[0]["id"]
    update_proposal_status(conn, pid, "approved")
    approved = get_proposals(conn, status="approved")
    assert len(approved) == 1
    assert approved[0]["id"] == pid
    conn.close()


def test_update_proposal_fields(tmp_path):
    from datetime import datetime
    from backend.database import init_db
    from backend.services.planner import store_proposal, get_proposals, update_proposal

    conn = init_db(str(tmp_path / "test.db"))
    proposal = {
        "topic": "Ecosistema emprendedor Colombia",
        "format": "Post",
        "platform": "LinkedIn",
        "suggested_date": "2026-05-18",
        "caption_draft": "Draft original",
        "hashtags": "#Colombia",
        "status": "proposed",
        "created_at": datetime.now().isoformat(),
    }
    store_proposal(conn, proposal)
    pid = get_proposals(conn)[0]["id"]
    update_proposal(conn, pid, {"caption_draft": "Draft editado por la CM", "suggested_date": "2026-05-19"})
    updated = get_proposals(conn)
    assert updated[0]["caption_draft"] == "Draft editado por la CM"
    assert updated[0]["suggested_date"] == "2026-05-19"
    conn.close()


def test_get_proposals_all_statuses(tmp_path):
    from datetime import datetime
    from backend.database import init_db
    from backend.services.planner import store_proposal, get_proposals

    conn = init_db(str(tmp_path / "test.db"))
    for status in ("proposed", "approved", "rejected"):
        store_proposal(conn, {
            "topic": f"Propuesta {status}",
            "format": "Post", "platform": "Instagram",
            "suggested_date": "2026-05-10",
            "caption_draft": "", "hashtags": "",
            "status": status,
            "created_at": datetime.now().isoformat(),
        })
    assert len(get_proposals(conn)) == 3
    assert len(get_proposals(conn, status="proposed")) == 1
    assert len(get_proposals(conn, status="approved")) == 1
    conn.close()


def test_build_proposals_prompt_includes_pillars():
    from backend.services.planner import build_proposals_prompt

    prompt = build_proposals_prompt(
        events=[{"title": "Demo Endeavor", "date": "2026-05-10", "event_type": "alianza"}],
        trends=[{"keyword": "IA startups", "platform": "Google Trends", "how_to_apply": "Conectar IA con emprendimiento"}],
        articles=[{"title": "Colombia lidera startups LATAM", "source": "iNNpulsa", "summary": "Resumen breve"}],
        pillars=["Ecosistema emprendedor LATAM", "Conexiones corporativo ↔ startup"],
        brand_context="Conexión Summit conecta startups con corporativos en LATAM",
        n_proposals=3,
    )
    assert "Demo Endeavor" in prompt
    assert "IA startups" in prompt
    assert "Ecosistema emprendedor LATAM" in prompt
    assert "TOPIC:" in prompt or "topic" in prompt.lower()


def test_get_events_empty(tmp_path):
    from backend.database import init_db
    from backend.services.planner import get_events

    conn = init_db(str(tmp_path / "test.db"))
    assert get_events(conn) == []
    conn.close()


def test_get_proposals_empty(tmp_path):
    from backend.database import init_db
    from backend.services.planner import get_proposals

    conn = init_db(str(tmp_path / "test.db"))
    assert get_proposals(conn) == []
    conn.close()


def test_planner_events_api():
    import os, tempfile
    tmp = os.path.join(tempfile.gettempdir(), "test_planner_cfg.json")
    if os.path.exists(tmp): os.unlink(tmp)
    os.environ["CM_CONFIG_PATH"] = tmp
    from fastapi.testclient import TestClient
    from backend.main import app
    client = TestClient(app)
    r1 = client.post("/api/planner/events", json={
        "title": "Demo Endeavor",
        "date": "2026-05-10",
        "description": "Presentación startups",
        "event_type": "alianza",
    })
    assert r1.status_code == 200
    r2 = client.get("/api/planner/events")
    assert r2.status_code == 200
    data = r2.json()
    assert len(data["events"]) >= 1
    assert data["events"][0]["title"] == "Demo Endeavor"


def test_planner_proposals_api():
    import os, tempfile
    tmp = os.path.join(tempfile.gettempdir(), "test_planner2_cfg.json")
    if os.path.exists(tmp): os.unlink(tmp)
    os.environ["CM_CONFIG_PATH"] = tmp
    from fastapi.testclient import TestClient
    from backend.main import app
    client = TestClient(app)
    r1 = client.post("/api/planner/proposals", json={
        "topic": "IA en startups LATAM",
        "format": "Carrusel",
        "platform": "Instagram",
        "suggested_date": "2026-05-12",
        "caption_draft": "La IA está cambiando el juego",
        "hashtags": "#IA #startups",
        "status": "proposed",
    })
    assert r1.status_code == 200
    r2 = client.get("/api/planner/proposals?status=proposed")
    assert r2.status_code == 200
    data = r2.json()
    assert len(data["proposals"]) >= 1
    pid = data["proposals"][0]["id"]
    r3 = client.patch(f"/api/planner/proposals/{pid}/status", json={"status": "approved"})
    assert r3.status_code == 200
