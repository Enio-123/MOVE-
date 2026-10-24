import { useState } from 'react'

export interface Bar {
  key: string
  label: string
  value: number
  /** Texto acessível e de dica (ex.: "12 out: 3,2 km"). */
  title: string
  highlight?: boolean
}

/**
 * Gráfico de barras em SVG, sem dependências. Cada barra é um botão (teclado e toque),
 * o que permite abrir o período ou a atividade correspondente.
 */
export function BarChart({
  bars,
  height = 160,
  onSelect,
  format = (v: number) => String(Math.round(v)),
  goal,
  label,
}: {
  bars: Bar[]
  height?: number
  onSelect?: (key: string) => void
  format?: (v: number) => string
  goal?: number
  label: string
}) {
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(goal ?? 0, ...bars.map((b) => b.value), 1)
  const showEvery = bars.length > 16 ? Math.ceil(bars.length / 8) : 1
  const active = bars.find((b) => b.key === hover)
  return (
    <figure className="chart" aria-label={label}>
      <div className="chart-readout small" aria-live="polite">{active ? active.title : ' '}</div>
      <div className="chart-bars" style={{ height }}>
        {goal ? <div className="chart-goal" style={{ bottom: `${(goal / max) * 100}%` }}><span>meta</span></div> : null}
        {bars.map((b) => (
          <button
            key={b.key}
            type="button"
            className={`chart-bar${b.highlight ? ' hl' : ''}${b.value === 0 ? ' zero' : ''}`}
            onClick={() => onSelect?.(b.key)}
            onMouseEnter={() => setHover(b.key)}
            onFocus={() => setHover(b.key)}
            onMouseLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            aria-label={b.title}
            disabled={!onSelect}
          >
            <i style={{ height: `${Math.max(b.value > 0 ? 3 : 1.5, (b.value / max) * 100)}%` }} />
          </button>
        ))}
      </div>
      <div className="chart-labels" aria-hidden="true">
        {bars.map((b, i) => (
          <span key={b.key}>{i % showEvery === 0 ? b.label : ''}</span>
        ))}
      </div>
      <figcaption className="sr-only">
        {label}. Maior valor: {format(Math.max(...bars.map((b) => b.value), 0))}.
      </figcaption>
    </figure>
  )
}

/** Linha compacta (tendência). Valores nulos interrompem a linha. */
export function Sparkline({ values, height = 48, label }: { values: (number | null)[]; height?: number; label: string }) {
  const w = 240
  const nums = values.filter((v): v is number => v !== null)
  if (nums.length < 2) return null
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  let d = ''
  values.forEach((v, i) => {
    if (v === null) return
    const x = (i / (values.length - 1)) * w
    const y = height - 4 - ((v - min) / span) * (height - 8)
    d += `${d && values[i - 1] !== null ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `
  })
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={d} fill="none" stroke="var(--cyan)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}
