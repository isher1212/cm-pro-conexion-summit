import { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, ExternalLink, Tag } from 'lucide-react'

const CATEGORIES = ['Todas', 'Colombia', 'LATAM', 'Global']

function ArticleCard({ article }) {
  const [expanded, setExpanded] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [converting, setConverting] = useState(false)
  const [converted, setConverted] = useState(false)
  const [convertError, setConvertError] = useState('')
  const [saved, setSaved] = useState(false)

  const displayTitle = article.title_es || article.title

  async function handleAnalyze() {
    setAnalyzing(true)
    setAnalyzeError('')
    try {
      const res = await fetch('/api/intelligence/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          summary: article.summary || '',
          source: article.source || '',
          relevance: article.relevance || '',
        }),
      })
      if (!res.ok) { setAnalyzeError('Error al analizar.'); return }
      const data = await res.json()
      if (data.error) { setAnalyzeError(data.error) } else { setAnalysis(data) }
    } catch { setAnalyzeError('Error de conexión.') }
    finally { setAnalyzing(false) }
  }

  async function handleConvert() {
    setConverting(true)
    setConvertError('')
    try {
      const res = await fetch('/api/intelligence/to-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: article.title, summary: article.summary || '', source: article.source || '' }),
      })
      if (!res.ok) { setConvertError('Error al generar propuesta.'); return }
      const data = await res.json()
      if (data.error) { setConvertError(data.error) } else { setConverted(true) }
    } catch { setConvertError('Error de conexión.') }
    finally { setConverting(false) }
  }

  async function handleSave() {
    await fetch('/api/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_type: 'article',
        title: displayTitle,
        url: article.url || '',
        summary: article.summary || '',
        source: article.source || '',
        category: article.category || '',
        platform: '',
      }),
    })
    setSaved(true)
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-gray-900 leading-snug flex-1">{displayTitle}</h3>
        <a href={article.url} target="_blank" rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-600 flex-shrink-0 mt-0.5">
          <ExternalLink size={15} />
        </a>
      </div>
      {/* Meta */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs text-gray-400">{article.source}</span>
        {article.category && (
          <>
            <span className="text-gray-200">·</span>
            <span className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
              <Tag size={10} />{article.category}
            </span>
          </>
        )}
        <span className="text-gray-200">·</span>
        <span className="text-xs text-gray-400">{article.fetched_at ? new Date(article.fetched_at).toLocaleDateString('es-CO') : ''}</span>
      </div>
      {/* Relevancia corta siempre visible */}
      {article.relevance && (
        <p className="text-xs text-gray-500 mb-2 leading-relaxed line-clamp-2">{article.relevance}</p>
      )}
      {/* Expandible */}
      {expanded && (
        <div className="mb-3 space-y-2">
          {article.summary && <p className="text-xs text-gray-600 leading-relaxed">{article.summary}</p>}
          {analysis && (
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 space-y-2">
              <p className="text-xs font-semibold text-indigo-800">Análisis expandido</p>
              {[
                { key: 'resumen', label: '📋 Resumen' },
                { key: 'aplicacion', label: '🎯 Aplicación' },
                { key: 'alcance', label: '📡 Alcance' },
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
          {analyzeError && <p className="text-xs text-red-500">{analyzeError}</p>}
        </div>
      )}
      {/* Acciones */}
      <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-gray-50">
        <button onClick={() => setExpanded(v => !v)}
          className="text-xs text-gray-500 hover:text-gray-700">
          {expanded ? 'Ver menos ↑' : 'Ver más ↓'}
        </button>
        {expanded && !analysis && (
          <button onClick={handleAnalyze} disabled={analyzing}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50">
            {analyzing ? '⏳ Analizando...' : '🔍 Ampliar análisis'}
          </button>
        )}
        {converted ? (
          <span className="text-xs text-green-600 font-medium">✓ En Parrilla</span>
        ) : (
          <button onClick={handleConvert} disabled={converting}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50">
            {converting ? '⏳...' : '📅 Convertir en propuesta'}
          </button>
        )}
        {convertError && <p className="text-xs text-red-500">{convertError}</p>}
        {saved ? (
          <span className="text-xs text-green-600">✓ Guardado</span>
        ) : (
          <button onClick={handleSave} className="text-xs text-gray-400 hover:text-gray-600">
            🔖 Guardar
          </button>
        )}
      </div>
    </div>
  )
}

export default function Intelligence() {
  const [articles, setArticles] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')
  const [error, setError] = useState('')

  const fetchArticles = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (category !== 'Todas') params.set('category', category)
      params.set('limit', '50')
      const res = await fetch(`/api/intelligence/articles?${params}`)
      if (!res.ok) throw new Error('Error al cargar artículos')
      const data = await res.json()
      setArticles(data.articles)
      setTotal(data.total)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [search, category])

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/intelligence/refresh', { method: 'POST' })
      const data = await res.json()
      if (data.new_articles > 0) await fetchArticles()
    } catch (e) {
      setError('Error al actualizar')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Inteligencia LATAM</h1>
          <p className="text-gray-500 text-sm">
            {total > 0 ? `${total} artículos · actualizado automáticamente cada 6 horas` : 'Noticias de innovación y emprendimiento'}
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

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar artículos..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                category === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {!loading && articles.length === 0 && !error && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-gray-500 font-medium mb-1">No hay artículos todavía</p>
          <p className="text-gray-400 text-sm mb-4">Haz clic en "Actualizar ahora" para cargar las primeras noticias</p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-lg"
          >
            {refreshing ? 'Cargando...' : 'Cargar noticias'}
          </button>
        </div>
      )}

      {loading && (
        <div className="grid gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-5/6" />
            </div>
          ))}
        </div>
      )}

      {!loading && articles.length > 0 && (
        <div className="grid gap-4">
          {articles.map(article => (
            <ArticleCard key={article.id || article.url} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}
