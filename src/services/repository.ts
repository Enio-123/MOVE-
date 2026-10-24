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
  StoredTrack,
} from '../domain/types'
import type { LiveSession } from './tracker'

/** Coleções simples com chave `id`. */
export interface Collections {
  activities: Activity
  routes: SavedRoute
  places: Place
  events: CommunityEvent
  groups: Group
  planned: PlannedSession
  notifications: AppNotification
  posts: Post
}

export type CollectionName = keyof Collections

/**
 * Contrato de persistência. A interface fala apenas com este contrato: trocar o
 * armazenamento local por uma API (ex.: Supabase) significa escrever outra implementação,
 * sem mexer nas telas.
 */
export interface Repository {
  readonly kind: 'local' | 'remote'
  all<K extends CollectionName>(name: K): Promise<Collections[K][]>
  put<K extends CollectionName>(name: K, value: Collections[K]): Promise<void>
  putMany<K extends CollectionName>(name: K, values: Collections[K][]): Promise<void>
  remove<K extends CollectionName>(name: K, id: string): Promise<void>

  getTrack(activityId: string): Promise<StoredTrack | undefined>
  putTrack(track: StoredTrack): Promise<void>
  removeTrack(activityId: string): Promise<void>

  getPhoto(id: string): Promise<Blob | undefined>
  putPhoto(id: string, blob: Blob): Promise<void>
  removePhoto(id: string): Promise<void>

  getSettings(): Promise<Settings | undefined>
  putSettings(s: Settings): Promise<void>
  getCommunity(): Promise<CommunityState | undefined>
  putCommunity(s: CommunityState): Promise<void>

  /** Sessão de gravação em andamento, salva continuamente para recuperação após falhas. */
  getLive(): Promise<LiveSession | undefined>
  putLive(s: LiveSession): Promise<void>
  clearLive(): Promise<void>

  getKv<T>(key: string): Promise<T | undefined>
  putKv(key: string, value: unknown): Promise<void>

  /** Apaga todos os dados deste aparelho (direito de exclusão, LGPD). */
  wipe(): Promise<void>
}
