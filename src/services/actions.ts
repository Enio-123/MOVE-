import { buildActivity, manualActivity } from '../domain/build'
import { localDate } from '../domain/dates'
import { defaultSettings } from '../domain/defaults'
import { parseTrackFile } from '../domain/gpx'
import { parseFit } from '../domain/fit'
import type {
  Activity,
  AppNotification,
  CommunityEvent,
  CommunityState,
  Group,
  NotificationKind,
  Place,
  PlannedSession,
  Post,
  SavedRoute,
  Settings,
  Sport,
  TrackPoint,
} from '../domain/types'
import { demoEvents, demoGroups, demoPosts } from './demo'
import { uid } from './ids'
import { LocalRepository } from './localRepository'
import type { CollectionName, Collections, Repository } from './repository'
import { getDerived, store, type Celebration } from './store'
import type { LiveSession } from './tracker'

export let repo: Repository = new LocalRepository()

const ME = 'me'
export { ME }

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  if (i < 0) return [...list, item]
  const copy = list.slice()
  copy[i] = item
  return copy
}

async function save<K extends CollectionName>(name: K, item: Collections[K]) {
  const s = store.get()
  store.set({ [name]: upsert(s[name] as unknown as Collections[K][], item) } as never)
  if ((item as { origin?: string }).origin === 'demo') return
  await repo.put(name, item)
  afterChange()
}

async function drop<K extends CollectionName>(name: K, id: string) {
  const s = store.get()
  const list = s[name] as unknown as Collections[K][]
  const item = list.find((x) => x.id === id) as { origin?: string } | undefined
  store.set({ [name]: list.filter((x) => x.id !== id) } as never)
  if (item?.origin === 'demo') return
  await repo.remove(name, id)
  afterChange()
}

export function toast(t: Omit<Celebration, 'id'>) {
  const c = { ...t, id: uid() }
  store.set((s) => ({ toasts: [...s.toasts, c] }))
  setTimeout(() => store.set((s) => ({ toasts: s.toasts.filter((x) => x.id !== c.id) })), t.kind === 'level' ? 4200 : 3200)
}

// ---------- Inicialização ----------

export function dismissCelebration() {
  store.set({ celebration: null })
}

export async function init(customRepo?: Repository) {
  if (customRepo) repo = customRepo
  try {
    const [settings, activities, routes, places, events, groups, planned, notifications, posts, community, live, seen] = await Promise.all([
      repo.getSettings(),
      repo.all('activities'),
      repo.all('routes'),
      repo.all('places'),
      repo.all('events'),
      repo.all('groups'),
      repo.all('planned'),
      repo.all('notifications'),
      repo.all('posts'),
      repo.getCommunity(),
      repo.getLive(),
      repo.getKv<string[]>('seenRewards'),
    ])
    const [stepLog, healthSteps] = await Promise.all([repo.getKv<Record<string, number>>('stepLog'), repo.getKv<Record<string, number>>('healthSteps')])
    let s = { ...defaultSettings(), ...(settings ?? {}) }
    // Identidade nova: quem já usava o tema escuro padrão passa para o claro da marca (pode voltar em Ajustes).
    if (settings && !settings.brandV) s = { ...s, theme: settings.theme === 'dark' ? 'light' : s.theme, brandV: 2 }
    if (!settings || !settings.brandV) await repo.putSettings(s)
    store.set({
      ready: true,
      settings: s,
      activities,
      routes,
      places,
      events,
      groups,
      planned,
      notifications: notifications.sort((a, b) => b.at - a.at),
      posts,
      community: community ?? { following: [], blocked: [], reports: [] },
      orphanSession: live ?? null,
      today: localDate(Date.now()),
      stepLog: stepLog ?? {},
      healthSteps: healthSteps ?? {},
    })
    seenRewards = new Set(seen ?? getDerived().xp.map((e) => e.key))
    if (!seen) await repo.putKv('seenRewards', [...seenRewards])
    levelCache = getDerived().level.level
    if (s.showDemoCommunity) loadDemo(true)
    remindUpcoming()
  } catch (e) {
    store.set({ ready: true, storageError: e instanceof Error ? e.message : String(e) })
  }
  // Virada do dia com o app aberto: recalcula sequência e missões.
  if (dayTimer) return
  dayTimer = setInterval(() => {
    const t = localDate(Date.now())
    if (t !== store.get().today) store.set({ today: t })
    checkDailyReminder()
  }, 30000)
}

let dayTimer: ReturnType<typeof setInterval> | null = null

function loadDemo(on: boolean) {
  const now = Date.now()
  store.set((s) => ({
    events: on ? [...s.events.filter((e) => e.origin !== 'demo'), ...demoEvents(now)] : s.events.filter((e) => e.origin !== 'demo'),
    groups: on ? [...s.groups.filter((g) => g.origin !== 'demo'), ...demoGroups(now)] : s.groups.filter((g) => g.origin !== 'demo'),
    posts: on ? [...s.posts.filter((p) => p.origin !== 'demo'), ...demoPosts(now)] : s.posts.filter((p) => p.origin !== 'demo'),
  }))
}

// ---------- Recompensas e notificações ----------

let seenRewards = new Set<string>()

/** Depois de qualquer mudança, identifica recompensas novas para anunciar (sem duplicar). */
function afterChange() {
  const before = store.get()
  const prevLevel = levelCache ?? getDerived(before).level.level
  const d = getDerived()
  const fresh = d.xp.filter((e) => !seenRewards.has(e.key))
  if (fresh.length) {
    for (const e of fresh) seenRewards.add(e.key)
    void repo.putKv('seenRewards', [...seenRewards])
    const total = fresh.reduce((s, e) => s + e.amount, 0)
    toast({ kind: 'xp', title: `+${total} XP`, detail: fresh.length === 1 ? fresh[0].label : `${fresh.length} recompensas` })
    const unlocked: string[] = []
    for (const e of fresh) {
      if (e.kind === 'achievement') {
        unlocked.push(e.label.replace('Conquista: ', ''))
        void notify(`n:${e.key}`, 'achievement', 'Conquista desbloqueada', e.label.replace('Conquista: ', ''), '#/conquistas')
      } else if (e.kind === 'mission') {
        void notify(`n:${e.key}`, 'mission', 'Missão concluída', `${e.label.replace('Missão: ', '')} · +${e.amount} XP`, '#/missoes')
      } else {
        void notify(`n:${e.key}`, 'xp', `+${e.amount} XP`, e.label, '#/perfil')
      }
    }
    if (unlocked.length && d.level.level <= prevLevel) {
      store.set({ celebration: { kind: 'achievement', title: unlocked[0], detail: 'Conquista desbloqueada', more: unlocked.length - 1 } })
    }
  }
  if (d.level.level > prevLevel) {
    store.set({ celebration: { kind: 'level', title: d.level.name, detail: `Você chegou ao nível ${d.level.level}`, more: 0, level: d.level.level } })
    void notify(`n:level:${d.level.level}`, 'xp', `Você chegou ao nível ${d.level.level}`, d.level.name, '#/perfil')
  }
  levelCache = d.level.level
}
let levelCache: number | null = null

export async function notify(key: string, kind: NotificationKind, title: string, body: string, href?: string) {
  const s = store.get()
  if (!s.settings.reminders.categories[kind]) return
  if (s.notifications.some((n) => n.key === key)) return
  const n: AppNotification = { id: uid(), key, kind, title, body, at: Date.now(), read: false, href }
  store.set({ notifications: [n, ...s.notifications] })
  await repo.put('notifications', n)
  if (s.settings.reminders.system) void systemNotify(title, body)
}

/** Notificação do sistema, somente com permissão e enquanto o app estiver aberto (sem servidor de push). */
async function systemNotify(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' })
    else new Notification(title, { body })
  } catch {
    /* navegador recusou: a notificação interna já foi criada */
  }
}

export async function markRead(id?: string) {
  const s = store.get()
  const updated = s.notifications.map((n) => (!id || n.id === id ? { ...n, read: true } : n))
  store.set({ notifications: updated })
  await repo.putMany('notifications', updated.filter((n) => !id || n.id === id))
}

export async function clearNotifications() {
  for (const n of store.get().notifications) await repo.remove('notifications', n.id)
  store.set({ notifications: [] })
}

/** Lembretes internos de encontros e treinos planejados para as próximas 24 h. */
function remindUpcoming() {
  const s = store.get()
  const now = Date.now()
  for (const e of s.events) {
    if (e.going && e.origin !== 'demo' && e.startsAt > now && e.startsAt - now < 86400000) {
      void notify(`n:event-soon:${e.id}`, 'event', 'Encontro nas próximas 24 h', `${e.title} · ${new Date(e.startsAt).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`, `#/evento/${e.id}`)
    }
  }
  for (const p of s.planned) {
    if (p.date === s.today) void notify(`n:plan:${p.id}`, 'reminder', 'Treino planejado para hoje', `${p.time} · ${p.targetMin} min`, '#/calendario')
  }
  const d = getDerived()
  if (d.streak.pendingToday && d.streak.current >= 2) {
    void notify(`n:streak-pending:${s.today}`, 'goal', `Sequência de ${d.streak.current} dias`, 'Uma atividade hoje mantém a sequência. Qualquer ritmo vale.', '#/registrar')
  }
}

/** Lembrete diário: só avisa se ainda não houve atividade no dia (sem culpa, sem insistência). */
function checkDailyReminder() {
  const s = store.get()
  const r = s.settings.reminders
  if (!r.enabled) return
  const now = new Date()
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  if (hhmm < r.time) return
  if (getDerived().totals.get(s.today)?.count) return
  void notify(`n:daily:${s.today}`, 'reminder', 'Que tal se movimentar hoje?', 'Uma caminhada curta já conta para a sua meta.', '#/registrar')
}

// ---------- Configurações ----------

export async function updateSettings(patch: Partial<Settings>) {
  const s = store.get()
  const next = { ...s.settings, ...patch }
  if (patch.fitness && patch.fitness !== s.settings.fitness) {
    const log = s.settings.fitnessLog.length ? s.settings.fitnessLog : [{ from: localDate(s.settings.createdAt), level: s.settings.fitness }]
    next.fitnessLog = [...log.filter((e) => e.from !== s.today), { from: s.today, level: patch.fitness }]
  }
  store.set({ settings: next })
  await repo.putSettings(next)
  if ('showDemoCommunity' in patch) loadDemo(!!patch.showDemoCommunity)
  if ('dailyGoalMin' in patch || 'streakRule' in patch) afterChange()
}

// ---------- Atividades ----------

export async function saveRecorded(session: LiveSession, meta: { title: string; description: string; privacy: Activity['privacy']; photos: Blob[]; steps?: number | null }) {
  const now = Date.now()
  const a = buildActivity(
    {
      id: session.id, sport: session.sport, source: 'gps', status: 'completed', startedAt: session.startedAt, endedAt: session.updatedAt,
      pausedMs: session.pausedMs, points: session.points, rawCount: session.rawCount, weakCount: session.weakCount, signalGaps: session.signalGaps,
      privacy: meta.privacy, title: meta.title, now,
    },
    true,
  )
  a.description = meta.description
  if (meta.steps) a.steps = meta.steps
  a.photoIds = await storePhotos(meta.photos)
  if (session.points.length > 1) await repo.putTrack({ activityId: a.id, points: session.points })
  await save('activities', a)
  await repo.clearLive()
  return a
}

/** Salva uma sessão recuperada como incompleta (identificada como "recuperada"). */
export async function saveRecovered(session: LiveSession) {
  const a = buildActivity(
    {
      id: session.id, sport: session.sport, source: 'gps', status: 'recovered', startedAt: session.startedAt, endedAt: session.updatedAt,
      pausedMs: session.pausedMs + (session.state === 'paused' && session.pauseStartedAt ? session.updatedAt - session.pauseStartedAt : 0),
      points: session.points, rawCount: session.rawCount, weakCount: session.weakCount, signalGaps: session.signalGaps + 1,
      privacy: store.get().settings.defaultPrivacy, now: Date.now(),
    },
    true,
  )
  if (session.points.length > 1) await repo.putTrack({ activityId: a.id, points: session.points })
  await save('activities', a)
  await repo.clearLive()
  store.set({ orphanSession: null })
  return a
}

export async function discardLive() {
  await repo.clearLive()
  store.set({ orphanSession: null })
}

export async function addManual(p: { sport: Sport; startedAt: number; minutes: number; distanceKm: number | null; title: string }) {
  const a = manualActivity({ ...p, id: uid(), privacy: store.get().settings.defaultPrivacy, now: Date.now() })
  await save('activities', a)
  return a
}

export type ImportResult = { ok: true; activity: Activity } | { ok: false; reason: string }

/** Importa GPX/TCX exportado de relógio ou outro app. Arquivos repetidos são recusados. */
export async function importTrack(fileName: string, text: string, sportOverride?: Sport): Promise<ImportResult> {
  const parsed = parseTrackFile(text)
  if (parsed.points.length < 2) return { ok: false, reason: 'O arquivo não tem pontos de GPS com horário. Exporte a atividade em GPX ou TCX com o trajeto.' }
  const externalId = `file:${parsed.fingerprint}`
  if (store.get().activities.some((a) => a.externalId === externalId)) return { ok: false, reason: 'Esta atividade já foi importada antes.' }
  const pts: TrackPoint[] = parsed.points
  const a = buildActivity(
    {
      id: uid(), sport: sportOverride ?? parsed.sport ?? 'walk', source: 'import', status: 'completed',
      startedAt: pts[0].t, endedAt: pts[pts.length - 1].t, pausedMs: 0, points: pts, privacy: store.get().settings.defaultPrivacy,
      title: parsed.name ?? fileName.replace(/\.(gpx|tcx)$/i, ''), externalId, now: Date.now(),
    },
    false,
  )
  await repo.putTrack({ activityId: a.id, points: pts })
  await save('activities', a)
  return { ok: true, activity: a }
}

/** Importa um arquivo .FIT de relógio ou ciclocomputador. */
export async function importFitFile(fileName: string, buf: ArrayBuffer, sportOverride?: Sport): Promise<ImportResult> {
  let parsed: ReturnType<typeof parseFit>
  try {
    parsed = parseFit(buf)
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Arquivo FIT inválido.' }
  }
  if (parsed.points.length < 2) return { ok: false, reason: 'O arquivo FIT não tem trajeto com GPS (atividade em ambiente fechado ou relógio sem GPS).' }
  const externalId = `file:${parsed.fingerprint}`
  if (store.get().activities.some((a) => a.externalId === externalId)) return { ok: false, reason: 'Esta atividade já foi importada antes.' }
  const pts = parsed.points
  const a = buildActivity(
    {
      id: uid(), sport: sportOverride ?? parsed.sport ?? 'walk', source: 'import', status: 'completed',
      startedAt: pts[0].t, endedAt: pts[pts.length - 1].t, pausedMs: 0, points: pts, privacy: store.get().settings.defaultPrivacy,
      title: fileName.replace(/\.fit$/i, ''), externalId, now: Date.now(),
    },
    false,
  )
  await repo.putTrack({ activityId: a.id, points: pts })
  await save('activities', a)
  return { ok: true, activity: a }
}

export interface HealthImportSummary {
  added: number
  repeated: number
  skipped: number
  stepDays: number
}

/** Importa treinos e passos da exportação do Apple Saúde (lida no aparelho, nada é enviado). */
export async function importAppleHealth(file: File, onProgress?: (f: number) => void): Promise<HealthImportSummary> {
  const { readAppleHealth } = await import('./healthImport')
  const r = await readAppleHealth(file, onProgress)
  const s = store.get()
  const existing = new Set(s.activities.map((a) => a.externalId))
  const now = Date.now()
  const fresh: Activity[] = []
  let repeated = 0
  for (const w of r.workouts) {
    const externalId = `health:${w.startedAt}:${w.sport}`
    if (existing.has(externalId)) { repeated++; continue }
    const base = buildActivity(
      { id: uid(), sport: w.sport, source: 'health', status: 'completed', startedAt: w.startedAt, endedAt: w.endedAt, pausedMs: Math.max(0, w.endedAt - w.startedAt - w.durationS * 1000), points: [], privacy: s.settings.defaultPrivacy, externalId, now },
      true,
    )
    fresh.push({ ...base, distanceM: w.distanceM ?? 0, movingS: Math.round(w.durationS), description: `Importado do Apple Saúde (${w.sourceName}).`, hasTrack: false })
  }
  if (fresh.length) {
    await repo.putMany('activities', fresh)
    store.set((st) => ({ activities: [...st.activities, ...fresh] }))
  }
  const healthSteps = { ...s.healthSteps, ...r.steps }
  store.set({ healthSteps })
  await repo.putKv('healthSteps', healthSteps)
  afterChange()
  return { added: fresh.length, repeated, skipped: r.skippedWorkouts, stepDays: Object.keys(r.steps).length }
}

/** Remove tudo o que veio do Apple Saúde (treinos e passos). */
export async function removeHealthData() {
  const ids = store.get().activities.filter((a) => a.source === 'health').map((a) => a.id)
  for (const id of ids) await repo.remove('activities', id)
  store.set((st) => ({ activities: st.activities.filter((a) => a.source !== 'health'), healthSteps: {} }))
  await repo.putKv('healthSteps', {})
  afterChange()
}

/** Apaga os passos contados pelo sensor deste celular. */
export async function clearStepLog() {
  store.set({ stepLog: {} })
  await repo.putKv('stepLog', {})
}

export async function updateActivity(id: string, patch: Partial<Pick<Activity, 'title' | 'description' | 'privacy' | 'sport' | 'duplicateOf'>>) {
  const a = store.get().activities.find((x) => x.id === id)
  if (!a) return
  await save('activities', { ...a, ...patch, updatedAt: Date.now() })
}

/** Exclui a atividade, o trajeto e as fotos. Sequência, XP e estatísticas são recalculados. */
export async function deleteActivity(id: string) {
  const a = store.get().activities.find((x) => x.id === id)
  if (!a) return
  await repo.removeTrack(id)
  for (const p of a.photoIds) await repo.removePhoto(p)
  // XP de recompensas removidas pode voltar a ser anunciado se reconquistado.
  seenRewards.delete(`activity:${id}`)
  await drop('activities', id)
}

async function storePhotos(files: Blob[]): Promise<string[]> {
  const ids: string[] = []
  for (const f of files) {
    const id = uid()
    await repo.putPhoto(id, await downscale(f))
    ids.push(id)
  }
  return ids
}

export async function addPhotos(activityId: string, files: Blob[]) {
  const a = store.get().activities.find((x) => x.id === activityId)
  if (!a) return
  const ids = await storePhotos(files)
  await save('activities', { ...a, photoIds: [...a.photoIds, ...ids], updatedAt: Date.now() })
}

export async function removePhoto(activityId: string, photoId: string) {
  const a = store.get().activities.find((x) => x.id === activityId)
  if (!a) return
  await repo.removePhoto(photoId)
  await save('activities', { ...a, photoIds: a.photoIds.filter((p) => p !== photoId), updatedAt: Date.now() })
}

/** Reduz fotos para no máximo 1600 px (economiza espaço e remove metadados como GPS da câmera). */
async function downscale(file: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale)
    c.height = Math.round(bmp.height * scale)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), 'image/jpeg', 0.85))
  } catch {
    return file
  }
}

// ---------- Mapa, calendário e comunidade ----------

export const saveRoute = (r: SavedRoute) => save('routes', r)
export const deleteRoute = (id: string) => drop('routes', id)
export const savePlace = (p: Place) => save('places', p)
export const deletePlace = (id: string) => drop('places', id)
export const savePlanned = (p: PlannedSession) => save('planned', p)
export const deletePlanned = (id: string) => drop('planned', id)
export const saveEvent = (e: CommunityEvent) => save('events', e)
export const deleteEvent = (id: string) => drop('events', id)
export const saveGroup = (g: Group) => save('groups', g)
export const deleteGroup = (id: string) => drop('groups', id)
export const savePost = (p: Post) => save('posts', p)
export const deletePost = (id: string) => drop('posts', id)

export async function updateCommunity(patch: Partial<CommunityState>) {
  const next = { ...store.get().community, ...patch }
  store.set({ community: next })
  await repo.putCommunity(next)
}

// ---------- Dados pessoais (LGPD) ----------

export async function exportAll(): Promise<Blob> {
  const s = store.get()
  const tracks = await Promise.all(s.activities.filter((a) => a.hasTrack).map((a) => repo.getTrack(a.id)))
  const data = {
    app: 'Move+',
    format: 1,
    exportedAt: new Date().toISOString(),
    settings: s.settings,
    activities: s.activities,
    tracks: tracks.filter(Boolean),
    routes: s.routes,
    places: s.places,
    events: s.events.filter((e) => e.origin !== 'demo'),
    groups: s.groups.filter((g) => g.origin !== 'demo'),
    planned: s.planned,
    posts: s.posts.filter((p) => p.origin !== 'demo'),
    community: s.community,
    stepLog: s.stepLog,
    healthSteps: s.healthSteps,
  }
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

export async function importBackup(text: string): Promise<string> {
  const data = JSON.parse(text)
  if (data?.app !== 'Move+' || data.format !== 1) throw new Error('Arquivo não reconhecido como backup da Move+.')
  const lists: CollectionName[] = ['activities', 'routes', 'places', 'events', 'groups', 'planned', 'posts']
  for (const name of lists) if (Array.isArray(data[name])) await repo.putMany(name, data[name])
  for (const t of data.tracks ?? []) await repo.putTrack(t)
  if (data.settings) await repo.putSettings({ ...defaultSettings(), ...data.settings, introSeen: true, onboarded: true })
  if (data.community) await repo.putCommunity(data.community)
  if (data.stepLog) await repo.putKv('stepLog', data.stepLog)
  if (data.healthSteps) await repo.putKv('healthSteps', data.healthSteps)
  await repo.putKv('seenRewards', null)
  const count = Array.isArray(data.activities) ? data.activities.length : 0
  await init()
  return `${count} atividades restauradas.`
}

export async function wipeAll() {
  await repo.wipe()
  if (typeof localStorage !== 'undefined') try { localStorage.clear() } catch { /* sem acesso */ }
}
