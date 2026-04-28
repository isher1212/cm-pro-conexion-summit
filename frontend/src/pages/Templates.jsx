import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit2, Copy } from 'lucide-react'

const EMPTY = { name: '', content: '', pillar: '', tags: '' }

export default function Templates() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)

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
    setEditing(t.id); setShowForm(true)
  }

  function copyContent(c) {
    navigator.clipboard?.writeText(c).catch(() => {})
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Plantillas de copy</h1>
        <button onClick={() => { setShowForm(v => !v); setForm(EMPTY); setEditing(null) }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus size={14} /> Nueva
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-6">Plantillas reutilizables con variables tipo {'{{nombre_speaker}}'}, {'{{fecha_evento}}'}</p>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Buscar plantilla..."
        className="max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4" />

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">{editing ? 'Editar' : 'Nueva plantilla'}</h3>
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
        {items.length === 0 && <p className="text-sm text-gray-400">No tienes plantillas aún.</p>}
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
