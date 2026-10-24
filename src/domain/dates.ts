// Datas de calendário como strings YYYY-MM-DD. A aritmética é feita em UTC sobre
// a própria string, então horário de verão e fuso não deslocam dias.

const pad = (n: number) => String(n).padStart(2, '0')

/** Data local (no fuso do dispositivo) de um instante. */
export function localDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Data local considerando um deslocamento de fuso explícito (minutos, como getTimezoneOffset). */
export function localDateWithOffset(ms: number, tzOffset: number): string {
  const d = new Date(ms - tzOffset * 60000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function parse(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fmt(utcMs: number): string {
  const d = new Date(utcMs)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function addDays(date: string, n: number): string {
  return fmt(parse(date) + n * 86400000)
}

export function diffDays(a: string, b: string): number {
  return Math.round((parse(b) - parse(a)) / 86400000)
}

/** 0 = domingo ... 6 = sábado */
export function weekday(date: string): number {
  return new Date(parse(date)).getUTCDay()
}

/** Segunda-feira da semana da data. */
export function weekStart(date: string): string {
  const wd = weekday(date)
  return addDays(date, wd === 0 ? -6 : 1 - wd)
}

export function monthKey(date: string): string {
  return date.slice(0, 7)
}

export function monthDays(month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`)
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

export function range(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export function today(now = Date.now()): string {
  return localDate(now)
}
