import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Download, TrendingDown, TrendingUp, Package, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import Button from '../components/UI/Button'
import Badge from '../components/UI/Badge'

export default function StoricoPage() {
  const [storico, setStorico] = useState([])
  const [localitaList, setLocalitaList] = useState([])
  const [zoneList, setZoneList] = useState([])
  const [loading, setLoading] = useState(true)
  const [giorniAperti, setGiorniAperti] = useState({})

  // Filtri
  const [filtroZona, setFiltroZona] = useState('')
  const [filtroLocalita, setFiltroLocalita] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState('7')

  useEffect(() => { loadFiltri() }, [])
  useEffect(() => { fetchStorico() }, [filtroZona, filtroLocalita, filtroPeriodo])

  const loadFiltri = async () => {
    const { data: zone } = await supabase
      .from('zone').select('*').eq('attivo', true).order('nome_zona')
    if (zone) setZoneList(zone)

    const { data: locs } = await supabase
      .from('localita').select('*, zone(nome_zona)').eq('attivo', true).order('nome_locale')
    if (locs) setLocalitaList(locs)
  }

  const fetchStorico = async () => {
    setLoading(true)
    const dataInizio = new Date()
    dataInizio.setDate(dataInizio.getDate() - parseInt(filtroPeriodo))

    let query = supabase
      .from('storico_rimanenze')
      .select('*, localita(nome_locale, zona_id, zone(nome_zona))')
      .gte('data', dataInizio.toISOString().split('T')[0])
      .order('data', { ascending: false })

    if (filtroLocalita) {
      query = query.eq('localita_id', filtroLocalita)
    }

    const { data, error } = await query
    if (error) console.error('Errore storico:', error)

    let risultati = data || []

    if (filtroZona) {
      risultati = risultati.filter(r => r.localita?.zona_id === filtroZona)
    }

    setStorico(risultati)

    // Apri il primo giorno di default
    if (risultati.length > 0) {
      const primaData = risultati[0]?.data
      setGiorniAperti({ [primaData]: true })
    }

    setLoading(false)
  }

  // Raggruppa per giorno
  const perGiorno = storico.reduce((acc, r) => {
    if (!acc[r.data]) acc[r.data] = []
    acc[r.data].push(r)
    return acc
  }, {})

  const giorniOrdinati = Object.keys(perGiorno).sort((a, b) => b.localeCompare(a))

  // Totali del periodo
  const totCopie = storico.reduce((s, r) => s + (r.copie_consegnate || 0), 0)
  const totResi = storico.reduce((s, r) => s + (r.rimanenze || 0), 0)
  const percMedia = totCopie > 0 ? Math.round((totResi / totCopie) * 100) : 0

  const toggleGiorno = (data) => {
    setGiorniAperti(prev => ({ ...prev, [data]: !prev[data] }))
  }

  const exportCSV = () => {
    const headers = 'Data,Localita,Zona,Copie Consegnate,Resi\n'
    const rows = storico.map(r =>
      `${r.data},"${r.localita?.nome_locale}","${r.localita?.zone?.nome_zona || ''}",${r.copie_consegnate || 0},${r.rimanenze || 0}`
    ).join('\n')

    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `storico_resi_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Storico Resi</h2>
        {storico.length > 0 && (
          <Button size="sm" variant="secondary" onClick={exportCSV}>
            <Download size={16} className="inline mr-1" />CSV
          </Button>
        )}
      </div>

      {/* Filtri */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select
          className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-navy-500 focus:outline-none"
          value={filtroZona}
          onChange={e => { setFiltroZona(e.target.value); setFiltroLocalita('') }}
        >
          <option value="">Tutte le zone</option>
          {zoneList.map(z => (
            <option key={z.id} value={z.id}>{z.nome_zona}</option>
          ))}
        </select>

        <select
          className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-navy-500 focus:outline-none"
          value={filtroLocalita}
          onChange={e => setFiltroLocalita(e.target.value)}
        >
          <option value="">Tutte le localita</option>
          {localitaList
            .filter(l => !filtroZona || l.zona_id === filtroZona)
            .map(l => (
              <option key={l.id} value={l.id}>{l.nome_locale}</option>
            ))
          }
        </select>

        <select
          className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-navy-500 focus:outline-none"
          value={filtroPeriodo}
          onChange={e => setFiltroPeriodo(e.target.value)}
        >
          <option value="7">Ultimi 7 giorni</option>
          <option value="14">Ultimi 14 giorni</option>
          <option value="30">Ultimo mese</option>
          <option value="90">Ultimi 3 mesi</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600"></div>
        </div>
      ) : storico.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-50" />
          <p>Nessun dato disponibile per il periodo selezionato</p>
        </div>
      ) : (
        <>
          {/* Riepilogo periodo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-navy-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 font-medium">Consegnate</p>
              <p className="text-xl font-bold text-navy-800">{totCopie}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 font-medium">Resi</p>
              <p className="text-xl font-bold text-red-700">{totResi}</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${percMedia > 30 ? 'bg-red-50' : percMedia > 15 ? 'bg-amber-50' : 'bg-green-50'}`}>
              <p className="text-xs text-gray-500 font-medium">% Rese</p>
              <p className={`text-xl font-bold ${percMedia > 30 ? 'text-red-700' : percMedia > 15 ? 'text-amber-700' : 'text-green-700'}`}>
                {percMedia}%
              </p>
            </div>
          </div>

          {/* Giorni raggruppati */}
          <div className="space-y-3">
            {giorniOrdinati.map(data => {
              const records = perGiorno[data]
              const isOpen = giorniAperti[data]
              const giornoCopie = records.reduce((s, r) => s + (r.copie_consegnate || 0), 0)
              const giornoResi = records.reduce((s, r) => s + (r.rimanenze || 0), 0)
              const giornoPerc = giornoCopie > 0 ? Math.round((giornoResi / giornoCopie) * 100) : 0
              const dataFormattata = new Date(data + 'T00:00:00').toLocaleDateString('it-IT', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })

              return (
                <div key={data} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* Header giorno */}
                  <div
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleGiorno(data)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      <div>
                        <p className="font-semibold text-gray-900 capitalize">{dataFormattata}</p>
                        <p className="text-xs text-gray-500">{records.length} localita</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">{giornoCopie} copie / {giornoResi} resi</p>
                      </div>
                      <Badge color={giornoPerc > 30 ? 'red' : giornoPerc > 15 ? 'yellow' : 'green'}>
                        {giornoPerc}%
                      </Badge>
                    </div>
                  </div>

                  {/* Dettaglio localita del giorno */}
                  {isOpen && (
                    <div className="border-t border-gray-100">
                      {records.map(r => {
                        const perc = r.copie_consegnate > 0
                          ? Math.round((r.rimanenze / r.copie_consegnate) * 100)
                          : 0
                        const isAlto = perc > 30

                        return (
                          <div
                            key={r.id}
                            className={`px-4 py-3 flex items-center justify-between border-b border-gray-50 last:border-b-0 ${
                              isAlto ? 'bg-red-50/50' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 text-sm">{r.localita?.nome_locale}</p>
                              {r.localita?.zone?.nome_zona && (
                                <p className="text-xs text-gray-400">{r.localita.zone.nome_zona}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p className="text-xs text-gray-500">{r.copie_consegnate} copie</p>
                                <p className={`text-sm font-bold ${isAlto ? 'text-red-600' : r.rimanenze === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                                  {r.rimanenze} resi
                                </p>
                              </div>
                              {isAlto ? (
                                <TrendingUp size={16} className="text-red-400" />
                              ) : (
                                <TrendingDown size={16} className="text-green-400" />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
