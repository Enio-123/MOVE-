import { openDB, type IDBPDatabase } from 'idb'
import type { CommunityState, Settings, StoredTrack } from '../domain/types'
import type { CollectionName, Collections, Repository } from './repository'
import type { LiveSession } from './tracker'

const DB_NAME = 'moveplus'
const VERSION = 1
const COLLECTIONS: CollectionName[] = ['activities', 'routes', 'places', 'events', 'groups', 'planned', 'notifications', 'posts']

/** Implementação local com IndexedDB. Os dados ficam apenas neste navegador. */
export class LocalRepository implements Repository {
  readonly kind = 'local' as const
  private db: Promise<IDBPDatabase>

  constructor(name = DB_NAME) {
    this.db = openDB(name, VERSION, {
      upgrade(db) {
        for (const c of COLLECTIONS) db.createObjectStore(c, { keyPath: 'id' })
        db.createObjectStore('tracks', { keyPath: 'activityId' })
        db.createObjectStore('photos')
        db.createObjectStore('kv')
      },
    })
  }

  async all<K extends CollectionName>(name: K): Promise<Collections[K][]> {
    return (await this.db).getAll(name)
  }
  async put<K extends CollectionName>(name: K, value: Collections[K]) {
    await (await this.db).put(name, value)
  }
  async putMany<K extends CollectionName>(name: K, values: Collections[K][]) {
    const tx = (await this.db).transaction(name, 'readwrite')
    await Promise.all([...values.map((v) => tx.store.put(v)), tx.done])
  }
  async remove<K extends CollectionName>(name: K, id: string) {
    await (await this.db).delete(name, id)
  }

  async getTrack(activityId: string): Promise<StoredTrack | undefined> {
    return (await this.db).get('tracks', activityId)
  }
  async putTrack(track: StoredTrack) {
    await (await this.db).put('tracks', track)
  }
  async removeTrack(activityId: string) {
    await (await this.db).delete('tracks', activityId)
  }

  async getPhoto(id: string): Promise<Blob | undefined> {
    return (await this.db).get('photos', id)
  }
  async putPhoto(id: string, blob: Blob) {
    await (await this.db).put('photos', blob, id)
  }
  async removePhoto(id: string) {
    await (await this.db).delete('photos', id)
  }

  async getKv<T>(key: string): Promise<T | undefined> {
    return (await this.db).get('kv', key)
  }
  async putKv(key: string, value: unknown) {
    await (await this.db).put('kv', value, key)
  }

  getSettings() { return this.getKv<Settings>('settings') }
  putSettings(s: Settings) { return this.putKv('settings', s) }
  getCommunity() { return this.getKv<CommunityState>('community') }
  putCommunity(s: CommunityState) { return this.putKv('community', s) }
  getLive() { return this.getKv<LiveSession>('live') }
  putLive(s: LiveSession) { return this.putKv('live', s) }
  async clearLive() { await (await this.db).delete('kv', 'live') }

  async wipe() {
    const db = await this.db
    const stores = [...COLLECTIONS, 'tracks', 'photos', 'kv']
    const tx = db.transaction(stores, 'readwrite')
    await Promise.all([...stores.map((s) => tx.objectStore(s).clear()), tx.done])
  }
}
