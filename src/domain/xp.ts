import { activeMinutes, isValid, SPORT_LABEL } from './activity'
import type { AchievementState } from './achievements'
import type { MissionProgress } from './missions'
import type { StreakInfo } from './streak'
import type { Activity, CommunityEvent } from './types'

export type XpKind = 'activity' | 'streak' | 'mission' | 'achievement' | 'event'

export interface XpEntry {
  /** Chave única: a mesma origem nunca gera XP duas vezes. */
  key: string
  kind: XpKind
  amount: number
  label: string
  at: number
  ref?: string
}

/** Teto diário de XP vindo de atividades, para não premiar volume excessivo. */
export const DAILY_ACTIVITY_XP_CAP = 150

/**
 * Regra de pontuação de uma atividade (transparente para o usuário):
 * 10 XP por atividade válida + 1 XP por minuto ativo (até 60) + 3 XP por km (até 30).
 * Registros manuais, sem medição, valem metade.
 */
export function activityXp(a: Activity): number {
  if (!isValid(a)) return 0
  const base = 10 + Math.min(60, Math.round(activeMinutes(a))) + Math.min(30, Math.floor((a.distanceM / 1000) * 3))
  return a.source === 'manual' ? Math.round(base / 2) : base
}

export const XP_RULES = [
  'Atividade válida (5 min ou mais): 10 XP + 1 XP por minuto ativo (até 60) + 3 XP por km (até 30).',
  'Registro manual, sem medição de GPS: metade do XP.',
  `Limite de ${DAILY_ACTIVITY_XP_CAP} XP por dia vindos de atividades.`,
  'Sequência: +5 XP por dia ativo a partir do 3º dia seguido, +10 XP a partir do 7º.',
  'Encontro em grupo com presença confirmada: 40 XP (+30 para quem organizou).',
  'Missões e conquistas: o valor indicado em cada uma.',
  'Atividades duplicadas (mesmo exercício vindo de outra fonte) não geram XP.',
]

export function computeXp(
  counted: Activity[],
  streak: StreakInfo,
  events: CommunityEvent[],
  missions: MissionProgress[],
  achievements: AchievementState[],
): XpEntry[] {
  const out: XpEntry[] = []
  const usedPerDay = new Map<string, number>()
  for (const a of [...counted].sort((x, y) => x.endedAt - y.endedAt)) {
    const raw = activityXp(a)
    if (!raw) continue
    const used = usedPerDay.get(a.localDate) ?? 0
    const amount = Math.min(raw, DAILY_ACTIVITY_XP_CAP - used)
    if (amount <= 0) continue
    usedPerDay.set(a.localDate, used + amount)
    out.push({ key: `activity:${a.id}`, kind: 'activity', amount, label: a.title || SPORT_LABEL[a.sport], at: a.endedAt, ref: a.id })
  }

  for (const [date, len] of streak.lengthAt) {
    const bonus = len >= 7 ? 10 : len >= 3 ? 5 : 0
    if (!bonus) continue
    const last = counted.filter((a) => a.localDate === date).reduce((m, a) => Math.max(m, a.endedAt), 0)
    out.push({ key: `streak:${date}`, kind: 'streak', amount: bonus, label: `Sequência de ${len} dias`, at: last })
  }

  for (const e of events) {
    if (!e.attended || e.origin === 'demo') continue
    const at = e.startsAt + e.durationMin * 60000
    out.push({ key: `event:${e.id}`, kind: 'event', amount: 40, label: `Encontro: ${e.title}`, at, ref: e.id })
    if (e.origin === 'mine') out.push({ key: `event-host:${e.id}`, kind: 'event', amount: 30, label: `Organização: ${e.title}`, at, ref: e.id })
  }

  for (const m of missions) {
    if (!m.done || m.completedAt === null) continue
    out.push({ key: `mission:${m.def.id}:${m.key}`, kind: 'mission', amount: m.def.xp, label: `Missão: ${m.def.title}`, at: m.completedAt })
  }

  for (const s of achievements) {
    if (s.unlockedAt === null) continue
    out.push({ key: `achievement:${s.def.id}`, kind: 'achievement', amount: s.def.xp, label: `Conquista: ${s.def.title}`, at: s.unlockedAt })
  }

  // Garantia final de unicidade por chave.
  const seen = new Set<string>()
  return out.filter((e) => (seen.has(e.key) ? false : (seen.add(e.key), true))).sort((a, b) => a.at - b.at)
}
