import { useState, useRef, useEffect } from 'react'
import { MapPin, Loader2, X } from 'lucide-react'

const PHOTON_URL = 'https://photon.komoot.io/api'

// Bounding box San Marino + area circostante (incluse zone di confine italiane)
const BBOX = '12.35,43.88,12.55,43.99'

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, className }) {
  const [suggerimenti, setSuggerimenti] = useState([])
  const [loading, setLoading] = useState(false)
  const [aperto, setAperto] = useState(false)
  const [focusIdx, setFocusIdx] = useState(-1)
  const timerRef = useRef(null)
  const wrapperRef = useRef(null)

  // Chiudi dropdown quando si clicca fuori
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setAperto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const cercaIndirizzi = async (testo) => {
    if (testo.length < 3) {
      setSuggerimenti([])
      setAperto(false)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(
        `${PHOTON_URL}?q=${encodeURIComponent(testo + ' San Marino')}&limit=5&bbox=${BBOX}&lang=it`
      )
      const data = await res.json()

      if (data.features && data.features.length > 0) {
        const risultati = data.features.map(f => {
          const p = f.properties
          const coords = f.geometry.coordinates // [lng, lat]

          // Componi indirizzo leggibile
          const parti = []
          if (p.street) {
            parti.push(p.street + (p.housenumber ? ' ' + p.housenumber : ''))
          } else if (p.name && p.name !== p.city) {
            parti.push(p.name)
          }
          if (p.postcode) parti.push(p.postcode)
          if (p.city) parti.push(p.city)
          if (p.state) parti.push(p.state)
          if (p.country) parti.push(p.country)

          return {
            indirizzo: parti.join(', '),
            nome: p.name || '',
            citta: p.city || p.county || '',
            lat: coords[1],
            lng: coords[0],
          }
        })

        setSuggerimenti(risultati)
        setAperto(true)
        setFocusIdx(-1)
      } else {
        setSuggerimenti([])
        setAperto(false)
      }
    } catch (e) {
      console.warn('Errore autocomplete:', e)
      setSuggerimenti([])
    }
    setLoading(false)
  }

  const handleChange = (e) => {
    const val = e.target.value
    onChange(val)

    // Debounce: aspetta 400ms dopo l'ultimo carattere
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => cercaIndirizzi(val), 400)
  }

  const handleSelect = (sugg) => {
    onChange(sugg.indirizzo)
    setAperto(false)
    setSuggerimenti([])
    if (onSelect) {
      onSelect({
        indirizzo: sugg.indirizzo,
        latitudine: sugg.lat,
        longitudine: sugg.lng,
      })
    }
  }

  const handleKeyDown = (e) => {
    if (!aperto || suggerimenti.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIdx(prev => Math.min(prev + 1, suggerimenti.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIdx(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && focusIdx >= 0) {
      e.preventDefault()
      handleSelect(suggerimenti[focusIdx])
    } else if (e.key === 'Escape') {
      setAperto(false)
    }
  }

  const handleClear = () => {
    onChange('')
    setSuggerimenti([])
    setAperto(false)
    if (onSelect) onSelect({ indirizzo: '', latitudine: null, longitudine: null })
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          className={className || 'w-full border-2 border-gray-200 rounded-xl px-4 py-3 pr-16 focus:border-navy-500 focus:outline-none'}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggerimenti.length > 0) setAperto(true) }}
          placeholder={placeholder || 'Cerca indirizzo...'}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 size={18} className="animate-spin text-gray-400" />}
          {value && !loading && (
            <button onClick={handleClear} className="p-1 hover:bg-gray-100 rounded-full">
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {aperto && suggerimenti.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {suggerimenti.map((sugg, idx) => (
            <button
              key={idx}
              className={`w-full text-left px-4 py-3 flex items-start gap-2 transition-colors border-b border-gray-50 last:border-0
                ${idx === focusIdx ? 'bg-navy-50' : 'hover:bg-gray-50'}`}
              onClick={() => handleSelect(sugg)}
              onMouseEnter={() => setFocusIdx(idx)}
            >
              <MapPin size={16} className="text-terra-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{sugg.indirizzo}</p>
                {sugg.citta && (
                  <p className="text-xs text-gray-500">{sugg.citta}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
