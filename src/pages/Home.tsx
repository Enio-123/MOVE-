import { Award, ChevronRight, Flame, Footprints, HeartPulse, MapPin, Route as RouteIcon, Timer, Upload, Users, Watch } from 'lucide-react'
import { activeMinutes, estimateCalories } from '../domain/activity'
import { addDays, weekStart } from '../domain/dates'
import { duration, fmtDateLong, fmtInt, fmtTime, km } from '../domain/format'
import { describeMission } from '../domain/missions'
import { estimateSteps, stepsForDay } from '../domain/steps'
import { useApp, useDerived } from '../services/store'
import { ActivityRow } from '../ui/ActivityRow'
import { BarChart } from '../ui/charts'
import { EstimateBadge, Progress, Ring, SportIcon } from '../ui/components'
import { navigate } from '../ui/router'
import { InstallCard } from '../ui/InstallCard'
import { LogoMark } from '../ui/Logo'
import { CountUp } from '../ui/motion'

function greeting(h: number) {
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export function Home() {
  const s = useApp((x) => x.settings)
  const today = useApp((x) => x.today)
  const events = useApp((x) => x.events)
  const planned = useApp((x) => x.planned)
  const routes = useApp((x) => x.routes)
  const d = useDerived()
  const t = d.totals.get(today)
  const minutes = t?.minutes ?? 0
  const todayActs = d.counted.filter((a) => a.localDate === today)
  const hrActs = todayActs.filter((a) => a.avgHr)
  const calories = todayActs.reduce<number | null>((sum, a) => {
    const c = estimateCalories(a, s.weightKg)
    return c === null ? sum : (sum ?? 0) + c
  }, null)
  const last = [...d.counted].sort((a, b) => b.startedAt - a.startedAt)[0]
  const ws = weekStart(today)
  const week = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  const weekMin = week.reduce((sum, day) => sum + (d.totals.get(day)?.minutes ?? 0), 0)
  const weekKm = week.reduce((sum, day) => sum + (d.totals.get(day)?.distanceM ?? 0), 0)
  const now = Date.now()
  const upcoming = events.filter((e) => e.startsAt > now - 3600000).sort((a, b) => a.startsAt - b.startsAt).slice(0, 2)
  const nextPlans = planned.filter((p) => p.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 2)
  const missions = d.missions.filter((m) => !m.done).sort((a, b) => b.value / b.target - a.value / a.target).slice(0, 3)
  const recentAch = d.achievements.filter((a) => a.unlockedAt).sort((a, b) => b.unlockedAt! - a.unlockedAt!).slice(0, 3)
  const empty = d.counted.length === 0
  const stepLog = useApp((x) => x.stepLog)
  const healthSteps = useApp((x) => x.healthSteps)
  const estimated = todayActs.reduce((n, a) => n + (a.steps ?? estimateSteps(a.distanceM, a.sport) ?? 0), 0)
  const steps = stepsForDay({ health: healthSteps[today], sensor: stepLog[today], estimated })
  const name = s.displayName.split(' ')[0]

  return (
    <div className="home">
      <header className="home-head">
        <p className="muted small">{fmtDateLong(today)}</p>
        <h1>{greeting(new Date().getHours())}{name ? `, ${name}` : ''}</h1>
      </header>

      <section className="hero" aria-label="Resumo de hoje">
        <span className="hero-mark" aria-hidden="true"><LogoMark size={260} /></span>
        <button className="hero-ring" onClick={() => navigate(`/dia/${today}`)} aria-label={`Hoje: ${Math.round(minutes)} de ${s.dailyGoalMin} minutos ativos. Abrir o dia.`}>
          <Ring value={minutes / s.dailyGoalMin} size={136} stroke={12} color="#ffffff" track="rgb(255 255 255 / 0.22)" doneColor="#c6ec6a" label={`${Math.round(minutes)} de ${s.dailyGoalMin} minutos`}>
            <span className="num ring-value"><CountUp value={Math.round(minutes)} /></span>
            <span className="tiny hero-dim">de {s.dailyGoalMin} min</span>
          </Ring>
        </button>
        <div className="hero-side">
          <a className="hero-item" href="#/calendario">
            <Flame size={22} className={d.streak.current ? 'flame on' : 'flame'} aria-hidden="true" />
            <div>
              <div className="num hero-num"><CountUp value={d.streak.current} /> <span>{d.streak.current === 1 ? 'dia' : 'dias'}</span></div>
              <div className="tiny hero-dim">
                {d.streak.current === 0 ? 'Sequência começa com a próxima atividade' : d.streak.pendingToday ? 'Uma atividade hoje mantém a sequência' : 'Sequência ativa hoje'}
              </div>
            </div>
          </a>
          <a className="hero-item" href="#/perfil">
            <span className="level-chip num" aria-hidden="true">{d.level.level}</span>
            <div className="grow">
              <div className="row between">
                <span className="hero-level">{d.level.name}</span>
                <span className="tiny hero-dim num"><CountUp value={d.xpTotal} /> XP</span>
              </div>
              <Progress value={d.level.progress} label={`Progresso para o nível ${d.level.level + 1}`} />
              <div className="tiny hero-dim">{fmtInt(d.level.nextXp - d.xpTotal)} XP para o nível {d.level.level + 1}</div>
            </div>
          </a>
        </div>
      </section>

      <InstallCard compact />

      {empty && (
        <section className="section first-steps" aria-labelledby="fs">
          <h2 id="fs">Comece por aqui</h2>
          <p className="muted">Seu painel se preenche com atividades reais. Escolha como registrar a primeira:</p>
          <div className="grid md-three">
            <a className="panel action-card" href="#/registrar">
              <MapPin size={22} aria-hidden="true" />
              <strong>Gravar com GPS</strong>
              <span className="small muted">Percurso, distância, ritmo e parciais em tempo real.</span>
            </a>
            <a className="panel action-card" href="#/registrar?modo=importar">
              <Upload size={22} aria-hidden="true" />
              <strong>Importar do relógio</strong>
              <span className="small muted">Garmin, Coros, Polar, Strava ou Apple Saúde (.FIT, .GPX, .TCX, export.zip).</span>
            </a>
            <a className="panel action-card" href="#/registrar?modo=manual">
              <Timer size={22} aria-hidden="true" />
              <strong>Registrar manualmente</strong>
              <span className="small muted">Para atividades sem GPS. Vale metade do XP.</span>
            </a>
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="today-h">
        <div className="section-head">
          <h2 id="today-h">Hoje</h2>
          <a href={`#/dia/${today}`}>Ver o dia</a>
        </div>
        <div className="grid two md-four metric-grid">
          <a className="panel metric" href={`#/dia/${today}`}>
            <span className="metric-label"><RouteIcon size={15} aria-hidden="true" /> Distância</span>
            <span className="num metric-value"><CountUp value={(t?.distanceM ?? 0) / 1000} decimals={2} /><small>km</small></span>
            <span className="tiny faint">GPS, arquivos e registros manuais</span>
          </a>
          <a className="panel metric" href={`#/dia/${today}`}>
            <span className="metric-label"><Timer size={15} aria-hidden="true" /> Tempo ativo</span>
            <span className="num metric-value"><CountUp value={Math.round(minutes)} /><small>min</small></span>
            <span className="tiny faint">{t?.count ?? 0} {t?.count === 1 ? 'atividade' : 'atividades'}</span>
          </a>
          <a className="panel metric" href="#/dispositivos">
            <span className="metric-label"><Footprints size={15} aria-hidden="true" /> Passos</span>
            {steps ? (
              <span className="num metric-value"><CountUp value={steps.value} /></span>
            ) : (
              <span className="metric-value metric-na">Sem passos</span>
            )}
            <span className="tiny faint">
              {steps?.source === 'health' ? 'Apple Saúde' : steps?.source === 'sensor' ? 'Sensor deste celular' : steps?.source === 'estimate' ? 'Estimativa pela distância' : 'Ligue o contador em Dispositivos'}
            </span>
          </a>
          <a className="panel metric" href={hrActs.length ? `#/dia/${today}` : '#/dispositivos'}>
            <span className="metric-label"><HeartPulse size={15} aria-hidden="true" /> Freq. cardíaca</span>
            {hrActs.length ? (
              <span className="num metric-value">{Math.round(hrActs.reduce((s2, a) => s2 + a.avgHr!, 0) / hrActs.length)}<small>bpm méd.</small></span>
            ) : (
              <span className="metric-value metric-na">Sem sensor</span>
            )}
            <span className="tiny faint">{hrActs.length ? 'Medida durante as atividades' : 'Conecte um monitor Bluetooth'}</span>
          </a>
        </div>
        {calories !== null && todayActs.length > 0 && (
          <p className="small muted calories-line">
            Calorias em atividades: <span className="num">{fmtInt(calories)} kcal</span> <EstimateBadge text="Estimativa pelo peso e duração" />
          </p>
        )}
      </section>

      <section className="section" aria-labelledby="week-h">
        <div className="section-head">
          <h2 id="week-h">Esta semana</h2>
          <a href="#/estatisticas">Estatísticas</a>
        </div>
        <div className="panel">
          <div className="row wrap week-totals">
            <div><span className="num big">{Math.round(weekMin)}</span> <span className="muted small">min ativos</span></div>
            <div><span className="num big">{km(weekKm)}</span> <span className="muted small">km</span></div>
            <div><span className="num big">{d.streak.activeThisWeek}</span> <span className="muted small">dias ativos</span></div>
          </div>
          <BarChart
            label="Minutos ativos por dia nesta semana"
            height={110}
            goal={s.dailyGoalMin}
            bars={week.map((day) => {
              const v = d.totals.get(day)?.minutes ?? 0
              return {
                key: day,
                label: ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'][week.indexOf(day)],
                value: v,
                title: `${fmtDateLong(day)}: ${Math.round(v)} min`,
                highlight: day === today,
              }
            })}
            onSelect={(day) => navigate(`/dia/${day}`)}
          />
        </div>
      </section>

      <div className="grid lg-split">
        <div>
          {last && (
            <section className="section" aria-labelledby="last-h">
              <div className="section-head">
                <h2 id="last-h">Última atividade</h2>
                <a href="#/historico">Histórico</a>
              </div>
              <div className="panel flush list"><ActivityRow a={last} /></div>
            </section>
          )}

          <section className="section" aria-labelledby="mis-h">
            <div className="section-head">
              <h2 id="mis-h">Missões em andamento</h2>
              <a href="#/missoes">Todas</a>
            </div>
            <div className="panel flush list">
              {missions.map((m) => (
                <a key={m.def.id} className="list-item" href="#/missoes">
                  <div className="grow stack tight">
                    <div className="row between">
                      <span className="title">{m.def.title}</span>
                      <span className="tiny muted num">+{m.def.xp} XP</span>
                    </div>
                    <span className="meta">{describeMission(m)}</span>
                    <Progress value={m.value / m.target} label={`${m.def.title}: ${Math.floor(m.value)} de ${m.target}`} />
                  </div>
                </a>
              ))}
              {missions.length === 0 && <div className="list-item muted">Todas as missões do período foram concluídas.</div>}
            </div>
          </section>
        </div>

        <div>
          <section className="section" aria-labelledby="up-h">
            <div className="section-head">
              <h2 id="up-h">Próximas atividades</h2>
              <a href="#/calendario">Calendário</a>
            </div>
            <div className="panel flush list">
              {upcoming.map((e) => (
                <a key={e.id} className="list-item" href={`#/evento/${e.id}`}>
                  <span className="sport-icon"><Users size={18} aria-hidden="true" /></span>
                  <div className="grow">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="title ellipsis">{e.title}</span>
                      {e.origin === 'demo' && <span className="badge demo">Demonstração</span>}
                      {e.going && <span className="badge ok">Vou</span>}
                    </div>
                    <div className="meta">{new Date(e.startsAt).toLocaleString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {e.meetingPoint.name}</div>
                  </div>
                  <ChevronRight size={18} className="faint" aria-hidden="true" />
                </a>
              ))}
              {nextPlans.map((p) => (
                <a key={p.id} className="list-item" href={`#/dia/${p.date}`}>
                  <SportIcon sport={p.sport} />
                  <div className="grow">
                    <div className="title">Treino planejado · {p.targetMin} min</div>
                    <div className="meta">{fmtDateLong(p.date)} · {p.time}</div>
                  </div>
                </a>
              ))}
              {upcoming.length + nextPlans.length === 0 && (
                <div className="list-item">
                  <div className="grow">
                    <div className="title">Nada agendado</div>
                    <div className="meta">Planeje um treino no calendário ou encontre um grupo.</div>
                  </div>
                  <a className="btn sm" href="#/calendario">Planejar</a>
                </div>
              )}
            </div>
          </section>

          <section className="section" aria-labelledby="ach-h">
            <div className="section-head">
              <h2 id="ach-h">Conquistas recentes</h2>
              <a href="#/conquistas">Todas</a>
            </div>
            <div className="panel flush list">
              {recentAch.map((a) => (
                <a key={a.def.id} className="list-item" href="#/conquistas">
                  <span className="medal" aria-hidden="true"><Award size={18} /></span>
                  <div className="grow">
                    <div className="title">{a.def.title}</div>
                    <div className="meta">{new Date(a.unlockedAt!).toLocaleDateString('pt-BR')} · {fmtTime(a.unlockedAt!)}</div>
                  </div>
                </a>
              ))}
              {recentAch.length === 0 && <div className="list-item muted small">A primeira conquista chega com a primeira atividade válida (5 minutos ou mais).</div>}
            </div>
          </section>

          <section className="section" aria-labelledby="rt-h">
            <div className="section-head">
              <h2 id="rt-h">Suas rotas</h2>
              <a href="#/mapa">Mapa</a>
            </div>
            <div className="panel flush list">
              {routes.slice(0, 3).map((r) => (
                <a key={r.id} className="list-item" href={`#/mapa?rota=${r.id}`}>
                  <SportIcon sport={r.sport} />
                  <div className="grow">
                    <div className="title">{r.name}</div>
                    <div className="meta">{km(r.distanceM)} km planejados · {r.followsStreets ? 'pelas ruas' : 'linha reta'}</div>
                  </div>
                </a>
              ))}
              {routes.length === 0 && (
                <div className="list-item">
                  <div className="grow">
                    <div className="title">Nenhuma rota salva</div>
                    <div className="meta">Planeje um percurso no mapa para reutilizar e compartilhar em encontros.</div>
                  </div>
                  <a className="btn sm" href="#/mapa">Planejar</a>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {!empty && (
        <p className="tiny faint section">
          Tempo ativo e distância de hoje: {duration(todayActs.reduce((x, a) => x + activeMinutes(a) * 60, 0))}. Atividades repetidas de outra fonte não são somadas duas vezes.{' '}
          <a href="#/dispositivos"><Watch size={12} aria-hidden="true" /> Fontes de dados</a>
        </p>
      )}
    </div>
  )
}
