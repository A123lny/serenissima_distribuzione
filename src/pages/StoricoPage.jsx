import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Download, TrendingDown, TrendingUp } from 'lucide-react'
import Button from '../components/UI/Button'
import Badge from '../components/UI/Badge'

export default function StoricoPage() {
  const [storico, setStorico] = useState([])
  const [localitaList, setLocalitaList] = useState([])
  const [zoneList, setZoneList] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtri
  const [filtroZona, setFiltroZona] = useState('')
  const [filtroLocalita, setFiltroLocalita] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState('7')

  useEffect(() => { loadFiltri() }, [])
  useEffect(() => { fetchStorico() }, [filtroZona, filtroLocalita, filtroPeriodo])

  const loadFiltri = async () => {
    const { data: zone } = await supabase
      .from('zone')
      .select('*')
      .eq('attivo', true)
      .order('nome_zona')
    if (zone) setZoneList(zone)

    const { data: locs } = await supabase
      .from('localita')
      .select('*, zone(nome_zona)')
      .eq('attivo', true)
      .order('nome_locale')
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

    if (error) {
      console.error('Errore storico:', error)
    }

    let risultati = data || []

    // Filtra per zona (client-side)
    if (filtroZona) {
      risultati = risultati.filter(r => r.localita?.zona_id === filtroZona)
    }

    setStorico(risultati)
    setLoading(false)
  }

  const exportCSV = () => {
    const headers = 'Data,Localita,Zona,Copie Consegnate,Rimanenze\n'
    const rows = storico.map(r =>
      `${r.data},"${r.localita?.nome_locale}","${r.localita?.zone?.nome_zona || ''}",${r.copie_consegnate || 0},${r.rimanenze || 0}`
    ).join('\n')

    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `storico_rimanenze_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Storico Rimanenze</h2>
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
          onChange={e => setFiltroZona(e.target.value)}
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

      {/* Tabella */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600"></div>
        </div>
      ) : storico.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>Nessun dato disponibile per il periodo selezionato</p>
        </div>
      ) : (
        <div className="space-y-2">
          {storico.map(r => {
            const percentualeRese = r.copie_consegnate > 0
              ? Math.round((r.rimanenze / r.copie_consegnate) * 100)
              : 0
            const isAlto = percentualeRese > 30

            return (
              <div
                key={r.id}
                className={`border rounded-xl p-3 flex items-center justify-between ${
                  isAlto ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div>
                  <p className="font-medium text-gray-900">{r.localita?.nome_locale}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(r.data).toLocaleDateString('it-IT')}
                    {r.localita?.zone?.nome_zona && ` - ${r.localita.zone.nome_zona}`}
                  </p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <p className="text-sm text-gray-600">{r.copie_consegnate} consegnate</p>
                    <p className={`font-bold ${isAlto ? 'text-red-600' : 'text-green-600'}`}>
                      {r.rimanenze} rese
                    </p>
                  </div>
                  {isAlto ? (
                    <TrendingUp size={20} className="text-red-500" />
                  ) : (
                    <TrendingDown size={20} className="text-green-500" />
                  )}
                  <Badge color={r.rimanenze === 0 ? 'green' : isAlto ? 'red' : 'yellow'}>
                    {percentualeRese}%
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
