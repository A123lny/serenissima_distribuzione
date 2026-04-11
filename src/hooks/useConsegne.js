import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useConsegne() {
  const [sessione, setSessione] = useState(null)
  const [consegne, setConsegne] = useState([])
  const [loading, setLoading] = useState(false)

  const iniziaSessione = async (corriereId, giroId, localitaList, veicolo) => {
    setLoading(true)

    const { data: sess, error: errSess } = await supabase
      .from('sessioni_consegna')
      .insert({
        corriere_id: corriereId,
        giro_id: giroId,
        inizio_consegna: new Date().toISOString(),
        veicolo_usato: veicolo,
      })
      .select()
      .single()

    if (errSess) { setLoading(false); return { error: errSess } }

    const consegneData = localitaList.map(loc => ({
      sessione_id: sess.id,
      localita_id: loc.localita_id,
      copie_consegnate: loc.copie_consegnate,
      rimanenze_ieri: loc.rimanenze_ieri,
    }))

    const { data: cons, error: errCons } = await supabase
      .from('consegne_giornaliere')
      .insert(consegneData)
      .select('*, localita(*)')

    if (errCons) { setLoading(false); return { error: errCons } }

    setSessione(sess)
    setConsegne(cons)
    setLoading(false)
    return { data: { sessione: sess, consegne: cons } }
  }

  const aggiornaConsegna = async (consegnaId, updates) => {
    const { error } = await supabase
      .from('consegne_giornaliere')
      .update(updates)
      .eq('id', consegnaId)

    if (!error) {
      setConsegne(prev =>
        prev.map(c => c.id === consegnaId ? { ...c, ...updates } : c)
      )
    }
    return { error }
  }

  const completaFermata = async (consegnaId, resiRitirati) => {
    const updates = {
      consegnato: true,
      ora_consegna: new Date().toISOString(),
      resi_ritirati: resiRitirati || 0,
    }
    return aggiornaConsegna(consegnaId, updates)
  }

  const terminaSessione = async (kmPercorsi, noteSessione) => {
    if (!sessione) return { error: 'Nessuna sessione attiva' }

    const fine = new Date()
    const inizio = new Date(sessione.inizio_consegna)
    const durataMinuti = Math.round((fine - inizio) / 60000)

    const { error: errSess } = await supabase
      .from('sessioni_consegna')
      .update({
        fine_consegna: fine.toISOString(),
        durata_minuti: durataMinuti,
        km_percorsi: kmPercorsi,
        note_sessione: noteSessione,
      })
      .eq('id', sessione.id)

    if (errSess) return { error: errSess }

    // Salva nello storico rimanenze
    for (const consegna of consegne) {
      if (consegna.consegnato) {
        await supabase
          .from('storico_rimanenze')
          .upsert({
            localita_id: consegna.localita_id,
            data: new Date().toISOString().split('T')[0],
            copie_consegnate: consegna.copie_consegnate,
            rimanenze: consegna.resi_ritirati || 0,
          }, { onConflict: 'localita_id,data' })
      }
    }

    setSessione(null)
    setConsegne([])
    return { data: { durata_minuti: durataMinuti } }
  }

  const caricaSessioneAttiva = useCallback(async (corriereId) => {
    const oggi = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('sessioni_consegna')
      .select('*')
      .eq('corriere_id', corriereId)
      .eq('data_consegna', oggi)
      .is('fine_consegna', null)
      .single()

    if (data) {
      setSessione(data)
      const { data: cons } = await supabase
        .from('consegne_giornaliere')
        .select('*, localita(*)')
        .eq('sessione_id', data.id)

      if (cons) setConsegne(cons)
    }
  }, [])

  return {
    sessione, consegne, loading,
    iniziaSessione, aggiornaConsegna, completaFermata, terminaSessione,
    caricaSessioneAttiva,
  }
}
