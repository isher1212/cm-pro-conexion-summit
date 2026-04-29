import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Type, Image as ImageIcon, Trash2, Award, Sliders, Move } from 'lucide-react'

const POSITION_PRESETS = [
  { val: 'tl', label: '↖' }, { val: 'tc', label: '↑' }, { val: 'tr', label: '↗' },
  { val: 'cl', label: '←' }, { val: 'cc', label: '·' }, { val: 'cr', label: '→' },
  { val: 'bl', label: '↙' }, { val: 'bc', label: '↓' }, { val: 'br', label: '↘' },
]

function positionFor(preset, canvasW, canvasH, itemW, itemH, padding = 24) {
  const map = {
    tl: [padding, padding],
    tc: [(canvasW - itemW) / 2, padding],
    tr: [canvasW - itemW - padding, padding],
    cl: [padding, (canvasH - itemH) / 2],
    cc: [(canvasW - itemW) / 2, (canvasH - itemH) / 2],
    cr: [canvasW - itemW - padding, (canvasH - itemH) / 2],
    bl: [padding, canvasH - itemH - padding],
    bc: [(canvasW - itemW) / 2, canvasH - itemH - padding],
    br: [canvasW - itemW - padding, canvasH - itemH - padding],
  }
  const [x, y] = map[preset] || map.cc
  return { x: Math.round(x), y: Math.round(y) }
}

export default function ImageEditor() {
  const [params] = useSearchParams()
  const initialUrl = params.get('url') || ''
  const canvasRef = useRef(null)
  const [imgUrl, setImgUrl] = useState(initialUrl)
  const [textLayers, setTextLayers] = useState([])
  const [logoUrl, setLogoUrl] = useState('')
  const [logoPos, setLogoPos] = useState({ x: 24, y: 24, size: 100 })
  const [activeText, setActiveText] = useState(null)
  const [bgImg, setBgImg] = useState(null)
  const [logoImg, setLogoImg] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ brightness: 100, contrast: 100, saturation: 100 })
  const [brandLoading, setBrandLoading] = useState(false)
  const [drag, setDrag] = useState(null)

  useEffect(() => {
    if (!imgUrl) return
    setError('')
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setBgImg(img)
    img.onerror = () => setError('No se pudo cargar la imagen (CORS). Descárgala primero y súbela como archivo.')
    img.src = imgUrl
  }, [imgUrl])

  useEffect(() => {
    if (!logoUrl) { setLogoImg(null); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setLogoImg(img)
    img.onerror = () => setLogoImg(null)
    img.src = logoUrl
  }, [logoUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !bgImg) return
    canvas.width = bgImg.naturalWidth
    canvas.height = bgImg.naturalHeight
    const ctx = canvas.getContext('2d')

    ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)`
    ctx.drawImage(bgImg, 0, 0)
    ctx.filter = 'none'

    if (logoImg) {
      const ratio = logoImg.naturalHeight / logoImg.naturalWidth
      ctx.drawImage(logoImg, logoPos.x, logoPos.y, logoPos.size, logoPos.size * ratio)
    }
    textLayers.forEach(t => {
      ctx.font = `${t.bold ? 'bold ' : ''}${t.size}px ${t.font}`
      ctx.fillStyle = t.color
      ctx.textBaseline = 'top'
      if (t.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.6)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
      } else {
        ctx.shadowColor = 'transparent'
      }
      const lines = (t.text || '').split('\n')
      lines.forEach((line, i) => ctx.fillText(line, t.x, t.y + i * (t.size + 6)))
    })
  }, [bgImg, logoImg, logoPos, textLayers, filters])

  function addText() {
    setTextLayers(prev => [...prev, {
      id: Date.now(), text: 'Tu texto', x: 50, y: 50, size: 48,
      color: '#ffffff', font: 'Arial', bold: true, shadow: true,
    }])
  }

  function updateText(id, patch) {
    setTextLayers(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  function removeText(id) {
    setTextLayers(prev => prev.filter(t => t.id !== id))
    if (activeText === id) setActiveText(null)
  }

  function applyLogoPreset(preset) {
    if (!bgImg || !logoImg) return
    const ratio = logoImg.naturalHeight / logoImg.naturalWidth
    const w = logoPos.size
    const h = logoPos.size * ratio
    const pos = positionFor(preset, bgImg.naturalWidth, bgImg.naturalHeight, w, h)
    setLogoPos({ ...logoPos, ...pos })
  }

  function applyTextPreset(id, preset) {
    if (!bgImg) return
    const t = textLayers.find(l => l.id === id)
    if (!t) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.font = `${t.bold ? 'bold ' : ''}${t.size}px ${t.font}`
    const w = ctx.measureText(t.text || '').width
    const lines = (t.text || '').split('\n').length
    const h = lines * (t.size + 6)
    const pos = positionFor(preset, bgImg.naturalWidth, bgImg.naturalHeight, w, h)
    updateText(id, pos)
  }

  function download() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(blob => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `cm-pro-edited-${Date.now()}.png`
      a.click()
    }, 'image/png')
  }

  function uploadFile(setter) {
    return e => {
      const f = e.target.files?.[0]
      if (!f) return
      const reader = new FileReader()
      reader.onload = ev => setter(ev.target.result)
      reader.readAsDataURL(f)
    }
  }

  async function loadBrandLogo() {
    setBrandLoading(true)
    try {
      const r = await fetch('/api/brand/current')
      const data = await r.json()
      if (data && data.logo_url) {
        setLogoUrl(data.logo_url)
      } else {
        alert('La marca activa no tiene logo. Súbelo primero en la página Marca.')
      }
    } catch {
      alert('No se pudo cargar el logo de la marca.')
    } finally { setBrandLoading(false) }
  }

  function resetFilters() {
    setFilters({ brightness: 100, contrast: 100, saturation: 100 })
  }

  function onCanvasMouseDown(e) {
    if (!bgImg) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    if (logoImg) {
      const ratio = logoImg.naturalHeight / logoImg.naturalWidth
      const w = logoPos.size
      const h = logoPos.size * ratio
      if (x >= logoPos.x && x <= logoPos.x + w && y >= logoPos.y && y <= logoPos.y + h) {
        setDrag({ kind: 'logo', offsetX: x - logoPos.x, offsetY: y - logoPos.y })
        return
      }
    }
    for (let i = textLayers.length - 1; i >= 0; i--) {
      const t = textLayers[i]
      const ctx = canvas.getContext('2d')
      ctx.font = `${t.bold ? 'bold ' : ''}${t.size}px ${t.font}`
      const w = ctx.measureText(t.text || '').width
      const lines = (t.text || '').split('\n').length
      const h = lines * (t.size + 6)
      if (x >= t.x && x <= t.x + w && y >= t.y && y <= t.y + h) {
        setActiveText(t.id)
        setDrag({ kind: 'text', id: t.id, offsetX: x - t.x, offsetY: y - t.y })
        return
      }
    }
  }

  function onCanvasMouseMove(e) {
    if (!drag) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    if (drag.kind === 'logo') {
      setLogoPos({ ...logoPos, x: Math.round(x - drag.offsetX), y: Math.round(y - drag.offsetY) })
    } else if (drag.kind === 'text') {
      updateText(drag.id, { x: Math.round(x - drag.offsetX), y: Math.round(y - drag.offsetY) })
    }
  }

  function onCanvasMouseUp() { setDrag(null) }

  const active = textLayers.find(t => t.id === activeText)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Editor de imagen</h1>
      <p className="text-gray-500 text-sm mb-6">Agrega logo y texto a tus imágenes generadas, ajusta filtros y exporta.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4 order-2 lg:order-1">
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Imagen base</h3>
            <input value={imgUrl} onChange={e => setImgUrl(e.target.value)}
              placeholder="URL de imagen"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input type="file" accept="image/*" onChange={uploadFile(d => setImgUrl(d))}
              className="text-xs text-gray-500" />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1"><Sliders size={14} /> Filtros</h3>
            <div className="space-y-2">
              {[
                { key: 'brightness', label: 'Brillo', min: 50, max: 150 },
                { key: 'contrast', label: 'Contraste', min: 50, max: 150 },
                { key: 'saturation', label: 'Saturación', min: 0, max: 200 },
              ].map(f => (
                <div key={f.key}>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{f.label}</span>
                    <span className="tabular-nums">{filters[f.key]}%</span>
                  </div>
                  <input type="range" min={f.min} max={f.max} value={filters[f.key]}
                    onChange={e => setFilters({ ...filters, [f.key]: parseInt(e.target.value) })}
                    className="w-full accent-indigo-600" />
                </div>
              ))}
              <button onClick={resetFilters} className="text-xs text-gray-400 hover:text-gray-600">Restablecer filtros</button>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1"><ImageIcon size={14} /> Logo</h3>
              <button onClick={loadBrandLogo} disabled={brandLoading}
                className="text-xs text-violet-600 hover:text-violet-800 font-medium disabled:opacity-50 flex items-center gap-1">
                <Award size={11} /> {brandLoading ? 'Cargando...' : 'Usar logo de marca'}
              </button>
            </div>
            <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
              placeholder="URL del logo (PNG transparente recomendado)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input type="file" accept="image/*" onChange={uploadFile(d => setLogoUrl(d))}
              className="text-xs text-gray-500" />
            {logoImg && (
              <>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <label className="text-xs text-gray-500">X</label>
                    <input type="number" value={logoPos.x} onChange={e => setLogoPos({ ...logoPos, x: parseInt(e.target.value) || 0 })}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Y</label>
                    <input type="number" value={logoPos.y} onChange={e => setLogoPos({ ...logoPos, y: parseInt(e.target.value) || 0 })}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Tamaño</label>
                    <input type="number" value={logoPos.size} onChange={e => setLogoPos({ ...logoPos, size: parseInt(e.target.value) || 50 })}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Posición rápida</label>
                  <div className="grid grid-cols-3 gap-1">
                    {POSITION_PRESETS.map(p => (
                      <button key={p.val} onClick={() => applyLogoPreset(p.val)}
                        className="aspect-square bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 rounded text-sm">
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1"><Type size={14} /> Texto</h3>
              <button onClick={addText} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Agregar</button>
            </div>
            {textLayers.length === 0 && <p className="text-xs text-gray-400">Sin texto</p>}
            {textLayers.map(t => (
              <div key={t.id} onClick={() => setActiveText(t.id)}
                className={`p-2 rounded-lg cursor-pointer ${activeText === t.id ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50 border border-transparent hover:bg-gray-100'}`}>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs text-gray-700 truncate flex-1">{t.text}</span>
                  <button onClick={e => { e.stopPropagation(); removeText(t.id) }} className="text-red-300 hover:text-red-500"><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
          </div>

          {active && (
            <div className="bg-white border border-indigo-200 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-indigo-700">Editar texto</h3>
              <textarea value={active.text} onChange={e => updateText(active.id, { text: e.target.value })}
                rows={3} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">X</label>
                  <input type="number" value={active.x} onChange={e => updateText(active.id, { x: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Y</label>
                  <input type="number" value={active.y} onChange={e => updateText(active.id, { y: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Tamaño</label>
                  <input type="number" value={active.size} onChange={e => updateText(active.id, { size: parseInt(e.target.value) || 12 })}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Color</label>
                  <input type="color" value={active.color} onChange={e => updateText(active.id, { color: e.target.value })}
                    className="w-full h-7 border border-gray-200 rounded cursor-pointer" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Fuente</label>
                <select value={active.font} onChange={e => updateText(active.id, { font: e.target.value })}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs">
                  {['Arial', 'Helvetica', 'Georgia', 'Verdana', 'Courier New', 'Impact', 'Comic Sans MS'].map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="flex gap-3 text-xs">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={active.bold} onChange={e => updateText(active.id, { bold: e.target.checked })}
                    className="accent-indigo-600" /> Negrita
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={active.shadow} onChange={e => updateText(active.id, { shadow: e.target.checked })}
                    className="accent-indigo-600" /> Sombra
                </label>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Posición rápida</label>
                <div className="grid grid-cols-3 gap-1">
                  {POSITION_PRESETS.map(p => (
                    <button key={p.val} onClick={() => applyTextPreset(active.id, p.val)}
                      className="aspect-square bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 rounded text-sm">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button onClick={download} disabled={!bgImg}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
            <Download size={14} /> Descargar PNG
          </button>
        </div>

        <div className="lg:col-span-2 order-1 lg:order-2">
          <div className="bg-gray-100 rounded-xl p-4 flex items-center justify-center min-h-[400px] relative">
            {bgImg ? (
              <>
                <canvas ref={canvasRef}
                  onMouseDown={onCanvasMouseDown} onMouseMove={onCanvasMouseMove} onMouseUp={onCanvasMouseUp} onMouseLeave={onCanvasMouseUp}
                  className="max-w-full max-h-[600px] border border-gray-200 rounded shadow cursor-move" />
                <div className="absolute top-2 right-2 bg-white/90 text-xs text-gray-500 px-2 py-1 rounded flex items-center gap-1">
                  <Move size={11} /> Arrastra logo o texto
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400">Carga una imagen para empezar</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
