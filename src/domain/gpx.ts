import type { Activity, Sport, TrackPoint } from './types'

export interface ParsedTrack {
  name: string | null
  sport: Sport | null
  points: TrackPoint[]
  /** Assinatura estável do arquivo para impedir importações repetidas. */
  fingerprint: string
}

const num = (s: string | undefined | null) => (s == null ? null : Number.parseFloat(s))
const unescapeXml = (s: string) =>
  s.replace(/&(lt|gt|quot|apos|amp);/g, (_, e: string) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[e]!)
const tag = (block: string, name: string) => {
  const v = block.match(new RegExp(`<(?:\\w+:)?${name}[^>]*>([^<]*)</(?:\\w+:)?${name}>`, 'i'))?.[1]?.trim()
  return v == null ? null : unescapeXml(v)
}

/** Lê arquivos GPX 1.1 e TCX exportados por relógios e aplicativos (Garmin, Coros, Polar, etc.). */
export function parseTrackFile(text: string): ParsedTrack {
  const isTcx = /<TrainingCenterDatabase/i.test(text)
  const points: TrackPoint[] = []
  let seg = 0
  let sport: Sport | null = null
  let name: string | null = null

  if (isTcx) {
    const s = text.match(/<Activity[^>]*Sport="([^"]+)"/i)?.[1]?.toLowerCase()
    sport = s === 'running' ? 'run' : s === 'biking' ? 'ride' : null
    const laps = text.split(/<Track>/i).slice(1)
    for (const lap of laps) {
      for (const tp of lap.split(/<Trackpoint>/i).slice(1)) {
        const lat = num(tag(tp, 'LatitudeDegrees'))
        const lng = num(tag(tp, 'LongitudeDegrees'))
        const time = tag(tp, 'Time')
        if (lat == null || lng == null || !time) continue
        const hrBlock = tp.match(/<HeartRateBpm>([\s\S]*?)<\/HeartRateBpm>/i)?.[1]
        points.push({
          t: Date.parse(time), lat, lng, acc: 10, seg,
          alt: num(tag(tp, 'AltitudeMeters')), altAcc: null,
          hr: hrBlock ? num(tag(hrBlock, 'Value')) ?? undefined : undefined,
        })
      }
      seg++
    }
  } else {
    name = tag(text.split(/<trkseg/i)[0].split(/<trk>/i)[1] ?? '', 'name')
    const type = tag(text, 'type')?.toLowerCase() ?? ''
    sport = /run/.test(type) ? 'run' : /walk/.test(type) ? 'walk' : /hik/.test(type) ? 'hike' : /cycl|bik|ride/.test(type) ? 'ride' : null
    for (const segBlock of text.split(/<trkseg[^>]*>/i).slice(1)) {
      const re = /<trkpt\s+([^>]*)>([\s\S]*?)<\/trkpt>/gi
      let m: RegExpExecArray | null
      while ((m = re.exec(segBlock.split(/<\/trkseg>/i)[0]))) {
        const lat = num(m[1].match(/lat="([^"]+)"/)?.[1])
        const lng = num(m[1].match(/lon="([^"]+)"/)?.[1])
        const time = tag(m[2], 'time')
        if (lat == null || lng == null || !time) continue
        const hr = num(tag(m[2], 'hr'))
        points.push({ t: Date.parse(time), lat, lng, acc: 10, seg, alt: num(tag(m[2], 'ele')), altAcc: null, hr: hr ?? undefined })
      }
      seg++
    }
  }

  const valid = points.filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t)
  const fp = valid.length ? `${valid.length}:${valid[0].t}:${valid[valid.length - 1].t}:${valid[0].lat.toFixed(5)}` : ''
  return { name, sport, points: valid, fingerprint: fp }
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)

/** Exporta uma atividade gravada como GPX 1.1 (com frequência cardíaca, quando houver). */
export function toGpx(a: Activity, points: TrackPoint[]): string {
  const segs = new Map<number, TrackPoint[]>()
  for (const p of points) segs.set(p.seg, [...(segs.get(p.seg) ?? []), p])
  const body = [...segs.values()]
    .map(
      (ps) =>
        `<trkseg>\n${ps
          .map(
            (p) =>
              `<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${p.alt != null ? `<ele>${p.alt.toFixed(1)}</ele>` : ''}<time>${new Date(p.t).toISOString()}</time>${
                p.hr ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${p.hr}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>` : ''
              }</trkpt>`,
          )
          .join('\n')}\n</trkseg>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Move+" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<trk><name>${esc(a.title)}</name><type>${a.sport}</type>
${body}
</trk>
</gpx>
`
}
