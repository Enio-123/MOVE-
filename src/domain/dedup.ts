import type { Activity, DataSource } from './types'

/** Quanto maior, mais confiável a fonte quando duas representam o mesmo exercício. */
const PRIORITY: Record<DataSource, number> = { gps: 4, import: 3, health: 2, manual: 1, demo: 0 }

/** Fração mínima de sobreposição (em relação à atividade mais curta) para considerar o mesmo exercício. */
export const OVERLAP_THRESHOLD = 0.5

export function overlapRatio(a: Activity, b: Activity): number {
  const start = Math.max(a.startedAt, b.startedAt)
  const end = Math.min(a.endedAt, b.endedAt)
  const overlap = Math.max(0, end - start)
  const shorter = Math.min(a.endedAt - a.startedAt, b.endedAt - b.startedAt)
  return shorter > 0 ? overlap / shorter : 0
}

/**
 * Resolve duplicidades: devolve, para cada atividade duplicada, o id da atividade principal.
 * Atividades de demonstração nunca entram nos cálculos.
 */
export function resolveDuplicates(activities: Activity[]): Map<string, string> {
  const dup = new Map<string, string>()
  const real = activities.filter((a) => a.source !== 'demo')
  const byId = new Map(real.map((a) => [a.id, a]))
  // Marcações explícitas feitas pelo usuário têm prioridade.
  for (const a of real) if (a.duplicateOf && byId.has(a.duplicateOf)) dup.set(a.id, a.duplicateOf)

  const sorted = [...real].sort(
    (a, b) => PRIORITY[b.source] - PRIORITY[a.source] || a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  )
  const primaries: Activity[] = []
  for (const a of sorted) {
    if (dup.has(a.id)) continue
    const match = primaries.find((p) => overlapRatio(p, a) >= OVERLAP_THRESHOLD)
    if (match) dup.set(a.id, match.id)
    else primaries.push(a)
  }
  return dup
}

/** Atividades que contam para estatísticas, XP e sequência (sem demonstrações e sem duplicadas). */
export function countedActivities(activities: Activity[]): Activity[] {
  const dup = resolveDuplicates(activities)
  return activities.filter((a) => a.source !== 'demo' && !dup.has(a.id))
}
