import { evaluateAchievements, type AchievementState } from './achievements'
import { countedActivities, resolveDuplicates } from './dedup'
import { levelFor, type LevelInfo } from './levels'
import { allMissionCompletions, currentMissions, type MissionContext, type MissionProgress } from './missions'
import { computeStreak, dayTotals, type DayTotal, type StreakInfo } from './streak'
import type { Activity, CommunityEvent, FitnessLevel, Settings } from './types'
import { computeXp, type XpEntry } from './xp'

export interface Derived {
  counted: Activity[]
  duplicates: Map<string, string>
  totals: Map<string, DayTotal>
  streak: StreakInfo
  missions: MissionProgress[]
  achievements: AchievementState[]
  xp: XpEntry[]
  xpTotal: number
  level: LevelInfo
}

export function fitnessResolver(settings: Pick<Settings, 'fitness' | 'fitnessLog'>): (date: string) => FitnessLevel {
  const log = [...settings.fitnessLog].sort((a, b) => a.from.localeCompare(b.from))
  return (date) => {
    let level: FitnessLevel = log[0]?.level ?? settings.fitness
    for (const e of log) if (e.from <= date) level = e.level
    return level
  }
}

/**
 * Todo o estado de progresso (sequência, missões, conquistas, XP e nível) é derivado
 * dos registros persistidos. Assim não há como o XP ficar duplicado ou divergir após
 * uma edição ou exclusão: basta recalcular.
 */
export function derive(
  activities: Activity[],
  events: CommunityEvent[],
  settings: Settings,
  todayDate: string,
): Derived {
  const duplicates = resolveDuplicates(activities)
  const counted = countedActivities(activities)
  const totals = dayTotals(counted)
  const streak = computeStreak(totals, settings.streakRule, settings.dailyGoalMin, todayDate)
  const ctx: MissionContext = {
    counted,
    totals,
    activeDays: streak.activeDays,
    dailyGoalMin: settings.dailyGoalMin,
    events,
    fitnessAt: fitnessResolver(settings),
  }
  const completions = allMissionCompletions(ctx)
  const achievements = evaluateAchievements(counted, streak, settings.dailyGoalMin, events)
  const xp = computeXp(counted, streak, events, completions, achievements)
  const xpTotal = xp.reduce((s, e) => s + e.amount, 0)
  return {
    counted,
    duplicates,
    totals,
    streak,
    missions: currentMissions(ctx, todayDate),
    achievements,
    xp,
    xpTotal,
    level: levelFor(xpTotal),
  }
}
