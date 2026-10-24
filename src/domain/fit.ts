import type { ParsedTrack } from './gpx'
import type { Sport, TrackPoint } from './types'

/** Segundos entre 1970-01-01 e 1989-12-31 (época do formato FIT). */
const FIT_EPOCH = 631065600
const SEMI = 180 / 2 ** 31

interface FieldDef {
  num: number
  size: number
  type: number
}
interface Def {
  global: number
  little: boolean
  fields: FieldDef[]
  devSize: number
}

const SPORTS: Record<number, Sport> = { 1: 'run', 2: 'ride', 11: 'walk', 17: 'hike' }

const SIGNED = new Set([0x01, 0x83, 0x85])
const ZERO_INVALID = new Set([0x0a, 0x8b, 0x8c])

/** Lê um campo numérico; devolve null para o valor "não preenchido" do formato. */
function readField(view: DataView, at: number, f: FieldDef, little: boolean): number | null {
  if (f.type === 0x88 && f.size === 4) {
    const v = view.getFloat32(at, little)
    return Number.isFinite(v) ? v : null
  }
  let raw: number
  if (f.size === 1) raw = view.getUint8(at)
  else if (f.size === 2) raw = view.getUint16(at, little)
  else if (f.size === 4) raw = view.getUint32(at, little)
  else return null
  const bits = f.size * 8
  const allOnes = 2 ** bits - 1
  if (SIGNED.has(f.type)) {
    if (raw === 2 ** (bits - 1) - 1) return null
    return raw >= 2 ** (bits - 1) ? raw - 2 ** bits : raw
  }
  if (ZERO_INVALID.has(f.type)) return raw === 0 ? null : raw
  return raw === allOnes ? null : raw
}

/**
 * Lê arquivos .FIT (Garmin, Coros, Wahoo, Polar, Suunto, Zepp e outros relógios e ciclocomputadores).
 * Extrai o trajeto (posição, horário, altitude, frequência cardíaca) e a modalidade da sessão.
 */
export function parseFit(buf: ArrayBuffer): ParsedTrack & { totalDistanceM: number | null; totalTimerS: number | null } {
  const view = new DataView(buf)
  if (buf.byteLength < 14) throw new Error('Arquivo FIT muito curto.')
  const headerSize = view.getUint8(0)
  const dataSize = view.getUint32(4, true)
  const sig = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))
  if (sig !== '.FIT') throw new Error('Não é um arquivo FIT válido.')
  const end = Math.min(buf.byteLength, headerSize + dataSize)
  const defs = new Map<number, Def>()
  const points: TrackPoint[] = []
  let sport: Sport | null = null
  let totalDistanceM: number | null = null
  let totalTimerS: number | null = null
  let lastTs = 0
  let p = headerSize

  while (p < end) {
    const h = view.getUint8(p++)
    let local: number
    let tsOffset: number | null = null
    if (h & 0x80) {
      local = (h >> 5) & 0x03
      tsOffset = h & 0x1f
    } else if (h & 0x40) {
      // Mensagem de definição
      local = h & 0x0f
      const little = view.getUint8(p + 1) === 0
      const global = view.getUint16(p + 2, little)
      const n = view.getUint8(p + 4)
      p += 5
      const fields: FieldDef[] = []
      for (let i = 0; i < n; i++) {
        fields.push({ num: view.getUint8(p), size: view.getUint8(p + 1), type: view.getUint8(p + 2) })
        p += 3
      }
      let devSize = 0
      if (h & 0x20) {
        const nd = view.getUint8(p++)
        for (let i = 0; i < nd; i++) {
          devSize += view.getUint8(p + 1)
          p += 3
        }
      }
      defs.set(local, { global, little, fields, devSize })
      continue
    } else {
      local = h & 0x0f
    }
    const def = defs.get(local)
    if (!def) throw new Error('Arquivo FIT corrompido (mensagem sem definição).')
    const values = new Map<number, number | null>()
    for (const f of def.fields) {
      values.set(f.num, readField(view, p, f, def.little))
      p += f.size
    }
    p += def.devSize

    let ts = values.get(253) ?? null
    if (ts != null) lastTs = ts
    else if (tsOffset != null) {
      ts = (lastTs & ~0x1f) + tsOffset + (tsOffset < (lastTs & 0x1f) ? 0x20 : 0)
      lastTs = ts
    }

    if (def.global === 20) {
      const lat = values.get(0)
      const lng = values.get(1)
      if (ts == null || lat == null || lng == null) continue
      const altRaw = values.get(78) ?? values.get(2) ?? null
      const hr = values.get(3)
      points.push({
        t: (ts + FIT_EPOCH) * 1000,
        lat: lat * SEMI,
        lng: lng * SEMI,
        acc: 5,
        alt: altRaw != null ? altRaw / 5 - 500 : null,
        seg: 0,
        ...(hr != null && hr > 0 ? { hr } : {}),
      })
    } else if (def.global === 18 || def.global === 12) {
      const sp = values.get(def.global === 18 ? 5 : 0)
      if (sp != null && SPORTS[sp]) sport = SPORTS[sp]
      if (def.global === 18) {
        const dist = values.get(9)
        const timer = values.get(8) ?? values.get(7)
        if (dist != null) totalDistanceM = dist / 100
        if (timer != null) totalTimerS = timer / 1000
      }
    }
  }

  points.sort((a, b) => a.t - b.t)
  const first = points[0]
  const fingerprint = first ? `fit:${first.t}:${points.length}:${first.lat.toFixed(5)}` : 'fit:empty'
  return { name: null, sport, points, fingerprint, totalDistanceM, totalTimerS }
}
