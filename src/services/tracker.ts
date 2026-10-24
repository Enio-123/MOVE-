import { MAX_ACCURACY_M, rejectReason } from '../domain/track'
import type { Sport, TrackPoint } from '../domain/types'

/** Estado persistido continuamente durante a gravação (para recuperar após recarregar a página). */
export interface LiveSession {
  id: string
  sport: Sport
  startedAt: number
  state: 'recording' | 'paused'
  seg: number
  points: TrackPoint[]
  rawCount: number
  weakCount: number
  pausedMs: number
  pauseStartedAt: number | null
  signalGaps: number
  updatedAt: number
}

export type TrackerStatus = 'idle' | 'requesting' | 'acquiring' | 'ready' | 'recording' | 'paused' | 'error'
export type SignalState = 'none' | 'good' | 'weak' | 'lost'
export type TrackerError = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | null

export interface Fix {
  lat: number
  lng: number
  acc: number
  t: number
  alt: number | null
  speed: number | null
}

export interface TrackerSnapshot {
  status: TrackerStatus
  signal: SignalState
  error: TrackerError
  lastFix: Fix | null
  session: LiveSession | null
  /** O navegador ficou em segundo plano por tempo suficiente para perder leituras. */
  suspendedGap: boolean
}

/** Sem leitura por mais que isso durante a gravação = sinal perdido. */
export const SIGNAL_LOST_MS = 15000

export interface TrackerDeps {
  geolocation: Geolocation | undefined
  secure: boolean
  now: () => number
  persist: (s: LiveSession) => void
  heartRate: () => number | undefined
}

/**
 * Máquina de estados do GPS. Nunca informa que o GPS está ativo sem uma leitura
 * real do navegador, e distingue permissão negada de ausência de sinal.
 */
export class Tracker {
  private watchId: number | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private listeners = new Set<() => void>()
  private gapOpen = false
  private snap: TrackerSnapshot = { status: 'idle', signal: 'none', error: null, lastFix: null, session: null, suspendedGap: false }
  private lastPersist = 0

  constructor(private deps: TrackerDeps) {}

  get snapshot() { return this.snap }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private set(patch: Partial<TrackerSnapshot>) {
    this.snap = { ...this.snap, ...patch }
    this.listeners.forEach((l) => l())
  }

  /** Começa a ouvir o GPS (pede a permissão, se ainda não concedida). */
  enable() {
    const { geolocation, secure } = this.deps
    if (!secure) return this.set({ status: 'error', error: 'insecure' })
    if (!geolocation) return this.set({ status: 'error', error: 'unsupported' })
    if (this.watchId !== null) return
    this.set({ status: this.snap.session ? this.snap.status : 'requesting', error: null })
    this.watchId = geolocation.watchPosition(this.onPosition, this.onError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000,
    })
    this.timer ??= setInterval(this.tick, 3000)
  }

  disable() {
    if (this.watchId !== null) this.deps.geolocation?.clearWatch(this.watchId)
    this.watchId = null
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (!this.snap.session) this.set({ status: 'idle', signal: 'none', lastFix: null })
  }

  private onPosition = (pos: GeolocationPosition) => {
    const c = pos.coords
    const fix: Fix = {
      lat: c.latitude,
      lng: c.longitude,
      acc: c.accuracy,
      t: pos.timestamp || this.deps.now(),
      alt: c.altitude,
      speed: c.speed,
    }
    const signal: SignalState = fix.acc <= MAX_ACCURACY_M ? 'good' : 'weak'
    this.gapOpen = false
    const s = this.snap.session
    if (!s) {
      this.set({ lastFix: fix, signal, error: null, status: signal === 'good' ? 'ready' : 'acquiring' })
      return
    }
    if (s.state === 'paused') {
      this.set({ lastFix: fix, signal, error: null })
      return
    }
    const p: TrackPoint = { t: fix.t, lat: fix.lat, lng: fix.lng, acc: fix.acc, alt: fix.alt, altAcc: c.altitudeAccuracy, seg: s.seg }
    const hr = this.deps.heartRate()
    if (hr) p.hr = hr
    const reason = rejectReason(s.points[s.points.length - 1] ?? null, p, s.sport)
    const next: LiveSession = {
      ...s,
      rawCount: s.rawCount + 1,
      weakCount: s.weakCount + (reason === 'weak' ? 1 : 0),
      points: reason === null ? [...s.points, p] : s.points,
      updatedAt: this.deps.now(),
    }
    this.set({ lastFix: fix, signal, error: null, session: next })
    this.save(next, reason === null)
  }

  private onError = (err: GeolocationPositionError) => {
    if (err.code === 1) {
      // Permissão negada: o usuário continua usando o resto do aplicativo.
      this.disable()
      this.set({ status: this.snap.session ? this.snap.status : 'error', error: 'denied', signal: 'none' })
    } else if (err.code === 2) {
      this.set({ signal: 'lost', error: this.snap.lastFix ? null : 'unavailable', status: this.snap.session ? this.snap.status : this.snap.lastFix ? this.snap.status : 'error' })
    } else {
      this.set({ signal: this.snap.lastFix ? 'lost' : 'none' })
    }
  }

  private tick = () => {
    const s = this.snap.session
    if (!s || s.state !== 'recording') return
    const last = this.snap.lastFix?.t ?? s.startedAt
    if (this.deps.now() - last > SIGNAL_LOST_MS && !this.gapOpen) {
      this.gapOpen = true
      const next = { ...s, signalGaps: s.signalGaps + 1 }
      this.set({ signal: 'lost', session: next })
      this.save(next, true)
    }
  }

  private save(s: LiveSession, force: boolean) {
    const now = this.deps.now()
    if (force || now - this.lastPersist > 5000) {
      this.lastPersist = now
      this.deps.persist(s)
    }
  }

  start(sport: Sport, id: string) {
    const now = this.deps.now()
    const session: LiveSession = {
      id, sport, startedAt: now, state: 'recording', seg: 0, points: [], rawCount: 0, weakCount: 0,
      pausedMs: 0, pauseStartedAt: null, signalGaps: 0, updatedAt: now,
    }
    // A leitura que confirmou o sinal vira o ponto inicial.
    const f = this.snap.lastFix
    if (f && f.acc <= MAX_ACCURACY_M && now - f.t < 10000) {
      session.points.push({ t: now, lat: f.lat, lng: f.lng, acc: f.acc, alt: f.alt, seg: 0 })
      session.rawCount = 1
    }
    this.set({ session, status: 'recording', suspendedGap: false })
    this.save(session, true)
  }

  pause() {
    const s = this.snap.session
    if (!s || s.state !== 'recording') return
    const next: LiveSession = { ...s, state: 'paused', pauseStartedAt: this.deps.now(), updatedAt: this.deps.now() }
    this.set({ session: next, status: 'paused' })
    this.save(next, true)
  }

  resume() {
    const s = this.snap.session
    if (!s || s.state !== 'paused') return
    const now = this.deps.now()
    const next: LiveSession = {
      ...s, state: 'recording', seg: s.seg + 1, pausedMs: s.pausedMs + (now - (s.pauseStartedAt ?? now)), pauseStartedAt: null, updatedAt: now,
    }
    this.set({ session: next, status: 'recording', suspendedGap: false })
    this.save(next, true)
  }

  /** Restaura uma sessão interrompida, sempre em pausa: o trecho seguinte começa separado. */
  restore(s: LiveSession) {
    const now = this.deps.now()
    const restored: LiveSession = s.state === 'paused' ? s : { ...s, state: 'paused', pauseStartedAt: s.updatedAt || now }
    this.set({ session: restored, status: 'paused' })
    this.save(restored, true)
  }

  /** Marca que a página ficou oculta tempo suficiente para o navegador suspender o GPS. */
  noteSuspended(ms: number) {
    const s = this.snap.session
    if (!s || s.state !== 'recording' || ms < 20000) return
    const next = { ...s, signalGaps: s.signalGaps + 1 }
    this.set({ session: next, suspendedGap: true })
    this.save(next, true)
  }

  elapsedMs(now = this.deps.now()): number {
    const s = this.snap.session
    if (!s) return 0
    const pausedNow = s.state === 'paused' && s.pauseStartedAt ? now - s.pauseStartedAt : 0
    return Math.max(0, now - s.startedAt - s.pausedMs - pausedNow)
  }

  /** Encerra a sessão e devolve os dados para salvar. */
  finish(): LiveSession | null {
    const s = this.snap.session
    if (!s) return null
    const now = this.deps.now()
    const closed: LiveSession =
      s.state === 'paused' ? { ...s, pausedMs: s.pausedMs + (now - (s.pauseStartedAt ?? now)), pauseStartedAt: null, updatedAt: now } : { ...s, updatedAt: now }
    this.set({ session: null, status: this.watchId !== null ? 'ready' : 'idle', suspendedGap: false })
    return closed
  }

  discard() {
    this.set({ session: null, status: this.watchId !== null ? 'ready' : 'idle', suspendedGap: false })
  }
}
