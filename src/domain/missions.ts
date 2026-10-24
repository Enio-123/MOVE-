import { activeMinutes } from './activity'
import { addDays, localDate, monthKey, weekStart } from './dates'
import type { DayTotal } from './streak'
import type { Activity, CommunityEvent, FitnessLevel } from './types'

export type MissionPeriod = 'daily' | 'weekly' | 'season'
export type MissionMetric = 'minutes' | 'distanceKm' | 'activeDays' | 'goalDays' | 'events' | 'sports'

export interface MissionDef {
  id: string
  period: MissionPeriod
  scope: 'individual' | 'collective'
  title: string
  /** Use {n} para o alvo. */
  description: string
  metric: MissionMetric
  /** Alvo por condicionamento: iniciante, intermediário, avançado. */
  target: [number, number, number]
  xp: number
}

export const MISSIONS: MissionDef[] = [
  { id: 'd-move', period: 'daily', scope: 'individual', title: 'Movimento do dia', description: 'Some {n} minutos ativos hoje, em qualquer modalidade.', metric: 'minutes', target: [10, 20, 30], xp: 15 },
  { id: 'd-goal', period: 'daily', scope: 'individual', title: 'Meta diária', description: 'Alcance a sua meta diária de minutos ativos.', metric: 'goalDays', target: [1, 1, 1], xp: 20 },
  { id: 'w-days', period: 'weekly', scope: 'individual', title: 'Semana constante', description: 'Fique ativo em {n} dias diferentes nesta semana.', metric: 'activeDays', target: [3, 4, 5], xp: 60 },
  { id: 'w-minutes', period: 'weekly', scope: 'individual', title: 'Minutos da semana', description: 'Acumule {n} minutos ativos na semana. A OMS recomenda 150 por semana para adultos.', metric: 'minutes', target: [60, 120, 150], xp: 50 },
  { id: 'w-dist', period: 'weekly', scope: 'individual', title: 'Distância da semana', description: 'Percorra {n} km na semana, no seu ritmo.', metric: 'distanceKm', target: [5, 10, 20], xp: 50 },
  { id: 'w-variety', period: 'weekly', scope: 'individual', title: 'Explore modalidades', description: 'Registre atividades de {n} modalidades diferentes.', metric: 'sports', target: [2, 2, 2], xp: 30 },
  { id: 'w-event', period: 'weekly', scope: 'collective', title: 'Encontro da semana', description: 'Participe de {n} encontro em grupo e confirme a presença.', metric: 'events', target: [1, 1, 1], xp: 40 },
  { id: 's-km', period: 'season', scope: 'individual', title: 'Distância da temporada', description: 'Some {n} km ao longo da temporada.', metric: 'distanceKm', target: [30, 60, 120], xp: 200 },
  { id: 's-days', period: 'season', scope: 'individual', title: 'Temporada ativa', description: 'Fique ativo em {n} dias durante a temporada.', metric: 'activeDays', target: [20, 30, 45], xp: 200 },
  { id: 's-events', period: 'season', scope: 'collective', title: 'Movimento em grupo', description: 'Participe de {n} encontros comunitários na temporada.', metric: 'events', target: [3, 3, 3], xp: 150 },
]

const LEVEL_INDEX: Record<FitnessLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 }

/** Chave do período que contém a data (dia, segunda-feira da semana ou trimestre). */
export function periodKey(period: MissionPeriod, date: string): string {
  if (period === 'daily') return date
  if (period === 'weekly') return weekStart(date)
  const [y, m] = monthKey(date).split('-').map(Number)
  return `${y}-T${Math.floor((m - 1) / 3) + 1}`
}

export function periodRange(period: MissionPeriod, key: string): [string, string] {
  if (period === 'daily') return [key, key]
  if (period === 'weekly') return [key, addDays(key, 6)]
  const [y, q] = key.split('-T').map(Number)
  const startMonth = (q - 1) * 3 + 1
  const start = `${y}-${String(startMonth).padStart(2, '0')}-01`
  const endMonthFirst = new Date(Date.UTC(y, startMonth + 2, 1))
  const end = new Date(endMonthFirst.getTime() - 86400000).toISOString().slice(0, 10)
  return [start, end]
}

export function seasonName(key: string): string {
  const [y, q] = key.split('-T')
  return `Temporada ${q} de ${y}`
}

export interface MissionContext {
  counted: Activity[]
  totals: Map<string, DayTotal>
  activeDays: Set<string>
  dailyGoalMin: number
  events: CommunityEvent[]
  fitnessAt: (date: string) => FitnessLevel
}

export interface MissionProgress {
  def: MissionDef
  key: string
  target: number
  value: number
  done: boolean
  /** Instante em que o alvo foi atingido. */
  completedAt: number | null
  range: [string, string]
}

/**
 * Calcula o progresso de uma missão em um período. O instante de conclusão é o da
 * atividade (ou encontro) que fez o valor cruzar o alvo, o que mantém o XP estável.
 */
export function missionProgress(def: MissionDef, key: string, ctx: MissionContext): MissionProgress {
  const range = periodRange(def.period, key)
  const [from, to] = range
  const target = def.target[LEVEL_INDEX[ctx.fitnessAt(from)]]
  const acts = ctx.counted
    .filter((a) => a.localDate >= from && a.localDate <= to)
    .sort((a, b) => a.endedAt - b.endedAt)

  let value = 0
  let completedAt: number | null = null
  const mark = (v: number, at: number) => {
    value = v
    if (completedAt === null && value >= target) completedAt = at
  }

  switch (def.metric) {
    case 'minutes': {
      let sum = 0
      for (const a of acts) mark((sum += activeMinutes(a)), a.endedAt)
      break
    }
    case 'distanceKm': {
      let sum = 0
      for (const a of acts) mark((sum += a.distanceM / 1000), a.endedAt)
      break
    }
    case 'activeDays': {
      const seen = new Set<string>()
      for (const a of acts) {
        if (ctx.activeDays.has(a.localDate)) seen.add(a.localDate)
        mark(seen.size, a.endedAt)
      }
      break
    }
    case 'goalDays': {
      const sums = new Map<string, number>()
      const reached = new Set<string>()
      for (const a of acts) {
        const s = (sums.get(a.localDate) ?? 0) + activeMinutes(a)
        sums.set(a.localDate, s)
        if (s >= ctx.dailyGoalMin) reached.add(a.localDate)
        mark(reached.size, a.endedAt)
      }
      break
    }
    case 'sports': {
      const seen = new Set<string>()
      for (const a of acts) {
        seen.add(a.sport)
        mark(seen.size, a.endedAt)
      }
      break
    }
    case 'events': {
      const evs = ctx.events
        .filter((e) => e.attended && e.origin !== 'demo')
        .filter((e) => {
          const d = localDate(e.startsAt)
          return d >= from && d <= to
        })
        .sort((a, b) => a.startsAt - b.startsAt)
      let n = 0
      for (const e of evs) mark(++n, e.startsAt + e.durationMin * 60000)
      break
    }
  }
  return { def, key, target, value, done: completedAt !== null, completedAt, range }
}

/** Todas as conclusões de missões no histórico (cada período conta uma única vez). */
export function allMissionCompletions(ctx: MissionContext): MissionProgress[] {
  const dates = new Set<string>(ctx.counted.map((a) => a.localDate))
  for (const e of ctx.events) if (e.attended && e.origin !== 'demo') dates.add(localDate(e.startsAt))
  const out: MissionProgress[] = []
  for (const def of MISSIONS) {
    const keys = new Set([...dates].map((d) => periodKey(def.period, d)))
    for (const key of keys) {
      const p = missionProgress(def, key, ctx)
      if (p.done) out.push(p)
    }
  }
  return out
}

export function currentMissions(ctx: MissionContext, todayDate: string): MissionProgress[] {
  return MISSIONS.map((def) => missionProgress(def, periodKey(def.period, todayDate), ctx))
}

export function describeMission(p: MissionProgress): string {
  return p.def.description.replace('{n}', String(p.target))
}
