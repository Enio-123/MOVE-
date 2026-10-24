import { ChevronRight } from 'lucide-react'
import { avgPace, SPORT_LABEL } from '../domain/activity'
import { duration, fmtDateShort, fmtTime, km, pace } from '../domain/format'
import type { Activity } from '../domain/types'
import { SourceBadge, SportIcon } from './components'

export function ActivityRow({ a, duplicate }: { a: Activity; duplicate?: boolean }) {
  const p = avgPace(a)
  return (
    <a className="list-item" href={`#/atividade/${a.id}`}>
      <SportIcon sport={a.sport} />
      <div className="grow">
        <div className="row" style={{ gap: 8 }}>
          <span className="title ellipsis">{a.title || SPORT_LABEL[a.sport]}</span>
          <SourceBadge source={a.source} />
          {a.status === 'recovered' && <span className="badge warn">Recuperada</span>}
          {duplicate && <span className="badge">Duplicada</span>}
        </div>
        <div className="meta">
          {fmtDateShort(a.localDate)} · {fmtTime(a.startedAt)} · {a.distanceM > 0 ? `${km(a.distanceM)} km · ` : ''}
          {duration(a.source === 'manual' ? a.elapsedS : a.movingS)}
          {p ? ` · ${pace(p)} /km` : ''}
        </div>
      </div>
      <ChevronRight size={18} className="faint" aria-hidden="true" />
    </a>
  )
}
