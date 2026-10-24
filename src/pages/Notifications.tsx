import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { relative } from '../domain/format'
import { clearNotifications, markRead } from '../services/actions'
import { useApp } from '../services/store'
import { Empty, PageHead } from '../ui/components'

export function NotificationsPage() {
  const list = useApp((s) => s.notifications)
  const unread = list.filter((n) => !n.read).length
  return (
    <div>
      <PageHead
        title="Notificações"
        subtitle={unread ? `${unread} não ${unread === 1 ? 'lida' : 'lidas'}` : 'Tudo em dia.'}
        actions={
          list.length > 0 && (
            <>
              <button className="btn sm" onClick={() => void markRead()} disabled={!unread}><CheckCheck size={16} aria-hidden="true" /> Marcar lidas</button>
              <button className="btn ghost sm" onClick={() => confirm('Apagar todas as notificações?') && clearNotifications()}><Trash2 size={16} aria-hidden="true" /> Limpar</button>
            </>
          )
        }
      />
      {list.length === 0 ? (
        <Empty icon={Bell} title="Nenhuma notificação">Avisos de metas, missões, conquistas, XP e encontros aparecem aqui. Ajuste categorias e lembretes em <a href="#/ajustes">Ajustes</a>.</Empty>
      ) : (
        <div className="panel flush list">
          {list.map((n) => (
            <a key={n.id} className={`list-item notif${n.read ? '' : ' unread'}`} href={n.href ?? '#/notificacoes'} onClick={() => !n.read && markRead(n.id)}>
              <span className="dot-ind" aria-hidden="true" />
              <div className="grow">
                <div className="title">{n.title}</div>
                <div className="meta">{n.body}</div>
              </div>
              <span className="tiny faint">{relative(n.at)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
