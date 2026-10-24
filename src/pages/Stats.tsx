import { useMemo, useState } from 'react'
import { activeMinutes, avgPace, SPORTS, SPORT_LABEL } from '../domain/activity'
import { addDays, addMonths, monthDays, monthKey, weekStart } from '../domain/dates'
import { clock, fmtDateShort, fmtMonth, km, pace } from '../domain/format'
import { personalRecords, series, summarize, type Bucket } from '../domain/stats'
import type { Sport } from '../domain/types'
import { useApp, useDerived } from '../services/store'
import { BarChart, Sparkline } from '../ui/charts'
import { Empty, PageHead, Segmented } from '../ui/components'
import { navigate } from '../ui/router'

type Period = 'week' | 'month' | 'year'
type Metric = 'distance' | 'minutes' | 'count'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function rangeFor(period: Period, anchor: string): { from: string; to: string; bucket: Bucket; label: string } {
  if (period === 'week') {
    const from = weekStart(anchor)
    return { from, to: addDays(from, 6), bucket: 'day', label: `${fmtDateShort(from)} – ${fmtDateShort(addDays(from, 6))}` }
  }
  if (period === 'month') {
    const days = monthDays(monthKey(anchor))
    return { from: days[0], to: days[days.length - 1], bucket: 'day', label: fmtMonth(monthKey(anchor)) }
  }
  const y = anchor.slice(0, 4)
  return { from: `${y}-01-01`, to: `${y}-12-31`, bucket: 'month', label: y }
}

function shift(period: Period, anchor: string, n: number): string {
  if (period === 'week') return addDays(anchor, 7 * n)
  if (period === 'month') return `${addMonths(monthKey(anchor), n)}-01`
  return `${Number(anchor.slice(0, 4)) + n}-01-01`
}

export function StatsPage() {
  const today = useApp((s) => s.today)
  const d = useDerived()
  const [period, setPeriod] = useState<Period>('week')
  const [anchor, setAnchor] = useState(today)
  const [metric, setMetric] = useState<Metric>('distance')
  const [sport, setSport] = useState<Sport | 'all'>('all')

  const r = rangeFor(period, anchor)
  const prev = rangeFor(period, shift(period, anchor, -1))
  const data = series(d.counted, r.from, r.to, r.bucket, sport)
  const cur = summarize(d.counted, r.from, r.to, sport)
  const before = summarize(d.counted, prev.from, prev.to, sport)
  const records = personalRecords(d.counted, sport)

  // Origem dos dados no período.
  const bySource = useMemo(() => {
    const acts = d.counted.filter((a) => a.localDate >= r.from && a.localDate <= r.to && (sport === 'all' || a.sport === sport))
    const sum = (src: string) => acts.filter((a) => a.source === src).reduce((s, a) => s + a.distanceM, 0)
    return { gps: sum('gps'), import: sum('import'), manual: sum('manual') }
  }, [d.counted, r.from, r.to, sport])

  // Tendências das últimas 12 semanas.
  const weeks = Array.from({ length: 12 }, (_, i) => weekStart(addDays(today, -7 * (11 - i))))
  const consistency = weeks.map((w) => [...d.streak.activeDays].filter((x) => x >= w && x <= addDays(w, 6)).length)
  const paceTrend = weeks.map((w) => {
    const acts = d.counted.filter((a) => a.localDate >= w && a.localDate <= addDays(w, 6) && (a.source === 'gps' || a.source === 'import') && a.distanceM >= 1000 && a.sport === sport)
    const dist = acts.reduce((s, a) => s + a.distanceM, 0)
    const time = acts.reduce((s, a) => s + a.movingS, 0)
    return dist ? time / (dist / 1000) : null
  })

  const value = (p: { distanceM: number; minutes: number; count: number }) => (metric === 'distance' ? p.distanceM / 1000 : metric === 'minutes' ? p.minutes : p.count)
  const unit = metric === 'distance' ? 'km' : metric === 'minutes' ? 'min' : 'atividades'
  const fmtV = (v: number) => (metric === 'distance' ? km(v * 1000) : String(Math.round(v)))
  const delta = (a: number, b: number) => (b === 0 ? null : Math.round(((a - b) / b) * 100))

  if (d.counted.length === 0) {
    return (
      <div>
        <PageHead title="Estatísticas" />
        <Empty title="Sem dados para analisar ainda" action={<a className="btn primary" href="#/registrar">Registrar atividade</a>}>
          Os gráficos usam apenas atividades registradas por você. Nenhum número é estimado sem dados.
        </Empty>
      </div>
    )
  }

  return (
    <div>
      <PageHead title="Estatísticas" subtitle="Somente atividades registradas, sem duplicadas." actions={<a className="btn sm" href="#/historico">Histórico</a>} />
      <div className="filters">
        <Segmented<Period> label="Período" value={period} onChange={(p) => { setPeriod(p); setAnchor(today) }} options={[{ value: 'week', label: 'Semana' }, { value: 'month', label: 'Mês' }, { value: 'year', label: 'Ano' }]} />
        <Segmented<Metric> label="Métrica" value={metric} onChange={setMetric} options={[{ value: 'distance', label: 'Distância' }, { value: 'minutes', label: 'Tempo' }, { value: 'count', label: 'Frequência' }]} />
        <select className="input" style={{ width: 'auto' }} value={sport} onChange={(e) => setSport(e.target.value as Sport | 'all')} aria-label="Modalidade">
          <option value="all">Todas as modalidades</option>
          {SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABEL[s]}</option>)}
        </select>
      </div>

      <div className="panel section" style={{ marginTop: 16 }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <button className="btn ghost sm" onClick={() => setAnchor(shift(period, anchor, -1))} aria-label="Período anterior">‹</button>
          <strong>{r.label}</strong>
          <button className="btn ghost sm" onClick={() => setAnchor(shift(period, anchor, 1))} disabled={r.to >= today} aria-label="Próximo período">›</button>
        </div>
        <BarChart
          label={`${metric === 'distance' ? 'Distância' : metric === 'minutes' ? 'Tempo ativo' : 'Atividades'} por ${r.bucket === 'day' ? 'dia' : 'mês'}`}
          bars={data.map((p) => ({
            key: p.key,
            label: r.bucket === 'month' ? MONTHS[Number(p.key.slice(5, 7)) - 1] : period === 'week' ? ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'][data.indexOf(p)] : String(Number(p.key.slice(8))),
            value: value(p),
            title: `${r.bucket === 'month' ? fmtMonth(p.key) : fmtDateShort(p.key)}: ${fmtV(value(p))} ${unit}`,
            highlight: p.key === today || p.key === monthKey(today),
          }))}
          onSelect={(key) => {
            if (r.bucket === 'month') { setPeriod('month'); setAnchor(`${key}-01`) }
            else {
              const p = data.find((x) => x.key === key)
              if (p?.activityIds.length === 1) navigate(`/atividade/${p.activityIds[0]}`)
              else navigate(`/dia/${key}`)
            }
          }}
        />
        <div className="grid two md-four" style={{ marginTop: 12 }}>
          {[
            { label: 'Distância', v: `${km(cur.distanceM)} km`, dl: delta(cur.distanceM, before.distanceM) },
            { label: 'Tempo ativo', v: clock(cur.minutes * 60), dl: delta(cur.minutes, before.minutes) },
            { label: 'Atividades', v: String(cur.count), dl: delta(cur.count, before.count) },
            { label: 'Dias ativos', v: String(cur.activeDays), dl: delta(cur.activeDays, before.activeDays) },
          ].map((x) => (
            <div key={x.label} className="stat">
              <div className="label">{x.label}</div>
              <div className="value" style={{ fontSize: '1.3rem' }}>{x.v}</div>
              <div className="sub">{x.dl === null ? 'sem base no período anterior' : `${x.dl >= 0 ? '+' : ''}${x.dl}% vs. período anterior`}</div>
            </div>
          ))}
        </div>
        <p className="tiny faint" style={{ marginTop: 8 }}>
          Origem da distância: GPS {km(bySource.gps)} km · importada {km(bySource.import)} km · informada manualmente {km(bySource.manual)} km. Passos não aparecem porque nenhuma fonte de passos está conectada.
        </p>
      </div>

      <div className="grid md-two section">
        <div className="panel">
          <h3>Consistência · 12 semanas</h3>
          <p className="tiny muted">Dias ativos por semana</p>
          <BarChart label="Dias ativos por semana nas últimas 12 semanas" height={100} bars={weeks.map((w, i) => ({ key: w, label: fmtDateShort(w).split(' ')[0], value: consistency[i], title: `Semana de ${fmtDateShort(w)}: ${consistency[i]} dias ativos` }))} />
        </div>
        <div className="panel">
          <h3>Ritmo médio · 12 semanas</h3>
          {sport === 'all' ? (
            <p className="small muted">Escolha uma modalidade: ritmo só é comparável entre atividades do mesmo tipo.</p>
          ) : paceTrend.filter((x) => x !== null).length >= 2 ? (
            <>
              <p className="tiny muted">Atividades medidas de 1 km ou mais. Mais baixo é mais rápido.</p>
              <Sparkline values={paceTrend} height={90} label="Tendência de ritmo semanal" />
              <p className="tiny faint">Última semana com dados: {pace(paceTrend.filter((x) => x !== null).pop()!)} /km</p>
            </>
          ) : (
            <p className="small muted">São necessárias pelo menos duas semanas com atividades medidas de {SPORT_LABEL[sport].toLowerCase()}.</p>
          )}
        </div>
      </div>

      <section className="section">
        <h2 className="section-head">Recordes pessoais {sport !== 'all' && `· ${SPORT_LABEL[sport]}`}</h2>
        <div className="panel flush list">
          {records.map((rec) => {
            const a = d.counted.find((x) => x.id === rec.activityId)!
            return (
              <a key={rec.label} className="list-item" href={`#/atividade/${rec.activityId}`}>
                <div className="grow">
                  <div className="title">{rec.label}</div>
                  <div className="meta">{a.title} · {fmtDateShort(a.localDate)}</div>
                </div>
                <span className="num big">{rec.unit === 'm' ? `${km(rec.value)} km` : rec.unit === 's' ? clock(rec.value) : `${pace(rec.value)} /km`}</span>
              </a>
            )
          })}
          {sport === 'all' && <div className="list-item small muted">Filtre por modalidade para ver recordes de ritmo.</div>}
        </div>
      </section>

      <p className="tiny faint section">
        Médias do período: {cur.count ? `${km(cur.distanceM / cur.count)} km e ${Math.round(cur.minutes / cur.count)} min por atividade` : 'sem atividades'}.
        {sport !== 'all' && d.counted.some((a) => a.sport === sport && avgPace(a)) ? ` Ritmo médio geral: ${pace(d.counted.filter((a) => a.sport === sport && a.source !== 'manual').reduce((s, a) => s + a.movingS, 0) / (d.counted.filter((a) => a.sport === sport && a.source !== 'manual').reduce((s, a) => s + a.distanceM, 0) / 1000 || 1))} /km.` : ''}
        {' '}Tempo ativo total registrado: {clock(d.counted.reduce((s, a) => s + activeMinutes(a) * 60, 0))}.
      </p>
    </div>
  )
}
