import { useMemo, useState } from 'react'
import { SPORTS, SPORT_LABEL } from '../domain/activity'
import { addDays } from '../domain/dates'
import { fmtMonth, km } from '../domain/format'
import type { DataSource, Sport } from '../domain/types'
import { useApp, useDerived } from '../services/store'
import { ActivityRow } from '../ui/ActivityRow'
import { Empty, PageHead } from '../ui/components'

type Period = '7' | '30' | '365' | 'all'

export function HistoryPage() {
  const activities = useApp((s) => s.activities)
  const today = useApp((s) => s.today)
  const d = useDerived()
  const [sport, setSport] = useState<Sport | 'all'>('all')
  const [period, setPeriod] = useState<Period>('30')
  const [source, setSource] = useState<DataSource | 'all'>('all')

  const list = useMemo(() => {
    const from = period === 'all' ? '0000' : addDays(today, -Number(period) + 1)
    return activities
      .filter((a) => a.source !== 'demo' && a.localDate >= from && (sport === 'all' || a.sport === sport) && (source === 'all' || a.source === source))
      .sort((a, b) => b.startedAt - a.startedAt)
  }, [activities, sport, period, source, today])

  const months = new Map<string, typeof list>()
  for (const a of list) months.set(a.localDate.slice(0, 7), [...(months.get(a.localDate.slice(0, 7)) ?? []), a])

  return (
    <div>
      <PageHead title="Histórico" subtitle="Todas as atividades registradas neste aparelho." actions={<a className="btn sm" href="#/estatisticas">Estatísticas</a>} />
      <div className="filters">
        <label className="field"><span>Modalidade</span>
          <select className="input" value={sport} onChange={(e) => setSport(e.target.value as Sport | 'all')}>
            <option value="all">Todas</option>
            {SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="field"><span>Período</span>
          <select className="input" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="365">Últimos 12 meses</option>
            <option value="all">Tudo</option>
          </select>
        </label>
        <label className="field"><span>Origem</span>
          <select className="input" value={source} onChange={(e) => setSource(e.target.value as DataSource | 'all')}>
            <option value="all">Todas</option>
            <option value="gps">GPS</option>
            <option value="import">Importadas</option>
            <option value="manual">Manuais</option>
          </select>
        </label>
      </div>
      {list.length === 0 ? (
        <Empty title="Nenhuma atividade neste filtro" action={<a className="btn primary" href="#/registrar">Registrar atividade</a>}>
          Ajuste os filtros ou registre uma nova atividade.
        </Empty>
      ) : (
        [...months].map(([m, acts]) => {
          const counted = acts.filter((a) => !d.duplicates.has(a.id))
          return (
            <section key={m} className="section" style={{ marginTop: 20 }}>
              <div className="section-head">
                <h2>{fmtMonth(m)}</h2>
                <span className="small muted">{counted.length} {counted.length === 1 ? 'atividade' : 'atividades'} · {km(counted.reduce((s, a) => s + a.distanceM, 0))} km</span>
              </div>
              <div className="panel flush list">
                {acts.map((a) => <ActivityRow key={a.id} a={a} duplicate={d.duplicates.has(a.id)} />)}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
