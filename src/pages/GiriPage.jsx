import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useGiri } from '../hooks/useGiri'
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, MapPin, ArrowUp, ArrowDown } from 'lucide-react'
import Button from '../components/UI/Button'
import Modal from '../components/UI/Modal'

export default function GiriPage() {
  const { giri, loading, addGiro, updateGiro, deleteGiro, addLocalita, updateLocalita, deleteLocalita, riordinaLocalita } = useGiri()
  const [corrieri, setCorrieri] = useState([])
  const [giroAperto, setGiroAperto] = useState(null)

  // Modali
  const [showGiroModal, setShowGiroModal] = useState(false)
  const [showLocalitaModal, setShowLocalitaModal] = useState(false)
  const [showCorriereModal, setShowCorriereModal] = useState(false)
  const [editingGiro, setEditingGiro] = useState(null)
  const [editingLocalita, setEditingLocalita] = useState(null)
  const [selectedGiroId, setSelectedGiroId] = useState(null)

  // Form giro
  const [giroForm, setGiroForm] = useState({ corriere_id: '', numero_giro: 1, nome_giro: '' })
  // Form localita
  const [locForm, setLocForm] = useState({ nome_locale: '', indirizzo: '', note: '', copie_standard: 0 })
  // Form corriere
  const [corriereForm, setCorriereForm] = useState({ nome: '', veicolo: '' })

  useEffect(() => {
    supabase.from('corrieri').select('*').eq('attivo', true).then(({ data }) => {
      if (data) setCorrieri(data)
    })
  }, [])

  // === CORRIERE ===
  const handleSaveCorriere = async () => {
    if (!corriereForm.nome.trim()) return
    const { error } = await supabase.from('corrieri').insert(corriereForm)
    if (!error) {
      const { data } = await supabase.from('corrieri').select('*').eq('attivo', true)
      if (data) setCorrieri(data)
      setCorriereForm({ nome: '', veicolo: '' })
      setShowCorriereModal(false)
    }
  }

  // === GIRO ===
  const openGiroModal = (giro = null) => {
    if (giro) {
      setEditingGiro(giro)
      setGiroForm({ corriere_id: giro.corriere_id, numero_giro: giro.numero_giro, nome_giro: giro.nome_giro || '' })
    } else {
      setEditingGiro(null)
      setGiroForm({ corriere_id: corrieri[0]?.id || '', numero_giro: 1, nome_giro: '' })
    }
    setShowGiroModal(true)
  }

  const handleSaveGiro = async () => {
    if (!giroForm.corriere_id) return
    if (editingGiro) {
      await updateGiro(editingGiro.id, giroForm)
    } else {
      await addGiro(giroForm)
    }
    setShowGiroModal(false)
  }

  // === LOCALITA ===
  const openLocalitaModal = (giroId, loc = null) => {
    setSelectedGiroId(giroId)
    if (loc) {
      setEditingLocalita(loc)
      setLocForm({ nome_locale: loc.nome_locale, indirizzo: loc.indirizzo || '', note: loc.note || '', copie_standard: loc.copie_standard || 0 })
    } else {
      setEditingLocalita(null)
      setLocForm({ nome_locale: '', indirizzo: '', note: '', copie_standard: 0 })
    }
    setShowLocalitaModal(true)
  }

  const handleSaveLocalita = async () => {
    if (!locForm.nome_locale.trim()) return
    if (editingLocalita) {
      await updateLocalita(editingLocalita.id, locForm)
    } else {
      const giro = giri.find(g => g.id === selectedGiroId)
      const ordine = giro ? (giro.localita?.length || 0) : 0
      await addLocalita({ ...locForm, giro_id: selectedGiroId, ordine })
    }
    setShowLocalitaModal(false)
  }

  const spostaLocalita = async (giro, index, direzione) => {
    const locs = [...giro.localita]
    const newIndex = index + direzione
    if (newIndex < 0 || newIndex >= locs.length) return
    ;[locs[index], locs[newIndex]] = [locs[newIndex], locs[index]]
    await riordinaLocalita(locs.map(l => l.id))
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
        <h2 className="text-2xl font-bold text-gray-900">Gestione Giri</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowCorriereModal(true)}>
            <Plus size={16} className="inline mr-1" />Corriere
          </Button>
          <Button size="sm" onClick={() => openGiroModal()}>
            <Plus size={16} className="inline mr-1" />Giro
          </Button>
        </div>
      </div>

      {/* Lista corrieri con giri */}
      {corrieri.map(corriere => {
        const giriCorriere = giri.filter(g => g.corriere_id === corriere.id)
        return (
          <div key={corriere.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">{corriere.nome}</h3>
              <p className="text-sm text-gray-500">{corriere.veicolo || 'Nessun veicolo'} - {giriCorriere.length} giri</p>
            </div>

            {giriCorriere.length === 0 ? (
              <p className="text-gray-400 text-center py-4 text-sm">Nessun giro assegnato</p>
            ) : (
              giriCorriere.map(giro => (
                <div key={giro.id} className="border-b border-gray-100 last:border-b-0">
                  {/* Header giro */}
                  <div
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => setGiroAperto(giroAperto === giro.id ? null : giro.id)}
                  >
                    <div className="flex items-center gap-2">
                      {giroAperto === giro.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      <span className="font-medium">
                        {giro.nome_giro || `Giro ${giro.numero_giro}`}
                      </span>
                      <span className="text-sm text-gray-400">({giro.localita?.length || 0} localita)</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); openGiroModal(giro) }} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteGiro(giro.id) }} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Localita del giro */}
                  {giroAperto === giro.id && (
                    <div className="px-4 pb-3 space-y-2">
                      {(giro.localita || []).map((loc, idx) => (
                        <div key={loc.id} className="bg-gray-50 rounded-lg p-3 flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900">{loc.nome_locale}</p>
                              {loc.indirizzo && (
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                  <MapPin size={12} />{loc.indirizzo}
                                </p>
                              )}
                              {loc.note && <p className="text-xs text-gray-400 italic">{loc.note}</p>}
                              <p className="text-xs text-blue-600 mt-1">{loc.copie_standard} copie</p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <button onClick={() => spostaLocalita(giro, idx, -1)} disabled={idx === 0} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
                              <ArrowUp size={14} />
                            </button>
                            <button onClick={() => spostaLocalita(giro, idx, 1)} disabled={idx === giro.localita.length - 1} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
                              <ArrowDown size={14} />
                            </button>
                            <button onClick={() => openLocalitaModal(giro.id, loc)} className="p-1 hover:bg-blue-50 rounded text-blue-600">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => deleteLocalita(loc.id)} className="p-1 hover:bg-red-50 rounded text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" className="w-full" onClick={() => openLocalitaModal(giro.id)}>
                        <Plus size={16} className="inline mr-1" />Aggiungi Localita
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )
      })}

      {corrieri.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="mb-2">Nessun corriere configurato</p>
          <Button onClick={() => setShowCorriereModal(true)}>Aggiungi primo corriere</Button>
        </div>
      )}

      {/* Modale Corriere */}
      <Modal isOpen={showCorriereModal} onClose={() => setShowCorriereModal(false)} title="Nuovo Corriere">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={corriereForm.nome}
              onChange={e => setCorriereForm({ ...corriereForm, nome: e.target.value })}
              placeholder="Nome del corriere"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Veicolo</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={corriereForm.veicolo}
              onChange={e => setCorriereForm({ ...corriereForm, veicolo: e.target.value })}
              placeholder="Es. Fiat Punto, Scooter"
            />
          </div>
          <Button className="w-full" onClick={handleSaveCorriere}>Salva Corriere</Button>
        </div>
      </Modal>

      {/* Modale Giro */}
      <Modal isOpen={showGiroModal} onClose={() => setShowGiroModal(false)} title={editingGiro ? 'Modifica Giro' : 'Nuovo Giro'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Corriere</label>
            <select
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={giroForm.corriere_id}
              onChange={e => setGiroForm({ ...giroForm, corriere_id: e.target.value })}
            >
              <option value="">Seleziona corriere</option>
              {corrieri.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Numero Giro (1-4)</label>
            <input
              type="number"
              min={1}
              max={4}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={giroForm.numero_giro}
              onChange={e => setGiroForm({ ...giroForm, numero_giro: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Giro</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={giroForm.nome_giro}
              onChange={e => setGiroForm({ ...giroForm, nome_giro: e.target.value })}
              placeholder="Es. Giro Centro, Giro Nord"
            />
          </div>
          <Button className="w-full" onClick={handleSaveGiro}>
            {editingGiro ? 'Salva Modifiche' : 'Crea Giro'}
          </Button>
        </div>
      </Modal>

      {/* Modale Localita */}
      <Modal isOpen={showLocalitaModal} onClose={() => setShowLocalitaModal(false)} title={editingLocalita ? 'Modifica Localita' : 'Nuova Localita'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Locale</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={locForm.nome_locale}
              onChange={e => setLocForm({ ...locForm, nome_locale: e.target.value })}
              placeholder="Es. Bar Sport, Tabacchi Rossi"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={locForm.indirizzo}
              onChange={e => setLocForm({ ...locForm, indirizzo: e.target.value })}
              placeholder="Via Roma 15, Venezia"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={locForm.note}
              onChange={e => setLocForm({ ...locForm, note: e.target.value })}
              placeholder="Es. Lasciare fuori dalla porta"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Copie standard</label>
            <input
              type="number"
              min={0}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={locForm.copie_standard}
              onChange={e => setLocForm({ ...locForm, copie_standard: parseInt(e.target.value) || 0 })}
            />
          </div>
          <Button className="w-full" onClick={handleSaveLocalita}>
            {editingLocalita ? 'Salva Modifiche' : 'Aggiungi Localita'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
