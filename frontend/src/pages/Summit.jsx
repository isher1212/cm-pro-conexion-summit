import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Plus, Trash2, Edit2 } from 'lucide-react'

const TABS = [
  { val: 'edition', label: 'Edición actual' },
  { val: 'history', label: 'Histórico' },
  { val: 'speakers', label: 'Speakers' },
  { val: 'sponsors', label: 'Sponsors' },
  { val: 'key_people', label: 'Personas clave' },
  { val: 'summit_milestones', label: 'Hitos' },
  { val: 'event_goals', label: 'Metas' },
]

export default function Summit() {
  const [tab, setTab] = useState('edition')
  const [edition, setEdition] = useState(null)

  const loadCurrent = useCallback(async () => {
    const r = await fetch('/api/summit/editions/current')
    setEdition(await r.json())
  }, [])

  useEffect(() => { loadCurrent() }, [loadCurrent])

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Conexión Summit</h1>
        {edition?.year && <span className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">Edición {edition.year}</span>}
      </div>
      <p className="text-gray-500 text-sm mb-6">Hub central del evento — speakers, sponsors, hitos, metas y panorama IA</p>

      <div className="flex gap-2 mb-6 flex-wrap border-b border-gray-100 pb-2">
        {TABS.map(t => (
          <button key={t.val} onClick={() => setTab(t.val)}
            className={`text-sm px-3 py-1.5 rounded-lg ${tab === t.val ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'edition' && edition && <EditionPanel edition={edition} onChange={loadCurrent} />}
      {tab === 'history' && <HistoryPanel />}
      {tab !== 'edition' && tab !== 'history' && edition && <ItemsPanel table={tab} editionId={edition.id} />}
    </div>
  )
}

function EditionPanel({ edition, onChange }) {
  const [form, setForm] = useState(edition)
  const [saving, setSaving] = useState(false)
  const [panorama, setPanorama] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { setForm(edition) }, [edition])

  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/summit/editions/${edition.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      onChange()
    } finally { setSaving(false) }
  }

  async function runPanorama() {
    setLoading(true); setPanorama(null)
    try {
      const r = await fetch(`/api/summit/editions/${edition.id}/panorama`, { method: 'POST' })
      setPanorama(await r.json())
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Datos de la edición</h2>
        <div className="grid grid-cols-2 gap-3">
          <input value={form.theme || ''} onChange={e => setForm({ ...form, theme: e.target.value })}
            placeholder="Tema/lema del año" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })}
            placeholder="Lugar" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={form.date_start || ''} onChange={e => setForm({ ...form, date_start: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={form.date_end || ''} onChange={e => setForm({ ...form, date_end: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input type="number" value={form.attendees_count || 0} onChange={e => setForm({ ...form, attendees_count: parseInt(e.target.value) || 0 })}
            placeholder="Asistentes" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input type="number" step="0.1" min="0" max="10" value={form.satisfaction_score || 0}
            onChange={e => setForm({ ...form, satisfaction_score: parseFloat(e.target.value) || 0 })}
            placeholder="Satisfacción (0-10)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })}
          rows={2} placeholder="Descripción del evento"
          className="w-full mt-3 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <textarea value={form.summary_post_event || ''} onChange={e => setForm({ ...form, summary_post_event: e.target.value })}
          rows={3} placeholder="Resumen post-evento — qué pasó, hallazgos, frases destacadas..."
          className="w-full mt-3 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })}
          rows={2} placeholder="Notas internas"
          className="w-full mt-3 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <div className="flex gap-2 mt-3">
          <button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={runPanorama} disabled={loading}
            className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-1 disabled:opacity-50">
            <Sparkles size={13} /> {loading ? 'Generando...' : 'Panorama IA'}
          </button>
        </div>
      </div>

      {panorama && !panorama.error && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-semibold text-violet-800">Panorama IA</h3>
          {[
            { key: 'diagnostico', label: '📊 Diagnóstico' },
            { key: 'que_funciono', label: '✅ Qué funcionó' },
            { key: 'que_falta', label: '🎯 Qué falta' },
            { key: 'proyecciones', label: '🚀 Proyecciones' },
            { key: 'riesgos', label: '⚠️ Riesgos' },
          ].map(({ key, label }) => panorama[key] ? (
            <div key={key}>
              <p className="text-xs font-medium text-violet-700">{label}</p>
              <p className="text-xs text-violet-900">{panorama[key]}</p>
            </div>
          ) : null)}
        </div>
      )}
      {panorama?.error && <p className="text-xs text-red-500">{panorama.error}</p>}
    </div>
  )
}

function HistoryPanel() {
  const [editions, setEditions] = useState([])
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newYear, setNewYear] = useState(new Date().getFullYear() - 1)

  const fetchAll = useCallback(async () => {
    const r = await fetch('/api/summit/editions')
    setEditions(await r.json())
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function runOverview() {
    setLoading(true); setOverview(null)
    try {
      const r = await fetch('/api/summit/historical-overview', { method: 'POST' })
      setOverview(await r.json())
    } finally { setLoading(false) }
  }

  async function addYear() {
    if (!newYear) return
    await fetch('/api/summit/editions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: parseInt(newYear) }),
    })
    setShowNew(false)
    fetchAll()
  }

  async function delEdition(id) {
    if (!confirm('¿Eliminar edición y todos sus datos asociados?')) return
    await fetch(`/api/summit/editions/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-base font-semibold text-gray-700">Ediciones registradas ({editions.length})</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowNew(v => !v)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus size={14} /> Agregar año
          </button>
          <button onClick={runOverview} disabled={loading}
            className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
            <Sparkles size={14} /> {loading ? 'Generando...' : 'Panorama histórico'}
          </button>
        </div>
      </div>

      {showNew && (
        <div className="bg-gray-50 rounded-lg p-3 flex gap-2 items-center">
          <input type="number" value={newYear} onChange={e => setNewYear(e.target.value)}
            placeholder="Año (ej. 2024)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32" />
          <button onClick={addYear} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-2 rounded-lg">Agregar</button>
          <button onClick={() => setShowNew(false)} className="text-sm text-gray-500">Cancelar</button>
        </div>
      )}

      {overview && !overview.error && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-semibold text-violet-800">Panorama histórico IA</h3>
          {[
            { key: 'evolucion', label: '📈 Evolución' },
            { key: 'fortalezas', label: '💪 Fortalezas' },
            { key: 'patrones', label: '🔍 Patrones' },
            { key: 'proyecciones', label: '🚀 Proyecciones' },
            { key: 'prioridades', label: '🎯 Prioridades' },
          ].map(({ key, label }) => overview[key] ? (
            <div key={key}>
              <p className="text-xs font-medium text-violet-700">{label}</p>
              <p className="text-xs text-violet-900">{overview[key]}</p>
            </div>
          ) : null)}
        </div>
      )}

      <div className="space-y-2">
        {editions.map(e => (
          <div key={e.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-gray-900">{e.year}</h3>
                {e.theme && <span className="text-xs text-gray-500">— {e.theme}</span>}
              </div>
              <div className="text-xs text-gray-500 flex gap-3 flex-wrap">
                {e.location && <span>📍 {e.location}</span>}
                {e.attendees_count > 0 && <span>👥 {e.attendees_count}</span>}
                {e.satisfaction_score > 0 && <span>⭐ {e.satisfaction_score}/10</span>}
              </div>
              {e.summary_post_event && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{e.summary_post_event}</p>}
            </div>
            <button onClick={() => delEdition(e.id)} className="text-red-300 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

const FIELD_DEFS = {
  speakers: [
    { key: 'name', label: 'Nombre', type: 'text', required: true },
    { key: 'role', label: 'Rol/cargo', type: 'text' },
    { key: 'company', label: 'Empresa', type: 'text' },
    { key: 'talk_title', label: 'Título de la charla', type: 'text' },
    { key: 'instagram', label: 'Instagram', type: 'text' },
    { key: 'linkedin', label: 'LinkedIn', type: 'text' },
    { key: 'twitter', label: 'Twitter', type: 'text' },
    { key: 'website', label: 'Web', type: 'text' },
    { key: 'photo_url', label: 'URL de foto', type: 'text' },
    { key: 'bio', label: 'Bio', type: 'textarea' },
    { key: 'notes', label: 'Notas', type: 'textarea' },
    { key: 'confirmed', label: 'Confirmado', type: 'check' },
  ],
  sponsors: [
    { key: 'name', label: 'Nombre', type: 'text', required: true },
    { key: 'tier', label: 'Categoría', type: 'select', options: ['main', 'gold', 'silver', 'partner'] },
    { key: 'contact_name', label: 'Contacto (nombre)', type: 'text' },
    { key: 'contact_email', label: 'Contacto (email)', type: 'text' },
    { key: 'agreement_value', label: 'Valor del acuerdo (USD)', type: 'number' },
    { key: 'logo_url', label: 'URL del logo', type: 'text' },
    { key: 'deliverables', label: 'Entregables', type: 'textarea' },
    { key: 'notes', label: 'Notas', type: 'textarea' },
  ],
  key_people: [
    { key: 'name', label: 'Nombre', type: 'text', required: true },
    { key: 'role', label: 'Rol', type: 'text' },
    { key: 'contact', label: 'Contacto', type: 'text' },
    { key: 'photo_url', label: 'URL de foto', type: 'text' },
    { key: 'bio', label: 'Bio', type: 'textarea' },
    { key: 'notes', label: 'Notas', type: 'textarea' },
  ],
  summit_milestones: [
    { key: 'title', label: 'Hito', type: 'text', required: true },
    { key: 'phase', label: 'Fase', type: 'select', options: ['pre', 'during', 'post'] },
    { key: 'date', label: 'Fecha', type: 'date' },
    { key: 'description', label: 'Descripción', type: 'textarea' },
    { key: 'completed', label: 'Completado', type: 'check' },
  ],
  event_goals: [
    { key: 'name', label: 'Nombre', type: 'text', required: true },
    { key: 'target_value', label: 'Meta', type: 'number' },
    { key: 'current_value', label: 'Actual', type: 'number' },
    { key: 'unit', label: 'Unidad', type: 'text' },
    { key: 'deadline', label: 'Fecha límite', type: 'date' },
  ],
}

function ItemsPanel({ table, editionId }) {
  const [items, setItems] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [analyzing, setAnalyzing] = useState({})
  const [analysis, setAnalysis] = useState({})
  const fields = FIELD_DEFS[table] || []

  const fetchAll = useCallback(async () => {
    const r = await fetch(`/api/summit/editions/${editionId}/${table}`)
    setItems(await r.json())
  }, [editionId, table])

  useEffect(() => { fetchAll(); setShowForm(false); setEditingId(null); setForm({}); setAnalyzing({}); setAnalysis({}) }, [fetchAll])

  async function save() {
    if (editingId) {
      await fetch(`/api/summit/${table}/${editingId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
    } else {
      await fetch(`/api/summit/editions/${editionId}/${table}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
    }
    setShowForm(false); setForm({}); setEditingId(null)
    fetchAll()
  }

  async function del(id) {
    if (!confirm('¿Eliminar?')) return
    await fetch(`/api/summit/${table}/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  function startEdit(item) {
    setForm({ ...item }); setEditingId(item.id); setShowForm(true)
  }

  async function analyze(itemId) {
    setAnalyzing(prev => ({ ...prev, [itemId]: true }))
    try {
      const r = await fetch(`/api/summit/${table}/${itemId}/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await r.json()
      setAnalysis(prev => ({ ...prev, [itemId]: data }))
    } catch {} finally {
      setAnalyzing(prev => ({ ...prev, [itemId]: false }))
    }
  }

  function closeAnalysis(itemId) {
    setAnalysis(prev => { const n = { ...prev }; delete n[itemId]; return n })
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-500">{items.length} {items.length === 1 ? 'ítem' : 'ítems'}</span>
        <button onClick={() => { setShowForm(v => !v); setForm({}); setEditingId(null) }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus size={14} /> Nuevo
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">{editingId ? 'Editar' : 'Nuevo'}</h3>
          <div className="grid grid-cols-2 gap-3">
            {fields.map(f => {
              if (f.type === 'textarea') {
                return <textarea key={f.key} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.label} rows={2}
                  className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              }
              if (f.type === 'select') {
                return <select key={f.key} value={form[f.key] || f.options[0]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              }
              if (f.type === 'check') {
                return <label key={f.key} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={!!form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.checked })}
                    className="accent-indigo-600" />
                  {f.label}
                </label>
              }
              return <input key={f.key} type={f.type} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.label}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg">{editingId ? 'Actualizar' : 'Guardar'}</button>
            <button onClick={() => { setShowForm(false); setForm({}); setEditingId(null) }} className="text-sm text-gray-500 px-3 py-2">Cancelar</button>
          </div>
        </div>
      )}

      {items.length === 0 && <p className="text-sm text-gray-400">Aún no hay registros.</p>}
      {items.map(item => (
        <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">{item.name || item.title}</h3>
              <div className="text-xs text-gray-500 mt-1 flex gap-3 flex-wrap">
                {item.role && <span>{item.role}</span>}
                {item.company && <span>· {item.company}</span>}
                {item.tier && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">{item.tier}</span>}
                {item.phase && <span>· {item.phase}</span>}
                {item.date && <span>📅 {item.date}</span>}
                {item.deadline && <span>📅 {item.deadline}</span>}
                {item.target_value > 0 && <span>{item.current_value || 0}/{item.target_value} {item.unit}</span>}
                {item.agreement_value > 0 && <span>${item.agreement_value}</span>}
                {item.confirmed === 1 && <span className="text-green-600">✓ Confirmado</span>}
                {item.completed === 1 && <span className="text-green-600">✓ Hecho</span>}
              </div>
              {(item.bio || item.description || item.notes || item.deliverables) && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{item.bio || item.description || item.notes || item.deliverables}</p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0 items-center">
              <button onClick={() => analyze(item.id)} disabled={!!analyzing[item.id]}
                className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1 disabled:opacity-50">
                <Sparkles size={12} /> {analyzing[item.id] ? 'Analizando...' : 'Analizar con IA'}
              </button>
              <button onClick={() => startEdit(item)} className="text-gray-400 hover:text-gray-600"><Edit2 size={13} /></button>
              <button onClick={() => del(item.id)} className="text-red-300 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          </div>

          {analysis[item.id] && !analysis[item.id].error && (
            <div className="mt-3 pt-3 border-t border-gray-100 bg-violet-50/40 -mx-4 -mb-4 px-4 pb-4 rounded-b-xl space-y-2">
              <div className="flex justify-between items-start">
                <p className="text-xs font-semibold text-violet-700">✨ Análisis con IA</p>
                <button onClick={() => closeAnalysis(item.id)} className="text-violet-300 hover:text-violet-600 text-sm leading-none">×</button>
              </div>
              {analysis[item.id].perfil && (
                <div>
                  <p className="text-xs font-medium text-violet-700">📋 Perfil</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{analysis[item.id].perfil}</p>
                </div>
              )}
              {Array.isArray(analysis[item.id].puntos_fuertes) && analysis[item.id].puntos_fuertes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-violet-700">💪 Puntos fuertes</p>
                  <ul className="text-xs text-gray-700 list-disc list-inside leading-relaxed">
                    {analysis[item.id].puntos_fuertes.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
              {Array.isArray(analysis[item.id].ideas_contenido) && analysis[item.id].ideas_contenido.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-violet-700">💡 Ideas de contenido</p>
                  <ul className="text-xs text-gray-700 list-disc list-inside leading-relaxed">
                    {analysis[item.id].ideas_contenido.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
              {analysis[item.id].como_potenciar && (
                <div>
                  <p className="text-xs font-medium text-violet-700">🚀 Cómo potenciar</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{analysis[item.id].como_potenciar}</p>
                </div>
              )}
              {Array.isArray(analysis[item.id].preguntas_clave) && analysis[item.id].preguntas_clave.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-violet-700">❓ Preguntas clave</p>
                  <ul className="text-xs text-gray-700 list-disc list-inside leading-relaxed">
                    {analysis[item.id].preguntas_clave.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
              {analysis[item.id].riesgos_o_alertas && analysis[item.id].riesgos_o_alertas !== 'ninguno detectado' && (
                <div>
                  <p className="text-xs font-medium text-amber-700">⚠ Riesgos/Alertas</p>
                  <p className="text-xs text-amber-900 leading-relaxed">{analysis[item.id].riesgos_o_alertas}</p>
                </div>
              )}
            </div>
          )}
          {analysis[item.id]?.error && (
            <div className="mt-2 text-xs text-red-500">
              {analysis[item.id].error}
              <button onClick={() => closeAnalysis(item.id)} className="ml-2 text-gray-400">×</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
