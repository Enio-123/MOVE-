const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export const fmtInt = (n: number) => nf0.format(n)

/** Distância em km com 2 casas abaixo de 10 km e 1 casa acima. */
export function km(m: number): string {
  const k = m / 1000
  return k < 10 ? nf2.format(k) : nf1.format(k)
}

/** Duração h:mm:ss ou m:ss */
export function clock(totalS: number): string {
  const s = Math.max(0, Math.floor(totalS))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`
}

/** Duração legível: 1 h 05 min, 42 min */
export function duration(totalS: number): string {
  const m = Math.round(totalS / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

/** Ritmo em min/km */
export function pace(sPerKm: number | null): string {
  if (sPerKm == null || !Number.isFinite(sPerKm) || sPerKm <= 0 || sPerKm > 3600) return '--:--'
  const m = Math.floor(sPerKm / 60)
  const s = Math.round(sPerKm % 60)
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`
}

export function speedKmh(mps: number): string {
  return nf1.format(mps * 3.6)
}

const dateLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const dateShort = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

const fromDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day, 12)
}

export const fmtDateLong = (d: string) => dateLong.format(fromDate(d))
export const fmtDateShort = (d: string) => dateShort.format(fromDate(d)).replace('.', '')
export const fmtTime = (ms: number) => timeFmt.format(ms)
export const fmtMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  const s = monthFmt.format(Date.UTC(y, m - 1, 15))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function relative(ms: number, now = Date.now()): string {
  const diff = Math.round((now - ms) / 60000)
  if (diff < 1) return 'agora'
  if (diff < 60) return `há ${diff} min`
  const h = Math.round(diff / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}
