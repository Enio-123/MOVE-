import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'

// Mapa base: OpenStreetMap (dados © colaboradores do OSM, licença ODbL).
// Os blocos do servidor padrão do OSM seguem a política de uso justo:
// https://operations.osmfoundation.org/policies/tiles/ — para tráfego alto, use um
// provedor contratado definindo VITE_TILE_URL (ex.: MapTiler, Stadia, Mapbox).
export const TILE_URL: string = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION: string =
  import.meta.env.VITE_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">colaboradores do OpenStreetMap</a>'

/** Centro inicial quando não há localização: Natal (RN). */
export const DEFAULT_CENTER: L.LatLngTuple = [-5.7945, -35.211]

export function pin(kind: 'me' | 'meeting' | 'event' | 'start' | 'end' | 'waypoint', label?: string) {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin ${kind}" ${label ? `aria-label="${label}"` : ''}></div>`,
    iconSize: kind === 'waypoint' ? [12, 12] : [14, 14],
    iconAnchor: kind === 'waypoint' ? [6, 6] : [7, 7],
  })
}

export const ROUTE_STYLE: L.PolylineOptions = { color: '#19c6f0', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }
export const PLAN_STYLE: L.PolylineOptions = { color: '#ff7a1f', weight: 4, opacity: 0.9, dashArray: '8 8', lineCap: 'round' }

/** Cria e gerencia um mapa Leaflet ligado a um elemento. */
export function useLeaflet(opts: { center?: L.LatLngTuple; zoom?: number; interactive?: boolean } = {}) {
  const ref = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<L.Map | null>(null)
  const [tileError, setTileError] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const interactive = opts.interactive ?? true
    const m = L.map(ref.current, {
      center: opts.center ?? DEFAULT_CENTER,
      zoom: opts.zoom ?? 14,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      keyboard: interactive,
      attributionControl: true,
    })
    m.attributionControl.setPrefix(false)
    let errors = 0
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION, crossOrigin: true })
      .on('tileerror', () => {
        errors++
        if (errors > 4) setTileError(true)
      })
      .on('tileload', () => setTileError(false))
      .addTo(m)
    setMap(m)
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      m.remove()
      setMap(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return { ref, map, tileError }
}
