import { describe, expect, it } from 'vitest'
import { AppleHealthParser, parseHealthDate } from './appleHealth'
import { parseFit } from './fit'
import { estimateSteps, StepDetector, stepsForDay } from './steps'

describe('detector de passos', () => {
  const walk = (stepsPerSec: number, seconds: number, amp = 2.5, noise = 0.15) => {
    const d = new StepDetector()
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2
    for (let t = 0; t < seconds * 1000; t += 20) {
      const a = Math.sin((2 * Math.PI * stepsPerSec * t) / 1000) * amp
      d.push(t, 0.3 + rnd() * noise, 9.81 + a + rnd() * noise, 0.2 + rnd() * noise)
    }
    return d.count
  }

  it('conta caminhada (~2 passos/s) com erro pequeno', () => {
    const n = walk(2, 30)
    expect(n).toBeGreaterThan(54)
    expect(n).toBeLessThan(66)
  })

  it('conta corrida (~3 passos/s)', () => {
    const n = walk(3, 20, 5)
    expect(n).toBeGreaterThan(54)
    expect(n).toBeLessThan(66)
  })

  it('não conta passos com o celular parado (só ruído)', () => {
    expect(walk(2, 30, 0, 0.12)).toBeLessThan(3)
  })
})

describe('passos do dia', () => {
  it('prioriza Apple Saúde, depois sensor, depois estimativa', () => {
    expect(stepsForDay({ health: 8000, sensor: 3000, estimated: 2000 })).toEqual({ value: 8000, source: 'health' })
    expect(stepsForDay({ sensor: 3000, estimated: 2000 })).toEqual({ value: 3000, source: 'sensor' })
    expect(stepsForDay({ estimated: 2000 })).toEqual({ value: 2000, source: 'estimate' })
    expect(stepsForDay({})).toBeNull()
  })
  it('estima passos só para modalidades a pé', () => {
    expect(estimateSteps(1440, 'walk')).toBe(2000)
    expect(estimateSteps(5000, 'ride')).toBeNull()
  })
})

describe('Apple Saúde', () => {
  it('converte datas com fuso', () => {
    expect(parseHealthDate('2026-10-20 07:00:00 -0300')).toBe(Date.UTC(2026, 9, 20, 10, 0, 0))
  })

  it('lê treinos e passos em partes, sem somar celular e relógio', () => {
    const xml = `<?xml version="1.0"?><HealthData>
<Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-10-20 08:00:00 -0300" endDate="2026-10-20 08:10:00 -0300" value="1200"/>
<Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-10-20 09:00:00 -0300" endDate="2026-10-20 09:10:00 -0300" value="800"/>
<Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple Watch" unit="count" startDate="2026-10-20 08:00:00 -0300" endDate="2026-10-20 08:10:00 -0300" value="1500"/>
<Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-10-20 08:00:00 -0300" endDate="2026-10-20 08:00:00 -0300" value="90"/>
<Workout workoutActivityType="HKWorkoutActivityTypeWalking" duration="30" durationUnit="min" sourceName="Apple Watch" startDate="2026-10-20 18:00:00 -0300" endDate="2026-10-20 18:30:00 -0300">
 <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" startDate="x" endDate="y" sum="2.4" unit="km"/>
</Workout>
<Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="20" durationUnit="min" totalDistance="2" totalDistanceUnit="mi" sourceName="Strava" startDate="2026-10-21 06:00:00 -0300" endDate="2026-10-21 06:20:00 -0300"/>
<Workout workoutActivityType="HKWorkoutActivityTypeYoga" duration="40" durationUnit="min" sourceName="Apple Watch" startDate="2026-10-21 19:00:00 -0300" endDate="2026-10-21 19:40:00 -0300"></Workout>
</HealthData>`
    const p = new AppleHealthParser()
    for (let i = 0; i < xml.length; i += 37) p.feed(xml.slice(i, i + 37))
    const r = p.result()
    expect(r.steps['2026-10-20']).toBe(2000)
    expect(r.workouts).toHaveLength(2)
    expect(r.workouts[0]).toMatchObject({ sport: 'walk', durationS: 1800, distanceM: 2400 })
    expect(r.workouts[1].distanceM).toBeCloseTo(3218.7, 0)
    expect(r.skippedWorkouts).toBe(1)
  })
})

/** Monta um arquivo FIT mínimo: definição + 3 pontos (record) + sessão de corrida. */
function buildFit(): ArrayBuffer {
  const bytes: number[] = []
  const u8 = (v: number) => bytes.push(v & 0xff)
  const u16 = (v: number) => { u8(v); u8(v >> 8) }
  const u32 = (v: number) => { u16(v & 0xffff); u16(v >>> 16) }
  // definição local 0 → record (20): timestamp, lat, lng, altitude, hr
  u8(0x40); u8(0); u8(0); u16(20); u8(5)
  for (const [n, s, t] of [[253, 4, 0x86], [0, 4, 0x85], [1, 4, 0x85], [2, 2, 0x84], [3, 1, 0x02]]) { u8(n); u8(s); u8(t) }
  const ts0 = 1_100_000_000
  const deg = (d: number) => Math.round((d / 180) * 2 ** 31)
  for (let i = 0; i < 3; i++) {
    u8(0x00); u32(ts0 + i * 10); u32(deg(-5.84 + i * 0.0001) >>> 0); u32(deg(-35.2) >>> 0); u16((30 + 500) * 5); u8(i === 1 ? 0xff : 140)
  }
  // ponto com carimbo comprimido (+5 s), sem altitude
  // definição local 1 → session (18): sport, total_timer_time, total_distance
  u8(0x41); u8(0); u8(0); u16(18); u8(3)
  for (const [n, s, t] of [[5, 1, 0x00], [8, 4, 0x86], [9, 4, 0x86]]) { u8(n); u8(s); u8(t) }
  u8(0x01); u8(1); u32(20000); u32(2300)
  const data = new Uint8Array(bytes)
  const out = new Uint8Array(14 + data.length + 2)
  const v = new DataView(out.buffer)
  v.setUint8(0, 14); v.setUint8(1, 0x20); v.setUint16(2, 2100, true); v.setUint32(4, data.length, true)
  out.set([0x2e, 0x46, 0x49, 0x54], 8)
  out.set(data, 14)
  return out.buffer
}

describe('arquivo FIT', () => {
  it('lê pontos, altitude, frequência cardíaca e modalidade', () => {
    const r = parseFit(buildFit())
    expect(r.points).toHaveLength(3)
    expect(r.points[0].lat).toBeCloseTo(-5.84, 5)
    expect(r.points[0].lng).toBeCloseTo(-35.2, 5)
    expect(r.points[0].alt).toBeCloseTo(30, 5)
    expect(r.points[0].hr).toBe(140)
    expect(r.points[1].hr).toBeUndefined()
    expect(r.points[2].t - r.points[0].t).toBe(20000)
    expect(r.points[0].t).toBe((1_100_000_000 + 631065600) * 1000)
    expect(r.sport).toBe('run')
    expect(r.totalDistanceM).toBe(23)
    expect(r.totalTimerS).toBe(20)
  })
  it('recusa arquivos que não são FIT', () => {
    expect(() => parseFit(new ArrayBuffer(20))).toThrow()
  })
})
