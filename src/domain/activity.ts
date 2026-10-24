import type { Activity, Difficulty, Sport } from './types'

export const SPORTS: Sport[] = ['walk', 'run', 'hike', 'wheelchair', 'ride']

export const SPORT_LABEL: Record<Sport, string> = {
  walk: 'Caminhada',
  run: 'Corrida',
  hike: 'Trilha',
  wheelchair: 'Cadeira de rodas',
  ride: 'Pedalada',
}

/** Duração mínima (s) para uma atividade ser considerada válida. */
export const MIN_VALID_S = 5 * 60

/** Minutos ativos: tempo em movimento quando medido, ou a duração informada em registros manuais. */
export function activeMinutes(a: Activity): number {
  const s = a.source === 'manual' ? a.elapsedS : a.movingS
  return s / 60
}

export function isValid(a: Activity): boolean {
  return activeMinutes(a) * 60 >= MIN_VALID_S
}

export function avgPace(a: Activity): number | null {
  if (a.distanceM < 100 || a.movingS <= 0) return null
  return a.movingS / (a.distanceM / 1000)
}

/** MET aproximado por modalidade (Compendium of Physical Activities, valores médios). */
const MET: Record<Sport, number> = { walk: 3.5, run: 9, hike: 6, wheelchair: 4, ride: 7 }

/** Estimativa de calorias. Só existe se o usuário informou o peso; sempre exibida como estimativa. */
export function estimateCalories(a: Activity, weightKg: number | null): number | null {
  if (!weightKg) return null
  return Math.round(MET[a.sport] * weightKg * (activeMinutes(a) / 60))
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Leve', moderate: 'Moderado', hard: 'Intenso' }
