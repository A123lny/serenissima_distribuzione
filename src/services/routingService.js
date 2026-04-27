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
 * Ottiene la matrice delle distanze stradali reali da OSRM /table.
 * Restituisce una matrice NxN con le durate in secondi tra ogni coppia di punti.
 */
async function getMatriceDistanze(punti) {
  const coordinates = punti.map(p => `${p.lng},${p.lat}`).join(';')

  try {
    const res = await fetch(
      `${OSRM_URL}/table/v1/driving/${coordinates}?annotations=duration,distance`
    )
    const data = await res.json()

    if (data.code === 'Ok') {
      return {
        durate: data.durations,   // matrice NxN in secondi
        distanze: data.distances,  // matrice NxN in metri
      }
    }
  } catch (e) {
    console.warn('OSRM /table non disponibile:', e)
  }
  return null
}

/**
 * Algoritmo Nearest Neighbor: partendo da startIdx, visita sempre il punto
 * non ancora visitato più vicino (per durata stradale).
 */
function nearestNeighbor(matrice, startIdx) {
  const n = matrice.length
  const visitati = new Set([startIdx])
  const percorso = [startIdx]

  let corrente = startIdx
  while (visitati.size < n) {
    let migliore = -1
    let miglioreDist = Infinity

    for (let i = 0; i < n; i++) {
      if (!visitati.has(i) && matrice[corrente][i] < miglioreDist) {
        miglioreDist = matrice[corrente][i]
        migliore = i
      }
    }

    if (migliore === -1) break
    visitati.add(migliore)
    percorso.push(migliore)
    corrente = migliore
  }

  return percorso
}

/**
 * Calcola la distanza totale di un percorso dato.
 */
function distanzaPercorso(percorso, matrice) {
  let totale = 0
  for (let i = 0; i < percorso.length - 1; i++) {
    totale += matrice[percorso[i]][percorso[i + 1]]
  }
  return totale
}

/**
 * Miglioramento 2-opt: scambia coppie di archi per ridurre la distanza totale.
 * Il primo punto (partenza) resta fisso.
 */
function twoOpt(percorso, matrice) {
  const n = percorso.length
  let migliorato = true
  let migliorPercorso = [...percorso]

  while (migliorato) {
    migliorato = false
    // Partiamo da 1 (non 0) per non spostare il punto di partenza
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const nuovoPercorso = [...migliorPercorso]
        // Inverti il segmento tra i e j
        const segmento = nuovoPercorso.slice(i, j + 1).reverse()
        nuovoPercorso.splice(i, j - i + 1, ...segmento)

        if (distanzaPercorso(nuovoPercorso, matrice) < distanzaPercorso(migliorPercorso, matrice)) {
          migliorPercorso = nuovoPercorso
          migliorato = true
        }
      }
    }
  }

  return migliorPercorso
}

/**
 * Fallback: distanza in linea d'aria (Haversine) quando OSRM non è disponibile.
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = x => x * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function creaMatriceHaversine(punti) {
  const n = punti.length
  const m = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      m[i][j] = haversine(punti[i].lat, punti[i].lng, punti[j].lat, punti[j].lng)
    }
  }
  return m
}

/**
 * Calcola il percorso ottimizzato:
 * 1. Chiede a OSRM la matrice delle distanze stradali reali
 * 2. Applica Nearest Neighbor per trovare un buon percorso iniziale
 * 3. Migliora con 2-opt
 * 4. Se OSRM non risponde, fallback su distanze Haversine
 */
export async function calcolaPercorsoOttimizzato(localitaConCoord) {
  const valide = localitaConCoord.filter(l => l.lat && l.lng)
  if (valide.length < 2) {
    return { ordine: valide.map(l => l.id), distanzaTotale: 0, durataTotale: 0 }
  }

  // Prova a ottenere matrice distanze stradali da OSRM
  const matriceData = await getMatriceDistanze(valide)

  let matrice
  let matriceDistMetri
  let usaOSRM = false

  if (matriceData && matriceData.durate) {
    matrice = matriceData.durate
    matriceDistMetri = matriceData.distanze
    usaOSRM = true
  } else {
    // Fallback: distanze in linea d'aria
    matrice = creaMatriceHaversine(valide)
    matriceDistMetri = matrice
  }

  // Nearest Neighbor partendo dal primo punto (punto di partenza)
  let percorso = nearestNeighbor(matrice, 0)

  // Migliora con 2-opt
  percorso = twoOpt(percorso, matrice)

  // Calcola distanza e durata totale
  let distanzaTotale = 0
  let durataTotale = 0
  for (let i = 0; i < percorso.length - 1; i++) {
    if (matriceDistMetri) {
      distanzaTotale += matriceDistMetri[percorso[i]][percorso[i + 1]]
    }
    if (usaOSRM) {
      durataTotale += matrice[percorso[i]][percorso[i + 1]]
    }
  }

  const ordine = percorso.map(idx => valide[idx].id)

  return {
    ordine,
    distanzaTotale: Math.round(distanzaTotale / 100) / 10, // metri -> km con 1 decimale
    durataTotale: Math.round(durataTotale / 60), // secondi -> minuti
  }
}
