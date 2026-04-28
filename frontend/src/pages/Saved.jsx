import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import DateRangeFilter from '../components/DateRangeFilter'

const TABS = [
  { val: 'all', label: 'Todos', icon: '📚' },
  { val: 'article', label: 'Artículos', icon: '📄' },
  { val: 'trend', label: 'Tendencias', icon: '🔥' },
]

export default function Saved() {
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({ preset: 'default', from: '', to: '' })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (tab !== 'all') params.set('item_type', tab)
    if (search) params.set('search', search)
    if (dateRange.from) params.set('from_date', dateRange.from)
    if (dateRange.to) params.set('to_date', dateRange.to)
    const res = await fetch('/api/saved?' + params.toString())
    setItems(await res.json())
    setLoading(false)
  }, [tab, search, dateRange])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleDelete(id) {
    await fetch(`/api/saved/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Guardados</h1>
      <p className="text-gray-500 text-sm mb-6">{items.length} ítems guardados para tu reporte mensual</p>

      <div className="flex gap-1 mb-4">
        {TABS.map(t => (
          <button key={t.val} onClick={() => setTab(t.val)}
            className={`text-xs px-3 py-1.5 rounded-lg border ${tab === t.val ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar guardados..."
          className="flex-1 max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      </div>

      <div className="mb-4">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">No tienes ítems guardados todavía. Usa el botón 🔖 Guardar en Inteligencia o Tendencias.</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.item_type === 'article' ? 'bg-indigo-50 text-indigo-600' : 'bg-violet-50 text-violet-600'}`}>
                      {item.item_type === 'article' ? '📄 Artículo' : '🔥 Tendencia'}
                    </span>
                    {item.source && <span className="text-xs text-gray-400">{item.source}</span>}
                    {item.platform && <span className="text-xs text-gray-400">· {item.platform}</span>}
                    {item.category && <span className="text-xs text-gray-400">· {item.category}</span>}
                    <span className="text-xs text-gray-300">· {new Date(item.saved_at).toLocaleDateString('es-CO')}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">{item.title}</h3>
                  {item.summary && <p className="text-xs text-gray-600 line-clamp-2">{item.summary}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-600">
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button onClick={() => handleDelete(item.id)} className="text-red-300 hover:text-red-500" title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
