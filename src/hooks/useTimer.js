import { useState, useEffect, useRef } from 'react'

export function useTimer(startTime = null) {
  const [secondi, setSecondi] = useState(0)
  const [attivo, setAttivo] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (startTime) {
      const start = new Date(startTime).getTime()
      setSecondi(Math.floor((Date.now() - start) / 1000))
      setAttivo(true)
    }
  }, [startTime])

  useEffect(() => {
    if (attivo) {
      intervalRef.current = setInterval(() => {
        if (startTime) {
          const start = new Date(startTime).getTime()
          setSecondi(Math.floor((Date.now() - start) / 1000))
        } else {
          setSecondi(s => s + 1)
        }
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [attivo, startTime])

  const avvia = () => setAttivo(true)
  const ferma = () => { setAttivo(false); clearInterval(intervalRef.current) }
  const reset = () => { ferma(); setSecondi(0) }

  const ore = Math.floor(secondi / 3600)
  const minuti = Math.floor((secondi % 3600) / 60)
  const sec = secondi % 60

  const formato = `${String(ore).padStart(2, '0')}:${String(minuti).padStart(2, '0')}:${String(sec).padStart(2, '0')}`

  return { secondi, formato, attivo, avvia, ferma, reset }
}
