const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'
const OSRM_URL = 'https://router.project-osrm.org'

export async function geocodificaIndirizzo(indirizzo) {
  const query = `${indirizzo}, San Marino`
  const res = await fetch(
    `${NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=sm,it`,
    { headers: { 'Accept-Language': 'it' } }
  )
  const data = await res.json()
  if (data && data.length > 0) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  }
  return null
}

export async function geocodificaTutte(localita, onProgress) {
  const risultati = []
  for (let i = 0; i < localita.length; i++) {
    const loc = localita[i]
    if (loc.latitudine && loc.longitudine) {
      risultati.push({ id: loc.id, lat: loc.latitudine, lng: loc.longitudine, cached: true })
    } else if (loc.indirizzo) {
      await new Promise(r => setTimeout(r, 1100))
      const coords = await geocodificaIndirizzo(loc.indirizzo)
      risultati.push({ id: loc.id, ...coords, cached: false })
    } else {
      risultati.push({ id: loc.id, lat: null, lng: null, cached: false })
    }
    if (onProgress) onProgress(i + 1, localita.length)
  }
  return risultati
}

/**
 * Chiama OSRM /trip per ottimizzare l'ordine di visita.
 *
 * OSRM waypoints response:
 * - Ogni waypoint ha un campo "waypoint_index" che indica la posizione
 *   nell'ordine ottimizzato del viaggio.
 * - L'array waypoints è nello stesso ordine dell'input (indice 0 = primo punto inviato).
 *
 * Per ricostruire l'ordine: ordiniamo i waypoint per waypoint_index,
 * e per ognuno recuperiamo l'elemento originale tramite la posizione nell'array.
 */
export async function calcolaPercorsoOttimizzato(localitaConCoord) {
  const valide = localitaConCoord.filter(l => l.lat && l.lng)
  if (valide.length < 2) {
    return { ordine: valide.map(l => l.id), distanzaTotale: 0, durataTotale: 0 }
  }

  // OSRM vuole lng,lat (NON lat,lng)
  const coordinates = valide.map(l => `${l.lng},${l.lat}`).join(';')

  try {
    const res = await fetch(
      `${OSRM_URL}/trip/v1/driving/${coordinates}?source=first&roundtrip=false&destination=last&overview=false&steps=false`
    )
    const data = await res.json()

    if (data.code === 'Ok' && data.trips && data.trips[0]) {
      const trip = data.trips[0]

      // data.waypoints è nello stesso ordine dell'input.
      // Ogni waypoint ha waypoint_index = posizione nel viaggio ottimizzato.
      // Creiamo un array di coppie [waypoint_index, indice_originale]
      // e ordiniamo per waypoint_index.
      const coppie = data.waypoints.map((wp, idxOriginale) => ({
        waypoint_index: wp.waypoint_index,
        idxOriginale,
      }))

      coppie.sort((a, b) => a.waypoint_index - b.waypoint_index)

      const ordine = coppie.map(c => valide[c.idxOriginale].id)

      return {
        ordine,
        distanzaTotale: Math.round(trip.distance / 1000 * 10) / 10,
        durataTotale: Math.round(trip.duration / 60),
      }
    }
  } catch (e) {
    console.warn('OSRM non disponibile, uso ordine originale:', e)
  }

  return { ordine: valide.map(l => l.id), distanzaTotale: 0, durataTotale: 0 }
}
