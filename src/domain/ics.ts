// Geração de arquivos iCalendar (RFC 5545). É a forma de levar eventos da Move+ para
// o calendário do aparelho sem pedir acesso aos eventos pessoais do usuário.

export interface IcsEvent {
  uid: string
  title: string
  start: number
  durationMin: number
  location?: string
  description?: string
}

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`)

/** Quebra linhas com mais de 75 octetos, como exige a especificação. */
function fold(line: string): string {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) {
    out.push(rest.slice(0, 74))
    rest = ' ' + rest.slice(74)
  }
  out.push(rest)
  return out.join('\r\n')
}

export function buildIcs(events: IcsEvent[], now = Date.now()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Move+//Calendario//PT-BR', 'CALSCALE:GREGORIAN']
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@moveplus`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.start + e.durationMin * 60000)}`,
      `SUMMARY:${escape(e.title)}`,
    )
    if (e.location) lines.push(`LOCATION:${escape(e.location)}`)
    if (e.description) lines.push(`DESCRIPTION:${escape(e.description)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
