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
 * Nearest Neighbor: partendo da startIdx, va sempre al punto più vicino.
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
 * Distanza totale di un percorso.
 */
function distanzaPercorso(percorso, matrice) {
  let totale = 0
  for (let i = 0; i < percorso.length - 1; i++) {
    totale += matrice[percorso[i]][percorso[i + 1]]
  }
  return totale
}

/**
 * 2-opt: inverti segmenti per ridurre la distanza. Punto 0 (partenza) fisso.
 */
function twoOpt(percorso, matrice) {
  const n = percorso.length
  let migliorato = true
  let best = [...percorso]
  let bestDist = distanzaPercorso(best, matrice)

  while (migliorato) {
    migliorato = false
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const nuovo = [...best]
        // Inverti segmento [i..j]
        let left = i, right = j
        while (left < right) {
          [nuovo[left], nuovo[right]] = [nuovo[right], nuovo[left]]
          left++
          right--
        }
        const dist = distanzaPercorso(nuovo, matrice)
        if (dist < bestDist) {
          best = nuovo
          bestDist = dist
          migliorato = true
        }
      }
    }
  }
  return best
}

/**
 * Or-opt: sposta una singola fermata in una posizione migliore. Punto 0 fisso.
 */
function orOpt(percorso, matrice) {
  let best = [...percorso]
  let bestDist = distanzaPercorso(best, matrice)
  let migliorato = true

  while (migliorato) {
    migliorato = false
    for (let i = 1; i < best.length; i++) {
      for (let j = 1; j < best.length; j++) {
        if (i === j) continue
        const nuovo = [...best]
        const [elemento] = nuovo.splice(i, 1)
        const insertIdx = j > i ? j - 1 : j
        nuovo.splice(insertIdx, 0, elemento)

        const dist = distanzaPercorso(nuovo, matrice)
        if (dist < bestDist) {
          best = nuovo
          bestDist = dist
          migliorato = true
        }
      }
    }
  }
  return best
}

/**
 * Genera un percorso casuale (punto 0 fisso, resto shufflato).
 */
function percorsoRandom(n) {
  const rest = Array.from({ length: n - 1 }, (_, i) => i + 1)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return [0, ...rest]
}

/**
 * Haversine: distanza in linea d'aria (fallback).
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
 * Ottimizzazione multi-strategia:
 *
 * 1. Matrice distanze stradali reali da OSRM /table (o Haversine come fallback)
 * 2. Genera N soluzioni candidate:
 *    - Nearest Neighbor dal punto di partenza
 *    - Nearest Neighbor da ogni altro punto (riadattato con partenza fissa)
 *    - Soluzioni casuali
 * 3. Per ciascuna: applica 2-opt + Or-opt
 * 4. Restituisce la migliore in assoluto
 */
export async function calcolaPercorsoOttimizzato(localitaConCoord) {
  const valide = localitaConCoord.filter(l => l.lat && l.lng)
  if (valide.length < 2) {
    return { ordine: valide.map(l => l.id), distanzaTotale: 0, durataTotale: 0 }
  }

  // Matrice distanze
  const matriceData = await getMatriceDistanze(valide)
  let matrice, matriceDistMetri, usaOSRM = false

  if (matriceData && matriceData.durate) {
    matrice = matriceData.durate
    matriceDistMetri = matriceData.distanze
    usaOSRM = true
  } else {
    matrice = creaMatriceHaversine(valide)
    matriceDistMetri = matrice
  }

  const n = valide.length
  let bestPercorso = null
  let bestDist = Infinity

  const provaSoluzione = (percorso) => {
    let p = twoOpt(percorso, matrice)
    p = orOpt(p, matrice)
    p = twoOpt(p, matrice) // secondo passaggio 2-opt dopo or-opt
    const d = distanzaPercorso(p, matrice)
    if (d < bestDist) {
      bestDist = d
      bestPercorso = p
    }
  }

  // Strategia 1: Nearest Neighbor dal punto di partenza
  provaSoluzione(nearestNeighbor(matrice, 0))

  // Strategia 2: Nearest Neighbor da ogni altro punto, poi rimetti 0 in testa
  for (let start = 1; start < n; start++) {
    const nn = nearestNeighbor(matrice, start)
    // Rimetti il punto 0 in testa
    const idx0 = nn.indexOf(0)
    const riordinato = [0, ...nn.slice(idx0 + 1), ...nn.slice(0, idx0)]
    provaSoluzione(riordinato)
  }

  // Strategia 3: Soluzioni casuali (più tentativi per istanze piccole)
  const nRandom = Math.min(50, n * 5)
  for (let i = 0; i < nRandom; i++) {
    provaSoluzione(percorsoRandom(n))
  }

  // Calcola distanza e durata totale sul percorso migliore
  let distanzaTotale = 0
  let durataTotale = 0
  for (let i = 0; i < bestPercorso.length - 1; i++) {
    distanzaTotale += (matriceDistMetri || matrice)[bestPercorso[i]][bestPercorso[i + 1]]
    if (usaOSRM) durataTotale += matrice[bestPercorso[i]][bestPercorso[i + 1]]
  }

  const ordine = bestPercorso.map(idx => valide[idx].id)

  return {
    ordine,
    distanzaTotale: Math.round(distanzaTotale / 100) / 10,
    durataTotale: Math.round(durataTotale / 60),
  }
}
