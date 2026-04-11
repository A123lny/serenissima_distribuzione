import { NavLink } from 'react-router-dom'
import { Home, Map, Truck, BarChart3, FileText, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const pagine = [
  { to: '/', icon: Home, label: 'Home', permesso: 'dashboard' },
  { to: '/giri', icon: Map, label: 'Giri', permesso: 'giri' },
  { to: '/consegna', icon: Truck, label: 'Consegne', permesso: 'consegne' },
  { to: '/storico', icon: BarChart3, label: 'Storico', permesso: 'storico' },
  { to: '/report', icon: FileText, label: 'Report', permesso: 'report' },
  { to: '/utenti', icon: Users, label: 'Utenti', permesso: 'utenti' },
]

export default function BottomNav() {
  const { haPermesso } = useAuth()

  const linkClass = ({ isActive }) =>
    `flex flex-col items-center gap-1 py-2 px-2 text-xs transition-colors ${
      isActive ? 'text-terra-500 font-semibold' : 'text-gray-500'
    }`

  const pagineVisibili = pagine.filter(p => haPermesso(p.permesso))

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around max-w-lg mx-auto">
        {pagineVisibili.map(p => (
          <NavLink key={p.to} to={p.to} className={linkClass}>
            <p.icon size={20} />
            <span>{p.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
