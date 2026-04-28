import { useState } from 'react'
import { Calendar } from 'lucide-react'

const PRESETS = [
  { val: 'default', label: 'Por defecto', days: null },
  { val: 'this_month', label: 'Este mes' },
  { val: 'last_month', label: 'Mes pasado' },
  { val: 'last_3_months', label: '3 meses' },
  { val: 'this_year', label: 'Año' },
  { val: 'all', label: 'Todo' },
  { val: 'custom', label: 'Rango...' },
]

export default function DateRangeFilter({ value, onChange }) {
  const [preset, setPreset] = useState(value?.preset || 'default')
  const [from, setFrom] = useState(value?.from || '')
  const [to, setTo] = useState(value?.to || '')

  function pick(p) {
    setPreset(p.val)
    let f = '', t = ''
    const today = new Date()
    if (p.val === 'this_month') {
      f = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    } else if (p.val === 'last_month') {
      const d = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      const t2 = new Date(today.getFullYear(), today.getMonth(), 0)
      t = `${t2.getFullYear()}-${String(t2.getMonth() + 1).padStart(2, '0')}-${String(t2.getDate()).padStart(2, '0')}`
    } else if (p.val === 'last_3_months') {
      const d = new Date(today.getFullYear(), today.getMonth() - 3, 1)
      f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    } else if (p.val === 'this_year') {
      f = `${today.getFullYear()}-01-01`
    }
    setFrom(f)
    setTo(t)
    if (p.val !== 'custom') {
      onChange({ preset: p.val, from: f, to: t })
    }
  }

  function applyCustom() {
    onChange({ preset: 'custom', from, to })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap items-center">
        <Calendar size={13} className="text-gray-400" />
        {PRESETS.map(p => (
          <button key={p.val} onClick={() => pick(p)}
            className={`text-xs px-2.5 py-1 rounded-lg border ${preset === p.val ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex gap-2 items-center">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs" />
          <span className="text-xs text-gray-400">a</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs" />
          <button onClick={applyCustom} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg">
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}
