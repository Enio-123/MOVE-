import { useSyncExternalStore } from 'react'
import { localDate } from '../domain/dates'
import { StepDetector } from '../domain/steps'
import { repo } from './actions'
import { store } from './store'

export type PedometerStatus = 'off' | 'on' | 'denied' | 'unsupported' | 'no-sensor'

interface Snapshot {
  status: PedometerStatus
  /** Motivos ativos: contador manual e/ou gravação com GPS. */
  reasons: string[]
  /** Passos desde que o contador ligou nesta sessão. */
  session: number
}

type MotionCtor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

/**
 * Contador de passos pelo acelerômetro, enquanto o app está aberto.
 * Cada passo entra no registro diário (store.stepLog), salvo no aparelho.
 * Em iPhone, o Safari pede permissão de "Movimento e orientação" no primeiro uso.
 */
class Pedometer {
  private snap: Snapshot = { status: 'off', reasons: [], session: 0 }
  private listeners = new Set<() => void>()
  private detector = new StepDetector()
  private gotSample = false
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private sensorCheck: ReturnType<typeof setTimeout> | null = null
  /** Passos contados desde que a página abriu (todas as razões). */
  private total = 0
  private recMark: number | null = null

  /** Começa a contar os passos de uma gravação com GPS (modalidades a pé). */
  async beginRecording() {
    const st = await this.start('rec')
    this.recMark = st === 'on' ? this.total : null
  }
  /** Passos desde o início da gravação, ou null se o sensor não estava contando. */
  recordingSteps(): number | null {
    return this.recMark == null || this.snap.status !== 'on' ? null : this.total - this.recMark
  }
  endRecording() {
    this.recMark = null
    this.stop('rec')
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  get = () => this.snap
  private set(p: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...p }
    this.listeners.forEach((l) => l())
  }

  static supported() {
    return typeof window !== 'undefined' && 'DeviceMotionEvent' in window
  }

  /** Liga por um motivo ('counter' ou 'rec'). Deve ser chamado a partir de um toque do usuário (iPhone). */
  async start(reason: string): Promise<PedometerStatus> {
    if (!Pedometer.supported()) {
      this.set({ status: 'unsupported' })
      return 'unsupported'
    }
    const M = DeviceMotionEvent as MotionCtor
    if (typeof M.requestPermission === 'function') {
      try {
        if ((await M.requestPermission()) !== 'granted') {
          this.set({ status: 'denied' })
          return 'denied'
        }
      } catch {
        this.set({ status: 'denied' })
        return 'denied'
      }
    }
    if (!this.snap.reasons.includes(reason)) this.set({ reasons: [...this.snap.reasons, reason] })
    if (this.snap.status !== 'on') {
      this.detector = new StepDetector()
      this.gotSample = false
      addEventListener('devicemotion', this.onMotion)
      this.set({ status: 'on', session: 0 })
      // Computadores e alguns aparelhos não têm acelerômetro: nenhum evento chega.
      this.sensorCheck = setTimeout(() => {
        if (!this.gotSample) {
          this.stopAll()
          this.set({ status: 'no-sensor' })
        }
      }, 2500)
    }
    return 'on'
  }

  stop(reason: string) {
    const reasons = this.snap.reasons.filter((r) => r !== reason)
    this.set({ reasons })
    if (!reasons.length) this.stopAll()
  }

  private stopAll() {
    removeEventListener('devicemotion', this.onMotion)
    if (this.sensorCheck) clearTimeout(this.sensorCheck)
    this.flush()
    this.set({ status: this.snap.status === 'on' ? 'off' : this.snap.status, reasons: [] })
  }

  private onMotion = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity
    if (!a || a.x == null || a.y == null || a.z == null) return
    this.gotSample = true
    if (this.detector.push(e.timeStamp || performance.now(), a.x, a.y, a.z)) this.addStep()
  }

  private addStep() {
    const day = localDate(Date.now())
    store.set((s) => ({ stepLog: { ...s.stepLog, [day]: (s.stepLog[day] ?? 0) + 1 } }))
    this.total++
    this.set({ session: this.snap.session + 1 })
    if (!this.saveTimer) this.saveTimer = setTimeout(() => this.flush(), 4000)
  }

  private flush() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    void repo.putKv('stepLog', store.get().stepLog)
  }
}

export const pedometer = new Pedometer()

export function usePedometer() {
  return useSyncExternalStore(pedometer.subscribe, pedometer.get)
}

export const pedometerSupported = () => Pedometer.supported()
