import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp, Video, Lightbulb, Zap, Hash, Briefcase, ExternalLink } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import DateRangeFilter from '../components/DateRangeFilter'
import ViewToggle from '../components/ViewToggle'
import HistoricalArchive from '../components/HistoricalArchive'

const PLATFORMS = ['Todas', 'Google Trends', 'YouTube', 'TikTok', 'LinkedIn']

const platformIcon = {
  'Google Trends': <TrendingUp size={12} />,
  'YouTube': <Video size={12} />,
  'TikTok': <Hash size={12} />,
  'LinkedIn': <Briefcase size={12} />,
}

const platformColor = {
  'Google Trends': 'bg-purple-50 text-purple-600',
  'YouTube': 'bg-red-50 text-red-600',
  'TikTok': 'bg-pink-50 text-pink-600',
  'LinkedIn': 'bg-blue-50 text-blue-600',
}

function TrendCard({ trend, fetchAll }) {
  const [panel, setPanel] = useState(false)
  const [mode, setMode] = useState('image') // 'image' | 'video_script'
  const [targetPlatform, setTargetPlatform] = useState('Instagram')
  const [extraSpecs, setExtraSpecs] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null) // { urls?, script? }
  const [sent, setSent] = useState(false)
  const [replicateError, setReplicateError] = useState('')

  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [savedTrend, setSavedTrend] = useState(false)

  async function handleAnalyzeTrend() {
    setAnalyzing(true)
    setAnalyzeError('')
    try {
      const res = await fetch('/api/trends/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: trend.keyword,
          description: trend.description || '',
          why_trending: trend.why_trending || '',
          how_to_apply: trend.how_to_apply || '',
          post_idea: trend.post_idea || '',
        }),
      })
      if (!res.ok) { setAnalyzeError('Error al analizar.'); return }
      const data = await res.json()
      if (data.error) { setAnalyzeError(data.error) } else { setAnalysis(data) }
    } catch { setAnalyzeError('Error de conexión.') }
    finally { setAnalyzing(false) }
  }

  async function handleSaveTrend() {
    await fetch('/api/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_type: 'trend',
        title: trend.keyword,
        url: trend.url || '',
        summary: trend.description || '',
        source: 'Tendencias',
        category: '',
        platform: trend.platform || '',
      }),
    })
    setSavedTrend(true)
  }

  const isYouTube = trend.platform === 'YouTube'

  async function handleReplicate() {
    setLoading(true)
    setResult(null)
    setReplicateError('')
    setProgress(0)
    setElapsed(0)
    const startTime = Date.now()
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - startTime) / 1000)
      setElapsed(secs)
      setProgress(Math.min(88, Math.round(100 * (1 - Math.exp(-secs / 35)))))
    }, 1000)
    try {
      const res = await fetch('/api/images/replicate-trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: trend.keyword,
          platform_origin: trend.platform,
          trend_url: trend.url || '',
          target_platform: targetPlatform,
          mode,
          extra_specs: extraSpecs,
          send_to_parrilla: false,
        }),
      })
      clearInterval(interval)
      setProgress(100)
      if (!res.ok) {
        setReplicateError('Error al replicar tendencia.')
        return
      }
      const data = await res.json()
      if (data.error) {
        setReplicateError(data.error)
      } else if (mode === 'image' && (!data.urls || data.urls.length === 0)) {
        setReplicateError('No se generó ninguna imagen. Verifica la API key de Kie AI en Configuración.')
      } else {
        setResult(data)
      }
    } catch {
      clearInterval(interval)
      setReplicateError('Error de conexión.')
    } finally {
      setLoading(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  async function handleSendToParrilla() {
    await fetch('/api/images/replicate-trend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: trend.keyword,
        platform_origin: trend.platform,
        trend_url: trend.url || '',
        target_platform: targetPlatform,
        mode,
        extra_specs: extraSpecs,
        send_to_parrilla: true,
      }),
    })
    setSent(true)
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 leading-snug">{trend.keyword}</h3>
          {trend.source_url && (
            <a href={trend.source_url} target="_blank" rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-600 flex-shrink-0">
              <ExternalLink size={14} />
            </a>
          )}
        </div>
        <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full flex-shrink-0 font-medium ${platformColor[trend.platform] || 'bg-gray-50 text-gray-500'}`}>
          {platformIcon[trend.platform]}
          {trend.platform}
        </span>
      </div>

      {trend.description && (
        <p className="text-xs text-gray-600 leading-relaxed mb-3">{trend.description}</p>
      )}

      {trend.why_trending && (
        <div className="flex gap-2 mb-3">
          <Zap size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">{trend.why_trending}</p>
        </div>
      )}

      {trend.how_to_apply && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-indigo-700">
            <span className="font-medium">Cómo aplicarlo:</span> {trend.how_to_apply}
          </p>
        </div>
      )}

      {trend.post_idea && (
        <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-3">
          <div className="flex gap-2 items-start">
            <Lightbulb size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-green-700 font-medium mb-2">{trend.post_idea}</p>
              <button
                onClick={() => { setPanel(true); setExtraSpecs(trend.post_idea || '') }}
                className="text-xs text-green-700 hover:text-green-900 font-semibold underline">
                ✨ Generar este contenido con IA
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-300 mt-3">
        {trend.fetched_at ? new Date(trend.fetched_at).toLocaleDateString('es-CO') : ''}
      </p>

      {/* Acciones rápidas */}
      <div className="flex gap-3 flex-wrap mt-2 mb-2">
        <button onClick={handleAnalyzeTrend} disabled={analyzing}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50">
          {analyzing ? '⏳ Analizando...' : '🔍 Ampliar análisis'}
        </button>
        {savedTrend ? (
          <span className="text-xs text-green-600 font-medium">✓ Guardada</span>
        ) : (
          <button onClick={handleSaveTrend} className="text-xs text-gray-400 hover:text-gray-600">
            🔖 Guardar tendencia
          </button>
        )}
        {!trend.discarded ? (
          <button onClick={async () => {
            try {
              const r = await fetch(`/api/trends/${trend.id}/discard`, { method: 'POST' })
              if (r.ok && fetchAll) fetchAll()
            } catch {}
          }} className="text-xs text-gray-400 hover:text-red-500">
            🗑 Descartar
          </button>
        ) : (
          <button onClick={async () => {
            try {
              const r = await fetch(`/api/trends/${trend.id}/restore`, { method: 'POST' })
              if (r.ok && fetchAll) fetchAll()
            } catch {}
          }} className="text-xs text-amber-600 hover:text-amber-800">
            ↩ Restaurar
          </button>
        )}
      </div>
      {analyzeError && <p className="text-xs text-red-500 mb-2">{analyzeError}</p>}
      {analysis && (
        <div className="mb-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-indigo-800">Análisis expandido</p>
            <button onClick={() => setAnalysis(null)} className="text-indigo-300 hover:text-indigo-500 text-sm leading-none">×</button>
          </div>
          {[
            { key: 'resumen', label: '📋 Resumen' },
            { key: 'usos', label: '💡 Posibles usos' },
            { key: 'oportunidades', label: '🚀 Oportunidades' },
            { key: 'como_abordarlo', label: '✏️ Cómo abordarlo' },
            { key: 'como_promoverlo', label: '📣 Cómo promoverlo' },
          ].map(({ key, label }) => analysis[key] ? (
            <div key={key}>
              <p className="text-xs font-medium text-indigo-700">{label}</p>
              <p className="text-xs text-indigo-900 leading-relaxed">{analysis[key]}</p>
            </div>
          ) : null)}
        </div>
      )}

      {/* Replication panel */}
      <div className="mt-3 pt-3 border-t border-gray-50">
        {!panel ? (
          <button onClick={() => setPanel(true)} className="text-xs text-violet-600 hover:text-violet-800 font-medium">
            🔁 Replicar para la marca
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setMode('image')}
                className={`text-xs px-2.5 py-1 rounded-lg border ${mode === 'image' ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                🖼 Imagen
              </button>
              <button onClick={() => setMode('video_script')}
                className={`text-xs px-2.5 py-1 rounded-lg border ${mode === 'video_script' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                🎬 Guión + voz en off
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['Instagram', 'TikTok', 'LinkedIn'].map(p => (
                <button key={p} onClick={() => setTargetPlatform(p)}
                  className={`text-xs px-2.5 py-1 rounded-lg border ${targetPlatform === p ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {p}
                </button>
              ))}
            </div>
            {mode === 'image' && (
              <textarea value={extraSpecs} onChange={e => setExtraSpecs(e.target.value)}
                placeholder="Especificaciones adicionales (opcional)..."
                rows={1} className="w-full border border-gray-200 rounded px-2 py-1 text-xs resize-none" />
            )}
            <div className="flex gap-2 items-center">
              <button onClick={handleReplicate} disabled={loading}
                className="bg-violet-600 hover:bg-violet-700 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">
                {loading ? '⏳ Generando...' : 'Generar'}
              </button>
              <button onClick={() => { setPanel(false); setResult(null); setSent(false); setReplicateError('') }}
                className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
            </div>
            {loading && (
              <div className="space-y-1 mt-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-violet-600 font-medium">Generando con Kie AI...</span>
                  <span className="text-xs text-gray-400 tabular-nums">{elapsed}s</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-violet-500 to-indigo-500 h-1.5 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">Puede tomar 30-90 segundos...</p>
              </div>
            )}
            {replicateError && <p className="text-xs text-red-500">{replicateError}</p>}

            {result && (
              <div className="mt-2 p-3 bg-violet-50 rounded-lg border border-violet-100 space-y-2">
                {Array.isArray(result.urls) && result.urls.length > 0 && (
                  <div className="space-y-2">
                    {result.urls.map(url => (
                      <div key={url} className="relative group">
                        <img src={url} alt="" className="w-full max-h-56 object-contain rounded-xl border border-violet-100 bg-violet-50/30" />
                        <a href={url} target="_blank" rel="noreferrer"
                          className="absolute inset-0 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs bg-black/50 text-white px-2 py-0.5 rounded">Ver original ↗</span>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                {result.script?.hook && (
                  <div className="space-y-2">
                    {[
                      { key: 'hook', label: '🎣 Hook' },
                      { key: 'desarrollo', label: '📖 Desarrollo' },
                      { key: 'cta', label: '📢 CTA' },
                      { key: 'voz_en_off', label: '🎙 Voz en off' },
                    ].map(({ key, label }) => result.script[key] ? (
                      <div key={key}>
                        <p className="text-xs font-medium text-violet-700">{label}</p>
                        <p className="text-xs text-violet-900 leading-relaxed">{result.script[key]}</p>
                      </div>
                    ) : null)}
                    {result.script.duracion && (
                      <p className="text-xs text-violet-400 mt-1">⏱ {result.script.duracion}s</p>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1 flex-wrap">
                  {!sent ? (
                    <button onClick={handleSendToParrilla}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg">
                      📅 Enviar a Parrilla
                    </button>
                  ) : (
                    <span className="text-xs text-green-600 font-medium">✓ Enviado a Parrilla</span>
                  )}
                  <button onClick={() => { setResult(null); setSent(false); handleReplicate() }}
                    disabled={loading}
                    className="ml-2 text-xs text-violet-600 hover:text-violet-800 font-medium disabled:opacity-50">
                    🔄 Regenerar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function HistoryChart({ data }) {
  const byDate = {}
  ;(Array.isArray(data) ? data : []).forEach(d => {
    if (!d || !d.date) return
    if (!byDate[d.date]) byDate[d.date] = { date: d.date }
    byDate[d.date][d.platform] = (byDate[d.date][d.platform] || 0) + (d.count || 0)
  })
  const series = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  const platforms = ['Google Trends', 'YouTube', 'TikTok', 'LinkedIn']
  const colors = { 'Google Trends': '#a855f7', 'YouTube': '#ef4444', 'TikTok': '#ec4899', 'LinkedIn': '#3b82f6' }
  return (
    <ResponsiveContainer>
      <LineChart data={series}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip />
        <Legend />
        {platforms.map(p => (
          <Line key={p} type="monotone" dataKey={p} stroke={colors[p]} dot={false} strokeWidth={2} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function Trends() {
  const [trends, setTrends] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [platform, setPlatform] = useState('Todas')
  const [error, setError] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchCount, setSearchCount] = useState(5)
  const [searching, setSearching] = useState(false)
  const [searchPlatform, setSearchPlatform] = useState('Google Trends')
  const [history, setHistory] = useState([])
  const [dateRange, setDateRange] = useState({ preset: 'default', from: '', to: '' })
  const [view, setView] = useState('active')

  useEffect(() => {
    fetch('/api/trends/history?weeks=12').then(r => r.json()).then(d => setHistory(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const fetchTrends = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (platform !== 'Todas') params.set('platform', platform)
      params.set('limit', '30')
      params.set('view', view)
      if (dateRange.from) params.set('from_date', dateRange.from)
      if (dateRange.to) params.set('to_date', dateRange.to)
      const res = await fetch(`/api/trends?${params}`)
      if (!res.ok) throw new Error('Error al cargar tendencias')
      const data = await res.json()
      const arr = Array.isArray(data) ? data : (data.trends || [])
      setTrends(arr)
      setTotal(Array.isArray(data) ? data.length : (data.total ?? arr.length))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [platform, view, dateRange])

  async function handleManualSearch() {
    if (!searchKeyword.trim()) return
    setSearching(true)
    try {
      await fetch('/api/trends/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: searchKeyword.split(',').map(k => k.trim()).filter(Boolean),
          limit: searchCount,
          platform: searchPlatform,
        }),
      })
      fetchTrends()
    } catch (e) { console.error(e) }
    finally { setSearching(false) }
  }

  useEffect(() => { fetchTrends() }, [fetchTrends])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/trends/refresh', { method: 'POST' })
      const data = await res.json()
      if (data.new_trends > 0) await fetchTrends()
    } catch (e) {
      setError('Error al actualizar tendencias')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Tendencias</h1>
          <p className="text-gray-500 text-sm">
            {total > 0 ? `${total} tendencias · actualizado diariamente` : 'Google Trends + YouTube virales aplicados a tu marca'}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Actualizando...' : 'Actualizar ahora'}
        </button>
      </div>

      {Array.isArray(history) && history.length > 0 && (
        <details className="mb-6 bg-white border border-gray-100 rounded-xl p-4">
          <summary className="text-sm font-semibold text-gray-700 cursor-pointer">📈 Histórico de tendencias (últimas 12 semanas)</summary>
          <div className="mt-4 h-64">
            <HistoryChart data={history} />
          </div>
        </details>
      )}

      {/* Platform filter */}
      <div className="flex gap-1 mb-6">
        {PLATFORMS.map(p => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              platform === p
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p !== 'Todas' && platformIcon[p]}
            {p}
          </button>
        ))}
      </div>

      <div className="space-y-3 mb-4">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        <ViewToggle value={view} onChange={setView} options={[
          { val: 'active', label: 'Todos', icon: '📋' },
          { val: 'discarded', label: 'Descartados', icon: '🗑' },
        ]} />
      </div>

      {/* Búsqueda manual de tendencias */}
      <div className="flex gap-2 items-center mb-6 flex-wrap">
        <select value={searchPlatform} onChange={e => setSearchPlatform(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
          {['Google Trends', 'YouTube', 'TikTok', 'LinkedIn'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
          placeholder="Buscar tendencia: ej. IA educación..."
          className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <input type="number" min={1} max={20} value={searchCount}
          onChange={e => setSearchCount(parseInt(e.target.value))}
          className="w-16 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"
          title="Cantidad de resultados" />
        <button onClick={handleManualSearch} disabled={searching || !searchKeyword.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 whitespace-nowrap">
          {searching ? '⏳' : 'Buscar'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {!loading && Array.isArray(trends) && trends.length === 0 && !error && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🔥</div>
          <p className="text-gray-500 font-medium mb-1">No hay tendencias todavía</p>
          <p className="text-gray-400 text-sm mb-4">Actualiza para obtener las tendencias del día</p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-lg"
          >
            {refreshing ? 'Cargando...' : 'Ver tendencias'}
          </button>
        </div>
      )}

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-5/6 mb-3" />
              <div className="h-8 bg-indigo-50 rounded mb-2" />
              <div className="h-8 bg-green-50 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && trends.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {trends.map(trend => (
            <TrendCard key={trend.id} trend={trend} fetchAll={fetchTrends} />
          ))}
        </div>
      )}

      <div className="mt-6">
        <HistoricalArchive
          endpoint="/api/trends/archive-by-month"
          onSelectMonth={month => {
            const [y, m] = month.split('-').map(Number)
            const lastDay = new Date(y, m, 0).getDate()
            setDateRange({ preset: 'custom', from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` })
          }}
        />
      </div>
    </div>
  )
}
