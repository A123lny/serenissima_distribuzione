import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useGiri(corriereId = null) {
  const [giri, setGiri] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchGiri = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('giri')
      .select('*, corrieri(nome), localita(*)')
      .eq('attivo', true)
      .order('numero_giro')

    if (corriereId) {
      query = query.eq('corriere_id', corriereId)
    }

    const { data, error } = await query
    if (!error) {
      const giriOrdinati = data.map(giro => ({
        ...giro,
        localita: (giro.localita || [])
          .filter(l => l.attivo)
          .sort((a, b) => a.ordine - b.ordine),
      }))
      setGiri(giriOrdinati)
    }
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

  return {
    giri, loading, fetchGiri,
    addGiro, updateGiro, deleteGiro,
    addLocalita, updateLocalita, deleteLocalita, riordinaLocalita,
  }
}
