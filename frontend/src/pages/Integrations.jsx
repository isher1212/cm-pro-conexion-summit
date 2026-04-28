import { useState, useEffect, useCallback } from 'react'
import { Plug, Check, X } from 'lucide-react'

const PROVIDER_INFO = {
  notion: { color: 'bg-gray-900', desc: 'Sincroniza Parrilla y Guardados con Notion' },
  slack: { color: 'bg-purple-600', desc: 'Notificaciones del equipo en Slack' },
  buffer: { color: 'bg-blue-700', desc: 'Programa publicaciones via Buffer' },
  canva: { color: 'bg-cyan-500', desc: 'Importar diseños desde Canva' },
  whatsapp: { color: 'bg-green-600', desc: 'Mensajería automatizada via WhatsApp Business' },
  zapier: { color: 'bg-orange-500', desc: 'Webhook genérico para Zapier/Make' },
}

export default function Integrations() {
  const [data, setData] = useState({ active: [], available: [] })

  const fetchAll = useCallback(async () => {
    const r = await fetch('/api/integrations')
    setData(await r.json())
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Integraciones</h1>
      <p className="text-gray-500 text-sm mb-6">Conecta CM Pro con otras herramientas. Cada integración es opcional.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(data.available || []).map(p => {
          const active = (data.active || []).find(a => a.provider === p.provider)
          return <ProviderCard key={p.provider} provider={p} active={active} info={PROVIDER_INFO[p.provider]} onChange={fetchAll} />
        })}
      </div>
    </div>
  )
}

function ProviderCard({ provider, active, info, onChange }) {
  const [showForm, setShowForm] = useState(false)
  const [config, setConfig] = useState(active?.config || {})
  const [enabled, setEnabled] = useState(!!active?.enabled)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setConfig(active?.config || {})
    setEnabled(!!active?.enabled)
  }, [active])

  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/integrations/${provider.provider}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, enabled }),
      })
      onChange()
      setShowForm(false)
    } finally { setSaving(false) }
  }

  const colorClass = info?.color || 'bg-gray-500'
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${colorClass} text-white flex items-center justify-center`}>
            <Plug size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{provider.name}</h3>
            {info?.desc && <p className="text-xs text-gray-500">{info.desc}</p>}
          </div>
        </div>
        {active?.enabled ? (
          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <Check size={11} /> Conectado
          </span>
        ) : (
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <X size={11} /> Desconectado
          </span>
        )}
      </div>
      {showForm ? (
        <div className="mt-3 space-y-2">
          {provider.fields.map(f => (
            <input key={f} value={config[f] || ''} onChange={e => setConfig({ ...config, [f]: e.target.value })}
              placeholder={f}
              type={f.includes('token') || f.includes('secret') ? 'password' : 'text'}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          ))}
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="accent-indigo-600" />
            Habilitada
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs text-gray-500 px-2">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-2">
          {active ? 'Editar configuración' : 'Configurar'}
        </button>
      )}
    </div>
  )
}
