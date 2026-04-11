import { useAuth } from '../../context/AuthContext'
import { LogOut } from 'lucide-react'

export default function Navbar() {
  const { utente, logout, isAdmin } = useAuth()

  return (
    <header className="bg-navy-600 text-white px-4 py-2 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <img src={import.meta.env.BASE_URL + 'logo.jpeg'} alt="Serenissima Sera" className="h-10 rounded" />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm opacity-90">
          {utente?.nome} {isAdmin && '(Admin)'}
        </span>
        <button
          onClick={logout}
          className="p-2 hover:bg-navy-500 rounded-lg transition-colors"
          title="Esci"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  )
}
