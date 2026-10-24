import { activeMinutes, avgPace } from './activity'
import { addDays, monthKey, weekStart } from './dates'
import type { Activity, Sport } from './types'

export type Bucket = 'day' | 'week' | 'month'

export interface Point {
  key: string
  distanceM: number
  minutes: number
  count: number
  activityIds: string[]
}

export function bucketKey(date: string, bucket: Bucket): string {
  if (bucket === 'day') return date
  if (bucket === 'week') return weekStart(date)
  return monthKey(date)
}

/** Série contínua (inclui períodos vazios) entre duas datas. */
export function series(counted: Activity[], from: string, to: string, bucket: Bucket, sport: Sport | 'all' = 'all'): Point[] {
  const keys: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const k = bucketKey(d, bucket)
    if (keys[keys.length - 1] !== k) keys.push(k)
  }
  const map = new Map<string, Point>(keys.map((k) => [k, { key: k, distanceM: 0, minutes: 0, count: 0, activityIds: [] }]))
  for (const a of counted) {
    if (a.localDate < from || a.localDate > to) continue
    if (sport !== 'all' && a.sport !== sport) continue
    const p = map.get(bucketKey(a.localDate, bucket))
    if (!p) continue
    p.distanceM += a.distanceM
    p.minutes += activeMinutes(a)
    p.count++
    p.activityIds.push(a.id)
  }
  return keys.map((k) => map.get(k)!)
}

export interface Summary {
  distanceM: number
  minutes: number
  count: number
  activeDays: number
}

export function summarize(counted: Activity[], from: string, to: string, sport: Sport | 'all' = 'all'): Summary {
  const acts = counted.filter((a) => a.localDate >= from && a.localDate <= to && (sport === 'all' || a.sport === sport))
  return {
    distanceM: acts.reduce((s, a) => s + a.distanceM, 0),
    minutes: acts.reduce((s, a) => s + activeMinutes(a), 0),
    count: acts.length,
    activeDays: new Set(acts.map((a) => a.localDate)).size,
  }
}

export interface Record {
  label: string
  value: number
  activityId: string
  unit: 'm' | 's' | 'pace'
}

/**
 * Recordes pessoais. Ritmo só é comparado entre atividades medidas pelo GPS ou
 * importadas, da mesma modalidade e com pelo menos 1 km, para que a comparação seja justa.
 */
export function personalRecords(counted: Activity[], sport: Sport | 'all' = 'all'): Record[] {
  const acts = counted.filter((a) => sport === 'all' || a.sport === sport)
  const out: Record[] = []
  const longest = maxBy(acts, (a) => a.distanceM)
  if (longest && longest.distanceM > 0) out.push({ label: 'Maior distância', value: longest.distanceM, activityId: longest.id, unit: 'm' })
  const dur = maxBy(acts, (a) => activeMinutes(a))
  if (dur) out.push({ label: 'Maior duração', value: activeMinutes(dur) * 60, activityId: dur.id, unit: 's' })
  if (sport !== 'all') {
    const measured = acts.filter((a) => (a.source === 'gps' || a.source === 'import') && a.distanceM >= 1000)
    const best = minBy(measured, (a) => avgPace(a) ?? Infinity)
    if (best) out.push({ label: 'Melhor ritmo médio (1 km ou mais)', value: avgPace(best)!, activityId: best.id, unit: 'pace' })
    let bestSplit: { pace: number; id: string } | null = null
    for (const a of measured) for (const s of a.splits) if (!s.partial && (!bestSplit || s.durationS < bestSplit.pace)) bestSplit = { pace: s.durationS, id: a.id }
    if (bestSplit) out.push({ label: 'Quilômetro mais rápido', value: bestSplit.pace, activityId: bestSplit.id, unit: 'pace' })
  }
  return out
}

function maxBy<T>(xs: T[], f: (x: T) => number): T | null {
  let best: T | null = null
  let bv = -Infinity
  for (const x of xs) {
    const v = f(x)
    if (v > bv) { bv = v; best = x }
  }
  return best
}

function minBy<T>(xs: T[], f: (x: T) => number): T | null {
  const r = maxBy(xs, (x) => -f(x))
  return r && Number.isFinite(f(r)) ? r : null
}
