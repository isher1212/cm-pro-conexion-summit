import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp, Video, Lightbulb, Zap } from 'lucide-react'

const PLATFORMS = ['Todas', 'Google Trends', 'YouTube']

const platformIcon = {
  'Google Trends': <TrendingUp size={13} />,
  'YouTube': <Video size={13} />,
}

const platformColor = {
  'Google Trends': 'bg-blue-50 text-blue-600',
  'YouTube': 'bg-red-50 text-red-600',
}

function TrendCard({ trend }) {
  const [panel, setPanel] = useState(false)
  const [mode, setMode] = useState('image') // 'image' | 'video_script'
  const [targetPlatform, setTargetPlatform] = useState('Instagram')
  const [extraSpecs, setExtraSpecs] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null) // { urls?, script? }
  const [sent, setSent] = useState(false)
  const [replicateError, setReplicateError] = useState('')

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
      if (!res.ok) {
        setReplicateError('Error al replicar tendencia.')
        return
      }
      const data = await res.json()
      if (data.error) {
        setReplicateError(data.error)
      } else {
        setResult(data)
      }
    } catch {
      setReplicateError('Error de conexión.')
    } finally {
      setLoading(false)
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
        <h3 className="text-sm font-semibold text-gray-900 leading-snug flex-1">
          {trend.keyword}
        </h3>
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
        <div className="flex gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          <Lightbulb size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-green-700 font-medium">{trend.post_idea}</p>
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
            {isYouTube && (
              <div className="flex gap-2">
                <button onClick={() => setMode('image')}
                  className={`text-xs px-2.5 py-1 rounded-lg border ${mode === 'image' ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  🖼 Imagen
                </button>
                <button onClick={() => setMode('video_script')}
                  className={`text-xs px-2.5 py-1 rounded-lg border ${mode === 'video_script' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  🎬 Guión
                </button>
              </div>
            )}
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
            {replicateError && <p className="text-xs text-red-500">{replicateError}</p>}

            {result && (
              <div className="mt-2 p-3 bg-violet-50 rounded-lg border border-violet-100 space-y-2">
                {Array.isArray(result.urls) && result.urls.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {result.urls.map(url => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" className="w-24 h-24 object-cover rounded-lg border border-violet-100" />
                      </a>
                    ))}
                  </div>
                )}
                {result.script?.hook && (
                  <div className="space-y-1">
                    {[['🎣 Hook', result.script.hook], ['📖 Desarrollo', result.script.desarrollo], ['📢 CTA', result.script.cta]].map(([label, val]) => val ? (
                      <div key={label}>
                        <p className="text-xs font-medium text-violet-700">{label}</p>
                        <p className="text-xs text-violet-900">{val}</p>
                      </div>
                    ) : null)}
                  </div>
                )}
                {!sent ? (
                  <button onClick={handleSendToParrilla}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg">
                    📅 Enviar a Parrilla
                  </button>
                ) : (
                  <p className="text-xs text-green-600 font-medium">✓ Enviado a Parrilla</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
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

  const fetchTrends = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (platform !== 'Todas') params.set('platform', platform)
      params.set('limit', '30')
      const res = await fetch(`/api/trends?${params}`)
      if (!res.ok) throw new Error('Error al cargar tendencias')
      const data = await res.json()
      setTrends(data.trends)
      setTotal(data.total)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [platform])

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

      {/* Búsqueda manual de tendencias */}
          <div className="flex gap-2 items-center mb-6">
            <input
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
              placeholder="Buscar tendencia: ej. IA educación, startups salud..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <input
              type="number" min={1} max={20} value={searchCount}
              onChange={e => setSearchCount(parseInt(e.target.value))}
              className="w-16 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"
              title="Cantidad de resultados"
            />
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

      {!loading && trends.length === 0 && !error && (
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
            <TrendCard key={trend.id} trend={trend} />
          ))}
        </div>
      )}
    </div>
  )
}
