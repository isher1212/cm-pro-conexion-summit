import { useState, useEffect, useCallback } from 'react'
import { Trash2, AlertTriangle, Database } from 'lucide-react'

const SECTIONS = [
  { key: 'articles', label: 'Inteligencia (artículos)', desc: 'Borra artículos antiguos. Los guardados nunca se borran.', defaultDays: 90 },
  { key: 'trends', label: 'Tendencias', desc: 'Borra tendencias antiguas. Las guardadas nunca se borran.', defaultDays: 60 },
  { key: 'images', label: 'Galería de imágenes', desc: 'Borra imágenes generadas no atadas a propuestas.', defaultDays: 180 },
  { key: 'notifications', label: 'Notificaciones leídas', desc: 'Limpia notificaciones ya leídas.', defaultDays: 30 },
  { key: 'ai_usage', label: 'Log de uso IA', desc: 'Histórico de costos de IA. Si lo borras pierdes histórico de gastos.', defaultDays: 365 },
]

export default function Cleanup() {
  const [cfg, setCfg] = useState({})
  const [stats, setStats] = useState({})
  const [log, setLog] = useState([])
  const [running, setRunning] = useState(false)
  const [preview, setPreview] = useState(null)

  const load = useCallback(async () => {
    const [c, s, l] = await Promise.all([
      fetch('/api/config').then(r => r.json()),
      fetch('/api/cleanup/stats').then(r => r.json()),
      fetch('/api/cleanup/log').then(r => r.json()),
    ])
    setCfg(c); setStats(s); setLog(Array.isArray(l) ? l : [])
  }, [])

  useEffect(() => { load() }, [load])

  async function saveCfg(patch) {
    const prev = cfg
    const newCfg = { ...cfg, ...patch }
    setCfg(newCfg)
    try {
      const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCfg) })
      if (!r.ok) throw new Error('error')
    } catch {
      setCfg(prev)
    }
  }

  async function runDryRun() {
    setRunning(true); setPreview(null)
    try {
      const r = await fetch('/api/cleanup/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dry_run: true }) })
      setPreview(await r.json())
    } finally { setRunning(false) }
  }

  async function runReal() {
    if (!confirm('Esto borrará permanentemente los datos según la configuración. ¿Continuar?')) return
    setRunning(true); setPreview(null)
    try {
      await fetch('/api/cleanup/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dry_run: false }) })
      load()
    } finally { setRunning(false) }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Limpieza automática</h1>
      <p className="text-gray-500 text-sm mb-6">Configura qué se limpia automáticamente cada noche. Lo guardado nunca se borra.</p>

      <section className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2"><Database size={16} /> Estadísticas de la base de datos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 truncate">{k}</p>
              <p className="text-lg font-bold text-gray-800">{(v || 0).toLocaleString('es-CO')}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-4 mb-6">
        {SECTIONS.map(s => {
          const enabled = !!cfg[`cleanup_${s.key}_enabled`]
          const days = cfg[`cleanup_${s.key}_days`] ?? s.defaultDays
          return (
            <div key={s.key} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-800">{s.label}</h3>
                  <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={enabled}
                    onChange={e => saveCfg({ [`cleanup_${s.key}_enabled`]: e.target.checked })}
                    className="accent-indigo-600 w-4 h-4" />
                  <span className="text-xs text-gray-600">{enabled ? 'Activo' : 'Apagado'}</span>
                </label>
              </div>
              {enabled && (
                <div className="mt-3 flex gap-2 items-center">
                  <span className="text-xs text-gray-500">Borrar lo más viejo de:</span>
                  <input type="number" min={1} max={3650} value={days}
                    onChange={e => saveCfg({ [`cleanup_${s.key}_days`]: parseInt(e.target.value) || s.defaultDays })}
                    className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs" />
                  <span className="text-xs text-gray-500">días</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <section className="bg-amber-50/60 border border-amber-100 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold text-amber-800 mb-3 flex items-center gap-2"><AlertTriangle size={16} /> Ejecutar limpieza ahora</h2>
        <p className="text-xs text-gray-600 mb-3">La limpieza también corre automáticamente cada noche según los toggles de arriba.</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={runDryRun} disabled={running}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-sm px-4 py-2 rounded-lg disabled:opacity-50">
            👁 Ver qué se borraría (sin borrar)
          </button>
          <button onClick={runReal} disabled={running}
            className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-1">
            <Trash2 size={13} /> Limpiar ahora
          </button>
        </div>
        {preview && (
          <div className="mt-3 p-3 bg-white rounded-lg border border-amber-100">
            <p className="text-xs font-semibold text-gray-700 mb-2">Si limpiaras ahora se borrarían:</p>
            {Object.keys(preview).length === 0 ? (
              <p className="text-xs text-gray-400">Nada — no hay secciones activas.</p>
            ) : Object.entries(preview).map(([k, v]) => (
              <p key={k} className="text-xs text-gray-600">· {k}: <b>{v}</b> ítems</p>
            ))}
          </div>
        )}
      </section>

      {log.length > 0 && (
        <section className="bg-white border border-gray-100 rounded-xl p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Histórico de limpiezas</h2>
          <div className="space-y-1 text-xs">
            {log.map(l => (
              <div key={l.id} className="flex justify-between p-2 rounded bg-gray-50">
                <span className="text-gray-700">{l.table_name}</span>
                <span className="text-gray-500">{l.deleted_count} borrados · {new Date(l.run_at).toLocaleString('es-CO')}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
