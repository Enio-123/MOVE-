import { Check, ChevronLeft, ChevronRight, Flame, Trash2 } from 'lucide-react'
import { addDays } from '../domain/dates'
import { fmtDateLong, fmtTime, km } from '../domain/format'
import { isActiveDay } from '../domain/streak'
import { deletePlanned } from '../services/actions'
import { useApp, useDerived } from '../services/store'
import { ActivityRow } from '../ui/ActivityRow'
import { Empty, Progress, SportIcon } from '../ui/components'
import { navigate } from '../ui/router'
import { localDate } from '../domain/dates'

export function DayPage({ date }: { date: string }) {
  const s = useApp((x) => x.settings)
  const today = useApp((x) => x.today)
  const activities = useApp((x) => x.activities)
  const planned = useApp((x) => x.planned)
  const events = useApp((x) => x.events)
  const d = useDerived()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return <p>Data inválida.</p>

  const acts = activities.filter((a) => a.localDate === date && a.source !== 'demo').sort((a, b) => a.startedAt - b.startedAt)
  const t = d.totals.get(date)
  const active = isActiveDay(t, s.streakRule, s.dailyGoalMin)
  const xp = d.xp.filter((e) => localDate(e.at) === date)
  const plans = planned.filter((p) => p.date === date)
  const evs = events.filter((e) => localDate(e.startsAt) === date)
  const streakLen = d.streak.lengthAt.get(date)

  return (
    <div>
      <div className="row between" style={{ marginBottom: 16 }}>
        <button className="icon-btn" aria-label="Dia anterior" onClick={() => navigate(`/dia/${addDays(date, -1)}`, true)}><ChevronLeft size={22} /></button>
        <div className="center">
          <h1 style={{ fontSize: '1.4rem' }}>{fmtDateLong(date)}</h1>
          <a className="small" href="#/calendario">Calendário</a>
        </div>
        <button className="icon-btn" aria-label="Próximo dia" disabled={date >= today} onClick={() => navigate(`/dia/${addDays(date, 1)}`, true)}><ChevronRight size={22} /></button>
      </div>

      <div className="grid two md-four">
        <div className="panel stat"><div className="label">Tempo ativo</div><div className="value">{Math.round(t?.minutes ?? 0)}<small>min</small></div></div>
        <div className="panel stat"><div className="label">Distância</div><div className="value">{km(t?.distanceM ?? 0)}<small>km</small></div></div>
        <div className="panel stat"><div className="label">XP recebido</div><div className="value">{xp.reduce((x, e) => x + e.amount, 0)}</div></div>
        <div className="panel stat">
          <div className="label">Sequência</div>
          <div className="value row" style={{ gap: 6 }}>
            <Flame size={20} className={active ? 'flame on' : 'flame'} aria-hidden="true" />
            {active ? `${streakLen} ${streakLen === 1 ? 'dia' : 'dias'}` : '—'}
          </div>
          <div className="sub">{active ? 'Dia ativo' : 'Dia sem atividade válida'}</div>
        </div>
      </div>

      <div className="panel section stack tight" style={{ marginTop: 12 }}>
        <div className="row between small">
          <span>Meta diária: {s.dailyGoalMin} min</span>
          {(t?.minutes ?? 0) >= s.dailyGoalMin ? <span className="badge ok"><Check size={12} aria-hidden="true" /> Alcançada</span> : <span className="muted">{Math.round(t?.minutes ?? 0)} de {s.dailyGoalMin} min</span>}
        </div>
        <Progress value={(t?.minutes ?? 0) / s.dailyGoalMin} label="Meta diária" />
      </div>

      <section className="section">
        <h2 className="section-head">Atividades</h2>
        {acts.length ? (
          <div className="panel flush list">{acts.map((a) => <ActivityRow key={a.id} a={a} duplicate={d.duplicates.has(a.id)} />)}</div>
        ) : (
          <Empty title="Nenhuma atividade neste dia" action={date === today ? <a className="btn primary" href="#/registrar">Registrar atividade</a> : <a className="btn" href="#/registrar?modo=manual">Registrar manualmente</a>} />
        )}
      </section>

      {xp.length > 0 && (
        <section className="section">
          <h2 className="section-head">XP do dia</h2>
          <div className="panel flush list">
            {xp.map((e) => (
              <div key={e.key} className="list-item">
                <div className="grow"><div className="title">{e.label}</div><div className="meta">{fmtTime(e.at)}</div></div>
                <span className="num accent-num">+{e.amount}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(plans.length > 0 || evs.length > 0) && (
        <section className="section">
          <h2 className="section-head">Agenda</h2>
          <div className="panel flush list">
            {plans.map((p) => (
              <div key={p.id} className="list-item">
                <SportIcon sport={p.sport} />
                <div className="grow"><div className="title">Treino planejado · {p.targetMin} min</div><div className="meta">{p.time}{p.note ? ` · ${p.note}` : ''}</div></div>
                <button className="icon-btn" aria-label="Excluir treino planejado" onClick={() => void deletePlanned(p.id)}><Trash2 size={16} /></button>
              </div>
            ))}
            {evs.map((e) => (
              <a key={e.id} className="list-item" href={`#/evento/${e.id}`}>
                <SportIcon sport={e.sport} />
                <div className="grow"><div className="title">{e.title}</div><div className="meta">{fmtTime(e.startsAt)} · {e.meetingPoint.name}</div></div>
                {e.origin === 'demo' && <span className="badge demo">Demonstração</span>}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
