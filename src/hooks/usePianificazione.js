import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { calcolaPercorsoOttimizzato, geocodificaIndirizzo } from '../services/routingService'

export function usePianificazione() {
  const [pianificazione, setPianificazione] = useState(null)
  const [assegnazioni, setAssegnazioni] = useState([])
  const [loading, setLoading] = useState(false)

  const caricaPianificazioneOggi = useCallback(async () => {
    const oggi = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('pianificazione_giornaliera')
      .select('*')
      .eq('data_giro', oggi)
      .eq('stato', 'attivo')
      .maybeSingle()

    if (data) {
      setPianificazione(data)
      const { data: ass } = await supabase
        .from('pianificazione_assegnazioni')
        .select('*, corrieri(*)')
        .eq('pianificazione_id', data.id)
      if (ass) setAssegnazioni(ass)
    } else {
      setPianificazione(null)
      setAssegnazioni([])
    }
    return data
  }, [])

  const creaPianificazione = async (utenteId, corrieriZone) => {
    setLoading(true)
    const oggi = new Date().toISOString().split('T')[0]

    const { data: pian, error: errPian } = await supabase
      .from('pianificazione_giornaliera')
      .insert({ data_giro: oggi, creato_da: utenteId })
      .select()
      .single()

    if (errPian) {
      setLoading(false)
      return { error: errPian }
    }

    const risultati = []

    for (const assegnazione of corrieriZone) {
      const { corriereId, zoneIds, partenzaLat, partenzaLng, partenzaDesc } = assegnazione

      const { data: locData } = await supabase
        .from('localita')
        .select('*')
        .in('zona_id', zoneIds)
        .eq('attivo', true)

      const localita = locData || []
      let ordineOttimizzato = []
      let distanza = 0
      let durata = 0

      // Prepara le coordinate: punto di partenza come primo elemento
      const localitaConCoord = localita.map(l => ({
        id: l.id,
        lat: l.latitudine,
        lng: l.longitudine,
      }))

      const conCoord = localitaConCoord.filter(l => l.lat && l.lng)

      // Se c'è un punto di partenza, lo aggiungiamo come primo punto
      if (partenzaLat && partenzaLng && conCoord.length >= 1) {
        const puntiConPartenza = [
          { id: '__partenza__', lat: partenzaLat, lng: partenzaLng },
          ...conCoord,
        ]
        const risultato = await calcolaPercorsoOttimizzato(puntiConPartenza)
        // Rimuovi il punto di partenza dall'ordine finale
        ordineOttimizzato = risultato.ordine.filter(id => id !== '__partenza__')
        distanza = risultato.distanzaTotale
        durata = risultato.durataTotale
      } else if (conCoord.length >= 2) {
        const risultato = await calcolaPercorsoOttimizzato(conCoord)
        ordineOttimizzato = risultato.ordine
        distanza = risultato.distanzaTotale
        durata = risultato.durataTotale
      } else {
        ordineOttimizzato = localita.map(l => l.id)
      }

      const nomeGiro = `Giro ${oggi} - ${assegnazione.nomeCorrere || 'Corriere'}`

      const { data: giro } = await supabase
        .from('giri')
        .insert({
          nome_giro: nomeGiro,
          tipo: 'giornaliero',
          data_pianificazione: oggi,
          attivo: true,
        })
        .select()
        .single()

      if (giro) {
        if (corriereId) {
          await supabase
            .from('giri')
            .update({ corriere_id: corriereId })
            .eq('id', giro.id)
        }

        for (let i = 0; i < zoneIds.length; i++) {
          const zonaLocalita = localita.filter(l => l.zona_id === zoneIds[i])
          const ordineLocalitaZona = ordineOttimizzato.filter(id =>
            zonaLocalita.some(l => l.id === id)
          )

          await supabase.from('giri_zone').insert({
            giro_id: giro.id,
            zona_id: zoneIds[i],
            ordine: i,
            ordine_localita: ordineLocalitaZona.length > 0 ? ordineLocalitaZona : null,
          })
        }
      }

      const { data: ass } = await supabase
        .from('pianificazione_assegnazioni')
        .insert({
          pianificazione_id: pian.id,
          corriere_id: corriereId,
          giro_generato_id: giro?.id || null,
          zone_ids: zoneIds,
          ordine_ottimizzato: ordineOttimizzato,
          punto_partenza_lat: partenzaLat || null,
          punto_partenza_lng: partenzaLng || null,
          punto_partenza_desc: partenzaDesc || null,
        })
        .select('*, corrieri(*)')
        .single()

      if (ass) risultati.push(ass)
    }

    setPianificazione(pian)
    setAssegnazioni(risultati)
    setLoading(false)
    return { data: { pianificazione: pian, assegnazioni: risultati } }
  }

  const annullaPianificazione = async (utenteId) => {
    if (!pianificazione) return { error: 'Nessuna pianificazione attiva' }
    setLoading(true)

    for (const ass of assegnazioni) {
      if (ass.giro_generato_id) {
        await supabase.from('giri_zone').delete().eq('giro_id', ass.giro_generato_id)
        await supabase.from('giri').delete().eq('id', ass.giro_generato_id)
      }
    }

    const { error } = await supabase
      .from('pianificazione_giornaliera')
      .update({
        stato: 'annullato',
        annullato_da: utenteId,
        annullato_at: new Date().toISOString(),
      })
      .eq('id', pianificazione.id)

    if (!error) {
      setPianificazione(null)
      setAssegnazioni([])
    }

    setLoading(false)
    return error ? { error } : { data: true }
  }

  const geocodificaEsalva = async (localitaId, indirizzo) => {
    const coords = await geocodificaIndirizzo(indirizzo)
    if (coords && localitaId) {
      await supabase
        .from('localita')
        .update({ latitudine: coords.lat, longitudine: coords.lng })
        .eq('id', localitaId)
    }
    return coords
  }

  return {
    pianificazione, assegnazioni, loading,
    caricaPianificazioneOggi, creaPianificazione, annullaPianificazione, geocodificaEsalva,
  }
}
