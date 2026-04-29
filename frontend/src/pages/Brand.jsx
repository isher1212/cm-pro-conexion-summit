import { useState, useEffect, useCallback, useRef } from 'react'

const FIELDS = [
  { key: 'name', label: 'Nombre de la marca', type: 'text' },
  { key: 'tagline', label: 'Tagline / lema', type: 'text', aiFillable: true },
  { key: 'mission', label: 'Misión', type: 'textarea', aiFillable: true },
  { key: 'vision', label: 'Visión', type: 'textarea', aiFillable: true },
  { key: 'values_text', label: 'Valores', type: 'textarea', aiFillable: true },
  { key: 'tone', label: 'Tono de voz', type: 'text', aiFillable: true },
  { key: 'style_guide', label: 'Guía de estilo', type: 'textarea', aiFillable: true },
  { key: 'target_audience', label: 'Audiencia objetivo', type: 'textarea', aiFillable: true },
  { key: 'differentiators', label: 'Diferenciadores', type: 'textarea', aiFillable: true },
  { key: 'avoid_topics', label: 'Temas a evitar', type: 'textarea', aiFillable: true },
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
  const [filling, setFilling] = useState(false)
  const [fillingField, setFillingField] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef(null)

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

  async function loadSummitPreset() {
    if (!confirm('Esto rellenará los campos vacíos con la información de Conexión Summit. Los campos que ya tengan datos no se sobrescribirán. ¿Continuar?')) return
    const r = await fetch('/api/brand/preset-summit', { method: 'POST' })
    const preset = await r.json()
    setBrand(b => {
      const merged = { ...b }
      for (const [k, v] of Object.entries(preset)) {
        if (!merged[k] || (typeof merged[k] === 'string' && !merged[k].trim())) {
          merged[k] = v
        }
      }
      return merged
    })
    setSavedMsg('✓ Datos de Conexión Summit cargados (recuerda guardar)')
    setTimeout(() => setSavedMsg(''), 5000)
  }

  async function aiFillField(field) {
    setFilling(true); setFillingField(field)
    try {
      const r = await fetch('/api/brand/ai-fill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_brand: brand, target_field: field || '' }),
      })
      const data = await r.json()
      if (data.error) {
        alert(data.error)
      } else if (data.filled) {
        setBrand(b => ({ ...b, ...data.filled }))
        setSavedMsg(`✓ ${Object.keys(data.filled).length} campo(s) completados con IA (recuerda guardar)`)
        setTimeout(() => setSavedMsg(''), 5000)
      }
    } catch {
      alert('Error de conexión al completar con IA')
    } finally { setFilling(false); setFillingField('') }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      alert('Logo demasiado grande. Máximo 1MB.')
      return
    }
    setUploadingLogo(true)
    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const dataUrl = ev.target.result
        if (brand.id) {
          await fetch('/api/brand/upload-logo', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brand_id: brand.id, data_url: dataUrl }),
          })
        }
        setBrand(b => ({ ...b, logo_url: dataUrl }))
        setSavedMsg('✓ Logo cargado')
        setTimeout(() => setSavedMsg(''), 3000)
      }
      reader.readAsDataURL(file)
    } finally { setUploadingLogo(false) }
  }

  const isEmpty = !brand.name && !brand.mission && !brand.vision

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Marca</h1>
          <p className="text-gray-500 text-sm">
            Toda la información de la marca alimenta el contexto de IA. Cambia esto y todas las generaciones se adaptan automáticamente.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={loadSummitPreset}
            className="bg-violet-50 hover:bg-violet-100 text-violet-700 text-sm font-medium px-3 py-2 rounded-lg border border-violet-200">
            🎯 Cargar datos de Conexión Summit
          </button>
          <button onClick={() => aiFillField('')} disabled={filling}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg disabled:opacity-50">
            {filling && !fillingField ? '⏳ Completando...' : '✨ Completar vacíos con IA'}
          </button>
        </div>
      </div>

      {isEmpty && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-violet-800 font-medium mb-1">¿Primera vez configurando la marca?</p>
          <p className="text-xs text-violet-700">Click en "🎯 Cargar datos de Conexión Summit" arriba para rellenar todos los campos con la info pre-cargada de Summit. Después puedes editar lo que quieras.</p>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Logo</label>
          <div className="flex items-center gap-3 flex-wrap">
            {brand.logo_url ? (
              <img src={brand.logo_url} alt="Logo" className="w-20 h-20 object-contain rounded-lg border border-gray-200 bg-gray-50" />
            ) : (
              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-xs">Sin logo</div>
            )}
            <div className="space-y-1">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                ref={fileInputRef} onChange={handleLogoUpload} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}
                className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-sm px-3 py-1.5 rounded-lg disabled:opacity-50">
                {uploadingLogo ? '⏳ Cargando...' : (brand.logo_url ? 'Cambiar logo' : 'Subir logo')}
              </button>
              {brand.logo_url && (
                <button type="button" onClick={() => update('logo_url', '')}
                  className="text-xs text-red-500 hover:text-red-700 ml-2">
                  Quitar
                </button>
              )}
              <p className="text-xs text-gray-400">PNG, JPG, WebP o SVG · máx 1MB</p>
            </div>
          </div>
        </div>

        {FIELDS.map(f => (
          <div key={f.key}>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-700">{f.label}</label>
              {f.aiFillable && (
                <button type="button" onClick={() => aiFillField(f.key)}
                  disabled={filling}
                  className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-50">
                  {fillingField === f.key ? '⏳' : '✨'} {fillingField === f.key ? 'Generando...' : 'IA'}
                </button>
              )}
            </div>
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
          <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">Paleta de colores corporativos</h3>
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
