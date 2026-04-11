import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Clock, Navigation, Hash, DollarSign } from 'lucide-react'

export default function ReportPage() {
  const [sessioni, setSessioni] = useState([])
  const [corrieri, setCorrieri] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtri
  const [filtroCorriere, setFiltroCorriere] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState('30')
  const [costoKm, setCostoKm] = useState(0.30)

  useEffect(() => {
    supabase.from('corrieri').select('*').eq('attivo', true).then(({ data }) => {
      if (data) setCorrieri(data)
    })
  }, [])

  useEffect(() => {
    fetchSessioni()
  }, [filtroCorriere, filtroPeriodo])

  const fetchSessioni = async () => {
    setLoading(true)
    const dataInizio = new Date()
    dataInizio.setDate(dataInizio.getDate() - parseInt(filtroPeriodo))

    let query = supabase
      .from('sessioni_consegna')
      .select('*, corrieri(nome), giri(nome_giro, numero_giro)')
      .gte('data_consegna', dataInizio.toISOString().split('T')[0])
      .not('fine_consegna', 'is', null)
      .order('data_consegna', { ascending: false })

    if (filtroCorriere) {
      query = query.eq('corriere_id', filtroCorriere)
    }

    const { data } = await query
    setSessioni(data || [])
    setLoading(false)
  }

  // Calcoli aggregati
  const totali = sessioni.reduce((acc, s) => ({
    ore: acc.ore + (s.durata_minuti || 0),
    km: acc.km + (parseFloat(s.km_percorsi) || 0),
    sessioni: acc.sessioni + 1,
  }), { ore: 0, km: 0, sessioni: 0 })

  const costoTotale = (totali.km * costoKm).toFixed(2)

  // Raggruppamento per corriere
  const perCorriere = sessioni.reduce((acc, s) => {
    const nome = s.corrieri?.nome || 'Sconosciuto'
    if (!acc[nome]) acc[nome] = { ore: 0, km: 0, sessioni: 0 }
    acc[nome].ore += s.durata_minuti || 0
    acc[nome].km += parseFloat(s.km_percorsi) || 0
    acc[nome].sessioni += 1
    return acc
  }, {})

  return (
    <div className="p-4 pb-24 space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Report Spese</h2>

      {/* Filtri */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select
          className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-navy-500 focus:outline-none"
          value={filtroCorriere}
          onChange={e => setFiltroCorriere(e.target.value)}
        >
          <option value="">Tutti i corrieri</option>
          {corrieri.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>

        <select
          className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-navy-500 focus:outline-none"
          value={filtroPeriodo}
          onChange={e => setFiltroPeriodo(e.target.value)}
        >
          <option value="7">Ultima settimana</option>
          <option value="14">Ultime 2 settimane</option>
          <option value="30">Ultimo mese</option>
          <option value="90">Ultimi 3 mesi</option>
        </select>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap">Costo/km:</label>
          <input
            type="number"
            step="0.01"
            min={0}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-navy-500 focus:outline-none"
            value={costoKm}
            onChange={e => setCostoKm(parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-navy-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-terra-500 mb-1">
            <Clock size={18} />
            <span className="text-xs font-medium">Ore totali</span>
          </div>
          <p className="text-xl font-bold text-navy-800">
            {Math.floor(totali.ore / 60)}h {totali.ore % 60}m
          </p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <Navigation size={18} />
            <span className="text-xs font-medium">Km totali</span>
          </div>
          <p className="text-xl font-bold text-green-900">{totali.km.toFixed(1)} km</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Hash size={18} />
            <span className="text-xs font-medium">Sessioni</span>
          </div>
          <p className="text-xl font-bold text-purple-900">{totali.sessioni}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <DollarSign size={18} />
            <span className="text-xs font-medium">Costo stimato</span>
          </div>
          <p className="text-xl font-bold text-amber-900">{costoTotale} EUR</p>
        </div>
      </div>

      {/* Riepilogo per corriere */}
      {Object.keys(perCorriere).length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Per corriere</h3>
          <div className="space-y-2">
            {Object.entries(perCorriere).map(([nome, dati]) => (
              <div key={nome} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="font-semibold text-gray-900">{nome}</p>
                <div className="flex gap-4 mt-2 text-sm text-gray-600">
                  <span>{Math.floor(dati.ore / 60)}h {dati.ore % 60}m</span>
                  <span>{dati.km.toFixed(1)} km</span>
                  <span>{dati.sessioni} sessioni</span>
                  <span className="text-amber-700 font-medium">{(dati.km * costoKm).toFixed(2)} EUR</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dettaglio sessioni */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600"></div>
        </div>
      ) : (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Dettaglio sessioni</h3>
          {sessioni.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Nessuna sessione nel periodo</p>
          ) : (
            <div className="space-y-2">
              {sessioni.map(s => (
                <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">
                        {s.corrieri?.nome} - {s.giri?.nome_giro || `Giro ${s.giri?.numero_giro}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(s.data_consegna).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-gray-600">{s.durata_minuti} min</p>
                      <p className="text-gray-600">{s.km_percorsi || 0} km</p>
                    </div>
                  </div>
                  {s.note_sessione && (
                    <p className="text-xs text-gray-400 mt-1 italic">{s.note_sessione}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
