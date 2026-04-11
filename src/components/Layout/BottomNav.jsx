import { NavLink } from 'react-router-dom'
import { Home, Map, Truck, BarChart3, FileText, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function BottomNav() {
  const { isAdmin } = useAuth()

  const linkClass = ({ isActive }) =>
    `flex flex-col items-center gap-1 py-2 px-2 text-xs transition-colors ${
      isActive ? 'text-blue-600 font-semibold' : 'text-gray-500'
    }`

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around max-w-lg mx-auto">
        <NavLink to="/" className={linkClass}>
          <Home size={20} />
          <span>Home</span>
        </NavLink>

        {isAdmin && (
          <NavLink to="/giri" className={linkClass}>
            <Map size={20} />
            <span>Giri</span>
          </NavLink>
        )}

        <NavLink to="/consegna" className={linkClass}>
          <Truck size={20} />
          <span>Consegne</span>
        </NavLink>

        <NavLink to="/storico" className={linkClass}>
          <BarChart3 size={20} />
          <span>Storico</span>
        </NavLink>

        {isAdmin && (
          <NavLink to="/report" className={linkClass}>
            <FileText size={20} />
            <span>Report</span>
          </NavLink>
        )}

        {isAdmin && (
          <NavLink to="/utenti" className={linkClass}>
            <Users size={20} />
            <span>Utenti</span>
          </NavLink>
        )}
      </div>
    </nav>
  )
}
