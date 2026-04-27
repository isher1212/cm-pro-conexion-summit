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
