import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ExternalLink, Sparkles } from 'lucide-react'

const SCOPES = [
  { val: 'national', label: 'Nacional' },
  { val: 'international', label: 'Internacional (referentes)' },
]

const EMPTY = { name: '', scope: 'national', category: '', instagram_handle: '', linkedin_handle: '', website: '', notes: '', active: true }

export default function Competitors() {
  const [items, setItems] = useState([])
  const [scope, setScope] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)

  const [showSuggest, setShowSuggest] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [suggestCategory, setSuggestCategory] = useState('')
  const [suggestScope, setSuggestScope] = useState('national')

  async function fetchSuggestions() {
    setSuggesting(true); setSuggestions([])
    try {
      const r = await fetch('/api/competitors/suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: suggestScope, category: suggestCategory }),
      })
      const data = await r.json()
      setSuggestions(data.suggestions || [])
    } finally { setSuggesting(false) }
  }

  async function addSuggestion(s) {
    await fetch('/api/competitors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: s.name, scope: suggestScope, category: s.category || '',
        instagram_handle: s.instagram_handle || '', linkedin_handle: s.linkedin_handle || '',
        website: s.website || '', notes: s.why || '', active: true,
      }),
    })
    setSuggestions(prev => prev.filter(x => x.name !== s.name))
    fetchAll()
  }

  const fetchAll = useCallback(async () => {
    const params = new URLSearchParams()
    if (scope) params.set('scope', scope)
    const res = await fetch('/api/competitors?' + params.toString())
    setItems(await res.json())
  }, [scope])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function save() {
    if (!form.name) return
    if (editing) {
      await fetch(`/api/competitors/${editing}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } else {
      await fetch('/api/competitors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    }
    setShowForm(false); setForm(EMPTY); setEditing(null)
    fetchAll()
  }

  async function del(id) {
    if (!confirm('¿Eliminar este referente y sus posts?')) return
    await fetch(`/api/competitors/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  function startEdit(item) {
    setForm({ ...item, active: !!item.active })
    setEditing(item.id)
    setShowForm(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Referentes</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowSuggest(v => !v)}
            className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2">
            <Sparkles size={14} /> Sugerir con IA
          </button>
          <button onClick={() => { setShowForm(v => !v); setForm(EMPTY); setEditing(null) }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus size={14} /> Agregar
          </button>
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-4">Marcas y referentes que vale la pena seguir e inspirarse ({items.length})</p>

      {showSuggest && (
        <div className="bg-white border border-violet-100 rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-violet-700">✨ Sugerir referentes con IA</h3>
          <div className="flex gap-2 items-center flex-wrap">
            <select value={suggestScope} onChange={e => setSuggestScope(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="national">Nacional</option>
              <option value="international">Internacional</option>
            </select>
            <input value={suggestCategory} onChange={e => setSuggestCategory(e.target.value)}
              placeholder="Categoría/nicho (opcional, ej: aceleradoras, eventos startup)"
              className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <button onClick={fetchSuggestions} disabled={suggesting}
              className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
              {suggesting ? '⏳ Buscando...' : 'Buscar'}
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="space-y-2 mt-3">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                    {s.category && <p className="text-xs text-indigo-600">{s.category}</p>}
                    {s.why && <p className="text-xs text-gray-600 mt-1">{s.why}</p>}
                    <div className="flex gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                      {s.instagram_handle && <span>@{s.instagram_handle}</span>}
                      {s.linkedin_handle && <span>· {s.linkedin_handle}</span>}
                      {s.website && <span>· {s.website}</span>}
                    </div>
                  </div>
                  <button onClick={() => addSuggestion(s)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap">
                    + Agregar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {[{ val: '', label: 'Todos' }, ...SCOPES].map(s => (
          <button key={s.val} onClick={() => setScope(s.val)}
            className={`text-sm px-4 py-2 rounded-lg border ${scope === s.val ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">{editing ? 'Editar referente' : 'Nuevo referente'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Nombre" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <select value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {SCOPES.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
            </select>
            <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              placeholder="Categoría (ej. Aceleradoras, Eventos)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
              placeholder="Website" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input value={form.instagram_handle} onChange={e => setForm({ ...form, instagram_handle: e.target.value })}
              placeholder="@instagram_handle" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input value={form.linkedin_handle} onChange={e => setForm({ ...form, linkedin_handle: e.target.value })}
              placeholder="LinkedIn handle" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Notas — qué hacen bien, por qué los miramos..." rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={save} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg">
              {editing ? 'Actualizar' : 'Guardar'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY); setEditing(null) }}
              className="text-sm text-gray-500 px-3 py-2">Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-gray-400">Aún no hay referentes. Agrégalos manualmente o pide sugerencias a la IA.</p>}
        {items.map(it => <CompetitorCard key={it.id} item={it} onEdit={() => startEdit(it)} onDelete={() => del(it.id)} />)}
      </div>
    </div>
  )
}

function CompetitorCard({ item, onEdit, onDelete }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)

  async function analyze() {
    setLoading(true)
    try {
      const r = await fetch(`/api/competitors/${item.id}/analyze`, { method: 'POST' })
      setAnalysis(await r.json())
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900">{item.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${item.scope === 'international' ? 'bg-violet-50 text-violet-700' : 'bg-indigo-50 text-indigo-700'}`}>
              {item.scope === 'international' ? '🌎 Internacional' : '🇨🇴 Nacional'}
            </span>
            {item.category && <span className="text-xs text-gray-400">· {item.category}</span>}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            {item.instagram_handle && (
              <a href={`https://instagram.com/${item.instagram_handle.replace('@','')}`} target="_blank" rel="noreferrer" className="hover:text-indigo-600">@{item.instagram_handle.replace('@','')}</a>
            )}
            {item.linkedin_handle && (
              <a href={`https://linkedin.com/${item.linkedin_handle.startsWith('company/') ? '' : 'company/'}${item.linkedin_handle}`} target="_blank" rel="noreferrer" className="hover:text-indigo-600">in/{item.linkedin_handle}</a>
            )}
            {item.website && (
              <a href={item.website} target="_blank" rel="noreferrer" className="hover:text-indigo-600 inline-flex items-center gap-1">
                <ExternalLink size={11} /> Web
              </a>
            )}
          </div>
          {item.notes && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{item.notes}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={onEdit} className="text-xs text-gray-400 hover:text-gray-600">Editar</button>
          <button onClick={onDelete} className="text-red-300 hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="pt-2 border-t border-gray-50 mt-2">
        <button onClick={analyze} disabled={loading}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50 inline-flex items-center gap-1">
          <Sparkles size={12} /> {loading ? 'Analizando...' : 'Analizar con IA'}
        </button>
        {analysis && !analysis.error && (
          <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100 space-y-2">
            {[
              { key: 'que_hacen_bien', label: '✅ Qué hacen bien' },
              { key: 'que_podemos_aplicar', label: '🎯 Qué podemos aplicar' },
              { key: 'diferenciadores', label: '✨ Diferenciadores' },
              { key: 'riesgos', label: '⚠️ Riesgos' },
            ].map(({ key, label }) => analysis[key] ? (
              <div key={key}>
                <p className="text-xs font-medium text-indigo-700">{label}</p>
                <p className="text-xs text-indigo-900">{analysis[key]}</p>
              </div>
            ) : null)}
          </div>
        )}
        {analysis?.error && <p className="text-xs text-red-500 mt-2">{analysis.error}</p>}
      </div>
    </div>
  )
}
