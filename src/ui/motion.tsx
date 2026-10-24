import { Award, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { dismissCelebration } from '../services/actions'
import { useApp } from '../services/store'
import { BRAND } from './brand'

const reduced = () => document.documentElement.dataset.motion === 'reduce'

/** Número que conta até o valor quando aparece ou muda. */
export function CountUp({ value, decimals = 0, duration = 900, format }: { value: number; decimals?: number; duration?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(() => (reduced() ? value : 0))
  const from = useRef(shown)
  useEffect(() => {
    if (reduced()) {
      setShown(value)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const e = 1 - (1 - t) ** 4
      const v = a + (value - a) * e
      setShown(v)
      from.current = v
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  const n = Number(shown.toFixed(decimals))
  return <>{format ? format(n) : n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>
}

/** Confete leve em canvas, nas cores da marca. */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c || reduced()) return
    const ctx = c.getContext('2d')!
    const dpr = Math.min(2, devicePixelRatio)
    const w = (c.width = innerWidth * dpr)
    const h = (c.height = innerHeight * dpr)
    const colors = [BRAND.sky, BRAND.blue, BRAND.lime, BRAND.green, BRAND.sun, BRAND.orange]
    const parts = Array.from({ length: 140 }, (_, i) => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6
      const v = (9 + Math.random() * 11) * dpr
      return { x: w / 2, y: h * 0.55, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: (3 + Math.random() * 4) * dpr, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, color: colors[i % colors.length], shape: i % 3 }
    })
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      ctx.clearRect(0, 0, w, h)
      const life = (now - start) / 2600
      for (const p of parts) {
        p.vy += 0.32 * dpr
        p.vx *= 0.985
        p.vy *= 0.985
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        ctx.save()
        ctx.globalAlpha = Math.max(0, 1 - life)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        if (p.shape === 0) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r)
        else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.7, 0, Math.PI * 2); ctx.fill() }
        else { ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r, p.r); ctx.lineTo(-p.r, p.r); ctx.fill() }
        ctx.restore()
      }
      if (life < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} aria-hidden="true" />
}

export function CelebrationLayer() {
  const c = useApp((s) => s.celebration)
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!c) return
    btn.current?.focus()
    navigator.vibrate?.(c.kind === 'level' ? [30, 40, 60] : 40)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismissCelebration()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [c])
  if (!c) return null
  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title" onClick={(e) => e.target === e.currentTarget && dismissCelebration()}>
      <Confetti />
      <div className="celebrate-card">
        <button className="icon-btn" style={{ position: 'absolute', top: 10, right: 10 }} aria-label="Fechar" onClick={dismissCelebration}><X size={20} /></button>
        <div className={`celebrate-badge${c.kind === 'level' ? ' lvl' : ''}`} aria-hidden="true">
          {c.kind === 'level' ? c.level : <Award size={48} />}
        </div>
        <p className="upper" style={{ color: c.kind === 'level' ? 'var(--blue)' : 'var(--orange)' }}>{c.detail}</p>
        <h2 id="celebrate-title">{c.title}</h2>
        {c.more > 0 && <p className="muted small">e mais {c.more} {c.more === 1 ? 'conquista' : 'conquistas'}</p>}
        <button ref={btn} className="btn primary block" style={{ marginTop: 8 }} onClick={dismissCelebration}>Continuar</button>
        <a className="small" href={c.kind === 'level' ? '#/perfil' : '#/conquistas'} onClick={dismissCelebration}>{c.kind === 'level' ? 'Ver meu progresso' : 'Ver conquistas'}</a>
      </div>
    </div>
  )
}

/**
 * Efeitos globais de interface, aplicados a partir das classes já usadas nas páginas:
 * indicadores deslizantes em abas, controles segmentados e navegação inferior,
 * ondulação de toque e revelação de cartões durante a rolagem.
 */
export function useInterfaceMotion(routeKey: string) {
  // Indicadores deslizantes
  useEffect(() => {
    let raf = 0
    const place = () => {
      raf = 0
      document.querySelectorAll<HTMLElement>('.tabs').forEach((el) => indicator(el, 'tab-ink', '[aria-selected="true"]'))
      document.querySelectorAll<HTMLElement>('.segmented').forEach((el) => indicator(el, 'seg-thumb', '[aria-pressed="true"]'))
      const nav = document.querySelector<HTMLElement>('.bottom-nav')
      if (nav) {
        const ink = ensure(nav, 'nav-indicator')
        const cur = nav.querySelector<HTMLElement>(':scope > [aria-current="page"]')
        if (cur && !cur.classList.contains('record-tab')) {
          ink.style.left = `${cur.offsetLeft + cur.offsetWidth / 2}px`
          ink.style.opacity = '1'
        } else ink.style.opacity = '0'
      }
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(place) }
    const mo = new MutationObserver(schedule)
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-selected', 'aria-pressed', 'aria-current'] })
    addEventListener('resize', schedule)
    schedule()
    return () => { mo.disconnect(); removeEventListener('resize', schedule); cancelAnimationFrame(raf) }
  }, [])

  // Ondulação de toque
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (reduced()) return
      const t = (e.target as HTMLElement).closest<HTMLElement>('.btn, .chip, .list-item, .more-item, .sport-option')
      if (!t || (t as HTMLButtonElement).disabled) return
      const r = t.getBoundingClientRect()
      const size = Math.max(r.width, r.height) * 2.2
      const s = document.createElement('span')
      s.className = 'ripple'
      s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`
      if (getComputedStyle(t).position === 'static') t.style.position = 'relative'
      t.style.overflow = 'hidden'
      t.appendChild(s)
      setTimeout(() => s.remove(), 650)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  // Revelação na rolagem
  useEffect(() => {
    if (reduced() || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) => {
        let i = 0
        for (const en of entries) {
          if (!en.isIntersecting) continue
          const el = en.target as HTMLElement
          el.style.setProperty('--rv-delay', `${Math.min(i++, 6) * 0.06}s`)
          el.dataset.rv = '1'
          io.unobserve(el)
          el.addEventListener('transitionend', () => { el.removeAttribute('data-rv'); el.style.removeProperty('--rv-delay') }, { once: true })
        }
      },
      { rootMargin: '0px 0px -6% 0px' },
    )
    const tag = () => {
      document.querySelectorAll<HTMLElement>('.main .panel:not([data-rvd]), .main .empty:not([data-rvd]), .main .section-head:not([data-rvd]), .main .page-head:not([data-rvd])').forEach((el) => {
        el.dataset.rvd = ''
        if (el.closest('.recorder, .map-page, .sheet')) return
        el.dataset.rv = '0'
        io.observe(el)
      })
    }
    let raf = 0
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; tag() }) })
    mo.observe(document.body, { subtree: true, childList: true })
    tag()
    return () => { mo.disconnect(); io.disconnect(); cancelAnimationFrame(raf) }
  }, [routeKey])

  // Barra superior ganha borda ao rolar
  useEffect(() => {
    const bar = () => document.querySelector('.topbar')?.classList.toggle('scrolled', scrollY > 8)
    addEventListener('scroll', bar, { passive: true })
    bar()
    return () => removeEventListener('scroll', bar)
  }, [routeKey])
}

function ensure(parent: HTMLElement, cls: string): HTMLElement {
  let el = parent.querySelector<HTMLElement>(`:scope > .${cls}`)
  if (!el) {
    el = document.createElement('span')
    el.className = cls
    el.setAttribute('aria-hidden', 'true')
    parent.appendChild(el)
  }
  return el
}

function indicator(parent: HTMLElement, cls: string, sel: string) {
  const cur = parent.querySelector<HTMLElement>(`:scope > ${sel}`)
  const ink = ensure(parent, cls)
  if (!cur) { ink.style.opacity = '0'; return }
  ink.style.opacity = '1'
  ink.style.left = `${cur.offsetLeft}px`
  ink.style.width = `${cur.offsetWidth}px`
}
