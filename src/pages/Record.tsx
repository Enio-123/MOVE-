import L from 'leaflet'
import { AlertTriangle, Camera, Check, HeartPulse, LocateFixed, MapPin, Pause, Play, Signal, Square, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SPORTS, SPORT_LABEL } from '../domain/activity'
import { buildActivity } from '../domain/build'
import { haversine } from '../domain/geo'
import { clock, duration, km, pace, speedKmh } from '../domain/format'
import { MAX_ACCURACY_M } from '../domain/track'
import type { Privacy, Sport } from '../domain/types'
import { activityXp } from '../domain/xp'
import { addManual, discardLive, importTrack, saveRecorded, toast } from '../services/actions'
import { keepScreenOn, locationPermission, tracker, useHeartRate, useTracker } from '../services/gps'
import { uid } from '../services/ids'
import { store, useApp } from '../services/store'
import type { LiveSession } from '../services/tracker'
import { Notice, PageHead, SPORT_ICON, Segmented, Sheet } from '../ui/components'
import { pin, ROUTE_STYLE, useLeaflet } from '../ui/map'
import { navigate, useRoute } from '../ui/router'
import { PRIVACY_LABEL } from './Onboarding'

type Mode = 'gps' | 'importar' | 'manual'

export default function RecordPage() {
  const route = useRoute()
  const snap = useTracker()
  const mode = (route.query.get('modo') as Mode) || 'gps'
  const active = !!snap.session
  const [finished, setFinished] = useState<LiveSession | null>(null)

  // Retomar uma gravação interrompida.
  useEffect(() => {
    const orphan = store.get().orphanSession
    if (route.query.get('retomar') && orphan && !tracker.snapshot.session) {
      tracker.restore(orphan)
      store.set({ orphanSession: null })
      tracker.enable()
    }
  }, [route.query])

  if (finished) return <FinishForm session={finished} onBack={() => { tracker.restore(finished); setFinished(null) }} />
  if (active) return <Recorder onFinish={setFinished} />

  return (
    <div className="record">
      <PageHead title="Registrar atividade" subtitle="Grave com GPS, importe do relógio ou anote manualmente." />
      <Segmented<Mode>
        label="Forma de registro"
        value={mode}
        onChange={(m) => navigate(m === 'gps' ? '/registrar' : `/registrar?modo=${m}`, true)}
        options={[
          { value: 'gps', label: 'GPS' },
          { value: 'importar', label: 'Importar' },
          { value: 'manual', label: 'Manual' },
        ]}
      />
      <div className="section" style={{ marginTop: 20 }}>
        {mode === 'gps' && <GpsStart />}
        {mode === 'importar' && <ImportForm />}
        {mode === 'manual' && <ManualForm />}
      </div>
    </div>
  )
}

function SportPicker({ value, onChange }: { value: Sport; onChange: (s: Sport) => void }) {
  return (
    <div className="sport-picker compact" role="radiogroup" aria-label="Modalidade">
      {SPORTS.map((sp) => {
        const I = SPORT_ICON[sp]
        return (
          <button key={sp} type="button" role="radio" aria-checked={value === sp} className="sport-option" aria-pressed={value === sp} onClick={() => onChange(sp)}>
            <I size={20} aria-hidden="true" />
            <span>{SPORT_LABEL[sp]}</span>
          </button>
        )
      })}
    </div>
  )
}

const ERROR_TEXT = {
  insecure: { title: 'Conexão não segura', text: 'O navegador só libera o GPS em páginas HTTPS. Abra a Move+ pelo endereço publicado (https://).' },
  unsupported: { title: 'GPS indisponível neste navegador', text: 'Este navegador não oferece geolocalização. Você ainda pode importar arquivos ou registrar manualmente.' },
  denied: { title: 'Permissão de localização negada', text: 'Para gravar percursos, permita a localização para este site nas configurações do navegador (ícone de cadeado na barra de endereço) e tente de novo. O restante do app continua funcionando.' },
  unavailable: { title: 'Localização indisponível', text: 'O aparelho não conseguiu determinar a posição. Verifique se a localização (GPS) do sistema está ligada e se você está em área aberta.' },
} as const

function GpsStart() {
  const snap = useTracker()
  const fav = useApp((s) => s.settings.favoriteSports[0] ?? 'walk')
  const [sport, setSport] = useState<Sport>(fav)
  const [explain, setExplain] = useState(false)
  const [perm, setPerm] = useState<PermissionState | 'unknown'>('unknown')
  const { ref, map } = useLeaflet({ zoom: 16 })
  const meRef = useRef<L.CircleMarker | null>(null)
  const accRef = useRef<L.Circle | null>(null)

  useEffect(() => {
    void locationPermission().then((p) => {
      setPerm(p)
      // Permissão já concedida antes: liga o GPS direto, sem novo pedido.
      if (p === 'granted') tracker.enable()
    })
  }, [])

  useEffect(() => {
    const f = snap.lastFix
    if (!map || !f) return
    const ll: L.LatLngTuple = [f.lat, f.lng]
    if (!meRef.current) {
      meRef.current = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 3, fillColor: '#2f6bff', fillOpacity: 1 }).addTo(map)
      accRef.current = L.circle(ll, { radius: f.acc, color: '#2f6bff', weight: 1, fillOpacity: 0.1 }).addTo(map)
      map.setView(ll, 17)
    } else {
      meRef.current.setLatLng(ll)
      accRef.current!.setLatLng(ll).setRadius(f.acc)
    }
  }, [map, snap.lastFix])

  const status = snap.status
  const err = snap.error
  const ready = status === 'ready'
  const listening = status === 'requesting' || status === 'acquiring' || status === 'ready'

  return (
    <div className="grid lg-split">
      <div className="stack loose">
        <div className="stack tight">
          <span className="field-legend">Modalidade</span>
          <SportPicker value={sport} onChange={setSport} />
        </div>

        {err && (
          <Notice tone="err">
            <strong>{ERROR_TEXT[err].title}.</strong> {ERROR_TEXT[err].text}
          </Notice>
        )}

        {!listening && !err && (
          <div className="panel stack">
            <div className="row"><MapPin size={20} className="accent" aria-hidden="true" /><h3>Ativar localização</h3></div>
            <p className="muted small">
              A Move+ usa a sua localização somente durante a gravação para desenhar o percurso e calcular distância, ritmo e parciais. Ela não é compartilhada com ninguém e fica salva apenas neste aparelho.
            </p>
            <button className="btn primary" onClick={() => (perm === 'granted' ? tracker.enable() : setExplain(true))}>
              <LocateFixed size={18} aria-hidden="true" /> Ativar GPS
            </button>
          </div>
        )}

        {listening && (
          <div className="panel stack">
            <SignalLine />
            <button className="btn accent lg block" disabled={!ready} onClick={() => tracker.start(sport, uid())}>
              <Play size={20} fill="currentColor" aria-hidden="true" /> Iniciar {SPORT_LABEL[sport].toLowerCase()}
            </button>
            {status === 'acquiring' && (
              <button className="btn ghost sm" onClick={() => tracker.start(sport, uid())}>
                Iniciar com sinal fraco (leituras imprecisas serão descartadas)
              </button>
            )}
            <button className="btn ghost sm" onClick={() => tracker.disable()}>Desligar GPS</button>
          </div>
        )}

        <Notice>
          No navegador, o GPS pode ser suspenso quando a tela é bloqueada ou o app vai para segundo plano. Durante a gravação, a Move+ tenta manter a tela ligada e avisa se houver intervalos sem sinal. Rastreamento contínuo em segundo plano exigirá o app instalável.
        </Notice>
      </div>
      <div className="record-map-wrap">
        <div ref={ref} className="map record-map" aria-label="Mapa com a sua posição" />
        {!snap.lastFix && <div className="map-overlay small muted">A posição aparece aqui depois que o GPS confirmar uma leitura.</div>}
      </div>

      {explain && (
        <Sheet title="Permitir localização" onClose={() => setExplain(false)}>
          <div className="stack">
            <p className="muted">O navegador vai perguntar se a Move+ pode acessar a sua localização.</p>
            <ul className="bullets small muted">
              <li>Usada apenas enquanto você grava ou vê sua posição no mapa.</li>
              <li>O percurso fica salvo neste aparelho e só é compartilhado se você decidir.</li>
              <li>Se negar, você continua usando o app e pode registrar atividades manualmente.</li>
            </ul>
            <button className="btn primary block" onClick={() => { setExplain(false); tracker.enable() }}>Continuar</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function SignalLine() {
  const snap = useTracker()
  const f = snap.lastFix
  const label =
    snap.status === 'requesting' ? 'Aguardando permissão e primeira leitura…'
    : snap.signal === 'lost' ? 'Sinal perdido. Procure um local aberto.'
    : snap.signal === 'weak' ? `Sinal fraco (±${Math.round(f!.acc)} m). Aguardando precisão de até ${MAX_ACCURACY_M} m.`
    : snap.signal === 'good' ? `GPS pronto (±${Math.round(f!.acc)} m)`
    : 'Procurando sinal…'
  const tone = snap.signal === 'good' ? 'ok' : snap.signal === 'weak' ? 'warn' : snap.signal === 'lost' ? 'err' : ''
  return (
    <div className={`signal-line ${tone}`} role="status" aria-live="polite">
      <Signal size={18} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

/** Ritmo atual a partir do último minuto do trecho em andamento. */
function currentPace(s: LiveSession): number | null {
  const pts = s.points.filter((p) => p.seg === s.seg)
  if (pts.length < 2) return null
  const last = pts[pts.length - 1]
  const window = pts.filter((p) => last.t - p.t <= 60000)
  if (window.length < 2) return null
  let d = 0
  for (let i = 1; i < window.length; i++) d += haversine(window[i - 1], window[i])
  const dt = (last.t - window[0].t) / 1000
  if (d < 15 || dt < 10) return null
  return dt / (d / 1000)
}

function Recorder({ onFinish }: { onFinish: (s: LiveSession) => void }) {
  const snap = useTracker()
  const hr = useHeartRate()
  const s = snap.session!
  const [now, setNow] = useState(Date.now())
  const [wake, setWake] = useState(false)
  const { ref, map } = useLeaflet({ zoom: 17 })
  const lineRef = useRef<L.Polyline[]>([])
  const meRef = useRef<L.CircleMarker | null>(null)
  const follow = useRef(true)

  useEffect(() => {
    tracker.enable()
    const t = setInterval(() => setNow(Date.now()), 1000)
    void keepScreenOn(true).then(setWake)
    let hiddenAt = 0
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now()
      else {
        if (hiddenAt) tracker.noteSuspended(Date.now() - hiddenAt)
        void keepScreenOn(true).then(setWake)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      void keepScreenOn(false)
    }
  }, [])

  const stats = useMemo(
    () => buildActivity({ id: s.id, sport: s.sport, source: 'gps', status: 'completed', startedAt: s.startedAt, endedAt: Date.now(), pausedMs: s.pausedMs, points: s.points, privacy: 'private', now: 0 }, true),
    [s.points, s.id, s.sport, s.startedAt, s.pausedMs],
  )

  // Desenha o percurso por trecho (pausas não ligam pontos).
  useEffect(() => {
    if (!map) return
    lineRef.current.forEach((l) => l.remove())
    const segs = new Map<number, L.LatLngTuple[]>()
    for (const p of s.points) segs.set(p.seg, [...(segs.get(p.seg) ?? []), [p.lat, p.lng]])
    lineRef.current = [...segs.values()].map((pts) => L.polyline(pts, ROUTE_STYLE).addTo(map))
    const f = snap.lastFix
    if (f) {
      const ll: L.LatLngTuple = [f.lat, f.lng]
      if (!meRef.current) meRef.current = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 3, fillColor: '#2f6bff', fillOpacity: 1 }).addTo(map)
      else meRef.current.setLatLng(ll)
      if (follow.current) map.panTo(ll, { animate: true })
    }
  }, [map, s.points, snap.lastFix])

  useEffect(() => {
    if (!map) return
    const off = () => (follow.current = false)
    map.on('dragstart', off)
    return () => void map.off('dragstart', off)
  }, [map])

  const elapsed = tracker.elapsedMs(now) / 1000
  const cur = currentPace(s)
  const avg = stats.distanceM > 50 && stats.movingS > 0 ? stats.movingS / (stats.distanceM / 1000) : null
  const paused = s.state === 'paused'

  return (
    <div className="recorder">
      <div className="recorder-top">
        <div className="row between">
          <span className="badge">{SPORT_LABEL[s.sport]}</span>
          <SignalLine />
        </div>
        {snap.suspendedGap && (
          <Notice tone="warn">O navegador ficou em segundo plano e pode ter parado de receber o GPS. O trecho sem leituras não entra na distância.</Notice>
        )}
        {snap.error === 'denied' && <Notice tone="err">A permissão de localização foi retirada. A gravação está sem GPS; permita novamente para continuar.</Notice>}
        <div className="rec-timer num" aria-label={`Tempo ${clock(elapsed)}`}>{clock(elapsed)}</div>
        <div className="rec-stats">
          <div><span className="num">{km(stats.distanceM)}</span><small>km</small></div>
          <div><span className="num">{pace(cur)}</span><small>ritmo atual</small></div>
          <div><span className="num">{pace(avg)}</span><small>ritmo médio</small></div>
          {s.sport === 'ride' || s.sport === 'wheelchair' ? (
            <div><span className="num">{snap.lastFix?.speed != null ? speedKmh(snap.lastFix.speed) : '--'}</span><small>km/h</small></div>
          ) : (
            <div><span className="num">{stats.splits.filter((x) => !x.partial).length}</span><small>km completos</small></div>
          )}
          {hr.status === 'connected' && (
            <div><span className="num"><HeartPulse size={16} aria-hidden="true" /> {hr.bpm ?? '--'}</span><small>bpm</small></div>
          )}
        </div>
      </div>
      <div className="recorder-map">
        <div ref={ref} className="map" aria-label="Mapa do percurso em tempo real" />
        <button className="icon-btn map-locate" aria-label="Centralizar na minha posição" onClick={() => { follow.current = true; if (snap.lastFix && map) map.panTo([snap.lastFix.lat, snap.lastFix.lng]) }}>
          <LocateFixed size={20} />
        </button>
      </div>
      <div className="recorder-controls">
        {paused ? (
          <button className="ctrl resume" onClick={() => tracker.resume()} aria-label="Retomar"><Play size={28} fill="currentColor" /><span>Retomar</span></button>
        ) : (
          <button className="ctrl pause" onClick={() => tracker.pause()} aria-label="Pausar"><Pause size={28} fill="currentColor" /><span>Pausar</span></button>
        )}
        <button
          className="ctrl stop"
          onClick={() => {
            if (!paused) tracker.pause()
            const done = tracker.finish()
            if (done) onFinish(done)
          }}
          aria-label="Finalizar"
        >
          <Square size={24} fill="currentColor" /><span>Finalizar</span>
        </button>
      </div>
      <p className="tiny faint center">{wake ? 'Tela mantida ligada durante a gravação.' : 'Mantenha a tela ligada: este navegador não permite impedir o bloqueio automático.'} {paused ? 'Gravação pausada.' : ''}</p>
    </div>
  )
}

function FinishForm({ session, onBack }: { session: LiveSession; onBack: () => void }) {
  const privacyDefault = useApp((s) => s.settings.defaultPrivacy)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [privacy, setPrivacy] = useState<Privacy>(privacyDefault)
  const [photos, setPhotos] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const a = useMemo(
    () => buildActivity({ id: session.id, sport: session.sport, source: 'gps', status: 'completed', startedAt: session.startedAt, endedAt: session.updatedAt, pausedMs: session.pausedMs, points: session.points, rawCount: session.rawCount, weakCount: session.weakCount, signalGaps: session.signalGaps, privacy, now: 0 }, true),
    [session, privacy],
  )
  const { ref, map } = useLeaflet({ zoom: 15 })
  useEffect(() => {
    if (!map || session.points.length < 2) return
    const segs = new Map<number, L.LatLngTuple[]>()
    for (const p of session.points) segs.set(p.seg, [...(segs.get(p.seg) ?? []), [p.lat, p.lng]])
    const lines = [...segs.values()].map((pts) => L.polyline(pts, ROUTE_STYLE).addTo(map))
    const first = session.points[0], last = session.points[session.points.length - 1]
    L.marker([first.lat, first.lng], { icon: pin('start') }).addTo(map)
    L.marker([last.lat, last.lng], { icon: pin('end') }).addTo(map)
    map.fitBounds(L.featureGroup(lines).getBounds(), { padding: [24, 24] })
  }, [map, session.points])

  const xp = activityXp(a)
  const save = async () => {
    setBusy(true)
    try {
      const saved = await saveRecorded(session, { title, description: desc, privacy, photos })
      navigate(`/atividade/${saved.id}`, true)
    } catch (e) {
      toast({ kind: 'error', title: 'Não foi possível salvar', detail: e instanceof Error ? e.message : String(e) })
      setBusy(false)
    }
  }

  return (
    <div className="finish">
      <PageHead title="Resumo da atividade" subtitle={`${SPORT_LABEL[a.sport]} · ${duration(a.elapsedS)}`} />
      {session.points.length < 2 && <Notice tone="warn">Nenhum ponto de GPS válido foi registrado. A atividade será salva sem percurso e sem distância.</Notice>}
      {a.weakSignalRatio > 0.25 && <Notice tone="warn">{Math.round(a.weakSignalRatio * 100)}% das leituras tiveram baixa precisão e foram descartadas. A distância pode estar subestimada.</Notice>}
      {a.signalGaps > 0 && <Notice tone="warn">Houve {a.signalGaps} {a.signalGaps === 1 ? 'intervalo' : 'intervalos'} sem sinal. Os trechos sem leitura não entram na distância.</Notice>}
      <div className="grid lg-split">
        <div className="stack">
          {session.points.length > 1 && <div ref={ref} className="map finish-map" aria-label="Mapa do percurso" />}
          <div className="grid three summary-stats">
            <div className="stat"><div className="label">Distância</div><div className="value">{km(a.distanceM)}<small>km</small></div></div>
            <div className="stat"><div className="label">Tempo em movimento</div><div className="value">{clock(a.movingS)}</div></div>
            <div className="stat"><div className="label">Ritmo médio</div><div className="value">{pace(a.distanceM > 200 ? a.movingS / (a.distanceM / 1000) : null)}<small>/km</small></div></div>
            <div className="stat"><div className="label">Duração total</div><div className="value">{clock(a.elapsedS)}</div></div>
            <div className="stat"><div className="label">Elevação</div><div className="value">{a.elevationGainM ?? '--'}<small>{a.elevationGainM !== null ? 'm' : ''}</small></div>{a.elevationGainM !== null && <div className="sub">Estimativa do GPS</div>}</div>
            <div className="stat"><div className="label">XP</div><div className="value accent-num">+{xp}</div><div className="sub">{xp === 0 ? 'Menos de 5 min em movimento' : 'Antes de bônus e limites'}</div></div>
          </div>
          {a.splits.length > 0 && (
            <div className="panel flush">
              <table className="splits">
                <caption className="sr-only">Parciais por quilômetro</caption>
                <thead><tr><th>km</th><th>Ritmo</th><th>Tempo</th></tr></thead>
                <tbody>
                  {a.splits.map((sp) => (
                    <tr key={sp.km}><td>{sp.partial ? `${km(sp.distanceM)}` : sp.km}</td><td className="num">{pace(sp.paceSPerKm)}</td><td className="num">{clock(sp.durationS)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <form className="stack panel" onSubmit={(e) => { e.preventDefault(); void save() }}>
          <label className="field"><span>Título</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={a.title} maxLength={80} /></label>
          <label className="field"><span>Descrição</span><textarea className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Como foi? (opcional)" maxLength={1000} /></label>
          <label className="field">
            <span>Quem pode ver</span>
            <select className="input" value={privacy} onChange={(e) => setPrivacy(e.target.value as Privacy)}>
              {(Object.keys(PRIVACY_LABEL) as Privacy[]).map((p) => <option key={p} value={p}>{PRIVACY_LABEL[p]}</option>)}
            </select>
          </label>
          <div className="field">
            <span>Fotos (opcional)</span>
            <label className="btn sm" style={{ alignSelf: 'flex-start' }}>
              <Camera size={16} aria-hidden="true" /> Adicionar fotos
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => setPhotos([...photos, ...Array.from(e.target.files ?? [])].slice(0, 6))} />
            </label>
            {photos.length > 0 && (
              <div className="row wrap">
                {photos.map((f, i) => (
                  <span key={i} className="badge">{f.name.slice(0, 18)} <button type="button" className="link" aria-label={`Remover ${f.name}`} onClick={() => setPhotos(photos.filter((_, j) => j !== i))}><X size={12} /></button></span>
                ))}
              </div>
            )}
            <span className="hint">As fotos são reduzidas e salvas sem os metadados de localização da câmera.</span>
          </div>
          <button className="btn accent lg" type="submit" disabled={busy}><Check size={18} aria-hidden="true" /> Salvar atividade</button>
          <button className="btn ghost" type="button" onClick={onBack} disabled={busy}>Voltar e continuar gravando</button>
          <button
            className="btn danger"
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!confirm('Descartar esta atividade? O percurso gravado será apagado.')) return
              await discardLive()
              tracker.discard()
              navigate('/', true)
            }}
          >
            <Trash2 size={16} aria-hidden="true" /> Descartar
          </button>
        </form>
      </div>
    </div>
  )
}

function ImportForm() {
  const [sport, setSport] = useState<Sport | 'auto'>('auto')
  const [result, setResult] = useState<{ ok: boolean; text: string; id?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const onFile = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    try {
      const r = await importTrack(f.name, await f.text(), sport === 'auto' ? undefined : sport)
      setResult(r.ok ? { ok: true, text: `“${r.activity.title}” importada: ${km(r.activity.distanceM)} km em ${duration(r.activity.movingS)}.`, id: r.activity.id } : { ok: false, text: r.reason })
    } catch (e) {
      setResult({ ok: false, text: `Não foi possível ler o arquivo: ${e instanceof Error ? e.message : String(e)}` })
    }
    setBusy(false)
  }
  return (
    <div className="stack loose" style={{ maxWidth: 640 }}>
      <p className="muted">
        Exporte a atividade no app do seu relógio (Garmin Connect, Coros, Polar Flow, Suunto ou Strava) como arquivo GPX ou TCX e selecione aqui. Distância, ritmo, parciais e elevação são recalculados com os mesmos critérios das gravações da Move+.
      </p>
      <label className="field" style={{ maxWidth: 320 }}>
        <span>Modalidade</span>
        <select className="input" value={sport} onChange={(e) => setSport(e.target.value as Sport | 'auto')}>
          <option value="auto">Detectar pelo arquivo</option>
          {SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABEL[s]}</option>)}
        </select>
      </label>
      <label className="dropzone">
        <Upload size={24} aria-hidden="true" />
        <strong>{busy ? 'Importando…' : 'Selecionar arquivo GPX ou TCX'}</strong>
        <span className="small muted">O arquivo é lido neste aparelho e não é enviado para nenhum servidor.</span>
        <input type="file" accept=".gpx,.tcx,application/gpx+xml,application/vnd.garmin.tcx+xml" className="sr-only" disabled={busy} onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
      {result && (
        <Notice tone={result.ok ? 'info' : 'err'} icon={result.ok ? Check : AlertTriangle}>
          {result.text} {result.id && <a href={`#/atividade/${result.id}`}>Ver atividade</a>}
        </Notice>
      )}
      <p className="tiny faint">Se a mesma atividade também foi gravada pelo GPS da Move+, as duas são reconhecidas como o mesmo exercício e contam uma única vez.</p>
    </div>
  )
}

function ManualForm() {
  const today = useApp((s) => s.today)
  const fav = useApp((s) => s.settings.favoriteSports[0] ?? 'walk')
  const [sport, setSport] = useState<Sport>(fav)
  const [date, setDate] = useState(today)
  const [time, setTime] = useState(() => new Date(Date.now() - 3600000).toTimeString().slice(0, 5))
  const [minutes, setMinutes] = useState('30')
  const [dist, setDist] = useState('')
  const [title, setTitle] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const e: Record<string, string> = {}
    const min = Number(minutes)
    const startedAt = new Date(`${date}T${time}`).getTime()
    if (!Number.isFinite(min) || min < 1 || min > 600) e.minutes = 'Informe entre 1 e 600 minutos.'
    const km = dist.trim() ? Number(dist.replace(',', '.')) : null
    if (km !== null && (!Number.isFinite(km) || km < 0 || km > 200)) e.dist = 'Informe uma distância entre 0 e 200 km.'
    if (!Number.isFinite(startedAt)) e.date = 'Data ou horário inválido.'
    else if (startedAt + min * 60000 > Date.now() + 60000) e.date = 'A atividade não pode terminar no futuro.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const a = await addManual({ sport, startedAt, minutes: min, distanceKm: km, title })
    navigate(`/atividade/${a.id}`, true)
  }

  return (
    <form className="stack loose" style={{ maxWidth: 640 }} onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
      <Notice>Registros manuais não têm medição: aparecem como “Manual”, valem metade do XP e não entram em recordes de ritmo.</Notice>
      <div className="stack tight"><span className="field-legend">Modalidade</span><SportPicker value={sport} onChange={setSport} /></div>
      <div className="grid two">
        <label className="field"><span>Data</span><input className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date} /></label>
        <label className="field"><span>Início</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-invalid={!!errors.date} /></label>
      </div>
      {errors.date && <span className="error-text">{errors.date}</span>}
      <div className="grid two">
        <label className="field"><span>Duração (min)</span><input className="input" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-invalid={!!errors.minutes} />{errors.minutes && <span className="error-text">{errors.minutes}</span>}</label>
        <label className="field"><span>Distância (km, opcional)</span><input className="input" inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} placeholder="Ex.: 2,5" aria-invalid={!!errors.dist} />{errors.dist && <span className="error-text">{errors.dist}</span>}</label>
      </div>
      <label className="field"><span>Título (opcional)</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} /></label>
      <button className="btn primary lg" type="submit" disabled={busy} style={{ alignSelf: 'flex-start' }}>Salvar registro</button>
    </form>
  )
}
