import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, AlertCircle, Calendar as CalendarIcon, ArrowRight, Sparkles, Eye, Users, ChevronRight, RotateCw } from 'lucide-react'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(null)

  useEffect(() => {
    fetch('/api/dashboard/overview').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    function loadStatus() {
      fetch('/api/sync/status').then(r => r.json()).then(d => {
        setLastSync(d.job)
        setSyncing(!!d.active)
      }).catch(() => {})
    }
    loadStatus()
    const id = setInterval(loadStatus, 5000)
    return () => clearInterval(id)
  }, [])

  async function startSync() {
    setSyncing(true)
    try {
      await fetch('/api/sync/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    } catch {}
    // Refrescar dashboard luego de un rato
    setTimeout(() => {
      fetch('/api/dashboard/overview').then(r => r.json()).then(setData).catch(() => {})
    }, 90000)
  }

  function relativeTime(iso) {
    if (!iso) return 'nunca'
    const d = new Date(iso)
    const diff = Math.floor((Date.now() - d.getTime()) / 1000)
    if (diff < 60) return 'hace un momento'
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
    return `hace ${Math.floor(diff / 86400)} días`
  }

  if (loading) return <p className="text-sm text-gray-400 p-6">Cargando dashboard...</p>
  if (!data) return <p className="text-sm text-gray-400 p-6">Error al cargar.</p>

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{greeting} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Esto es lo que pasa hoy en Conexión Summit</p>
      </div>

      <section className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold mb-1">Sincronización maestra</h2>
            <p className="text-sm text-indigo-100">
              {syncing
                ? 'Sincronizando ahora... mira el progreso arriba.'
                : `Última sincronización: ${relativeTime(lastSync?.finished_at || lastSync?.started_at)}`}
            </p>
          </div>
          <button onClick={startSync} disabled={syncing}
            className="bg-white text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 text-sm font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 shadow">
            <RotateCw size={15} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar todo'}
          </button>
        </div>
      </section>

      {data.metrics.length > 0 && (
        <section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.metrics.map(m => (
              <div key={m.platform} className="bg-gradient-to-br from-white to-indigo-50/40 border border-indigo-100/50 rounded-2xl p-5 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{m.platform}</span>
                  <Users size={14} className="text-indigo-400" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{(m.followers || 0).toLocaleString('es-CO')}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs font-medium ${m.delta_followers_7d > 0 ? 'text-green-600' : m.delta_followers_7d < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {m.delta_followers_7d > 0 ? '↑' : m.delta_followers_7d < 0 ? '↓' : '–'} {Math.abs(m.delta_followers_7d || 0)} esta semana
                  </span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{(m.engagement_rate || 0).toFixed(2)}% eng.</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.actions.length > 0 && (
        <section className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertCircle size={15} /> Te esperan algunas cosas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {data.actions.map((a, i) => (
              <Link key={i} to={a.to} className="bg-white border border-amber-100 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-amber-50 transition-colors flex items-center justify-between gap-2">
                <span>{a.label}</span>
                <ChevronRight size={14} className="text-amber-400 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-500" /> Top noticias
            </h2>
            <Link to="/intelligence" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
              Radar Noticias <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {data.top_articles.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-3">Haz clic en "Actualizar ahora" en Radar Noticias para cargar noticias reales.</p>
                {[
                  { title: 'Startups latinoamericanas recaudan USD 1.2B en Q1 2025', source: 'TechCrunch', score: 9 },
                  { title: 'Conexión Summit: el ecosistema emprendedor de LATAM crece 40%', source: 'Forbes LATAM', score: 8 },
                  { title: 'Tendencias de IA en empresas medianas de Colombia y México', source: 'El País', score: 7 },
                ].map((a, i) => (
                  <div key={i} className="p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 opacity-70">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-gray-500 leading-snug flex-1 line-clamp-2">{a.title}</h3>
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 bg-green-100 text-green-700">{a.score}/10</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-400">{a.source}</p>
                      <span className="text-xs text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded">ejemplo</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : data.top_articles.map(a => {
              const score = a.score || 0
              const scoreColor = score >= 7 ? 'bg-green-100 text-green-700' : score >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
              return (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-gray-800 leading-snug flex-1 line-clamp-2">{a.title}</h3>
                    {score > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${scoreColor}`}>{score}/10</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{a.source}</p>
                </a>
              )
            })}
          </div>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-violet-500" /> Tendencias del día
            </h2>
            <Link to="/trends" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {data.top_trends.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-3">Las tendencias aparecen aquí al sincronizar desde la sección Tendencias.</p>
                {[
                  { keyword: 'Inteligencia artificial para emprendedores', platform: 'Google Trends', post_idea: 'Carrusel: 5 herramientas de IA que todo founder LATAM debería usar' },
                  { keyword: 'Demo Day LATAM', platform: 'LinkedIn', post_idea: 'Reel detrás de cámaras de un Demo Day real' },
                  { keyword: 'Bootstrapping vs Venture Capital', platform: 'TikTok', post_idea: 'Video debate: ¿qué modelo es mejor para startups latinas?' },
                ].map((t, i) => (
                  <div key={i} className="p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 opacity-70">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-medium text-gray-500 leading-snug flex-1">{t.keyword}</h3>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full flex-shrink-0">{t.platform}</span>
                        <span className="text-xs text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded">ejemplo</span>
                      </div>
                    </div>
                    {t.post_idea && <p className="text-xs text-gray-400 line-clamp-2 mt-1">💡 {t.post_idea}</p>}
                  </div>
                ))}
              </div>
            ) : data.top_trends.map(t => (
              <div key={t.id} className="p-3 rounded-lg border border-gray-50 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-sm font-medium text-gray-800 leading-snug flex-1">{t.keyword}</h3>
                  <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full flex-shrink-0">{t.platform}</span>
                </div>
                {t.post_idea && <p className="text-xs text-gray-500 line-clamp-2 mt-1">💡 {t.post_idea}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <CalendarIcon size={16} className="text-blue-500" /> Próximas publicaciones
            </h2>
            <Link to="/planner" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
              Parrilla <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {data.upcoming_posts.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-2">Genera propuestas desde la Parrilla para verlas aquí.</p>
                {[
                  { topic: 'Cómo validar tu idea de negocio en 48h', platform: 'Instagram', format: 'Carrusel', suggested_date: '2025-05-05', status: 'proposed' },
                  { topic: 'Behind the scenes: Demo Endeavor', platform: 'TikTok', format: 'Reel', suggested_date: '2025-05-08', status: 'approved' },
                ].map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 opacity-70">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-500 truncate">{p.topic}</p>
                      <p className="text-xs text-gray-400">{p.platform} · {p.format}</p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-xs text-gray-400">{p.suggested_date}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${p.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                          {p.status === 'approved' ? 'Aprobada' : 'Propuesta'}
                        </span>
                        <span className="text-xs text-gray-300 bg-gray-100 px-1 py-0.5 rounded">ej.</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : data.upcoming_posts.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{p.topic}</p>
                  <p className="text-xs text-gray-400">{p.platform} · {p.format}</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-xs text-gray-500">{p.suggested_date}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full mt-0.5 ${p.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {p.status === 'approved' ? 'Aprobada' : 'Propuesta'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <CalendarIcon size={16} className="text-amber-500" /> Próximos eventos
          </h2>
          <div className="space-y-2">
            {data.upcoming_events.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-2">Agrega eventos desde la Parrilla para planificar contenido alrededor de ellos.</p>
                {[
                  { title: 'Demo Endeavor — Conexión Summit', date: '2025-05-15', type: 'evento' },
                  { title: 'Webinar: Fundraising para startups LATAM', date: '2025-05-22', type: 'alianza' },
                ].map((ev, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 opacity-70">
                    <div className="text-center w-12 flex-shrink-0">
                      <div className="text-xs text-gray-400 uppercase">{new Date(ev.date).toLocaleString('es-CO', { month: 'short' })}</div>
                      <div className="text-lg font-bold text-gray-400 leading-none">{new Date(ev.date).getDate()}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-500 truncate">{ev.title}</p>
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-gray-400">{ev.type}</p>
                        <span className="text-xs text-gray-300 bg-gray-100 px-1 py-0.5 rounded">ejemplo</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : data.upcoming_events.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-50">
                <div className="text-center w-12 flex-shrink-0">
                  <div className="text-xs text-gray-400 uppercase">{new Date(ev.date).toLocaleString('es-CO', { month: 'short' })}</div>
                  <div className="text-lg font-bold text-gray-800 leading-none">{new Date(ev.date).getDate()}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{ev.title}</p>
                  {ev.type && <p className="text-xs text-gray-400">{ev.type}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Eye size={16} /> Tu mes en números
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Propuestas', value: data.month_stats.proposals },
            { label: 'Publicadas', value: data.month_stats.published },
            { label: 'Artículos guardados', value: data.month_stats.articles_saved },
            { label: 'Costo IA', value: `$${data.month_stats.ai_cost_usd}` },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-3xl font-bold">{s.value}</div>
              <div className="text-xs text-indigo-100 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
