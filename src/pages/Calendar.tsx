import { CalendarPlus, ChevronLeft, ChevronRight, Download, Flame, X } from 'lucide-react'
import { useState } from 'react'
import { SPORTS, SPORT_LABEL } from '../domain/activity'
import { addMonths, diffDays, localDate, monthDays, monthKey, weekday, weekStart, addDays } from '../domain/dates'
import { fmtDateShort, fmtMonth } from '../domain/format'
import { buildIcs } from '../domain/ics'
import type { Sport } from '../domain/types'
import { savePlanned } from '../services/actions'
import { uid } from '../services/ids'
import { useApp, useDerived } from '../services/store'
import { download, PageHead, Progress, Sheet } from '../ui/components'
import { navigate } from '../ui/router'

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

function introSeen() {
  try { return localStorage.getItem('moveplus:cal-intro') === '1' } catch { return true }
}

export function CalendarPage() {
  const today = useApp((s) => s.today)
  const s = useApp((x) => x.settings)
  const planned = useApp((x) => x.planned)
  const events = useApp((x) => x.events)
  const d = useDerived()
  const [month, setMonth] = useState(monthKey(today))
  const [plan, setPlan] = useState<string | null>(null)
  const [showIntro, setShowIntro] = useState(!introSeen())

  const days = monthDays(month)
  const lead = (weekday(days[0]) + 6) % 7
  const plannedDates = new Set(planned.map((p) => p.date))
  const eventDates = new Set(events.map((e) => localDate(e.startsAt)))
  const ws = weekStart(today)
  const weekGoal = s.fitness === 'beginner' ? 3 : s.fitness === 'intermediate' ? 4 : 5
  const activeInMonth = days.filter((x) => d.streak.activeDays.has(x)).length
  const pastRuns = [...d.streak.runs].reverse().filter((r) => r.length >= 2).slice(0, 5)

  const exportIcs = () => {
    const now = Date.now()
    const items = [
      ...planned.filter((p) => p.date >= today).map((p) => ({ uid: p.id, title: `Move+: ${SPORT_LABEL[p.sport]} (${p.targetMin} min)`, start: new Date(`${p.date}T${p.time}`).getTime(), durationMin: p.targetMin, description: p.note })),
      ...events.filter((e) => e.going && e.origin !== 'demo' && e.startsAt > now).map((e) => ({ uid: e.id, title: `Move+: ${e.title}`, start: e.startsAt, durationMin: e.durationMin, location: e.meetingPoint.name, description: e.description })),
    ]
    if (!items.length) return alert('Não há treinos planejados ou encontros confirmados para exportar.')
    download('moveplus-agenda.ics', new Blob([buildIcs(items)], { type: 'text/calendar' }))
  }

  return (
    <div>
      <PageHead
        title="Calendário"
        subtitle="Dias ativos, treinos planejados e encontros."
        actions={
          <>
            <button className="btn sm" onClick={exportIcs}><Download size={16} aria-hidden="true" /> Exportar</button>
            <button className="btn primary sm" onClick={() => setPlan(today)}><CalendarPlus size={16} aria-hidden="true" /> Planejar</button>
          </>
        }
      />

      {showIntro && (
        <div className="panel stack tight cal-intro">
          <div className="row between"><h3>Como funciona o calendário</h3><button className="icon-btn" aria-label="Fechar explicação" onClick={() => { setShowIntro(false); try { localStorage.setItem('moveplus:cal-intro', '1') } catch { /* sem armazenamento */ } }}><X size={18} /></button></div>
          <ul className="bullets small muted">
            <li>Dias destacados são dias ativos: tiveram uma atividade válida conforme a sua regra ({s.streakRule.kind === 'goal' ? `meta de ${s.dailyGoalMin} min` : `atividade de ${s.streakRule.minMinutes} min ou mais`}).</li>
            <li>Planeje treinos e confirme encontros. Eles aparecem aqui e na tela inicial.</li>
            <li>A Move+ não lê o calendário do seu celular. Para levar a agenda para lá, use “Exportar” e abra o arquivo .ics.</li>
          </ul>
        </div>
      )}

      <div className="grid lg-split">
        <div className="panel">
          <div className="row between" style={{ marginBottom: 12 }}>
            <button className="icon-btn" aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft size={20} /></button>
            <h2 aria-live="polite">{fmtMonth(month)}</h2>
            <button className="icon-btn" aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={20} /></button>
          </div>
          <div className="cal-grid" role="grid" aria-label={`Calendário de ${fmtMonth(month)}`}>
            {WEEKDAYS.map((w) => <div key={w} className="cal-wd" role="columnheader">{w}</div>)}
            {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} />)}
            {days.map((day) => {
              const active = d.streak.activeDays.has(day)
              const prevActive = d.streak.activeDays.has(addDays(day, -1)) && weekday(day) !== 1
              const nextActive = d.streak.activeDays.has(addDays(day, 1)) && weekday(day) !== 0
              const future = day > today
              const labels = [
                fmtDateShort(day),
                active ? 'dia ativo' : future ? '' : 'sem atividade válida',
                plannedDates.has(day) ? 'treino planejado' : '',
                eventDates.has(day) ? 'encontro' : '',
              ].filter(Boolean).join(', ')
              return (
                <button
                  key={day}
                  role="gridcell"
                  className={`cal-day${active ? ' active' : ''}${active && prevActive ? ' join-l' : ''}${active && nextActive ? ' join-r' : ''}${day === today ? ' today' : ''}${future ? ' future' : ''}`}
                  onClick={() => (future ? setPlan(day) : navigate(`/dia/${day}`))}
                  aria-label={labels}
                >
                  <span className="n">{Number(day.slice(8))}</span>
                  <span className="marks" aria-hidden="true">
                    {plannedDates.has(day) && <i className="m plan" />}
                    {eventDates.has(day) && <i className="m event" />}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="cal-legend tiny muted">
            <span><i className="legend-dot active" /> Dia ativo</span>
            <span><i className="legend-dot plan" /> Treino planejado</span>
            <span><i className="legend-dot event" /> Encontro</span>
          </div>
        </div>

        <div className="stack">
          <div className="panel streak-panel">
            <div className="row">
              <Flame size={34} className={d.streak.current ? 'flame on' : 'flame'} aria-hidden="true" />
              <div>
                <div className="num streak-big">{d.streak.current}</div>
                <div className="small muted">{d.streak.current === 1 ? 'dia seguido' : 'dias seguidos'}</div>
              </div>
            </div>
            <p className="small muted">
              {d.streak.current === 0
                ? d.streak.best > 0 ? 'A sequência anterior terminou. Tudo bem: uma atividade hoje já recomeça a contagem.' : 'Registre uma atividade para começar a sua sequência.'
                : d.streak.pendingToday ? 'Uma atividade hoje mantém a sequência.' : 'Hoje já conta. Bom trabalho.'}
            </p>
            <div className="grid three">
              <div className="stat"><div className="label">Melhor</div><div className="value">{d.streak.best}</div></div>
              <div className="stat"><div className="label">No mês</div><div className="value">{activeInMonth}</div></div>
              <div className="stat"><div className="label">Semana</div><div className="value">{d.streak.activeThisWeek}<small>/{weekGoal}</small></div></div>
            </div>
            <Progress value={d.streak.activeThisWeek / weekGoal} label={`Dias ativos na semana: ${d.streak.activeThisWeek} de ${weekGoal}`} />
            <p className="tiny faint">Semana iniciada em {fmtDateShort(ws)}. Regra atual: {s.streakRule.kind === 'goal' ? `alcançar ${s.dailyGoalMin} min no dia` : `uma atividade de ${s.streakRule.minMinutes} min ou mais`}. <a href="#/ajustes">Alterar</a></p>
          </div>

          <div className="panel">
            <h3 style={{ marginBottom: 8 }}>Sequências anteriores</h3>
            {pastRuns.length ? (
              <ul className="runs">
                {pastRuns.map((r) => (
                  <li key={r.start}>
                    <span>{fmtDateShort(r.start)} – {fmtDateShort(r.end)}</span>
                    <span className="num">{r.length} dias{diffDays(r.end, today) <= 1 ? ' · atual' : ''}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Sequências de 2 dias ou mais aparecem aqui.</p>
            )}
          </div>
        </div>
      </div>

      {plan && <PlanSheet date={plan} onClose={() => setPlan(null)} />}
    </div>
  )
}

function PlanSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const today = useApp((s) => s.today)
  const fav = useApp((s) => s.settings.favoriteSports[0] ?? 'walk')
  const [d, setD] = useState(date)
  const [time, setTime] = useState('07:00')
  const [sport, setSport] = useState<Sport>(fav)
  const [mins, setMins] = useState('30')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  return (
    <Sheet title="Planejar treino" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          const m = Number(mins)
          if (d < today) return setErr('Escolha hoje ou uma data futura.')
          if (!Number.isFinite(m) || m < 5 || m > 300) return setErr('Duração entre 5 e 300 minutos.')
          await savePlanned({ id: uid(), date: d, time, sport, targetMin: m, note: note.trim(), createdAt: Date.now() })
          onClose()
        }}
      >
        <div className="grid two">
          <label className="field"><span>Data</span><input className="input" type="date" min={today} value={d} onChange={(e) => setD(e.target.value)} /></label>
          <label className="field"><span>Horário</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </div>
        <div className="grid two">
          <label className="field"><span>Modalidade</span>
            <select className="input" value={sport} onChange={(e) => setSport(e.target.value as Sport)}>{SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABEL[s]}</option>)}</select>
          </label>
          <label className="field"><span>Duração (min)</span><input className="input" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value)} /></label>
        </div>
        <label className="field"><span>Observação</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Ex.: caminhada leve no parque" /></label>
        {err && <p className="error-text" role="alert">{err}</p>}
        <button className="btn primary" type="submit">Salvar no calendário</button>
        <p className="tiny faint">Um treino planejado não conta como atividade: o dia só fica ativo quando a atividade é registrada.</p>
      </form>
    </Sheet>
  )
}
