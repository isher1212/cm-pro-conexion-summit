import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, Edit2 } from 'lucide-react'
import DateRangeFilter from '../components/DateRangeFilter'
import HistoricalArchive from '../components/HistoricalArchive'

export default function Library() {
  const [images, setImages] = useState([])
  const [platform, setPlatform] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({ preset: 'default', from: '', to: '' })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (platform) params.set('platform', platform)
      if (search) params.set('search', search)
      if (dateRange.from) params.set('from_date', dateRange.from)
      if (dateRange.to) params.set('to_date', dateRange.to)
      const res = await fetch('/api/library/images?' + params.toString())
      if (!res.ok) throw new Error('error')
      setImages(await res.json())
    } catch {
      setImages([])
    } finally {
      setLoading(false)
    }
  }, [platform, search, dateRange])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleDelete(id) {
    if (!confirm('¿Eliminar imagen del banco?')) return
    await fetch(`/api/library/images/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Galería de imágenes</h1>
      <p className="text-gray-500 text-sm mb-6">{images.length} imágenes generadas con IA</p>

      <div className="mb-4">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por prompt..."
          className="flex-1 max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <select value={platform} onChange={e => setPlatform(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Todas las plataformas</option>
          <option value="Instagram">Instagram</option>
          <option value="TikTok">TikTok</option>
          <option value="LinkedIn">LinkedIn</option>
          <option value="YouTube">YouTube</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : images.length === 0 ? (
        <p className="text-sm text-gray-400">Aún no has generado imágenes. Empieza desde Parrilla o Tendencias.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map(img => (
            <div key={img.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden group hover:shadow-md transition-shadow">
              <a href={img.url} target="_blank" rel="noreferrer" className="block aspect-square bg-gray-50">
                <img src={img.url} alt={img.prompt || ''} className="w-full h-full object-cover" />
              </a>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">{img.platform || '—'} · {img.aspect_ratio || ''}</span>
                  <Link to={`/editor?url=${encodeURIComponent(img.url)}`}
                    className="text-indigo-400 hover:text-indigo-600" title="Editar">
                    <Edit2 size={12} />
                  </Link>
                  <button onClick={() => handleDelete(img.id)} className="text-red-300 hover:text-red-500" title="Eliminar">
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2" title={img.prompt}>{img.prompt}</p>
                <p className="text-xs text-gray-300 mt-1">{img.created_at ? new Date(img.created_at).toLocaleDateString('es-CO') : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <HistoricalArchive
          endpoint="/api/library/archive-by-month"
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
