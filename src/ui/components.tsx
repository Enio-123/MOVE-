import {
  Accessibility,
  AlertTriangle,
  Award,
  Bike,
  Footprints,
  Info,
  Mountain,
  TrendingUp,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useId, useRef, type ComponentType, type ReactNode } from 'react'
import { SPORT_LABEL } from '../domain/activity'
import type { DataSource, Sport } from '../domain/types'
import { useApp } from '../services/store'

type IconLike = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' }>

/** Corredor no mesmo traço dos ícones Lucide (o pacote não tem um ícone de corrida). */
function RunIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="14.5" cy="4" r="2" />
      <path d="M13 8l-2 5 3 3-1 5" />
      <path d="M11 13l-2 4-4 1" />
      <path d="M7 10l4-2 4 1 2 3" />
    </svg>
  )
}

export const SPORT_ICON: Record<Sport, IconLike> = {
  walk: Footprints,
  run: RunIcon,
  hike: Mountain,
  wheelchair: Accessibility,
  ride: Bike,
}

export function SportIcon({ sport, size = 20 }: { sport: Sport; size?: number }) {
  const I = SPORT_ICON[sport]
  return (
    <span className="sport-icon" aria-hidden="true">
      <I size={size} />
    </span>
  )
}

export { SPORT_LABEL }

const SOURCE_LABEL: Record<DataSource, string> = {
  gps: 'GPS',
  import: 'Importado',
  manual: 'Manual',
  health: 'Saúde',
  demo: 'Demonstração',
}

const SOURCE_TITLE: Record<DataSource, string> = {
  gps: 'Medido pelo GPS deste aparelho',
  import: 'Importado de arquivo de relógio ou outro app',
  manual: 'Informado manualmente, sem medição',
  health: 'Importado de uma plataforma de saúde',
  demo: 'Conteúdo de demonstração, não é um registro real',
}

export function SourceBadge({ source }: { source: DataSource }) {
  return (
    <span className={`badge ${source}`} title={SOURCE_TITLE[source]}>
      {SOURCE_LABEL[source]}
    </span>
  )
}

export function DemoBadge() {
  return <span className="badge demo">Demonstração</span>
}

export function EstimateBadge({ text = 'Estimativa' }: { text?: string }) {
  return <span className="badge estimate">{text}</span>
}

/** Indicador circular de progresso. */
export function Ring({
  value,
  size = 120,
  stroke = 10,
  children,
  label,
  color = 'var(--cyan)',
}: {
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
  label: string
  color?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={v >= 1 ? 'var(--aqua)' : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.9s var(--ease)' }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  )
}

export function Progress({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={`progress${v >= 1 ? ' done' : ''}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <i style={{ width: `${v * 100}%` }} />
    </div>
  )
}

export function Empty({ icon: I = TrendingUp, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <I className="icon" size={24} aria-hidden="true" />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function Notice({ tone = 'info', children, icon }: { tone?: 'info' | 'warn' | 'err'; children: ReactNode; icon?: LucideIcon }) {
  const I = icon ?? (tone === 'info' ? Info : AlertTriangle)
  return (
    <div className={`notice ${tone === 'info' ? '' : tone}`} role={tone === 'err' ? 'alert' : undefined}>
      <I size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

export function Sheet({ title, onClose, children, labelledBy }: { title: string; onClose: () => void; children: ReactNode; labelledBy?: string }) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current
    const focusable = () => el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    focusable()?.[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const f = focusable()
        if (!f?.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? id} ref={ref}>
        <div className="sheet-head">
          <h2 id={id}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Toasts() {
  // No máximo dois avisos por vez, para não cobrir a tela; os demais ficam em Notificações.
  const toasts = useApp((s) => s.toasts).slice(-2)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span className="ic" aria-hidden="true">
            {t.kind === 'achievement' || t.kind === 'level' ? <Award size={18} /> : t.kind === 'error' ? <AlertTriangle size={18} /> : t.kind === 'info' ? <Info size={18} /> : <Zap size={18} />}
          </span>
          <div>
            <div className="t">{t.title}</div>
            {t.detail && <div className="d">{t.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function Stat({ label, value, unit, sub }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  )
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId()
  return (
    <div className="row between" style={{ padding: '6px 0' }}>
      <label htmlFor={id} className="grow">
        <div style={{ fontWeight: 600 }}>{label}</div>
        {description && <div className="small muted">{description}</div>}
      </label>
      <input id={id} type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  )
}

/** Baixa um arquivo gerado no navegador. */
export function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
