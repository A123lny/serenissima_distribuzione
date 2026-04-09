import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Newspaper, Loader2 } from 'lucide-react'
import Button from '../components/UI/Button'

export default function LoginPage() {
  const [codice, setCodice] = useState('')
  const [errore, setErrore] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!codice.trim()) {
      setErrore('Inserisci il codice di accesso')
      return
    }

    setLoading(true)
    setErrore('')

    try {
      await login(codice.trim())
    } catch {
      setErrore('Codice non valido. Riprova.')
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
              Codice di accesso
            </label>
            <input
              type="text"
              value={codice}
              onChange={(e) => { setCodice(e.target.value); setErrore('') }}
              placeholder="Inserisci il tuo codice"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg text-center tracking-widest focus:border-blue-500 focus:outline-none transition-colors"
              autoFocus
              autoComplete="off"
            />
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
