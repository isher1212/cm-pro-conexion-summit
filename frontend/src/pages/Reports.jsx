import { useState, useEffect, useCallback } from 'react'
import { Mail, Send, RefreshCw, CheckCircle, AlertCircle, Clock, ChevronRight, ChevronDown, Sparkles, FileText, Hash, Calendar, DollarSign, ExternalLink } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts'

const PERIODS = [
  { val: 'this_week', label: 'Esta semana' },
  { val: 'last_week', label: 'Semana pasada' },
  { val: 'this_month', label: 'Este mes' },
  { val: 'last_month', label: 'Mes pasado' },
  { val: 'all', label: 'Todo' },
]

const REPORT_ACTIONS = [
  { label: 'Email diario', endpoint: '/api/reports/send-daily-email', icon: Mail, color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100', desc: 'Resumen diario: noticias + tendencia + tip' },
  { label: 'Email semanal', endpoint: '/api/reports/send-weekly-email', icon: Mail, color: 'bg-purple-50 text-purple-700 hover:bg-purple-100', desc: 'Informe completo: métricas + noticias + tendencias + parrilla' },
  { label: 'Telegram diario', endpoint: '/api/reports/send-daily-telegram', icon: Send, color: 'bg-blue-50 text-blue-700 hover:bg-blue-100', desc: 'Noticias 7am + tendencias 9am' },
  { label: 'Telegram semanal', endpoint: '/api/reports/send-weekly-telegram', icon: Send, color: 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100', desc: 'Mini resumen de métricas + link informe' },
]

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

function MetricCard({ icon: Icon, label, value, series, color = 'indigo' }) {
  const colorMap = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', stroke: '#6366f1' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-700', stroke: '#8b5cf6' },
    pink: { bg: 'bg-pink-50', text: 'text-pink-700', stroke: '#ec4899' },
    green: { bg: 'bg-green-50', text: 'text-green-700', stroke: '#10b981' },
  }
  const c = colorMap[color] || colorMap.indigo
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center`}>
          <Icon size={16} className={c.text} />
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {Array.isArray(series) && series.length > 1 && (
        <div className="h-10 mt-2 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <Line type="monotone" dataKey="count" stroke={c.stroke} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function ExecutiveSummary({ data, periodLabel }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const r = await fetch('/api/reports/dashboard/summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, period_label: periodLabel }),
      })
      setSummary(await r.json())
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-violet-900 flex items-center gap-2">
            <Sparkles size={15} /> Resumen ejecutivo
          </h2>
          <p className="text-xs text-violet-600">Análisis automático con IA del período</p>
        </div>
        {!summary && (
          <button onClick={generate} disabled={loading}
            className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50">
            {loading ? '⏳ Generando...' : '✨ Generar resumen'}
          </button>
        )}
        {summary && (
          <button onClick={generate} disabled={loading}
            className="text-xs text-violet-600 hover:text-violet-800">
            {loading ? '⏳' : '🔄 Regenerar'}
          </button>
        )}
      </div>
      {!summary && !loading && (
        <p className="text-xs text-violet-700">Genera un resumen accionable con los datos del período seleccionado.</p>
      )}
      {summary?.error && <p className="text-xs text-red-600">{summary.error}</p>}
      {summary && !summary.error && (
        <div className="space-y-2 text-sm">
          {summary.headline && (
            <p className="font-semibold text-violet-900">{summary.headline}</p>
          )}
          {Array.isArray(summary.puntos_clave) && summary.puntos_clave.length > 0 && (
            <ul className="text-xs text-violet-800 space-y-1 list-disc list-inside">
              {summary.puntos_clave.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          )}
          {summary.alerta && summary.alerta !== 'ninguna' && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mt-2">
              ⚠ <span className="font-medium">Atención:</span> {summary.alerta}
            </p>
          )}
          {summary.siguiente_paso && (
            <p className="text-xs text-indigo-800 bg-white/60 rounded px-2 py-1.5 mt-2">
              ➡ <span className="font-medium">Siguiente paso:</span> {summary.siguiente_paso}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function TopArticlesModule({ articles }) {
  if (articles.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">📰 Top noticias</h3>
        <p className="text-xs text-gray-400 text-center py-6">Sin noticias en este período</p>
      </div>
    )
  }
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">📰 Top noticias del período</h3>
      <div className="space-y-2">
        {articles.map(a => {
          const score = a.relevance_score || 0
          const cls = score >= 7 ? 'bg-green-100 text-green-700' : score >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
          return (
            <div key={a.id} className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
              <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${cls}`}>{score}</span>
              <div className="flex-1 min-w-0">
                <a href={a.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-gray-800 hover:text-indigo-600 line-clamp-2">
                  {a.title_es || a.title}
                </a>
                <p className="text-xs text-gray-400 mt-0.5">{a.source} · {a.category}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TopTrendsModule({ trends }) {
  if (trends.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">🔥 Tendencias activas</h3>
        <p className="text-xs text-gray-400 text-center py-6">Sin tendencias en este período</p>
      </div>
    )
  }
  const platformColor = {
    'Google Trends': 'bg-purple-50 text-purple-700',
    'YouTube': 'bg-red-50 text-red-700',
    'TikTok': 'bg-pink-50 text-pink-700',
    'LinkedIn': 'bg-blue-50 text-blue-700',
  }
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">🔥 Tendencias del período</h3>
      <div className="space-y-2">
        {trends.slice(0, 8).map(t => (
          <div key={t.id} className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 line-clamp-1">{t.keyword}</p>
              {t.description && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{t.description}</p>}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${platformColor[t.platform] || 'bg-gray-100 text-gray-600'}`}>
              {t.platform}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProposalsModule({ proposals }) {
  if (proposals.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">📅 Parrilla del período</h3>
        <p className="text-xs text-gray-400 text-center py-6">Sin propuestas en este período</p>
      </div>
    )
  }
  const statusColor = {
    proposed: 'bg-amber-50 text-amber-700',
    approved: 'bg-green-50 text-green-700',
    published: 'bg-indigo-50 text-indigo-700',
    rejected: 'bg-gray-50 text-gray-400',
  }
  const statusLabel = { proposed: 'Propuesto', approved: 'Aprobado', published: 'Publicado', rejected: 'Rechazado' }
  const counts = proposals.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc }, {})
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">📅 Parrilla del período</h3>
      <div className="flex gap-2 flex-wrap text-xs mb-3">
        {Object.entries(counts).map(([k, v]) => (
          <span key={k} className={`px-2 py-0.5 rounded-full ${statusColor[k] || 'bg-gray-100'}`}>
            {statusLabel[k] || k}: {v}
          </span>
        ))}
      </div>
      <div className="space-y-2">
        {proposals.slice(0, 6).map(p => (
          <div key={p.id} className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
            <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${statusColor[p.status] || ''}`}>
              {statusLabel[p.status] || p.status}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 line-clamp-1">{p.topic}</p>
              <p className="text-xs text-gray-400 mt-0.5">{p.platform} · {p.format} · {p.suggested_date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CostsModule({ costs }) {
  const total = costs.reduce((s, c) => s + (c.cost_usd || 0), 0)
  if (costs.length === 0 || total === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><DollarSign size={14} /> Costos IA</h3>
        <p className="text-xs text-gray-400 text-center py-6">Sin gastos en este período</p>
      </div>
    )
  }
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2"><DollarSign size={14} /> Costos IA</h3>
      <p className="text-xs text-gray-500 mb-3">Total: <span className="font-bold text-gray-800">${total.toFixed(3)} USD</span></p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={costs} dataKey="cost_usd" nameKey="service" cx="50%" cy="50%" outerRadius={50} label={(e) => e.service}>
              {costs.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => `$${v.toFixed(3)}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1 mt-2">
        {costs.map(c => (
          <div key={c.service} className="flex justify-between text-xs">
            <span className="text-gray-700">{c.service}</span>
            <span className="text-gray-500">${(c.cost_usd || 0).toFixed(3)} · {c.calls} llamadas</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const STATUS_ICON = {
  sent: <CheckCircle size={13} className="text-green-500" />,
  error: <AlertCircle size={13} className="text-red-400" />,
  skipped: <Clock size={13} className="text-amber-400" />,
}
const CHANNEL_BADGE = { email: 'bg-indigo-50 text-indigo-600', telegram: 'bg-blue-50 text-blue-600' }

function ManualTriggers({ sending, onSend }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {REPORT_ACTIONS.map(action => (
        <button key={action.label} onClick={() => onSend(action.endpoint, action.label)} disabled={!!sending}
          className={`flex items-start gap-3 p-4 rounded-xl border border-gray-100 text-left transition-colors disabled:opacity-50 ${action.color}`}>
          <action.icon size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold mb-0.5">{sending === action.label ? 'Enviando...' : action.label}</p>
            <p className="text-xs opacity-70">{action.desc}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

function HistoryTable({ log, loading }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
      </div>
    )
  }
  if (log.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-8">Sin envíos todavía — los reportes automáticos aparecerán aquí</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left text-xs font-medium text-gray-400 pb-2 pr-4">Tipo</th>
            <th className="text-left text-xs font-medium text-gray-400 pb-2 pr-4">Canal</th>
            <th className="text-left text-xs font-medium text-gray-400 pb-2 pr-4">Estado</th>
            <th className="text-left text-xs font-medium text-gray-400 pb-2">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {log.map(entry => {
            const date = new Date(entry.sent_at)
            return (
              <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2.5 pr-4 text-xs text-gray-700">{entry.report_type.replace(/_/g, ' ')}</td>
                <td className="py-2.5 pr-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CHANNEL_BADGE[entry.channel] || 'bg-gray-50 text-gray-500'}`}>
                    {entry.channel}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-1.5">
                    {STATUS_ICON[entry.status] || null}
                    <span className="text-xs text-gray-600">{entry.status}</span>
                  </div>
                </td>
                <td className="py-2.5 text-xs text-gray-400">
                  {date.toLocaleDateString('es-CO')} {date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Reports() {
  const [period, setPeriod] = useState('this_week')
  const [data, setData] = useState(null)
  const [loadingData, setLoadingData] = useState(true)
  const [log, setLog] = useState([])
  const [loadingLog, setLoadingLog] = useState(true)
  const [sending, setSending] = useState('')
  const [showActions, setShowActions] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const fetchData = useCallback(async () => {
    setLoadingData(true)
    try {
      const r = await fetch(`/api/reports/dashboard?period=${period}`)
      setData(await r.json())
    } finally { setLoadingData(false) }
  }, [period])

  const fetchLog = useCallback(async () => {
    setLoadingLog(true)
    try {
      const r = await fetch('/api/reports/log?limit=50')
      const d = await r.json()
      setLog(d.log || [])
    } finally { setLoadingLog(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { fetchLog() }, [fetchLog])

  async function handleSend(endpoint, label) {
    setSending(label)
    try {
      await fetch(endpoint, { method: 'POST' })
      await fetchLog()
    } finally { setSending('') }
  }

  const periodLabel = PERIODS.find(p => p.val === period)?.label || period

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Reportes</h1>
          <p className="text-gray-500 text-sm">Dashboard navegable por período · información clave del community</p>
        </div>
        <button onClick={() => { fetchData(); fetchLog() }} className="flex items-center gap-2 border border-gray-200 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      <div className="flex gap-1 mb-6 flex-wrap">
        {PERIODS.map(p => (
          <button key={p.val} onClick={() => setPeriod(p.val)}
            className={`text-xs px-3 py-1.5 rounded-lg border ${period === p.val ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {loadingData ? (
        <div className="grid gap-3 md:grid-cols-4 mb-6">
          {[1,2,3,4].map(i => <div key={i} className="bg-gray-100 rounded-xl h-32 animate-pulse" />)}
        </div>
      ) : data && !data.error ? (
        <>
          <ExecutiveSummary data={data} periodLabel={periodLabel} />

          <div className="grid gap-3 md:grid-cols-4 mb-6">
            <MetricCard icon={FileText} label="Artículos capturados" value={data.metrics?.articles || 0} series={data.series?.articles} color="indigo" />
            <MetricCard icon={Hash} label="Tendencias" value={data.metrics?.trends || 0} series={data.series?.trends} color="violet" />
            <MetricCard icon={Calendar} label="Propuestas creadas" value={data.metrics?.proposals || 0} series={data.series?.proposals} color="pink" />
            <MetricCard icon={CheckCircle} label="Publicadas" value={data.metrics?.proposals_published || 0} series={data.series?.published} color="green" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <TopArticlesModule articles={data.top_articles || []} />
            <TopTrendsModule trends={data.top_trends || []} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <ProposalsModule proposals={data.proposals || []} />
            <CostsModule costs={data.ai_costs || []} />
          </div>
        </>
      ) : (
        <p className="text-sm text-red-500">Error cargando dashboard.</p>
      )}

      <details className="bg-white border border-gray-100 rounded-xl mb-4" open={showActions} onToggle={e => setShowActions(e.target.open)}>
        <summary className="cursor-pointer p-5 flex items-center gap-2 text-sm font-semibold text-gray-700">
          {showActions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          📤 Acciones manuales (enviar reportes ahora)
        </summary>
        <div className="px-5 pb-5">
          <ManualTriggers sending={sending} onSend={handleSend} />
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mt-4">
            <p className="text-xs font-semibold text-indigo-700 mb-2">Envíos automáticos programados</p>
            <div className="grid grid-cols-2 gap-1 md:grid-cols-3">
              {[
                ['Email diario', '7:00am'],
                ['Telegram noticias', '7:00am'],
                ['Telegram tendencias', '9:00am'],
                ['Email semanal', 'Lunes 8:00am'],
                ['Telegram semanal', 'Lunes 8:30am'],
              ].map(([label, time]) => (
                <div key={label} className="text-xs text-indigo-600">
                  <span className="font-medium">{label}:</span> {time}
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>

      <details className="bg-white border border-gray-100 rounded-xl" open={showHistory} onToggle={e => setShowHistory(e.target.open)}>
        <summary className="cursor-pointer p-5 flex items-center gap-2 text-sm font-semibold text-gray-700">
          {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          📜 Historial de envíos
        </summary>
        <div className="px-5 pb-5">
          <HistoryTable log={log} loading={loadingLog} />
        </div>
      </details>
    </div>
  )
}
