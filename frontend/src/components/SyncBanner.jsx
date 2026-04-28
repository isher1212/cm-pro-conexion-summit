import { useState, useEffect } from 'react'
import { RotateCw, X, CheckCircle, AlertCircle } from 'lucide-react'

export default function SyncBanner() {
  const [job, setJob] = useState(null)
  const [active, setActive] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let mounted = true
    async function poll() {
      try {
        const r = await fetch('/api/sync/status')
        const d = await r.json()
        if (!mounted) return
        setActive(d.active)
        setJob(d.job)
        if (d.active) setDismissed(false)
      } catch {}
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  async function cancel() {
    if (!job?.id) return
    if (!confirm('¿Cancelar la sincronización en curso?')) return
    await fetch(`/api/sync/cancel/${job.id}`, { method: 'POST' })
  }

  if (!job) return null

  const isRunning = active && job.status === 'running'
  const isDone = !active && job.status === 'completed' && !dismissed
  const isError = !active && (job.status === 'error' || job.status === 'cancelled') && !dismissed

  if (!isRunning && !isDone && !isError) return null

  if (isRunning) {
    return (
      <div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
          <RotateCw size={16} className="animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-medium truncate">{job.current_step}</span>
              <span className="text-xs flex-shrink-0">{job.step_index}/{job.total_steps} · {job.progress_pct}%</span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-500" style={{ width: `${job.progress_pct}%` }} />
            </div>
          </div>
          <button onClick={cancel} className="text-white/70 hover:text-white text-xs whitespace-nowrap flex-shrink-0">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  if (isDone) {
    const newArticles = Object.values(job.results || {}).reduce((s, r) => s + (r?.new_articles || 0), 0)
    const newTrends = Object.values(job.results || {}).reduce((s, r) => s + (r?.new_trends || 0), 0)
    const summary = (() => {
      const parts = []
      if (newArticles > 0) parts.push(`${newArticles} noticia${newArticles !== 1 ? 's' : ''} nueva${newArticles !== 1 ? 's' : ''}`)
      if (newTrends > 0) parts.push(`${newTrends} tendencia${newTrends !== 1 ? 's' : ''}`)
      return parts.length > 0 ? parts.join(' · ') : 'Sin datos nuevos'
    })()
    return (
      <div className="fixed top-0 left-0 right-0 z-40 bg-green-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
          <CheckCircle size={16} className="flex-shrink-0" />
          <span className="text-sm font-medium flex-1">Sincronización completa — {summary}</span>
          <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white">
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="fixed top-0 left-0 right-0 z-40 bg-amber-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span className="text-sm font-medium flex-1">
            {job.status === 'cancelled' ? 'Sincronización cancelada' : `Error: ${job.error_message || 'desconocido'}`}
          </span>
          <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white">
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }
  return null
}
