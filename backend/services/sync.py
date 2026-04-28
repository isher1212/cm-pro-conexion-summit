import json
import logging
import threading
from datetime import datetime
from backend.database import get_db
from backend.config import load_config

logger = logging.getLogger(__name__)


def _update_job(job_id: int, **fields):
    if not fields:
        return
    conn = get_db()
    sets = ", ".join(f"{k} = ?" for k in fields)
    conn.execute(f"UPDATE sync_jobs SET {sets} WHERE id = ?", list(fields.values()) + [job_id])
    conn.commit()


def _is_cancelled(job_id: int) -> bool:
    conn = get_db()
    row = conn.execute("SELECT cancelled FROM sync_jobs WHERE id = ?", (job_id,)).fetchone()
    return bool(row and row[0])


def _row_to_dict(row):
    cols = ["id", "status", "progress_pct", "current_step", "step_index", "total_steps", "results_json", "error_message", "started_at", "finished_at"]
    d = dict(zip(cols, row))
    try:
        d["results"] = json.loads(d.pop("results_json") or "{}")
    except Exception:
        d["results"] = {}
    return d


def get_active_job():
    conn = get_db()
    row = conn.execute(
        "SELECT id, status, progress_pct, current_step, step_index, total_steps, results_json, error_message, started_at, finished_at FROM sync_jobs WHERE status = 'running' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if not row:
        return None
    return _row_to_dict(row)


def get_last_job():
    conn = get_db()
    row = conn.execute(
        "SELECT id, status, progress_pct, current_step, step_index, total_steps, results_json, error_message, started_at, finished_at FROM sync_jobs ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if not row:
        return None
    return _row_to_dict(row)


def start_sync(skip_analytics: bool = False) -> int:
    """Inicia un sync en background. Retorna el job_id (o el activo si ya hay uno corriendo)."""
    conn = get_db()
    existing = conn.execute("SELECT id FROM sync_jobs WHERE status = 'running' LIMIT 1").fetchone()
    if existing:
        return existing[0]

    cur = conn.execute(
        """INSERT INTO sync_jobs (status, progress_pct, current_step, step_index, total_steps, results_json, started_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        ("running", 0, "Iniciando...", 0, 4, "{}", datetime.now().isoformat()),
    )
    conn.commit()
    job_id = cur.lastrowid

    thread = threading.Thread(target=_run_sync, args=(job_id, skip_analytics), daemon=True)
    thread.start()
    return job_id


def cancel_sync(job_id: int) -> bool:
    conn = get_db()
    conn.execute("UPDATE sync_jobs SET cancelled = 1 WHERE id = ? AND status = 'running'", (job_id,))
    conn.commit()
    return True


def _run_sync(job_id: int, skip_analytics: bool):
    try:
        config = load_config()
        results = {}
        steps = []
        steps.append(("Trayendo noticias del ecosistema...", _step_intelligence))
        steps.append(("Buscando tendencias virales...", _step_trends))
        if not skip_analytics and config.get("meta_access_token") and config.get("meta_ig_user_id"):
            steps.append(("Sincronizando métricas de Instagram...", _step_analytics))
        steps.append(("Preparando resumen...", _step_summary))

        total = len(steps)
        _update_job(job_id, total_steps=total)

        for idx, (label, fn) in enumerate(steps):
            if _is_cancelled(job_id):
                _update_job(
                    job_id, status="cancelled", finished_at=datetime.now().isoformat(),
                    current_step="Cancelado por el usuario",
                )
                return
            _update_job(
                job_id, step_index=idx + 1, current_step=label,
                progress_pct=int((idx / total) * 100),
            )
            try:
                step_result = fn(config, results)
                results[label] = step_result
            except Exception as e:
                logger.warning(f"sync step '{label}' failed: {e}")
                results[label] = {"error": str(e)}
            _update_job(
                job_id, results_json=json.dumps(results, ensure_ascii=False),
                progress_pct=int(((idx + 1) / total) * 100),
            )

        _update_job(
            job_id, status="completed", current_step="Sincronización completa",
            progress_pct=100, finished_at=datetime.now().isoformat(),
            results_json=json.dumps(results, ensure_ascii=False),
        )
    except Exception as e:
        logger.error(f"sync failed: {e}")
        _update_job(
            job_id, status="error", error_message=str(e),
            finished_at=datetime.now().isoformat(),
        )


def _step_intelligence(config: dict, results: dict) -> dict:
    try:
        from backend.services.intelligence import run_intelligence_cycle
        from openai import OpenAI
        key = config.get("openai_api_key", "")
        client = OpenAI(api_key=key) if key else None
        conn = get_db()
        res = run_intelligence_cycle(conn, config, client)
        if isinstance(res, int):
            return {"new_articles": res}
        if isinstance(res, dict):
            return res
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def _step_trends(config: dict, results: dict) -> dict:
    try:
        from backend.services.trends import run_trends_cycle
        from openai import OpenAI
        key = config.get("openai_api_key", "")
        client = OpenAI(api_key=key) if key else None
        conn = get_db()
        res = run_trends_cycle(conn, config, client)
        if isinstance(res, int):
            return {"new_trends": res}
        if isinstance(res, dict):
            return res
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def _step_analytics(config: dict, results: dict) -> dict:
    try:
        import httpx
        token = config.get("meta_access_token", "")
        ig_id = config.get("meta_ig_user_id", "")
        if not (token and ig_id):
            return {"status": "skipped", "reason": "Meta API no configurada"}
        r = httpx.get(
            f"https://graph.facebook.com/v19.0/{ig_id}",
            params={"fields": "followers_count,media_count", "access_token": token},
            timeout=20,
        )
        data = r.json()
        if r.status_code >= 400:
            return {"status": "error", "error": data}
        followers = data.get("followers_count", 0)
        from datetime import datetime as dt
        conn = get_db()
        conn.execute(
            """INSERT INTO metrics (platform, followers, reach, impressions, likes, comments, shares, engagement_rate, recorded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            ("Instagram", followers, 0, 0, 0, 0, 0, 0, dt.now().isoformat()),
        )
        conn.commit()
        return {"status": "ok", "followers": followers}
    except Exception as e:
        logger.warning(f"_step_analytics failed: {e}")
        return {"status": "error", "error": str(e)}


def _step_summary(config: dict, results: dict) -> dict:
    new_articles = 0
    new_trends = 0
    for k, v in results.items():
        if isinstance(v, dict):
            new_articles += int(v.get("new_articles", 0) or 0)
            new_trends += int(v.get("new_trends", 0) or 0)
    return {"new_articles": new_articles, "new_trends": new_trends}
