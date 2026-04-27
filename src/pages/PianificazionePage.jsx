import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePianificazione } from '../hooks/usePianificazione'
import { geocodificaTutte } from '../services/routingService'
import {
  MapPinned, CheckCircle2, Users, Route, Loader2,
  RotateCcw, Navigation, AlertCircle, MapPin
} from 'lucide-react'
import Button from '../components/UI/Button'
import Modal from '../components/UI/Modal'
import Badge from '../components/UI/Badge'
import AddressAutocomplete from '../components/UI/AddressAutocomplete'

export default function PianificazionePage() {
  const { utente } = useAuth()
  const {
    pianificazione, assegnazioni, loading,
    caricaPianificazioneOggi, creaPianificazione, annullaPianificazione, geocodificaEsalva,
  } = usePianificazione()

  const [zone, setZone] = useState([])
  const [corrieri, setCorrieri] = useState([])
  const [pageLoading, setPageLoading] = useState(true)

  // Selezione
  const [selCorriere, setSelCorriere] = useState('')
  const [selZone, setSelZone] = useState([])
  const [partenza, setPartenza] = useState('')
  const [partenzaCoord, setPartenzaCoord] = useState(null) // { lat, lng }
  const [fase, setFase] = useState('caricamento') // caricamento | nuova | attiva | geocoding

  // Geocoding
  const [geocodingProgress, setGeocodingProgress] = useState({ done: 0, total: 0 })
  const [geocodingRunning, setGeocodingRunning] = useState(false)
  const [localitaSenzaCoord, setLocalitaSenzaCoord] = useState([])

  // Annullamento
  const [showAnnulla, setShowAnnulla] = useState(false)
  const [testoConferma, setTestoConferma] = useState('')

  // Dettaglio giro
  const [dettaglioAss, setDettaglioAss] = useState(null)
  const [dettaglioLocalita, setDettaglioLocalita] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setPageLoading(true)

    const [zoneRes, corrieriRes] = await Promise.all([
      supabase.from('zone').select('*').eq('attivo', true).order('nome_zona'),
      supabase.from('corrieri').select('*').eq('attivo', true).order('nome'),
    ])

    if (zoneRes.data) setZone(zoneRes.data)
    if (corrieriRes.data) setCorrieri(corrieriRes.data)

    const pian = await caricaPianificazioneOggi()
    setFase(pian ? 'attiva' : 'nuova')
    setPageLoading(false)
  }

  const toggleZona = (zonaId) => {
    setSelZone(prev =>
      prev.includes(zonaId) ? prev.filter(z => z !== zonaId) : [...prev, zonaId]
    )
  }

  const zoneRimanenti = zone.filter(z => !selZone.includes(z.id))

  const handleVerificaCoordinate = async () => {
    if (!selCorriere || selZone.length === 0) return
    setFase('geocoding')

    const { data: locData } = await supabase
      .from('localita')
      .select('*')
      .in('zona_id', zone.map(z => z.id))
      .eq('attivo', true)

    const senzaCoord = (locData || []).filter(l => !l.latitudine || !l.longitudine)

    if (senzaCoord.length === 0) {
      await handleConfermaPianificazione()
      return
    }

    setLocalitaSenzaCoord(senzaCoord)
    setGeocodingRunning(true)
    setGeocodingProgress({ done: 0, total: senzaCoord.length })

    const risultati = await geocodificaTutte(senzaCoord, (done, total) => {
      setGeocodingProgress({ done, total })
    })

    for (const r of risultati) {
      if (r.lat && r.lng && !r.cached) {
        await supabase
          .from('localita')
          .update({ latitudine: r.lat, longitudine: r.lng })
          .eq('id', r.id)
      }
    }

    const fallite = risultati.filter(r => !r.lat || !r.lng)
    setGeocodingRunning(false)

    if (fallite.length > 0) {
      setLocalitaSenzaCoord(senzaCoord.filter(l => fallite.some(f => f.id === l.id)))
    } else {
      setLocalitaSenzaCoord([])
      await handleConfermaPianificazione()
    }
  }

  const handleConfermaPianificazione = async () => {
    setFase('geocoding')

    const corriereSelezionato = corrieri.find(c => c.id === selCorriere)

    // Risolvi coordinate punto di partenza
    let pLat = partenzaCoord?.lat || null
    let pLng = partenzaCoord?.lng || null
    if (!pLat && partenza) {
      const coords = await geocodificaEsalva(null, partenza)
      if (coords) { pLat = coords.lat; pLng = coords.lng }
    }

    const corrieriZone = [
      {
        corriereId: selCorriere,
        zoneIds: selZone,
        nomeCorrere: corriereSelezionato?.nome || 'Corriere 1',
        partenzaLat: pLat,
        partenzaLng: pLng,
        partenzaDesc: partenza,
      },
    ]

    if (zoneRimanenti.length > 0) {
      const altriCorrieri = corrieri.filter(c => c.id !== selCorriere)
      corrieriZone.push({
        corriereId: altriCorrieri.length > 0 ? altriCorrieri[0].id : null,
        zoneIds: zoneRimanenti.map(z => z.id),
        nomeCorrere: altriCorrieri.length > 0 ? altriCorrieri[0].nome : 'Corriere 2',
      })
    }

    const result = await creaPianificazione(utente.id, corrieriZone)

    if (result.error) {
      alert('Errore nella pianificazione: ' + (result.error.message || JSON.stringify(result.error)))
      setFase('nuova')
    } else {
      setFase('attiva')
    }
  }

  const handleProcediSenzaCoord = async () => {
    setLocalitaSenzaCoord([])
    await handleConfermaPianificazione()
  }

  const handleAnnulla = async () => {
    const result = await annullaPianificazione(utente.id)
    if (!result.error) {
      setShowAnnulla(false)
      setTestoConferma('')
      setSelZone([])
      setSelCorriere('')
      setFase('nuova')
    }
  }

  const handleVediDettaglio = async (ass) => {
    if (ass.giro_generato_id) {
      const { data } = await supabase
        .from('localita')
        .select('*')
        .in('zona_id', ass.zone_ids || [])
        .eq('attivo', true)

      const ordine = ass.ordine_ottimizzato || []
      const ordinate = []
      for (const id of ordine) {
        const loc = (data || []).find(l => l.id === id)
        if (loc) ordinate.push(loc)
      }
      const rimanenti = (data || []).filter(l => !ordine.includes(l.id))
      setDettaglioLocalita([...ordinate, ...rimanenti])
    }
    setDettaglioAss(ass)
  }

  const apriMaps = (loc) => {
    // Usa coordinate se disponibili, altrimenti indirizzo
    if (loc.latitudine && loc.longitudine) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${loc.latitudine},${loc.longitudine}`, '_blank')
    } else if (loc.indirizzo) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.indirizzo + ', San Marino')}`, '_blank')
    }
  }

  const apriNavigazioneCompleta = (localitaList) => {
    if (localitaList.length === 0) return

    // Usa coordinate per tutti i waypoint (preciso, no ambiguita)
    const punti = localitaList
      .filter(l => l.latitudine && l.longitudine)
      .map(l => `${l.latitudine},${l.longitudine}`)

    if (punti.length === 0) return

    const origine = punti[0]
    const destinazione = punti[punti.length - 1]
    const intermedi = punti.slice(1, -1).join('|')

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origine}&destination=${destinazione}${intermedi ? '&waypoints=' + intermedi : ''}&travelmode=driving`
    window.open(url, '_blank')
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600"></div>
      </div>
    )
  }

  // === FASE GEOCODING ===
  if (fase === 'geocoding') {
    return (
      <div className="p-4 pb-24 space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Preparazione percorso...</h2>

        {geocodingRunning && (
          <div className="bg-navy-50 rounded-xl p-6 text-center space-y-3">
            <Loader2 size={40} className="animate-spin text-navy-600 mx-auto" />
            <p className="text-navy-800 font-medium">
              Geocodifica indirizzi: {geocodingProgress.done}/{geocodingProgress.total}
            </p>
            <div className="h-3 bg-navy-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-navy-600 rounded-full transition-all duration-300"
                style={{ width: `${geocodingProgress.total > 0 ? (geocodingProgress.done / geocodingProgress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">Nominatim richiede 1 secondo tra ogni richiesta</p>
          </div>
        )}

        {!geocodingRunning && localitaSenzaCoord.length > 0 && (
          <div className="space-y-3">
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
              <div className="flex gap-2 items-start">
                <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800">
                    {localitaSenzaCoord.length} localita senza coordinate GPS
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Il percorso verra ottimizzato solo per le localita con coordinate. Le altre verranno aggiunte alla fine.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 max-h-60 overflow-y-auto">
              {localitaSenzaCoord.map(l => (
                <div key={l.id} className="px-4 py-2 text-sm">
                  <p className="font-medium text-gray-900">{l.nome_locale}</p>
                  <p className="text-gray-500">{l.indirizzo || 'Nessun indirizzo'}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => { setFase('nuova'); setLocalitaSenzaCoord([]) }}>
                Torna indietro
              </Button>
              <Button variant="success" className="flex-1" onClick={handleProcediSenzaCoord}>
                Procedi comunque
              </Button>
            </div>
          </div>
        )}

        {!geocodingRunning && localitaSenzaCoord.length === 0 && (
          <div className="bg-navy-50 rounded-xl p-6 text-center space-y-3">
            <Loader2 size={40} className="animate-spin text-navy-600 mx-auto" />
            <p className="text-navy-800 font-medium">Ottimizzazione percorsi in corso...</p>
          </div>
        )}
      </div>
    )
  }

  // === PIANIFICAZIONE ATTIVA ===
  if (fase === 'attiva' && pianificazione) {
    return (
      <div className="p-4 pb-24 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Giro di Oggi</h2>
          <Badge color="green">Attivo</Badge>
        </div>

        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-green-600" />
            <p className="font-semibold text-green-800">Pianificazione completata</p>
          </div>
          <p className="text-sm text-green-700 mt-1">
            {assegnazioni.length} giri creati per oggi. Vai alla pagina Consegne per iniziare.
          </p>
        </div>

        <div className="space-y-3">
          {assegnazioni.map((ass, idx) => {
            const nomeCorrere = ass.corrieri?.nome || 'Corriere non assegnato'
            const nZone = (ass.zone_ids || []).length
            const zoneNomi = zone
              .filter(z => (ass.zone_ids || []).includes(z.id))
              .map(z => z.nome_zona)

            return (
              <div key={ass.id} className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-navy-600" />
                    <span className="font-bold text-gray-900">{nomeCorrere}</span>
                  </div>
                  <Badge color="blue">{nZone} zone</Badge>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {zoneNomi.map((nome, i) => (
                    <span key={i} className="bg-navy-50 text-navy-700 text-xs px-2 py-1 rounded-lg">
                      {nome}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 flex items-center justify-center gap-1"
                    onClick={() => handleVediDettaglio(ass)}>
                    <Route size={16} />Vedi percorso
                  </Button>
                  {ass.ordine_ottimizzato && ass.ordine_ottimizzato.length > 0 && (
                    <Button size="sm" variant="accent" className="flex-1 flex items-center justify-center gap-1"
                      onClick={() => {
                        handleVediDettaglio(ass).then(() => {
                          // will open maps from detail modal
                        })
                      }}>
                      <Navigation size={16} />Naviga
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={() => setShowAnnulla(true)}
          className="w-full text-center text-sm text-red-500 py-2 underline"
        >
          Annulla pianificazione di oggi
        </button>

        {/* Modal dettaglio percorso */}
        <Modal isOpen={!!dettaglioAss} onClose={() => { setDettaglioAss(null); setDettaglioLocalita([]) }}
          title={`Percorso - ${dettaglioAss?.corrieri?.nome || 'Corriere'}`}>
          <div className="space-y-3">
            {dettaglioLocalita.length > 0 && (
              <Button size="sm" variant="accent" className="w-full flex items-center justify-center gap-2"
                onClick={() => apriNavigazioneCompleta(dettaglioLocalita)}>
                <Navigation size={18} />Apri navigazione completa in Maps
              </Button>
            )}

            <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
              {dettaglioLocalita.map((loc, idx) => {
                const zona = zone.find(z => z.id === loc.zona_id)
                return (
                  <div key={loc.id} className="py-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-navy-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{loc.nome_locale}</p>
                      {zona && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPinned size={12} className="text-amber-600" />
                          <span className="text-xs text-amber-700">{zona.nome_zona}</span>
                        </div>
                      )}
                      {loc.indirizzo && (
                        <button onClick={() => apriMaps(loc)}
                          className="flex items-center gap-1 text-terra-500 text-xs mt-1 active:opacity-70">
                          <MapPin size={12} />
                          <span className="underline">{loc.indirizzo}</span>
                        </button>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">Copie: {loc.copie_standard || 0}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Modal>

        {/* Modal annullamento */}
        <Modal isOpen={showAnnulla} onClose={() => { setShowAnnulla(false); setTestoConferma('') }}
          title="Annulla pianificazione">
          <div className="space-y-4">
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <p className="text-red-800 font-semibold mb-2">Attenzione: azione irreversibile</p>
              <p className="text-sm text-red-700">
                Verranno eliminati tutti i giri giornalieri creati per oggi.
                I corrieri dovranno essere ripianificati.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Per confermare, scrivi <span className="font-bold text-red-600">ANNULLA</span>:
              </label>
              <input
                type="text"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-red-500 focus:outline-none uppercase"
                value={testoConferma}
                onChange={e => setTestoConferma(e.target.value)}
                placeholder="ANNULLA"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1"
                onClick={() => { setShowAnnulla(false); setTestoConferma('') }}>
                Torna indietro
              </Button>
              <Button variant="danger" className="flex-1"
                onClick={handleAnnulla}
                disabled={testoConferma.trim().toUpperCase() !== 'ANNULLA' || loading}>
                Annulla pianificazione
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  // === NUOVA PIANIFICAZIONE ===
  return (
    <div className="p-4 pb-24 space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Pianifica Giro di Oggi</h2>

      {/* Selezione corriere */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Chi pianifica?</label>
        <select
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-navy-500 focus:outline-none"
          value={selCorriere}
          onChange={e => setSelCorriere(e.target.value)}
        >
          <option value="">Seleziona corriere</option>
          {corrieri.map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>

      {/* Selezione zone */}
      {selCorriere && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleziona le zone per <strong>{corrieri.find(c => c.id === selCorriere)?.nome}</strong>
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Le zone non selezionate verranno assegnate automaticamente all'altro corriere.
          </p>

          <div className="grid grid-cols-1 gap-2">
            {zone.map(z => {
              const selected = selZone.includes(z.id)
              return (
                <button
                  key={z.id}
                  onClick={() => toggleZona(z.id)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left
                    ${selected
                      ? 'border-navy-500 bg-navy-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                >
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors
                    ${selected ? 'bg-navy-600 border-navy-600' : 'border-gray-300'}`}>
                    {selected && <CheckCircle2 size={16} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${selected ? 'text-navy-800' : 'text-gray-900'}`}>
                      {z.nome_zona}
                    </p>
                  </div>
                  {selected && (
                    <Badge color="blue">Selezionata</Badge>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Riepilogo assegnazione */}
      {selCorriere && selZone.length > 0 && (
        <div className="space-y-3">
          <div className="bg-navy-50 rounded-xl p-4">
            <p className="font-semibold text-navy-800 flex items-center gap-2">
              <Users size={16} />
              {corrieri.find(c => c.id === selCorriere)?.nome}: {selZone.length} zone
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {zone.filter(z => selZone.includes(z.id)).map(z => (
                <span key={z.id} className="bg-navy-100 text-navy-700 text-xs px-2 py-0.5 rounded">
                  {z.nome_zona}
                </span>
              ))}
            </div>
          </div>

          {zoneRimanenti.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="font-semibold text-amber-800 flex items-center gap-2">
                <Users size={16} />
                {corrieri.filter(c => c.id !== selCorriere)[0]?.nome || 'Altro corriere'}: {zoneRimanenti.length} zone
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {zoneRimanenti.map(z => (
                  <span key={z.id} className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded">
                    {z.nome_zona}
                  </span>
                ))}
              </div>
            </div>
          )}

          {selZone.length === zone.length && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-700 flex items-center gap-2">
                <AlertCircle size={16} />
                Devi lasciare almeno una zona all'altro corriere.
              </p>
            </div>
          )}

          {/* Punto di partenza */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              <span className="flex items-center gap-2">
                <Navigation size={16} className="text-terra-500" />
                Punto di partenza
              </span>
            </label>
            <AddressAutocomplete
              value={partenza}
              onChange={val => { setPartenza(val); setPartenzaCoord(null) }}
              onSelect={({ indirizzo, latitudine, longitudine }) => {
                setPartenza(indirizzo)
                if (latitudine && longitudine) {
                  setPartenzaCoord({ lat: latitudine, lng: longitudine })
                }
              }}
              placeholder="Cerca indirizzo di partenza..."
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Latitudine</label>
                <input
                  type="number" step="0.0000001"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
                  value={partenzaCoord?.lat || ''}
                  onChange={e => setPartenzaCoord(prev => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))}
                  placeholder="43.9367"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Longitudine</label>
                <input
                  type="number" step="0.0000001"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
                  value={partenzaCoord?.lng || ''}
                  onChange={e => setPartenzaCoord(prev => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))}
                  placeholder="12.4463"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">Inserisci l'indirizzo oppure le coordinate GPS da Google Maps. Il percorso partira da qui.</p>
          </div>

          <Button
            size="lg"
            variant="success"
            className="w-full flex items-center justify-center gap-3 text-xl"
            onClick={handleVerificaCoordinate}
            disabled={loading || selZone.length === zone.length || (!partenza && !partenzaCoord?.lat)}
          >
            {loading ? (
              <Loader2 size={28} className="animate-spin" />
            ) : (
              <Route size={28} />
            )}
            Conferma e Ottimizza
          </Button>
        </div>
      )}
    </div>
  )
}
