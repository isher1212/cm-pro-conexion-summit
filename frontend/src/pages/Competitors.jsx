import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ExternalLink, Sparkles, Activity, Zap } from 'lucide-react'

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

  const [showPresets, setShowPresets] = useState(false)
  const [presets, setPresets] = useState({ national: [], international: [] })
  const [presetScope, setPresetScope] = useState('national')

  useEffect(() => {
    fetch('/api/competitors/presets').then(r => r.json()).then(d => {
      setPresets({ national: d.national || [], international: d.international || [] })
    }).catch(() => {})
  }, [])

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
        website: s.website || '', notes: s.why || s.notes || '', active: true,
      }),
    })
    setSuggestions(prev => prev.filter(x => x.name !== s.name))
    fetchAll()
  }

  async function addPreset(p) {
    await fetch('/api/competitors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: p.name, scope: presetScope, category: p.category || '',
        instagram_handle: p.instagram_handle || '', linkedin_handle: p.linkedin_handle || '',
        website: p.website || '', notes: p.notes || '', active: true,
      }),
    })
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

  const existingNames = new Set(items.map(i => i.name?.toLowerCase()))
  const visiblePresets = (presets[presetScope] || []).filter(p => !existingNames.has(p.name?.toLowerCase()))

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Referentes</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setShowPresets(v => !v); setShowSuggest(false) }}
            className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1 border border-amber-200">
            ⚡ Catálogo curado
          </button>
          <button onClick={() => { setShowSuggest(v => !v); setShowPresets(false) }}
            className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1">
            <Sparkles size={14} /> Sugerir con IA
          </button>
          <button onClick={() => { setShowForm(v => !v); setForm(EMPTY); setEditing(null) }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1">
            <Plus size={14} /> Manual
          </button>
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-4">Marcas y referentes que vale la pena seguir e inspirarse ({items.length})</p>

      {showPresets && (
        <div className="bg-white border border-amber-100 rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-700">⚡ Catálogo curado de referentes</h3>
            <div className="flex gap-1">
              {SCOPES.map(s => (
                <button key={s.val} onClick={() => setPresetScope(s.val)}
                  className={`text-xs px-2.5 py-1 rounded-lg border ${presetScope === s.val ? 'bg-amber-600 text-white border-amber-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500">Lista pre-cargada de referentes relevantes para Conexión Summit. Click en "+ Agregar" para sumarlos a tu lista.</p>
          {visiblePresets.length === 0 && <p className="text-xs text-gray-400">Ya agregaste todos los presets de esta categoría.</p>}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {visiblePresets.map((p, i) => (
              <div key={i} className="flex items-start justify-between gap-3 p-3 bg-amber-50/40 rounded-lg border border-amber-100/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                  <p className="text-xs text-amber-700">{p.category}</p>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{p.notes}</p>
                  <div className="flex gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                    {p.instagram_handle && <span>@{p.instagram_handle}</span>}
                    {p.linkedin_handle && <span>· in/{p.linkedin_handle}</span>}
                    {p.website && <span>· web</span>}
                  </div>
                </div>
                <button onClick={() => addPreset(p)}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap">
                  + Agregar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <div className="space-y-2 mt-3 max-h-80 overflow-y-auto">
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
        {items.length === 0 && <p className="text-sm text-gray-400">Aún no hay referentes. Usa el catálogo curado, sugerencias con IA o agrégalos manualmente.</p>}
        {items.map(it => <CompetitorCard key={it.id} item={it} onEdit={() => startEdit(it)} onDelete={() => del(it.id)} />)}
      </div>
    </div>
  )
}

function CompetitorCard({ item, onEdit, onDelete }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [monitor, setMonitor] = useState(null)
  const [monitoring, setMonitoring] = useState(false)

  async function analyze() {
    setLoading(true)
    try {
      const r = await fetch(`/api/competitors/${item.id}/analyze`, { method: 'POST' })
      setAnalysis(await r.json())
    } finally { setLoading(false) }
  }

  async function runMonitor() {
    setMonitoring(true); setMonitor(null)
    try {
      const r = await fetch(`/api/competitors/${item.id}/monitor`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      setMonitor(await r.json())
    } finally { setMonitoring(false) }
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
      <div className="pt-2 border-t border-gray-50 mt-2 flex flex-wrap gap-3">
        <button onClick={analyze} disabled={loading}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50 inline-flex items-center gap-1">
          <Sparkles size={12} /> {loading ? 'Analizando...' : 'Analizar con IA'}
        </button>
        <button onClick={runMonitor} disabled={monitoring}
          className="text-xs text-violet-600 hover:text-violet-800 font-medium disabled:opacity-50 inline-flex items-center gap-1">
          <Activity size={12} /> {monitoring ? 'Monitoreando...' : 'Monitorear redes con IA'}
        </button>
      </div>

      {analysis && !analysis.error && (
        <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100 space-y-2">
          {[
            { key: 'que_hacen_bien', label: '✅ Qué hacen bien' },
            { key: 'que_podemos_aplicar', label: '🎯 Qué podemos aplicar' },
            { key: 'diferenciadores', label: '✨ Diferenciadores' },
            { key: 'riesgos', label: '⚠ Riesgos' },
          ].map(({ key, label }) => analysis[key] ? (
            <div key={key}>
              <p className="text-xs font-medium text-indigo-700">{label}</p>
              <p className="text-xs text-indigo-900">{analysis[key]}</p>
            </div>
          ) : null)}
        </div>
      )}
      {analysis?.error && <p className="text-xs text-red-500 mt-2">{analysis.error}</p>}

      {monitor && !monitor.error && (
        <div className="mt-3 p-3 bg-violet-50 rounded-lg border border-violet-100 space-y-2">
          <p className="text-xs font-semibold text-violet-700 flex items-center gap-1"><Zap size={12} /> Monitoreo de redes</p>
          {monitor.estilo_comunicacion && (
            <div>
              <p className="text-xs font-medium text-violet-700">📡 Estilo de comunicación</p>
              <p className="text-xs text-gray-700">{monitor.estilo_comunicacion}</p>
            </div>
          )}
          {Array.isArray(monitor.temas_recurrentes) && monitor.temas_recurrentes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-violet-700">🔁 Temas recurrentes</p>
              <ul className="text-xs text-gray-700 list-disc list-inside">
                {monitor.temas_recurrentes.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
          {Array.isArray(monitor.tendencias_que_siguen) && monitor.tendencias_que_siguen.length > 0 && (
            <div>
              <p className="text-xs font-medium text-violet-700">📈 Tendencias que siguen</p>
              <ul className="text-xs text-gray-700 list-disc list-inside">
                {monitor.tendencias_que_siguen.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
          {monitor.lo_destacado && (
            <div>
              <p className="text-xs font-medium text-violet-700">⭐ Lo destacado</p>
              <p className="text-xs text-gray-700">{monitor.lo_destacado}</p>
            </div>
          )}
          {Array.isArray(monitor.que_aplicar_a_summit) && monitor.que_aplicar_a_summit.length > 0 && (
            <div>
              <p className="text-xs font-medium text-violet-700">🎯 Qué aplicar a Summit</p>
              <ul className="text-xs text-gray-700 list-disc list-inside">
                {monitor.que_aplicar_a_summit.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
          {monitor.como_superarlos && (
            <div>
              <p className="text-xs font-medium text-violet-700">🚀 Cómo superarlos</p>
              <p className="text-xs text-gray-700">{monitor.como_superarlos}</p>
            </div>
          )}
        </div>
      )}
      {monitor?.error && <p className="text-xs text-red-500 mt-2">{monitor.error}</p>}
    </div>
  )
}
