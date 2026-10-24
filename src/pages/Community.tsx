import { Flag, Heart, MessageCircle, Plus, Send, ShieldOff, Trash2, UserCheck, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { DIFFICULTY_LABEL, SPORT_LABEL } from '../domain/activity'
import { km, relative } from '../domain/format'
import type { Post } from '../domain/types'
import { deletePost, ME, savePost, toast, updateCommunity, updateSettings } from '../services/actions'
import { DEMO_MEMBERS } from '../services/demo'
import { uid } from '../services/ids'
import { useApp, useDerived } from '../services/store'
import { NameAvatar, Avatar } from '../ui/Avatar'
import { DemoBadge, Empty, Notice, PageHead, Sheet, SportIcon, Switch } from '../ui/components'
import { navigate, useRoute } from '../ui/router'
import { EventForm, GroupForm } from './EventForm'
import { PRIVACY_LABEL } from './Onboarding'

type Tab = 'feed' | 'grupos' | 'encontros' | 'pessoas'

export function memberName(id: string, myName: string) {
  if (id === ME) return myName || 'Você'
  return DEMO_MEMBERS.find((m) => m.id === id)?.name ?? 'Participante'
}

export function CommunityPage() {
  const route = useRoute()
  const showDemo = useApp((s) => s.settings.showDemoCommunity)
  const [tab, setTab] = useState<Tab>(route.query.get('novoEvento') ? 'encontros' : 'feed')
  const [newEvent, setNewEvent] = useState(!!route.query.get('novoEvento'))
  const [newGroup, setNewGroup] = useState(false)

  return (
    <div>
      <PageHead title="Comunidade" subtitle="Grupos, encontros e atividades compartilhadas." />
      <Notice>
        <strong>Modo local.</strong> Ainda não há servidor da Move+ configurado: o que você publica fica neste aparelho e ninguém mais vê. Encontros podem ser compartilhados por link. A comunidade online depende da integração com o backend descrita no README.
      </Notice>
      <div className="panel" style={{ margin: '12px 0 4px' }}>
        <Switch checked={showDemo} onChange={(v) => void updateSettings({ showDemoCommunity: v })} label="Mostrar conteúdo de demonstração" description="Pessoas, grupos e encontros fictícios, sempre marcados como Demonstração, para conhecer a experiência. Não contam para XP." />
      </div>
      <div className="tabs" role="tablist" aria-label="Seções da comunidade">
        {(['feed', 'grupos', 'encontros', 'pessoas'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{{ feed: 'Feed', grupos: 'Grupos', encontros: 'Encontros', pessoas: 'Pessoas' }[t]}</button>
        ))}
      </div>
      {tab === 'feed' && <Feed />}
      {tab === 'grupos' && <Groups onCreate={() => setNewGroup(true)} />}
      {tab === 'encontros' && <Events onCreate={() => setNewEvent(true)} />}
      {tab === 'pessoas' && <People />}
      {newEvent && <EventForm routeId={route.query.get('rota')} onClose={() => setNewEvent(false)} onSaved={(e) => navigate(`/evento/${e.id}`)} />}
      {newGroup && <GroupForm onClose={() => setNewGroup(false)} />}
    </div>
  )
}

function Feed() {
  const posts = useApp((s) => s.posts)
  const blocked = useApp((s) => s.community.blocked)
  const myName = useApp((s) => s.settings.displayName)
  const d = useDerived()
  const [text, setText] = useState('')
  const [actId, setActId] = useState('')
  const shareable = [...d.counted].sort((a, b) => b.startedAt - a.startedAt).slice(0, 10)
  const visible = posts.filter((p) => !blocked.includes(p.authorId)).sort((a, b) => b.at - a.at)

  const publish = async () => {
    const act = shareable.find((a) => a.id === actId)
    if (!text.trim() && !act) return
    if (act?.privacy === 'private' && !confirm('Esta atividade está como “Somente eu”. Publicar mesmo assim? A privacidade dela passará a valer para esta publicação.')) return
    await savePost({ id: uid(), authorId: ME, activityId: act?.id ?? null, text: text.trim(), at: Date.now(), likes: [], comments: [], origin: 'mine' })
    setText('')
    setActId('')
  }

  return (
    <div className="stack">
      <form className="panel stack tight composer" onSubmit={(e) => { e.preventDefault(); void publish() }}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <Avatar />
          <textarea className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Compartilhe um treino, um convite ou uma conquista" maxLength={500} aria-label="Texto da publicação" />
        </div>
        <div className="row between wrap">
          <select className="input" style={{ width: 'auto', maxWidth: '100%' }} value={actId} onChange={(e) => setActId(e.target.value)} aria-label="Anexar atividade">
            <option value="">Sem atividade anexada</option>
            {shareable.map((a) => <option key={a.id} value={a.id}>{a.title} · {km(a.distanceM)} km ({PRIVACY_LABEL[a.privacy]})</option>)}
          </select>
          <button className="btn primary sm" type="submit" disabled={!text.trim() && !actId}><Send size={16} aria-hidden="true" /> Publicar</button>
        </div>
      </form>
      {visible.length === 0 ? (
        <Empty icon={Users} title="Nada no feed ainda">Publique algo ou ative o conteúdo de demonstração para ver como o feed funciona.</Empty>
      ) : (
        visible.map((p) => <PostCard key={p.id} p={p} myName={myName} />)
      )}
    </div>
  )
}

function PostCard({ p, myName }: { p: Post; myName: string }) {
  const act = useApp((s) => (p.activityId ? s.activities.find((a) => a.id === p.activityId) : undefined))
  const [comment, setComment] = useState('')
  const [report, setReport] = useState(false)
  const liked = p.likes.includes(ME)
  const mine = p.authorId === ME
  return (
    <article className="panel post">
      <header className="row">
        {mine ? <Avatar /> : <NameAvatar name={memberName(p.authorId, myName)} />}
        <div className="grow">
          <div className="row" style={{ gap: 6 }}><strong>{memberName(p.authorId, myName)}</strong>{p.origin === 'demo' && <DemoBadge />}</div>
          <div className="tiny muted">{relative(p.at)}</div>
        </div>
        {mine ? (
          <button className="icon-btn" aria-label="Excluir publicação" onClick={() => confirm('Excluir esta publicação?') && deletePost(p.id)}><Trash2 size={16} /></button>
        ) : (
          <button className="icon-btn" aria-label="Denunciar ou bloquear" onClick={() => setReport(true)}><Flag size={16} /></button>
        )}
      </header>
      {p.text && <p>{p.text}</p>}
      {act && (
        <a className="post-activity" href={`#/atividade/${act.id}`}>
          <SportIcon sport={act.sport} size={18} />
          <span className="grow"><strong>{act.title}</strong><span className="small muted"> · {km(act.distanceM)} km · {SPORT_LABEL[act.sport]}</span></span>
        </a>
      )}
      <div className="row post-actions">
        <button className={`btn ghost sm${liked ? ' liked' : ''}`} aria-pressed={liked} onClick={() => void savePost({ ...p, likes: liked ? p.likes.filter((x) => x !== ME) : [...p.likes, ME] })}>
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" /> {p.likes.length}
        </button>
        <span className="small muted"><MessageCircle size={16} aria-hidden="true" /> {p.comments.length}</span>
      </div>
      {p.comments.length > 0 && (
        <ul className="comments">
          {p.comments.map((c) => (
            <li key={c.id}>
              <strong>{memberName(c.authorId, myName)}</strong> {c.text}
              {c.authorId === ME && <button className="link tiny" onClick={() => void savePost({ ...p, comments: p.comments.filter((x) => x.id !== c.id) })}> excluir</button>}
            </li>
          ))}
        </ul>
      )}
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (!comment.trim()) return; void savePost({ ...p, comments: [...p.comments, { id: uid(), authorId: ME, text: comment.trim(), at: Date.now() }] }); setComment('') }}>
        <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentar" maxLength={300} aria-label="Escrever comentário" />
        <button className="icon-btn" type="submit" aria-label="Enviar comentário" disabled={!comment.trim()}><Send size={16} /></button>
      </form>
      {report && <ReportSheet memberId={p.authorId} onClose={() => setReport(false)} />}
    </article>
  )
}

function ReportSheet({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const c = useApp((s) => s.community)
  const [reason, setReason] = useState('spam')
  const name = memberName(memberId, '')
  return (
    <Sheet title={`Denunciar ou bloquear ${name}`} onClose={onClose}>
      <div className="stack">
        <label className="field"><span>Motivo da denúncia</span>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="spam">Spam ou propaganda</option>
            <option value="ofensa">Ofensa, assédio ou discriminação</option>
            <option value="seguranca">Risco à segurança</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <p className="tiny faint">Sem servidor, a denúncia fica registrada neste aparelho e será enviada à moderação quando a comunidade online estiver ativa.</p>
        <button className="btn" onClick={async () => { await updateCommunity({ reports: [...c.reports, { memberId, reason, at: Date.now() }] }); toast({ kind: 'info', title: 'Denúncia registrada' }); onClose() }}><Flag size={16} aria-hidden="true" /> Registrar denúncia</button>
        <button className="btn danger" onClick={async () => { await updateCommunity({ blocked: [...new Set([...c.blocked, memberId])], following: c.following.filter((x) => x !== memberId) }); toast({ kind: 'info', title: `${name} bloqueado`, detail: 'Publicações dessa pessoa deixam de aparecer.' }); onClose() }}><ShieldOff size={16} aria-hidden="true" /> Bloquear</button>
      </div>
    </Sheet>
  )
}

function Groups({ onCreate }: { onCreate: () => void }) {
  const groups = useApp((s) => s.groups)
  return (
    <div className="stack">
      <div className="row between"><p className="small muted">Grupos por região, modalidade, nível e horário.</p><button className="btn primary sm" onClick={onCreate}><Plus size={16} aria-hidden="true" /> Criar grupo</button></div>
      {groups.length === 0 ? (
        <Empty icon={Users} title="Nenhum grupo ainda">Crie um grupo para organizar encontros recorrentes com amigos, colegas ou vizinhos.</Empty>
      ) : (
        <div className="grid md-two">
          {groups.map((g) => (
            <a key={g.id} className="panel stack tight" href={`#/grupo/${g.id}`}>
              <div className="row between"><strong>{g.name}</strong>{g.origin === 'demo' ? <DemoBadge /> : g.joined && <span className="badge ok">Participando</span>}</div>
              <p className="small muted">{g.description}</p>
              <p className="tiny faint">{g.region} · {SPORT_LABEL[g.sport]} · {g.schedule || 'horário a combinar'}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function Events({ onCreate }: { onCreate: () => void }) {
  const events = useApp((s) => s.events)
  const now = Date.now()
  const upcoming = events.filter((e) => e.startsAt + e.durationMin * 60000 > now).sort((a, b) => a.startsAt - b.startsAt)
  const past = events.filter((e) => e.startsAt + e.durationMin * 60000 <= now && e.origin !== 'demo').sort((a, b) => b.startsAt - a.startsAt)
  const row = (e: (typeof events)[number]) => (
    <a key={e.id} className="list-item" href={`#/evento/${e.id}`}>
      <SportIcon sport={e.sport} size={18} />
      <div className="grow">
        <div className="row" style={{ gap: 6 }}><span className="title">{e.title}</span>{e.origin === 'demo' && <DemoBadge />}{e.going && <span className="badge ok">Vou</span>}{e.attended && <span className="badge ok">Presença confirmada</span>}</div>
        <div className="meta">{new Date(e.startsAt).toLocaleString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {e.meetingPoint.name} · {DIFFICULTY_LABEL[e.difficulty]}</div>
      </div>
    </a>
  )
  return (
    <div className="stack">
      <div className="row between"><p className="small muted">Caminhadas e corridas em grupo.</p><button className="btn primary sm" onClick={onCreate}><Plus size={16} aria-hidden="true" /> Organizar</button></div>
      {upcoming.length ? <div className="panel flush list">{upcoming.map(row)}</div> : <Empty icon={Users} title="Nenhum encontro agendado">Organize um encontro e compartilhe o link com quem vai participar.</Empty>}
      {past.length > 0 && (<><h3 className="section">Encontros anteriores</h3><div className="panel flush list">{past.map(row)}</div></>)}
    </div>
  )
}

function People() {
  const c = useApp((s) => s.community)
  const showDemo = useApp((s) => s.settings.showDemoCommunity)
  const [report, setReport] = useState<string | null>(null)
  const members = DEMO_MEMBERS.filter((m) => !c.blocked.includes(m.id))
  return (
    <div className="stack">
      <a className="panel row" href="#/perfil"><Avatar /><div className="grow"><strong>Seu perfil</strong><div className="small muted">Edite nome, foto, bio e o que é público.</div></div></a>
      {showDemo ? (
        <div className="panel flush list">
          {members.map((m) => {
            const following = c.following.includes(m.id)
            return (
              <div key={m.id} className="list-item">
                <NameAvatar name={m.name} />
                <div className="grow">
                  <div className="row" style={{ gap: 6 }}><span className="title">{m.name}</span><DemoBadge /></div>
                  <div className="meta">{m.bio}</div>
                  <div className="tiny faint">Nível {m.level} · {m.sports.map((s) => SPORT_LABEL[s]).join(', ')}</div>
                </div>
                <button className={`btn sm${following ? '' : ' primary'}`} aria-pressed={following} onClick={() => void updateCommunity({ following: following ? c.following.filter((x) => x !== m.id) : [...c.following, m.id] })}>
                  {following ? <><UserCheck size={14} aria-hidden="true" /> Seguindo</> : <><UserPlus size={14} aria-hidden="true" /> Seguir</>}
                </button>
                <button className="icon-btn" aria-label={`Denunciar ou bloquear ${m.name}`} onClick={() => setReport(m.id)}><Flag size={16} /></button>
              </div>
            )
          })}
        </div>
      ) : (
        <Empty icon={Users} title="Pessoas aparecem com a comunidade online">Sem servidor, não há outros perfis reais para mostrar. Ative a demonstração para ver como funciona.</Empty>
      )}
      {c.blocked.length > 0 && (
        <div className="panel stack tight">
          <strong>Bloqueados</strong>
          {c.blocked.map((id) => (
            <div key={id} className="row between small"><span>{memberName(id, '')}</span><button className="btn ghost sm" onClick={() => void updateCommunity({ blocked: c.blocked.filter((x) => x !== id) })}>Desbloquear</button></div>
          ))}
        </div>
      )}
      {report && <ReportSheet memberId={report} onClose={() => setReport(null)} />}
    </div>
  )
}
