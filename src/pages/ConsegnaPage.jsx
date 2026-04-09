import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useConsegne } from '../hooks/useConsegne'
import { useTimer } from '../hooks/useTimer'
import { Play, Square, CheckCircle2, Circle, Navigation, MessageSquare, Clock, Save, MapPinned } from 'lucide-react'
import Button from '../components/UI/Button'
import Modal from '../components/UI/Modal'

export default function ConsegnaPage() {
  const { utente, isAdmin } = useAuth()
  const { sessione, consegne, loading, iniziaSessione, segnaConsegnata, aggiungiNota, terminaSessione, caricaSessioneAttiva } = useConsegne()
  const { formato, avvia, ferma } = useTimer(sessione?.inizio_consegna)

  const [fase, setFase] = useState('preparazione')
  const [corrieri, setCorrieri] = useState([])
  const [giriDisponibili, setGiriDisponibili] = useState([])
  const [zone, setZone] = useState([])

  // Form preparazione
  const [selCorriere, setSelCorriere] = useState('')
  const [selGiro, setSelGiro] = useState('')
  const [veicolo, setVeicolo] = useState('')
  const [prepData, setPrepData] = useState([])

  // Form riepilogo
  const [kmPercorsi, setKmPercorsi] = useState('')
  const [noteSessione, setNoteSessione] = useState('')
  const [rimanenzeOggi, setRimanenzeOggi] = useState({})

  // Nota modale
  const [showNotaModal, setShowNotaModal] = useState(false)
  const [notaConsegnaId, setNotaConsegnaId] = useState(null)
  const [notaText, setNotaText] = useState('')

  // Modale conferma fine
  const [showConfirmFine, setShowConfirmFine] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    if (isAdmin) {
      const { data } = await supabase.from('corrieri').select('*').eq('attivo', true)
      if (data) setCorrieri(data)
    } else if (utente?.corriere_id) {
      setSelCorriere(utente.corriere_id)
      await caricaSessioneAttiva(utente.corriere_id)
    }
  }

  useEffect(() => {
    if (sessione && !sessione.fine_consegna) {
      setFase('consegna')
      avvia()
    }
  }, [sessione])

  // Carica giri assegnati al corriere selezionato
  useEffect(() => {
    if (selCorriere) {
      supabase
        .from('giri')
        .select('*')
        .eq('corriere_id', selCorriere)
        .eq('attivo', true)
        .order('nome_giro')
        .then(({ data }) => { if (data) setGiriDisponibili(data) })
    }
  }, [selCorriere])

  // Carica zone e localita quando si seleziona giro
  useEffect(() => {
    if (!selGiro) return

    const loadGiroData = async () => {
      // Carica zone
      const { data: zoneData } = await supabase
        .from('zone')
        .select('*')
        .eq('giro_id', selGiro)
        .eq('attivo', true)
        .order('ordine')

      setZone(zoneData || [])

      // Carica tutte le localita del giro
      const { data: locData } = await supabase
        .from('localita')
        .select('*')
        .eq('giro_id', selGiro)
        .eq('attivo', true)
        .order('ordine')

      if (locData) {
        setPrepData(locData.map(l => ({
          localita_id: l.id,
          nome: l.nome_locale,
          zona_id: l.zona_id,
          copie_consegnate: l.copie_standard || 0,
          rimanenze_ieri: 0,
        })))
      }
    }

    loadGiroData()
  }, [selGiro])

  const handleIniziaConsegne = async () => {
    if (!selCorriere || !selGiro || prepData.length === 0) return
    const result = await iniziaSessione(selCorriere, selGiro, prepData, veicolo)
    if (result.data) {
      setFase('consegna')
      avvia()
    }
  }

  const handleFineConsegne = () => {
    setShowConfirmFine(true)
  }

  const confermaFine = () => {
    ferma()
    setShowConfirmFine(false)
    setFase('riepilogo')
    const iniziale = {}
    consegne.forEach(c => { iniziale[c.id] = 0 })
    setRimanenzeOggi(iniziale)
  }

  const handleSalvaRiepilogo = async () => {
    await terminaSessione(
      parseFloat(kmPercorsi) || 0,
      rimanenzeOggi,
      noteSessione
    )
    setFase('preparazione')
    setSelGiro('')
    setPrepData([])
    setKmPercorsi('')
    setNoteSessione('')
  }

  const apriNota = (consegnaId, notaAttuale) => {
    setNotaConsegnaId(consegnaId)
    setNotaText(notaAttuale || '')
    setShowNotaModal(true)
  }

  const salvaNota = async () => {
    if (notaConsegnaId) {
      await aggiungiNota(notaConsegnaId, notaText)
    }
    setShowNotaModal(false)
  }

  const apriMaps = (indirizzo) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(indirizzo)}`
    window.open(url, '_blank')
  }

  // Helper: raggruppa per zona
  const raggruppaPerZona = (items) => {
    const grouped = []

    // Prima le zone in ordine
    for (const zona of zone) {
      const itemsZona = items.filter(i => i.zona_id === zona.id || i.localita?.zona_id === zona.id)
      if (itemsZona.length > 0) {
        grouped.push({ zona, items: itemsZona })
      }
    }

    // Poi items senza zona
    const senzaZona = items.filter(i => {
      const zid = i.zona_id || i.localita?.zona_id
      return !zid
    })
    if (senzaZona.length > 0) {
      grouped.push({ zona: null, items: senzaZona })
    }

    return grouped
  }

  // === FASE PREPARAZIONE ===
  if (fase === 'preparazione') {
    const prepPerZona = raggruppaPerZona(prepData)

    return (
      <div className="p-4 pb-24 space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Prepara Consegne</h2>

        {/* Selezione corriere (solo admin) */}
        {isAdmin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Corriere</label>
            <select
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
              value={selCorriere}
              onChange={e => { setSelCorriere(e.target.value); setSelGiro(''); setPrepData([]) }}
            >
              <option value="">Seleziona corriere</option>
              {corrieri.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}

        {/* Selezione giro */}
        {selCorriere && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Giro</label>
            <select
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
              value={selGiro}
              onChange={e => setSelGiro(e.target.value)}
            >
              <option value="">Seleziona giro</option>
              {giriDisponibili.map(g => <option key={g.id} value={g.id}>{g.nome_giro || 'Giro senza nome'}</option>)}
            </select>
            {giriDisponibili.length === 0 && (
              <p className="text-sm text-amber-600 mt-1">Nessun giro assegnato a questo corriere</p>
            )}
          </div>
        )}

        {/* Veicolo */}
        {selGiro && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Veicolo</label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
              value={veicolo}
              onChange={e => setVeicolo(e.target.value)}
              placeholder="Es. Fiat Punto"
            />
          </div>
        )}

        {/* Localita raggruppate per zona */}
        {prepData.length > 0 && (
          <div className="space-y-4">
            {prepPerZona.map((gruppo, gi) => (
              <div key={gi}>
                {gruppo.zona && (
                  <div className="flex items-center gap-2 mb-2">
                    <MapPinned size={16} className="text-amber-600" />
                    <h3 className="font-semibold text-gray-900">{gruppo.zona.nome_zona}</h3>
                  </div>
                )}
                {!gruppo.zona && prepPerZona.length > 1 && (
                  <h3 className="font-semibold text-gray-900 mb-2">Altre localita</h3>
                )}
                <div className="space-y-3">
                  {gruppo.items.map((item) => {
                    const idx = prepData.findIndex(p => p.localita_id === item.localita_id)
                    return (
                      <div key={item.localita_id} className="bg-white border border-gray-200 rounded-xl p-3">
                        <p className="font-medium text-gray-900 mb-2">{item.nome}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-500">Rimanenze ieri</label>
                            <input
                              type="number"
                              min={0}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
                              value={item.rimanenze_ieri}
                              onChange={e => {
                                const newData = [...prepData]
                                newData[idx].rimanenze_ieri = parseInt(e.target.value) || 0
                                setPrepData(newData)
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Copie da consegnare</label>
                            <input
                              type="number"
                              min={0}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
                              value={item.copie_consegnate}
                              onChange={e => {
                                const newData = [...prepData]
                                newData[idx].copie_consegnate = parseInt(e.target.value) || 0
                                setPrepData(newData)
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottone inizia */}
        {prepData.length > 0 && (
          <Button
            size="lg"
            variant="success"
            className="w-full flex items-center justify-center gap-3 text-xl"
            onClick={handleIniziaConsegne}
            disabled={loading}
          >
            <Play size={28} />
            INIZIA CONSEGNE
          </Button>
        )}
      </div>
    )
  }

  // === FASE CONSEGNA ===
  if (fase === 'consegna') {
    const completate = consegne.filter(c => c.consegnato).length

    // Raggruppa consegne per zona
    const consegnePerZona = raggruppaPerZona(consegne)

    return (
      <div className="pb-24">
        {/* Timer sticky */}
        <div className="sticky top-[52px] z-30 bg-blue-700 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={20} />
            <span className="text-2xl font-mono font-bold">{formato}</span>
          </div>
          <span className="text-sm opacity-80">{completate}/{consegne.length} consegnate</span>
        </div>

        {/* Lista consegne raggruppate */}
        <div className="p-4 space-y-4">
          {consegnePerZona.map((gruppo, gi) => (
            <div key={gi}>
              {gruppo.zona && (
                <div className="flex items-center gap-2 mb-2">
                  <MapPinned size={16} className="text-amber-600" />
                  <h3 className="font-semibold text-gray-800">{gruppo.zona.nome_zona}</h3>
                  <span className="text-xs text-gray-400">
                    ({gruppo.items.filter(c => c.consegnato).length}/{gruppo.items.length})
                  </span>
                </div>
              )}
              <div className="space-y-3">
                {gruppo.items.map((consegna) => (
                  <div
                    key={consegna.id}
                    className={`border-2 rounded-xl p-4 transition-colors ${
                      consegna.consegnato
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => !consegna.consegnato && segnaConsegnata(consegna.id)}
                          className="mt-0.5"
                        >
                          {consegna.consegnato ? (
                            <CheckCircle2 size={28} className="text-green-600" />
                          ) : (
                            <Circle size={28} className="text-gray-300" />
                          )}
                        </button>
                        <div>
                          <p className={`font-medium ${consegna.consegnato ? 'text-green-800 line-through' : 'text-gray-900'}`}>
                            {consegna.localita?.nome_locale}
                          </p>
                          {consegna.localita?.indirizzo && (
                            <p className="text-sm text-gray-500">{consegna.localita.indirizzo}</p>
                          )}
                          <p className="text-xs text-blue-600 mt-1">{consegna.copie_consegnate} copie</p>
                          {consegna.note && (
                            <p className="text-xs text-amber-600 mt-1 italic">{consegna.note}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {consegna.localita?.indirizzo && (
                          <button
                            onClick={() => apriMaps(consegna.localita.indirizzo)}
                            className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                          >
                            <Navigation size={20} />
                          </button>
                        )}
                        <button
                          onClick={() => apriNota(consegna.id, consegna.note)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                        >
                          <MessageSquare size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottone fine */}
        <div className="fixed bottom-20 left-0 right-0 p-4">
          <Button
            size="lg"
            variant="danger"
            className="w-full flex items-center justify-center gap-3 text-xl shadow-lg"
            onClick={handleFineConsegne}
          >
            <Square size={28} />
            FINE CONSEGNE
          </Button>
        </div>

        {/* Modale nota */}
        <Modal isOpen={showNotaModal} onClose={() => setShowNotaModal(false)} title="Nota rapida">
          <div className="space-y-4">
            <textarea
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
              value={notaText}
              onChange={e => setNotaText(e.target.value)}
              rows={3}
              placeholder="Aggiungi una nota..."
              autoFocus
            />
            <Button className="w-full" onClick={salvaNota}>Salva Nota</Button>
          </div>
        </Modal>

        {/* Modale conferma fine */}
        <Modal isOpen={showConfirmFine} onClose={() => setShowConfirmFine(false)} title="Conferma fine consegne">
          <div className="space-y-4">
            <p className="text-gray-600">
              Sei sicuro di voler terminare le consegne?
              {consegne.filter(c => !c.consegnato).length > 0 && (
                <span className="block text-amber-600 font-medium mt-1">
                  Attenzione: {consegne.filter(c => !c.consegnato).length} localita non ancora consegnate.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowConfirmFine(false)}>Annulla</Button>
              <Button variant="danger" className="flex-1" onClick={confermaFine}>Conferma Fine</Button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  // === FASE RIEPILOGO ===
  const riepilogoPerZona = raggruppaPerZona(consegne)

  return (
    <div className="p-4 pb-24 space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Riepilogo Consegna</h2>

      <div className="bg-blue-50 rounded-xl p-4">
        <p className="text-blue-900"><strong>Durata:</strong> {formato}</p>
        <p className="text-blue-900"><strong>Localita servite:</strong> {consegne.filter(c => c.consegnato).length}/{consegne.length}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Km percorsi</label>
        <input
          type="number"
          step="0.1"
          min={0}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          value={kmPercorsi}
          onChange={e => setKmPercorsi(e.target.value)}
          placeholder="Es. 25.5"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Note sessione</label>
        <textarea
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
          value={noteSessione}
          onChange={e => setNoteSessione(e.target.value)}
          rows={2}
          placeholder="Note opzionali..."
        />
      </div>

      {/* Rimanenze odierne raggruppate per zona */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Rimanenze di oggi</h3>
        {riepilogoPerZona.map((gruppo, gi) => (
          <div key={gi}>
            {gruppo.zona && (
              <div className="flex items-center gap-2 mb-2">
                <MapPinned size={16} className="text-amber-600" />
                <span className="font-medium text-gray-800">{gruppo.zona.nome_zona}</span>
              </div>
            )}
            <div className="space-y-2">
              {gruppo.items.map((consegna) => (
                <div key={consegna.id} className="bg-white border border-gray-200 rounded-xl p-3">
                  <p className="font-medium text-gray-900 mb-2">{consegna.localita?.nome_locale}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">Consegnate: {consegna.copie_consegnate}</span>
                    <div className="flex-1">
                      <input
                        type="number"
                        min={0}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
                        value={rimanenzeOggi[consegna.id] || 0}
                        onChange={e => setRimanenzeOggi({
                          ...rimanenzeOggi,
                          [consegna.id]: parseInt(e.target.value) || 0
                        })}
                        placeholder="Rimanenze"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button
        size="lg"
        variant="success"
        className="w-full flex items-center justify-center gap-3 text-xl"
        onClick={handleSalvaRiepilogo}
      >
        <Save size={28} />
        Salva e Chiudi
      </Button>
    </div>
  )
}
