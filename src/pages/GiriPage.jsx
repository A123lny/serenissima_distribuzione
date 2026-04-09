import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useGiri } from '../hooks/useGiri'
import {
  Plus, Edit2, Trash2, ChevronDown, ChevronUp, MapPin,
  ArrowUp, ArrowDown, UserPlus, MapPinned, Package
} from 'lucide-react'
import Button from '../components/UI/Button'
import Modal from '../components/UI/Modal'
import Badge from '../components/UI/Badge'

export default function GiriPage() {
  const {
    giri, loading,
    addGiro, updateGiro, deleteGiro, assegnaCorriere,
    addZona, updateZona, deleteZona,
    addLocalita, updateLocalita, deleteLocalita, riordinaLocalita,
  } = useGiri()

  const [corrieri, setCorrieri] = useState([])
  const [giroAperto, setGiroAperto] = useState(null)
  const [zonaAperta, setZonaAperta] = useState(null)

  // Modali
  const [showGiroModal, setShowGiroModal] = useState(false)
  const [showZonaModal, setShowZonaModal] = useState(false)
  const [showLocalitaModal, setShowLocalitaModal] = useState(false)
  const [showCorriereModal, setShowCorriereModal] = useState(false)
  const [showAssegnaModal, setShowAssegnaModal] = useState(false)

  // Editing state
  const [editingGiro, setEditingGiro] = useState(null)
  const [editingZona, setEditingZona] = useState(null)
  const [editingLocalita, setEditingLocalita] = useState(null)
  const [selectedGiroId, setSelectedGiroId] = useState(null)
  const [selectedZonaId, setSelectedZonaId] = useState(null)

  // Forms
  const [giroForm, setGiroForm] = useState({ nome_giro: '' })
  const [zonaForm, setZonaForm] = useState({ nome_zona: '' })
  const [locForm, setLocForm] = useState({ nome_locale: '', indirizzo: '', note: '', copie_standard: 0 })
  const [corriereForm, setCorriereForm] = useState({ nome: '', veicolo: '' })
  const [assegnaCorriereId, setAssegnaCorriereId] = useState('')

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
      setGiroForm({ nome_giro: giro.nome_giro || '' })
    } else {
      setEditingGiro(null)
      setGiroForm({ nome_giro: '' })
    }
    setShowGiroModal(true)
  }

  const handleSaveGiro = async () => {
    if (!giroForm.nome_giro.trim()) return
    if (editingGiro) {
      await updateGiro(editingGiro.id, giroForm)
    } else {
      await addGiro(giroForm)
    }
    setShowGiroModal(false)
  }

  // === ASSEGNA CORRIERE ===
  const openAssegnaModal = (giro) => {
    setSelectedGiroId(giro.id)
    setAssegnaCorriereId(giro.corriere_id || '')
    setShowAssegnaModal(true)
  }

  const handleAssegna = async () => {
    await assegnaCorriere(selectedGiroId, assegnaCorriereId)
    setShowAssegnaModal(false)
  }

  // === ZONA ===
  const openZonaModal = (giroId, zona = null) => {
    setSelectedGiroId(giroId)
    if (zona) {
      setEditingZona(zona)
      setZonaForm({ nome_zona: zona.nome_zona })
    } else {
      setEditingZona(null)
      setZonaForm({ nome_zona: '' })
    }
    setShowZonaModal(true)
  }

  const handleSaveZona = async () => {
    if (!zonaForm.nome_zona.trim()) return
    if (editingZona) {
      await updateZona(editingZona.id, zonaForm)
    } else {
      await addZona({ ...zonaForm, giro_id: selectedGiroId })
    }
    setShowZonaModal(false)
  }

  // === LOCALITA ===
  const openLocalitaModal = (giroId, zonaId, loc = null) => {
    setSelectedGiroId(giroId)
    setSelectedZonaId(zonaId)
    if (loc) {
      setEditingLocalita(loc)
      setLocForm({
        nome_locale: loc.nome_locale,
        indirizzo: loc.indirizzo || '',
        note: loc.note || '',
        copie_standard: loc.copie_standard || 0,
      })
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
      await addLocalita({
        ...locForm,
        giro_id: selectedGiroId,
        zona_id: selectedZonaId,
        ordine: 0,
      })
    }
    setShowLocalitaModal(false)
  }

  const spostaLocalita = async (localitaList, index, direzione) => {
    const locs = [...localitaList]
    const newIndex = index + direzione
    if (newIndex < 0 || newIndex >= locs.length) return
    ;[locs[index], locs[newIndex]] = [locs[newIndex], locs[index]]
    await riordinaLocalita(locs.map(l => l.id))
  }

  // === RENDER LOCALITA ===
  const renderLocalita = (localitaList, giroId, zonaId) => (
    <div className="space-y-2">
      {localitaList.map((loc, idx) => (
        <div key={loc.id} className="bg-white border border-gray-100 rounded-lg p-3 flex items-start justify-between">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5 shrink-0">
              {idx + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-gray-900">{loc.nome_locale}</p>
              {loc.indirizzo && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin size={12} className="shrink-0" /><span className="truncate">{loc.indirizzo}</span>
                </p>
              )}
              {loc.note && <p className="text-xs text-gray-400 italic">{loc.note}</p>}
              <p className="text-xs text-blue-600 mt-1">
                <Package size={12} className="inline mr-1" />{loc.copie_standard} copie
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1 shrink-0 ml-2">
            <button onClick={() => spostaLocalita(localitaList, idx, -1)} disabled={idx === 0} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
              <ArrowUp size={14} />
            </button>
            <button onClick={() => spostaLocalita(localitaList, idx, 1)} disabled={idx === localitaList.length - 1} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
              <ArrowDown size={14} />
            </button>
            <button onClick={() => openLocalitaModal(giroId, zonaId, loc)} className="p-1 hover:bg-blue-50 rounded text-blue-600">
              <Edit2 size={14} />
            </button>
            <button onClick={() => deleteLocalita(loc.id)} className="p-1 hover:bg-red-50 rounded text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" className="w-full" onClick={() => openLocalitaModal(giroId, zonaId)}>
        <Plus size={16} className="inline mr-1" />Aggiungi Localita
      </Button>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
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

      {/* Lista giri */}
      {giri.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="mb-2">Nessun giro configurato</p>
          <Button onClick={() => openGiroModal()}>Crea il primo giro</Button>
        </div>
      ) : (
        giri.map(giro => {
          const totLocalita = giro.tutteLocalita?.length || 0
          const totCopie = (giro.tutteLocalita || []).reduce((s, l) => s + (l.copie_standard || 0), 0)
          const isOpen = giroAperto === giro.id

          return (
            <div key={giro.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Header giro */}
              <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setGiroAperto(isOpen ? null : giro.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isOpen ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{giro.nome_giro || 'Giro senza nome'}</span>
                      {giro.corrieri?.nome ? (
                        <Badge color="blue">{giro.corrieri.nome}</Badge>
                      ) : (
                        <Badge color="gray">Non assegnato</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {giro.zone?.length || 0} zone - {totLocalita} localita - {totCopie} copie
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openAssegnaModal(giro)} className="p-1.5 hover:bg-green-50 rounded-lg text-green-600" title="Assegna corriere">
                    <UserPlus size={16} />
                  </button>
                  <button onClick={() => openGiroModal(giro)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600" title="Modifica giro">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => deleteGiro(giro.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title="Elimina giro">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Contenuto giro espanso */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  {/* Zone */}
                  {(giro.zone || []).map(zona => {
                    const isZonaOpen = zonaAperta === zona.id
                    return (
                      <div key={zona.id} className="bg-gray-50 rounded-xl overflow-hidden">
                        {/* Header zona */}
                        <div
                          className="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                          onClick={() => setZonaAperta(isZonaOpen ? null : zona.id)}
                        >
                          <div className="flex items-center gap-2">
                            {isZonaOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            <MapPinned size={16} className="text-amber-600" />
                            <span className="font-medium text-gray-800">{zona.nome_zona}</span>
                            <span className="text-xs text-gray-400">({zona.localita?.length || 0} localita)</span>
                          </div>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => openZonaModal(giro.id, zona)} className="p-1 hover:bg-blue-50 rounded text-blue-600">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => deleteZona(zona.id)} className="p-1 hover:bg-red-50 rounded text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Localita della zona */}
                        {isZonaOpen && (
                          <div className="px-3 pb-3">
                            {renderLocalita(zona.localita || [], giro.id, zona.id)}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Localita senza zona (retrocompatibilita) */}
                  {(giro.localitaSenzaZona || []).length > 0 && (
                    <div className="bg-yellow-50 rounded-xl p-3">
                      <p className="text-sm font-medium text-yellow-800 mb-2">Localita senza zona</p>
                      {renderLocalita(giro.localitaSenzaZona, giro.id, null)}
                    </div>
                  )}

                  {/* Bottone aggiungi zona */}
                  <Button size="sm" variant="outline" className="w-full" onClick={() => openZonaModal(giro.id)}>
                    <MapPinned size={16} className="inline mr-1" />Aggiungi Zona
                  </Button>
                </div>
              )}
            </div>
          )
        })
      )}

      {/* ===== MODALI ===== */}

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Giro</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={giroForm.nome_giro}
              onChange={e => setGiroForm({ ...giroForm, nome_giro: e.target.value })}
              placeholder="Es. Giro Centro, Giro Nord"
              autoFocus
            />
          </div>
          <Button className="w-full" onClick={handleSaveGiro}>
            {editingGiro ? 'Salva Modifiche' : 'Crea Giro'}
          </Button>
        </div>
      </Modal>

      {/* Modale Assegna Corriere */}
      <Modal isOpen={showAssegnaModal} onClose={() => setShowAssegnaModal(false)} title="Assegna Corriere">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Corriere</label>
            <select
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={assegnaCorriereId}
              onChange={e => setAssegnaCorriereId(e.target.value)}
            >
              <option value="">Nessun corriere (non assegnato)</option>
              {corrieri.map(c => <option key={c.id} value={c.id}>{c.nome} {c.veicolo ? `(${c.veicolo})` : ''}</option>)}
            </select>
          </div>
          <Button className="w-full" onClick={handleAssegna}>Salva Assegnazione</Button>
        </div>
      </Modal>

      {/* Modale Zona */}
      <Modal isOpen={showZonaModal} onClose={() => setShowZonaModal(false)} title={editingZona ? 'Modifica Zona' : 'Nuova Zona'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Zona</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={zonaForm.nome_zona}
              onChange={e => setZonaForm({ ...zonaForm, nome_zona: e.target.value })}
              placeholder="Es. Borgo Maggiore, Serravalle, Domagnano"
              autoFocus
            />
          </div>
          <Button className="w-full" onClick={handleSaveZona}>
            {editingZona ? 'Salva Modifiche' : 'Aggiungi Zona'}
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
              placeholder="Via Roma 15, Borgo Maggiore"
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
