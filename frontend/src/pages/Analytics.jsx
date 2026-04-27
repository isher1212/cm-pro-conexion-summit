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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Analytics() {
  const [summary, setSummary] = useState([])
  const [anomalies, setAnomalies] = useState([])
  const [history, setHistory] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePlatform, setActivePlatform] = useState('Instagram')

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
