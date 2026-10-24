import L from 'leaflet'
import { Accessibility, ArrowLeft, CalendarPlus, Check, Link2, Trash2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { DIFFICULTY_LABEL, SPORT_LABEL } from '../domain/activity'
import { buildIcs } from '../domain/ics'
import type { CommunityEvent } from '../domain/types'
import { deleteEvent, saveEvent, toast } from '../services/actions'
import { uid } from '../services/ids'
import { useApp } from '../services/store'
import { DemoBadge, download, Notice, PageHead } from '../ui/components'
import { pin, PLAN_STYLE, useLeaflet } from '../ui/map'
import { back, navigate, useRoute } from '../ui/router'

// Compartilhamento sem servidor: os dados públicos do encontro vão no próprio link.
type SharedPayload = Pick<CommunityEvent, 'title' | 'sport' | 'startsAt' | 'durationMin' | 'meetingPoint' | 'distanceKm' | 'difficulty' | 'maxParticipants' | 'accessibility' | 'description'> & { route?: [number, number][] }

function encode(p: SharedPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(p))
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decode(s: string): SharedPayload | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as SharedPayload
    if (typeof p.title !== 'string' || typeof p.startsAt !== 'number' || typeof p.durationMin !== 'number') return null
    return { ...p, title: p.title.slice(0, 80), description: String(p.description ?? '').slice(0, 600), accessibility: String(p.accessibility ?? '').slice(0, 300) }
  } catch {
    return null
  }
}

function EventMap({ e, route }: { e: SharedPayload; route?: [number, number][] }) {
  const { ref, map } = useLeaflet({ zoom: 15 })
  useEffect(() => {
    if (!map) return
    const layers: L.Layer[] = []
    if (route && route.length > 1) layers.push(L.polyline(route, PLAN_STYLE))
    if (e.meetingPoint.lat != null) layers.push(L.marker([e.meetingPoint.lat, e.meetingPoint.lng!], { icon: pin('meeting'), title: e.meetingPoint.name }))
    if (!layers.length) return
    const g = L.featureGroup(layers).addTo(map)
    map.fitBounds(g.getBounds(), { padding: [30, 30], maxZoom: 16 })
  }, [map, e, route])
  return <div ref={ref} className="map event-map" aria-label="Mapa do ponto de encontro" />
}

function Details({ e }: { e: SharedPayload }) {
  const start = new Date(e.startsAt)
  return (
    <div className="panel stack tight">
      <div className="grid two">
        <div className="stat"><div className="label">Quando</div><div className="value" style={{ fontSize: '1.1rem' }}>{start.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div><div className="sub">{start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {e.durationMin} min</div></div>
        <div className="stat"><div className="label">Onde</div><div className="value" style={{ fontSize: '1.1rem' }}>{e.meetingPoint.name}</div></div>
        <div className="stat"><div className="label">Dificuldade</div><div className="value" style={{ fontSize: '1.1rem' }}>{DIFFICULTY_LABEL[e.difficulty]}</div></div>
        <div className="stat"><div className="label">Distância estimada</div><div className="value" style={{ fontSize: '1.1rem' }}>{e.distanceKm ? `${String(e.distanceKm).replace('.', ',')} km` : '—'}</div></div>
      </div>
      {e.maxParticipants && <p className="small muted">Limite: {e.maxParticipants} participantes.</p>}
      {e.description && <p>{e.description}</p>}
      <div className="access-box">
        <Accessibility size={18} aria-hidden="true" />
        <div><strong>Acessibilidade</strong><p className="small muted">{e.accessibility || 'O organizador não informou detalhes de acessibilidade.'}</p></div>
      </div>
    </div>
  )
}

function icsFor(e: CommunityEvent | SharedPayload, id: string) {
  return new Blob([buildIcs([{ uid: id, title: `Move+: ${e.title}`, start: e.startsAt, durationMin: e.durationMin, location: e.meetingPoint.name, description: e.description }])], { type: 'text/calendar' })
}

export function EventPage({ id }: { id: string }) {
  const e = useApp((s) => s.events.find((x) => x.id === id))
  const route = useApp((s) => s.routes.find((r) => r.id === e?.routeId))
  if (!e) return <div className="stack"><h1>Encontro não encontrado</h1><a className="btn" href="#/comunidade">Comunidade</a></div>
  const now = Date.now()
  const ended = e.startsAt + e.durationMin * 60000 <= now
  const started = e.startsAt <= now
  const routePts = route?.points.map((p) => [p.lat, p.lng] as [number, number])

  const shareLink = async () => {
    const payload: SharedPayload = { title: e.title, sport: e.sport, startsAt: e.startsAt, durationMin: e.durationMin, meetingPoint: e.meetingPoint, distanceKm: e.distanceKm, difficulty: e.difficulty, maxParticipants: e.maxParticipants, accessibility: e.accessibility, description: e.description, route: routePts?.filter((_, i, a) => i % Math.max(1, Math.ceil(a.length / 150)) === 0) }
    const url = `${location.origin}${location.pathname}#/evento-compartilhado?d=${encode(payload)}`
    try {
      if (navigator.share) await navigator.share({ title: e.title, text: `${e.title} · Move+`, url })
      else { await navigator.clipboard.writeText(url); toast({ kind: 'info', title: 'Link copiado' }) }
    } catch { /* cancelado */ }
  }

  return (
    <div>
      <button className="btn ghost sm" onClick={() => back('/comunidade')} style={{ marginBottom: 12 }}><ArrowLeft size={16} aria-hidden="true" /> Voltar</button>
      <PageHead title={e.title} subtitle={<>{SPORT_LABEL[e.sport]} {e.origin === 'demo' && <DemoBadge />}{e.origin === 'link' && <span className="badge">Recebido por link</span>}</>} />
      <div className="grid lg-split">
        <div className="stack">
          {(e.meetingPoint.lat != null || routePts) && <EventMap e={e} route={routePts} />}
          <Details e={e} />
        </div>
        <div className="stack">
          {!ended && (
            <button className={`btn ${e.going ? '' : 'primary'}`} onClick={() => void saveEvent({ ...e, going: !e.going })}>
              {e.going ? <><Check size={16} aria-hidden="true" /> Vou participar</> : 'Participar'}
            </button>
          )}
          {started && e.going && e.origin !== 'demo' && (
            <div className="panel stack tight">
              <strong>Confirmar presença</strong>
              <p className="small muted">Confirme depois do encontro, se você participou. A confirmação vale XP de participação e conta nas missões coletivas.</p>
              <button className={`btn ${e.attended ? '' : 'accent'}`} disabled={e.attended} onClick={() => void saveEvent({ ...e, attended: true })}>{e.attended ? 'Presença confirmada' : 'Eu participei'}</button>
            </div>
          )}
          {e.origin === 'demo' && <Notice>Encontro de demonstração. Participação e presença não são registradas.</Notice>}
          <button className="btn" onClick={() => download('encontro-moveplus.ics', icsFor(e, e.id))}><CalendarPlus size={16} aria-hidden="true" /> Adicionar ao calendário do aparelho</button>
          {e.origin !== 'demo' && <button className="btn" onClick={() => void shareLink()}><Link2 size={16} aria-hidden="true" /> Compartilhar link do encontro</button>}
          <p className="tiny faint">O link contém apenas os dados do encontro (nome, horário, ponto de encontro, rota e acessibilidade), nunca a sua localização. Compartilhar localização em tempo real exigirá a comunidade online, sempre com autorização e por tempo limitado.</p>
          {e.origin !== 'demo' && (
            <button className="btn danger" onClick={async () => { if (confirm('Excluir este encontro?')) { await deleteEvent(e.id); navigate('/comunidade', true) } }}><Trash2 size={16} aria-hidden="true" /> Excluir</button>
          )}
        </div>
      </div>
    </div>
  )
}

export function SharedEventPage() {
  const route = useRoute()
  const p = useMemo(() => decode(route.query.get('d') ?? ''), [route.query])
  if (!p) return <div className="stack"><h1>Link inválido</h1><p className="muted">Não foi possível ler os dados deste encontro.</p><a className="btn" href="#/">Início</a></div>
  const save = async () => {
    const e: CommunityEvent = { id: uid(), title: p.title, sport: p.sport, startsAt: p.startsAt, durationMin: p.durationMin, meetingPoint: p.meetingPoint, routeId: null, distanceKm: p.distanceKm ?? null, difficulty: p.difficulty, maxParticipants: p.maxParticipants ?? null, accessibility: p.accessibility, description: p.description, groupId: null, origin: 'link', going: true, attended: false, createdAt: Date.now() }
    await saveEvent(e)
    navigate(`/evento/${e.id}`, true)
  }
  return (
    <div>
      <PageHead title={p.title} subtitle={<>{SPORT_LABEL[p.sport] ?? ''} <span className="badge">Convite recebido</span></>} />
      <div className="grid lg-split">
        <div className="stack">
          {(p.meetingPoint.lat != null || p.route) && <EventMap e={p} route={p.route} />}
          <Details e={p} />
        </div>
        <div className="stack">
          <button className="btn primary" onClick={() => void save()}><Check size={16} aria-hidden="true" /> Salvar na minha agenda</button>
          <button className="btn" onClick={() => download('encontro-moveplus.ics', icsFor(p, 'shared-' + p.startsAt))}><CalendarPlus size={16} aria-hidden="true" /> Adicionar ao calendário do aparelho</button>
          <p className="tiny faint">Encontro criado por outra pessoa e recebido por link. Confira o local e o horário com quem convidou.</p>
        </div>
      </div>
    </div>
  )
}
