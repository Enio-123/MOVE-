import L from 'leaflet'
import { ArrowLeft, Camera, Download, Pencil, Share2, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { avgPace, estimateCalories, SPORTS, SPORT_LABEL } from '../domain/activity'
import { clock, fmtDateLong, fmtInt, fmtTime, km, pace } from '../domain/format'
import { toGpx } from '../domain/gpx'
import type { Activity, Privacy, Sport, TrackPoint } from '../domain/types'
import { addPhotos, deleteActivity, removePhoto, repo, toast, updateActivity } from '../services/actions'
import { useApp, useDerived } from '../services/store'
import { usePhotoUrl } from '../ui/Avatar'
import { Sparkline } from '../ui/charts'
import { download, EstimateBadge, Notice, Sheet, SourceBadge, SportIcon, Switch } from '../ui/components'
import { renderShareCard } from '../ui/shareCard'
import { pin, ROUTE_STYLE, useLeaflet } from '../ui/map'
import { back, navigate } from '../ui/router'
import { PRIVACY_LABEL } from './Onboarding'

export default function ActivityPage({ id }: { id: string }) {
  const a = useApp((s) => s.activities.find((x) => x.id === id))
  const weight = useApp((s) => s.settings.weightKg)
  const d = useDerived()
  const [track, setTrack] = useState<TrackPoint[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (a?.hasTrack) void repo.getTrack(a.id).then((t) => setTrack(t?.points ?? []))
  }, [a?.id, a?.hasTrack])

  if (!a) {
    return (
      <div className="stack">
        <h1>Atividade não encontrada</h1>
        <p className="muted">Ela pode ter sido excluída.</p>
        <a className="btn" href="#/historico">Ver histórico</a>
      </div>
    )
  }

  const primary = d.duplicates.get(a.id)
  const xp = d.xp.find((e) => e.key === `activity:${a.id}`)
  const cal = estimateCalories(a, weight)
  const p = avgPace(a)
  const altValues = track?.filter((x) => typeof x.alt === 'number').map((x) => x.alt as number) ?? []

  const shareText = `${a.title}: ${km(a.distanceM)} km em ${clock(a.source === 'manual' ? a.elapsedS : a.movingS)}${p ? `, ritmo ${pace(p)}/km` : ''}. Registrado na Move+.`
  const share = () => {
    if (a.privacy === 'private' && !confirm('Esta atividade está marcada como privada. Compartilhar mesmo assim?')) return
    setSharing(true)
  }
  return (
    <div className="activity-page">
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="btn ghost sm" onClick={() => back('/historico')}><ArrowLeft size={16} aria-hidden="true" /> Voltar</button>
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Editar"><Pencil size={18} /></button>
          <button className="icon-btn" onClick={share} aria-label="Compartilhar"><Share2 size={18} /></button>
          {track && track.length > 1 && (
            <button className="icon-btn" aria-label="Exportar GPX" onClick={() => download(`${a.title.replace(/[^\w\- ]+/g, '').trim() || 'atividade'}.gpx`, new Blob([toGpx(a, track)], { type: 'application/gpx+xml' }))}>
              <Download size={18} />
            </button>
          )}
        </div>
      </div>

      <header className="row" style={{ alignItems: 'flex-start', marginBottom: 16 }}>
        <SportIcon sport={a.sport} size={22} />
        <div className="grow">
          <h1>{a.title}</h1>
          <div className="row wrap small muted" style={{ gap: 8, marginTop: 4 }}>
            <span>{fmtDateLong(a.localDate)} · {fmtTime(a.startedAt)}–{fmtTime(a.endedAt)}</span>
            <SourceBadge source={a.source} />
            <span className="badge">{PRIVACY_LABEL[a.privacy]}</span>
          </div>
        </div>
      </header>

      {a.status === 'recovered' && <Notice tone="warn">Atividade recuperada após uma interrupção da gravação. O intervalo sem registro não foi contabilizado.</Notice>}
      {primary && (
        <Notice>
          Esta atividade representa o mesmo exercício que <a href={`#/atividade/${primary}`}>outra registrada por uma fonte mais precisa</a>. Ela fica no histórico, mas não soma distância, XP nem dias de sequência.
        </Notice>
      )}
      {a.description && <p className="activity-desc">{a.description}</p>}

      <div className="grid lg-split section" style={{ marginTop: 16 }}>
        <div className="stack">
          {a.hasTrack ? <TrackMap points={track} /> : <div className="panel muted small">{a.source === 'manual' ? 'Registro manual: sem percurso de GPS.' : 'Nenhum ponto de GPS válido foi registrado.'}</div>}
          {a.splits.length > 0 && (
            <div className="panel flush">
              <table className="splits">
                <caption>Parciais por quilômetro</caption>
                <thead><tr><th>km</th><th>Ritmo</th><th>Tempo</th><th aria-hidden="true"></th></tr></thead>
                <tbody>
                  {a.splits.map((sp) => {
                    const best = Math.min(...a.splits.map((x) => x.paceSPerKm))
                    return (
                      <tr key={sp.km}>
                        <td>{sp.partial ? km(sp.distanceM) : sp.km}</td>
                        <td className="num">{pace(sp.paceSPerKm)}</td>
                        <td className="num">{clock(sp.durationS)}</td>
                        <td className="split-bar" aria-hidden="true"><i style={{ width: `${(best / sp.paceSPerKm) * 100}%` }} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="stack">
          <div className="panel grid two summary-stats">
            <div className="stat"><div className="label">Distância</div><div className="value">{km(a.distanceM)}<small>km</small></div>{a.source === 'manual' && a.distanceM > 0 && <div className="sub">Informada</div>}</div>
            <div className="stat"><div className="label">{a.source === 'manual' ? 'Duração' : 'Em movimento'}</div><div className="value">{clock(a.source === 'manual' ? a.elapsedS : a.movingS)}</div></div>
            <div className="stat"><div className="label">Ritmo médio</div><div className="value">{pace(p)}<small>/km</small></div></div>
            <div className="stat"><div className="label">Duração total</div><div className="value">{clock(a.elapsedS)}</div></div>
            {a.elevationGainM !== null && <div className="stat"><div className="label">Ganho de elevação</div><div className="value">{a.elevationGainM}<small>m</small></div><div className="sub">Estimativa do GPS</div></div>}
            {a.avgHr !== null && <div className="stat"><div className="label">Freq. cardíaca</div><div className="value">{a.avgHr}<small>bpm méd.</small></div><div className="sub">Máx. {a.maxHr} bpm</div></div>}
            {cal !== null && <div className="stat"><div className="label">Calorias</div><div className="value">{fmtInt(cal)}<small>kcal</small></div><div className="sub"><EstimateBadge /></div></div>}
            <div className="stat"><div className="label">XP desta atividade</div><div className="value accent-num">{xp ? `+${xp.amount}` : '0'}</div><div className="sub">{xp ? 'Regra: 10 + minutos + 3/km' : primary ? 'Duplicada: sem XP' : 'Abaixo do mínimo ou limite diário atingido'}</div></div>
          </div>
          {altValues.length > 10 && (
            <div className="panel">
              <div className="small muted">Perfil de altitude <EstimateBadge text="GPS" /></div>
              <Sparkline values={altValues} label="Perfil de altitude ao longo do percurso" />
            </div>
          )}
          {(a.weakSignalRatio > 0 || a.signalGaps > 0) && (
            <p className="tiny faint">
              Qualidade do sinal: {Math.round(a.weakSignalRatio * 100)}% das leituras descartadas por baixa precisão{a.signalGaps ? `, ${a.signalGaps} ${a.signalGaps === 1 ? 'intervalo' : 'intervalos'} sem sinal` : ''}.
            </p>
          )}
          <Photos a={a} />
          <button
            className="btn danger"
            onClick={async () => {
              if (!confirm('Excluir esta atividade? Percurso e fotos serão apagados e XP, sequência e estatísticas serão recalculados.')) return
              await deleteActivity(a.id)
              navigate('/historico', true)
            }}
          >
            <Trash2 size={16} aria-hidden="true" /> Excluir atividade
          </button>
        </div>
      </div>
      {editing && <EditSheet a={a} onClose={() => setEditing(false)} />}
      {sharing && <ShareSheet activity={a} track={track} text={shareText} onClose={() => setSharing(false)} />}
    </div>
  )
}

function TrackMap({ points }: { points: TrackPoint[] | null }) {
  const { ref, map, tileError } = useLeaflet({ zoom: 15 })
  useEffect(() => {
    if (!map || !points || points.length < 2) return
    const segs = new Map<number, L.LatLngTuple[]>()
    for (const p of points) segs.set(p.seg, [...(segs.get(p.seg) ?? []), [p.lat, p.lng]])
    const group = L.featureGroup([...segs.values()].map((pts) => L.polyline(pts, ROUTE_STYLE))).addTo(map)
    const f = points[0], l = points[points.length - 1]
    L.marker([f.lat, f.lng], { icon: pin('start'), title: 'Partida' }).addTo(map)
    L.marker([l.lat, l.lng], { icon: pin('end'), title: 'Chegada' }).addTo(map)
    map.fitBounds(group.getBounds(), { padding: [24, 24] })
  }, [map, points])
  return (
    <div className="map-box">
      <div ref={ref} className="map activity-map" aria-label="Mapa do percurso" />
      {tileError && <div className="map-overlay small">Sem conexão com o mapa base. O percurso continua salvo.</div>}
    </div>
  )
}

function PhotoThumb({ id, onRemove }: { id: string; onRemove: () => void }) {
  const url = usePhotoUrl(id)
  return (
    <div className="photo">
      {url && <img src={url} alt="Foto da atividade" loading="lazy" />}
      <button className="icon-btn photo-x" aria-label="Remover foto" onClick={onRemove}><X size={16} /></button>
    </div>
  )
}

function Photos({ a }: { a: Activity }) {
  return (
    <div className="panel stack tight">
      <div className="row between">
        <span className="small muted">Fotos</span>
        <label className="btn sm">
          <Camera size={16} aria-hidden="true" /> Adicionar
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void addPhotos(a.id, Array.from(e.target.files ?? []).slice(0, 6))} />
        </label>
      </div>
      {a.photoIds.length > 0 ? (
        <div className="photos">{a.photoIds.map((p) => <PhotoThumb key={p} id={p} onRemove={() => void removePhoto(a.id, p)} />)}</div>
      ) : (
        <p className="tiny faint">Nenhuma foto. As fotos ficam salvas apenas neste aparelho.</p>
      )}
    </div>
  )
}

function EditSheet({ a, onClose }: { a: Activity; onClose: () => void }) {
  const [title, setTitle] = useState(a.title)
  const [desc, setDesc] = useState(a.description)
  const [privacy, setPrivacy] = useState<Privacy>(a.privacy)
  const [sport, setSport] = useState<Sport>(a.sport)
  return (
    <Sheet title="Editar atividade" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!title.trim()) return
          await updateActivity(a.id, { title: title.trim(), description: desc, privacy, sport })
          onClose()
        }}
      >
        <label className="field"><span>Título</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required aria-invalid={!title.trim()} /></label>
        <label className="field"><span>Descrição</span><textarea className="input" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={1000} /></label>
        <label className="field">
          <span>Modalidade</span>
          <select className="input" value={sport} onChange={(e) => setSport(e.target.value as Sport)}>
            {SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABEL[s]}</option>)}
          </select>
          <span className="hint">Distância e tempo não podem ser editados: vêm da medição.</span>
        </label>
        <label className="field">
          <span>Quem pode ver</span>
          <select className="input" value={privacy} onChange={(e) => setPrivacy(e.target.value as Privacy)}>
            {(Object.keys(PRIVACY_LABEL) as Privacy[]).map((p) => <option key={p} value={p}>{PRIVACY_LABEL[p]}</option>)}
          </select>
        </label>
        <button className="btn primary" type="submit">Salvar alterações</button>
      </form>
    </Sheet>
  )
}

function ShareSheet({ activity, track, text, onClose }: { activity: Activity; track: TrackPoint[] | null; text: string; onClose: () => void }) {
  const [withRoute, setWithRoute] = useState(activity.hasTrack)
  const [img, setImg] = useState<{ blob: Blob; url: string } | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let url = ''
    let alive = true
    setImg(null)
    void renderShareCard(activity, track, withRoute)
      .then((blob) => { if (!alive) return; url = URL.createObjectURL(blob); setImg({ blob, url }) })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [activity, track, withRoute])
  const name = `${activity.title.replace(/[^\w\- ]+/g, '').trim() || 'atividade'}-moveplus.png`
  const shareImage = async () => {
    if (!img) return
    const file = new File([img.blob], name, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: activity.title, text })
      else download(name, img.blob)
    } catch { /* cancelado */ }
  }
  const shareText = async () => {
    try {
      if (navigator.share) await navigator.share({ title: activity.title, text })
      else { await navigator.clipboard.writeText(text); toast({ kind: 'info', title: 'Resumo copiado' }) }
    } catch { /* cancelado */ }
  }
  return (
    <Sheet title="Compartilhar" onClose={onClose}>
      <div className="stack">
        <div className="share-preview">{img ? <img src={img.url} alt="Prévia da imagem de compartilhamento" /> : <div className="skeleton" style={{ aspectRatio: '4 / 5' }} />}</div>
        {err && <p className="error-text">{err}</p>}
        {activity.hasTrack && <Switch checked={withRoute} onChange={setWithRoute} label="Mostrar o desenho do trajeto" description="O traçado pode indicar onde você esteve. Desligue para mostrar só os números." />}
        <button className="btn primary block" disabled={!img} onClick={() => void shareImage()}><Share2 size={16} aria-hidden="true" /> Compartilhar imagem</button>
        <div className="row">
          <button className="btn grow" disabled={!img} onClick={() => img && download(name, img.blob)}><Download size={16} aria-hidden="true" /> Baixar</button>
          <button className="btn grow" onClick={() => void shareText()}>Só o texto</button>
        </div>
      </div>
    </Sheet>
  )
}
