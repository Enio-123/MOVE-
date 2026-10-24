import { useState } from 'react'
import { SPORT_LABEL } from '../domain/activity'
import { fmtTime } from '../domain/format'
import { discardLive, saveRecovered } from '../services/actions'
import { useApp } from '../services/store'
import { Sheet } from '../ui/components'
import { navigate, useRoute } from '../ui/router'

/**
 * Exibida quando o app reabre com uma gravação interrompida (página recarregada,
 * navegador encerrado). Nada é salvo como concluído sem a decisão do usuário.
 */
export function RecoveryDialog() {
  const orphan = useApp((s) => s.orphanSession)
  const route = useRoute()
  const [busy, setBusy] = useState(false)
  if (!orphan || route.path.startsWith('/registrar')) return null
  return (
    <Sheet title="Gravação interrompida" onClose={() => navigate('/registrar?retomar=1')}>
      <div className="stack">
        <p className="muted">
          Uma {SPORT_LABEL[orphan.sport].toLowerCase()} iniciada às {fmtTime(orphan.startedAt)} não foi finalizada. O último registro foi às {fmtTime(orphan.updatedAt)}, com {orphan.points.length} pontos de GPS válidos.
        </p>
        <p className="small faint">O intervalo entre a interrupção e agora não foi gravado. Se você continuar, ele conta como pausa.</p>
        <div className="stack tight">
          <button className="btn primary block" disabled={busy} onClick={() => navigate('/registrar?retomar=1')}>
            Continuar gravando
          </button>
          <button
            className="btn block"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const a = await saveRecovered(orphan)
              setBusy(false)
              navigate(`/atividade/${a.id}`)
            }}
          >
            Salvar como atividade recuperada
          </button>
          <button className="btn danger block" disabled={busy} onClick={() => confirm('Descartar esta gravação? Os pontos registrados serão apagados.') && discardLive()}>
            Descartar
          </button>
        </div>
      </div>
    </Sheet>
  )
}
