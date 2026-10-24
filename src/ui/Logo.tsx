import { useId } from 'react'
import { BODY_PATH, BRAND, HEAD_PATH, LEAF_PATH, LOGO_VIEWBOX, MARK_VIEWBOX, PLUS_PATH, TEXT_PATH } from './brand'

/** Gradientes do logo oficial (ids únicos por instância para não colidir na página). */
function Gradients({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}b`} x1="0" y1="50" x2="0" y2="275" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor={BRAND.sky} />
        <stop offset="1" stopColor={BRAND.blue} />
      </linearGradient>
      <linearGradient id={`${id}l`} x1="204" y1="55" x2="30" y2="255" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#B2D84A" />
        <stop offset="1" stopColor="#36AC45" />
      </linearGradient>
      <linearGradient id={`${id}h`} x1="110" y1="12" x2="158" y2="68" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor={BRAND.sun} />
        <stop offset="1" stopColor={BRAND.orange} />
      </linearGradient>
      <linearGradient id={`${id}t`} x1="0" y1="82" x2="0" y2="208" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#69C6DD" />
        <stop offset="1" stopColor="#3189CC" />
      </linearGradient>
      <linearGradient id={`${id}p`} x1="0" y1="64" x2="0" y2="147" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor={BRAND.lime} />
        <stop offset="1" stopColor="#5BBA46" />
      </linearGradient>
    </defs>
  )
}

function MarkShapes({ id }: { id: string }) {
  return (
    <g className="logo-mark-shapes">
      <path className="lp-body" fill={`url(#${id}b)`} d={BODY_PATH} />
      <path className="lp-leaf" fill={`url(#${id}l)`} d={LEAF_PATH} />
      <path className="lp-head" fill={`url(#${id}h)`} d={HEAD_PATH} />
    </g>
  )
}

/** Só a figura do logo. */
export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  const id = useId().replace(/:/g, '')
  const v = MARK_VIEWBOX
  return (
    <svg width={size} height={size} viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <Gradients id={id} />
      <MarkShapes id={id} />
    </svg>
  )
}

/** Logo completo (figura + "Move+"), exatamente como a arte oficial. */
export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  const { w, h } = LOGO_VIEWBOX
  return (
    <svg className={`logo${className ? ' ' + className : ''}`} height={size} width={(size * w) / h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Move+">
      <Gradients id={id} />
      <MarkShapes id={id} />
      <path className="lp-text" fill={`url(#${id}t)`} fillRule="evenodd" d={TEXT_PATH} />
      <path className="lp-plus" fill={`url(#${id}p)`} d={PLUS_PATH} />
    </svg>
  )
}
