import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Users, TrendingUp, Activity, AlertTriangle, Plus, ChevronUp } from 'lucide-react'

const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn']
const PLATFORM_COLORS = { Instagram: '#e1306c', TikTok: '#010101', LinkedIn: '#0077b5' }

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Anomaly alert ─────────────────────────────────────────────────────────────
function AnomalyAlert({ anomalies }) {
  if (!anomalies || anomalies.length === 0) return null
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
      <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-red-700 mb-1">Anomalía detectada</p>
        {anomalies.map((a, i) => (
          <p key={i} className="text-xs text-red-600">
            {a.platform}: engagement {a.direction === 'drop' ? 'bajó' : 'subió'} {Math.abs(a.change_pct)}%
            ({a.previous?.toFixed(1)}% → {a.current?.toFixed(1)}%)
          </p>
        ))}
      </div>
    </div>
  )
}

// ── Manual entry form ─────────────────────────────────────────────────────────
function MetricsForm({ onSaved }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    platform: 'Instagram', followers: '', reach: '', impressions: '',
    likes: '', comments: '', shares: '', week_label: currentWeekLabel(),
  })

  function currentWeekLabel() {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7)
    return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`
  }

  function engagementRate() {
    const r = parseFloat(form.reach) || 0
    if (r === 0) return 0
    return (((parseFloat(form.likes) || 0) + (parseFloat(form.comments) || 0) + (parseFloat(form.shares) || 0)) / r * 100).toFixed(2)
  }

  async function handleSave() {
    if (!form.followers && !form.reach) return
    setSaving(true)
    try {
      await fetch('/api/analytics/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          followers: parseInt(form.followers) || 0,
          reach: parseInt(form.reach) || 0,
          impressions: parseInt(form.impressions) || 0,
          likes: parseInt(form.likes) || 0,
          comments: parseInt(form.comments) || 0,
          shares: parseInt(form.shares) || 0,
          engagement_rate: parseFloat(engagementRate()),
        }),
      })
      setOpen(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {open ? <ChevronUp size={15} /> : <Plus size={15} />}
        {open ? 'Cerrar formulario' : 'Ingresar métricas'}
      </button>

      {open && (
        <div className="mt-4 bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Métricas semanales</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="col-span-2 md:col-span-1">
              <label className="text-xs text-gray-500 mb-1 block">Red social</label>
              <select
                value={form.platform}
                onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {PLATFORMS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Semana</label>
              <input
                value={form.week_label}
                onChange={e => setForm(f => ({ ...f, week_label: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="2026-W17"
              />
            </div>
            {[
              ['followers', 'Seguidores'],
              ['reach', 'Alcance'],
              ['impressions', 'Impresiones'],
              ['likes', 'Likes'],
              ['comments', 'Comentarios'],
              ['shares', 'Compartidos'],
            ].map(([field, label]) => (
              <div key={field}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <input
                  type="number"
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-400">
              Engagement rate calculado: <span className="font-semibold text-indigo-600">{engagementRate()}%</span>
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Instagram Connect ─────────────────────────────────────────────────────────
function InstagramConnect() {
  const [csvType, setCsvType] = useState('account')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [metaStatus, setMetaStatus] = useState(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetch('/api/analytics/instagram/status')
      .then(r => r.json())
      .then(setMetaStatus)
      .catch(() => {})
  }, [])

  async function handleCsvUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`/api/analytics/import/instagram-csv?file_type=${csvType}`, {
        method: 'POST', body: form,
      })
      const data = await res.json()
      setImportResult(data)
    } catch {
      setImportResult({ error: 'Error al importar' })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/analytics/instagram/sync', { method: 'POST' })
      const data = await res.json()
      setImportResult(data)
    } catch {
      setImportResult({ error: 'Error al sincronizar' })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '18px' }}>📥</span>
          <span style={{ fontWeight: '700', fontSize: '14px' }}>Importar CSV de Instagram</span>
        </div>
        <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
          Exporta desde Instagram → Panel Profesional → Exportar datos
        </p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {['account', 'posts'].map(t => (
            <button key={t} onClick={() => setCsvType(t)}
              style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '1.5px solid #6366f1',
                fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                background: csvType === t ? '#6366f1' : 'white',
                color: csvType === t ? 'white' : '#6366f1' }}>
              {t === 'account' ? 'Cuenta (métricas)' : 'Posts individuales'}
            </button>
          ))}
        </div>
        <label style={{ display: 'block', background: '#f8f9fb', border: '1.5px dashed #cbd5e1',
          borderRadius: '8px', padding: '14px', textAlign: 'center', cursor: 'pointer',
          fontSize: '13px', color: '#475569' }}>
          {importing ? 'Importando...' : '📂 Seleccionar archivo CSV'}
          <input type="file" accept=".csv" onChange={handleCsvUpload}
            style={{ display: 'none' }} disabled={importing} />
        </label>
        {importResult && !importResult.error && (
          <div style={{ marginTop: '10px', background: '#dcfce7', borderRadius: '6px',
            padding: '8px 12px', fontSize: '12px', color: '#166534' }}>
            ✅ {importResult.imported} de {importResult.total} filas importadas
          </div>
        )}
        {importResult?.error && (
          <div style={{ marginTop: '10px', background: '#fee2e2', borderRadius: '6px',
            padding: '8px 12px', fontSize: '12px', color: '#991b1b' }}>
            ❌ {importResult.error}
          </div>
        )}
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '18px' }}>🔗</span>
          <span style={{ fontWeight: '700', fontSize: '14px' }}>Meta Graph API</span>
          {metaStatus && (
            <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '4px',
              fontSize: '11px', fontWeight: '700',
              background: metaStatus.configured ? '#dcfce7' : '#fef3c7',
              color: metaStatus.configured ? '#166534' : '#92400e' }}>
              {metaStatus.configured ? '✅ Activa' : '⏳ Pendiente'}
            </span>
          )}
        </div>
        <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
          {metaStatus?.configured
            ? 'API configurada. Sincroniza para obtener los últimos datos.'
            : 'Configura meta_access_token y meta_ig_user_id en Configuración para activar la sincronización automática.'}
        </p>
        {metaStatus?.configured ? (
          <button onClick={handleSync} disabled={syncing}
            style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px',
              padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>
            {syncing ? 'Sincronizando...' : '↻ Sincronizar ahora'}
          </button>
        ) : (
          <div style={{ background: '#f8f9fb', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
              <strong>Campos en Configuración:</strong><br/>
              • meta_access_token<br/>
              • meta_ig_user_id
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function Heatmap({ data }) {
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const max = Math.max(...data.map(c => c.avg_engagement || 0), 0.01)
  const grid = days.map((_, di) => Array.from({ length: 24 }, (_, h) =>
    data.find(c => c.day_index === di && c.hour === h) || { avg_engagement: 0, samples: 0 }
  ))
  return (
    <div className="overflow-x-auto">
      <table className="text-[10px]">
        <thead>
          <tr>
            <th className="w-10"></th>
            {Array.from({ length: 24 }).map((_, h) => <th key={h} className="text-center text-gray-400 px-0.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, di) => (
            <tr key={di}>
              <td className="text-gray-500 pr-2 text-right">{days[di]}</td>
              {row.map((cell, h) => {
                const intensity = max > 0 ? (cell.avg_engagement || 0) / max : 0
                const opacity = cell.samples > 0 ? Math.max(0.1, intensity) : 0.05
                return (
                  <td key={h}
                    title={`${days[di]} ${h}h — ${(cell.avg_engagement || 0).toFixed(2)}% (${cell.samples} posts)`}
                    style={{ backgroundColor: `rgba(99, 102, 241, ${opacity})` }}
                    className="w-5 h-5" />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Analytics() {
  const [summary, setSummary] = useState([])
  const [anomalies, setAnomalies] = useState([])
  const [history, setHistory] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePlatform, setActivePlatform] = useState('Instagram')
  const [compare, setCompare] = useState(null)
  const [heatmap, setHeatmap] = useState([])
  const [sentHistory, setSentHistory] = useState([])

  useEffect(() => {
    fetch('/api/analytics/compare-months').then(r => r.json()).then(setCompare).catch(() => {})
    fetch('/api/analytics/heatmap?days=90').then(r => r.json()).then(d => setHeatmap(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/analytics/sentiment-history?limit=10').then(r => r.json()).then(d => setSentHistory(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, histRes, postsRes] = await Promise.all([
        fetch('/api/analytics'),
        fetch(`/api/analytics/history?platform=${activePlatform}&weeks=12`),
        fetch(`/api/analytics/posts?platform=${activePlatform}&limit=10`),
      ])
      const sumData = await sumRes.json()
      const histData = await histRes.json()
      const postsData = await postsRes.json()
      setSummary(sumData.summary || [])
      setAnomalies(sumData.anomalies || [])
      // Reverse history so oldest first (left to right on chart)
      setHistory([...(histData.history || [])].reverse())
      setPosts(postsData.posts || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [activePlatform])

  useEffect(() => { fetchAll() }, [fetchAll])

  const currentMetrics = summary.find(m => m.platform === activePlatform)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Analytics</h1>
          <p className="text-gray-500 text-sm">Métricas de Instagram, TikTok y LinkedIn</p>
        </div>
      </div>

      <InstagramConnect />

      <AnomalyAlert anomalies={anomalies} />

      <MetricsForm onSaved={fetchAll} />

      {/* Platform tabs */}
      <div className="flex gap-1 mb-6">
        {PLATFORMS.map(p => (
          <button
            key={p}
            onClick={() => setActivePlatform(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activePlatform === p
                ? 'text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            style={activePlatform === p ? { backgroundColor: PLATFORM_COLORS[p] } : {}}
          >
            {p}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Seguidores"
          value={currentMetrics?.followers?.toLocaleString('es-CO') ?? '—'}
          icon={Users}
          color="bg-indigo-500"
        />
        <KpiCard
          label="Alcance promedio"
          value={currentMetrics?.reach?.toLocaleString('es-CO') ?? '—'}
          sub="última semana"
          icon={TrendingUp}
          color="bg-emerald-500"
        />
        <KpiCard
          label="Engagement rate"
          value={currentMetrics?.engagement_rate != null ? `${currentMetrics.engagement_rate}%` : '—'}
          icon={Activity}
          color="bg-amber-500"
        />
        <KpiCard
          label="Semana"
          value={currentMetrics?.week_label ?? '—'}
          icon={TrendingUp}
          color="bg-blue-500"
        />
      </div>

      {compare && (
        <section className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Comparativa: {compare.current_month} vs {compare.previous_month}</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { key: 'posts', label: 'Posts', deltaKey: null, current: compare.current.posts, prev: compare.previous.posts },
              { key: 'avg_reach', label: 'Alcance prom.', deltaKey: 'avg_reach_pct', current: compare.current.avg_reach, prev: compare.previous.avg_reach },
              { key: 'avg_engagement', label: 'Engagement %', deltaKey: 'avg_engagement_pct', current: compare.current.avg_engagement, prev: compare.previous.avg_engagement },
              { key: 'total_likes', label: 'Likes totales', deltaKey: 'total_likes_pct', current: compare.current.total_likes, prev: compare.previous.total_likes },
              { key: 'followers', label: 'Followers', deltaKey: 'followers_pct', current: compare.current.followers, prev: compare.previous.followers },
            ].map(m => {
              const d = m.deltaKey ? compare.deltas[m.deltaKey] : (m.current - m.prev)
              const positive = d > 0
              const negative = d < 0
              return (
                <div key={m.key} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{m.label}</p>
                  <p className="text-lg font-bold text-gray-800">{m.current}</p>
                  <p className="text-xs text-gray-400">vs {m.prev}</p>
                  <p className={`text-xs font-medium ${positive ? 'text-green-600' : negative ? 'text-red-500' : 'text-gray-400'}`}>
                    {positive ? '↑' : negative ? '↓' : '–'} {Math.abs(d)}{m.deltaKey ? '%' : ''}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {heatmap.length > 0 && (
        <section className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-1">Heatmap de engagement (últimos 90 días)</h2>
          <p className="text-xs text-gray-400 mb-4">Cuándo publicar para mejor desempeño — color más oscuro = mayor engagement promedio</p>
          <Heatmap data={heatmap} />
        </section>
      )}

      {/* Importar comentarios CSV */}
      <section className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-1">Importar comentarios de Instagram (CSV)</h2>
        <p className="text-xs text-gray-400 mb-3">Si exportas tus comentarios manualmente, súbelos aquí para analizar el sentimiento.</p>
        <CommentsImporter />
        <details className="mt-3">
          <summary className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer">¿Cómo exportar comentarios desde Instagram?</summary>
          <div className="mt-2 text-xs text-gray-600 space-y-2 bg-gray-50 rounded-lg p-3">
            <p><b>Opción 1: Meta Business Suite</b></p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Ve a business.facebook.com → Insights → Contenido</li>
              <li>Selecciona los posts y exporta como CSV</li>
              <li>Asegúrate de incluir las columnas: post_id (o external_id), text (comentario), author, date</li>
            </ol>
            <p className="mt-2"><b>Opción 2: Herramientas de terceros</b></p>
            <p>Apps como ExportComments.com, Phantombuster o Iconosquare permiten exportar comentarios. Asegúrate de respetar las políticas de Instagram.</p>
            <p className="mt-2"><b>Formato esperado del CSV:</b></p>
            <code className="block bg-white px-2 py-1 rounded text-xs">post_id,text,author,date<br/>123456,"Genial!",usuario1,2026-04-20<br/>123456,"Cuándo?",usuario2,2026-04-21</code>
            <p className="text-xs text-gray-500 mt-2">El sistema acepta también cabeceras alternativas: comment, content, comentario, username, user, timestamp, fecha, media_id, ig_post_id.</p>
          </div>
        </details>
      </section>

      {/* Costos IA por sección */}
      <section className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-1">Gastos de IA por sección (30 días)</h2>
        <p className="text-xs text-gray-400 mb-3">Dónde se concentra el costo. Útil para detectar qué optimizar.</p>
        <AICostByContext />
      </section>

      {/* Sentimiento automático */}
      <section className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-1">Sentimiento de comentarios</h2>
        <p className="text-xs text-gray-400 mb-3">Analiza automáticamente los comentarios de tus posts via Meta Graph API.</p>
        <SentimentByPost />
        {sentHistory.length > 0 && (
          <details className="mt-4">
            <summary className="text-sm text-gray-500 cursor-pointer">Histórico ({sentHistory.length})</summary>
            <div className="mt-2 space-y-2">
              {sentHistory.map(h => (
                <div key={h.id} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>{h.created_at ? new Date(h.created_at).toLocaleDateString('es-CO') : ''} · {h.source}</span>
                    <span>😊 {h.positive_count} · 😐 {h.neutral_count} · 😞 {h.negative_count}</span>
                  </div>
                  <p className="text-gray-700 mt-1">{h.summary}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* Charts */}
      {history.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Line chart: followers growth */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Crecimiento de seguidores</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week_label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="followers"
                  stroke={PLATFORM_COLORS[activePlatform]}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bar chart: engagement rate by week */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Engagement rate por semana</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week_label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${v}%`, 'Engagement']} />
                <Bar dataKey="engagement_rate" fill={PLATFORM_COLORS[activePlatform]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Posts table */}
      {posts.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Publicaciones recientes — {activePlatform}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-gray-400 font-medium pb-2 pr-4">Publicación</th>
                  <th className="text-right text-gray-400 font-medium pb-2 px-2">Alcance</th>
                  <th className="text-right text-gray-400 font-medium pb-2 px-2">Likes</th>
                  <th className="text-right text-gray-400 font-medium pb-2 px-2">Comentarios</th>
                  <th className="text-right text-gray-400 font-medium pb-2">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(post => (
                  <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-4 text-gray-700 max-w-xs truncate">{post.post_description || '—'}</td>
                    <td className="py-2 px-2 text-right text-gray-600">{post.reach?.toLocaleString('es-CO')}</td>
                    <td className="py-2 px-2 text-right text-gray-600">{post.likes?.toLocaleString('es-CO')}</td>
                    <td className="py-2 px-2 text-right text-gray-600">{post.comments?.toLocaleString('es-CO')}</td>
                    <td className="py-2 text-right font-medium text-indigo-600">{post.engagement_rate?.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && summary.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">📈</div>
          <p className="text-gray-500 font-medium mb-1">Sin métricas todavía</p>
          <p className="text-gray-400 text-sm">Usa el formulario para ingresar las métricas de la semana</p>
        </div>
      )}
    </div>
  )
}

function CommentsImporter() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)

  async function upload() {
    if (!file) return
    setUploading(true); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/analytics/import-comments-csv', { method: 'POST', body: fd })
      setResult(await r.json())
    } catch {
      setResult({ error: 'Error de conexión' })
    } finally { setUploading(false) }
  }

  return (
    <div className="flex gap-2 items-center flex-wrap">
      <input type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] || null)}
        className="text-sm text-gray-600" />
      <button onClick={upload} disabled={!file || uploading}
        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
        {uploading ? '⏳ Subiendo...' : 'Importar'}
      </button>
      {result && !result.error && <span className="text-xs text-green-600">✓ {result.inserted} comentarios importados, {result.skipped} omitidos</span>}
      {result?.error && <span className="text-xs text-red-500">{result.error}</span>}
    </div>
  )
}

function AICostByContext() {
  const [data, setData] = useState([])
  useEffect(() => {
    fetch('/api/ai-usage/by-context?days=30').then(r => r.json()).then(d => setData(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])
  if (data.length === 0) return <p className="text-xs text-gray-400">Aún no hay datos.</p>
  const total = data.reduce((s, r) => s + (r.total_cost_usd || 0), 0)
  const max = Math.max(...data.map(r => r.total_cost_usd || 0), 0.0001)
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">Total: <span className="font-bold text-indigo-600">${total.toFixed(2)} USD</span></p>
      {data.map((r, i) => {
        const pct = ((r.total_cost_usd || 0) / max) * 100
        return (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-700">{r.context}</span>
              <span className="text-gray-500">${(r.total_cost_usd || 0).toFixed(3)} · {r.calls} llamadas</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SentimentByPost() {
  const [posts, setPosts] = useState([])
  const [selected, setSelected] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/analytics/posts?limit=50').then(r => r.json()).then(d => setPosts(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  async function run() {
    if (!selected) return
    setLoading(true); setResult(null)
    try {
      const r = await fetch(`/api/analytics/sentiment-post/${selected}`, { method: 'POST' })
      setResult(await r.json())
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div className="flex gap-2 items-center flex-wrap mb-3">
        <select value={selected} onChange={e => setSelected(e.target.value)}
          className="flex-1 max-w-md border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Elige un post...</option>
          {posts.map(p => (
            <option key={p.id} value={p.id}>
              {(p.post_description || '(sin descripción)').slice(0, 80)}{(p.post_description || '').length > 80 ? '...' : ''} · {p.platform}
            </option>
          ))}
        </select>
        <button onClick={run} disabled={loading || !selected}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
          {loading ? '⏳ Analizando...' : '✨ Analizar'}
        </button>
      </div>
      {result && !result.error && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex gap-4 mb-3 flex-wrap">
            <span className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded-full">😊 {result.positive_count} positivos</span>
            <span className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full">😐 {result.neutral_count} neutros</span>
            <span className="text-sm bg-red-50 text-red-700 px-3 py-1 rounded-full">😞 {result.negative_count} negativos</span>
          </div>
          <p className="text-sm text-gray-700 mb-2">{result.summary}</p>
          {Array.isArray(result.top_themes) && result.top_themes.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {result.top_themes.map((t, i) => (
                <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {result?.error && <p className="text-xs text-red-500 mt-2">{result.error}</p>}
    </div>
  )
}
