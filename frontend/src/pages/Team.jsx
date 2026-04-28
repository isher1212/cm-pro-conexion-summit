import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit2 } from 'lucide-react'

const ROLES = [
  { val: 'admin', label: 'Admin' },
  { val: 'editor', label: 'Editor' },
  { val: 'viewer', label: 'Viewer' },
]

const EMPTY = { name: '', email: '', role: 'editor', avatar_url: '', phone: '', notes: '', active: true }

export default function Team() {
  const [members, setMembers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)

  const fetchAll = useCallback(async () => {
    const r = await fetch('/api/team?active_only=false')
    setMembers(await r.json())
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function save() {
    if (!form.name) return
    if (editing) {
      await fetch(`/api/team/${editing}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    } else {
      await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    }
    setShowForm(false); setForm(EMPTY); setEditing(null)
    fetchAll()
  }

  async function del(id) {
    if (!confirm('¿Eliminar miembro del equipo?')) return
    await fetch(`/api/team/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  function startEdit(m) { setForm({ ...m, active: !!m.active }); setEditing(m.id); setShowForm(true) }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
        <button onClick={() => { setShowForm(v => !v); setForm(EMPTY); setEditing(null) }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus size={14} /> Agregar
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-6">Miembros que colaboran en CM Pro ({members.length})</p>

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">{editing ? 'Editar miembro' : 'Nuevo miembro'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Nombre" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="Email" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {ROLES.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
            </select>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="Teléfono" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input value={form.avatar_url} onChange={e => setForm({ ...form, avatar_url: e.target.value })}
              placeholder="URL del avatar" className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Notas (responsabilidades, áreas, etc.)" rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!form.active} onChange={e => setForm({ ...form, active: e.target.checked })}
              className="accent-indigo-600" />
            Activo
          </label>
          <div className="flex gap-2">
            <button onClick={save} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg">
              {editing ? 'Actualizar' : 'Guardar'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY); setEditing(null) }} className="text-sm text-gray-500 px-3 py-2">Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {members.length === 0 && <p className="text-sm text-gray-400">Aún no hay miembros del equipo.</p>}
        {members.map(m => (
          <div key={m.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt={m.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold flex-shrink-0">
                  {(m.name || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900">{m.name}</h3>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{m.role}</span>
                  {!m.active && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>}
                </div>
                <div className="text-xs text-gray-500 flex gap-2 flex-wrap">
                  {m.email && <span>{m.email}</span>}
                  {m.phone && <span>· {m.phone}</span>}
                </div>
                {m.notes && <p className="text-xs text-gray-500 mt-1">{m.notes}</p>}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => startEdit(m)} className="text-gray-400 hover:text-gray-600"><Edit2 size={13} /></button>
              <button onClick={() => del(m.id)} className="text-red-300 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
