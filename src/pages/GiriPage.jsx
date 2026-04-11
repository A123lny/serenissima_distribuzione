import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useZone, useGiri } from '../hooks/useGiri'
import {
  Plus, Edit2, Trash2, ChevronDown, ChevronUp, MapPin,
  ArrowUp, ArrowDown, UserPlus, MapPinned, Package,
  CheckSquare, Square, Layers, Route
} from 'lucide-react'
import Button from '../components/UI/Button'
import Modal from '../components/UI/Modal'
import Badge from '../components/UI/Badge'

export default function GiriPage() {
  const {
    zone, loading: loadingZone,
    addZona, updateZona, deleteZona,
    addLocalita, updateLocalita, deleteLocalita, riordinaLocalita,
  } = useZone()

  const {
    giri, loading: loadingGiri,
    addGiro, updateGiro, deleteGiro,
    assegnaCorriere, impostaZoneGiro,
    riordinaZoneGiro, riordinaLocalitaGiro,
  } = useGiri()

  const [corrieri, setCorrieri] = useState([])
  const [tab, setTab] = useState('zone') // 'zone' | 'giri'

  // Espandi/chiudi
  const [zonaAperta, setZonaAperta] = useState(null)
  const [giroAperto, setGiroAperto] = useState(null)

  // Modali
  const [showZonaModal, setShowZonaModal] = useState(false)
  const [showLocalitaModal, setShowLocalitaModal] = useState(false)
  const [showGiroModal, setShowGiroModal] = useState(false)
  const [showCorriereModal, setShowCorriereModal] = useState(false)
  const [showAssegnaModal, setShowAssegnaModal] = useState(false)
  const [showZoneGiroModal, setShowZoneGiroModal] = useState(false)

  // Editing state
  const [editingZona, setEditingZona] = useState(null)
  const [editingLocalita, setEditingLocalita] = useState(null)
  const [editingGiro, setEditingGiro] = useState(null)
  const [selectedZonaId, setSelectedZonaId] = useState(null)
  const [selectedGiroId, setSelectedGiroId] = useState(null)

  // Forms
  const [zonaForm, setZonaForm] = useState({ nome_zona: '' })
  const [locForm, setLocForm] = useState({ nome_locale: '', indirizzo: '', note: '', copie_standard: 0 })
  const [giroForm, setGiroForm] = useState({ nome_giro: '' })
  const [corriereForm, setCorriereForm] = useState({ nome: '', veicolo: '' })
  const [assegnaCorriereId, setAssegnaCorriereId] = useState('')
  const [zoneSelezionate, setZoneSelezionate] = useState([])

  useEffect(() => {
    supabase.from('corrieri').select('*').eq('attivo', true).then(({ data }) => {
      if (data) setCorrieri(data)
    })
  }, [])

  const loading = loadingZone || loadingGiri

  // === HANDLERS ===

  const handleSaveCorriere = async () => {
    if (!corriereForm.nome.trim()) return
    await supabase.from('corrieri').insert(corriereForm)
    const { data } = await supabase.from('corrieri').select('*').eq('attivo', true)
    if (data) setCorrieri(data)
    setCorriereForm({ nome: '', veicolo: '' })
    setShowCorriereModal(false)
  }

  // Zona
  const openZonaModal = (zona = null) => {
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
      await addZona(zonaForm.nome_zona)
    }
    setShowZonaModal(false)
  }

  // Localita
  const openLocalitaModal = (zonaId, loc = null) => {
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
      await addLocalita({ ...locForm, zona_id: selectedZonaId, ordine: 0 })
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

  // Spostamento zone dentro un giro
  const spostaZonaGiro = async (giro, index, direzione) => {
    const zoneList = [...giro.zone]
    const newIndex = index + direzione
    if (newIndex < 0 || newIndex >= zoneList.length) return
    ;[zoneList[index], zoneList[newIndex]] = [zoneList[newIndex], zoneList[index]]
    await riordinaZoneGiro(giro.id, zoneList.map(z => z.id))
  }

  // Spostamento localita dentro una zona (nel tab Giri)
  const spostaLocalitaGiro = async (localitaList, index, direzione) => {
    const locs = [...localitaList]
    const newIndex = index + direzione
    if (newIndex < 0 || newIndex >= locs.length) return
    ;[locs[index], locs[newIndex]] = [locs[newIndex], locs[index]]
    await riordinaLocalitaGiro(locs.map(l => l.id))
  }

  // Giro
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

  // Assegna corriere
  const openAssegnaModal = (giro) => {
    setSelectedGiroId(giro.id)
    setAssegnaCorriereId(giro.corriere_id || '')
    setShowAssegnaModal(true)
  }

  const handleAssegna = async () => {
    await assegnaCorriere(selectedGiroId, assegnaCorriereId)
    setShowAssegnaModal(false)
  }

  // Seleziona zone per giro
  const openZoneGiroModal = (giro) => {
    setSelectedGiroId(giro.id)
    setZoneSelezionate(giro.zoneIds || [])
    setShowZoneGiroModal(true)
  }

  const toggleZonaGiro = (zonaId) => {
    setZoneSelezionate(prev =>
      prev.includes(zonaId)
        ? prev.filter(id => id !== zonaId)
        : [...prev, zonaId]
    )
  }

  const handleSalvaZoneGiro = async () => {
    await impostaZoneGiro(selectedGiroId, zoneSelezionate)
    setShowZoneGiroModal(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600"></div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Gestione</h2>
        <Button size="sm" variant="secondary" onClick={() => setShowCorriereModal(true)}>
          <Plus size={16} className="inline mr-1" />Corriere
        </Button>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'zone' ? 'bg-white text-terra-600 shadow-sm' : 'text-gray-500'
          }`}
          onClick={() => setTab('zone')}
        >
          <Layers size={18} />
          Zone e Localita
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'giri' ? 'bg-white text-terra-600 shadow-sm' : 'text-gray-500'
          }`}
          onClick={() => setTab('giri')}
        >
          <Route size={18} />
          Giri
        </button>
      </div>

      {/* ===== TAB ZONE ===== */}
      {tab === 'zone' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Database master zone e punti consegna</p>
            <Button size="sm" onClick={() => openZonaModal()}>
              <Plus size={16} className="inline mr-1" />Zona
            </Button>
          </div>

          {zone.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MapPinned size={40} className="mx-auto mb-3 opacity-50" />
              <p className="mb-2">Nessuna zona configurata</p>
              <Button onClick={() => openZonaModal()}>Crea la prima zona</Button>
            </div>
          ) : (
            zone.map(zona => {
              const isOpen = zonaAperta === zona.id
              const totCopie = zona.localita.reduce((s, l) => s + (l.copie_standard || 0), 0)
              return (
                <div key={zona.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* Header zona */}
                  <div
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => setZonaAperta(isOpen ? null : zona.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      <MapPinned size={18} className="text-amber-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-900">{zona.nome_zona}</span>
                        <p className="text-xs text-gray-500">
                          {zona.localita.length} localita - {totCopie} copie
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openZonaModal(zona)} className="p-1.5 hover:bg-navy-50 rounded-lg text-terra-500">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => deleteZona(zona.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Localita */}
                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
                      {zona.localita.map((loc, idx) => (
                        <div key={loc.id} className="bg-gray-50 rounded-lg p-3 flex items-start justify-between">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <span className="bg-navy-100 text-terra-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5 shrink-0">
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
                              <p className="text-xs text-terra-500 mt-1">
                                <Package size={12} className="inline mr-1" />{loc.copie_standard} copie
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0 ml-2">
                            <button onClick={() => spostaLocalita(zona.localita, idx, -1)} disabled={idx === 0} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
                              <ArrowUp size={14} />
                            </button>
                            <button onClick={() => spostaLocalita(zona.localita, idx, 1)} disabled={idx === zona.localita.length - 1} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
                              <ArrowDown size={14} />
                            </button>
                            <button onClick={() => openLocalitaModal(zona.id, loc)} className="p-1 hover:bg-navy-50 rounded text-terra-500">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => deleteLocalita(loc.id)} className="p-1 hover:bg-red-50 rounded text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" className="w-full" onClick={() => openLocalitaModal(zona.id)}>
                        <Plus size={16} className="inline mr-1" />Aggiungi Localita
                      </Button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ===== TAB GIRI ===== */}
      {tab === 'giri' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Componi i giri selezionando le zone</p>
            <Button size="sm" onClick={() => openGiroModal()}>
              <Plus size={16} className="inline mr-1" />Giro
            </Button>
          </div>

          {giri.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Route size={40} className="mx-auto mb-3 opacity-50" />
              <p className="mb-2">Nessun giro configurato</p>
              <Button onClick={() => openGiroModal()}>Crea il primo giro</Button>
            </div>
          ) : (
            giri.map(giro => {
              const isOpen = giroAperto === giro.id
              const totLocalita = giro.tutteLocalita?.length || 0
              const totCopie = (giro.tutteLocalita || []).reduce((s, l) => s + (l.copie_standard || 0), 0)

              return (
                <div key={giro.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* Header giro */}
                  <div
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => setGiroAperto(isOpen ? null : giro.id)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isOpen ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
                        <span className="font-semibold text-gray-900">{giro.nome_giro || 'Giro senza nome'}</span>
                        {giro.corrieri?.nome ? (
                          <Badge color="blue">{giro.corrieri.nome}</Badge>
                        ) : (
                          <Badge color="gray">Non assegnato</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 ml-7">
                        {giro.zone?.length || 0} zone - {totLocalita} localita - {totCopie} copie
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openZoneGiroModal(giro)} className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600" title="Seleziona zone">
                        <Layers size={16} />
                      </button>
                      <button onClick={() => openAssegnaModal(giro)} className="p-1.5 hover:bg-green-50 rounded-lg text-green-600" title="Assegna corriere">
                        <UserPlus size={16} />
                      </button>
                      <button onClick={() => openGiroModal(giro)} className="p-1.5 hover:bg-navy-50 rounded-lg text-terra-500" title="Modifica nome">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => deleteGiro(giro.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title="Elimina giro">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Contenuto giro espanso - mostra zone e localita (sola lettura) */}
                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                      {(giro.zone || []).length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-3">
                          Nessuna zona selezionata — clicca l'icona <Layers size={14} className="inline text-amber-600" /> per aggiungere zone
                        </p>
                      ) : (
                        giro.zone.map((zona, zi) => (
                          <div key={zona.id} className="bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <MapPinned size={16} className="text-amber-600" />
                                <span className="font-medium text-gray-800">{zona.nome_zona}</span>
                                <span className="text-xs text-gray-400">({zona.localita?.length || 0} localita)</span>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => spostaZonaGiro(giro, zi, -1)} disabled={zi === 0} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30" title="Sposta su">
                                  <ArrowUp size={14} />
                                </button>
                                <button onClick={() => spostaZonaGiro(giro, zi, 1)} disabled={zi === giro.zone.length - 1} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30" title="Sposta giu">
                                  <ArrowDown size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5 ml-6">
                              {(zona.localita || []).map((loc, idx) => (
                                <div key={loc.id} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400 w-4 text-right">{idx + 1}.</span>
                                    <span className="text-gray-700">{loc.nome_locale}</span>
                                    <span className="text-xs text-terra-500">{loc.copie_standard} copie</span>
                                  </div>
                                  <div className="flex gap-0.5">
                                    <button onClick={() => spostaLocalitaGiro(zona.localita, idx, -1)} disabled={idx === 0} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30">
                                      <ArrowUp size={12} />
                                    </button>
                                    <button onClick={() => spostaLocalitaGiro(zona.localita, idx, 1)} disabled={idx === zona.localita.length - 1} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30">
                                      <ArrowDown size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {(zona.localita || []).length === 0 && (
                                <p className="text-xs text-gray-400 italic">Nessuna localita in questa zona</p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ===== MODALI ===== */}

      {/* Modale Corriere */}
      <Modal isOpen={showCorriereModal} onClose={() => setShowCorriereModal(false)} title="Nuovo Corriere">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-navy-500 focus:outline-none"
              value={corriereForm.nome}
              onChange={e => setCorriereForm({ ...corriereForm, nome: e.target.value })}
              placeholder="Nome del corriere"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Veicolo</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-navy-500 focus:outline-none"
              value={corriereForm.veicolo}
              onChange={e => setCorriereForm({ ...corriereForm, veicolo: e.target.value })}
              placeholder="Es. Fiat Punto, Scooter"
            />
          </div>
          <Button className="w-full" onClick={handleSaveCorriere}>Salva Corriere</Button>
        </div>
      </Modal>

      {/* Modale Zona */}
      <Modal isOpen={showZonaModal} onClose={() => setShowZonaModal(false)} title={editingZona ? 'Modifica Zona' : 'Nuova Zona'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Zona</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-navy-500 focus:outline-none"
              value={zonaForm.nome_zona}
              onChange={e => setZonaForm({ ...zonaForm, nome_zona: e.target.value })}
              placeholder="Es. Borgo Maggiore, Serravalle"
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
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-navy-500 focus:outline-none"
              value={locForm.nome_locale}
              onChange={e => setLocForm({ ...locForm, nome_locale: e.target.value })}
              placeholder="Es. Bar Sport, Tabacchi Rossi"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-navy-500 focus:outline-none"
              value={locForm.indirizzo}
              onChange={e => setLocForm({ ...locForm, indirizzo: e.target.value })}
              placeholder="Via Roma 15, Borgo Maggiore"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-navy-500 focus:outline-none"
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
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-navy-500 focus:outline-none"
              value={locForm.copie_standard}
              onChange={e => setLocForm({ ...locForm, copie_standard: parseInt(e.target.value) || 0 })}
            />
          </div>
          <Button className="w-full" onClick={handleSaveLocalita}>
            {editingLocalita ? 'Salva Modifiche' : 'Aggiungi Localita'}
          </Button>
        </div>
      </Modal>

      {/* Modale Giro */}
      <Modal isOpen={showGiroModal} onClose={() => setShowGiroModal(false)} title={editingGiro ? 'Modifica Giro' : 'Nuovo Giro'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Giro</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-navy-500 focus:outline-none"
              value={giroForm.nome_giro}
              onChange={e => setGiroForm({ ...giroForm, nome_giro: e.target.value })}
              placeholder="Es. Giro Nord, Giro Centro"
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
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-navy-500 focus:outline-none"
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

      {/* Modale Seleziona Zone per Giro */}
      <Modal isOpen={showZoneGiroModal} onClose={() => setShowZoneGiroModal(false)} title="Seleziona Zone per il Giro">
        <div className="space-y-3 mb-4">
          <p className="text-sm text-gray-500">Spunta le zone da includere in questo giro:</p>
          {zone.map(zona => {
            const isSelected = zoneSelezionate.includes(zona.id)
            return (
              <button
                key={zona.id}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                  isSelected
                    ? 'border-navy-500 bg-navy-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
                onClick={() => toggleZonaGiro(zona.id)}
              >
                {isSelected ? (
                  <CheckSquare size={22} className="text-terra-500 shrink-0" />
                ) : (
                  <Square size={22} className="text-gray-300 shrink-0" />
                )}
                <div>
                  <p className="font-medium text-gray-900">{zona.nome_zona}</p>
                  <p className="text-xs text-gray-500">{zona.localita.length} localita</p>
                </div>
              </button>
            )
          })}
          {zone.length === 0 && (
            <p className="text-gray-400 text-center py-4">Nessuna zona disponibile. Creane una prima nel tab "Zone e Localita".</p>
          )}
        </div>
        <Button className="w-full" onClick={handleSalvaZoneGiro}>
          Salva Selezione ({zoneSelezionate.length} zone)
        </Button>
      </Modal>
    </div>
  )
}
