import { Bluetooth, FileUp, HeartPulse, Smartphone, Trash2, Watch } from 'lucide-react'
import { relative } from '../domain/format'
import { deleteActivity } from '../services/actions'
import { useHeartRate } from '../services/gps'
import { AVAILABILITY_LABEL, HEALTH_SOURCES, type HealthSourceInfo } from '../services/health'
import { heartRate } from '../services/heartRate'
import { useApp } from '../services/store'
import { Notice, PageHead } from '../ui/components'

const ICON = { bluetooth: Bluetooth, file: FileUp, platform: Smartphone, vendor: Watch } as const

export function DevicesPage() {
  const hr = useHeartRate()
  const imported = useApp((s) => s.activities.filter((a) => a.source === 'import'))
  const lastImport = imported.reduce((m, a) => Math.max(m, a.createdAt), 0)

  const card = (src: HealthSourceInfo) => {
    const av = src.availability()
    const I = ICON[src.kind]
    return (
      <article key={src.id} className="panel stack tight device-card">
        <div className="row between">
          <div className="row"><span className="sport-icon"><I size={18} aria-hidden="true" /></span><strong>{src.name}</strong></div>
          <span className={`badge ${av === 'available' ? 'ok' : av === 'unsupported-browser' ? 'warn' : ''}`}>{AVAILABILITY_LABEL[av]}</span>
        </div>
        <p className="small muted">{src.how}</p>
        <p className="tiny faint"><strong>Dados:</strong> {src.data.join(', ')}.</p>
        <p className="tiny faint"><strong>Requisito:</strong> {src.requirement}</p>

        {src.id === 'ble-hr' && av === 'available' && (
          <div className="stack tight device-actions">
            {hr.status === 'connected' ? (
              <>
                <div className="row between">
                  <span className="small">Conectado: <strong>{hr.deviceName}</strong></span>
                  <span className="num big"><HeartPulse size={18} className="accent" aria-hidden="true" /> {hr.bpm ?? '--'} <small className="muted">bpm</small></span>
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
                <p className="tiny faint">O navegador mostra a lista de aparelhos próximos. Para revogar o acesso depois, remova o dispositivo nas configurações de site do navegador.</p>
              </>
            )}
          </div>
        )}

        {src.id === 'file' && (
          <div className="stack tight device-actions">
            <div className="row between small">
              <span>{imported.length} {imported.length === 1 ? 'atividade importada' : 'atividades importadas'}</span>
              {lastImport > 0 && <span className="muted">última {relative(lastImport)}</span>}
            </div>
            <div className="row wrap">
              <a className="btn primary sm" href="#/registrar?modo=importar">Importar arquivo</a>
              {imported.length > 0 && (
                <button className="btn danger sm" onClick={async () => { if (confirm(`Apagar as ${imported.length} atividades importadas? XP, sequência e estatísticas serão recalculados.`)) for (const a of imported) await deleteActivity(a.id) }}>
                  <Trash2 size={14} aria-hidden="true" /> Apagar importados
                </button>
              )}
            </div>
          </div>
        )}
      </article>
    )
  }

  return (
    <div>
      <PageHead title="Dispositivos e saúde" subtitle="Fontes de dados de atividade e o que cada uma exige." />
      <Notice>
        Nenhuma conexão é simulada. Um site comum não tem acesso livre aos dados de saúde do celular nem a todos os relógios: monitores cardíacos Bluetooth e arquivos exportados funcionam aqui; Apple Saúde, Health Connect e APIs de fabricantes dependem do app instalável ou de um servidor da Move+.
      </Notice>
      <h2 className="section section-head">Disponíveis no navegador</h2>
      <div className="grid md-two">{HEALTH_SOURCES.filter((s) => s.kind === 'bluetooth' || s.kind === 'file').map(card)}</div>
      <h2 className="section section-head">Exigem app instalável ou servidor</h2>
      <div className="grid md-two">{HEALTH_SOURCES.filter((s) => s.kind === 'platform' || s.kind === 'vendor').map(card)}</div>
      <section className="section panel stack tight small muted">
        <h3 style={{ color: 'var(--text)' }}>Como os dados são combinados</h3>
        <p>Atividades gravadas pelo GPS e importadas são identificadas pela origem. Se a mesma atividade chegar de duas fontes, a Move+ reconhece a sobreposição de horário e conta apenas uma, priorizando a mais precisa (GPS, depois arquivo, depois manual).</p>
        <p>Passos e distância diária de plataformas de saúde aparecerão separados da distância gravada, para que nada seja somado duas vezes.</p>
      </section>
    </div>
  )
}
