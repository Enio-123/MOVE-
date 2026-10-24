import { haversine } from './geo'
import type { Split, Sport, TrackPoint } from './types'

/** Leituras com precisão pior que isso não entram no cálculo de distância. */
export const MAX_ACCURACY_M = 35
/** Abaixo dessa velocidade o trecho conta como parado (m/s). */
export const MIN_MOVING_SPEED = 0.4

/** Velocidade máxima plausível por modalidade (m/s). Acima disso, a leitura é um salto do GPS. */
export const MAX_SPEED: Record<Sport, number> = {
  walk: 4,
  hike: 4,
  run: 10,
  wheelchair: 12,
  ride: 25,
}

export type Rejection = 'weak' | 'jump' | 'still' | 'stale'

/**
 * Decide se uma nova leitura deve ser aceita, comparando com a última aceita.
 * Retorna o motivo da rejeição ou null quando a leitura é válida.
 */
export function rejectReason(prev: TrackPoint | null, p: TrackPoint, sport: Sport): Rejection | null {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return 'weak'
  if (p.acc > MAX_ACCURACY_M) return 'weak'
  if (!prev || prev.seg !== p.seg) return null
  const dt = (p.t - prev.t) / 1000
  if (dt <= 0) return 'stale'
  const d = haversine(prev, p)
  if (d / dt > MAX_SPEED[sport]) return 'jump'
  // Variação menor que o ruído típico das leituras: o usuário provavelmente está parado.
  const jitter = Math.max(2, (p.acc + prev.acc) / 4)
  if (d < jitter) return 'still'
  return null
}

export interface TrackStats {
  distanceM: number
  /** Soma dos intervalos dentro dos trechos (exclui pausas manuais). */
  activeS: number
  movingS: number
  splits: Split[]
  elevationGainM: number | null
  weakSignalRatio: number
  avgHr: number | null
  maxHr: number | null
  accepted: TrackPoint[]
}

/** Filtra uma sequência bruta de leituras, mantendo apenas as válidas. */
export function filterTrack(raw: TrackPoint[], sport: Sport): { accepted: TrackPoint[]; weak: number } {
  const accepted: TrackPoint[] = []
  let weak = 0
  for (const p of raw) {
    const r = rejectReason(accepted[accepted.length - 1] ?? null, p, sport)
    if (r === 'weak') weak++
    if (r === null) accepted.push(p)
  }
  return { accepted, weak }
}

/** Calcula distância, tempos, parciais por km e elevação a partir de pontos já aceitos. */
export function computeStats(accepted: TrackPoint[], rawCount = accepted.length, weak = 0): TrackStats {
  let distanceM = 0
  let activeS = 0
  let movingS = 0
  const splits: Split[] = []
  let splitStartD = 0
  let splitStartT = 0

  for (let i = 1; i < accepted.length; i++) {
    const a = accepted[i - 1]
    const b = accepted[i]
    if (a.seg !== b.seg) continue
    const dt = (b.t - a.t) / 1000
    const d = haversine(a, b)
    if (d / dt >= MIN_MOVING_SPEED) movingS += dt
    // Fecha parciais de 1 km, interpolando o instante em que a marca foi atingida.
    let off = 0
    while (d > 0 && distanceM + (d - off) - splitStartD >= 1000) {
      const need = 1000 - (distanceM - splitStartD)
      off += need
      distanceM += need
      const tMark = activeS + dt * (off / d)
      const durationS = tMark - splitStartT
      splits.push({ km: splits.length + 1, distanceM: 1000, durationS, paceSPerKm: durationS, partial: false })
      splitStartD = distanceM
      splitStartT = tMark
    }
    distanceM += d - off
    activeS += dt
  }

  const lastD = distanceM - splitStartD
  if (lastD >= 50) {
    const durationS = activeS - splitStartT
    splits.push({
      km: splits.length + 1,
      distanceM: lastD,
      durationS,
      paceSPerKm: durationS / (lastD / 1000),
      partial: true,
    })
  }

  const hrs = accepted.map((p) => p.hr).filter((h): h is number => typeof h === 'number' && h > 30 && h < 240)

  return {
    distanceM,
    activeS,
    movingS,
    splits,
    elevationGainM: elevationGain(accepted),
    weakSignalRatio: rawCount ? weak / rawCount : 0,
    avgHr: hrs.length ? Math.round(hrs.reduce((s, h) => s + h, 0) / hrs.length) : null,
    maxHr: hrs.length ? Math.max(...hrs) : null,
    accepted,
  }
}

/**
 * Ganho de elevação com histerese de 3 m para não somar o ruído vertical do GPS.
 * Retorna null quando menos de 60% das leituras trazem altitude confiável.
 */
export function elevationGain(points: TrackPoint[]): number | null {
  const valid = points.filter(
    (p) => typeof p.alt === 'number' && Number.isFinite(p.alt) && (p.altAcc == null || p.altAcc <= 15),
  )
  if (points.length < 2 || valid.length < points.length * 0.6) return null
  let gain = 0
  let ref = valid[0].alt as number
  for (const p of valid) {
    const alt = p.alt as number
    if (alt - ref >= 3) {
      gain += alt - ref
      ref = alt
    } else if (ref - alt >= 3) {
      ref = alt
    }
  }
  return Math.round(gain)
}

export function analyzeTrack(raw: TrackPoint[], sport: Sport): TrackStats {
  const { accepted, weak } = filterTrack(raw, sport)
  return computeStats(accepted, raw.length, weak)
}
