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
