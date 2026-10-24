import { useEffect, useRef, useState } from 'react'
import { Logo } from '../ui/Logo'
import { LOGO_VIEWBOX } from '../ui/brand'
import { detectTier, HANDOFF_AT, IntroScene, webglAvailable } from './scene'
import './intro.css'

type Rect = { x: number; y: number; w: number; h: number }

/** Mesmo enquadramento final da cena 3D, para a versão vetorial e o primeiro quadro. */
function defaultRect(): Rect {
  const vw = innerWidth
  const vh = innerHeight
  const w = Math.min(vw * 0.78, ((vh * 0.26) * LOGO_VIEWBOX.w) / LOGO_VIEWBOX.h)
  const h = (w * LOGO_VIEWBOX.h) / LOGO_VIEWBOX.w
  return { x: (vw - w) / 2, y: vh / 2 - vh * 0.12 - h / 2, w, h }
}

/**
 * Introdução (≈5 s). Três rotas de movimento (azul, verde e laranja) cruzam o espaço em 3D,
 * se transformam na figura do logo oficial e entregam a cena ao logo vetorial idêntico,
 * quando "Move+" se escreve ao lado. Sem WebGL, a mesma ideia em vetor. Sem som.
 */
export function Intro({ reducedMotion, onDone }: { reducedMotion: boolean; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [mode] = useState<'webgl' | 'fallback'>(() => (webglAvailable() ? 'webgl' : 'fallback'))
  const [failed, setFailed] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [rect, setRect] = useState<Rect>(defaultRect)
  const startRef = useRef<HTMLButtonElement>(null)
  const fallback = mode === 'fallback' || failed

  useEffect(() => {
    if (fallback) {
      const on = () => setRect(defaultRect())
      addEventListener('resize', on)
      return () => removeEventListener('resize', on)
    }
    if (!canvas.current) return
    let scene: IntroScene | null = null
    try {
      scene = new IntroScene({ canvas: canvas.current, tier: detectTier(), reducedMotion, onLayout: setRect })
      scene.play()
    } catch {
      setFailed(true)
    }
    return () => scene?.dispose()
  }, [fallback, reducedMotion])

  useEffect(() => {
    const t = setTimeout(() => startRef.current?.focus({ preventScroll: true }), reducedMotion ? 50 : 4900)
    return () => clearTimeout(t)
  }, [reducedMotion])

  const finish = () => {
    if (leaving) return
    setLeaving(true)
    setTimeout(onDone, reducedMotion ? 10 : 600)
  }

  return (
    <div
      className={`intro${leaving ? ' leaving' : ''}${reducedMotion ? ' still' : ''}${fallback ? ' vector' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Introdução da Move+"
      style={{ ['--handoff' as string]: `${HANDOFF_AT}s` }}
    >
      <div className="intro-bg" aria-hidden="true">
        <i className="g1" />
        <i className="g2" />
        <i className="g3" />
      </div>
      {!fallback && <canvas ref={canvas} className="intro-canvas" aria-hidden="true" />}

      <div className="intro-logo" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
        <Logo size={rect.h} />
      </div>

      <button className="intro-skip" onClick={finish}>
        Pular introdução
      </button>

      <div className="intro-copy">
        <h1 className="sr-only">Move+</h1>
        <p className="intro-tagline">
          <span>Seu movimento.</span> <span>Sua evolução.</span>
        </p>
        <button ref={startRef} className="btn primary lg intro-start" onClick={finish}>
          Começar
        </button>
      </div>
    </div>
  )
}
