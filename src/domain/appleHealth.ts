import type { Sport } from './types'

/** Treino lido da exportação do Apple Saúde. */
export interface HealthWorkout {
  sport: Sport
  startedAt: number
  endedAt: number
  durationS: number
  distanceM: number | null
  sourceName: string
}

export interface HealthImport {
  workouts: HealthWorkout[]
  /** Passos por data local (YYYY-MM-DD), consolidados sem somar celular e relógio. */
  steps: Record<string, number>
  /** Treinos de modalidades que a Move+ ainda não acompanha (não são importados). */
  skippedWorkouts: number
}

const TYPES: Record<string, Sport> = {
  HKWorkoutActivityTypeWalking: 'walk',
  HKWorkoutActivityTypeRunning: 'run',
  HKWorkoutActivityTypeHiking: 'hike',
  HKWorkoutActivityTypeCycling: 'ride',
  HKWorkoutActivityTypeWheelchairWalkPace: 'wheelchair',
  HKWorkoutActivityTypeWheelchairRunPace: 'wheelchair',
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null

/** "2024-03-05 07:12:44 -0300" → epoch ms. */
export function parseHealthDate(s: string): number {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/)
  if (!m) return Number.NaN
  const [, y, mo, d, h, mi, se, sign, oh, om] = m
  const off = (Number(oh) * 60 + Number(om)) * (sign === '-' ? -1 : 1)
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +se) - off * 60000
}

const toMeters = (v: number, unit: string | null) => (unit === 'mi' ? v * 1609.344 : unit === 'm' ? v : v * 1000)
const toSeconds = (v: number, unit: string | null) => (unit === 'h' || unit === 'hr' ? v * 3600 : unit === 's' ? v : v * 60)

/**
 * Lê export.xml do Apple Saúde em partes (o arquivo pode ter centenas de MB).
 * Treinos de caminhada, corrida, trilha, pedalada e cadeira de rodas viram atividades;
 * os passos são somados por dia e por aparelho de origem, ficando com o aparelho que mais contou
 * (assim celular e relógio não são somados em dobro).
 */
export class AppleHealthParser {
  private buf = ''
  private workout: { tag: string; distance: number | null } | null = null
  private bySource = new Map<string, Map<string, number>>()
  private workouts: HealthWorkout[] = []
  private skipped = 0
  constructor(private since = 0) {}

  feed(chunk: string) {
    this.buf += chunk
    let i = 0
    for (;;) {
      const lt = this.buf.indexOf('<', i)
      if (lt < 0) { this.buf = ''; return }
      const gt = this.buf.indexOf('>', lt)
      if (gt < 0) { this.buf = this.buf.slice(lt); return }
      this.tag(this.buf.slice(lt, gt + 1))
      i = gt + 1
    }
  }

  private tag(t: string) {
    if (t.startsWith('<Record ') && t.includes('HKQuantityTypeIdentifierStepCount')) {
      const start = attr(t, 'startDate')
      const v = Number(attr(t, 'value'))
      if (!start || !Number.isFinite(v)) return
      if (this.since && parseHealthDate(start) < this.since) return
      const day = start.slice(0, 10)
      const src = attr(t, 'sourceName') ?? '?'
      let m = this.bySource.get(day)
      if (!m) this.bySource.set(day, (m = new Map()))
      m.set(src, (m.get(src) ?? 0) + v)
    } else if (t.startsWith('<Workout ')) {
      this.workout = { tag: t, distance: null }
      if (t.endsWith('/>')) this.closeWorkout()
    } else if (this.workout && t.startsWith('<WorkoutStatistics ') && /Distance(WalkingRunning|Cycling|Wheelchair)/.test(t)) {
      const sum = Number(attr(t, 'sum'))
      if (Number.isFinite(sum)) this.workout.distance = toMeters(sum, attr(t, 'unit'))
    } else if (t === '</Workout>') {
      this.closeWorkout()
    }
  }

  private closeWorkout() {
    const w = this.workout
    this.workout = null
    if (!w) return
    const type = attr(w.tag, 'workoutActivityType') ?? ''
    const sport = TYPES[type]
    const startedAt = parseHealthDate(attr(w.tag, 'startDate') ?? '')
    const endedAt = parseHealthDate(attr(w.tag, 'endDate') ?? '')
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) return
    if (this.since && startedAt < this.since) return
    if (!sport) { this.skipped++; return }
    const dur = Number(attr(w.tag, 'duration'))
    const durationS = Number.isFinite(dur) ? toSeconds(dur, attr(w.tag, 'durationUnit')) : (endedAt - startedAt) / 1000
    let distanceM = w.distance
    const td = Number(attr(w.tag, 'totalDistance'))
    if (distanceM == null && Number.isFinite(td) && td > 0) distanceM = toMeters(td, attr(w.tag, 'totalDistanceUnit'))
    this.workouts.push({ sport, startedAt, endedAt, durationS, distanceM, sourceName: attr(w.tag, 'sourceName') ?? 'Apple Saúde' })
  }

  result(): HealthImport {
    const steps: Record<string, number> = {}
    for (const [day, m] of this.bySource) steps[day] = Math.round(Math.max(...m.values()))
    return { workouts: this.workouts, steps, skippedWorkouts: this.skipped }
  }
}
