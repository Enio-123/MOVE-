import {
  Award,
  BarChart3,
  Bell,
  CalendarDays,
  Circle,
  Home,
  Map as MapIcon,
  Menu,
  Settings2,
  Target,
  User,
  Users,
  Watch,
  type LucideIcon,
} from 'lucide-react'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useApp } from '../services/store'
import { Avatar } from './Avatar'
import { Logo } from './Logo'
import { Sheet } from './components'
import { useRoute } from './router'
import { useInterfaceMotion } from './motion'
import { Home as HomePage } from '../pages/Home'
import { CalendarPage } from '../pages/Calendar'
import { DayPage } from '../pages/Day'
import { StatsPage } from '../pages/Stats'
import { MissionsPage } from '../pages/Missions'
import { AchievementsPage } from '../pages/Achievements'
import { CommunityPage } from '../pages/Community'
import { DevicesPage } from '../pages/Devices'
import { ProfilePage } from '../pages/Profile'
import { SettingsPage } from '../pages/Settings'
import { NotificationsPage } from '../pages/Notifications'
import { HistoryPage } from '../pages/History'
import { GroupPage } from '../pages/Group'

// Páginas com mapa carregam Leaflet sob demanda.
const MapPage = lazy(() => import('../pages/MapPage'))
const RecordPage = lazy(() => import('../pages/Record'))
const ActivityPage = lazy(() => import('../pages/Activity'))
const EventPage = lazy(() => import('../pages/Event').then((m) => ({ default: m.EventPage })))
const SharedEventPage = lazy(() => import('../pages/Event').then((m) => ({ default: m.SharedEventPage })))

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  match: (p: string) => boolean
}

const NAV: NavItem[] = [
  { href: '#/', label: 'Início', icon: Home, match: (p) => p === '/' },
  { href: '#/mapa', label: 'Mapa', icon: MapIcon, match: (p) => p.startsWith('/mapa') },
  { href: '#/registrar', label: 'Registrar', icon: Circle, match: (p) => p.startsWith('/registrar') },
  { href: '#/calendario', label: 'Calendário', icon: CalendarDays, match: (p) => p.startsWith('/calendario') || p.startsWith('/dia') },
  { href: '#/estatisticas', label: 'Estatísticas', icon: BarChart3, match: (p) => p.startsWith('/estatisticas') || p.startsWith('/historico') },
  { href: '#/missoes', label: 'Missões', icon: Target, match: (p) => p.startsWith('/missoes') || p.startsWith('/conquistas') },
  { href: '#/comunidade', label: 'Comunidade', icon: Users, match: (p) => p.startsWith('/comunidade') || p.startsWith('/grupo') || p.startsWith('/evento') },
  { href: '#/dispositivos', label: 'Dispositivos', icon: Watch, match: (p) => p.startsWith('/dispositivos') },
  { href: '#/perfil', label: 'Perfil', icon: User, match: (p) => p.startsWith('/perfil') },
]

const byHref = (h: string) => NAV.find((n) => n.href === h)!

function Page({ path, parts }: { path: string; parts: string[] }): ReactNode {
  switch (parts[0]) {
    case undefined: return <HomePage />
    case 'mapa': return <MapPage />
    case 'registrar': return <RecordPage />
    case 'calendario': return <CalendarPage />
    case 'dia': return <DayPage date={parts[1]} />
    case 'estatisticas': return <StatsPage />
    case 'historico': return <HistoryPage />
    case 'missoes': return <MissionsPage />
    case 'conquistas': return <AchievementsPage />
    case 'comunidade': return <CommunityPage />
    case 'grupo': return <GroupPage id={parts[1]} />
    case 'evento': return <EventPage id={parts[1]} />
    case 'evento-compartilhado': return <SharedEventPage />
    case 'dispositivos': return <DevicesPage />
    case 'perfil': return <ProfilePage />
    case 'ajustes': return <SettingsPage />
    case 'notificacoes': return <NotificationsPage />
    case 'atividade': return <ActivityPage id={parts[1]} />
    default:
      return (
        <div className="stack">
          <h1>Página não encontrada</h1>
          <p className="muted">O endereço {path} não existe na Move+.</p>
          <a className="btn" href="#/">Voltar ao início</a>
        </div>
      )
  }
}

function PageSkeleton() {
  return (
    <div className="stack" aria-busy="true" aria-label="Carregando">
      <div className="skeleton" style={{ height: 34, width: '45%' }} />
      <div className="skeleton" style={{ height: 260 }} />
      <div className="grid two"><div className="skeleton" style={{ height: 110 }} /><div className="skeleton" style={{ height: 110 }} /></div>
    </div>
  )
}

export function Shell() {
  const route = useRoute()
  const [more, setMore] = useState(false)
  const unread = useApp((s) => s.notifications.some((n) => !n.read))
  const path = route.path
  const current = (n: NavItem) => (n.match(path) ? 'page' : undefined)
  const recording = path.startsWith('/registrar')
  useInterfaceMotion(path)

  const mobileTabs = ['#/', '#/mapa', '#/registrar', '#/calendario'].map(byHref)
  const moreActive = !mobileTabs.some((n) => n.match(path))

  return (
    <div className="app">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>
        Pular para o conteúdo
      </a>
      <nav className="sidebar" aria-label="Navegação principal">
        <div className="brand"><Logo size={40} /></div>
        {NAV.map((n) =>
          n.href === '#/registrar' ? (
            <a key={n.href} href={n.href} className="record-link" aria-current={current(n)}>
              <Circle size={16} fill="currentColor" aria-hidden="true" /> Registrar atividade
            </a>
          ) : (
            <a key={n.href} href={n.href} aria-current={current(n)}>
              <n.icon size={19} aria-hidden="true" /> {n.label}
            </a>
          ),
        )}
        <div className="grow" />
        <a href="#/ajustes" aria-current={path.startsWith('/ajustes') ? 'page' : undefined}>
          <Settings2 size={19} aria-hidden="true" /> Ajustes e privacidade
        </a>
      </nav>

      <div className="content">
        {!recording && (
          <header className="topbar">
            <a href="#/" className="brand-mobile" aria-label="Início"><Logo size={34} /></a>
            <div className="spacer" />
            <a className="icon-btn" href="#/notificacoes" aria-label={unread ? 'Notificações (há novas)' : 'Notificações'}>
              <Bell size={20} />
              {unread && <span className="dot" />}
            </a>
            <a href="#/perfil" aria-label="Perfil" className="avatar-link"><Avatar /></a>
          </header>
        )}
        <main id="main" className={`main${recording ? ' main-record' : ''}`} tabIndex={-1} key={path}>
          <Suspense fallback={<PageSkeleton />}>
            <Page path={path} parts={route.parts} />
          </Suspense>
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Navegação principal">
        {mobileTabs.map((n) =>
          n.href === '#/registrar' ? (
            <a key={n.href} href={n.href} className="record-tab" aria-current={current(n)}>
              <span className="record-btn"><Circle size={18} fill="currentColor" aria-hidden="true" /></span>
              Registrar
            </a>
          ) : (
            <a key={n.href} href={n.href} aria-current={current(n)}>
              <n.icon size={22} aria-hidden="true" />
              {n.label}
            </a>
          ),
        )}
        <button onClick={() => setMore(true)} aria-current={moreActive ? 'page' : undefined} aria-haspopup="dialog">
          <Menu size={22} aria-hidden="true" />
          Mais
        </button>
      </nav>

      {more && (
        <Sheet title="Mais áreas" onClose={() => setMore(false)}>
          <div className="more-grid">
            {[...NAV.filter((n) => !mobileTabs.includes(n)), { href: '#/conquistas', label: 'Conquistas', icon: Award, match: () => false }, { href: '#/ajustes', label: 'Ajustes e privacidade', icon: Settings2, match: () => false }].map((n) => (
              <a key={n.href} href={n.href} className="more-item" onClick={() => setMore(false)}>
                <n.icon size={22} aria-hidden="true" />
                <span>{n.label}</span>
              </a>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}
