import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { buildActivity, manualActivity } from '../domain/build'
import { derive } from '../domain/engine'
import { settings } from '../domain/testkit'
import { LocalRepository } from './localRepository'
import { SIGNAL_LOST_MS, Tracker, type LiveSession } from './tracker'

/** Geolocalização falsa controlada pelo teste. */
function fakeGeo() {
  let ok: PositionCallback | null = null
  let fail: PositionErrorCallback | null | undefined = null
  const geo = {
    watchPosition(s: PositionCallback, e?: PositionErrorCallback | null) { ok = s; fail = e; return 1 },
    clearWatch() { ok = null },
    getCurrentPosition() {},
  } as unknown as Geolocation
  return {
    geo,
    emit(lat: number, lng: number, acc: number, t: number) {
      ok?.({ timestamp: t, coords: { latitude: lat, longitude: lng, accuracy: acc, altitude: null, altitudeAccuracy: null, heading: null, speed: null } } as GeolocationPosition)
    },
    error(code: number) { fail?.({ code, message: '' } as GeolocationPositionError) },
  }
}

function makeTracker(now: { t: number }, geo?: Geolocation, secure = true) {
  const saved: LiveSession[] = []
  const t = new Tracker({ geolocation: geo, secure, now: () => now.t, persist: (s) => saved.push(s), heartRate: () => undefined })
  return { t, saved }
}

describe('Tracker (GPS)', () => {
  it('distingue contexto inseguro, ausência de suporte e permissão negada', () => {
    const now = { t: 0 }
    const insecure = makeTracker(now, fakeGeo().geo, false).t
    insecure.enable()
    expect(insecure.snapshot.error).toBe('insecure')
    const none = makeTracker(now, undefined).t
    none.enable()
    expect(none.snapshot.error).toBe('unsupported')
    const g = fakeGeo()
    const denied = makeTracker(now, g.geo).t
    denied.enable()
    g.error(1)
    expect(denied.snapshot.error).toBe('denied')
    expect(denied.snapshot.signal).toBe('none')
  })

  it('só fica pronto com leitura precisa; sinal fraco não é tratado como ativo', () => {
    const now = { t: 1000 }
    const g = fakeGeo()
    const { t } = makeTracker(now, g.geo)
    t.enable()
    expect(t.snapshot.status).toBe('requesting')
    g.emit(-5.8, -35.2, 80, 1000)
    expect(t.snapshot.status).toBe('acquiring')
    expect(t.snapshot.signal).toBe('weak')
    g.emit(-5.8, -35.2, 8, 2000)
    expect(t.snapshot.status).toBe('ready')
  })

  it('grava, pausa sem somar distância, retoma em novo trecho e detecta perda de sinal', () => {
    const now = { t: 0 }
    const g = fakeGeo()
    const { t, saved } = makeTracker(now, g.geo)
    t.enable()
    g.emit(-5.8, -35.2, 5, 0)
    t.start('walk', 's1')
    let lat = -5.8
    for (let i = 1; i <= 20; i++) { now.t = i * 5000; lat += 7 / 111195; g.emit(lat, -35.2, 5, now.t) }
    t.pause()
    now.t += 60000
    g.emit(lat + 0.01, -35.2, 5, now.t) // movimento durante a pausa: ignorado
    t.resume()
    expect(t.snapshot.session!.seg).toBe(1)
    for (let i = 1; i <= 5; i++) { now.t += 5000; lat += 7 / 111195; g.emit(lat + 0.01, -35.2, 5, now.t) }
    // sinal some
    now.t += SIGNAL_LOST_MS + 1000
    ;(t as unknown as { tick: () => void }).tick()
    expect(t.snapshot.signal).toBe('lost')
    const s = t.finish()!
    expect(s.signalGaps).toBe(1)
    expect(s.pausedMs).toBe(60000)
    expect(saved.length).toBeGreaterThan(0)
    const a = buildActivity({ id: s.id, sport: s.sport, source: 'gps', status: 'completed', startedAt: s.startedAt, endedAt: s.updatedAt, pausedMs: s.pausedMs, points: s.points, rawCount: s.rawCount, weakCount: s.weakCount, signalGaps: s.signalGaps, privacy: 'private', now: now.t }, true)
    expect(a.distanceM).toBeGreaterThan(160)
    expect(a.distanceM).toBeLessThan(185) // 25 passos de 7 m; o salto da pausa não entra
  })

  it('restaura sessão interrompida sempre em pausa', () => {
    const now = { t: 100000 }
    const { t } = makeTracker(now, fakeGeo().geo)
    const s: LiveSession = { id: 'x', sport: 'run', startedAt: 0, state: 'recording', seg: 0, points: [], rawCount: 0, weakCount: 0, pausedMs: 0, pauseStartedAt: null, signalGaps: 0, updatedAt: 50000 }
    t.restore(s)
    expect(t.snapshot.status).toBe('paused')
    expect(t.elapsedMs()).toBe(50000)
  })
})

describe('Repositório local (IndexedDB)', () => {
  it('persiste atividades e o XP é o mesmo após "recarregar"', async () => {
    const repo = new LocalRepository('test-db-1')
    const a = manualActivity({ id: 'm1', sport: 'walk', startedAt: new Date('2026-10-20T07:00').getTime(), minutes: 30, distanceKm: 2, title: '', privacy: 'private', now: 1 })
    await repo.put('activities', a)
    await repo.putSettings(settings())
    const before = derive([a], [], settings(), '2026-10-20').xpTotal
    const reopened = new LocalRepository('test-db-1')
    const acts = await reopened.all('activities')
    expect(acts).toHaveLength(1)
    expect(derive(acts, [], (await reopened.getSettings())!, '2026-10-20').xpTotal).toBe(before)
  })

  it('guarda trajeto, sessão em andamento e apaga tudo', async () => {
    const repo = new LocalRepository('test-db-2')
    await repo.putTrack({ activityId: 'a', points: [{ t: 1, lat: 0, lng: 0, acc: 5, seg: 0 }] })
    await repo.putLive({ id: 'l', sport: 'walk', startedAt: 0, state: 'paused', seg: 0, points: [], rawCount: 0, weakCount: 0, pausedMs: 0, pauseStartedAt: 0, signalGaps: 0, updatedAt: 0 })
    expect((await repo.getTrack('a'))!.points).toHaveLength(1)
    expect(await repo.getLive()).toBeDefined()
    await repo.wipe()
    expect(await repo.getTrack('a')).toBeUndefined()
    expect(await repo.getLive()).toBeUndefined()
  })
})
