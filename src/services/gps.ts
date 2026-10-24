import { useSyncExternalStore } from 'react'
import { repo } from './actions'
import { heartRate } from './heartRate'
import { Tracker } from './tracker'

/** Instância única do rastreador, compartilhada entre telas (a gravação continua ao navegar). */
export const tracker = new Tracker({
  geolocation: typeof navigator !== 'undefined' ? navigator.geolocation : undefined,
  secure: typeof window !== 'undefined' ? window.isSecureContext : false,
  now: () => Date.now(),
  persist: (s) => void repo.putLive(s),
  heartRate: () => heartRate.current(),
})

export function useTracker() {
  return useSyncExternalStore(tracker.subscribe, () => tracker.snapshot)
}

export function useHeartRate() {
  return useSyncExternalStore(heartRate.subscribe, heartRate.get)
}

/** Estado da permissão de localização sem disparar o pedido (quando o navegador informa). */
export async function locationPermission(): Promise<PermissionState | 'unknown'> {
  try {
    const r = await navigator.permissions.query({ name: 'geolocation' })
    return r.state
  } catch {
    return 'unknown'
  }
}

let lock: { release(): Promise<void> } | null = null

/** Mantém a tela ligada durante a gravação (Screen Wake Lock API), quando suportado. */
export async function keepScreenOn(on: boolean): Promise<boolean> {
  const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }
  try {
    if (on) {
      if (!nav.wakeLock) return false
      lock = await nav.wakeLock.request('screen')
      return true
    }
    await lock?.release()
    lock = null
    return false
  } catch {
    return false
  }
}
