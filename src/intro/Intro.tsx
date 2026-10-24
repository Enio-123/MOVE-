import { useEffect, useRef, useState } from 'react'
import { LogoMark, MARK_PATH } from '../ui/Logo'
import { detectTier, IntroScene, webglAvailable } from './scene'
import './intro.css'

/**
 * Introdução cinematográfica (≈5 s). Geometria, materiais, luzes e câmera reais em Three.js.
 * Sem WebGL, mostra uma alternativa vetorial animada. Nenhum som é reproduzido.
 */
export function Intro({ reducedMotion, onDone }: { reducedMotion: boolean; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [mode] = useState<'webgl' | 'fallback'>(() => (webglAvailable() ? 'webgl' : 'fallback'))
  const [leaving, setLeaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const startRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (mode !== 'webgl' || !canvas.current) return
    let scene: IntroScene | null = null
    try {
      scene = new IntroScene({ canvas: canvas.current, tier: detectTier(), reducedMotion, markPath: MARK_PATH })
      scene.play()
    } catch {
      setFailed(true)
    }
    return () => scene?.dispose()
  }, [mode, reducedMotion])

  useEffect(() => {
    const t = setTimeout(() => startRef.current?.focus({ preventScroll: true }), reducedMotion ? 50 : 4900)
    return () => clearTimeout(t)
  }, [reducedMotion])

  const finish = () => {
    if (leaving) return
    setLeaving(true)
    setTimeout(onDone, reducedMotion ? 10 : 520)
  }

  const fallback = mode === 'fallback' || failed
  return (
    <div className={`intro${leaving ? ' leaving' : ''}${reducedMotion ? ' still' : ''}`} role="dialog" aria-modal="true" aria-label="Introdução da Move+">
      {fallback ? (
        <div className="intro-fallback" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="200" height="200">
            <defs>
              <linearGradient id="fb-g" x1="6" y1="40" x2="42" y2="10" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#2f6bff" />
                <stop offset="0.55" stopColor="#19c6f0" />
                <stop offset="1" stopColor="#19d3b2" />
              </linearGradient>
            </defs>
            <path className="fb-route" d={MARK_PATH} pathLength={1} fill="none" stroke="url(#fb-g)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
            <circle className="fb-dot a" cx="9" cy="37" r="2.6" fill="#03060c" stroke="#2f6bff" strokeWidth="1.8" />
            <circle className="fb-dot b" cx="39" cy="37" r="2.6" fill="#19d3b2" />
            <path className="fb-plus" d="M42 4.5 v8 M38 8.5 h8" stroke="#ff7a1f" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </div>
      ) : (
        <canvas ref={canvas} className="intro-canvas" aria-hidden="true" />
      )}

      <button className="intro-skip" onClick={finish}>
        Pular introdução
      </button>

      <div className="intro-copy">
        <h1 className="intro-title" aria-label="Move+">
          {'Move'.split('').map((c, i) => (
            <span key={i} style={{ animationDelay: `${4.05 + i * 0.07}s` }} aria-hidden="true">
              {c}
            </span>
          ))}
          <span className="plus" style={{ animationDelay: '4.38s' }} aria-hidden="true">
            +
          </span>
        </h1>
        <p className="intro-tagline">Seu movimento. Sua evolução.</p>
        <button ref={startRef} className="btn accent lg intro-start" onClick={finish}>
          Começar
        </button>
      </div>
      <div className="intro-brand-small" aria-hidden="true">
        <LogoMark size={22} />
      </div>
    </div>
  )
}
