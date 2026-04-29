import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit2, Copy, Sparkles } from 'lucide-react'

const EMPTY = { name: '', content: '', pillar: '', tags: '' }

const USE_CASES = [
  'Anuncio de speaker',
  'Recordatorio de evento',
  'Agradecimiento a sponsor',
  'Behind the scenes',
  'Tip o consejo',
  'Caso de éxito',
  'Pregunta a la comunidad',
  'Lanzamiento de iniciativa',
  'Convocatoria',
  'Reflexión / liderazgo',
  'Recap del día',
  'Otro (especificar abajo)',
]

export default function Templates() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showAIForm, setShowAIForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [aiForm, setAIForm] = useState({ use_case: USE_CASES[0], custom_use_case: '', keywords: '', tone: '', pillar: '' })
  const [generating, setGenerating] = useState(false)
  const [aiError, setAIError] = useState('')

  const fetchAll = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    const res = await fetch('/api/templates?' + params.toString())
    setItems(await res.json())
  }, [search])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function save() {
    if (!form.name || !form.content) return
    if (editing) {
      await fetch(`/api/templates/${editing}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    } else {
      await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    }
    setShowForm(false); setForm(EMPTY); setEditing(null)
    fetchAll()
  }

  async function del(id) {
    if (!confirm('¿Eliminar plantilla?')) return
    await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  function startEdit(t) {
    setForm({ name: t.name, content: t.content, pillar: t.pillar || '', tags: t.tags || '' })
    setEditing(t.id); setShowForm(true); setShowAIForm(false)
  }

  function copyContent(c) {
    navigator.clipboard?.writeText(c).catch(() => {})
  }

  async function generateWithAI() {
    setGenerating(true); setAIError('')
    try {
      const useCase = aiForm.use_case === USE_CASES[USE_CASES.length - 1] ? aiForm.custom_use_case : aiForm.use_case
      if (!useCase.trim()) { setAIError('Especifica el caso de uso'); return }
      const r = await fetch('/api/templates/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_case: useCase, keywords: aiForm.keywords, tone: aiForm.tone, pillar: aiForm.pillar }),
      })
      const data = await r.json()
      if (data.error) { setAIError(data.error); return }
      setForm({ name: data.name || '', content: data.content || '', pillar: data.pillar || '', tags: data.tags || '' })
      setShowAIForm(false); setShowForm(true); setEditing(null)
    } catch {
      setAIError('Error de conexión')
    } finally { setGenerating(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Plantillas de copy</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowAIForm(v => !v); setShowForm(false); setForm(EMPTY); setEditing(null) }}
            className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-2">
            <Sparkles size={14} /> Generar con IA
          </button>
          <button onClick={() => { setShowForm(v => !v); setShowAIForm(false); setForm(EMPTY); setEditing(null) }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-2">
            <Plus size={14} /> Manual
          </button>
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Plantillas reutilizables con variables tipo <code className="bg-gray-100 px-1 rounded text-xs">{'{{nombre_speaker}}'}</code>, <code className="bg-gray-100 px-1 rounded text-xs">{'{{fecha}}'}</code>. Sirven para crear posts repetitivos rápido — anuncios de speakers, recordatorios, agradecimientos a sponsors, etc.
      </p>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 text-xs text-blue-800">
        <p className="font-semibold mb-1">¿Cómo funcionan?</p>
        <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
          <li>Creas una plantilla con variables entre <code className="bg-blue-100 px-1 rounded">{'{{...}}'}</code></li>
          <li>Cuando edites una propuesta en Parrilla, eliges la plantilla y rellenas las variables</li>
          <li>El copy queda listo, manteniendo tu tono consistente sin reescribir cada vez</li>
        </ol>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Buscar plantilla..."
        className="max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4" />

      {showAIForm && (
        <div className="bg-white border border-violet-200 rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-violet-700 flex items-center gap-2">
            <Sparkles size={14} /> Generar plantilla con IA
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Caso de uso *</label>
              <select value={aiForm.use_case} onChange={e => setAIForm({ ...aiForm, use_case: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {USE_CASES.map(uc => <option key={uc}>{uc}</option>)}
              </select>
            </div>
            {aiForm.use_case === USE_CASES[USE_CASES.length - 1] && (
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Caso personalizado</label>
                <input value={aiForm.custom_use_case} onChange={e => setAIForm({ ...aiForm, custom_use_case: e.target.value })}
                  placeholder="ej: Pregunta sobre liderazgo"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="text-xs text-gray-600 mb-1 block">Palabras clave</label>
              <input value={aiForm.keywords} onChange={e => setAIForm({ ...aiForm, keywords: e.target.value })}
                placeholder="ej: emprendimiento, LATAM, conexión, oportunidad..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Tono (opcional)</label>
              <input value={aiForm.tone} onChange={e => setAIForm({ ...aiForm, tone: e.target.value })}
                placeholder="profesional, cercano, inspirador..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Pilar (opcional)</label>
              <input value={aiForm.pillar} onChange={e => setAIForm({ ...aiForm, pillar: e.target.value })}
                placeholder="Speakers, Behind the Scenes..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={generateWithAI} disabled={generating}
              className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-1">
              {generating ? '⏳ Generando...' : '✨ Generar plantilla'}
            </button>
            <button onClick={() => setShowAIForm(false)} className="text-sm text-gray-500 px-3 py-2">Cancelar</button>
          </div>
          {aiError && <p className="text-xs text-red-500">{aiError}</p>}
          <p className="text-xs text-gray-400">La IA genera el contenido, luego puedes editarlo antes de guardar.</p>
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">{editing ? 'Editar' : 'Nueva plantilla (manual)'}</h3>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre (ej. Anuncio de speaker)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input value={form.pillar} onChange={e => setForm({ ...form, pillar: e.target.value })}
            placeholder="Pilar (opcional)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
            rows={6}
            placeholder={"Hola comunidad! 🎤 Hoy tenemos a {{nombre_speaker}} hablando sobre {{tema}} el {{fecha}}..."}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
            placeholder="Tags (separados por coma)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={save} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg">
              {editing ? 'Actualizar' : 'Guardar'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY); setEditing(null) }} className="text-sm text-gray-500 px-3 py-2">Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-gray-400">No tienes plantillas aún. Crea la primera con IA o manualmente.</p>}
        {items.map(t => (
          <div key={t.id} className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900">{t.name}</h3>
                  {t.pillar && <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{t.pillar}</span>}
                </div>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{t.content}</pre>
                {Array.isArray(t.variables) && t.variables.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-2">
                    {t.variables.map(v => (
                      <span key={v} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{`{{${v}}}`}</span>
                    ))}
                  </div>
                )}
                {t.tags && <p className="text-xs text-gray-400 mt-2">{t.tags}</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => copyContent(t.content)} className="text-gray-400 hover:text-gray-600" title="Copiar"><Copy size={13} /></button>
                <button onClick={() => startEdit(t)} className="text-gray-400 hover:text-gray-600" title="Editar"><Edit2 size={13} /></button>
                <button onClick={() => del(t.id)} className="text-red-300 hover:text-red-500" title="Eliminar"><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
