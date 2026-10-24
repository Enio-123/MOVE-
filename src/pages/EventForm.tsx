import { useState } from 'react'
import { DIFFICULTY_LABEL, SPORTS, SPORT_LABEL } from '../domain/activity'
import type { CommunityEvent, Difficulty, Group, Sport } from '../domain/types'
import { saveEvent, saveGroup } from '../services/actions'
import { uid } from '../services/ids'
import { useApp } from '../services/store'
import { Sheet } from '../ui/components'
import { LEVELS } from './Onboarding'

export function EventForm({ onClose, onSaved, routeId, groupId }: { onClose: () => void; onSaved?: (e: CommunityEvent) => void; routeId?: string | null; groupId?: string | null }) {
  const routes = useApp((s) => s.routes)
  const places = useApp((s) => s.places)
  const groups = useApp((s) => s.groups.filter((g) => g.origin === 'mine'))
  const today = useApp((s) => s.today)
  const initialRoute = routes.find((r) => r.id === routeId)
  const [title, setTitle] = useState('')
  const [sport, setSport] = useState<Sport>(initialRoute?.sport ?? 'walk')
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('18:00')
  const [duration, setDuration] = useState('60')
  const [placeId, setPlaceId] = useState(places[0]?.id ?? '')
  const [placeName, setPlaceName] = useState('')
  const [route, setRoute] = useState(initialRoute?.id ?? '')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [max, setMax] = useState('')
  const [access, setAccess] = useState('')
  const [desc, setDesc] = useState('')
  const [group, setGroup] = useState(groupId ?? '')
  const [err, setErr] = useState('')

  const submit = async () => {
    const startsAt = new Date(`${date}T${time}`).getTime()
    const dur = Number(duration)
    const place = places.find((p) => p.id === placeId)
    const name = place?.name ?? placeName.trim()
    if (!title.trim()) return setErr('Dê um nome ao encontro.')
    if (!Number.isFinite(startsAt) || startsAt < Date.now() - 60000) return setErr('Escolha uma data e horário futuros.')
    if (!Number.isFinite(dur) || dur < 10 || dur > 480) return setErr('Duração entre 10 e 480 minutos.')
    if (!name) return setErr('Informe o ponto de encontro.')
    const maxN = max.trim() ? Number(max) : null
    if (maxN !== null && (!Number.isInteger(maxN) || maxN < 2 || maxN > 500)) return setErr('Limite de participantes entre 2 e 500.')
    const r = routes.find((x) => x.id === route)
    const e: CommunityEvent = {
      id: uid(), title: title.trim(), sport, startsAt, durationMin: dur,
      meetingPoint: { name, lat: place?.lat ?? r?.points[0]?.lat ?? null, lng: place?.lng ?? r?.points[0]?.lng ?? null },
      routeId: r?.id ?? null, distanceKm: r ? Math.round(r.distanceM / 100) / 10 : null, difficulty, maxParticipants: maxN,
      accessibility: access.trim(), description: desc.trim(), groupId: group || null, origin: 'mine', going: true, attended: false, createdAt: Date.now(),
    }
    await saveEvent(e)
    onSaved?.(e)
    onClose()
  }

  return (
    <Sheet title="Organizar encontro" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
        <label className="field"><span>Nome do encontro</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={70} placeholder="Ex.: Caminhada leve de sábado" /></label>
        <div className="grid two">
          <label className="field"><span>Modalidade</span><select className="input" value={sport} onChange={(e) => setSport(e.target.value as Sport)}>{SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABEL[s]}</option>)}</select></label>
          <label className="field"><span>Dificuldade</span><select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>{(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}</select></label>
        </div>
        <div className="grid three">
          <label className="field"><span>Data</span><input className="input" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field"><span>Horário</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <label className="field"><span>Duração (min)</span><input className="input" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} /></label>
        </div>
        <label className="field">
          <span>Ponto de encontro</span>
          <select className="input" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
            {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="">Outro (digitar)</option>
          </select>
          {!placeId && <input className="input" value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="Nome do local público" maxLength={80} />}
          <span className="hint">Use locais públicos. Pontos salvos no Mapa aparecem com localização.</span>
        </label>
        <label className="field">
          <span>Rota planejada (opcional)</span>
          <select className="input" value={route} onChange={(e) => setRoute(e.target.value)}>
            <option value="">Sem rota</option>
            {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <div className="grid two">
          <label className="field"><span>Limite de participantes</span><input className="input" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Sem limite" /></label>
          {groups.length > 0 && (
            <label className="field"><span>Grupo</span><select className="input" value={group} onChange={(e) => setGroup(e.target.value)}><option value="">Nenhum</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          )}
        </div>
        <label className="field"><span>Acessibilidade</span><textarea className="input" value={access} onChange={(e) => setAccess(e.target.value)} maxLength={300} placeholder="Ex.: percurso plano, calçada larga, rampas nos cruzamentos, banheiro acessível" /><span className="hint">Descreva apenas o que foi verificado no local.</span></label>
        <label className="field"><span>Descrição</span><textarea className="input" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={600} /></label>
        {err && <p className="error-text" role="alert">{err}</p>}
        <button className="btn primary" type="submit">Criar encontro</button>
      </form>
    </Sheet>
  )
}

export function GroupForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [region, setRegion] = useState('')
  const [sport, setSport] = useState<Sport>('walk')
  const [level, setLevel] = useState<Group['level']>('all')
  const [schedule, setSchedule] = useState('')
  const [rules, setRules] = useState('')
  const [err, setErr] = useState('')
  return (
    <Sheet title="Criar grupo" onClose={onClose}>
      <form
        className="stack"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim() || !region.trim()) return setErr('Nome e região são obrigatórios.')
          await saveGroup({ id: uid(), name: name.trim(), description: description.trim(), region: region.trim(), sport, level, schedule: schedule.trim(), rules: rules.trim(), origin: 'mine', joined: true, createdAt: Date.now() })
          onClose()
        }}
      >
        <label className="field"><span>Nome</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></label>
        <label className="field"><span>Descrição</span><textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} /></label>
        <div className="grid two">
          <label className="field"><span>Região</span><input className="input" value={region} onChange={(e) => setRegion(e.target.value)} maxLength={60} placeholder="Ex.: Zona Sul" /></label>
          <label className="field"><span>Horário habitual</span><input className="input" value={schedule} onChange={(e) => setSchedule(e.target.value)} maxLength={60} placeholder="Ex.: sábados, 7h" /></label>
        </div>
        <div className="grid two">
          <label className="field"><span>Modalidade</span><select className="input" value={sport} onChange={(e) => setSport(e.target.value as Sport)}>{SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABEL[s]}</option>)}</select></label>
          <label className="field"><span>Nível</span><select className="input" value={level} onChange={(e) => setLevel(e.target.value as Group['level'])}><option value="all">Todos os níveis</option>{LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></label>
        </div>
        <label className="field"><span>Regras do grupo</span><textarea className="input" value={rules} onChange={(e) => setRules(e.target.value)} maxLength={600} placeholder="Ex.: respeitar o ritmo de todos, ninguém fica para trás" /></label>
        {err && <p className="error-text" role="alert">{err}</p>}
        <button className="btn primary" type="submit">Criar grupo</button>
      </form>
    </Sheet>
  )
}
