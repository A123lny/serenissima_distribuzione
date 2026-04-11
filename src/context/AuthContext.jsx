import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [utente, setUtente] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('gest_auth')
    if (saved) {
      try {
        setUtente(JSON.parse(saved))
      } catch {
        localStorage.removeItem('gest_auth')
      }
    }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    const { data, error } = await supabase
      .from('codici_accesso')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .eq('attivo', true)
      .single()

    if (error || !data) {
      throw new Error('Credenziali non valide')
    }

    let corriere = null
    if (data.corriere_id) {
      const { data: c } = await supabase
        .from('corrieri')
        .select('*')
        .eq('id', data.corriere_id)
        .single()
      corriere = c
    }

    const utenteData = {
      id: data.id,
      ruolo: data.ruolo,
      corriere_id: data.corriere_id,
      corriere,
      permessi: data.permessi || [],
      nome: data.ruolo === 'admin' ? 'Amministratore' : corriere?.nome || 'Utente',
    }

    localStorage.setItem('gest_auth', JSON.stringify(utenteData))
    setUtente(utenteData)
    return utenteData
  }

  const logout = () => {
    localStorage.removeItem('gest_auth')
    setUtente(null)
  }

  const isAdmin = utente?.ruolo === 'admin'

  const haPermesso = (pagina) => {
    if (!utente) return false
    if (isAdmin && (!utente.permessi || utente.permessi.length === 0)) return true
    return utente.permessi?.includes(pagina)
  }

  return (
    <AuthContext.Provider value={{ utente, loading, login, logout, isAdmin, haPermesso }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve essere usato dentro AuthProvider')
  return context
}
