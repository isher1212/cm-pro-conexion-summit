export default function ViewToggle({ value, onChange, options }) {
  const opts = options || [
    { val: 'active', label: 'Todos', icon: '📋' },
    { val: 'saved', label: 'Guardados', icon: '🔖' },
    { val: 'discarded', label: 'Descartados', icon: '🗑' },
  ]
  return (
    <div className="flex gap-1 flex-wrap">
      {opts.map(o => (
        <button key={o.val} onClick={() => onChange(o.val)}
          className={`text-xs px-3 py-1 rounded-lg border ${value === o.val ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          {o.icon} {o.label}
        </button>
      ))}
    </div>
  )
}
