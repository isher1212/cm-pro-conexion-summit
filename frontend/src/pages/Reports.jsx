import { useState, useEffect } from 'react'
import { Mail, Send, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react'

const REPORT_ACTIONS = [
  { label: 'Email diario', endpoint: '/api/reports/send-daily-email', icon: Mail, color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100', desc: 'Resumen diario: noticias + tendencia + tip' },
  { label: 'Email semanal', endpoint: '/api/reports/send-weekly-email', icon: Mail, color: 'bg-purple-50 text-purple-700 hover:bg-purple-100', desc: 'Informe completo: métricas + noticias + tendencias + parrilla' },
  { label: 'Telegram diario', endpoint: '/api/reports/send-daily-telegram', icon: Send, color: 'bg-blue-50 text-blue-700 hover:bg-blue-100', desc: 'Noticias 7am + tendencias 9am' },
  { label: 'Telegram semanal', endpoint: '/api/reports/send-weekly-telegram', icon: Send, color: 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100', desc: 'Mini resumen de métricas + link informe' },
]

const STATUS_ICON = {
  sent: <CheckCircle size={13} className="text-green-500" />,
  error: <AlertCircle size={13} className="text-red-400" />,
  skipped: <Clock size={13} className="text-amber-400" />,
}

const CHANNEL_BADGE = {
  email: 'bg-indigo-50 text-indigo-600',
  telegram: 'bg-blue-50 text-blue-600',
}

function ReportLogRow({ entry }) {
  const date = new Date(entry.sent_at)
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50">
      <td className="py-2.5 pr-4 text-xs text-gray-700">{entry.report_type.replace(/_/g, ' ')}</td>
      <td className="py-2.5 pr-4">
        <span className={`text-xs px-2 py-0.5 rounded-full ${CHANNEL_BADGE[entry.channel] || 'bg-gray-50 text-gray-500'}`}>
          {entry.channel}
        </span>
      </td>
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-1.5">
          {STATUS_ICON[entry.status] || null}
          <span className="text-xs text-gray-600">{entry.status}</span>
        </div>
      </td>
      <td className="py-2.5 text-xs text-gray-400">
        {date.toLocaleDateString('es-CO')} {date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
      </td>
    </tr>
  )
}

export default function Reports() {
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState('')

  async function fetchLog() {
    setLoading(true)
    try {
      const res = await fetch('/api/reports/log?limit=50')
      const data = await res.json()
      setLog(data.log || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLog() }, [])

  async function handleSend(endpoint, label) {
    setSending(label)
    try {
      await fetch(endpoint, { method: 'POST' })
      await fetchLog()
    } finally {
      setSending('')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Reportes</h1>
          <p className="text-gray-500 text-sm">Envíos automáticos y manuales · historial de entregas</p>
        </div>
        <button onClick={fetchLog} className="flex items-center gap-2 border border-gray-200 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {/* Manual triggers */}
      <div className="grid gap-3 md:grid-cols-2 mb-8">
        {REPORT_ACTIONS.map(action => (
          <button
            key={action.label}
            onClick={() => handleSend(action.endpoint, action.label)}
            disabled={!!sending}
            className={`flex items-start gap-3 p-4 rounded-xl border border-gray-100 text-left transition-colors disabled:opacity-50 ${action.color}`}
          >
            <action.icon size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-0.5">
                {sending === action.label ? 'Enviando...' : action.label}
              </p>
              <p className="text-xs opacity-70">{action.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Schedule info */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-6">
        <p className="text-xs font-semibold text-indigo-700 mb-2">Envíos automáticos programados</p>
        <div className="grid grid-cols-2 gap-1 md:grid-cols-3">
          {[
            ['Email diario', '7:00am'],
            ['Telegram noticias', '7:00am'],
            ['Telegram tendencias', '9:00am'],
            ['Email semanal', 'Lunes 8:00am'],
            ['Telegram semanal', 'Lunes 8:30am'],
          ].map(([label, time]) => (
            <div key={label} className="text-xs text-indigo-600">
              <span className="font-medium">{label}:</span> {time}
            </div>
          ))}
        </div>
      </div>

      {/* Log table */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Historial de envíos</h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : log.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">Sin envíos todavía — los reportes automáticos aparecerán aquí</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 pb-2 pr-4">Tipo</th>
                  <th className="text-left text-xs font-medium text-gray-400 pb-2 pr-4">Canal</th>
                  <th className="text-left text-xs font-medium text-gray-400 pb-2 pr-4">Estado</th>
                  <th className="text-left text-xs font-medium text-gray-400 pb-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {log.map(entry => (
                  <ReportLogRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
