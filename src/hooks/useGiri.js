import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useZone() {
  const [zone, setZone] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchZone = useCallback(async () => {
    setLoading(true)
    const { data: zoneData } = await supabase
      .from('zone')
      .select('*')
      .eq('attivo', true)
      .order('nome_zona')

    // Per ogni zona, carica localita
    const zoneComplete = await Promise.all((zoneData || []).map(async (zona) => {
      const { data: locData } = await supabase
        .from('localita')
        .select('*')
        .eq('zona_id', zona.id)
        .eq('attivo', true)
        .order('ordine')
      return { ...zona, localita: locData || [] }
    }))

    setZone(zoneComplete)
    setLoading(false)
  }, [])

  useEffect(() => { fetchZone() }, [fetchZone])

  const addZona = async (nome_zona) => {
    const { error } = await supabase.from('zone').insert({ nome_zona })
    if (!error) await fetchZone()
    return { error }
  }

  const updateZona = async (id, updates) => {
    const { error } = await supabase.from('zone').update(updates).eq('id', id)
    if (!error) await fetchZone()
    return { error }
  }

  const deleteZona = async (id) => {
    const { error } = await supabase.from('zone').update({ attivo: false }).eq('id', id)
    if (!error) await fetchZone()
    return { error }
  }

  const addLocalita = async (localitaData) => {
    const { error } = await supabase.from('localita').insert(localitaData)
    if (!error) await fetchZone()
    return { error }
  }

  const updateLocalita = async (id, updates) => {
    const { error } = await supabase.from('localita').update(updates).eq('id', id)
    if (!error) await fetchZone()
    return { error }
  }

  const deleteLocalita = async (id) => {
    const { error } = await supabase.from('localita').update({ attivo: false }).eq('id', id)
    if (!error) await fetchZone()
    return { error }
  }

  const riordinaLocalita = async (localitaIds) => {
    await Promise.all(localitaIds.map((id, index) =>
      supabase.from('localita').update({ ordine: index }).eq('id', id)
    ))
    await fetchZone()
  }

  return {
    zone, loading, fetchZone,
    addZona, updateZona, deleteZona,
    addLocalita, updateLocalita, deleteLocalita, riordinaLocalita,
  }
}

export function useGiri(corriereId = null) {
  const [giri, setGiri] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchGiri = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('giri')
      .select('*, corrieri(nome)')
      .eq('attivo', true)
      .order('nome_giro')

    if (corriereId) {
      query = query.eq('corriere_id', corriereId)
    }

    const { data: giriData, error } = await query
    if (error) { setLoading(false); return }

    // Per ogni giro, carica le zone collegate (con localita)
    const giriCompleti = await Promise.all((giriData || []).map(async (giro) => {
      const { data: gzData } = await supabase
        .from('giri_zone')
        .select('*, zone(*)')
        .eq('giro_id', giro.id)
        .order('ordine')

      const zoneCollegate = (gzData || []).map(gz => gz.zone).filter(z => z && z.attivo !== false)
      const zoneIds = zoneCollegate.map(z => z.id)

      // Carica localita per tutte le zone del giro
      let tutteLocalita = []
      if (zoneIds.length > 0) {
        const { data: locData } = await supabase
          .from('localita')
          .select('*')
          .in('zona_id', zoneIds)
          .eq('attivo', true)
          .order('ordine')
        tutteLocalita = locData || []
      }

      const zoneConLocalita = zoneCollegate.map(zona => ({
        ...zona,
        localita: tutteLocalita.filter(l => l.zona_id === zona.id),
      }))

      return {
        ...giro,
        zoneIds,
        zone: zoneConLocalita,
        tutteLocalita,
      }
    }))

    setGiri(giriCompleti)
    setLoading(false)
  }, [corriereId])

  useEffect(() => { fetchGiri() }, [fetchGiri])

  const addGiro = async (giroData) => {
    const { error } = await supabase.from('giri').insert(giroData)
    if (!error) await fetchGiri()
    return { error }
  }

  const updateGiro = async (id, updates) => {
    const { error } = await supabase.from('giri').update(updates).eq('id', id)
    if (!error) await fetchGiri()
    return { error }
  }

  const deleteGiro = async (id) => {
    const { error } = await supabase.from('giri').update({ attivo: false }).eq('id', id)
    if (!error) await fetchGiri()
    return { error }
  }

  const assegnaCorriere = async (giroId, corriereIdNew) => {
    const { error } = await supabase.from('giri').update({ corriere_id: corriereIdNew || null }).eq('id', giroId)
    if (!error) await fetchGiri()
    return { error }
  }

  const impostaZoneGiro = async (giroId, zoneIds) => {
    // Rimuovi tutte le zone attuali
    await supabase.from('giri_zone').delete().eq('giro_id', giroId)

    // Inserisci le nuove
    if (zoneIds.length > 0) {
      const rows = zoneIds.map((zonaId, idx) => ({
        giro_id: giroId,
        zona_id: zonaId,
        ordine: idx,
      }))
      await supabase.from('giri_zone').insert(rows)
    }

    await fetchGiri()
  }

  const riordinaZoneGiro = async (giroId, zoneIds) => {
    await Promise.all(zoneIds.map((zonaId, idx) =>
      supabase.from('giri_zone').update({ ordine: idx }).eq('giro_id', giroId).eq('zona_id', zonaId)
    ))
    await fetchGiri()
  }

  const riordinaLocalitaGiro = async (localitaIds) => {
    await Promise.all(localitaIds.map((id, idx) =>
      supabase.from('localita').update({ ordine: idx }).eq('id', id)
    ))
    await fetchGiri()
  }

  return {
    giri, loading, fetchGiri,
    addGiro, updateGiro, deleteGiro,
    assegnaCorriere, impostaZoneGiro,
    riordinaZoneGiro, riordinaLocalitaGiro,
  }
}
