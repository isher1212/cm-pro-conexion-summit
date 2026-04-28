import { useState, useEffect, useRef } from 'react'
import { Bell, Check, Trash2 } from 'lucide-react'

export default function NotificationsBell() {
  const [items, setItems] = useState([])
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  async function refresh() {
    try {
      const c = await fetch('/api/notifications/unread-count').then(r => r.json())
      setCount(c.count || 0)
      const list = await fetch('/api/notifications?limit=20').then(r => r.json())
      setItems(Array.isArray(list) ? list : [])
    } catch {}
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  async function markRead(id) {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
    refresh()
  }

  async function markAll() {
    await fetch('/api/notifications/mark-all-read', { method: 'POST' })
    refresh()
  }

  async function del(id) {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    refresh()
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="relative text-gray-500 hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-100"
        title="Notificaciones">
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-9 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">Notificaciones</span>
            {count > 0 && (
              <button onClick={markAll} className="text-xs text-indigo-600 hover:text-indigo-800">
                Marcar todas leídas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 p-4 text-center">No hay notificaciones</p>
            ) : items.map(n => {
              const unread = !n.read_at
              return (
                <div key={n.id} className={`p-3 border-b border-gray-50 hover:bg-gray-50 ${unread ? 'bg-indigo-50/30' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                      {n.message && <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>}
                      <p className="text-xs text-gray-300 mt-1">{n.created_at ? new Date(n.created_at).toLocaleString('es-CO') : ''}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {unread && (
                        <button onClick={() => markRead(n.id)} className="text-indigo-400 hover:text-indigo-600" title="Marcar leída">
                          <Check size={12} />
                        </button>
                      )}
                      <button onClick={() => del(n.id)} className="text-red-300 hover:text-red-500" title="Eliminar">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
