import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState = 'installed' | 'available' | 'ios' | 'unavailable'

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const standalone = () =>
  typeof window !== 'undefined' &&
  (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

let installed = standalone()
if (typeof window !== 'undefined') {
  // O Chrome/Edge/Samsung Internet avisam quando o app pode ser instalado.
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    emit()
  })
}

function state(): InstallState {
  if (installed) return 'installed'
  if (deferred) return 'available'
  if (isIos()) return 'ios'
  return 'unavailable'
}

/** Abre o pedido de instalação do navegador. Retorna true se o usuário aceitou. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const e = deferred
  deferred = null
  await e.prompt()
  const { outcome } = await e.userChoice
  emit()
  return outcome === 'accepted'
}

export function useInstall(): InstallState {
  return useSyncExternalStore((fn) => (listeners.add(fn), () => listeners.delete(fn)), state)
}
