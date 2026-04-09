import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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

    // Per ogni giro, carica zone e localita
    const giriCompleti = await Promise.all((giriData || []).map(async (giro) => {
      // Carica zone del giro
      const { data: zoneData } = await supabase
        .from('zone')
        .select('*')
        .eq('giro_id', giro.id)
        .eq('attivo', true)
        .order('ordine')

      // Carica localita del giro (con zona_id)
      const { data: locData } = await supabase
        .from('localita')
        .select('*')
        .eq('giro_id', giro.id)
        .eq('attivo', true)
        .order('ordine')

      // Raggruppa localita per zona
      const zoneConLocalita = (zoneData || []).map(zona => ({
        ...zona,
        localita: (locData || []).filter(l => l.zona_id === zona.id),
      }))

      // Localita senza zona (retrocompatibilita)
      const localitaSenzaZona = (locData || []).filter(l => !l.zona_id)

      return {
        ...giro,
        zone: zoneConLocalita,
        localitaSenzaZona,
        tutteLocalita: locData || [],
      }
    }))

    setGiri(giriCompleti)
    setLoading(false)
  }, [corriereId])

  useEffect(() => { fetchGiri() }, [fetchGiri])

  // === GIRI ===
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

  // === ZONE ===
  const addZona = async (zonaData) => {
    const { error } = await supabase.from('zone').insert(zonaData)
    if (!error) await fetchGiri()
    return { error }
  }

  const updateZona = async (id, updates) => {
    const { error } = await supabase.from('zone').update(updates).eq('id', id)
    if (!error) await fetchGiri()
    return { error }
  }

  const deleteZona = async (id) => {
    const { error } = await supabase.from('zone').update({ attivo: false }).eq('id', id)
    if (!error) await fetchGiri()
    return { error }
  }

  // === LOCALITA ===
  const addLocalita = async (localitaData) => {
    const { error } = await supabase.from('localita').insert(localitaData)
    if (!error) await fetchGiri()
    return { error }
  }

  const updateLocalita = async (id, updates) => {
    const { error } = await supabase.from('localita').update(updates).eq('id', id)
    if (!error) await fetchGiri()
    return { error }
  }

  const deleteLocalita = async (id) => {
    const { error } = await supabase.from('localita').update({ attivo: false }).eq('id', id)
    if (!error) await fetchGiri()
    return { error }
  }

  const riordinaLocalita = async (localitaIds) => {
    const updates = localitaIds.map((id, index) =>
      supabase.from('localita').update({ ordine: index }).eq('id', id)
    )
    await Promise.all(updates)
    await fetchGiri()
  }

  const riordinaZone = async (zoneIds) => {
    const updates = zoneIds.map((id, index) =>
      supabase.from('zone').update({ ordine: index }).eq('id', id)
    )
    await Promise.all(updates)
    await fetchGiri()
  }

  return {
    giri, loading, fetchGiri,
    addGiro, updateGiro, deleteGiro, assegnaCorriere,
    addZona, updateZona, deleteZona, riordinaZone,
    addLocalita, updateLocalita, deleteLocalita, riordinaLocalita,
  }
}
