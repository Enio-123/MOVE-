import { Bluetooth, Heart, FileUp, Footprints, HeartPulse, Pause, Play, Smartphone, Trash2, Watch } from 'lucide-react'
import { useState } from 'react'
import { relative } from '../domain/format'
import { clearStepLog, deleteActivity, importAppleHealth, removeHealthData } from '../services/actions'
import { useHeartRate } from '../services/gps'
import { AUTO_SYNC } from '../services/health'
import { heartRate } from '../services/heartRate'
import { pedometer, usePedometer } from '../services/pedometer'
import { useApp } from '../services/store'
import { Notice, PageHead } from '../ui/components'
import { CountUp } from '../ui/motion'

function Card({ icon: I, title, badge, tone, children }: { icon: typeof Watch; title: string; badge: string; tone: 'ok' | 'warn' | ''; children: React.ReactNode }) {
  return (
    <article className="panel stack tight device-card">
      <div className="row between">
        <div className="row"><span className="sport-icon"><I size={18} aria-hidden="true" /></span><strong>{title}</strong></div>
        <span className={`badge ${tone}`}>{badge}</span>
      </div>
      {children}
    </article>
  )
}

function StepCounter() {
  const ped = usePedometer()
  const today = useApp((s) => s.today)
  const todaySteps = useApp((s) => s.stepLog[s.today] ?? 0)
  const days = useApp((s) => Object.keys(s.stepLog).length)
  const counting = ped.status === 'on' && ped.reasons.includes('counter')
  const badge = ped.status === 'unsupported' ? 'Navegador sem suporte' : ped.status === 'no-sensor' ? 'Sem acelerômetro' : ped.status === 'denied' ? 'Permissão negada' : counting ? 'Contando' : 'Disponível'
  return (
    <Card icon={Footprints} title="Contador de passos do celular" badge={badge} tone={ped.status === 'unsupported' || ped.status === 'no-sensor' || ped.status === 'denied' ? 'warn' : 'ok'}>
      <p className="small muted">Usa o acelerômetro do celular para contar passos com o app aberto, no bolso ou na mão. Também liga sozinho nas gravações de caminhada, corrida e trilha.</p>
      <div className="step-live" aria-live="polite">
        <span className={`step-dot${counting ? ' on' : ''}`} aria-hidden="true" />
        <span className="num step-count"><CountUp value={todaySteps} duration={400} /></span>
        <span className="small muted">passos hoje ({today.split('-').reverse().join('/')})</span>
      </div>
      {ped.status === 'denied' && <Notice tone="warn">O iPhone pede permissão de “Movimento e orientação”. Toque em Iniciar de novo e permita; se não aparecer, feche e abra o Safari.</Notice>}
      {ped.status === 'no-sensor' && <Notice tone="warn">Este aparelho não enviou leituras de movimento. Computadores normalmente não têm acelerômetro: use no celular.</Notice>}
      <div className="row wrap device-actions">
        {counting ? (
          <button className="btn sm" onClick={() => pedometer.stop('counter')}><Pause size={14} aria-hidden="true" /> Pausar contador</button>
        ) : (
          <button className="btn primary sm" disabled={ped.status === 'unsupported'} onClick={() => void pedometer.start('counter')}><Play size={14} aria-hidden="true" /> Iniciar contador</button>
        )}
        {days > 0 && <button className="btn ghost sm" onClick={() => confirm('Apagar todos os passos contados por este celular?') && void clearStepLog()}><Trash2 size={14} aria-hidden="true" /> Apagar passos</button>}
      </div>
      <p className="tiny faint">Navegadores pausam o sensor com a tela bloqueada. Para contar o dia inteiro em segundo plano, use a importação do Apple Saúde ou o futuro app instalável.</p>
    </Card>
  )
}

function HeartRateCard() {
  const hr = useHeartRate()
  const supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator
  return (
    <Card icon={Bluetooth} title="Monitor cardíaco Bluetooth" badge={supported ? (hr.status === 'connected' ? 'Conectado' : 'Disponível') : 'Navegador sem suporte'} tone={supported ? 'ok' : 'warn'}>
      <p className="small muted">Conexão direta pelo perfil padrão Heart Rate: cintas (Polar H10, Garmin HRM, Wahoo TICKR) e relógios com transmissão de frequência cardíaca ligada.</p>
      {!supported && <p className="tiny faint">Funciona no Chrome ou Edge (Android, Windows, macOS, ChromeOS). Safari e iPhone não oferecem Web Bluetooth.</p>}
      {supported && (
        <div className="stack tight device-actions">
          {hr.status === 'connected' ? (
            <>
              <div className="row between">
                <span className="small">Conectado: <strong>{hr.deviceName}</strong></span>
                <span className="num big hr-live"><HeartPulse size={18} aria-hidden="true" /> {hr.bpm ?? '--'} <small className="muted">bpm</small></span>
              </div>
              {hr.contactDetected === false && <Notice tone="warn">O sensor informa que não há contato com a pele.</Notice>}
              <button className="btn sm" onClick={() => heartRate.disconnect()}>Desconectar</button>
              <p className="tiny faint">Durante a gravação, a frequência cardíaca é salva junto com o percurso.</p>
            </>
          ) : (
            <>
              <button className="btn primary sm" disabled={hr.status === 'connecting'} onClick={() => void heartRate.connect()}>
                {hr.status === 'connecting' ? 'Conectando…' : 'Procurar monitor cardíaco'}
              </button>
              {hr.status === 'disconnected' && <p className="tiny error-text">A conexão foi perdida. Aproxime o sensor e conecte de novo.</p>}
              {hr.status === 'error' && <p className="tiny error-text">Não foi possível conectar: {hr.error}</p>}
            </>
          )}
        </div>
      )}
    </Card>
  )
}

function WatchFiles() {
  const imported = useApp((s) => s.activities.filter((a) => a.source === 'import'))
  const last = imported.reduce((m, a) => Math.max(m, a.createdAt), 0)
  return (
    <Card icon={Watch} title="Relógios e outros apps" badge="Disponível" tone="ok">
      <p className="small muted">Garmin, Coros, Wahoo, Polar, Suunto, Amazfit e Strava: exporte a atividade como .FIT, .GPX ou .TCX e importe. Trajeto, ritmo, elevação e frequência cardíaca entram completos.</p>
      <div className="row between small">
        <span>{imported.length} {imported.length === 1 ? 'atividade importada' : 'atividades importadas'}</span>
        {last > 0 && <span className="muted">última {relative(last)}</span>}
      </div>
      <div className="row wrap device-actions">
        <a className="btn primary sm" href="#/registrar?modo=importar"><FileUp size={14} aria-hidden="true" /> Importar arquivos</a>
        {imported.length > 0 && (
          <button className="btn danger sm" onClick={async () => { if (confirm(`Apagar as ${imported.length} atividades importadas? XP, sequência e estatísticas serão recalculados.`)) for (const a of imported) await deleteActivity(a.id) }}>
            <Trash2 size={14} aria-hidden="true" /> Apagar importados
          </button>
        )}
      </div>
    </Card>
  )
}

function AppleHealthCard() {
  const workouts = useApp((s) => s.activities.filter((a) => a.source === 'health').length)
  const stepDays = useApp((s) => Object.keys(s.healthSteps).length)
  const [busy, setBusy] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const onFile = async (f?: File) => {
    if (!f) return
    setBusy(0)
    setMsg(null)
    try {
      const r = await importAppleHealth(f, setBusy)
      setMsg({ ok: true, text: `${r.added} ${r.added === 1 ? 'treino importado' : 'treinos importados'}${r.repeated ? ` (${r.repeated} já existiam)` : ''} e passos de ${r.stepDays} ${r.stepDays === 1 ? 'dia' : 'dias'}.` })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    }
    setBusy(null)
  }
  return (
    <Card icon={Heart} title="Apple Saúde e Apple Watch" badge={workouts || stepDays ? 'Importado' : 'Por exportação'} tone="ok">
      <p className="small muted">No iPhone: app Saúde › foto do perfil › Exportar todos os dados de saúde › salve o export.zip e selecione aqui. Entram treinos (caminhada, corrida, trilha, pedalada, cadeira de rodas) e os passos de cada dia do último ano.</p>
      {(workouts > 0 || stepDays > 0) && <p className="small">{workouts} {workouts === 1 ? 'treino' : 'treinos'} e passos de {stepDays} {stepDays === 1 ? 'dia' : 'dias'} importados.</p>}
      {busy != null && <div className="progress" role="progressbar" aria-label="Lendo exportação" aria-valuenow={Math.round(busy * 100)}><i style={{ width: `${busy * 100}%`, animation: 'none' }} /></div>}
      {msg && <Notice tone={msg.ok ? 'info' : 'err'}>{msg.text}</Notice>}
      <div className="row wrap device-actions">
        <label className={`btn primary sm${busy != null ? ' disabled' : ''}`}>
          <FileUp size={14} aria-hidden="true" /> {busy != null ? `Lendo… ${Math.round(busy * 100)}%` : 'Importar export.zip'}
          <input type="file" accept=".zip,.xml,application/zip,text/xml" className="sr-only" disabled={busy != null} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {(workouts > 0 || stepDays > 0) && <button className="btn danger sm" onClick={() => confirm('Remover todos os treinos e passos vindos do Apple Saúde?') && void removeHealthData()}><Trash2 size={14} aria-hidden="true" /> Remover dados do Apple Saúde</button>}
      </div>
      <p className="tiny faint">O arquivo é lido neste aparelho e não sai dele. Passos do iPhone e do relógio não são somados em dobro. Repita a exportação quando quiser atualizar.</p>
    </Card>
  )
}

export function DevicesPage() {
  const health = useApp((s) => s.activities.some((a) => a.source === 'health'))
  return (
    <div>
      <PageHead title="Dispositivos e saúde" subtitle="Conecte sensores, relógios e o Apple Saúde. Nada aqui é simulado." />
      <div className="grid md-two">
        <StepCounter />
        <AppleHealthCard />
        <WatchFiles />
        <HeartRateCard />
      </div>

      <h2 className="section section-head">Sincronização automática</h2>
      <p className="small muted" style={{ marginBottom: 12 }}>Leitura contínua, sem precisar exportar, depende de partes que um site não pode ter. Enquanto isso, as opções acima trazem os mesmos dados.</p>
      <div className="panel flush">
        <ul className="list">
          {AUTO_SYNC.map((s) => (
            <li key={s.id} className="list-item">
              <span className="sport-icon"><Smartphone size={18} aria-hidden="true" /></span>
              <div className="grow">
                <div className="title">{s.name}</div>
                <div className="meta">{s.requirement}</div>
              </div>
              <span className="badge">{s.badge}</span>
            </li>
          ))}
        </ul>
      </div>

      <section className="section panel stack tight small muted">
        <h3 style={{ color: 'var(--text)' }}>Como os dados são combinados</h3>
        <p>Cada atividade mostra a origem (GPS, arquivo, Apple Saúde ou manual). Se o mesmo treino chegar por duas fontes, a Move+ reconhece a sobreposição de horário e conta uma vez, priorizando a mais precisa: GPS, arquivo, Apple Saúde, manual.</p>
        <p>Passos: o Apple Saúde tem prioridade{health ? ' (já importado)' : ''}; sem ele, valem os passos do sensor deste celular; sem nenhum dos dois, aparece uma estimativa pela distância das atividades a pé, sempre identificada.</p>
      </section>
    </div>
  )
}
