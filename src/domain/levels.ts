const NAMES = [
  'Partida',
  'Passo firme',
  'Ritmo',
  'Embalo',
  'Fôlego',
  'Trilha',
  'Impulso',
  'Constância',
  'Horizonte',
  'Altitude',
  'Travessia',
  'Cume',
]

/** XP total necessário para alcançar o nível n (n >= 1). */
export function xpForLevel(n: number): number {
  return 50 * (n - 1) * n
}

export function levelName(n: number): string {
  return n <= NAMES.length ? NAMES[n - 1] : `Órbita ${n - NAMES.length}`
}

export interface LevelInfo {
  level: number
  name: string
  minXp: number
  nextXp: number
  /** 0..1 */
  progress: number
}

export function levelFor(xp: number): LevelInfo {
  let n = 1
  while (xpForLevel(n + 1) <= xp) n++
  const minXp = xpForLevel(n)
  const nextXp = xpForLevel(n + 1)
  return { level: n, name: levelName(n), minXp, nextXp, progress: (xp - minXp) / (nextXp - minXp) }
}
