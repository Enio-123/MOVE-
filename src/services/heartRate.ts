// Monitor cardíaco Bluetooth Low Energy pelo perfil padrão Heart Rate (GATT 0x180D).
// Funciona com cintas e relógios que transmitem frequência cardíaca no modo "broadcast"
// (Polar H10, Garmin HRM, Wahoo TICKR, muitos relógios com a opção ativada).
// Requer Web Bluetooth: Chrome/Edge no Android, Windows, macOS e ChromeOS. Safari/iOS não suportam.

export type HrStatus = 'unsupported' | 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

interface HrState {
  status: HrStatus
  deviceName: string | null
  bpm: number | null
  lastAt: number | null
  error: string | null
  contactDetected: boolean | null
}

type BtDevice = {
  name?: string
  gatt?: { connect(): Promise<BtServer>; connected: boolean; disconnect(): void }
  addEventListener(type: 'gattserverdisconnected', fn: () => void): void
}
type BtServer = { getPrimaryService(s: string | number): Promise<{ getCharacteristic(c: string | number): Promise<BtChar> }> }
type BtChar = EventTarget & { startNotifications(): Promise<BtChar>; value?: DataView }

const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { bluetooth?: { requestDevice(o: unknown): Promise<BtDevice>; getAvailability?(): Promise<boolean> } }) : undefined

let state: HrState = {
  status: nav?.bluetooth ? 'idle' : 'unsupported',
  deviceName: null,
  bpm: null,
  lastAt: null,
  error: null,
  contactDetected: null,
}
let device: BtDevice | null = null
const listeners = new Set<() => void>()

function set(p: Partial<HrState>) {
  state = { ...state, ...p }
  listeners.forEach((l) => l())
}

export const heartRate = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  /** Valor recente (até 5 s) para anexar aos pontos da gravação. */
  current(): number | undefined {
    return state.status === 'connected' && state.bpm && state.lastAt && Date.now() - state.lastAt < 5000 ? state.bpm : undefined
  },
  async connect() {
    if (!nav?.bluetooth) return set({ status: 'unsupported' })
    try {
      set({ status: 'connecting', error: null })
      device = await nav.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] })
      device.addEventListener('gattserverdisconnected', () => set({ status: 'disconnected', bpm: null }))
      const server = await device.gatt!.connect()
      const service = await server.getPrimaryService('heart_rate')
      const ch = await service.getCharacteristic('heart_rate_measurement')
      ch.addEventListener('characteristicvaluechanged', (ev) => {
        const v = (ev.target as BtChar).value
        if (!v) return
        const parsed = parseHeartRate(v)
        set({ bpm: parsed.bpm, lastAt: Date.now(), contactDetected: parsed.contact })
      })
      await ch.startNotifications()
      set({ status: 'connected', deviceName: device.name ?? 'Monitor cardíaco' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Cancelar a janela de escolha não é um erro.
      if (/cancel|chosen/i.test(msg)) set({ status: 'idle' })
      else set({ status: 'error', error: msg })
    }
  },
  disconnect() {
    device?.gatt?.connected && device.gatt.disconnect()
    device = null
    set({ status: nav?.bluetooth ? 'idle' : 'unsupported', bpm: null, deviceName: null, lastAt: null })
  },
}

/** Decodifica a característica 0x2A37 (Heart Rate Measurement). */
export function parseHeartRate(v: DataView): { bpm: number; contact: boolean | null } {
  const flags = v.getUint8(0)
  const is16 = flags & 0x01
  const contactSupported = (flags & 0x04) !== 0
  const bpm = is16 ? v.getUint16(1, true) : v.getUint8(1)
  return { bpm, contact: contactSupported ? (flags & 0x02) !== 0 : null }
}
