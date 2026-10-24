import { lazy, Suspense, useEffect, useState } from 'react'
import { updateSettings } from './services/actions'
import { useApp } from './services/store'
import { Shell } from './ui/Shell'
import { Toasts } from './ui/components'
import { CelebrationLayer } from './ui/motion'
import { navigate, useRoute } from './ui/router'
import { Onboarding } from './pages/Onboarding'
import { RecoveryDialog } from './pages/RecoveryDialog'

const Intro = lazy(() => import('./intro/Intro').then((m) => ({ default: m.Intro })))

function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

function useSystemDark() {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark
}

export function useReducedMotion() {
  const pref = useApp((s) => s.settings.reduceMotion)
  const system = useSystemReducedMotion()
  return pref === 'on' || (pref === 'system' && system)
}

export function App() {
  const ready = useApp((s) => s.ready)
  const settings = useApp((s) => s.settings)
  const storageError = useApp((s) => s.storageError)
  const route = useRoute()
  const reduced = useReducedMotion()
  const systemDark = useSystemDark()

  // Preferências visuais aplicadas na raiz do documento.
  useEffect(() => {
    const root = document.documentElement
    const theme = settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme
    root.dataset.theme = theme
    root.dataset.motion = reduced ? 'reduce' : 'full'
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal'
    root.style.setProperty('--text-scale', String(settings.textScale))
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#061120' : '#f4f7fa')
  }, [settings.theme, settings.highContrast, settings.textScale, reduced, systemDark])

  if (!ready) return <div className="boot" aria-busy="true" aria-label="Carregando a Move+" />

  const replay = route.path === '/intro'
  if (!settings.introSeen || replay) {
    return (
      <Suspense fallback={<div className="boot" />}>
        <Intro
          reducedMotion={reduced}
          onDone={() => {
            if (!settings.introSeen) void updateSettings({ introSeen: true })
            if (replay) navigate('/', true)
          }}
        />
      </Suspense>
    )
  }

  if (!settings.onboarded) return <Onboarding />

  return (
    <>
      {storageError && (
        <div className="storage-error" role="alert">
          Não foi possível acessar o armazenamento do navegador ({storageError}). Os dados desta sessão não serão salvos. Verifique se a navegação privada está bloqueando o armazenamento.
        </div>
      )}
      <Shell />
      <RecoveryDialog />
      <Toasts />
      <CelebrationLayer />
    </>
  )
}
