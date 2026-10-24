import type { LatLng } from '../domain/types'

// Serviços públicos do ecossistema OpenStreetMap. Uso gratuito com limites:
// - Nominatim: no máximo 1 requisição por segundo, sem autocompletar a cada tecla.
//   https://operations.osmfoundation.org/policies/nominatim/
// - Roteamento a pé (FOSSGIS / OSRM): https://routing.openstreetmap.de/about.html
// Para produção com muitos usuários, troque as URLs abaixo por um provedor contratado
// (ex.: Mapbox, MapTiler, Stadia) ou por instâncias próprias.

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
export const ROUTING_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'

export interface PlaceResult {
  name: string
  detail: string
  lat: number
  lng: number
}

let lastSearch = 0

export async function searchPlaces(query: string, near?: LatLng | null): Promise<PlaceResult[]> {
  const wait = 1100 - (Date.now() - lastSearch)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastSearch = Date.now()
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '6', 'accept-language': 'pt-BR' })
  if (near) {
    const d = 0.3
    params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`)
  }
  const res = await fetch(`${NOMINATIM_URL}?${params}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Pesquisa indisponível (${res.status})`)
  const data = (await res.json()) as { display_name: string; name?: string; lat: string; lon: string }[]
  return data.map((r) => {
    const parts = r.display_name.split(',')
    return { name: r.name || parts[0], detail: parts.slice(1, 4).join(',').trim(), lat: Number(r.lat), lng: Number(r.lon) }
  })
}

/** Traça um percurso a pé seguindo ruas e caminhos entre os pontos indicados. */
export async function routeOnFoot(points: LatLng[], signal?: AbortSignal): Promise<{ path: LatLng[]; distanceM: number }> {
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
  const res = await fetch(`${ROUTING_URL}/${coords}?overview=full&geometries=geojson`, { signal })
  if (!res.ok) throw new Error(`Roteamento indisponível (${res.status})`)
  const data = await res.json()
  const route = data.routes?.[0]
  if (!route) throw new Error('Nenhum caminho encontrado entre os pontos.')
  return {
    path: (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ lat, lng })),
    distanceM: route.distance,
  }
}
