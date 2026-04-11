import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Newspaper, Loader2, Eye, EyeOff } from 'lucide-react'
import Button from '../components/UI/Button'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errore, setErrore] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setErrore('Inserisci utente e password')
      return
    }

    setLoading(true)
    setErrore('')

    try {
      await login(username.trim(), password.trim())
      navigate('/', { replace: true })
    } catch {
      setErrore('Utente o password non validi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-100 p-4 rounded-full mb-4">
            <Newspaper size={40} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">GestDistribuzione</h1>
          <p className="text-gray-500 mt-1">Gestione distribuzione giornali</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Utente
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setErrore('') }}
              placeholder="Inserisci il tuo utente"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-blue-500 focus:outline-none transition-colors"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrore('') }}
                placeholder="Inserisci la password"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-blue-500 focus:outline-none transition-colors pr-12"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {errore && (
            <p className="text-red-500 text-sm text-center">{errore}</p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={20} className="animate-spin" />
                Accesso...
              </span>
            ) : (
              'Accedi'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
