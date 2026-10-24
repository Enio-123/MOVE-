import { useSyncExternalStore } from 'react'

// Roteamento por hash (#/rota): funciona em hospedagem estática (GitHub Pages) e com
// acesso direto a qualquer página, sem depender de reescrita de URLs no servidor.

export interface Route {
  path: string
  parts: string[]
  query: URLSearchParams
}

function parse(): Route {
  const raw = location.hash.replace(/^#/, '') || '/'
  const [path, qs] = raw.split('?')
  const clean = path.startsWith('/') ? path : `/${path}`
  return { path: clean, parts: clean.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs ?? '') }
}

let current = parse()
const listeners = new Set<() => void>()
window.addEventListener('hashchange', () => {
  current = parse()
  listeners.forEach((l) => l())
  // Leva o foco ao conteúdo principal para leitores de tela.
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0 })
    document.getElementById('main')?.focus({ preventScroll: true })
  })
})

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}

export function navigate(to: string, replace = false) {
  const hash = to.startsWith('#') ? to : `#${to}`
  if (replace) history.replaceState(null, '', hash)
  else location.hash = hash
  if (replace) {
    current = parse()
    listeners.forEach((l) => l())
  }
}

export function back(fallback = '/') {
  if (history.length > 1) history.back()
  else navigate(fallback)
}
