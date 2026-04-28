import { useState, useEffect, useCallback } from 'react'

const FIELDS = [
  { key: 'name', label: 'Nombre de la marca', type: 'text' },
  { key: 'tagline', label: 'Tagline / lema', type: 'text' },
  { key: 'mission', label: 'Misión', type: 'textarea' },
  { key: 'vision', label: 'Visión', type: 'textarea' },
  { key: 'values_text', label: 'Valores', type: 'textarea' },
  { key: 'tone', label: 'Tono de voz', type: 'text' },
  { key: 'style_guide', label: 'Guía de estilo', type: 'textarea' },
  { key: 'target_audience', label: 'Audiencia objetivo', type: 'textarea' },
  { key: 'differentiators', label: 'Diferenciadores', type: 'textarea' },
  { key: 'avoid_topics', label: 'Temas a evitar', type: 'textarea' },
  { key: 'logo_url', label: 'URL del logo', type: 'text' },
  { key: 'website', label: 'Web', type: 'text' },
  { key: 'instagram', label: 'Instagram', type: 'text' },
  { key: 'tiktok', label: 'TikTok', type: 'text' },
  { key: 'linkedin', label: 'LinkedIn', type: 'text' },
  { key: 'youtube', label: 'YouTube', type: 'text' },
]

const COLORS = [
  { key: 'primary_color', label: 'Color primario' },
  { key: 'secondary_color', label: 'Color secundario' },
  { key: 'accent_color', label: 'Color de acento' },
]

const FONTS = [
  { key: 'font_primary', label: 'Fuente principal' },
  { key: 'font_secondary', label: 'Fuente secundaria' },
]

export default function Brand() {
  const [brand, setBrand] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const loadCurrent = useCallback(async () => {
    const r = await fetch('/api/brand/current')
    const data = await r.json()
    setBrand(data && data.id ? data : { name: '' })
  }, [])

  useEffect(() => { loadCurrent() }, [loadCurrent])

  if (!brand) return <p className="text-sm text-gray-400">Cargando...</p>

  async function save() {
    setSaving(true); setSavedMsg('')
    try {
      const method = brand.id ? 'PATCH' : 'POST'
      const url = brand.id ? `/api/brand/${brand.id}` : '/api/brand'
      const r = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brand),
      })
      const data = await r.json()
      if (data.id && !brand.id) {
        setBrand({ ...brand, id: data.id })
        await fetch(`/api/brand/${data.id}/activate`, { method: 'POST' })
      } else if (brand.id) {
        await fetch(`/api/brand/${brand.id}/activate`, { method: 'POST' })
      }
      setSavedMsg('✓ Guardado')
      setTimeout(() => setSavedMsg(''), 3000)
    } finally { setSaving(false) }
  }

  function update(key, value) {
    setBrand(b => ({ ...b, [key]: value }))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Marca</h1>
      <p className="text-gray-500 text-sm mb-6">
        Toda la información de la marca alimenta el contexto de IA. Cambia esto y todas las generaciones se adaptan automáticamente.
      </p>

      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea value={brand[f.key] || ''} onChange={e => update(f.key, e.target.value)}
                rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            ) : (
              <input value={brand[f.key] || ''} onChange={e => update(f.key, e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            )}
          </div>
        ))}

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">Paleta de colores</h3>
          <div className="grid grid-cols-3 gap-3">
            {COLORS.map(c => (
              <div key={c.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{c.label}</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={brand[c.key] || '#6366f1'}
                    onChange={e => update(c.key, e.target.value)}
                    className="w-12 h-9 border border-gray-200 rounded-lg cursor-pointer" />
                  <input value={brand[c.key] || ''} onChange={e => update(c.key, e.target.value)}
                    placeholder="#6366f1"
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">Tipografía</h3>
          <div className="grid grid-cols-2 gap-3">
            {FONTS.map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                <input value={brand[f.key] || ''} onChange={e => update(f.key, e.target.value)}
                  placeholder="ej: Inter, Roboto, Helvetica..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 items-center pt-3">
          <button onClick={save} disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar marca activa'}
          </button>
          {savedMsg && <span className="text-xs text-green-600">{savedMsg}</span>}
        </div>
      </div>
    </div>
  )
}
