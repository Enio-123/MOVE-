import { Download, PlayCircle, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import type { NotificationKind, Privacy, Settings } from '../domain/types'
import { exportAll, importBackup, toast, updateSettings, wipeAll } from '../services/actions'
import { useApp } from '../services/store'
import { download, Notice, PageHead, Segmented, Switch } from '../ui/components'
import { navigate } from '../ui/router'
import { LEVELS, PRIVACY_LABEL } from './Onboarding'

const KIND_LABEL: Record<NotificationKind, string> = {
  goal: 'Metas e sequência',
  mission: 'Missões',
  xp: 'XP e nível',
  achievement: 'Conquistas',
  event: 'Encontros',
  sync: 'Importações e sincronização',
  reminder: 'Lembretes de treino',
}

export function SettingsPage() {
  const s = useApp((x) => x.settings)
  const set = (p: Partial<Settings>) => void updateSettings(p)
  const [weight, setWeight] = useState(s.weightKg ? String(s.weightKg) : '')
  const [goal, setGoal] = useState(String(s.dailyGoalMin))
  const notifSupported = typeof Notification !== 'undefined'

  const askSystem = async (on: boolean) => {
    if (!on) return set({ reminders: { ...s.reminders, system: false } })
    if (!notifSupported) return toast({ kind: 'error', title: 'Este navegador não oferece notificações do sistema' })
    const r = await Notification.requestPermission()
    if (r === 'granted') set({ reminders: { ...s.reminders, system: true } })
    else toast({ kind: 'error', title: 'Permissão de notificações negada', detail: 'Os avisos continuam dentro do app.' })
  }

  return (
    <div className="settings">
      <PageHead title="Ajustes e privacidade" />

      <section className="panel stack">
        <h2>Aparência e acessibilidade</h2>
        <div className="row between wrap"><span>Tema</span>
          <Segmented<Settings['theme']> label="Tema" value={s.theme} onChange={(v) => set({ theme: v })} options={[{ value: 'dark', label: 'Escuro' }, { value: 'light', label: 'Claro' }, { value: 'system', label: 'Sistema' }]} />
        </div>
        <div className="row between wrap"><span>Tamanho do texto</span>
          <Segmented<string> label="Tamanho do texto" value={String(s.textScale)} onChange={(v) => set({ textScale: Number(v) as Settings['textScale'] })} options={[{ value: '1', label: 'Padrão' }, { value: '1.15', label: 'Maior' }, { value: '1.3', label: 'Muito maior' }]} />
        </div>
        <div className="row between wrap"><span>Animações</span>
          <Segmented<Settings['reduceMotion']> label="Animações" value={s.reduceMotion} onChange={(v) => set({ reduceMotion: v })} options={[{ value: 'system', label: 'Do sistema' }, { value: 'on', label: 'Reduzidas' }, { value: 'off', label: 'Completas' }]} />
        </div>
        <Switch checked={s.highContrast} onChange={(v) => set({ highContrast: v })} label="Alto contraste" description="Textos secundários e bordas mais fortes." />
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/intro')}><PlayCircle size={16} aria-hidden="true" /> Rever a introdução</button>
      </section>

      <section className="panel stack section">
        <h2>Metas e sequência</h2>
        <label className="field">
          <span>Meta diária (minutos ativos)</span>
          <div className="row">
            <input className="input" style={{ maxWidth: 120 }} inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} onBlur={() => { const g = Number(goal); if (Number.isInteger(g) && g >= 5 && g <= 240) set({ dailyGoalMin: g }); else setGoal(String(s.dailyGoalMin)) }} aria-describedby="goal-hint" />
            <span className="small muted" id="goal-hint">entre 5 e 240</span>
          </div>
        </label>
        <fieldset className="stack tight">
          <legend className="field-legend">Regra da sequência de dias ativos</legend>
          <label className={`option-row${s.streakRule.kind === 'activity' ? ' on' : ''}`}>
            <input type="radio" name="rule" checked={s.streakRule.kind === 'activity'} onChange={() => set({ streakRule: { kind: 'activity', minMinutes: 10 } })} />
            <div className="grow">
              <div className="title">Uma atividade com duração mínima</div>
              {s.streakRule.kind === 'activity' && (
                <select className="input" style={{ marginTop: 6, maxWidth: 200 }} value={s.streakRule.minMinutes} onChange={(e) => set({ streakRule: { kind: 'activity', minMinutes: Number(e.target.value) } })} aria-label="Duração mínima">
                  {[5, 10, 15, 20, 30].map((m) => <option key={m} value={m}>{m} minutos</option>)}
                </select>
              )}
            </div>
          </label>
          <label className={`option-row${s.streakRule.kind === 'goal' ? ' on' : ''}`}>
            <input type="radio" name="rule" checked={s.streakRule.kind === 'goal'} onChange={() => set({ streakRule: { kind: 'goal' } })} />
            <div><div className="title">Alcançar a meta diária</div><div className="small muted">Somando as atividades do dia.</div></div>
          </label>
          <p className="tiny faint">Mudar a regra recalcula a sequência e o XP de bônus com base no histórico.</p>
        </fieldset>
        <label className="field">
          <span>Condicionamento (ajusta o tamanho das missões)</span>
          <select className="input" value={s.fitness} onChange={(e) => set({ fitness: e.target.value as Settings['fitness'] })}>
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}: {l.text}</option>)}
          </select>
        </label>
      </section>

      <section className="panel stack section">
        <h2>Privacidade</h2>
        <label className="field">
          <span>Visibilidade padrão das atividades</span>
          <select className="input" value={s.defaultPrivacy} onChange={(e) => set({ defaultPrivacy: e.target.value as Privacy })}>
            {(Object.keys(PRIVACY_LABEL) as Privacy[]).map((p) => <option key={p} value={p}>{PRIVACY_LABEL[p]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Peso (opcional, kg)</span>
          <input className="input" style={{ maxWidth: 140 }} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} onBlur={() => { const w = Number(weight.replace(',', '.')); if (!weight.trim()) set({ weightKg: null }); else if (w >= 25 && w <= 300) set({ weightKg: w }); else setWeight(s.weightKg ? String(s.weightKg) : '') }} />
          <span className="hint">Usado apenas para estimar calorias, sempre exibidas como estimativa. Deixe vazio para não estimar.</span>
        </label>
        <Notice>
          Localização é pedida só ao gravar ou ao mostrar sua posição no mapa. Seus percursos, fotos e dados de saúde ficam neste navegador e não são enviados a servidores da Move+. Mapas e busca de lugares usam serviços do OpenStreetMap, que recebem as áreas do mapa e os termos pesquisados.
        </Notice>
      </section>

      <section className="panel stack section">
        <h2>Notificações e lembretes</h2>
        <Switch checked={s.reminders.enabled} onChange={(v) => set({ reminders: { ...s.reminders, enabled: v } })} label="Lembrete diário" description="Aviso gentil no horário escolhido, somente se você ainda não se movimentou no dia." />
        {s.reminders.enabled && (
          <label className="field"><span>Horário</span><input className="input" style={{ maxWidth: 140 }} type="time" value={s.reminders.time} onChange={(e) => set({ reminders: { ...s.reminders, time: e.target.value } })} /></label>
        )}
        <Switch checked={s.reminders.system} onChange={(v) => void askSystem(v)} label="Notificações do sistema" description={notifSupported ? 'Mostra os avisos também fora do app, enquanto ele estiver aberto. Sem servidor de push, não há avisos com o app fechado.' : 'Não suportado neste navegador.'} />
        <div className="stack tight">
          <span className="field-legend">Categorias</span>
          {(Object.keys(KIND_LABEL) as NotificationKind[]).map((k) => (
            <Switch key={k} checked={s.reminders.categories[k]} onChange={(v) => set({ reminders: { ...s.reminders, categories: { ...s.reminders.categories, [k]: v } } })} label={KIND_LABEL[k]} />
          ))}
        </div>
      </section>

      <section className="panel stack section">
        <h2>Seus dados (LGPD)</h2>
        <p className="small muted">Você tem controle total: exporte uma cópia, restaure em outro aparelho ou apague tudo. Nesta versão os dados não são sincronizados entre aparelhos.</p>
        <div className="row wrap">
          <button className="btn sm" onClick={async () => download(`moveplus-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportAll())}><Download size={16} aria-hidden="true" /> Exportar meus dados</button>
          <label className="btn sm">
            <Upload size={16} aria-hidden="true" /> Restaurar backup
            <input type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try { toast({ kind: 'info', title: 'Backup restaurado', detail: await importBackup(await f.text()) }) } catch (err) { toast({ kind: 'error', title: 'Não foi possível restaurar', detail: err instanceof Error ? err.message : String(err) }) }
            }} />
          </label>
        </div>
        <button
          className="btn danger"
          style={{ alignSelf: 'flex-start' }}
          onClick={async () => {
            if (!confirm('Apagar TODOS os dados da Move+ deste aparelho? Atividades, percursos, fotos, XP e configurações serão removidos.')) return
            if (prompt('Para confirmar, digite APAGAR') !== 'APAGAR') return
            await wipeAll()
            location.hash = '#/'
            location.reload()
          }}
        >
          <Trash2 size={16} aria-hidden="true" /> Apagar conta e todos os dados
        </button>
      </section>

      <section className="section small muted stack tight">
        <p>Move+ versão {__APP_VERSION__}. Marca provisória, a ser substituída pela logo oficial.</p>
        <p>Mapas © colaboradores do OpenStreetMap (ODbL). Busca: Nominatim. Roteamento a pé: FOSSGIS/OSRM.</p>
      </section>
    </div>
  )
}
