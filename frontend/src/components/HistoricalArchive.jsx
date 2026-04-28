import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'

export default function HistoricalArchive({ endpoint, onSelectMonth }) {
  const [months, setMonths] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(endpoint)
      .then(r => r.json())
      .then(d => setMonths(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, endpoint])

  const monthLabel = (ym) => {
    if (!ym) return ym
    const [y, m] = ym.split('-')
    const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return `${names[parseInt(m) - 1] || m} ${y}`
  }

  return (
    <details className="bg-gray-50 border border-gray-100 rounded-xl p-3" open={open} onToggle={e => setOpen(e.target.open)}>
      <summary className="text-sm font-semibold text-gray-700 cursor-pointer flex items-center gap-2">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} 📅 Histórico por mes
      </summary>
      <div className="mt-3 space-y-1">
        {loading && <p className="text-xs text-gray-400">Cargando...</p>}
        {!loading && months.length === 0 && <p className="text-xs text-gray-400">No hay histórico aún.</p>}
        {!loading && months.map(m => (
          <button key={m.month} onClick={() => onSelectMonth(m.month)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white text-sm text-gray-700 transition-colors">
            <span>{monthLabel(m.month)}</span>
            <span className="text-xs text-gray-400">{m.count}</span>
          </button>
        ))}
      </div>
    </details>
  )
}
