import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SPORT_LABEL } from '../domain/activity'
import { deleteGroup, saveGroup } from '../services/actions'
import { useApp } from '../services/store'
import { DemoBadge, PageHead, SportIcon } from '../ui/components'
import { back, navigate } from '../ui/router'
import { EventForm } from './EventForm'
import { LEVELS } from './Onboarding'

export function GroupPage({ id }: { id: string }) {
  const g = useApp((s) => s.groups.find((x) => x.id === id))
  const events = useApp((s) => s.events.filter((e) => e.groupId === id))
  const [newEvent, setNewEvent] = useState(false)
  if (!g) return <div className="stack"><h1>Grupo não encontrado</h1><a className="btn" href="#/comunidade">Comunidade</a></div>
  const level = g.level === 'all' ? 'Todos os níveis' : LEVELS.find((l) => l.value === g.level)?.label
  return (
    <div>
      <button className="btn ghost sm" onClick={() => back('/comunidade')} style={{ marginBottom: 12 }}><ArrowLeft size={16} aria-hidden="true" /> Voltar</button>
      <PageHead title={g.name} subtitle={<>{g.region} · {SPORT_LABEL[g.sport]} · {level} {g.origin === 'demo' && <DemoBadge />}</>} />
      <div className="grid lg-split">
        <div className="stack">
          <div className="panel stack tight">
            <p>{g.description || 'Sem descrição.'}</p>
            <p className="small muted"><strong>Horário:</strong> {g.schedule || 'a combinar'}</p>
          </div>
          <div className="panel stack tight">
            <h3>Regras</h3>
            <p className="small muted" style={{ whiteSpace: 'pre-line' }}>{g.rules || 'Nenhuma regra definida.'}</p>
          </div>
          <section>
            <div className="section-head"><h2>Encontros do grupo</h2>{g.origin === 'mine' && <button className="btn sm" onClick={() => setNewEvent(true)}><Plus size={14} aria-hidden="true" /> Agendar</button>}</div>
            <div className="panel flush list">
              {events.map((e) => (
                <a key={e.id} className="list-item" href={`#/evento/${e.id}`}>
                  <SportIcon sport={e.sport} size={18} />
                  <div className="grow"><div className="title">{e.title}</div><div className="meta">{new Date(e.startsAt).toLocaleString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div>
                </a>
              ))}
              {events.length === 0 && <div className="list-item small muted">Nenhum encontro agendado.</div>}
            </div>
          </section>
        </div>
        <div className="stack">
          <button className={`btn ${g.joined ? '' : 'primary'}`} onClick={() => void saveGroup({ ...g, joined: !g.joined })}>{g.joined ? 'Sair do grupo' : 'Participar do grupo'}</button>
          <p className="tiny faint">
            {g.origin === 'demo' ? 'Grupo de demonstração: a participação não é salva.' : 'A comunicação entre participantes (mensagens e lista de membros) depende da comunidade online. Por enquanto, combine pelo link dos encontros.'}
          </p>
          {g.origin === 'mine' && (
            <button className="btn danger" onClick={async () => { if (confirm('Excluir este grupo?')) { await deleteGroup(g.id); navigate('/comunidade', true) } }}><Trash2 size={16} aria-hidden="true" /> Excluir grupo</button>
          )}
        </div>
      </div>
      {newEvent && <EventForm groupId={g.id} onClose={() => setNewEvent(false)} />}
    </div>
  )
}
