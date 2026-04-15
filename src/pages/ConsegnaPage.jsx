import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useConsegne } from '../hooks/useConsegne'
import { useTimer } from '../hooks/useTimer'
import {
  Play, Square, ChevronLeft, ChevronRight, Navigation,
  Clock, Save, MapPinned, Package, CheckCircle2, AlertCircle
} from 'lucide-react'
import Button from '../components/UI/Button'
import Modal from '../components/UI/Modal'

export default function ConsegnaPage() {
  const { utente } = useAuth()
  const { sessione, consegne, loading, iniziaSessione, aggiornaConsegna, completaFermata, terminaSessione, annullaSessione, caricaSessioneAttiva } = useConsegne()
  const { formato, avvia, ferma } = useTimer(sessione?.inizio_consegna)

  const [fase, setFase] = useState('preparazione')
  const [tuttiGiri, setTuttiGiri] = useState([])
  const [zoneGiro, setZoneGiro] = useState([])
  const [pageLoading, setPageLoading] = useState(true)

  // Preparazione
  const [selGiro, setSelGiro] = useState('')
  const [veicolo, setVeicolo] = useState(utente?.corriere?.veicolo || '')
  const [prepData, setPrepData] = useState([])

  // Consegna
  const [fermataIdx, setFermataIdx] = useState(0)
  const [resiCorrente, setResiCorrente] = useState('')
  const [modificaAttiva, setModificaAttiva] = useState(false)

  // Riepilogo
  const [kmPercorsi, setKmPercorsi] = useState('')
  const [noteSessione, setNoteSessione] = useState('')

  const [showConfirmFine, setShowConfirmFine] = useState(false)
  const [showConfirmAnnulla, setShowConfirmAnnulla] = useState(false)
  const [testoConfermaAnnulla, setTestoConfermaAnnulla] = useState('')

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    setPageLoading(true)

    // Carica tutti i giri disponibili
    const { data: giriData } = await supabase
      .from('giri').select('*').eq('attivo', true).order('nome_giro')
    if (giriData) setTuttiGiri(giriData)

    // Carica sessione attiva (se esiste)
    if (utente?.corriere_id) {
      await caricaSessioneAttiva(utente.corriere_id)
    }

    setPageLoading(false)
  }

  useEffect(() => {
    if (sessione && !sessione.fine_consegna) {
      setFase('consegna')
      avvia()
    }
  }, [sessione])

  // Carica zone e localita del giro selezionato (con ordine specifico del giro)
  useEffect(() => {
    if (!selGiro) return
    const load = async () => {
      const { data: gzData } = await supabase
        .from('giri_zone').select('*, zone(*)').eq('giro_id', selGiro).order('ordine')
      const gzRecords = (gzData || []).filter(gz => gz.zone && gz.zone.attivo !== false)
      const zoneList = gzRecords.map(gz => gz.zone)
      const zoneIds = zoneList.map(z => z.id)
      setZoneGiro(zoneList)

      if (zoneIds.length > 0) {
        const { data: locData } = await supabase
          .from('localita').select('*').in('zona_id', zoneIds).eq('attivo', true)
        if (locData) {
          const ordinati = []
          for (const gz of gzRecords) {
            const zona = gz.zone
            let locsZona = locData.filter(l => l.zona_id === zona.id)
            const ordineCustom = gz.ordine_localita || []

            if (ordineCustom.length > 0) {
              locsZona.sort((a, b) => {
                const idxA = ordineCustom.indexOf(a.id)
                const idxB = ordineCustom.indexOf(b.id)
                return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB)
              })
            } else {
              locsZona.sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
            }

            locsZona.forEach(l => ordinati.push({
              localita_id: l.id,
              nome: l.nome_locale,
              indirizzo: l.indirizzo,
              zona_id: l.zona_id,
              zona_nome: zona.nome_zona,
              copie_consegnate: l.copie_standard || 0,
              rimanenze_ieri: 0,
            }))
          }
          setPrepData(ordinati)
        }
      } else {
        setPrepData([])
      }
    }
    load()
  }, [selGiro])

  const handleIniziaConsegne = async () => {
    if (!selGiro || prepData.length === 0) return
    const corriereId = utente?.corriere_id || null
    const result = await iniziaSessione(corriereId, selGiro, prepData, veicolo)
    if (result.data) {
      setFase('consegna')
      setFermataIdx(0)
      setResiCorrente('')
      avvia()
    }
  }

  const fermataCorrente = consegne[fermataIdx]
  const zonaNomeFermata = fermataCorrente?.localita?.zona_id
    ? zoneGiro.find(z => z.id === fermataCorrente.localita.zona_id)?.nome_zona
    : null

  const handleConfermaFermata = async () => {
    if (!fermataCorrente) return
    await completaFermata(fermataCorrente.id, parseInt(resiCorrente) || 0)
    setModificaAttiva(false)
    if (fermataIdx < consegne.length - 1) {
      setFermataIdx(fermataIdx + 1)
      setResiCorrente('')
    }
  }

  const handleSalvaModifica = async () => {
    if (!fermataCorrente) return
    await aggiornaConsegna(fermataCorrente.id, { resi_ritirati: parseInt(resiCorrente) || 0 })
    setModificaAttiva(false)
  }

  const handleAttivaModifica = () => {
    setResiCorrente(fermataCorrente?.resi_ritirati ?? '')
    setModificaAttiva(true)
  }

  const handleAvanti = () => {
    if (fermataIdx < consegne.length - 1) {
      setFermataIdx(fermataIdx + 1)
      setResiCorrente(consegne[fermataIdx + 1]?.resi_ritirati || '')
      setModificaAttiva(false)
    }
  }

  const handleIndietro = () => {
    if (fermataIdx > 0) {
      setFermataIdx(fermataIdx - 1)
      setResiCorrente(consegne[fermataIdx - 1]?.resi_ritirati || '')
      setModificaAttiva(false)
    }
  }

  const confermaFine = () => {
    ferma()
    setShowConfirmFine(false)
    setFase('riepilogo')
  }

  const confermaAnnulla = async () => {
    await annullaSessione()
    ferma()
    setShowConfirmAnnulla(false)
    setTestoConfermaAnnulla('')
    setFase('preparazione')
    setSelGiro('')
    setPrepData([])
    setFermataIdx(0)
    setResiCorrente('')
    setModificaAttiva(false)
  }

  const chiudiConfermaAnnulla = () => {
    setShowConfirmAnnulla(false)
    setTestoConfermaAnnulla('')
  }

  const handleSalvaRiepilogo = async () => {
    await terminaSessione(parseFloat(kmPercorsi) || 0, noteSessione)
    setFase('preparazione')
    setSelGiro('')
    setPrepData([])
    setKmPercorsi('')
    setNoteSessione('')
  }

  const apriMaps = (indirizzo) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(indirizzo)}`, '_blank')
  }

  const raggruppaPerZona = (items) => {
    const grouped = []
    for (const zona of zoneGiro) {
      const itemsZona = items.filter(i => {
        const zid = i.zona_id || i.localita?.zona_id
        return zid === zona.id
      })
      if (itemsZona.length > 0) grouped.push({ zona, items: itemsZona })
    }
    const senzaZona = items.filter(i => {
      const zid = i.zona_id || i.localita?.zona_id
      return !zid || !zoneGiro.some(z => z.id === zid)
    })
    if (senzaZona.length > 0) grouped.push({ zona: null, items: senzaZona })
    return grouped
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600"></div>
      </div>
    )
  }

  // === FASE PREPARAZIONE ===
  if (fase === 'preparazione') {
    return (
      <div className="p-4 pb-24 space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Prepara Consegne</h2>

        {/* Selezione giro - tutti i giri visibili */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Seleziona Giro</label>
          <select className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-navy-500 focus:outline-none"
            value={selGiro} onChange={e => setSelGiro(e.target.value)}>
            <option value="">Seleziona giro</option>
            {tuttiGiri.map(g => <option key={g.id} value={g.id}>{g.nome_giro || 'Giro senza nome'}</option>)}
          </select>
        </div>

        {/* Veicolo */}
        {selGiro && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Veicolo</label>
            <input className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-navy-500 focus:outline-none"
              value={veicolo} onChange={e => setVeicolo(e.target.value)} placeholder="Es. Fiat Punto" />
          </div>
        )}

        {/* Riepilogo fermate */}
        {prepData.length > 0 && (
          <div className="bg-navy-50 rounded-xl p-4">
            <p className="font-semibold text-navy-800">{prepData.length} fermate in {zoneGiro.length} zone</p>
            <p className="text-sm text-terra-500 mt-1">
              Totale copie: {prepData.reduce((s, p) => s + p.copie_consegnate, 0)}
            </p>
            <div className="mt-3 space-y-1">
              {zoneGiro.map(z => {
                const locsZona = prepData.filter(p => p.zona_id === z.id)
                return (
                  <div key={z.id} className="flex items-center gap-2 text-sm text-navy-700">
                    <MapPinned size={14} className="text-amber-600" />
                    <span>{z.nome_zona}: {locsZona.length} fermate</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {prepData.length > 0 && (
          <Button size="lg" variant="success" className="w-full flex items-center justify-center gap-3 text-xl"
            onClick={handleIniziaConsegne} disabled={loading}>
            <Play size={28} />INIZIA CONSEGNE
          </Button>
        )}
      </div>
    )
  }

  // === FASE CONSEGNA ===
  if (fase === 'consegna') {
    const completate = consegne.filter(c => c.consegnato).length
    const isCompletata = fermataCorrente?.consegnato

    return (
      <div className="min-h-screen bg-gray-50 pb-4">
        <div className="sticky top-[52px] z-30 bg-navy-600 text-white px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={18} />
              <span className="text-xl font-mono font-bold">{formato}</span>
            </div>
            <span className="text-sm opacity-80">{completate}/{consegne.length} completate</span>
          </div>
          <div className="mt-2 h-2 bg-navy-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-400 rounded-full transition-all duration-300"
              style={{ width: `${consegne.length > 0 ? (completate / consegne.length) * 100 : 0}%` }} />
          </div>
        </div>

        {fermataCorrente && (
          <div className="p-4 space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">Fermata</p>
              <p className="text-3xl font-bold text-gray-900">{fermataIdx + 1} <span className="text-lg text-gray-400">di {consegne.length}</span></p>
            </div>

            <div className={`rounded-2xl p-5 shadow-sm border-2 ${isCompletata ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
              {zonaNomeFermata && (
                <div className="flex items-center gap-2 mb-3">
                  <MapPinned size={16} className="text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">{zonaNomeFermata}</span>
                </div>
              )}

              <h3 className="text-2xl font-bold text-gray-900 mb-1">{fermataCorrente.localita?.nome_locale}</h3>

              {fermataCorrente.localita?.indirizzo && (
                <button onClick={() => apriMaps(fermataCorrente.localita.indirizzo)}
                  className="flex items-center gap-2 text-terra-500 text-sm mb-3 active:opacity-70">
                  <Navigation size={16} />
                  <span className="underline">{fermataCorrente.localita.indirizzo}</span>
                </button>
              )}

              {fermataCorrente.localita?.note && (
                <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-3 mb-3 flex gap-2">
                  <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-base font-bold text-amber-900">{fermataCorrente.localita.note}</p>
                </div>
              )}

              <div className="bg-navy-50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package size={18} className="text-terra-500" />
                  <span className="text-sm font-medium text-navy-700">Copie da lasciare</span>
                </div>
                <p className="text-4xl font-bold text-navy-800">{fermataCorrente.copie_consegnate}</p>
              </div>

              {isCompletata && !modificaAttiva ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-green-100 rounded-xl p-4">
                    <CheckCircle2 size={24} className="text-green-600" />
                    <div>
                      <p className="font-semibold text-green-800">Consegna completata</p>
                      <p className="text-sm text-green-700">Resi ritirati: {fermataCorrente.resi_ritirati || 0}</p>
                    </div>
                  </div>
                  <Button size="lg" variant="secondary" className="w-full flex items-center justify-center gap-2"
                    onClick={handleAttivaModifica}>
                    Modifica resi
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Resi ritirati</label>
                    <input type="number" min={0}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-2xl text-center font-bold focus:border-navy-500 focus:outline-none"
                      value={resiCorrente}
                      onChange={e => setResiCorrente(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  {modificaAttiva ? (
                    <div className="flex gap-2">
                      <Button size="lg" variant="secondary" className="flex-1"
                        onClick={() => { setModificaAttiva(false); setResiCorrente('') }}>
                        Annulla
                      </Button>
                      <Button size="lg" variant="success" className="flex-1 flex items-center justify-center gap-2"
                        onClick={handleSalvaModifica}>
                        <CheckCircle2 size={24} />Salva
                      </Button>
                    </div>
                  ) : (
                    <Button size="lg" variant="success" className="w-full flex items-center justify-center gap-2 text-lg"
                      onClick={handleConfermaFermata}>
                      <CheckCircle2 size={24} />Conferma Consegna
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3">
              <Button size="lg" variant="secondary" className="flex-1 flex items-center justify-center gap-2"
                onClick={handleIndietro} disabled={fermataIdx === 0}>
                <ChevronLeft size={24} />Indietro
              </Button>
              <Button size="lg" variant="primary" className="flex-1 flex items-center justify-center gap-2"
                onClick={handleAvanti} disabled={fermataIdx === consegne.length - 1}>
                Avanti<ChevronRight size={24} />
              </Button>
            </div>

            {completate === consegne.length ? (
              <Button size="lg" variant="danger" className="w-full flex items-center justify-center gap-3 text-xl"
                onClick={() => setShowConfirmFine(true)}>
                <Square size={24} />FINE CONSEGNE
              </Button>
            ) : (
              <button onClick={() => setShowConfirmFine(true)}
                className="w-full text-center text-sm text-gray-400 py-2 underline">
                Termina in anticipo ({consegne.length - completate} fermate rimanenti)
              </button>
            )}

            <button onClick={() => setShowConfirmAnnulla(true)}
              className="w-full text-center text-sm text-red-500 py-2 underline">
              Annulla giro (elimina sessione)
            </button>
          </div>
        )}

        <Modal isOpen={showConfirmAnnulla} onClose={chiudiConfermaAnnulla} title="⚠️ Annulla giro">
          <div className="space-y-4">
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <p className="text-red-800 font-semibold mb-2">Attenzione: azione irreversibile</p>
              <p className="text-sm text-red-700">
                La sessione e tutte le {consegne.length} consegne verranno <strong>eliminate definitivamente</strong> dal database. Non potrai recuperarle.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Per confermare, scrivi <span className="font-bold text-red-600">ANNULLA</span> qui sotto:
              </label>
              <input
                type="text"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-red-500 focus:outline-none uppercase"
                value={testoConfermaAnnulla}
                onChange={e => setTestoConfermaAnnulla(e.target.value)}
                placeholder="ANNULLA"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={chiudiConfermaAnnulla}>Torna indietro</Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={confermaAnnulla}
                disabled={testoConfermaAnnulla.trim().toUpperCase() !== 'ANNULLA'}
              >
                Annulla giro
              </Button>
            </div>
          </div>
        </Modal>

        <Modal isOpen={showConfirmFine} onClose={() => setShowConfirmFine(false)} title="Conferma fine consegne">
          <div className="space-y-4">
            <p className="text-gray-600">
              Sei sicuro di voler terminare le consegne?
              {consegne.filter(c => !c.consegnato).length > 0 && (
                <span className="block text-amber-600 font-medium mt-1">
                  Attenzione: {consegne.filter(c => !c.consegnato).length} fermate non ancora completate.
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
  const totResi = consegne.reduce((s, c) => s + (c.resi_ritirati || 0), 0)
  const totCopie = consegne.reduce((s, c) => s + (c.copie_consegnate || 0), 0)

  return (
    <div className="p-4 pb-24 space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Riepilogo Consegna</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-navy-50 rounded-xl p-4">
          <p className="text-xs text-terra-500 font-medium">Durata</p>
          <p className="text-xl font-bold text-navy-800">{formato}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-600 font-medium">Completate</p>
          <p className="text-xl font-bold text-green-900">{consegne.filter(c => c.consegnato).length}/{consegne.length}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <p className="text-xs text-amber-600 font-medium">Copie consegnate</p>
          <p className="text-xl font-bold text-amber-900">{totCopie}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4">
          <p className="text-xs text-red-600 font-medium">Resi ritirati</p>
          <p className="text-xl font-bold text-red-900">{totResi}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Km percorsi</label>
        <input type="number" step="0.1" min={0}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-navy-500 focus:outline-none"
          value={kmPercorsi} onChange={e => setKmPercorsi(e.target.value)} placeholder="Es. 25.5" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Note sessione</label>
        <textarea className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-navy-500 focus:outline-none"
          value={noteSessione} onChange={e => setNoteSessione(e.target.value)} rows={2} placeholder="Note opzionali..." />
      </div>

      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Dettaglio fermate</h3>
        <div className="space-y-2">
          {consegne.map((c, idx) => (
            <div key={c.id} className={`rounded-xl p-3 border ${c.consegnato ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{idx + 1}. {c.localita?.nome_locale}</p>
                  <p className="text-xs text-gray-500">Copie: {c.copie_consegnate} | Resi: {c.resi_ritirati || 0}</p>
                </div>
                {c.consegnato && <CheckCircle2 size={20} className="text-green-600" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button size="lg" variant="success" className="w-full flex items-center justify-center gap-3 text-xl"
        onClick={handleSalvaRiepilogo}>
        <Save size={28} />Salva e Chiudi
      </Button>
    </div>
  )
}
