import { useMemo, useRef, useSyncExternalStore } from 'react'
import { localDate } from '../domain/dates'
import { defaultSettings } from '../domain/defaults'
import { derive, type Derived } from '../domain/engine'
import type {
  Activity,
  AppNotification,
  CommunityEvent,
  CommunityState,
  Group,
  Place,
  PlannedSession,
  Post,
  SavedRoute,
  Settings,
} from '../domain/types'
import type { LiveSession } from './tracker'

export interface Celebration {
  id: string
  kind: 'xp' | 'level' | 'achievement' | 'info' | 'error'
  title: string
  detail?: string
}

export interface AppState {
  ready: boolean
  settings: Settings
  activities: Activity[]
  routes: SavedRoute[]
  places: Place[]
  events: CommunityEvent[]
  groups: Group[]
  planned: PlannedSession[]
  notifications: AppNotification[]
  posts: Post[]
  community: CommunityState
  /** Sessão interrompida encontrada ao abrir o app, aguardando decisão do usuário. */
  orphanSession: LiveSession | null
  today: string
  toasts: Celebration[]
  /** Falha ao abrir o armazenamento local (modo privado restrito, cota, etc.). */
  storageError: string | null
}

type Listener = () => void

let state: AppState = {
  ready: false,
  settings: defaultSettings(),
  activities: [],
  routes: [],
  places: [],
  events: [],
  groups: [],
  planned: [],
  notifications: [],
  posts: [],
  community: { following: [], blocked: [], reports: [] },
  orphanSession: null,
  today: localDate(Date.now()),
  toasts: [],
  storageError: null,
}

const listeners = new Set<Listener>()

export const store = {
  get: () => state,
  set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
    const p = typeof patch === 'function' ? patch(state) : patch
    state = { ...state, ...p }
    listeners.forEach((l) => l())
  },
  subscribe(l: Listener) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => Object.is(x, b[i]))
  return false
}

/** Seleciona parte do estado. Seletores que filtram listas devolvem a mesma referência enquanto o conteúdo não muda. */
export function useApp<T>(selector: (s: AppState) => T): T {
  const memo = useRef<{ state: AppState; value: T } | null>(null)
  const get = () => {
    const m = memo.current
    if (m && m.state === state) return m.value
    const value = selector(state)
    const stable = m && shallowEqual(m.value, value) ? m.value : value
    memo.current = { state, value: stable }
    return stable
  }
  return useSyncExternalStore(store.subscribe, get, get)
}

let cache: { key: unknown[]; value: Derived } | null = null

/** Estado derivado (sequência, XP, missões...) recalculado apenas quando os registros mudam. */
export function getDerived(s: AppState = state): Derived {
  const key = [s.activities, s.events, s.settings, s.today]
  if (cache && cache.key.every((k, i) => k === key[i])) return cache.value
  const value = derive(s.activities, s.events, s.settings, s.today)
  cache = { key, value }
  return value
}

export function useDerived(): Derived {
  const activities = useApp((s) => s.activities)
  const events = useApp((s) => s.events)
  const settings = useApp((s) => s.settings)
  const today = useApp((s) => s.today)
  return useMemo(() => getDerived({ ...state, activities, events, settings, today }), [activities, events, settings, today])
}
