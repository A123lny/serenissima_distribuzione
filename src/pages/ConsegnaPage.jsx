import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useConsegne } from '../hooks/useConsegne'
import { useTimer } from '../hooks/useTimer'
import {
  Play, Square, ChevronLeft, ChevronRight, Navigation,
  Clock, Save, MapPinned, Package, CheckCircle2, ArrowLeft
} from 'lucide-react'
import Button from '../components/UI/Button'
import Modal from '../components/UI/Modal'

export default function ConsegnaPage() {
  const { utente, isAdmin } = useAuth()
  const { sessione, consegne, loading, iniziaSessione, completaFermata, terminaSessione, caricaSessioneAttiva } = useConsegne()
  const { formato, avvia, ferma } = useTimer(sessione?.inizio_consegna)

  const [fase, setFase] = useState('preparazione')
  const [corrieri, setCorrieri] = useState([])
  const [giriDisponibili, setGiriDisponibili] = useState([])
  const [zoneGiro, setZoneGiro] = useState([])

  // Preparazione
  const [selCorriere, setSelCorriere] = useState('')
  const [selGiro, setSelGiro] = useState('')
  const [veicolo, setVeicolo] = useState('')
  const [prepData, setPrepData] = useState([])

  // Consegna - fermata corrente
  const [fermataIdx, setFermataIdx] = useState(0)
  const [resiCorrente, setResiCorrente] = useState('')

  // Riepilogo
  const [kmPercorsi, setKmPercorsi] = useState('')
  const [noteSessione, setNoteSessione] = useState('')

  // Modali
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

  // Carica giri assegnati
  useEffect(() => {
    if (selCorriere) {
      supabase.from('giri').select('*').eq('corriere_id', selCorriere).eq('attivo', true).order('nome_giro')
        .then(({ data }) => { if (data) setGiriDisponibili(data) })
    }
  }, [selCorriere])

  // Carica zone e localita del giro
  useEffect(() => {
    if (!selGiro) return
    const load = async () => {
      const { data: gzData } = await supabase
        .from('giri_zone').select('*, zone(*)').eq('giro_id', selGiro).order('ordine')
      const zoneList = (gzData || []).map(gz => gz.zone).filter(z => z && z.attivo !== false)
      const zoneIds = zoneList.map(z => z.id)
      setZoneGiro(zoneList)

      if (zoneIds.length > 0) {
        const { data: locData } = await supabase
          .from('localita').select('*').in('zona_id', zoneIds).eq('attivo', true).order('ordine')
        if (locData) {
          // Ordina per ordine zone poi ordine localita
          const ordinati = []
          for (const zona of zoneList) {
            const locsZona = locData.filter(l => l.zona_id === zona.id)
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
    if (!selCorriere || !selGiro || prepData.length === 0) return
    const result = await iniziaSessione(selCorriere, selGiro, prepData, veicolo)
    if (result.data) {
      setFase('consegna')
      setFermataIdx(0)
      setResiCorrente('')
      avvia()
    }
  }

  // Fermata corrente
  const fermataCorrente = consegne[fermataIdx]
  const zonaNomeFermata = fermataCorrente?.localita?.zona_id
    ? zoneGiro.find(z => z.id === fermataCorrente.localita.zona_id)?.nome_zona
    : null

  const handleConfermaFermata = async () => {
    if (!fermataCorrente) return
    await completaFermata(fermataCorrente.id, parseInt(resiCorrente) || 0)

    // Vai alla prossima fermata non completata
    if (fermataIdx < consegne.length - 1) {
      setFermataIdx(fermataIdx + 1)
      setResiCorrente(0)
    }
  }

  const handleAvanti = () => {
    if (fermataIdx < consegne.length - 1) {
      setFermataIdx(fermataIdx + 1)
      setResiCorrente(consegne[fermataIdx + 1]?.resi_ritirati || '')
    }
  }

  const handleIndietro = () => {
    if (fermataIdx > 0) {
      setFermataIdx(fermataIdx - 1)
      setResiCorrente(consegne[fermataIdx - 1]?.resi_ritirati || '')
    }
  }

  const handleFineConsegne = () => {
    setShowConfirmFine(true)
  }

  const confermaFine = () => {
    ferma()
    setShowConfirmFine(false)
    setFase('riepilogo')
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

  // === FASE PREPARAZIONE ===
  if (fase === 'preparazione') {
    return (
      <div className="p-4 pb-24 space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Prepara Consegne</h2>

        {isAdmin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Corriere</label>
            <select className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
              value={selCorriere} onChange={e => { setSelCorriere(e.target.value); setSelGiro(''); setPrepData([]) }}>
              <option value="">Seleziona corriere</option>
              {corrieri.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}

        {selCorriere && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Giro</label>
            <select className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
              value={selGiro} onChange={e => setSelGiro(e.target.value)}>
              <option value="">Seleziona giro</option>
              {giriDisponibili.map(g => <option key={g.id} value={g.id}>{g.nome_giro || 'Giro senza nome'}</option>)}
            </select>
            {giriDisponibili.length === 0 && (
              <p className="text-sm text-amber-600 mt-1">Nessun giro assegnato a questo corriere</p>
            )}
          </div>
        )}

        {selGiro && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Veicolo</label>
            <input className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
              value={veicolo} onChange={e => setVeicolo(e.target.value)} placeholder="Es. Fiat Punto" />
          </div>
        )}

        {/* Riepilogo fermate */}
        {prepData.length > 0 && (
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="font-semibold text-blue-900">{prepData.length} fermate in {zoneGiro.length} zone</p>
            <p className="text-sm text-blue-700 mt-1">
              Totale copie: {prepData.reduce((s, p) => s + p.copie_consegnate, 0)}
            </p>
            <div className="mt-3 space-y-1">
              {zoneGiro.map(z => {
                const locsZona = prepData.filter(p => p.zona_id === z.id)
                return (
                  <div key={z.id} className="flex items-center gap-2 text-sm text-blue-800">
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

  // === FASE CONSEGNA (una fermata alla volta) ===
  if (fase === 'consegna') {
    const completate = consegne.filter(c => c.consegnato).length
    const isCompletata = fermataCorrente?.consegnato

    return (
      <div className="min-h-screen bg-gray-50 pb-4">
        {/* Timer + progresso sticky */}
        <div className="sticky top-[52px] z-30 bg-blue-700 text-white px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={18} />
              <span className="text-xl font-mono font-bold">{formato}</span>
            </div>
            <span className="text-sm opacity-80">{completate}/{consegne.length} completate</span>
          </div>
          {/* Barra progresso */}
          <div className="mt-2 h-2 bg-blue-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-400 rounded-full transition-all duration-300"
              style={{ width: `${consegne.length > 0 ? (completate / consegne.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {fermataCorrente && (
          <div className="p-4 space-y-4">
            {/* Indicatore fermata */}
            <div className="text-center">
              <p className="text-sm text-gray-500">Fermata</p>
              <p className="text-3xl font-bold text-gray-900">{fermataIdx + 1} <span className="text-lg text-gray-400">di {consegne.length}</span></p>
            </div>

            {/* Card fermata */}
            <div className={`rounded-2xl p-5 shadow-sm border-2 ${isCompletata ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
              {/* Zona */}
              {zonaNomeFermata && (
                <div className="flex items-center gap-2 mb-3">
                  <MapPinned size={16} className="text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">{zonaNomeFermata}</span>
                </div>
              )}

              {/* Nome locale */}
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {fermataCorrente.localita?.nome_locale}
              </h3>

              {/* Indirizzo + navigazione */}
              {fermataCorrente.localita?.indirizzo && (
                <button
                  onClick={() => apriMaps(fermataCorrente.localita.indirizzo)}
                  className="flex items-center gap-2 text-blue-600 text-sm mb-3 active:opacity-70"
                >
                  <Navigation size={16} />
                  <span className="underline">{fermataCorrente.localita.indirizzo}</span>
                </button>
              )}

              {/* Note localita */}
              {fermataCorrente.localita?.note && (
                <p className="text-sm text-gray-500 italic mb-3">{fermataCorrente.localita.note}</p>
              )}

              {/* Copie da lasciare */}
              <div className="bg-blue-50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package size={18} className="text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">Copie da lasciare</span>
                </div>
                <p className="text-4xl font-bold text-blue-900">{fermataCorrente.copie_consegnate}</p>
              </div>

              {/* Stato completato */}
              {isCompletata ? (
                <div className="flex items-center gap-2 bg-green-100 rounded-xl p-4">
                  <CheckCircle2 size={24} className="text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800">Consegna completata</p>
                    <p className="text-sm text-green-700">Resi ritirati: {fermataCorrente.resi_ritirati || 0}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Input resi */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Resi ritirati</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-2xl text-center font-bold focus:border-blue-500 focus:outline-none"
                      value={resiCorrente}
                      onChange={e => setResiCorrente(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                    />
                  </div>

                  {/* Bottone conferma */}
                  <Button
                    size="lg"
                    variant="success"
                    className="w-full flex items-center justify-center gap-2 text-lg"
                    onClick={handleConfermaFermata}
                  >
                    <CheckCircle2 size={24} />
                    Conferma Consegna
                  </Button>
                </>
              )}
            </div>

            {/* Navigazione INDIETRO / AVANTI */}
            <div className="flex gap-3">
              <Button
                size="lg"
                variant="secondary"
                className="flex-1 flex items-center justify-center gap-2"
                onClick={handleIndietro}
                disabled={fermataIdx === 0}
              >
                <ChevronLeft size={24} />
                Indietro
              </Button>
              <Button
                size="lg"
                variant="primary"
                className="flex-1 flex items-center justify-center gap-2"
                onClick={handleAvanti}
                disabled={fermataIdx === consegne.length - 1}
              >
                Avanti
                <ChevronRight size={24} />
              </Button>
            </div>

            {/* Bottone fine consegne */}
            {completate === consegne.length ? (
              <Button
                size="lg"
                variant="danger"
                className="w-full flex items-center justify-center gap-3 text-xl"
                onClick={handleFineConsegne}
              >
                <Square size={24} />
                FINE CONSEGNE
              </Button>
            ) : (
              <button
                onClick={handleFineConsegne}
                className="w-full text-center text-sm text-gray-400 py-2 underline"
              >
                Termina in anticipo ({consegne.length - completate} fermate rimanenti)
              </button>
            )}
          </div>
        )}

        {/* Modale conferma fine */}
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
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-medium">Durata</p>
          <p className="text-xl font-bold text-blue-900">{formato}</p>
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
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          value={kmPercorsi} onChange={e => setKmPercorsi(e.target.value)} placeholder="Es. 25.5" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Note sessione</label>
        <textarea className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
          value={noteSessione} onChange={e => setNoteSessione(e.target.value)} rows={2} placeholder="Note opzionali..." />
      </div>

      {/* Dettaglio per fermata */}
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
