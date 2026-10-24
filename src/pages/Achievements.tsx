import { Award, Lock } from 'lucide-react'
import type { AchievementCategory } from '../domain/achievements'
import { fmtInt } from '../domain/format'
import { useDerived } from '../services/store'
import { PageHead, Progress } from '../ui/components'

const CATEGORY: Record<AchievementCategory, string> = {
  inicio: 'Primeiros passos',
  distancia: 'Distância',
  sequencia: 'Sequência',
  consistencia: 'Consistência',
  grupo: 'Em grupo',
  metas: 'Metas',
  recordes: 'Recordes',
}

export function AchievementsPage() {
  const d = useDerived()
  const unlocked = d.achievements.filter((a) => a.unlockedAt).length
  const cats = [...new Set(d.achievements.map((a) => a.def.category))]
  return (
    <div>
      <PageHead title="Conquistas" subtitle={`${unlocked} de ${d.achievements.length} desbloqueadas.`} actions={<a className="btn sm" href="#/missoes">Missões</a>} />
      {cats.map((c) => (
        <section key={c} className="section" style={{ marginTop: 20 }}>
          <h2 className="section-head">{CATEGORY[c]}</h2>
          <div className="grid two md-three">
            {d.achievements.filter((a) => a.def.category === c).map((a) => {
              const on = a.unlockedAt !== null
              return (
                <article key={a.def.id} className={`panel medal-card${on ? ' on' : ''}`} aria-label={`${a.def.title}: ${on ? 'desbloqueada' : 'bloqueada'}`}>
                  <span className="medal big" aria-hidden="true">{on ? <Award size={22} /> : <Lock size={18} />}</span>
                  <h3>{a.def.title}</h3>
                  <p className="small muted">{a.def.description}</p>
                  {on ? (
                    <p className="tiny">Desbloqueada em {new Date(a.unlockedAt!).toLocaleDateString('pt-BR')} · <span className="accent-num">+{a.def.xp} XP</span></p>
                  ) : (
                    <>
                      <Progress value={a.value / a.def.target} label={`Progresso de ${a.def.title}`} />
                      <p className="tiny faint">{a.def.category === 'distancia' && a.def.target > 1 ? `${a.value.toFixed(1).replace('.', ',')} de ${a.def.target} km` : `${fmtInt(Math.floor(a.value))} de ${a.def.target}`} · +{a.def.xp} XP</p>
                    </>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
