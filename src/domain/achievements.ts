import { activeMinutes, isValid } from './activity'
import { weekStart } from './dates'
import type { StreakInfo } from './streak'
import type { Activity, CommunityEvent } from './types'

export type AchievementCategory = 'inicio' | 'distancia' | 'sequencia' | 'consistencia' | 'grupo' | 'metas' | 'recordes'

export interface AchievementDef {
  id: string
  title: string
  description: string
  category: AchievementCategory
  target: number
  xp: number
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-activity', title: 'Primeiro passo', description: 'Registre a sua primeira atividade válida.', category: 'inicio', target: 1, xp: 25 },
  { id: 'first-km', title: 'Primeiro quilômetro', description: 'Complete 1 km em uma única atividade.', category: 'distancia', target: 1, xp: 25 },
  { id: 'dist-10', title: '10 km acumulados', description: 'Some 10 km em atividades.', category: 'distancia', target: 10, xp: 40 },
  { id: 'dist-50', title: '50 km acumulados', description: 'Some 50 km em atividades.', category: 'distancia', target: 50, xp: 80 },
  { id: 'dist-100', title: '100 km acumulados', description: 'Some 100 km em atividades.', category: 'distancia', target: 100, xp: 120 },
  { id: 'streak-3', title: 'Três em sequência', description: 'Fique ativo por 3 dias seguidos.', category: 'sequencia', target: 3, xp: 30 },
  { id: 'streak-7', title: 'Semana completa', description: 'Fique ativo por 7 dias seguidos.', category: 'sequencia', target: 7, xp: 60 },
  { id: 'streak-30', title: 'Hábito formado', description: 'Fique ativo por 30 dias seguidos.', category: 'sequencia', target: 30, xp: 150 },
  { id: 'week-3', title: 'Semana consistente', description: 'Tenha 3 dias ativos em uma mesma semana.', category: 'consistencia', target: 1, xp: 30 },
  { id: 'weeks-4', title: 'Um mês de constância', description: 'Tenha 4 semanas com pelo menos 3 dias ativos.', category: 'consistencia', target: 4, xp: 100 },
  { id: 'group-1', title: 'Em boa companhia', description: 'Participe de um encontro em grupo.', category: 'grupo', target: 1, xp: 30 },
  { id: 'group-5', title: 'Parte da turma', description: 'Participe de 5 encontros em grupo.', category: 'grupo', target: 5, xp: 80 },
  { id: 'goal-1', title: 'Meta cumprida', description: 'Alcance a sua meta diária pela primeira vez.', category: 'metas', target: 1, xp: 20 },
  { id: 'goal-10', title: 'Dez metas', description: 'Alcance a meta diária em 10 dias.', category: 'metas', target: 10, xp: 70 },
  { id: 'record', title: 'Novo recorde', description: 'Supere a sua maior distância ou duração depois da terceira atividade.', category: 'recordes', target: 1, xp: 40 },
]

export interface AchievementState {
  def: AchievementDef
  value: number
  unlockedAt: number | null
}

/**
 * Avalia todas as conquistas percorrendo o histórico em ordem cronológica,
 * para que a data de desbloqueio seja a do evento que cumpriu o requisito.
 */
export function evaluateAchievements(
  counted: Activity[],
  streak: StreakInfo,
  dailyGoalMin: number,
  events: CommunityEvent[],
): AchievementState[] {
  const acts = [...counted].sort((a, b) => a.endedAt - b.endedAt)
  const res = new Map<string, AchievementState>(ACHIEVEMENTS.map((d) => [d.id, { def: d, value: 0, unlockedAt: null }]))
  const set = (id: string, value: number, at: number) => {
    const s = res.get(id)!
    s.value = Math.max(s.value, value)
    if (s.unlockedAt === null && s.value >= s.def.target) s.unlockedAt = at
  }

  let validCount = 0
  let km = 0
  let bestDist = 0
  let bestDur = 0
  const weekDays = new Map<string, Set<string>>()
  const goalDaySums = new Map<string, number>()
  const goalDays = new Set<string>()
  const lastActOfDay = new Map<string, number>()
  for (const a of acts) lastActOfDay.set(a.localDate, a.endedAt)

  for (const a of acts) {
    const min = activeMinutes(a)
    if (isValid(a)) {
      validCount++
      set('first-activity', validCount, a.endedAt)
    }
    if (a.distanceM >= 1000) set('first-km', 1, a.endedAt)
    km += a.distanceM / 1000
    set('dist-10', km, a.endedAt)
    set('dist-50', km, a.endedAt)
    set('dist-100', km, a.endedAt)

    if (validCount > 3 && (a.distanceM > bestDist || min * 60 > bestDur)) set('record', 1, a.endedAt)
    bestDist = Math.max(bestDist, a.distanceM)
    bestDur = Math.max(bestDur, min * 60)

    const g = (goalDaySums.get(a.localDate) ?? 0) + min
    goalDaySums.set(a.localDate, g)
    if (g >= dailyGoalMin) goalDays.add(a.localDate)
    set('goal-1', goalDays.size, a.endedAt)
    set('goal-10', goalDays.size, a.endedAt)

    if (streak.activeDays.has(a.localDate) && lastActOfDay.get(a.localDate) === a.endedAt) {
      const ws = weekStart(a.localDate)
      const s = weekDays.get(ws) ?? new Set<string>()
      s.add(a.localDate)
      weekDays.set(ws, s)
      const goodWeeks = [...weekDays.values()].filter((w) => w.size >= 3).length
      set('week-3', goodWeeks > 0 ? 1 : 0, a.endedAt)
      set('weeks-4', goodWeeks, a.endedAt)
      const len = streak.lengthAt.get(a.localDate) ?? 0
      set('streak-3', len, a.endedAt)
      set('streak-7', len, a.endedAt)
      set('streak-30', len, a.endedAt)
    }
  }

  const attended = events
    .filter((e) => e.attended && e.origin !== 'demo')
    .sort((a, b) => a.startsAt - b.startsAt)
  attended.forEach((e, i) => {
    const at = e.startsAt + e.durationMin * 60000
    set('group-1', i + 1, at)
    set('group-5', i + 1, at)
  })

  return [...res.values()]
}
