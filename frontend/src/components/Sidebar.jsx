import { NavLink } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, Newspaper, Flame, Calendar, Mail, Settings } from 'lucide-react'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/analytics', icon: TrendingUp, label: 'Analytics' },
  { to: '/intelligence', icon: Newspaper, label: 'Inteligencia' },
  { to: '/trends', icon: Flame, label: 'Tendencias' },
  { to: '/planner', icon: Calendar, label: 'Parrilla' },
  { to: '/reports', icon: Mail, label: 'Reportes' },
  { to: '/settings', icon: Settings, label: 'Configuración' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 min-h-screen bg-white border-r border-gray-100 flex flex-col py-6 px-3 fixed top-0 left-0">
      <div className="px-3 mb-8">
        <span className="text-indigo-600 font-bold text-lg tracking-tight">CM Pro</span>
        <p className="text-xs text-gray-400 mt-0.5">Conexión Summit</p>
      </div>
      <nav className="flex flex-col gap-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${isActive
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
