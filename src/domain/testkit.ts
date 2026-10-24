import { localDate } from './dates'
import type { Activity, Settings, TrackPoint } from './types'
import { defaultSettings } from './defaults'

let seq = 0

/** Cria uma atividade de teste começando no horário local indicado ("2026-10-20T07:00"). */
export function act(start: string, minutes: number, km: number, over: Partial<Activity> = {}): Activity {
  const startedAt = new Date(start).getTime()
  const endedAt = startedAt + minutes * 60000
  seq++
  return {
    id: over.id ?? `a${seq}`,
    sport: 'walk',
    source: 'gps',
    status: 'completed',
    title: '',
    description: '',
    privacy: 'private',
    startedAt,
    endedAt,
    localDate: localDate(startedAt),
    tzOffset: new Date(startedAt).getTimezoneOffset(),
    elapsedS: minutes * 60,
    movingS: minutes * 60,
    distanceM: km * 1000,
    splits: [],
    elevationGainM: null,
    avgHr: null,
    maxHr: null,
    weakSignalRatio: 0,
    signalGaps: 0,
    photoIds: [],
    externalId: null,
    duplicateOf: null,
    hasTrack: false,
    createdAt: startedAt + seq,
    updatedAt: startedAt,
    ...over,
  }
}

export function settings(over: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(0), ...over }
}

/** Gera uma linha reta para o norte com velocidade constante (m/s), uma leitura a cada `every` s. */
export function line(startMs: number, speed: number, seconds: number, every = 5, seg = 0, from = { lat: -5.8, lng: -35.2 }): TrackPoint[] {
  const pts: TrackPoint[] = []
  const mPerDegLat = 111195
  for (let s = 0; s <= seconds; s += every) {
    pts.push({ t: startMs + s * 1000, lat: from.lat + (speed * s) / mPerDegLat, lng: from.lng, acc: 5, seg })
  }
  return pts
}
