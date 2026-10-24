import { Check, Users, User } from 'lucide-react'
import { useState } from 'react'
import { diffDays } from '../domain/dates'
import { fmtDateShort } from '../domain/format'
import { describeMission, seasonName, type MissionPeriod } from '../domain/missions'
import { XP_RULES } from '../domain/xp'
import { useApp, useDerived } from '../services/store'
import { PageHead, Progress } from '../ui/components'
import { LEVELS } from './Onboarding'

const TABS: { value: MissionPeriod; label: string }[] = [
  { value: 'daily', label: 'Diárias' },
  { value: 'weekly', label: 'Semanais' },
  { value: 'season', label: 'Temporada' },
]

export function MissionsPage() {
  const d = useDerived()
  const today = useApp((s) => s.today)
  const fitness = useApp((s) => s.settings.fitness)
  const [tab, setTab] = useState<MissionPeriod>('daily')
  const list = d.missions.filter((m) => m.def.period === tab)
  const done = d.missions.filter((m) => m.done).length

  return (
    <div>
      <PageHead title="Missões" subtitle={`${done} de ${d.missions.length} concluídas nos períodos atuais.`} actions={<a className="btn sm" href="#/conquistas">Conquistas</a>} />
      <div className="tabs" role="tablist" aria-label="Período das missões">
        {TABS.map((t) => (
          <button key={t.value} role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)}>{t.label}</button>
        ))}
      </div>
      {list[0] && (
        <p className="small muted" style={{ marginBottom: 12 }}>
          {tab === 'daily' ? 'Renovam à meia-noite (horário do aparelho).' : tab === 'weekly' ? `Semana de ${fmtDateShort(list[0].range[0])} a ${fmtDateShort(list[0].range[1])} · faltam ${diffDays(today, list[0].range[1]) + 1} dias.` : `${seasonName(list[0].key)} · até ${fmtDateShort(list[0].range[1])}.`}
        </p>
      )}
      <div className="grid md-two">
        {list.map((m) => (
          <article key={m.def.id} className={`panel mission${m.done ? ' done' : ''}`}>
            <div className="row between">
              <span className="badge">{m.def.scope === 'collective' ? <><Users size={12} aria-hidden="true" /> Coletiva</> : <><User size={12} aria-hidden="true" /> Individual</>}</span>
              <span className="num accent-num">+{m.def.xp} XP</span>
            </div>
            <h3>{m.def.title}</h3>
            <p className="small muted">{describeMission(m)}</p>
            <Progress value={m.value / m.target} label={`${m.def.title}: progresso`} />
            <div className="row between small">
              <span className="num">{m.def.metric === 'distanceKm' ? m.value.toFixed(1).replace('.', ',') : Math.floor(m.value)} / {m.target}{m.def.metric === 'distanceKm' ? ' km' : m.def.metric === 'minutes' ? ' min' : ''}</span>
              {m.done && <span className="badge ok"><Check size={12} aria-hidden="true" /> Concluída</span>}
            </div>
          </article>
        ))}
      </div>

      <section className="section">
        <h2 className="section-head">Como as missões se adaptam</h2>
        <div className="panel stack tight small muted">
          <p>Os alvos seguem o seu condicionamento atual: <strong>{LEVELS.find((l) => l.value === fitness)?.label}</strong>. Você pode mudar em <a href="#/ajustes">Ajustes</a>; períodos já encerrados mantêm o alvo da época.</p>
          <p>Todas as missões aceitam qualquer modalidade, inclusive cadeira de rodas, e premiam regularidade, não velocidade. Missões coletivas contam encontros em grupo com presença confirmada.</p>
        </div>
      </section>

      <section className="section">
        <h2 className="section-head">Regras de XP</h2>
        <ul className="panel bullets small">
          {XP_RULES.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </section>
    </div>
  )
}
