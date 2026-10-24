import { describe, expect, it } from 'vitest'
import { activeMinutes } from './activity'
import { evaluateAchievements } from './achievements'
import { addDays, diffDays, localDateWithOffset, monthDays, weekStart } from './dates'
import { countedActivities, resolveDuplicates } from './dedup'
import { derive, fitnessResolver } from './engine'
import { haversine } from './geo'
import { parseTrackFile, toGpx } from './gpx'
import { buildIcs } from './ics'
import { levelFor, xpForLevel } from './levels'
import { missionProgress, MISSIONS, periodKey, periodRange } from './missions'
import { personalRecords, series, summarize } from './stats'
import { computeStreak, dayTotals } from './streak'
import { act, line, settings } from './testkit'
import { analyzeTrack, elevationGain, filterTrack, rejectReason } from './track'
import type { TrackPoint } from './types'
import { activityXp, DAILY_ACTIVITY_XP_CAP } from './xp'
import { clock, km, pace } from './format'

const T0 = new Date('2026-10-20T07:00:00').getTime()

describe('geo', () => {
  it('1 grau de latitude tem ~111,2 km', () => {
    expect(haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -1)
  })
  it('distância simétrica e zero no mesmo ponto', () => {
    const a = { lat: -5.79, lng: -35.21 }, b = { lat: -5.8, lng: -35.2 }
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 6)
    expect(haversine(a, a)).toBe(0)
  })
})

describe('track: filtragem e distância', () => {
  it('caminhada reta de 1,4 m/s por 26 min dá ~2,18 km com 2 parciais completas', () => {
    const pts = line(T0, 1.4, 1560)
    const s = analyzeTrack(pts, 'walk')
    expect(s.distanceM).toBeGreaterThan(2160)
    expect(s.distanceM).toBeLessThan(2200)
    expect(s.splits.filter((x) => !x.partial)).toHaveLength(2)
    expect(s.splits[0].durationS).toBeCloseTo(1000 / 1.4, 0)
    expect(s.splits[2].partial).toBe(true)
    expect(s.movingS).toBeCloseTo(1560, -1)
  })

  it('descarta leituras imprecisas e saltos impossíveis', () => {
    const pts = line(T0, 1.4, 300)
    const bad: TrackPoint = { ...pts[10], t: pts[10].t + 1000, lat: pts[10].lat + 0.01 } // ~1,1 km em 1 s
    const weak: TrackPoint = { ...pts[20], t: pts[20].t + 1000, acc: 120 }
    const raw = [...pts.slice(0, 11), bad, ...pts.slice(11, 21), weak, ...pts.slice(21)]
    const { accepted, weak: nWeak } = filterTrack(raw, 'walk')
    expect(accepted).not.toContain(bad)
    expect(accepted).not.toContain(weak)
    expect(nWeak).toBe(1)
    expect(analyzeTrack(raw, 'walk').distanceM).toBeCloseTo(analyzeTrack(pts, 'walk').distanceM, 0)
  })

  it('ruído parado não soma distância nem tempo em movimento', () => {
    const still: TrackPoint[] = Array.from({ length: 60 }, (_, i) => ({
      t: T0 + i * 5000, lat: -5.8 + (i % 2 ? 0.00001 : -0.00001), lng: -35.2, acc: 8, seg: 0,
    }))
    const s = analyzeTrack(still, 'walk')
    expect(s.distanceM).toBeLessThan(5)
    expect(s.movingS).toBe(0)
  })

  it('não liga trechos separados por pausa', () => {
    const a = line(T0, 1.4, 300, 5, 0)
    const last = a[a.length - 1]
    // retoma 1 km adiante (deslocado de carro, por exemplo) depois de 10 min de pausa
    const b = line(T0 + 900000, 1.4, 300, 5, 1, { lat: last.lat + 0.009, lng: last.lng })
    const s = analyzeTrack([...a, ...b], 'walk')
    expect(s.distanceM).toBeCloseTo(2 * 1.4 * 300, -1)
    expect(s.activeS).toBeCloseTo(600, 0)
  })

  it('rejeita leitura repetida ou fora de ordem', () => {
    const p: TrackPoint = { t: T0, lat: 0, lng: 0, acc: 5, seg: 0 }
    expect(rejectReason(p, { ...p }, 'run')).toBe('stale')
  })

  it('elevação com histerese ignora ruído e exige altitude suficiente', () => {
    const base = line(T0, 1.4, 100, 5)
    const noisy = base.map((p, i) => ({ ...p, alt: 10 + (i % 2) * 2 }))
    expect(elevationGain(noisy)).toBe(0)
    const climb = base.map((p, i) => ({ ...p, alt: 10 + i }))
    expect(elevationGain(climb)).toBeGreaterThanOrEqual(18)
    expect(elevationGain(base)).toBeNull()
  })
})

describe('datas', () => {
  it('aritmética de datas sem depender do fuso', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29')
    expect(diffDays('2026-10-01', '2026-10-31')).toBe(30)
    expect(weekStart('2026-10-25')).toBe('2026-10-19') // domingo -> segunda anterior
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
    expect(monthDays('2026-02')).toHaveLength(28)
  })
  it('data local respeita o fuso registrado na atividade', () => {
    const ms = Date.UTC(2026, 9, 21, 1, 30) // 01:30 UTC = 22:30 do dia 20 em UTC-3
    expect(localDateWithOffset(ms, 180)).toBe('2026-10-20')
    expect(localDateWithOffset(ms, -60)).toBe('2026-10-21')
  })
})

describe('sequência de dias', () => {
  const rule = { kind: 'activity' as const, minMinutes: 10 }

  it('conta dias consecutivos e mantém a sequência viva até o fim de hoje', () => {
    const acts = [act('2026-10-18T07:00', 20, 1), act('2026-10-19T07:00', 20, 1), act('2026-10-20T07:00', 20, 1)]
    const s = computeStreak(dayTotals(acts), rule, 20, '2026-10-21')
    expect(s.current).toBe(3)
    expect(s.pendingToday).toBe(true)
    const s2 = computeStreak(dayTotals(acts), rule, 20, '2026-10-22')
    expect(s2.current).toBe(0)
    expect(s2.best).toBe(3)
  })

  it('atividade que atravessa a meia-noite conta só no dia em que começou', () => {
    const a = act('2026-10-20T23:40', 40, 4)
    const s = computeStreak(dayTotals([a]), rule, 20, '2026-10-21')
    expect([...s.activeDays]).toEqual(['2026-10-20'])
    expect(s.current).toBe(1)
  })

  it('várias atividades no mesmo dia geram um único dia de sequência', () => {
    const acts = [act('2026-10-20T07:00', 15, 1), act('2026-10-20T12:00', 15, 1), act('2026-10-20T18:00', 15, 1)]
    expect(computeStreak(dayTotals(acts), rule, 20, '2026-10-20').current).toBe(1)
  })

  it('atividade curta demais não mantém a sequência; regra de meta soma o dia', () => {
    const acts = [act('2026-10-20T07:00', 6, 0.5), act('2026-10-20T09:00', 6, 0.5)]
    expect(computeStreak(dayTotals(acts), rule, 10, '2026-10-20').current).toBe(0)
    expect(computeStreak(dayTotals(acts), { kind: 'goal' }, 10, '2026-10-20').current).toBe(1)
  })

  it('duplicada importada não cria dia extra e remover recalcula', () => {
    const gps = act('2026-10-19T07:00', 30, 3)
    const imp = act('2026-10-19T07:01', 29, 3, { source: 'import' })
    const today = act('2026-10-20T07:00', 30, 3)
    const d = derive([gps, imp, today], [], settings(), '2026-10-20')
    expect(d.streak.current).toBe(2)
    expect(d.counted.map((a) => a.id)).not.toContain(imp.id)
    const after = derive([imp, today], [], settings(), '2026-10-20') // GPS apagada: a importada assume
    expect(after.streak.current).toBe(2)
    const none = derive([today], [], settings(), '2026-10-20')
    expect(none.streak.current).toBe(1)
  })
})

describe('deduplicação', () => {
  it('prefere GPS a importado e importado a manual', () => {
    const manual = act('2026-10-20T07:00', 30, 0, { source: 'manual' })
    const imp = act('2026-10-20T07:02', 28, 3, { source: 'import' })
    const gps = act('2026-10-20T07:01', 29, 3, { source: 'gps' })
    const dup = resolveDuplicates([manual, imp, gps])
    expect(dup.get(manual.id)).toBe(gps.id)
    expect(dup.get(imp.id)).toBe(gps.id)
    expect(countedActivities([manual, imp, gps])).toEqual([gps])
  })
  it('atividades sem sobreposição relevante continuam separadas', () => {
    const a = act('2026-10-20T07:00', 30, 3)
    const b = act('2026-10-20T07:25', 30, 3)
    expect(resolveDuplicates([a, b]).size).toBe(0)
  })
  it('demonstrações nunca contam', () => {
    expect(countedActivities([act('2026-10-20T07:00', 30, 3, { source: 'demo' })])).toEqual([])
  })
})

describe('XP e níveis', () => {
  it('regra de pontuação transparente e manual vale metade', () => {
    expect(activityXp(act('2026-10-20T07:00', 30, 3))).toBe(10 + 30 + 9)
    expect(activityXp(act('2026-10-20T07:00', 30, 3, { source: 'manual' }))).toBe(Math.round(49 / 2))
    expect(activityXp(act('2026-10-20T07:00', 4, 0.3))).toBe(0)
    expect(activityXp(act('2026-10-20T07:00', 300, 40))).toBe(10 + 60 + 30)
  })

  it('sincronização repetida não gera XP extra', () => {
    const gps = act('2026-10-20T07:00', 30, 3)
    const once = derive([gps], [], settings(), '2026-10-20')
    const twice = derive([gps, act('2026-10-20T07:00', 30, 3, { source: 'import' }), act('2026-10-20T07:00', 30, 3, { source: 'import' })], [], settings(), '2026-10-20')
    expect(twice.xpTotal).toBe(once.xpTotal)
    expect(new Set(twice.xp.map((e) => e.key)).size).toBe(twice.xp.length)
  })

  it('limite diário de XP de atividades', () => {
    const acts = Array.from({ length: 6 }, (_, i) => act(`2026-10-20T0${i + 1}:00`, 50, 5))
    const d = derive(acts, [], settings(), '2026-10-20')
    const fromActs = d.xp.filter((e) => e.kind === 'activity').reduce((s, e) => s + e.amount, 0)
    expect(fromActs).toBe(DAILY_ACTIVITY_XP_CAP)
  })

  it('encontro com presença confirmada dá XP uma vez; organizador ganha bônus', () => {
    const ev = { id: 'e1', title: 'Caminhada', sport: 'walk' as const, startsAt: T0, durationMin: 60, meetingPoint: { name: 'Praça', lat: null, lng: null }, routeId: null, distanceKm: 3, difficulty: 'easy' as const, maxParticipants: null, accessibility: '', description: '', groupId: null, origin: 'mine' as const, going: true, attended: true, createdAt: T0 }
    const d = derive([], [ev], settings(), '2026-10-20')
    expect(d.xp.filter((e) => e.kind === 'event').map((e) => e.amount)).toEqual([40, 30])
    expect(derive([], [{ ...ev, attended: false }], settings(), '2026-10-20').xpTotal).toBe(0)
  })

  it('níveis progressivos', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(levelFor(0).level).toBe(1)
    expect(levelFor(99).level).toBe(1)
    expect(levelFor(100).level).toBe(2)
    expect(levelFor(450).progress).toBeCloseTo(0.5)
    expect(levelFor(1e6).name).toMatch(/Órbita/)
  })

  it('XP permanece igual ao recalcular (persistência derivada)', () => {
    const acts = [act('2026-10-18T07:00', 30, 3), act('2026-10-19T07:00', 30, 3), act('2026-10-20T07:00', 30, 3)]
    const a = derive(acts, [], settings(), '2026-10-20')
    const b = derive([...acts].reverse(), [], settings(), '2026-10-20')
    expect(b.xpTotal).toBe(a.xpTotal)
    expect(a.xp.some((e) => e.key === 'streak:2026-10-20')).toBe(true)
  })
})

describe('missões', () => {
  const ctxFor = (acts: ReturnType<typeof act>[], s = settings()) => {
    const d = derive(acts, [], s, '2026-10-22')
    return { counted: d.counted, totals: d.totals, activeDays: d.streak.activeDays, dailyGoalMin: s.dailyGoalMin, events: [], fitnessAt: fitnessResolver(s) }
  }

  it('semana constante conta dias ativos da semana e registra o instante de conclusão', () => {
    const acts = [act('2026-10-19T07:00', 20, 1), act('2026-10-20T07:00', 20, 1), act('2026-10-21T07:00', 20, 1)]
    const def = MISSIONS.find((m) => m.id === 'w-days')!
    const p = missionProgress(def, periodKey('weekly', '2026-10-22'), ctxFor(acts))
    expect(p.value).toBe(3)
    expect(p.done).toBe(true)
    expect(p.completedAt).toBe(acts[2].endedAt)
  })

  it('alvo usa o condicionamento vigente no período', () => {
    const s = settings({ fitness: 'advanced', fitnessLog: [{ from: '2026-01-01', level: 'beginner' }, { from: '2026-10-26', level: 'advanced' }] })
    const def = MISSIONS.find((m) => m.id === 'w-days')!
    expect(missionProgress(def, '2026-10-19', ctxFor([], s)).target).toBe(3)
    expect(missionProgress(def, '2026-10-26', ctxFor([], s)).target).toBe(5)
  })

  it('períodos de temporada cobrem trimestres', () => {
    expect(periodKey('season', '2026-11-03')).toBe('2026-T4')
    expect(periodRange('season', '2026-T4')).toEqual(['2026-10-01', '2026-12-31'])
    expect(periodRange('season', '2024-T1')).toEqual(['2024-01-01', '2024-03-31'])
  })
})

describe('conquistas', () => {
  it('desbloqueia com a data da atividade que cumpriu o requisito', () => {
    const acts = [act('2026-10-18T07:00', 20, 0.6), act('2026-10-19T07:00', 20, 0.6), act('2026-10-20T07:00', 20, 1.2)]
    const totals = dayTotals(acts)
    const streak = computeStreak(totals, { kind: 'activity', minMinutes: 10 }, 20, '2026-10-20')
    const res = evaluateAchievements(acts, streak, 20, [])
    const get = (id: string) => res.find((r) => r.def.id === id)!
    expect(get('first-activity').unlockedAt).toBe(acts[0].endedAt)
    expect(get('first-km').unlockedAt).toBe(acts[2].endedAt)
    expect(get('streak-3').unlockedAt).toBe(acts[2].endedAt)
    expect(get('streak-7').unlockedAt).toBeNull()
    expect(get('streak-7').value).toBe(3)
  })
})

describe('estatísticas', () => {
  const acts = [
    act('2026-10-19T07:00', 30, 3, { sport: 'run', splits: [{ km: 1, distanceM: 1000, durationS: 330, paceSPerKm: 330, partial: false }] }),
    act('2026-10-20T07:00', 60, 5),
    act('2026-10-27T07:00', 20, 2, { sport: 'run' }),
  ]
  it('série contínua por semana com períodos vazios', () => {
    const s = series(acts, '2026-10-12', '2026-10-31', 'week')
    expect(s.map((p) => p.key)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26'])
    expect(s[1].distanceM).toBe(8000)
    expect(s[0].count).toBe(0)
  })
  it('resumo filtra por modalidade', () => {
    expect(summarize(acts, '2026-10-01', '2026-10-31', 'run').distanceM).toBe(5000)
    expect(summarize(acts, '2026-10-01', '2026-10-31').activeDays).toBe(3)
  })
  it('recordes: ritmo só entre medidas da mesma modalidade', () => {
    const r = personalRecords(acts, 'run')
    expect(r.find((x) => x.label.startsWith('Maior distância'))!.value).toBe(3000)
    expect(r.find((x) => x.label.startsWith('Quilômetro'))!.value).toBe(330)
    expect(personalRecords(acts).some((x) => x.unit === 'pace')).toBe(false)
  })
  it('minutos ativos usam o tempo em movimento', () => {
    expect(activeMinutes(act('2026-10-20T07:00', 30, 3, { movingS: 1200 }))).toBe(20)
  })
})

describe('arquivos GPX/TCX e iCalendar', () => {
  it('lê GPX com elevação e frequência cardíaca', () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><name>Treino</name><type>running</type><trkseg>
      <trkpt lat="-5.8" lon="-35.2"><ele>10</ele><time>2026-10-20T10:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>120</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="-5.801" lon="-35.2"><ele>12</ele><time>2026-10-20T10:00:30Z</time></trkpt>
    </trkseg></trk></gpx>`
    const p = parseTrackFile(gpx)
    expect(p.name).toBe('Treino')
    expect(p.sport).toBe('run')
    expect(p.points).toHaveLength(2)
    expect(p.points[0].hr).toBe(120)
    expect(p.points[1].alt).toBe(12)
  })
  it('lê TCX', () => {
    const tcx = `<TrainingCenterDatabase><Activities><Activity Sport="Running"><Lap><Track>
      <Trackpoint><Time>2026-10-20T10:00:00Z</Time><Position><LatitudeDegrees>-5.8</LatitudeDegrees><LongitudeDegrees>-35.2</LongitudeDegrees></Position><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>
      <Trackpoint><Time>2026-10-20T10:00:10Z</Time><Position><LatitudeDegrees>-5.8001</LatitudeDegrees><LongitudeDegrees>-35.2</LongitudeDegrees></Position></Trackpoint>
    </Track></Lap></Activity></Activities></TrainingCenterDatabase>`
    const p = parseTrackFile(tcx)
    expect(p.sport).toBe('run')
    expect(p.points.map((x) => x.hr)).toEqual([130, undefined])
  })
  it('exporta e relê o mesmo trajeto', () => {
    const pts = line(T0, 2.5, 120, 10)
    const a = act('2026-10-20T07:00', 2, 0.3, { title: 'Corrida & teste' })
    const back = parseTrackFile(toGpx(a, pts))
    expect(back.points).toHaveLength(pts.length)
    expect(back.name).toBe('Corrida & teste')
  })
  it('gera iCalendar válido com escape', () => {
    const ics = buildIcs([{ uid: 'x', title: 'Caminhada, praça; leve', start: Date.UTC(2026, 9, 20, 9), durationMin: 60 }], Date.UTC(2026, 9, 1))
    expect(ics).toContain('DTSTART:20261020T090000Z')
    expect(ics).toContain('DTEND:20261020T100000Z')
    expect(ics).toContain('SUMMARY:Caminhada\\, praça\\; leve')
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true)
  })
})

describe('formatação', () => {
  it('formata distância, tempo e ritmo', () => {
    expect(km(2180)).toBe('2,18')
    expect(km(12345)).toBe('12,3')
    expect(clock(3725)).toBe('1:02:05')
    expect(clock(65)).toBe('1:05')
    expect(pace(330)).toBe('5:30')
    expect(pace(null)).toBe('--:--')
  })
})
