import type { NotificationKind, Settings } from './types'

const ALL_KINDS: Record<NotificationKind, boolean> = {
  goal: true,
  mission: true,
  xp: true,
  achievement: true,
  event: true,
  sync: true,
  reminder: true,
}

export function defaultSettings(now = Date.now()): Settings {
  return {
    theme: 'dark',
    introSeen: false,
    onboarded: false,
    displayName: '',
    bio: '',
    avatarId: null,
    favoriteSports: ['walk'],
    fitness: 'beginner',
    fitnessLog: [],
    dailyGoalMin: 20,
    streakRule: { kind: 'activity', minMinutes: 10 },
    defaultPrivacy: 'private',
    weightKg: null,
    units: 'metric',
    textScale: 1,
    reduceMotion: 'system',
    highContrast: false,
    reminders: { enabled: false, time: '18:00', categories: { ...ALL_KINDS }, system: false },
    showDemoCommunity: false,
    createdAt: now,
  }
}
