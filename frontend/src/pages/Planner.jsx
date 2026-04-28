import { useState, useEffect, useCallback } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Trash2, Sparkles, Check, X, BookOpen,
  Calendar, GripVertical, ChevronLeft, ChevronRight,
} from 'lucide-react'

const STATUS_TABS = [
  { key: '', label: 'Todas' },
  { key: 'proposed', label: 'Propuestas' },
  { key: 'approved', label: 'Aprobadas' },
  { key: 'published', label: 'Publicadas' },
  { key: 'rejected', label: 'Rechazadas' },
]

const STATUS_COLOR = {
  proposed: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  published: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  rejected: 'bg-gray-50 text-gray-400 border-gray-200',
}

const STATUS_LABEL = {
  proposed: 'Propuesto',
  approved: 'Aprobado',
  published: 'Publicado',
  rejected: 'Rechazado',
}

const PLATFORM_COLOR = {
  Instagram: 'text-pink-500',
  TikTok: 'text-gray-800',
  LinkedIn: 'text-blue-600',
}

// ── Sortable proposal card ────────────────────────────────────────────────────
function ProposalCard({ proposal, onStatusChange, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: proposal.id })
  const [editing, setEditing] = useState(false)
  const [caption, setCaption] = useState(proposal.caption_draft)
  const [date, setDate] = useState(proposal.suggested_date)
  const [imgPanel, setImgPanel] = useState(false)
  const [imgSpecs, setImgSpecs] = useState('')
  const [imgCount, setImgCount] = useState(2)
  const [imgGenerating, setImgGenerating] = useState(false)
  const [imgError, setImgError] = useState('')
  const [imgUrls, setImgUrls] = useState(() => {
    try { return JSON.parse(proposal.image_urls || '[]') } catch { return [] }
  })

  const isCarousel = proposal.format === 'Carrusel'
  const isVideo = ['Reel', 'Video', 'TikTok'].includes(proposal.format)
  const [script, setScript] = useState(() => {
    try { return JSON.parse(proposal.video_script || '{}') } catch { return {} }
  })
  const [scriptGenerating, setScriptGenerating] = useState(false)
  const [scriptOpen, setScriptOpen] = useState(false)
  const [scriptError, setScriptError] = useState('')

  const ALL_PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn']
  const [replicateOpen, setReplicateOpen] = useState(false)
  const [replicateForm, setReplicateForm] = useState({
    platform: ALL_PLATFORMS.find(p => p !== proposal.platform) || 'Instagram',
    topic: proposal.topic,
    caption_draft: proposal.caption_draft,
    hashtags: proposal.hashtags,
    format: proposal.format,
    suggested_date: proposal.suggested_date,
  })

  async function handleGenerateScript() {
    setScriptGenerating(true)
    setScriptError('')
    try {
      const res = await fetch('/api/images/video-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposal.id,
          topic: proposal.topic,
          platform: proposal.platform,
          caption_draft: proposal.caption_draft,
          hashtags: proposal.hashtags,
        }),
      })
      if (!res.ok) {
        setScriptError('Error al generar guión. Verifique la API key de OpenAI.')
        return
      }
      const data = await res.json()
      if (data.error) {
        setScriptError(data.error)
      } else if (data.hook) {
        setScript(data)
        setScriptOpen(true)
      }
    } catch {
      setScriptError('Error de conexión al generar guión.')
    } finally {
      setScriptGenerating(false)
    }
  }

  async function handleGenerateImages() {
    setImgGenerating(true)
    setImgError('')
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposal.id,
          topic: proposal.topic,
          platform: proposal.platform,
          caption_draft: proposal.caption_draft,
          extra_specs: imgSpecs,
          n: isCarousel ? Math.max(2, Math.min(10, imgCount)) : 1,
        }),
      })
      if (!res.ok) {
        setImgError('Error al generar imagen. Verifique la API key de Kie AI.')
        return
      }
      const data = await res.json()
      if (data.error) {
        setImgError(data.error)
      } else if (Array.isArray(data.urls) && data.urls.length) {
        setImgUrls(data.urls)
        setImgPanel(false)
      }
    } catch {
      setImgError('Error de conexión al generar imagen.')
    } finally {
      setImgGenerating(false)
    }
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  async function saveEdit() {
    await onEdit(proposal.id, { caption_draft: caption, suggested_date: date })
    setEditing(false)
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <button {...attributes} {...listeners} className="mt-1 text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0">
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">{proposal.topic}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLOR[proposal.status] || ''}`}>
              {STATUS_LABEL[proposal.status] || proposal.status}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
            <span className={`font-medium ${PLATFORM_COLOR[proposal.platform] || ''}`}>{proposal.platform}</span>
            <span>{proposal.format}</span>
            <span>{proposal.suggested_date}</span>
          </div>

          {editing ? (
            <div className="space-y-2">
              <TemplateSelector onSelect={text => setCaption(text)} />
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none h-20"
              />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs"
              />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-lg">Guardar</button>
                <button onClick={() => setEditing(false)} className="border border-gray-200 text-xs px-3 py-1 rounded-lg">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              {proposal.caption_draft && (
                <p className="text-xs text-gray-600 leading-relaxed mb-2 line-clamp-2">{proposal.caption_draft}</p>
              )}
              {proposal.hashtags && (
                <p className="text-xs text-indigo-400">{proposal.hashtags}</p>
              )}
            </>
          )}

          {!editing && (
            <div className="flex items-center gap-2 mt-3">
              {proposal.status === 'proposed' && (
                <>
                  <button
                    onClick={() => onStatusChange(proposal.id, 'approved')}
                    className="flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Check size={11} /> Aprobar
                  </button>
                  <button
                    onClick={() => onStatusChange(proposal.id, 'rejected')}
                    className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 text-gray-500 text-xs px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <X size={11} /> Rechazar
                  </button>
                </>
              )}
              {proposal.status === 'approved' && (
                <button
                  onClick={() => onStatusChange(proposal.id, 'published')}
                  className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-lg transition-colors"
                >
                  <BookOpen size={11} /> Marcar publicado
                </button>
              )}
              {proposal.status === 'rejected' && (
                <button
                  onClick={() => onStatusChange(proposal.id, 'proposed')}
                  className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-lg transition-colors"
                >
                  Recuperar
                </button>
              )}
              <button onClick={() => setReplicateOpen(v => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 ml-1">
                Replicar en...
              </button>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      </div>

          {/* Image panel */}
          <div className="mt-3 pt-3 border-t border-gray-50">
            {imgUrls.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {imgUrls.map((url) => (
                  <div key={url} className="relative group">
                    <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-100" />
                    <a href={url} target="_blank" rel="noreferrer"
                      className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors" />
                  </div>
                ))}
              </div>
            )}
            {imgPanel ? (
              <div className="space-y-2">
                <textarea
                  value={imgSpecs}
                  onChange={e => setImgSpecs(e.target.value)}
                  placeholder="Especificaciones adicionales (opcional): colores, estilo, elementos visuales..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none"
                />
                {isCarousel && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Imágenes del carrusel:</label>
                    <input
                      type="number" min={2} max={10} value={imgCount}
                      onChange={e => setImgCount(parseInt(e.target.value))}
                      className="w-16 border border-gray-200 rounded px-2 py-1 text-xs"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={handleGenerateImages} disabled={imgGenerating}
                    className="bg-violet-600 hover:bg-violet-700 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">
                    {imgGenerating ? '⏳ Generando...' : '✨ Generar'}
                  </button>
                  <button onClick={() => setImgPanel(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                </div>
                {imgError && <p className="text-xs text-red-500">{imgError}</p>}
              </div>
            ) : (
              <div className="flex gap-2 items-center flex-wrap">
                {imgUrls.length === 0 ? (
                  <button onClick={() => setImgPanel(true)}
                    className="flex-1 min-w-[200px] bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-all">
                    ✨ Generar contenido con IA
                  </button>
                ) : (
                  <button onClick={() => setImgPanel(true)}
                    className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                    🔄 Regenerar imagen
                  </button>
                )}
                {isVideo && (
                  <button onClick={handleGenerateScript} disabled={scriptGenerating}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50">
                    {scriptGenerating ? '⏳ Generando guión...' : '🎬 Generar guión'}
                  </button>
                )}
                {scriptError && <p className="text-xs text-red-500 mt-1 w-full">{scriptError}</p>}
              </div>
            )}
          </div>

          {isVideo && scriptOpen && script.hook && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-800">Guión de video</span>
                <button onClick={() => setScriptOpen(false)} className="text-blue-400 hover:text-blue-600 text-lg leading-none">×</button>
              </div>
              {[
                { key: 'hook', label: '🎣 Hook' },
                { key: 'desarrollo', label: '📖 Desarrollo' },
                { key: 'cta', label: '📢 CTA' },
                { key: 'voz_en_off', label: '🎙 Voz en off' },
              ].map(({ key, label }) => script[key] ? (
                <div key={key}>
                  <p className="text-xs font-medium text-blue-700 mb-0.5">{label}</p>
                  <p className="text-xs text-blue-900 leading-relaxed">{script[key]}</p>
                </div>
              ) : null)}
              {script.duracion && <p className="text-xs text-blue-400 mt-1">⏱ {script.duracion}s</p>}
            </div>
          )}

          {replicateOpen && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
              <p className="text-xs font-semibold text-gray-700">Replicar en otra plataforma</p>
              <div className="flex gap-2 flex-wrap">
                {ALL_PLATFORMS.filter(p => p !== proposal.platform).map(p => (
                  <button key={p}
                    onClick={() => setReplicateForm(f => ({ ...f, platform: p }))}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      replicateForm.platform === p
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">Copy</label>
                <textarea value={replicateForm.caption_draft}
                  onChange={e => setReplicateForm(f => ({ ...f, caption_draft: e.target.value }))}
                  rows={2} className="w-full border border-gray-200 rounded px-2 py-1 text-xs resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">Hashtags</label>
                <input value={replicateForm.hashtags}
                  onChange={e => setReplicateForm(f => ({ ...f, hashtags: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await fetch('/api/planner/proposals', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...replicateForm, status: 'proposed', created_at: new Date().toISOString() }),
                    })
                    setReplicateOpen(false)
                    window.dispatchEvent(new CustomEvent('cm-refresh-proposals'))
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg">
                  Guardar copia
                </button>
                <button onClick={() => setReplicateOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
              </div>
            </div>
          )}
    </div>
  )
}

// ── Events section ────────────────────────────────────────────────────────────
function EventsSection({ events, onAdd, onDelete }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', date: '', description: '', event_type: 'evento' })

  async function handleAdd() {
    if (!form.title || !form.date) return
    await onAdd(form)
    setForm({ title: '', date: '', description: '', event_type: 'evento' })
    setOpen(false)
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Eventos próximos</h3>
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg transition-colors">
          <Plus size={12} /> Agregar
        </button>
      </div>

      {open && (
        <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 rounded-lg md:grid-cols-4">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Título del evento</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ej: Lanzamiento de producto" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Fecha</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
            <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {['evento', 'alianza', 'reunion', 'lanzamiento', 'feria'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-2 md:col-span-4">
            <label className="text-xs text-gray-500 mb-1 block">Descripción (opcional)</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Detalles del evento..." />
          </div>
          <div className="col-span-2 md:col-span-4 flex gap-2">
            <button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg">Guardar</button>
            <button onClick={() => setOpen(false)} className="border border-gray-200 text-sm px-4 py-2 rounded-lg">Cancelar</button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Sin eventos registrados</p>
      ) : (
        <div className="space-y-2">
          {events.map(ev => (
            <div key={ev.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
              <div>
                <span className="font-medium text-gray-800">{ev.title}</span>
                <span className="ml-2 text-xs text-gray-400">{ev.date}</span>
                <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{ev.event_type}</span>
              </div>
              <button onClick={() => onDelete(ev.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Monthly calendar ──────────────────────────────────────────────────────────
function MonthCalendar({ proposals }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const approved = proposals.filter(p => p.status === 'approved' || p.status === 'published')

  const byDate = {}
  for (const p of approved) {
    if (p.suggested_date) {
      byDate[p.suggested_date] = byDate[p.suggested_date] || []
      byDate[p.suggested_date].push(p)
    }
  }

  const year = month.getFullYear()
  const mon = month.getMonth()
  const firstDay = new Date(year, mon, 1).getDay()
  const daysInMonth = new Date(year, mon + 1, 0).getDate()
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))
  while (cells.length % 7 !== 0) cells.push(null)

  const monthName = month.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 capitalize">{monthName}</h3>
        <div className="flex gap-1">
          <button onClick={() => setMonth(new Date(year, mon - 1, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setMonth(new Date(year, mon + 1, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 pb-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-lg overflow-hidden">
        {cells.map((day, idx) => {
          const dateStr = day ? `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''
          const dayProposals = day ? (byDate[dateStr] || []) : []
          const isToday = day && dateStr === new Date().toISOString().slice(0, 10)
          return (
            <div key={idx} className={`bg-white min-h-16 p-1 ${!day ? 'bg-gray-50' : ''}`}>
              {day && (
                <>
                  <span className={`text-xs font-medium block mb-1 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>
                    {day}
                  </span>
                  {dayProposals.slice(0, 2).map(p => (
                    <div key={p.id} className={`text-xs px-1 py-0.5 rounded mb-0.5 truncate ${p.status === 'published' ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-700'}`}>
                      {p.topic}
                    </div>
                  ))}
                  {dayProposals.length > 2 && (
                    <span className="text-xs text-gray-400">+{dayProposals.length - 2}</span>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Template selector ─────────────────────────────────────────────────────────
function TemplateSelector({ onSelect }) {
  const [templates, setTemplates] = useState([])
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [values, setValues] = useState({})

  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  if (templates.length === 0) return null
  return (
    <div className="mb-2">
      <button type="button" onClick={() => setOpen(v => !v)} className="text-xs text-indigo-600 hover:text-indigo-800">
        📝 Usar plantilla {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
          <select value={selected?.id || ''} onChange={e => {
            const t = templates.find(x => x.id === parseInt(e.target.value))
            setSelected(t || null)
            setValues({})
          }} className="w-full border border-gray-200 rounded px-2 py-1 text-sm">
            <option value="">Elige una plantilla...</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {selected && (selected.variables || []).length > 0 && (
            <div className="space-y-1">
              {(selected.variables || []).map(v => (
                <input key={v} placeholder={v}
                  value={values[v] || ''}
                  onChange={e => setValues(prev => ({ ...prev, [v]: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
              ))}
            </div>
          )}
          {selected && (
            <button type="button" onClick={async () => {
              const r = await fetch(`/api/templates/${selected.id}/render`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values }),
              })
              const data = await r.json()
              if (data.rendered) {
                onSelect(data.rendered)
                setOpen(false)
              }
            }} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1 rounded-lg">
              Aplicar plantilla al copy
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Planner() {
  const [events, setEvents] = useState([])
  const [proposals, setProposals] = useState([])
  const [activeTab, setActiveTab] = useState('')
  const [generating, setGenerating] = useState(false)
  const [view, setView] = useState('list')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const fetchAll = useCallback(async () => {
    const [evRes, propRes] = await Promise.all([
      fetch('/api/planner/events'),
      fetch('/api/planner/proposals'),
    ])
    const evData = await evRes.json()
    const propData = await propRes.json()
    setEvents(evData.events || [])
    setProposals(propData.proposals || [])
  }, [])

  useEffect(() => {
    fetchAll()
    const handler = () => fetchAll()
    window.addEventListener('cm-refresh-proposals', handler)
    return () => window.removeEventListener('cm-refresh-proposals', handler)
  }, [fetchAll])

  const filteredProposals = activeTab
    ? proposals.filter(p => p.status === activeTab)
    : proposals

  async function handleAddEvent(event) {
    await fetch('/api/planner/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
    fetchAll()
  }

  async function handleDeleteEvent(id) {
    await fetch(`/api/planner/events/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  async function handleStatusChange(id, status) {
    await fetch(`/api/planner/proposals/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setProposals(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  async function handleEdit(id, updates) {
    await fetch(`/api/planner/proposals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setProposals(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/planner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n_proposals: 5 }),
      })
      const data = await res.json()
      if (data.generated > 0) await fetchAll()
    } finally {
      setGenerating(false)
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const reordered = arrayMove(proposals, proposals.findIndex(p => p.id === active.id), proposals.findIndex(p => p.id === over.id))
    setProposals(reordered)
    try {
      await fetch('/api/planner/proposals/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered_ids: reordered.map(p => p.id) }),
      })
    } catch (e) {
      console.error('reorder failed', e)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Parrilla</h1>
          <p className="text-gray-500 text-sm">Planificación inteligente de contenido</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(v => v === 'list' ? 'calendar' : 'list')}
            className="flex items-center gap-1.5 border border-gray-200 text-sm px-3 py-2 rounded-lg hover:bg-gray-50"
          >
            <Calendar size={14} />
            {view === 'list' ? 'Ver calendario' : 'Ver lista'}
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
          >
            <Sparkles size={15} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generando...' : 'Generar con IA'}
          </button>
        </div>
      </div>

      <EventsSection events={events} onAdd={handleAddEvent} onDelete={handleDeleteEvent} />

      {view === 'calendar' ? (
        <MonthCalendar proposals={proposals} />
      ) : (
        <>
          <div className="flex gap-1 mb-4 flex-wrap">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                {tab.key && (
                  <span className="ml-1.5 text-xs opacity-60">
                    {proposals.filter(p => p.status === tab.key).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {filteredProposals.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">📅</div>
              <p className="text-gray-500 font-medium mb-1">Sin propuestas todavía</p>
              <p className="text-gray-400 text-sm mb-4">Genera propuestas con IA cruzando tendencias + noticias + eventos</p>
              <button onClick={handleGenerate} disabled={generating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-5 py-2 rounded-lg">
                {generating ? 'Generando...' : 'Generar propuestas'}
              </button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredProposals.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {filteredProposals.map(proposal => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      onStatusChange={handleStatusChange}
                      onEdit={handleEdit}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </>
      )}
    </div>
  )
}
