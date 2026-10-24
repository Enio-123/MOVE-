import { useId } from 'react'

/**
 * Marca provisória da Move+: uma rota contínua em forma de "M", com ponto de partida
 * e chegada, e o "+" em laranja. Não é a logo oficial; substitua quando ela estiver disponível.
 */
export const MARK_PATH = 'M9 37 V16 a3.2 3.2 0 0 1 5.6 -2.1 L24 25.5 L33.4 13.9 a3.2 3.2 0 0 1 5.6 2.1 V37'

export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id={id} x1="6" y1="40" x2="42" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--blue)" />
          <stop offset="0.55" stopColor="var(--cyan)" />
          <stop offset="1" stopColor="var(--aqua)" />
        </linearGradient>
      </defs>
      <path d={MARK_PATH} fill="none" stroke={`url(#${id})`} strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="37" r="3.4" fill="var(--bg)" stroke="var(--blue)" strokeWidth="2.2" />
      <circle cx="39" cy="37" r="3.4" fill="var(--aqua)" />
      <path d="M42 4.5 v8 M38 8.5 h8" stroke="var(--orange)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      Move<span className="plus">+</span>
    </span>
  )
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="logo" aria-label="Move+">
      <LogoMark size={size} />
      <Wordmark size={size * 0.72} />
    </span>
  )
}
