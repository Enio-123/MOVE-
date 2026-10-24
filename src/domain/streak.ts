import { activeMinutes, isValid } from './activity'
import { addDays, diffDays, monthKey, weekStart } from './dates'
import type { Activity, StreakRule } from './types'

export interface DayTotal {
  date: string
  minutes: number
  distanceM: number
  count: number
  /** Maior duração de uma única atividade válida no dia (min). */
  longestValidMin: number
}

/** Totais por data local de início. Recebe apenas atividades já deduplicadas. */
export function dayTotals(counted: Activity[]): Map<string, DayTotal> {
  const map = new Map<string, DayTotal>()
  for (const a of counted) {
    const t = map.get(a.localDate) ?? { date: a.localDate, minutes: 0, distanceM: 0, count: 0, longestValidMin: 0 }
    const min = activeMinutes(a)
    t.minutes += min
    t.distanceM += a.distanceM
    t.count++
    if (isValid(a)) t.longestValidMin = Math.max(t.longestValidMin, min)
    map.set(a.localDate, t)
  }
  return map
}

export function isActiveDay(t: DayTotal | undefined, rule: StreakRule, dailyGoalMin: number): boolean {
  if (!t) return false
  if (rule.kind === 'goal') return t.minutes >= dailyGoalMin
  return t.longestValidMin >= rule.minMinutes
}

export interface StreakRun {
  start: string
  end: string
  length: number
}

export interface StreakInfo {
  current: number
  best: number
  /** A sequência atual continua viva, mas ainda falta a atividade de hoje. */
  pendingToday: boolean
  runs: StreakRun[]
  activeDays: Set<string>
  activeThisMonth: number
  activeThisWeek: number
  /** Tamanho da sequência em cada dia ativo (usado para bônus e conquistas). */
  lengthAt: Map<string, number>
}

export function computeStreak(
  totals: Map<string, DayTotal>,
  rule: StreakRule,
  dailyGoalMin: number,
  todayDate: string,
): StreakInfo {
  const activeDays = new Set<string>()
  for (const [d, t] of totals) if (isActiveDay(t, rule, dailyGoalMin)) activeDays.add(d)

  const sorted = [...activeDays].sort()
  const runs: StreakRun[] = []
  const lengthAt = new Map<string, number>()
  for (const d of sorted) {
    const last = runs[runs.length - 1]
    if (last && diffDays(last.end, d) === 1) {
      last.end = d
      last.length++
    } else {
      runs.push({ start: d, end: d, length: 1 })
    }
    lengthAt.set(d, runs[runs.length - 1].length)
  }

  let current = 0
  let pendingToday = false
  const last = runs[runs.length - 1]
  if (last) {
    if (last.end === todayDate) current = last.length
    else if (last.end === addDays(todayDate, -1)) {
      current = last.length
      pendingToday = true
    }
  }

  const month = monthKey(todayDate)
  const ws = weekStart(todayDate)
  return {
    current,
    best: runs.reduce((m, r) => Math.max(m, r.length), 0),
    pendingToday,
    runs,
    activeDays,
    activeThisMonth: sorted.filter((d) => monthKey(d) === month).length,
    activeThisWeek: sorted.filter((d) => d >= ws && d <= todayDate).length,
    lengthAt,
  }
}
