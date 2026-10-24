import { CalendarDays, HardDrive, MapPin, Watch } from 'lucide-react'
import { useState } from 'react'
import { SPORTS, SPORT_LABEL } from '../domain/activity'
import type { FitnessLevel, Privacy, Sport, StreakRule } from '../domain/types'
import { updateSettings } from '../services/actions'
import { useApp } from '../services/store'
import { Logo } from '../ui/Logo'
import { SPORT_ICON } from '../ui/components'

export const LEVELS: { value: FitnessLevel; label: string; text: string }[] = [
  { value: 'beginner', label: 'Começando', text: 'Pouca atividade nas últimas semanas. Missões mais curtas.' },
  { value: 'intermediate', label: 'Em ritmo', text: 'Algumas atividades por semana.' },
  { value: 'advanced', label: 'Constante', text: 'Treina com frequência e quer desafios maiores.' },
]

export const PRIVACY_LABEL: Record<Privacy, string> = {
  private: 'Somente eu',
  followers: 'Seguidores',
  public: 'Toda a comunidade',
}

const GOALS = [10, 20, 30, 45, 60]

export function Onboarding() {
  const s = useApp((x) => x.settings)
  const [step, setStep] = useState(0)
  const [name, setName] = useState(s.displayName)
  const [sports, setSports] = useState<Sport[]>(s.favoriteSports)
  const [fitness, setFitness] = useState<FitnessLevel>(s.fitness)
  const [goal, setGoal] = useState(s.dailyGoalMin)
  const [rule, setRule] = useState<StreakRule>(s.streakRule)
  const [privacy, setPrivacy] = useState<Privacy>(s.defaultPrivacy)

  const toggle = (sp: Sport) => setSports((cur) => (cur.includes(sp) ? cur.filter((x) => x !== sp) : [...cur, sp]))

  const finish = () =>
    updateSettings({
      displayName: name.trim(),
      favoriteSports: sports.length ? sports : ['walk'],
      fitness,
      fitnessLog: [{ from: '2000-01-01', level: fitness }],
      dailyGoalMin: goal,
      streakRule: rule,
      defaultPrivacy: privacy,
      onboarded: true,
    })

  const steps = ['Boas-vindas', 'Modalidades', 'Meta', 'Privacidade']

  return (
    <div className="onboarding">
      <div className="onb-card">
        <div className="row between">
          <Logo size={44} />
          <span className="small faint">
            Etapa {step + 1} de {steps.length}
          </span>
        </div>
        <div className="onb-progress" aria-hidden="true">
          {steps.map((_, i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>

        {step === 0 && (
          <section className="stack loose" aria-labelledby="onb-0">
            <div className="stack tight">
              <h1 id="onb-0">Movimento com companhia e propósito</h1>
              <p className="muted">
                A Move+ registra suas caminhadas e corridas, acompanha sua constância e transforma cada atividade em progresso. No seu ritmo, sozinho ou em grupo.
              </p>
            </div>
            <ul className="onb-points">
              <li><strong>Registre</strong> atividades com GPS, importe do relógio ou anote manualmente.</li>
              <li><strong>Evolua</strong> com sequência de dias ativos, XP, níveis, missões e conquistas.</li>
              <li><strong>Encontre companhia</strong> em grupos e encontros com informações de acessibilidade.</li>
            </ul>
            <label className="field">
              <span>Como podemos chamar você?</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome ou apelido (opcional)" maxLength={40} autoComplete="nickname" />
            </label>
          </section>
        )}

        {step === 1 && (
          <section className="stack loose" aria-labelledby="onb-1">
            <div className="stack tight">
              <h1 id="onb-1">O que você gosta de fazer?</h1>
              <p className="muted">Escolha uma ou mais modalidades. Você pode registrar qualquer uma a qualquer momento.</p>
            </div>
            <div className="sport-picker" role="group" aria-label="Modalidades favoritas">
              {SPORTS.map((sp) => {
                const I = SPORT_ICON[sp]
                return (
                  <button key={sp} type="button" className="sport-option" aria-pressed={sports.includes(sp)} onClick={() => toggle(sp)}>
                    <I size={22} aria-hidden="true" />
                    <span>{SPORT_LABEL[sp]}</span>
                  </button>
                )
              })}
            </div>
            <fieldset className="stack tight">
              <legend className="field-legend">Como está a sua rotina de atividade hoje?</legend>
              {LEVELS.map((l) => (
                <label key={l.value} className={`option-row${fitness === l.value ? ' on' : ''}`}>
                  <input type="radio" name="fitness" checked={fitness === l.value} onChange={() => setFitness(l.value)} />
                  <div>
                    <div className="title">{l.label}</div>
                    <div className="small muted">{l.text}</div>
                  </div>
                </label>
              ))}
              <p className="tiny faint">Serve apenas para ajustar o tamanho das missões. Nenhuma informação médica é pedida.</p>
            </fieldset>
          </section>
        )}

        {step === 2 && (
          <section className="stack loose" aria-labelledby="onb-2">
            <div className="stack tight">
              <h1 id="onb-2">Sua meta diária</h1>
              <p className="muted">Minutos ativos por dia. Comece pequeno: constância vale mais que intensidade.</p>
            </div>
            <div className="row wrap" role="group" aria-label="Meta diária em minutos">
              {GOALS.map((g) => (
                <button key={g} type="button" className="chip goal-chip" aria-pressed={goal === g} onClick={() => setGoal(g)}>
                  {g} min
                </button>
              ))}
            </div>
            <fieldset className="stack tight">
              <legend className="field-legend">O que mantém a sua sequência de dias ativos?</legend>
              <label className={`option-row${rule.kind === 'activity' ? ' on' : ''}`}>
                <input type="radio" name="rule" checked={rule.kind === 'activity'} onChange={() => setRule({ kind: 'activity', minMinutes: 10 })} />
                <div>
                  <div className="title">Uma atividade de pelo menos 10 minutos</div>
                  <div className="small muted">Recomendado. Uma caminhada curta já conta.</div>
                </div>
              </label>
              <label className={`option-row${rule.kind === 'goal' ? ' on' : ''}`}>
                <input type="radio" name="rule" checked={rule.kind === 'goal'} onChange={() => setRule({ kind: 'goal' })} />
                <div>
                  <div className="title">Alcançar a meta diária ({goal} min)</div>
                  <div className="small muted">Somando todas as atividades do dia.</div>
                </div>
              </label>
              <p className="tiny faint">A sequência só conta dias com atividades registradas. Abrir o app não conta. Você pode mudar a regra em Ajustes.</p>
            </fieldset>
          </section>
        )}

        {step === 3 && (
          <section className="stack loose" aria-labelledby="onb-3">
            <div className="stack tight">
              <h1 id="onb-3">Privacidade e permissões</h1>
              <p className="muted">Nada é pedido agora. Cada permissão aparece só quando você usar o recurso, com a explicação do motivo.</p>
            </div>
            <ul className="perm-list">
              <li><MapPin size={20} aria-hidden="true" /><div><strong>Localização</strong><span>Usada para gravar o percurso e mostrar você no mapa. Pedida quando você ativar o GPS.</span></div></li>
              <li><CalendarDays size={20} aria-hidden="true" /><div><strong>Calendário</strong><span>A Move+ tem calendário próprio. Para levar encontros ao calendário do celular, você exporta um arquivo. Seus eventos pessoais nunca são lidos.</span></div></li>
              <li><Watch size={20} aria-hidden="true" /><div><strong>Relógios e saúde</strong><span>Opcionais, em Dispositivos: contador de passos do celular, monitor cardíaco Bluetooth, arquivos de relógio e a exportação do Apple Saúde.</span></div></li>
              <li><HardDrive size={20} aria-hidden="true" /><div><strong>Seus dados</strong><span>Nesta versão ficam apenas neste aparelho. Você pode exportar ou apagar tudo quando quiser.</span></div></li>
            </ul>
            <label className="field">
              <span>Quem pode ver suas atividades por padrão</span>
              <select className="input" value={privacy} onChange={(e) => setPrivacy(e.target.value as Privacy)}>
                {(Object.keys(PRIVACY_LABEL) as Privacy[]).map((p) => (
                  <option key={p} value={p}>{PRIVACY_LABEL[p]}</option>
                ))}
              </select>
            </label>
          </section>
        )}

        <div className="row between onb-actions">
          {step > 0 ? (
            <button className="btn ghost" onClick={() => setStep(step - 1)}>Voltar</button>
          ) : (
            <span />
          )}
          {step < steps.length - 1 ? (
            <button className="btn primary" onClick={() => setStep(step + 1)}>Continuar</button>
          ) : (
            <button className="btn accent" onClick={finish}>Entrar na Move+</button>
          )}
        </div>
      </div>
    </div>
  )
}
