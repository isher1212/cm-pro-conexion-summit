from fastapi import APIRouter, Query, UploadFile, File
from backend.database import get_db
from backend.services.analytics import (
    store_metrics, get_metrics, get_weekly_summary,
    detect_anomaly, store_post, get_posts,
)
from backend.config import load_config
from backend.services.instagram_import import parse_instagram_account_csv, parse_instagram_posts_csv
from backend.services.instagram_api import get_meta_status, fetch_meta_account_metrics, fetch_meta_posts

router = APIRouter()


@router.get("/analytics")
def analytics_summary():
    conn = get_db()
    summary = get_weekly_summary(conn)
    config = load_config()
    threshold = config.get("alert_threshold_pct", 20)
    anomalies = []
    for row in summary:
        result = detect_anomaly(conn, row["platform"], threshold)
        if result["has_anomaly"]:
            anomalies.append({"platform": row["platform"], **result})
    return {"summary": summary, "anomalies": anomalies}


@router.get("/analytics/history")
def analytics_history(
    platform: str = Query(""),
    weeks: int = Query(12, ge=1, le=52),
):
    conn = get_db()
    history = get_metrics(conn, platform=platform, limit=weeks)
    return {"history": history}


@router.post("/analytics/metrics")
def add_metrics(body: dict):
    conn = get_db()
    store_metrics(conn, body)
    return {"status": "ok"}


@router.get("/analytics/posts")
def list_posts(
    platform: str = Query(""),
    limit: int = Query(10, ge=1, le=50),
):
    conn = get_db()
    posts = get_posts(conn, platform=platform, limit=limit)
    return {"posts": posts, "total": len(posts)}


@router.post("/analytics/posts")
def add_post(body: dict):
    conn = get_db()
    store_post(conn, body)
    return {"status": "ok"}


@router.post("/analytics/import/instagram-csv")
async def import_instagram_csv(
    file_type: str = Query("account", pattern="^(account|posts)$"),
    file: UploadFile = File(...),
):
    content = await file.read()
    csv_data = content.decode("utf-8-sig")
    conn = get_db()

    if file_type == "account":
        rows = parse_instagram_account_csv(csv_data)
        imported = 0
        for row in rows:
            try:
                store_metrics(conn, row)
                imported += 1
            except Exception:
                pass
        return {"imported": imported, "total": len(rows), "type": "account"}

    rows = parse_instagram_posts_csv(csv_data)
    imported = 0
    for row in rows:
        try:
            store_post(conn, row)
            imported += 1
        except Exception:
            pass
    return {"imported": imported, "total": len(rows), "type": "posts"}


@router.get("/analytics/instagram/status")
def instagram_connection_status():
    config = load_config()
    return get_meta_status(config)


@router.post("/analytics/instagram/sync")
def instagram_sync():
    config = load_config()
    conn = get_db()

    account_rows = fetch_meta_account_metrics(config)
    if account_rows is None:
        return {"status": "not_configured",
                "message": "Meta API no configurada. Agrega meta_access_token en Configuración."}

    metrics_imported = 0
    for row in account_rows:
        try:
            store_metrics(conn, row)
            metrics_imported += 1
        except Exception:
            pass

    posts = fetch_meta_posts(config) or []
    posts_imported = 0
    for post in posts:
        try:
            store_post(conn, post)
            posts_imported += 1
        except Exception:
            pass

    return {"status": "ok", "metrics_imported": metrics_imported, "posts_imported": posts_imported}


@router.get("/analytics/heatmap")
def engagement_heatmap(days: int = 90):
    """Heatmap 7x24 con engagement promedio por día_semana × hora."""
    from datetime import datetime as dt
    conn = get_db()
    rows = conn.execute(
        """SELECT published_at, engagement_rate FROM posts
           WHERE published_at >= datetime('now', ?) AND engagement_rate IS NOT NULL""",
        (f"-{days} days",),
    ).fetchall()
    grid = [[{"sum": 0.0, "count": 0} for _ in range(24)] for _ in range(7)]
    for pub, eng in rows:
        if not pub:
            continue
        try:
            d = dt.fromisoformat(pub.replace("Z", "+00:00"))
        except Exception:
            try:
                d = dt.fromisoformat(pub)
            except Exception:
                continue
        wd = d.weekday()
        h = d.hour
        if 0 <= wd < 7 and 0 <= h < 24:
            grid[wd][h]["sum"] += float(eng or 0)
            grid[wd][h]["count"] += 1
    days_labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    result = []
    for wd in range(7):
        for h in range(24):
            cell = grid[wd][h]
            avg = cell["sum"] / cell["count"] if cell["count"] else 0
            result.append({
                "day": days_labels[wd],
                "day_index": wd,
                "hour": h,
                "avg_engagement": round(avg, 2),
                "samples": cell["count"],
            })
    return result


@router.get("/analytics/compare-months")
def compare_months():
    """Comparativa: mes actual vs mes anterior en KPIs principales."""
    from datetime import datetime as dt, timedelta
    conn = get_db()
    today = dt.now()
    cur_start = today.replace(day=1)
    prev_end = cur_start - timedelta(days=1)
    prev_start = prev_end.replace(day=1)

    def query_block(start, end_exclusive):
        s = start.isoformat()
        e = end_exclusive.isoformat()
        posts = conn.execute(
            """SELECT COUNT(*), AVG(reach), AVG(engagement_rate), SUM(likes), SUM(comments)
               FROM posts WHERE published_at >= ? AND published_at < ?""",
            (s, e),
        ).fetchone()
        followers = conn.execute(
            """SELECT followers FROM metrics WHERE recorded_at < ? ORDER BY recorded_at DESC LIMIT 1""",
            (e,),
        ).fetchone()
        return {
            "posts": posts[0] or 0,
            "avg_reach": round(posts[1] or 0, 1),
            "avg_engagement": round(posts[2] or 0, 2),
            "total_likes": posts[3] or 0,
            "total_comments": posts[4] or 0,
            "followers": followers[0] if followers else 0,
        }

    cur = query_block(cur_start, today + timedelta(days=1))
    prev = query_block(prev_start, cur_start)

    def delta_pct(a, b):
        if not b:
            return 0
        return round(((a - b) / b) * 100, 1)

    return {
        "current_month": cur_start.strftime("%Y-%m"),
        "previous_month": prev_start.strftime("%Y-%m"),
        "current": cur,
        "previous": prev,
        "deltas": {
            "posts": cur["posts"] - prev["posts"],
            "avg_reach_pct": delta_pct(cur["avg_reach"], prev["avg_reach"]),
            "avg_engagement_pct": delta_pct(cur["avg_engagement"], prev["avg_engagement"]),
            "total_likes_pct": delta_pct(cur["total_likes"], prev["total_likes"]),
            "followers_pct": delta_pct(cur["followers"], prev["followers"]),
        },
    }


@router.post("/analytics/analyze-sentiment")
def analyze_sentiment_endpoint(body: dict):
    from backend.services.sentiment import analyze_sentiment
    config = load_config()
    key = config.get("openai_api_key", "")
    if not key:
        return {"error": "OpenAI API key no configurada"}
    from openai import OpenAI
    client = OpenAI(api_key=key)
    texts = body.get("texts", [])
    source = body.get("source", "manual")
    return analyze_sentiment(texts, source, client, config.get("brand_context", ""))


@router.get("/analytics/sentiment-history")
def sentiment_history(limit: int = 30):
    from backend.services.sentiment import list_sentiment_history
    return list_sentiment_history(limit)


@router.post("/analytics/sentiment-post/{post_id}")
def sentiment_for_post(post_id: int):
    from backend.services.sentiment import analyze_post_sentiment_auto
    config = load_config()
    key = config.get("openai_api_key", "")
    if not key:
        return {"error": "OpenAI API key no configurada"}
    from openai import OpenAI
    client = OpenAI(api_key=key)
    return analyze_post_sentiment_auto(post_id, client, config)


@router.post("/analytics/import-comments-csv")
async def import_comments_csv_endpoint(file: UploadFile = File(...)):
    from backend.services.comments_import import import_comments_csv
    try:
        content = await file.read()
        text = content.decode("utf-8", errors="replace")
        return import_comments_csv(text)
    except Exception as e:
        return {"error": str(e)}


@router.post("/analytics/post/{post_id}/insights")
def post_insights(post_id: int):
    """Generate AI analysis of a single post's performance.
    Returns: { rendimiento, factores_exito, areas_mejora, sugerencias_proximos, comparativa }
    """
    from backend.config import load_config
    config = load_config()
    api_key = config.get("openai_api_key", "")
    if not api_key:
        return {"error": "OpenAI API key no configurada"}

    conn = get_db()
    row = conn.execute(
        """SELECT id, platform, post_description, published_at, likes, comments, shares, reach, impressions, engagement_rate, recorded_at
           FROM posts WHERE id = ?""",
        (post_id,),
    ).fetchone()
    if not row:
        return {"error": "Post no encontrado"}
    cols = ["id", "platform", "post_description", "published_at", "likes", "comments", "shares", "reach", "impressions", "engagement_rate", "recorded_at"]
    post = dict(zip(cols, row))

    # Calcular promedios de la plataforma para comparativa
    avg_row = conn.execute(
        """SELECT AVG(reach), AVG(likes), AVG(comments), AVG(engagement_rate)
           FROM posts WHERE platform = ? AND id != ?""",
        (post["platform"], post_id),
    ).fetchone()
    avg = {
        "reach": float(avg_row[0] or 0),
        "likes": float(avg_row[1] or 0),
        "comments": float(avg_row[2] or 0),
        "engagement_rate": float(avg_row[3] or 0),
    }

    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    brand = config.get("brand_context", "")

    def pct_diff(a, b):
        if not b:
            return "N/A"
        return f"{((a - b) / b * 100):+.0f}%"

    prompt = f"""Eres analista experto de redes sociales para Conexión Summit (plataforma de emprendimiento LATAM).
{f"CONTEXTO MARCA: {brand}" if brand else ""}

Analiza el rendimiento de esta publicación y dame insights accionables:

PUBLICACIÓN:
- Plataforma: {post['platform']}
- Fecha: {post.get('published_at', 'N/D')}
- Descripción: {post.get('post_description', '')[:400]}
- Alcance: {post['reach']:,}
- Likes: {post['likes']:,}
- Comentarios: {post['comments']:,}
- Compartidos: {post.get('shares', 0):,}
- Impresiones: {post.get('impressions', 0):,}
- Engagement rate: {post['engagement_rate']:.2f}%

PROMEDIOS DE LA PLATAFORMA (para comparar):
- Alcance prom: {avg['reach']:,.0f} (este post: {pct_diff(post['reach'], avg['reach'])} vs promedio)
- Likes prom: {avg['likes']:,.0f} ({pct_diff(post['likes'], avg['likes'])})
- Comentarios prom: {avg['comments']:,.0f} ({pct_diff(post['comments'], avg['comments'])})
- ER prom: {avg['engagement_rate']:.2f}% ({pct_diff(post['engagement_rate'], avg['engagement_rate'])})

Responde EXACTAMENTE en este formato JSON (solo JSON, sin texto adicional):
{{
  "rendimiento": "Evaluación de 1 oración: bajo/medio/alto y por qué (compara con promedios)",
  "veredicto": "una de: 'excelente' | 'sobre el promedio' | 'en el promedio' | 'bajo el promedio'",
  "factores_exito": ["3-4 factores que probablemente impulsaron el resultado (formato, hook, tema, momento, etc.)"],
  "areas_mejora": ["2-3 áreas concretas donde este post pudo haber sido mejor"],
  "sugerencias_proximos": ["3-4 sugerencias específicas y accionables para futuras publicaciones similares"],
  "tipo_contenido": "categoría detectada (ej: 'Anuncio de speaker', 'Behind the scenes', 'Carrusel educativo', 'Reel viral')",
  "mejor_momento_publicar": "Sugerencia de día/hora ideal basada en el patrón observado (1 frase)"
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000,
            temperature=0.6,
            response_format={"type": "json_object"},
        )
        try:
            from backend.services.ai_usage import log_openai_usage
            log_openai_usage("gpt-4o-mini", response, context="analytics/post-insights")
        except Exception:
            pass
        import json
        result = json.loads(response.choices[0].message.content or "{}")
        result["_post"] = post
        result["_avg"] = avg
        return result
    except Exception as e:
        return {"error": f"Error: {e}"}
