import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Download, TrendingDown, TrendingUp } from 'lucide-react'
import Button from '../components/UI/Button'
import Badge from '../components/UI/Badge'

export default function StoricoPage() {
  const { isAdmin } = useAuth()
  const [storico, setStorico] = useState([])
  const [localitaList, setLocalitaList] = useState([])
  const [giriList, setGiriList] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtri
  const [filtroGiro, setFiltroGiro] = useState('')
  const [filtroLocalita, setFiltroLocalita] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState('7') // giorni

  useEffect(() => {
    loadFiltri()
  }, [])

  useEffect(() => {
    fetchStorico()
  }, [filtroGiro, filtroLocalita, filtroPeriodo])

  const loadFiltri = async () => {
    const { data: giri } = await supabase
      .from('giri')
      .select('*, corrieri(nome)')
      .eq('attivo', true)
    if (giri) setGiriList(giri)

    const { data: locs } = await supabase
      .from('localita')
      .select('*, giri(nome_giro)')
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
      .select('*, localita(nome_locale, giro_id, giri(nome_giro, corrieri(nome)))')
      .gte('data', dataInizio.toISOString().split('T')[0])
      .order('data', { ascending: false })

    if (filtroLocalita) {
      query = query.eq('localita_id', filtroLocalita)
    }

    const { data } = await query

    let risultati = data || []

    // Filtra per giro (client-side perche' e' una relazione nested)
    if (filtroGiro) {
      risultati = risultati.filter(r => r.localita?.giro_id === filtroGiro)
    }

    setStorico(risultati)
    setLoading(false)
  }

  const exportCSV = () => {
    const headers = 'Data,Localita,Giro,Copie Consegnate,Rimanenze\n'
    const rows = storico.map(r =>
      `${r.data},"${r.localita?.nome_locale}","${r.localita?.giri?.nome_giro || ''}",${r.copie_consegnate || 0},${r.rimanenze || 0}`
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
          className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
          value={filtroGiro}
          onChange={e => setFiltroGiro(e.target.value)}
        >
          <option value="">Tutti i giri</option>
          {giriList.map(g => (
            <option key={g.id} value={g.id}>
              {g.nome_giro || `Giro ${g.numero_giro}`} ({g.corrieri?.nome})
            </option>
          ))}
        </select>

        <select
          className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
          value={filtroLocalita}
          onChange={e => setFiltroLocalita(e.target.value)}
        >
          <option value="">Tutte le localita</option>
          {localitaList
            .filter(l => !filtroGiro || l.giro_id === filtroGiro)
            .map(l => (
              <option key={l.id} value={l.id}>{l.nome_locale}</option>
            ))
          }
        </select>

        <select
          className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
                    {new Date(r.data).toLocaleDateString('it-IT')} - {r.localita?.giri?.nome_giro}
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
