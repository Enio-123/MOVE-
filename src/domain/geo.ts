import type { LatLng } from './types'

const R = 6371008.8 // raio médio da Terra (m)
const rad = (d: number) => (d * Math.PI) / 180

/** Distância de grande círculo (Haversine) em metros. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

export function pathLength(points: LatLng[]): number {
  let d = 0
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i])
  return d
}

/** Ponto intermediário linear (adequado para distâncias curtas entre leituras de GPS). */
export function lerpLatLng(a: LatLng, b: LatLng, f: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f }
}

export function bounds(points: LatLng[]): [[number, number], [number, number]] | null {
  if (!points.length) return null
  let s = 90, w = 180, n = -90, e = -180
  for (const p of points) {
    s = Math.min(s, p.lat); n = Math.max(n, p.lat)
    w = Math.min(w, p.lng); e = Math.max(e, p.lng)
  }
  return [[s, w], [n, e]]
}
