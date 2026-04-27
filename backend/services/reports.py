import logging
import smtplib
import sqlite3
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import httpx

logger = logging.getLogger(__name__)


# ── Report log ─────────────────────────────────────────────────────────────────

def log_report(
    conn: sqlite3.Connection,
    report_type: str,
    channel: str,
    status: str,
    error_message: str = "",
) -> None:
    try:
        conn.execute(
            """INSERT INTO report_log (report_type, channel, status, sent_at, error_message)
               VALUES (?, ?, ?, ?, ?)""",
            (report_type, channel, status, datetime.now().isoformat(), error_message),
        )
        conn.commit()
    except Exception as e:
        logger.warning(f"Failed to log report: {e}")


def get_report_log(conn: sqlite3.Connection, limit: int = 50) -> list[dict]:
    cursor = conn.execute(
        "SELECT * FROM report_log ORDER BY sent_at DESC LIMIT ?", (limit,)
    )
    return [dict(row) for row in cursor.fetchall()]


# ── Email HTML builders ────────────────────────────────────────────────────────

def build_daily_email(
    articles: list[dict],
    trends: list[dict],
    anomalies: list[dict],
    tip: str = "",
) -> str:
    articles_html = ""
    for a in articles[:5]:
        articles_html += f"""
        <div style="border-left:3px solid #6366f1;padding:10px 14px;margin-bottom:12px;background:#fafafa;border-radius:0 8px 8px 0;">
          <a href="{a.get('url','#')}" style="font-weight:600;color:#1e293b;text-decoration:none;font-size:14px;">{a.get('title','')}</a>
          <div style="font-size:11px;color:#94a3b8;margin:3px 0;">{a.get('source','')} · {datetime.now().strftime('%d %b %Y')}</div>
          <p style="font-size:12px;color:#475569;margin:6px 0 4px;">{a.get('summary','')}</p>
          {f'<p style="font-size:11px;color:#10b981;font-style:italic;">✅ {a["relevance"]}</p>' if a.get("relevance") else ''}
        </div>"""

    trends_html = ""
    for t in trends[:1]:
        trends_html = f"""
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px;margin-bottom:12px;">
          <div style="font-weight:600;color:#92400e;font-size:13px;">🔥 {t.get('keyword','')}</div>
          <p style="font-size:12px;color:#78350f;margin:6px 0;">{t.get('how_to_apply','')}</p>
          {f'<p style="font-size:12px;color:#b45309;"><strong>💡 Idea:</strong> {t["post_idea"]}</p>' if t.get("post_idea") else ''}
        </div>"""

    anomaly_html = ""
    if anomalies:
        items = "".join(
            f"<li style='font-size:12px;color:#b91c1c;'>{a['platform']}: engagement {a.get('direction','bajó')} {abs(a.get('change_pct',0))}%</li>"
            for a in anomalies
        )
        anomaly_html = f"""
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:12px;">
          <strong style="color:#991b1b;">⚠️ Alerta de métricas</strong>
          <ul style="margin:6px 0 0 16px;padding:0;">{items}</ul>
        </div>"""

    tip_html = f"""
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;">
          <strong style="color:#166534;">💡 Tip del día</strong>
          <p style="font-size:12px;color:#15803d;margin:4px 0 0;">{tip}</p>
        </div>""" if tip else ""

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#6366f1;padding:24px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">CM Pro · Resumen diario</h1>
      <p style="color:#c7d2fe;margin:4px 0 0;font-size:13px;">{datetime.now().strftime('%A, %d de %B de %Y')}</p>
    </div>
    <div style="padding:24px;">
      <h2 style="color:#1e293b;font-size:15px;margin:0 0 12px;">🔍 Noticias del día</h2>
      {articles_html or '<p style="color:#94a3b8;font-size:12px;">Sin noticias nuevas hoy.</p>'}
      <h2 style="color:#1e293b;font-size:15px;margin:20px 0 12px;">🔥 Tendencia del día</h2>
      {trends_html or '<p style="color:#94a3b8;font-size:12px;">Sin tendencias nuevas hoy.</p>'}
      {anomaly_html}
      {tip_html}
    </div>
    <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="font-size:11px;color:#94a3b8;margin:0;">Generado por CM Pro · Conexión Summit</p>
    </div>
  </div>
</body>
</html>"""


def build_weekly_email(
    articles: list[dict],
    trends: list[dict],
    metrics_summary: list[dict],
    proposals: list[dict],
    anomalies: list[dict],
    recommendations: str = "",
) -> str:
    articles_html = "".join(
        f'<li style="font-size:12px;color:#475569;margin-bottom:6px;"><a href="{a.get("url","#")}" style="color:#6366f1;font-weight:600;">{a.get("title","")}</a> — {a.get("summary","")[:100]}</li>'
        for a in articles[:5]
    )

    trends_html = "".join(
        f'<li style="font-size:12px;color:#475569;margin-bottom:6px;"><strong>{t.get("keyword","")}</strong> ({t.get("platform","")}): {t.get("how_to_apply","")}</li>'
        for t in trends[:5]
    )

    metrics_html = "".join(
        f'<tr><td style="padding:6px 8px;font-size:12px;color:#1e293b;">{m.get("platform","")}</td>'
        f'<td style="padding:6px 8px;text-align:right;font-size:12px;">{m.get("followers",0):,}</td>'
        f'<td style="padding:6px 8px;text-align:right;font-size:12px;">{m.get("engagement_rate",0)}%</td>'
        f'<td style="padding:6px 8px;text-align:right;font-size:12px;color:#94a3b8;">{m.get("week_label","")}</td></tr>'
        for m in metrics_summary
    )

    proposals_html = "".join(
        f'<li style="font-size:12px;color:#475569;margin-bottom:6px;"><strong>{p.get("topic","")}</strong> · {p.get("platform","")} · {p.get("suggested_date","")}</li>'
        for p in proposals[:5]
    )

    rec_html = f'<p style="font-size:12px;color:#475569;">{recommendations}</p>' if recommendations else ""

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#6366f1;padding:24px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">CM Pro · Informe semanal</h1>
      <p style="color:#c7d2fe;margin:4px 0 0;font-size:13px;">{datetime.now().strftime('Semana del %d de %B de %Y')}</p>
    </div>
    <div style="padding:24px;">
      <h2 style="color:#1e293b;font-size:15px;margin:0 0 12px;">📈 Métricas de la semana</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead><tr style="border-bottom:2px solid #e2e8f0;">
          <th style="text-align:left;font-size:11px;color:#94a3b8;padding:6px 8px;">Red</th>
          <th style="text-align:right;font-size:11px;color:#94a3b8;padding:6px 8px;">Seguidores</th>
          <th style="text-align:right;font-size:11px;color:#94a3b8;padding:6px 8px;">Engagement</th>
          <th style="text-align:right;font-size:11px;color:#94a3b8;padding:6px 8px;">Semana</th>
        </tr></thead>
        <tbody>{metrics_html or '<tr><td colspan="4" style="font-size:12px;color:#94a3b8;padding:8px;">Sin métricas esta semana.</td></tr>'}</tbody>
      </table>
      <h2 style="color:#1e293b;font-size:15px;margin:0 0 12px;">🔍 Noticias más relevantes</h2>
      <ul style="padding-left:16px;margin:0 0 20px;">{articles_html or '<li style="font-size:12px;color:#94a3b8;">Sin noticias.</li>'}</ul>
      <h2 style="color:#1e293b;font-size:15px;margin:0 0 12px;">🔥 Tendencias de la semana</h2>
      <ul style="padding-left:16px;margin:0 0 20px;">{trends_html or '<li style="font-size:12px;color:#94a3b8;">Sin tendencias.</li>'}</ul>
      <h2 style="color:#1e293b;font-size:15px;margin:0 0 12px;">📅 Propuesta de parrilla próxima semana</h2>
      <ul style="padding-left:16px;margin:0 0 20px;">{proposals_html or '<li style="font-size:12px;color:#94a3b8;">Sin propuestas aprobadas.</li>'}</ul>
      {'<h2 style="color:#1e293b;font-size:15px;margin:0 0 12px;">💬 Recomendaciones estratégicas</h2>' + rec_html if rec_html else ''}
    </div>
    <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="font-size:11px;color:#94a3b8;margin:0;">Generado por CM Pro · Conexión Summit</p>
    </div>
  </div>
</body>
</html>"""


# ── Telegram message builders ──────────────────────────────────────────────────

def build_telegram_intelligence_message(articles: list[dict]) -> str:
    lines = ["🔍 *Noticias del día — Conexión Summit*\n"]
    for a in articles[:5]:
        title = a.get("title", "Sin título")
        source = a.get("source", "")
        summary = a.get("summary", "")[:120]
        url = a.get("url", "")
        lines.append(f"• *{title}*\n  _{source}_ — {summary}\n  {url}\n")
    msg = "\n".join(lines)
    return msg[:4096]


def build_telegram_trends_message(trends: list[dict]) -> str:
    lines = ["🔥 *Tendencias del día — Conexión Summit*\n"]
    for t in trends[:3]:
        keyword = t.get("keyword", "")
        platform = t.get("platform", "")
        how_to_apply = t.get("how_to_apply", "")
        post_idea = t.get("post_idea", "")
        lines.append(f"• *{keyword}* ({platform})\n  {how_to_apply}")
        if post_idea:
            lines.append(f"  💡 {post_idea}")
        lines.append("")
    msg = "\n".join(lines)
    return msg[:4096]


def build_telegram_weekly_summary(metrics_summary: list[dict]) -> str:
    lines = ["📊 *Resumen semanal — Conexión Summit*\n"]
    for m in metrics_summary:
        lines.append(
            f"• {m.get('platform','')}: {m.get('followers',0):,} seguidores · {m.get('engagement_rate',0)}% engagement"
        )
    lines.append("\nVer informe completo en tu email.")
    return "\n".join(lines)[:4096]


# ── Send functions ─────────────────────────────────────────────────────────────

def send_email(config: dict, subject: str, html_body: str) -> bool:
    smtp_host = config.get("smtp_host", "smtp.gmail.com")
    smtp_port = int(config.get("smtp_port", 587))
    sender = config.get("email_sender", "")
    password = config.get("email_password", "")
    recipient = config.get("email_recipient", "")

    if not sender or not password or not recipient:
        logger.warning("Email not configured — skipping send")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = sender
        msg["To"] = recipient
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            server.starttls()
            server.login(sender, password)
            server.sendmail(sender, recipient, msg.as_string())
        return True
    except Exception as e:
        logger.warning(f"Email send failed: {e}")
        return False


def send_telegram(config: dict, message: str) -> bool:
    token = config.get("telegram_bot_token", "")
    chat_id = config.get("telegram_chat_id", "")

    if not token or not chat_id:
        logger.warning("Telegram not configured — skipping send")
        return False

    try:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        resp = httpx.post(
            url,
            json={"chat_id": chat_id, "text": message, "parse_mode": "Markdown"},
            timeout=15,
        )
        return resp.status_code == 200
    except Exception as e:
        logger.warning(f"Telegram send failed: {e}")
        return False


# ── Scheduled job implementations ──────────────────────────────────────────────

def run_daily_intelligence_telegram(conn: sqlite3.Connection, config: dict) -> None:
    from backend.services.intelligence import get_articles
    articles = get_articles(conn, limit=5)
    msg = build_telegram_intelligence_message(articles)
    ok = send_telegram(config, msg)
    log_report(conn, "daily_telegram_intelligence", "telegram", "sent" if ok else "skipped")


def run_daily_trends_telegram(conn: sqlite3.Connection, config: dict) -> None:
    from backend.services.trends import get_trends
    trends = get_trends(conn, limit=3)
    msg = build_telegram_trends_message(trends)
    ok = send_telegram(config, msg)
    log_report(conn, "daily_telegram_trends", "telegram", "sent" if ok else "skipped")


def run_daily_email_job(conn: sqlite3.Connection, config: dict, openai_client: Any = None) -> None:
    from backend.services.intelligence import get_articles
    from backend.services.trends import get_trends
    from backend.services.analytics import get_weekly_summary, detect_anomaly

    articles = get_articles(conn, limit=5)
    trends = get_trends(conn, limit=1)
    summary = get_weekly_summary(conn)
    threshold = config.get("alert_threshold_pct", 20)
    anomalies = []
    for row in summary:
        result = detect_anomaly(conn, row["platform"], threshold)
        if result["has_anomaly"]:
            anomalies.append({"platform": row["platform"], **result})

    tip = ""
    if openai_client:
        try:
            resp = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": "Dame un tip de contenido de 1 línea para un CM de emprendimiento LATAM. Solo el tip, sin preámbulo."}],
                max_tokens=80,
                temperature=0.7,
            )
            tip = resp.choices[0].message.content or ""
        except Exception:
            pass

    html = build_daily_email(articles, trends, anomalies, tip)
    ok = send_email(config, "📊 Resumen diario — CM Pro", html)
    log_report(conn, "daily_email", "email", "sent" if ok else "skipped")


def run_weekly_email_job(conn: sqlite3.Connection, config: dict, openai_client: Any = None) -> None:
    from backend.services.intelligence import get_articles
    from backend.services.trends import get_trends
    from backend.services.analytics import get_weekly_summary, detect_anomaly
    from backend.services.planner import get_proposals

    articles = get_articles(conn, limit=7)
    trends = get_trends(conn, limit=5)
    metrics_summary = get_weekly_summary(conn)
    proposals = get_proposals(conn, status="approved", limit=7)
    threshold = config.get("alert_threshold_pct", 20)
    anomalies = []
    for row in metrics_summary:
        result = detect_anomaly(conn, row["platform"], threshold)
        if result["has_anomaly"]:
            anomalies.append({"platform": row["platform"], **result})

    recommendations = ""
    if openai_client and metrics_summary:
        try:
            metrics_text = "; ".join(f"{m['platform']}: {m.get('engagement_rate',0)}% engagement" for m in metrics_summary)
            resp = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": f"Basado en estas métricas ({metrics_text}), da 2-3 recomendaciones estratégicas de contenido para Conexión Summit. Breve y accionable."}],
                max_tokens=200,
                temperature=0.5,
            )
            recommendations = resp.choices[0].message.content or ""
        except Exception:
            pass

    html = build_weekly_email(articles, trends, metrics_summary, proposals, anomalies, recommendations)
    ok = send_email(config, "📈 Informe semanal — CM Pro", html)
    log_report(conn, "weekly_email", "email", "sent" if ok else "skipped")


def run_weekly_telegram_job(conn: sqlite3.Connection, config: dict) -> None:
    from backend.services.analytics import get_weekly_summary
    metrics_summary = get_weekly_summary(conn)
    msg = build_telegram_weekly_summary(metrics_summary)
    ok = send_telegram(config, msg)
    log_report(conn, "weekly_telegram", "telegram", "sent" if ok else "skipped")
