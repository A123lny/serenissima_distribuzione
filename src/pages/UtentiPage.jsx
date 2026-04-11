import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit2, Trash2, Eye, EyeOff, User, Shield } from 'lucide-react'
import Button from '../components/UI/Button'
import Modal from '../components/UI/Modal'
import Badge from '../components/UI/Badge'

export default function UtentiPage() {
  const [utenti, setUtenti] = useState([])
  const [corrieri, setCorrieri] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showPasswords, setShowPasswords] = useState({})

  const [form, setForm] = useState({
    username: '',
    password: '',
    ruolo: 'corriere',
    corriere_id: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: ut } = await supabase
      .from('codici_accesso')
      .select('*, corrieri(nome)')
      .eq('attivo', true)
      .order('ruolo')

    if (ut) setUtenti(ut)

    const { data: corr } = await supabase
      .from('corrieri')
      .select('*')
      .eq('attivo', true)

    if (corr) setCorrieri(corr)
    setLoading(false)
  }

  const openModal = (utente = null) => {
    if (utente) {
      setEditing(utente)
      setForm({
        username: utente.username || '',
        password: utente.password || '',
        ruolo: utente.ruolo,
        corriere_id: utente.corriere_id || '',
      })
    } else {
      setEditing(null)
      setForm({ username: '', password: '', ruolo: 'corriere', corriere_id: '' })
    }
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.username.trim() || !form.password.trim()) return

    const data = {
      username: form.username.trim(),
      password: form.password.trim(),
      ruolo: form.ruolo,
      corriere_id: form.corriere_id || null,
      codice: form.username.trim().toUpperCase(),
    }

    if (editing) {
      await supabase.from('codici_accesso').update(data).eq('id', editing.id)
    } else {
      await supabase.from('codici_accesso').insert(data)
    }

    setShowModal(false)
    await fetchData()
  }

  const handleDelete = async (id) => {
    await supabase.from('codici_accesso').update({ attivo: false }).eq('id', id)
    await fetchData()
  }

  const togglePassword = (id) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Gestione Utenti</h2>
        <Button size="sm" onClick={() => openModal()}>
          <Plus size={16} className="inline mr-1" />Nuovo Utente
        </Button>
      </div>

      {/* Lista utenti */}
      <div className="space-y-3">
        {utenti.map(u => (
          <div key={u.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${u.ruolo === 'admin' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                  {u.ruolo === 'admin' ? <Shield size={20} className="text-purple-600" /> : <User size={20} className="text-blue-600" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{u.username}</p>
                    <Badge color={u.ruolo === 'admin' ? 'blue' : 'green'}>{u.ruolo}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500">Password:</span>
                    <span className="text-sm font-mono text-gray-700">
                      {showPasswords[u.id] ? u.password : '••••••'}
                    </span>
                    <button onClick={() => togglePassword(u.id)} className="p-0.5 text-gray-400 hover:text-gray-600">
                      {showPasswords[u.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {u.corrieri?.nome && (
                    <p className="text-sm text-gray-500 mt-1">Corriere: {u.corrieri.nome}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openModal(u)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(u.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {utenti.length === 0 && (
        <p className="text-center text-gray-400 py-8">Nessun utente configurato</p>
      )}

      {/* Modale crea/modifica utente */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Modifica Utente' : 'Nuovo Utente'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              placeholder="Es. mario, admin2"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="text"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Scegli una password"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
            <select
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={form.ruolo}
              onChange={e => setForm({ ...form, ruolo: e.target.value })}
            >
              <option value="corriere">Corriere</option>
              <option value="admin">Amministratore</option>
            </select>
          </div>

          {form.ruolo === 'corriere' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Collega a corriere (opzionale)</label>
              <select
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
                value={form.corriere_id}
                onChange={e => setForm({ ...form, corriere_id: e.target.value })}
              >
                <option value="">Nessun corriere collegato</option>
                {corrieri.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Se collegato, vedra' solo i giri assegnati a quel corriere</p>
            </div>
          )}

          <Button className="w-full" onClick={handleSave}>
            {editing ? 'Salva Modifiche' : 'Crea Utente'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
