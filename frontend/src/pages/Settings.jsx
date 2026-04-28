import { useState, useEffect } from 'react'
import { getConfig, saveConfig } from '../api/client'

export default function Settings() {
  const [cfg, setCfg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { getConfig().then(setCfg) }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await saveConfig(cfg)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function updateField(key, value) {
    setCfg(prev => ({ ...prev, [key]: value }))
  }

  function updateSchedule(key, value) {
    setCfg(prev => ({ ...prev, schedules: { ...prev.schedules, [key]: value } }))
  }

  function addRssSource() {
    const newSource = { name: '', url: '', active: true, category: 'Colombia' }
    setCfg(prev => ({ ...prev, rss_sources: [...prev.rss_sources, newSource] }))
  }

  function updateRssSource(idx, field, value) {
    setCfg(prev => {
      const sources = [...prev.rss_sources]
      sources[idx] = { ...sources[idx], [field]: value }
      return { ...prev, rss_sources: sources }
    })
  }

  function removeRssSource(idx) {
    setCfg(prev => ({ ...prev, rss_sources: prev.rss_sources.filter((_, i) => i !== idx) }))
  }

  function addPillar() {
    const newPillar = { name: '', description: '', example: '', weight: 1, active: true }
    setCfg(prev => ({ ...prev, content_pillars: [...prev.content_pillars, newPillar] }))
  }

  function updatePillar(idx, field, value) {
    setCfg(prev => {
      const pillars = [...prev.content_pillars]
      pillars[idx] = { ...pillars[idx], [field]: value }
      return { ...prev, content_pillars: pillars }
    })
  }

  function removePillar(idx) {
    setCfg(prev => ({ ...prev, content_pillars: prev.content_pillars.filter((_, i) => i !== idx) }))
  }

  if (!cfg) return <p className="text-gray-400">Cargando configuración...</p>

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Configuración</h1>
      <p className="text-gray-500 text-sm mb-8">Todo ajustable sin tocar código</p>

      <form onSubmit={handleSave} className="space-y-10">

        {/* Credenciales */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b">Credenciales y conexiones</h2>
          <div className="space-y-4">
            {[
              { key: 'openai_api_key', label: 'OpenAI API Key', type: 'password', placeholder: 'sk-...' },
              { key: 'kie_ai_api_key', label: 'Kie AI API Key (generación de imágenes)', type: 'password', placeholder: 'kie-...' },
              { key: 'email_sender', label: 'Email remitente', type: 'email', placeholder: 'tu@gmail.com' },
              { key: 'email_sender_password', label: 'Contraseña de aplicación Gmail', type: 'password', placeholder: 'xxxx xxxx xxxx xxxx' },
              { key: 'email_recipient', label: 'Email destinatario (el suyo)', type: 'email', placeholder: 'ella@gmail.com' },
              { key: 'telegram_bot_token', label: 'Telegram Bot Token', type: 'password', placeholder: '123456:ABC...' },
              { key: 'telegram_chat_id', label: 'Telegram Chat ID del grupo', type: 'text', placeholder: '-100123456789' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={cfg[key] || ''}
                  onChange={e => updateField(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo de imagen Kie AI</label>
              <select
                value={cfg.kie_ai_model || 'nano-banana-2'}
                onChange={e => updateField('kie_ai_model', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="nano-banana-2">Google Nano Banana 2 (recomendado)</option>
                <option value="flux-dev">Flux Dev</option>
                <option value="flux-pro">Flux Pro</option>
                <option value="kling-v1">Kling v1</option>
                <option value="kling-v1-5">Kling v1.5</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resolución de imagen</label>
              <select
                value={cfg.kie_ai_resolution || '1K'}
                onChange={e => updateField('kie_ai_resolution', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="1K">1K — $0.04/imagen (recomendado)</option>
                <option value="2K">2K — $0.06/imagen</option>
                <option value="4K">4K — $0.09/imagen</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Para redes sociales, 1K es más que suficiente.</p>
            </div>
          </div>
        </section>

        {/* Horarios */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b">Horarios de envío</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'daily_email_hour', label: 'Email diario (hora)' },
              { key: 'telegram_news_hour', label: 'Telegram noticias (hora)' },
              { key: 'telegram_trends_hour', label: 'Telegram tendencias (hora)' },
              { key: 'weekly_email_hour', label: 'Email semanal (hora)' },
              { key: 'weekly_telegram_hour', label: 'Telegram semanal (hora)' },
              { key: 'weekly_telegram_minute', label: 'Telegram semanal (minuto)' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type="number"
                  min={0}
                  max={key.includes('minute') ? 59 : 23}
                  value={cfg.schedules?.[key] ?? 0}
                  onChange={e => updateSchedule(key, parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Día email semanal</label>
              <select
                value={cfg.schedules?.weekly_email_day || 'monday'}
                onChange={e => updateSchedule('weekly_email_day', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Fuentes RSS */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b">Fuentes de información</h2>
          <div className="space-y-3">
            {cfg.rss_sources?.map((src, idx) => (
              <div key={idx} className="flex gap-2 items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                <input
                  type="checkbox"
                  checked={src.active}
                  onChange={e => updateRssSource(idx, 'active', e.target.checked)}
                  className="accent-indigo-600"
                />
                <input
                  value={src.name}
                  onChange={e => updateRssSource(idx, 'name', e.target.value)}
                  placeholder="Nombre"
                  className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm"
                />
                <input
                  value={src.url}
                  onChange={e => updateRssSource(idx, 'url', e.target.value)}
                  placeholder="URL del RSS"
                  className="flex-[2] border border-gray-200 rounded px-2 py-1 text-sm"
                />
                <select
                  value={src.category}
                  onChange={e => updateRssSource(idx, 'category', e.target.value)}
                  className="border border-gray-200 rounded px-2 py-1 text-sm"
                >
                  {['Colombia','LATAM','Global'].map(c => <option key={c}>{c}</option>)}
                </select>
                <button type="button" onClick={() => removeRssSource(idx)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
              </div>
            ))}
            <button type="button" onClick={addRssSource} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Agregar fuente</button>
          </div>
        </section>

        {/* Fuentes adicionales */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b">Fuentes adicionales (Reddit, foros, etc.)</h2>
          <p className="text-xs text-gray-500 mb-3">Agrega feeds RSS adicionales. Ej: <code>https://www.reddit.com/r/startups/.rss</code></p>
          <div className="space-y-2">
            {(cfg.additional_sources || []).map((src, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-gray-50 rounded-lg p-2">
                <input type="checkbox" checked={src.active !== false}
                  onChange={e => {
                    const arr = [...(cfg.additional_sources || [])]
                    arr[idx] = { ...arr[idx], active: e.target.checked }
                    updateField('additional_sources', arr)
                  }}
                  className="accent-indigo-600" />
                <input value={src.name || ''} placeholder="Nombre"
                  onChange={e => {
                    const arr = [...(cfg.additional_sources || [])]
                    arr[idx] = { ...arr[idx], name: e.target.value }
                    updateField('additional_sources', arr)
                  }}
                  className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm" />
                <input value={src.url || ''} placeholder="URL del feed RSS"
                  onChange={e => {
                    const arr = [...(cfg.additional_sources || [])]
                    arr[idx] = { ...arr[idx], url: e.target.value }
                    updateField('additional_sources', arr)
                  }}
                  className="flex-[2] border border-gray-200 rounded px-2 py-1 text-sm" />
                <select value={src.category || 'Global'}
                  onChange={e => {
                    const arr = [...(cfg.additional_sources || [])]
                    arr[idx] = { ...arr[idx], category: e.target.value }
                    updateField('additional_sources', arr)
                  }}
                  className="border border-gray-200 rounded px-2 py-1 text-sm">
                  <option>Colombia</option>
                  <option>LATAM</option>
                  <option>Global</option>
                </select>
                <button type="button" onClick={() => {
                  const arr = (cfg.additional_sources || []).filter((_, i) => i !== idx)
                  updateField('additional_sources', arr)
                }} className="text-red-300 hover:text-red-500 px-1">×</button>
              </div>
            ))}
            <button type="button" onClick={() => {
              updateField('additional_sources', [...(cfg.additional_sources || []), { name: '', url: '', active: true, category: 'Global' }])
            }} className="text-sm text-indigo-600 hover:text-indigo-800">+ Agregar fuente</button>
          </div>
        </section>

        {/* Pilares de contenido */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b">Pilares de contenido</h2>
          <div className="space-y-3">
            {cfg.content_pillars?.map((pillar, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    checked={pillar.active}
                    onChange={e => updatePillar(idx, 'active', e.target.checked)}
                    className="accent-indigo-600"
                  />
                  <input
                    value={pillar.name}
                    onChange={e => updatePillar(idx, 'name', e.target.value)}
                    placeholder="Nombre del pilar"
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm font-medium"
                  />
                  <select
                    value={pillar.weight}
                    onChange={e => updatePillar(idx, 'weight', parseInt(e.target.value))}
                    className="border border-gray-200 rounded px-2 py-1 text-sm"
                    title="Prioridad (mayor número = más contenido propuesto)"
                  >
                    {[1,2,3,4,5].map(w => <option key={w} value={w}>Prioridad {w}</option>)}
                  </select>
                  <button type="button" onClick={() => removePillar(idx)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                </div>
                <textarea
                  value={pillar.description}
                  onChange={e => updatePillar(idx, 'description', e.target.value)}
                  placeholder="Descripción del pilar"
                  rows={2}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                />
              </div>
            ))}
            <button type="button" onClick={addPillar} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Agregar pilar</button>
          </div>
        </section>

        {/* Contexto de marca */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b">Contexto de marca para la IA</h2>
          <textarea
            value={cfg.brand_context || ''}
            onChange={e => updateField('brand_context', e.target.value)}
            placeholder="Escribe aquí instrucciones adicionales para la IA: tono de la marca, temas a evitar, aliados importantes, eventos próximos, etc."
            rows={5}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </section>

        {/* Analytics */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b">Analytics</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Umbral de alerta: {cfg.alert_threshold_pct}% de variación
            </label>
            <input
              type="range"
              min={5}
              max={50}
              value={cfg.alert_threshold_pct || 20}
              onChange={e => updateField('alert_threshold_pct', parseInt(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <p className="text-xs text-gray-400 mt-1">Enviar alerta si las métricas varían más de este porcentaje vs. la semana anterior</p>
          </div>
        </section>

        {/* Límites de contenido */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b">Límites de contenido</h2>

          <p className="text-xs text-gray-500 mb-3 font-medium">Inteligencia (artículos por categoría)</p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { key: 'count_articles_colombia', label: 'Colombia', def: 5 },
              { key: 'count_articles_latam', label: 'LATAM', def: 5 },
              { key: 'count_articles_global', label: 'Global', def: 5 },
            ].map(({ key, label, def }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type="number" min={0} max={50}
                  value={cfg[key] ?? def}
                  onChange={e => updateField(key, parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 mb-3 font-medium">Inteligencia (general)</p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { key: 'max_articles_per_feed', label: 'Artículos máx. por fuente RSS', def: 10, min: 1, max: 50 },
              { key: 'max_articles_age_days', label: 'Antigüedad máx. (días)', def: 30, min: 1, max: 365 },
            ].map(({ key, label, def, min, max }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type="number" min={min} max={max}
                  value={cfg[key] ?? def}
                  onChange={e => updateField(key, parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 mb-3 font-medium">Tendencias por plataforma</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[
              { key: 'max_trends_google', label: 'Google Trends', def: 5 },
              { key: 'max_trends_youtube', label: 'YouTube', def: 5 },
              { key: 'max_trends_tiktok', label: 'TikTok', def: 3 },
              { key: 'max_trends_linkedin', label: 'LinkedIn', def: 3 },
            ].map(({ key, label, def }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type="number" min={0} max={20}
                  value={cfg[key] ?? def}
                  onChange={e => updateField(key, parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 mb-2">
            {[
              { key: 'trend_keywords_tiktok', label: 'Keywords TikTok (separadas por coma)', placeholder: 'tiktok viral, trending tiktok, ...' },
              { key: 'trend_keywords_linkedin', label: 'Keywords LinkedIn (separadas por coma)', placeholder: 'liderazgo empresarial, tendencias laborales, ...' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type="text" placeholder={placeholder}
                  value={Array.isArray(cfg[key]) ? cfg[key].join(', ') : (cfg[key] || '')}
                  onChange={e => updateField(key, e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">TikTok y LinkedIn no tienen API pública; las tendencias se generan analizando estas keywords con IA.</p>
        </section>

        {/* Uso y costos de IA */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b">Uso y costos de IA</h2>
          <AIUsagePanel />
        </section>

        {/* Reportes manuales */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b">Reportes</h2>
          <p className="text-xs text-gray-500 mb-3">Los reportes se envían automáticamente según los horarios configurados, pero puedes enviarlos manualmente:</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { endpoint: '/api/reports/send-monthly', label: '📊 Reporte mensual (Excel)' },
              { endpoint: '/api/reports/send-weekly-intelligence', label: '🔍 Top artículos semanales' },
              { endpoint: '/api/reports/send-daily-email', label: '📧 Email diario' },
              { endpoint: '/api/reports/send-weekly-email', label: '📧 Email semanal' },
            ].map(({ endpoint, label }) => (
              <ManualReportButton key={endpoint} endpoint={endpoint} label={label} />
            ))}
          </div>
        </section>

        {/* Reiniciar con nueva marca */}
        <section className="border-t border-red-100 pt-6 mt-6">
          <h2 className="text-base font-semibold text-red-700 mb-2">Zona delicada — Reiniciar con nueva marca</h2>
          <p className="text-xs text-gray-500 mb-3">
            Si esta instalación va a ser usada para otra marca distinta, puedes limpiar todos los datos manteniendo las configuraciones técnicas (API keys, horarios, integraciones). Esto es <b>irreversible</b>.
          </p>
          <ResetBrandPanel />
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar configuración'}
        </button>
      </form>
    </div>
  )
}

function AIUsagePanel() {
  const [summary, setSummary] = useState([])
  useEffect(() => {
    fetch('/api/ai-usage/summary?days=30').then(r => r.json()).then(setSummary).catch(() => setSummary([]))
  }, [])
  const total = summary.reduce((s, r) => s + (r.total_cost_usd || 0), 0)
  return (
    <div>
      <p className="text-sm text-gray-700 mb-3">Costo total últimos 30 días: <span className="font-bold text-indigo-600">${total.toFixed(2)} USD</span></p>
      <div className="space-y-2">
        {summary.map((r, i) => (
          <div key={i} className="flex justify-between text-xs bg-gray-50 rounded px-3 py-2">
            <span>{r.service} · {r.model}</span>
            <span>{r.calls} llamadas · ${(r.total_cost_usd || 0).toFixed(3)}</span>
          </div>
        ))}
        {summary.length === 0 && <p className="text-xs text-gray-400">Aún no hay datos de uso.</p>}
      </div>
    </div>
  )
}

function ManualReportButton({ endpoint, label }) {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')
  async function handle() {
    setSending(true); setResult('')
    try {
      const r = await fetch(endpoint, { method: 'POST' })
      const data = await r.json()
      if (data.status === 'ok') setResult('✓ Enviado')
      else setResult(data.error || data.reason || '✗ Error')
    } catch { setResult('✗ Error de conexión') }
    finally {
      setSending(false)
      setTimeout(() => setResult(''), 5000)
    }
  }
  return (
    <button type="button" onClick={handle} disabled={sending}
      className="border border-gray-200 hover:bg-gray-50 text-sm px-3 py-2 rounded-lg disabled:opacity-50 text-left">
      {sending ? '⏳ Enviando...' : (result || label)}
    </button>
  )
}

function ResetBrandPanel() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState('')

  async function run() {
    if (!name || confirm !== 'REINICIAR') {
      setResult('Escribe REINICIAR para confirmar.')
      return
    }
    setRunning(true); setResult('')
    try {
      const r = await fetch('/api/system/reset-for-new-brand', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: { name, active: true } }),
      })
      const data = await r.json()
      if (data.error) setResult(data.error)
      else { setResult('✓ Reiniciado. Reload en 2 segundos...'); setTimeout(() => window.location.reload(), 2000) }
    } catch { setResult('Error de conexión') }
    finally { setRunning(false) }
  }

  return (
    <div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          className="text-sm text-red-600 hover:text-red-800 font-medium">
          Quiero reiniciar el sistema para otra marca →
        </button>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Nombre de la nueva marca"
            className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm" />
          <input value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Escribe REINICIAR para confirmar"
            className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={run} disabled={running || !name || confirm !== 'REINICIAR'}
              className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded-lg disabled:opacity-50">
              {running ? 'Reiniciando...' : 'Reiniciar todo'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setName(''); setConfirm('') }}
              className="text-sm text-gray-500 px-3 py-2">Cancelar</button>
          </div>
          {result && <p className="text-xs">{result}</p>}
        </div>
      )}
    </div>
  )
}
