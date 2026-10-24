import { SPORT_LABEL } from './activity'
import { localDate } from './dates'
import { computeStats, filterTrack } from './track'
import type { Activity, ActivityStatus, DataSource, Privacy, Sport, TrackPoint } from './types'

export interface BuildInput {
  id: string
  sport: Sport
  source: DataSource
  status: ActivityStatus
  startedAt: number
  endedAt: number
  pausedMs: number
  points: TrackPoint[]
  /** Leituras brutas recebidas (para a proporção de sinal fraco). */
  rawCount?: number
  weakCount?: number
  signalGaps?: number
  privacy: Privacy
  title?: string
  externalId?: string | null
  now: number
}

function defaultTitle(sport: Sport, startedAt: number): string {
  const h = new Date(startedAt).getHours()
  const period = h < 5 ? 'noturna' : h < 12 ? 'da manhã' : h < 18 ? 'da tarde' : 'da noite'
  return `${SPORT_LABEL[sport]} ${period}`
}

/** Monta uma atividade a partir de pontos já aceitos (gravação) ou brutos (importação). */
export function buildActivity(input: BuildInput, alreadyFiltered: boolean): Activity {
  let points = input.points
  let weak = input.weakCount ?? 0
  let raw = input.rawCount ?? points.length
  if (!alreadyFiltered) {
    const f = filterTrack(points, input.sport)
    points = f.accepted
    weak = f.weak
    raw = input.points.length
  }
  const st = computeStats(points, raw, weak)
  const elapsedS = Math.max(0, (input.endedAt - input.startedAt - input.pausedMs) / 1000)
  return {
    id: input.id,
    sport: input.sport,
    source: input.source,
    status: input.status,
    title: input.title?.trim() || defaultTitle(input.sport, input.startedAt),
    description: '',
    privacy: input.privacy,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    localDate: localDate(input.startedAt),
    tzOffset: new Date(input.startedAt).getTimezoneOffset(),
    elapsedS,
    movingS: Math.min(st.movingS, elapsedS || st.movingS),
    distanceM: st.distanceM,
    splits: st.splits,
    elevationGainM: st.elevationGainM,
    avgHr: st.avgHr,
    maxHr: st.maxHr,
    weakSignalRatio: st.weakSignalRatio,
    signalGaps: input.signalGaps ?? 0,
    photoIds: [],
    externalId: input.externalId ?? null,
    duplicateOf: null,
    hasTrack: points.length > 1,
    createdAt: input.now,
    updatedAt: input.now,
  }
}

/** Registro manual: sem trajeto, distância opcional informada pelo usuário. */
export function manualActivity(p: {
  id: string; sport: Sport; startedAt: number; minutes: number; distanceKm: number | null; title: string; privacy: Privacy; now: number
}): Activity {
  const a = buildActivity(
    { id: p.id, sport: p.sport, source: 'manual', status: 'completed', startedAt: p.startedAt, endedAt: p.startedAt + p.minutes * 60000, pausedMs: 0, points: [], privacy: p.privacy, title: p.title, now: p.now },
    true,
  )
  return { ...a, distanceM: (p.distanceKm ?? 0) * 1000, movingS: 0, hasTrack: false }
}
