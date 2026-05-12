import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const LS_IDX = (sessId) => `sessione_${sessId}_idx`
const LS_PENDING_CONSEGNA = (consId) => `pending_consegna_${consId}`

export function useConsegne() {
  const [sessione, setSessione] = useState(null)
  const [consegne, setConsegne] = useState([])
  const [loading, setLoading] = useState(false)
  const [pendingSync, setPendingSync] = useState(false)

  const debounceRef = useRef(null)
  const latestIdxRef = useRef(0)
  const sessioneRef = useRef(null)

  const setSessioneSafe = (s) => {
    sessioneRef.current = s
    setSessione(s)
  }

  const iniziaSessione = async (corriereId, giroId, localitaList, veicolo) => {
    setLoading(true)

    const nowIso = new Date().toISOString()
    const { data: sess, error: errSess } = await supabase
      .from('sessioni_consegna')
      .insert({
        corriere_id: corriereId,
        giro_id: giroId,
        inizio_consegna: nowIso,
        veicolo_usato: veicolo,
        fermata_idx_corrente: 0,
        aggiornata_at: nowIso,
      })
      .select()
      .single()

    if (errSess) {
      setLoading(false)
      // 23505 = unique violation: c'e' gia' una sessione aperta per questo corriere
      if (errSess.code === '23505') {
        await caricaSessioneAttiva(corriereId)
        return { error: { code: 'SESSIONE_ESISTENTE', message: 'Esiste gia\' una sessione aperta. Ripresa.' } }
      }
      return { error: errSess }
    }

    const consegneData = localitaList.map((loc, idx) => ({
      sessione_id: sess.id,
      localita_id: loc.localita_id,
      copie_consegnate: loc.copie_consegnate,
      rimanenze_ieri: loc.rimanenze_ieri,
      ordine: idx,
    }))

    const { data: cons, error: errCons } = await supabase
      .from('consegne_giornaliere')
      .insert(consegneData)
      .select('*, localita(*)')
      .order('ordine', { ascending: true })

    if (errCons) { setLoading(false); return { error: errCons } }

    setSessioneSafe(sess)
    setConsegne(cons)
    latestIdxRef.current = 0
    setLoading(false)
    return { data: { sessione: sess, consegne: cons } }
  }

  const aggiornaConsegna = async (consegnaId, updates) => {
    const { error } = await supabase
      .from('consegne_giornaliere')
      .update(updates)
      .eq('id', consegnaId)

    if (error) {
      // Bufferizza in localStorage per retry futuro
      try {
        const key = LS_PENDING_CONSEGNA(consegnaId)
        const prev = JSON.parse(localStorage.getItem(key) || '{}')
        localStorage.setItem(key, JSON.stringify({ ...prev, ...updates, ts: Date.now() }))
      } catch {}
      // Update ottimistico in memoria comunque (UX)
      setConsegne(prev =>
        prev.map(c => c.id === consegnaId ? { ...c, ...updates } : c)
      )
      return { error }
    }

    // Successo: pulisco eventuale buffer pending
    try { localStorage.removeItem(LS_PENDING_CONSEGNA(consegnaId)) } catch {}
    setConsegne(prev =>
      prev.map(c => c.id === consegnaId ? { ...c, ...updates } : c)
    )
    return { error: null }
  }

  const completaFermata = async (consegnaId, resiRitirati) => {
    const updates = {
      consegnato: true,
      ora_consegna: new Date().toISOString(),
      resi_ritirati: resiRitirati || 0,
    }
    return aggiornaConsegna(consegnaId, updates)
  }

  const aggiornaIndiceFermata = useCallback((idx) => {
    const sess = sessioneRef.current
    if (!sess) return
    latestIdxRef.current = idx
    // 1. Update ottimistico in memoria
    setSessione(prev => prev ? { ...prev, fermata_idx_corrente: idx } : prev)
    sessioneRef.current = sessioneRef.current
      ? { ...sessioneRef.current, fermata_idx_corrente: idx }
      : sessioneRef.current
    // 2. Cache locale immediata (sopravvive a refresh anche se DB fallisce)
    try {
      localStorage.setItem(
        LS_IDX(sess.id),
        JSON.stringify({ idx, ts: Date.now() })
      )
    } catch {}
    // 3. Push DB con debounce 800ms
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => flushIndice(), 800)
  }, [])

  const flushIndice = async () => {
    const sess = sessioneRef.current
    if (!sess) return
    const idx = latestIdxRef.current
    setPendingSync(true)
    const ts = new Date().toISOString()
    const { error } = await supabase
      .from('sessioni_consegna')
      .update({ fermata_idx_corrente: idx, aggiornata_at: ts })
      .eq('id', sess.id)
    setPendingSync(false)
    if (!error) {
      // DB e' la verita': pulisco la cache
      try { localStorage.removeItem(LS_IDX(sess.id)) } catch {}
    }
  }

  // Flush sincrono per beforeunload/visibilitychange: aggiorna solo localStorage
  const flushIndiceSync = useCallback((idx) => {
    const sess = sessioneRef.current
    if (!sess) return
    try {
      localStorage.setItem(
        LS_IDX(sess.id),
        JSON.stringify({ idx, ts: Date.now() })
      )
    } catch {}
  }, [])

  const cleanupLocalStorage = (sessId, consegneList) => {
    try {
      localStorage.removeItem(LS_IDX(sessId))
      consegneList.forEach(c => {
        localStorage.removeItem(LS_PENDING_CONSEGNA(c.id))
        localStorage.removeItem(`pending_resi_${sessId}_${c.id}`)
      })
    } catch {}
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

    cleanupLocalStorage(sessione.id, consegne)
    setSessioneSafe(null)
    setConsegne([])
    return { data: { durata_minuti: durataMinuti } }
  }

  const annullaSessione = async () => {
    if (!sessione) return { error: 'Nessuna sessione attiva' }
    await supabase.from('consegne_giornaliere').delete().eq('sessione_id', sessione.id)
    const { error } = await supabase.from('sessioni_consegna').delete().eq('id', sessione.id)
    if (error) return { error }
    cleanupLocalStorage(sessione.id, consegne)
    setSessioneSafe(null)
    setConsegne([])
    return { data: true }
  }

  // Retry delle consegne bufferizzate in localStorage
  const retryPendingConsegne = async (consegneList) => {
    for (const c of consegneList) {
      try {
        const raw = localStorage.getItem(LS_PENDING_CONSEGNA(c.id))
        if (!raw) continue
        const { ts, ...updates } = JSON.parse(raw)
        const { error } = await supabase
          .from('consegne_giornaliere')
          .update(updates)
          .eq('id', c.id)
        if (!error) {
          localStorage.removeItem(LS_PENDING_CONSEGNA(c.id))
        }
      } catch {}
    }
  }

  const caricaSessioneAttiva = useCallback(async (corriereId) => {
    // Niente filtro data: cerco qualsiasi sessione aperta del corriere.
    // Safety net: solo le ultime 36h (le orfane piu' vecchie sono chiuse dalla migrazione,
    // ma in caso di nuove orfane future, non vogliamo "ripescarle").
    const limiteData = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
    let query = supabase
      .from('sessioni_consegna')
      .select('*')
      .is('fine_consegna', null)
      .gte('inizio_consegna', limiteData)
      .order('inizio_consegna', { ascending: false })
      .limit(1)

    if (corriereId) {
      query = query.eq('corriere_id', corriereId)
    } else {
      query = query.is('corriere_id', null)
    }

    const { data: rows } = await query
    const data = rows && rows[0]
    if (!data) return

    // Riconciliazione cache locale vs DB:
    // se la cache ha un ts piu' recente di aggiornata_at del DB,
    // la cache vince e ritento il flush.
    let sessioneFinale = data
    try {
      const cached = localStorage.getItem(LS_IDX(data.id))
      if (cached) {
        const { idx, ts } = JSON.parse(cached)
        const dbTs = data.aggiornata_at ? new Date(data.aggiornata_at).getTime() : 0
        if (typeof idx === 'number' && idx >= 0 && ts > dbTs) {
          sessioneFinale = { ...data, fermata_idx_corrente: idx }
          // Ritento la write su DB (best effort)
          await supabase
            .from('sessioni_consegna')
            .update({ fermata_idx_corrente: idx, aggiornata_at: new Date(ts).toISOString() })
            .eq('id', data.id)
        }
      }
    } catch {}

    setSessioneSafe(sessioneFinale)
    latestIdxRef.current = sessioneFinale.fermata_idx_corrente || 0

    const { data: cons } = await supabase
      .from('consegne_giornaliere')
      .select('*, localita(*)')
      .eq('sessione_id', data.id)
      .order('ordine', { ascending: true })

    if (cons) {
      setConsegne(cons)
      // Retry async di eventuali update bufferizzati per questa sessione
      retryPendingConsegne(cons)
    }
  }, [])

  return {
    sessione, consegne, loading, pendingSync,
    iniziaSessione, aggiornaConsegna, completaFermata, terminaSessione,
    annullaSessione, caricaSessioneAttiva,
    aggiornaIndiceFermata, flushIndiceSync,
  }
}
