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

export async function ottimizzaPercorso(localitaConCoord) {
  const valide = localitaConCoord.filter(l => l.lat && l.lng)
  if (valide.length < 2) return valide.map(l => l.id)

  const coordinates = valide.map(l => `${l.lng},${l.lat}`).join(';')

  try {
    const res = await fetch(
      `${OSRM_URL}/trip/v1/driving/${coordinates}?source=first&roundtrip=false&destination=last&overview=false`
    )
    const data = await res.json()

    if (data.code === 'Ok' && data.trips && data.trips[0]) {
      const waypoints = data.waypoints
      const ordineIndici = waypoints
        .sort((a, b) => a.waypoint_index - b.waypoint_index)
        .map(w => w.waypoint_index)

      const ordinato = new Array(valide.length)
      waypoints.forEach(wp => {
        ordinato[wp.waypoint_index] = valide[wp.trips_index !== undefined ? wp.trips_index : waypoints.indexOf(wp)]
      })

      return data.trips[0].legs
        ? waypoints
            .sort((a, b) => a.waypoint_index - b.waypoint_index)
            .map(wp => valide[wp.trips_index !== undefined ? wp.trips_index : waypoints.indexOf(wp)].id)
        : valide.map(l => l.id)
    }
  } catch (e) {
    console.warn('OSRM non disponibile, uso ordine originale:', e)
  }

  return valide.map(l => l.id)
}

export async function calcolaPercorsoOttimizzato(localitaConCoord) {
  const valide = localitaConCoord.filter(l => l.lat && l.lng)
  if (valide.length < 2) return { ordine: valide.map(l => l.id), distanzaTotale: 0, durataTotale: 0 }

  const coordinates = valide.map(l => `${l.lng},${l.lat}`).join(';')

  try {
    const res = await fetch(
      `${OSRM_URL}/trip/v1/driving/${coordinates}?source=first&roundtrip=false&destination=last&overview=false&steps=false`
    )
    const data = await res.json()

    if (data.code === 'Ok' && data.trips && data.trips[0]) {
      const trip = data.trips[0]
      const ordine = data.waypoints
        .sort((a, b) => a.waypoint_index - b.waypoint_index)
        .map(wp => valide[wp.trips_index !== undefined ? wp.trips_index : data.waypoints.indexOf(wp)].id)

      return {
        ordine,
        distanzaTotale: Math.round(trip.distance / 1000 * 10) / 10,
        durataTotale: Math.round(trip.duration / 60),
      }
    }
  } catch (e) {
    console.warn('OSRM non disponibile:', e)
  }

  return { ordine: valide.map(l => l.id), distanzaTotale: 0, durataTotale: 0 }
}
