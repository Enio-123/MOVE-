import { SPORT_LABEL } from '../domain/activity'
import { clock, km, pace } from '../domain/format'
import type { Activity, TrackPoint } from '../domain/types'
import { BODY_PATH, HEAD_PATH, LEAF_PATH, LOGO_VIEWBOX, PLUS_PATH, TEXT_PATH } from './brand'

const W = 1080
const H = 1350

function logoSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_VIEWBOX.w} ${LOGO_VIEWBOX.h}">
<defs>
<linearGradient id="b" x1="0" y1="50" x2="0" y2="275" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#62C3DB"/><stop offset="1" stop-color="#2C7CC6"/></linearGradient>
<linearGradient id="l" x1="204" y1="55" x2="30" y2="255" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#B2D84A"/><stop offset="1" stop-color="#36AC45"/></linearGradient>
<linearGradient id="h" x1="110" y1="12" x2="158" y2="68" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FDB91C"/><stop offset="1" stop-color="#F26A24"/></linearGradient>
<linearGradient id="t" x1="0" y1="82" x2="0" y2="208" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#69C6DD"/><stop offset="1" stop-color="#3189CC"/></linearGradient>
<linearGradient id="p" x1="0" y1="64" x2="0" y2="147" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#9CCB3D"/><stop offset="1" stop-color="#5BBA46"/></linearGradient>
</defs>
<path fill="url(#b)" d="${BODY_PATH}"/><path fill="url(#l)" d="${LEAF_PATH}"/><path fill="url(#h)" d="${HEAD_PATH}"/>
<path fill="url(#t)" fill-rule="evenodd" d="${TEXT_PATH}"/><path fill="url(#p)" d="${PLUS_PATH}"/></svg>`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

/** Gera a imagem de compartilhamento (1080×1350, formato de stories/feed) no próprio aparelho. */
export async function renderShareCard(a: Activity, track: TrackPoint[] | null, withRoute: boolean): Promise<Blob> {
  // Garante a fonte da marca carregada antes de desenhar no canvas.
  await Promise.all(['600 30px', '800 64px'].map((f) => document.fonts?.load(`${f} "Plus Jakarta Sans"`).catch(() => null)))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!

  // Fundo da marca: branco com brilhos azul-céu e verde-limão.
  g.fillStyle = '#fbfdfe'
  g.fillRect(0, 0, W, H)
  const glow = (x: number, y: number, r: number, color: string) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, color)
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, W, H)
  }
  glow(0, H, 900, 'rgba(98,195,219,0.45)')
  glow(W, H, 850, 'rgba(178,216,74,0.4)')
  glow(W * 0.7, 0, 500, 'rgba(253,185,28,0.12)')

  const font = (w: number, size: number) => `${w} ${size}px "Plus Jakarta Sans", system-ui, sans-serif`
  g.fillStyle = '#4a5d72'
  g.font = font(600, 34)
  const date = new Date(a.startedAt).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  g.fillText(`${SPORT_LABEL[a.sport]} · ${date}`, 80, 130)
  g.fillStyle = '#0d2136'
  g.font = font(800, 68)
  const title = a.title.length > 26 ? a.title.slice(0, 25) + '…' : a.title
  g.fillText(title, 80, 215)

  // Trajeto desenhado como linha (sem mapa de fundo).
  const pts = withRoute && track && track.length > 1 ? track : null
  const box = { x: 80, y: 280, w: W - 160, h: 600 }
  if (pts) {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
    for (const p of pts) {
      minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat)
      minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng)
    }
    const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
    const spanX = Math.max(1e-6, (maxLng - minLng) * kx)
    const spanY = Math.max(1e-6, maxLat - minLat)
    const s = Math.min(box.w / spanX, box.h / spanY) * 0.9
    const ox = box.x + (box.w - spanX * s) / 2
    const oy = box.y + (box.h - spanY * s) / 2
    const X = (p: TrackPoint) => ox + (p.lng - minLng) * kx * s
    const Y = (p: TrackPoint) => oy + (maxLat - p.lat) * s
    const grad = g.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h)
    grad.addColorStop(0, '#62C3DB')
    grad.addColorStop(0.55, '#2C7CC6')
    grad.addColorStop(1, '#4DB548')
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = 'rgba(44,124,198,0.15)'
    g.lineWidth = 34
    const path = () => {
      g.beginPath()
      let seg = pts[0].seg
      pts.forEach((p, i) => {
        if (i === 0 || p.seg !== seg) g.moveTo(X(p), Y(p))
        else g.lineTo(X(p), Y(p))
        seg = p.seg
      })
    }
    path(); g.stroke()
    g.strokeStyle = grad
    g.lineWidth = 14
    path(); g.stroke()
    const dot = (p: TrackPoint, color: string) => {
      g.beginPath(); g.arc(X(p), Y(p), 18, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill()
      g.beginPath(); g.arc(X(p), Y(p), 11, 0, Math.PI * 2); g.fillStyle = color; g.fill()
    }
    dot(pts[0], '#4DB548')
    dot(pts[pts.length - 1], '#F26A24')
  } else {
    const logo = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg())}`)
    const lw = 700
    g.globalAlpha = 0.1
    g.drawImage(logo, (W - lw) / 2, box.y + 120, lw, (lw * LOGO_VIEWBOX.h) / LOGO_VIEWBOX.w)
    g.globalAlpha = 1
  }

  // Números
  const p = a.distanceM >= 100 && a.movingS > 0 ? a.movingS / (a.distanceM / 1000) : null
  const stats: [string, string][] = [
    ['Distância', `${km(a.distanceM)} km`],
    ['Tempo', clock(a.source === 'manual' ? a.elapsedS : a.movingS)],
    [a.sport === 'ride' ? 'Velocidade' : 'Ritmo', a.sport === 'ride' && a.movingS > 0 ? `${((a.distanceM / a.movingS) * 3.6).toFixed(1).replace('.', ',')} km/h` : p ? `${pace(p)}/km` : '—'],
  ]
  const top = 960
  const colW = (W - 160) / 3
  stats.forEach(([label, value], i) => {
    const x = 80 + i * colW
    g.fillStyle = '#4a5d72'
    g.font = font(600, 30)
    g.fillText(label, x, top)
    g.fillStyle = '#0d2136'
    g.font = font(800, 64)
    g.fillText(value, x, top + 76)
  })
  if (a.elevationGainM) {
    g.fillStyle = '#4a5d72'
    g.font = font(600, 30)
    g.fillText(`Elevação +${Math.round(a.elevationGainM)} m`, 80, top + 140)
  }

  // Logo oficial no rodapé
  const logo = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg())}`)
  const lh = 96
  g.drawImage(logo, 80, H - 80 - lh, (lh * LOGO_VIEWBOX.w) / LOGO_VIEWBOX.h, lh)
  g.fillStyle = '#4a5d72'
  g.font = font(600, 30)
  g.textAlign = 'right'
  g.fillText('Seu movimento. Sua evolução.', W - 80, H - 112)

  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao gerar a imagem.'))), 'image/png'))
}
