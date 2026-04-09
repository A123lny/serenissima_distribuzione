import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Truck, Package, AlertTriangle, Clock } from 'lucide-react'
import Badge from '../components/UI/Badge'
import Button from '../components/UI/Button'

export default function Dashboard() {
  const { utente, isAdmin } = useAuth()
  const [stats, setStats] = useState({ giriOggi: [], totCopie: 0, alertRimanenze: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const oggi = new Date().toISOString().split('T')[0]

    // Giri attivi
    let giriQuery = supabase
      .from('giri')
      .select('*, corrieri(nome), localita(copie_standard)')
      .eq('attivo', true)

    if (!isAdmin && utente?.corriere_id) {
      giriQuery = giriQuery.eq('corriere_id', utente.corriere_id)
    }

    const { data: giri } = await giriQuery

    // Sessioni di oggi
    const { data: sessioni } = await supabase
      .from('sessioni_consegna')
      .select('*, giri(nome_giro)')
      .eq('data_consegna', oggi)

    // Rimanenze alte (ultimi 7 giorni)
    const settimaneFa = new Date()
    settimaneFa.setDate(settimaneFa.getDate() - 7)
    const { data: rimanenze } = await supabase
      .from('storico_rimanenze')
      .select('*, localita(nome_locale, giro_id)')
      .gte('data', settimaneFa.toISOString().split('T')[0])
      .gt('rimanenze', 5)
      .order('data', { ascending: false })
      .limit(10)

    const totCopie = (giri || []).reduce((sum, g) =>
      sum + (g.localita || []).reduce((s, l) => s + (l.copie_standard || 0), 0), 0
    )

    const giriConStato = (giri || []).map(giro => {
      const sessioneGiro = (sessioni || []).find(s => s.giro_id === giro.id)
      let stato = 'da_fare'
      if (sessioneGiro?.fine_consegna) stato = 'completato'
      else if (sessioneGiro?.inizio_consegna) stato = 'in_corso'
      return { ...giro, stato, sessione: sessioneGiro }
    })

    setStats({
      giriOggi: giriConStato,
      totCopie,
      alertRimanenze: rimanenze || [],
    })
    setLoading(false)
  }

  const statoLabel = {
    completato: { text: 'Completato', color: 'green' },
    in_corso: { text: 'In corso', color: 'yellow' },
    da_fare: { text: 'Da fare', color: 'gray' },
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">
        Buongiorno, {utente?.nome}
      </h2>
      <p className="text-gray-500">
        {new Date().toLocaleDateString('it-IT', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })}
      </p>

      {/* Stats rapide */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Truck size={20} />
            <span className="text-sm font-medium">Giri oggi</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">{stats.giriOggi.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <Package size={20} />
            <span className="text-sm font-medium">Copie totali</span>
          </div>
          <p className="text-2xl font-bold text-green-900">{stats.totCopie}</p>
        </div>
      </div>

      {/* Accesso rapido consegne */}
      <Link to="/consegna">
        <Button size="lg" variant="success" className="w-full flex items-center justify-center gap-2">
          <Truck size={24} />
          Inizia Consegne
        </Button>
      </Link>

      {/* Giri del giorno */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Giri del giorno</h3>
        <div className="space-y-2">
          {stats.giriOggi.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nessun giro configurato</p>
          ) : (
            stats.giriOggi.map(giro => (
              <div key={giro.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {giro.nome_giro || `Giro ${giro.numero_giro}`}
                  </p>
                  <p className="text-sm text-gray-500">
                    {giro.corrieri?.nome} - {giro.localita?.length || 0} localita
                  </p>
                  {giro.sessione?.durata_minuti && (
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                      <Clock size={12} />
                      {giro.sessione.durata_minuti} min
                    </p>
                  )}
                </div>
                <Badge color={statoLabel[giro.stato].color}>
                  {statoLabel[giro.stato].text}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Alert rimanenze */}
      {isAdmin && stats.alertRimanenze.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" />
            Rimanenze eccessive
          </h3>
          <div className="space-y-2">
            {stats.alertRimanenze.map(r => (
              <div key={r.id} className="bg-red-50 border border-red-200 rounded-xl p-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-red-900">{r.localita?.nome_locale}</p>
                  <p className="text-sm text-red-600">{r.data}</p>
                </div>
                <Badge color="red">{r.rimanenze} rese</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
