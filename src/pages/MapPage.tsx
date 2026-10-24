import L from 'leaflet'
import { CalendarPlus, Crosshair, Footprints, LocateFixed, MapPin, Search, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DIFFICULTY_LABEL, SPORTS, SPORT_LABEL } from '../domain/activity'
import { km } from '../domain/format'
import { haversine, pathLength } from '../domain/geo'
import type { Difficulty, LatLng, Place, SavedRoute, Sport } from '../domain/types'
import { deletePlace, deleteRoute, repo, savePlace, saveRoute, toast } from '../services/actions'
import { routeOnFoot, searchPlaces, type PlaceResult } from '../services/geo'
import { locationPermission } from '../services/gps'
import { uid } from '../services/ids'
import { useApp } from '../services/store'
import { Notice, Sheet, SportIcon, Switch } from '../ui/components'
import { PLAN_STYLE, pin, ROUTE_STYLE, useLeaflet } from '../ui/map'
import { navigate, useRoute } from '../ui/router'

type Tab = 'rotas' | 'planejar' | 'lugares' | 'encontros'
type LocState = 'off' | 'asking' | 'on' | 'denied' | 'unavailable' | 'insecure'

export default function MapPage() {
  const route = useRoute()
  const routes = useApp((s) => s.routes)
  const places = useApp((s) => s.places)
  const events = useApp((s) => s.events)
  const activities = useApp((s) => s.activities)
  const { ref, map, tileError } = useLeaflet({ zoom: 13 })
  const [tab, setTab] = useState<Tab>(route.query.get('rota') ? 'rotas' : 'rotas')
  const [me, setMe] = useState<LatLng | null>(null)
  const [loc, setLoc] = useState<LocState>('off')
  const [explain, setExplain] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<string | null>(route.query.get('rota'))
  const [showTracks, setShowTracks] = useState(false)
  const layers = useRef<L.LayerGroup | null>(null)
  const meLayer = useRef<L.LayerGroup | null>(null)

  // Planejamento
  const [waypoints, setWaypoints] = useState<LatLng[]>([])
  const [path, setPath] = useState<LatLng[]>([])
  const [streets, setStreets] = useState(true)
  const [routing, setRouting] = useState<'idle' | 'busy' | 'error'>('idle')
  const [saveOpen, setSaveOpen] = useState(false)
  const [placeAt, setPlaceAt] = useState<LatLng | null>(null)

  // Filtros de descoberta
  const [fSport, setFSport] = useState<Sport | 'all'>('all')
  const [fDiff, setFDiff] = useState<Difficulty | 'all'>('all')
  const [fAccess, setFAccess] = useState(false)
  const [fNear, setFNear] = useState<number | 'all'>('all')

  useEffect(() => {
    if (!map) return
    layers.current = L.layerGroup().addTo(map)
    meLayer.current = L.layerGroup().addTo(map)
    void locationPermission().then((p) => p === 'granted' && locate())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // A posição pode chegar depois que a página saiu da tela (mapa já removido).
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const locate = () => {
    if (!window.isSecureContext) return setLoc('insecure')
    if (!navigator.geolocation) return setLoc('unavailable')
    setLoc('asking')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (!alive.current) return
        const ll = { lat: p.coords.latitude, lng: p.coords.longitude }
        setMe(ll)
        setLoc('on')
        if (map && meLayer.current) {
          meLayer.current.clearLayers()
          L.circle([ll.lat, ll.lng], { radius: p.coords.accuracy, color: '#2f6bff', weight: 1, fillOpacity: 0.08 }).addTo(meLayer.current)
          L.marker([ll.lat, ll.lng], { icon: pin('me'), title: 'Você está aqui' }).addTo(meLayer.current)
          map.setView([ll.lat, ll.lng], 15)
        }
      },
      (e) => alive.current && setLoc(e.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  }

  // Clique no mapa: adiciona ponto à rota ou escolhe um local de encontro.
  useEffect(() => {
    if (!map) return
    const onClick = (e: L.LeafletMouseEvent) => {
      const ll = { lat: e.latlng.lat, lng: e.latlng.lng }
      if (tab === 'planejar') setWaypoints((w) => [...w, ll])
      else if (tab === 'lugares') setPlaceAt(ll)
    }
    map.on('click', onClick)
    return () => void map.off('click', onClick)
  }, [map, tab])

  // Traça o percurso planejado (pelas ruas, quando possível).
  useEffect(() => {
    if (waypoints.length < 2) return setPath(waypoints)
    if (!streets) return setPath(waypoints)
    const ctrl = new AbortController()
    setRouting('busy')
    const t = setTimeout(() => {
      routeOnFoot(waypoints, ctrl.signal)
        .then((r) => { setPath(r.path); setRouting('idle') })
        .catch((e) => {
          if (ctrl.signal.aborted) return
          setPath(waypoints)
          setRouting('error')
          void e
        })
    }, 350)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [waypoints, streets])

  const filteredEvents = useMemo(
    () =>
      events.filter((e) => {
        if (e.startsAt < Date.now() - 3600000) return false
        if (fSport !== 'all' && e.sport !== fSport) return false
        if (fDiff !== 'all' && e.difficulty !== fDiff) return false
        if (fAccess && !e.accessibility.trim()) return false
        if (fNear !== 'all') {
          if (!me || e.meetingPoint.lat == null) return false
          if (haversine(me, { lat: e.meetingPoint.lat, lng: e.meetingPoint.lng! }) > fNear * 1000) return false
        }
        return true
      }),
    [events, fSport, fDiff, fAccess, fNear, me],
  )

  // Camadas do mapa.
  useEffect(() => {
    const g = layers.current
    if (!map || !g) return
    g.clearLayers()
    for (const r of routes) {
      const sel = r.id === selectedRoute
      const line = L.polyline(r.points.map((p) => [p.lat, p.lng] as L.LatLngTuple), { ...PLAN_STYLE, opacity: sel ? 1 : 0.5, weight: sel ? 5 : 3 }).addTo(g)
      line.bindTooltip(`${r.name} · ${km(r.distanceM)} km (planejada)`)
      line.on('click', () => setSelectedRoute(r.id))
    }
    for (const p of places) L.marker([p.lat, p.lng], { icon: pin('meeting'), title: p.name }).bindTooltip(p.name).addTo(g)
    for (const e of filteredEvents) if (e.meetingPoint.lat != null) L.marker([e.meetingPoint.lat, e.meetingPoint.lng!], { icon: pin('event'), title: e.title }).on('click', () => navigate(`/evento/${e.id}`)).bindTooltip(e.title).addTo(g)
    if (tab === 'planejar') {
      if (path.length > 1) L.polyline(path.map((p) => [p.lat, p.lng] as L.LatLngTuple), { ...PLAN_STYLE, dashArray: undefined, opacity: 1 }).addTo(g)
      waypoints.forEach((w, i) => L.marker([w.lat, w.lng], { icon: pin(i === 0 ? 'start' : 'waypoint') }).addTo(g))
    }
    if (placeAt) L.marker([placeAt.lat, placeAt.lng], { icon: pin('meeting') }).addTo(g)
    if (selectedRoute) {
      const r = routes.find((x) => x.id === selectedRoute)
      if (r && r.points.length > 1) map.fitBounds(L.latLngBounds(r.points.map((p) => [p.lat, p.lng] as L.LatLngTuple)), { padding: [30, 30] })
    }
  }, [map, routes, places, filteredEvents, path, waypoints, tab, selectedRoute, placeAt])

  // Percursos realizados (somente os seus, deste aparelho).
  useEffect(() => {
    if (!map || !showTracks) return
    const g = L.layerGroup().addTo(map)
    const recent = activities.filter((a) => a.hasTrack).sort((a, b) => b.startedAt - a.startedAt).slice(0, 15)
    void Promise.all(recent.map((a) => repo.getTrack(a.id))).then((tracks) => {
      const all: L.LatLngTuple[] = []
      tracks.forEach((t, i) => {
        if (!t) return
        const pts = t.points.map((p) => [p.lat, p.lng] as L.LatLngTuple)
        all.push(...pts)
        L.polyline(pts, { ...ROUTE_STYLE, weight: 3, opacity: 0.8 }).bindTooltip(recent[i].title).on('click', () => navigate(`/atividade/${recent[i].id}`)).addTo(g)
      })
      if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [30, 30] })
    })
    return () => void g.remove()
  }, [map, showTracks, activities])

  const distance = pathLength(path)

  return (
    <div className="map-page">
      <h1 className="sr-only">Mapa</h1>
      <div className="map-main">
        <div ref={ref} className="map" aria-label="Mapa interativo" />
        <div className="map-tools">
          <button className="icon-btn on-map" aria-label="Minha localização" onClick={() => (loc === 'on' ? locate() : setExplain(true))}><LocateFixed size={20} /></button>
        </div>
        {tileError && <div className="map-overlay small">Sem conexão com o servidor de mapas. Verifique a internet.</div>}
        {tab === 'planejar' && <div className="map-hint small">Toque no mapa para adicionar pontos ao percurso.</div>}
        {tab === 'lugares' && <div className="map-hint small">Toque no mapa para marcar um ponto de encontro.</div>}
      </div>

      <aside className="map-panel">
        {loc === 'denied' && <Notice tone="err">Localização negada. O mapa continua disponível; para ver sua posição, permita a localização nas configurações do navegador.</Notice>}
        {loc === 'unavailable' && <Notice tone="warn">Não foi possível obter sua posição. Verifique se a localização do aparelho está ligada.</Notice>}
        {loc === 'insecure' && <Notice tone="warn">A localização só funciona em páginas HTTPS.</Notice>}
        <SearchBox near={me} onPick={(r) => { map?.setView([r.lat, r.lng], 16); setPlaceAt({ lat: r.lat, lng: r.lng }); setTab('lugares') }} />

        <div className="tabs" role="tablist" aria-label="Seções do mapa">
          {(['rotas', 'planejar', 'lugares', 'encontros'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {{ rotas: 'Rotas', planejar: 'Planejar', lugares: 'Lugares', encontros: 'Encontros' }[t]}
            </button>
          ))}
        </div>

        {tab === 'rotas' && (
          <div className="stack">
            <Switch checked={showTracks} onChange={setShowTracks} label="Mostrar meus percursos realizados" description="Linhas contínuas: trajetos gravados. Tracejadas: rotas planejadas." />
            {routes.length === 0 ? (
              <p className="small muted">Nenhuma rota salva. Use “Planejar” para traçar um percurso e salvá-lo.</p>
            ) : (
              <div className="panel flush list">
                {routes.map((r) => (
                  <div key={r.id} className={`list-item${selectedRoute === r.id ? ' selected' : ''}`}>
                    <button className="link grow row" style={{ color: 'inherit', textAlign: 'left' }} onClick={() => setSelectedRoute(r.id)}>
                      <SportIcon sport={r.sport} size={18} />
                      <span className="grow">
                        <span className="title" style={{ display: 'block' }}>{r.name}</span>
                        <span className="meta">{km(r.distanceM)} km · planejada {r.followsStreets ? 'pelas ruas' : 'em linha reta'}</span>
                      </span>
                    </button>
                    <a className="icon-btn" href={`#/comunidade?novoEvento=1&rota=${r.id}`} aria-label={`Criar encontro com a rota ${r.name}`}><CalendarPlus size={18} /></a>
                    <button className="icon-btn" aria-label={`Excluir rota ${r.name}`} onClick={() => confirm(`Excluir a rota “${r.name}”?`) && deleteRoute(r.id)}><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'planejar' && (
          <div className="stack">
            <div className="row between">
              <div><div className="num big">{km(distance)} km</div><div className="tiny muted">{waypoints.length} pontos · distância planejada</div></div>
              <div className="row" style={{ gap: 4 }}>
                <button className="icon-btn" aria-label="Desfazer último ponto" disabled={!waypoints.length} onClick={() => setWaypoints((w) => w.slice(0, -1))}><Undo2 size={18} /></button>
                <button className="icon-btn" aria-label="Limpar percurso" disabled={!waypoints.length} onClick={() => setWaypoints([])}><Trash2 size={18} /></button>
              </div>
            </div>
            <Switch checked={streets} onChange={setStreets} label="Seguir ruas e caminhos" description="Usa o roteamento a pé do OpenStreetMap. Sem conexão, liga os pontos em linha reta." />
            {routing === 'busy' && <p className="tiny muted" role="status">Calculando percurso…</p>}
            {routing === 'error' && streets && <Notice tone="warn">Roteamento indisponível agora. O percurso está em linha reta.</Notice>}
            <button className="btn primary" disabled={path.length < 2} onClick={() => setSaveOpen(true)}>Salvar rota</button>
            <p className="tiny faint">Uma rota planejada é uma sugestão de percurso, não uma atividade realizada. Verifique as condições do local antes de sair.</p>
          </div>
        )}

        {tab === 'lugares' && (
          <div className="stack">
            {placeAt && <PlaceForm at={placeAt} onDone={() => setPlaceAt(null)} />}
            {places.length === 0 && !placeAt && <p className="small muted">Marque pontos de encontro (praças, entradas de parques) para usar nos encontros em grupo. Evite marcar endereços residenciais.</p>}
            {places.length > 0 && (
              <div className="panel flush list">
                {places.map((p) => (
                  <div key={p.id} className="list-item">
                    <MapPin size={18} className="accent" aria-hidden="true" />
                    <button className="link grow" style={{ color: 'inherit', textAlign: 'left' }} onClick={() => map?.setView([p.lat, p.lng], 17)}>
                      <span className="title" style={{ display: 'block' }}>{p.name}</span>
                      {p.notes && <span className="meta">{p.notes}</span>}
                    </button>
                    <button className="icon-btn" aria-label={`Excluir ${p.name}`} onClick={() => void deletePlace(p.id)}><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'encontros' && (
          <div className="stack">
            <div className="grid two">
              <label className="field"><span>Modalidade</span>
                <select className="input" value={fSport} onChange={(e) => setFSport(e.target.value as Sport | 'all')}><option value="all">Todas</option>{SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABEL[s]}</option>)}</select>
              </label>
              <label className="field"><span>Dificuldade</span>
                <select className="input" value={fDiff} onChange={(e) => setFDiff(e.target.value as Difficulty | 'all')}><option value="all">Todas</option>{(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}</select>
              </label>
              <label className="field"><span>Proximidade</span>
                <select className="input" value={String(fNear)} onChange={(e) => setFNear(e.target.value === 'all' ? 'all' : Number(e.target.value))}><option value="all">Qualquer</option><option value="2">Até 2 km</option><option value="5">Até 5 km</option><option value="10">Até 10 km</option></select>
              </label>
              <div className="field"><span>&nbsp;</span><Switch checked={fAccess} onChange={setFAccess} label="Com informação de acessibilidade" /></div>
            </div>
            {fNear !== 'all' && !me && <p className="tiny muted">Ative a sua localização para filtrar por proximidade.</p>}
            <div className="panel flush list">
              {filteredEvents.map((e) => (
                <a key={e.id} className="list-item" href={`#/evento/${e.id}`}>
                  <SportIcon sport={e.sport} size={18} />
                  <div className="grow">
                    <div className="row" style={{ gap: 6 }}><span className="title">{e.title}</span>{e.origin === 'demo' && <span className="badge demo">Demonstração</span>}</div>
                    <div className="meta">{new Date(e.startsAt).toLocaleString('pt-BR', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {DIFFICULTY_LABEL[e.difficulty]}{e.distanceKm ? ` · ${e.distanceKm} km` : ''}</div>
                  </div>
                </a>
              ))}
              {filteredEvents.length === 0 && <div className="list-item small muted">Nenhum encontro com esses filtros. <a href="#/comunidade?novoEvento=1">Organize um</a>.</div>}
            </div>
            <p className="tiny faint">Sem servidor configurado, aparecem apenas encontros criados neste aparelho, recebidos por link ou de demonstração. A localização das pessoas nunca é exibida.</p>
          </div>
        )}
      </aside>

      {explain && (
        <Sheet title="Mostrar sua posição" onClose={() => setExplain(false)}>
          <div className="stack">
            <p className="muted">Para centralizar o mapa em você e filtrar encontros próximos, o navegador vai pedir acesso à localização. A posição não é salva nem compartilhada.</p>
            <button className="btn primary" onClick={() => { setExplain(false); locate() }}><Crosshair size={18} aria-hidden="true" /> Permitir e localizar</button>
          </div>
        </Sheet>
      )}
      {saveOpen && <SaveRouteSheet path={path} streets={streets && routing !== 'error'} onClose={() => setSaveOpen(false)} onSaved={(r) => { setSaveOpen(false); setWaypoints([]); setTab('rotas'); setSelectedRoute(r.id) }} />}
    </div>
  )
}

function SearchBox({ near, onPick }: { near: LatLng | null; onPick: (r: PlaceResult) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<PlaceResult[] | null>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')
  return (
    <div className="stack tight">
      <form
        className="search"
        role="search"
        onSubmit={async (e) => {
          e.preventDefault()
          if (q.trim().length < 3) return
          setState('busy')
          try {
            setRes(await searchPlaces(q.trim(), near))
            setState('idle')
          } catch {
            setState('error')
          }
        }}
      >
        <Search size={18} aria-hidden="true" />
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar lugar ou endereço" aria-label="Pesquisar lugar" />
        <button className="btn sm" type="submit" disabled={state === 'busy'}>{state === 'busy' ? '…' : 'Buscar'}</button>
      </form>
      {state === 'error' && <p className="tiny error-text">Pesquisa indisponível. Verifique a conexão e tente de novo.</p>}
      {res && (
        <div className="panel flush list search-results">
          {res.length === 0 && <div className="list-item small muted">Nada encontrado.</div>}
          {res.map((r, i) => (
            <button key={i} className="list-item" onClick={() => { onPick(r); setRes(null) }}>
              <MapPin size={16} aria-hidden="true" />
              <span className="grow"><span className="title" style={{ display: 'block' }}>{r.name}</span><span className="meta">{r.detail}</span></span>
            </button>
          ))}
          <div className="tiny faint" style={{ padding: '6px 16px' }}>Busca: Nominatim / OpenStreetMap</div>
        </div>
      )}
    </div>
  )
}

function PlaceForm({ at, onDone }: { at: LatLng; onDone: () => void }) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  return (
    <form
      className="panel stack"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        const p: Place = { id: uid(), name: name.trim(), kind: 'meeting', lat: at.lat, lng: at.lng, notes: notes.trim(), createdAt: Date.now() }
        await savePlace(p)
        toast({ kind: 'info', title: 'Ponto de encontro salvo' })
        onDone()
      }}
    >
      <strong>Novo ponto de encontro</strong>
      <label className="field"><span>Nome</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Entrada principal do parque" required maxLength={60} /></label>
      <label className="field"><span>Referência (opcional)</span><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={120} /></label>
      <div className="row"><button className="btn primary sm" type="submit">Salvar</button><button className="btn ghost sm" type="button" onClick={onDone}>Cancelar</button></div>
    </form>
  )
}

function SaveRouteSheet({ path, streets, onClose, onSaved }: { path: LatLng[]; streets: boolean; onClose: () => void; onSaved: (r: SavedRoute) => void }) {
  const fav = useApp((s) => s.settings.favoriteSports[0] ?? 'walk')
  const [name, setName] = useState('')
  const [sport, setSport] = useState<Sport>(fav)
  const [notes, setNotes] = useState('')
  return (
    <Sheet title="Salvar rota" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          const r: SavedRoute = { id: uid(), name: name.trim(), sport, points: path, distanceM: pathLength(path), followsStreets: streets, notes: notes.trim(), createdAt: Date.now() }
          await saveRoute(r)
          onSaved(r)
        }}
      >
        <p className="muted small"><Footprints size={14} aria-hidden="true" /> {km(pathLength(path))} km planejados</p>
        <label className="field"><span>Nome</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="Ex.: Volta do parque" /></label>
        <label className="field"><span>Modalidade</span>
          <select className="input" value={sport} onChange={(e) => setSport(e.target.value as Sport)}>{SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABEL[s]}</option>)}</select>
        </label>
        <label className="field"><span>Observações</span><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={160} placeholder="Ex.: calçada larga, sombra no trecho final" /></label>
        <button className="btn primary" type="submit">Salvar</button>
      </form>
    </Sheet>
  )
}
