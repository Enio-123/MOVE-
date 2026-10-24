import { Download, Share, SquarePlus } from 'lucide-react'
import { toast } from '../services/actions'
import { promptInstall, useInstall } from '../services/install'
import { LogoMark } from './Logo'

/** Instalação do app na tela inicial (PWA). compact: só aparece quando o navegador oferece instalar. */
export function InstallCard({ compact = false }: { compact?: boolean }) {
  const st = useInstall()
  if (compact && st !== 'available') return null
  if (st === 'installed') {
    return compact ? null : (
      <section className="panel row install-card">
        <LogoMark size={40} />
        <div className="grow"><strong>App instalado</strong><p className="small muted">A Move+ está aberta como app neste aparelho.</p></div>
      </section>
    )
  }
  const install = async () => {
    if (await promptInstall()) toast({ kind: 'info', title: 'Move+ instalada', detail: 'Abra pelo ícone na tela inicial.' })
  }
  return (
    <section className={`panel stack tight install-card${compact ? ' section' : ''}`}>
      <div className="row">
        <LogoMark size={40} />
        <div className="grow">
          <strong>Instalar a Move+</strong>
          <p className="small muted">Ícone na tela inicial, tela cheia e funciona sem internet.</p>
        </div>
        {st === 'available' && <button className="btn primary sm" onClick={() => void install()}><Download size={14} aria-hidden="true" /> Instalar</button>}
      </div>
      {st === 'ios' && (
        <p className="small muted install-steps">
          No Safari, toque em <Share size={14} aria-label="Compartilhar" /> Compartilhar e depois em <SquarePlus size={14} aria-hidden="true" /> <strong>Adicionar à Tela de Início</strong>.
        </p>
      )}
      {st === 'unavailable' && <p className="tiny faint">Use o menu do navegador (Instalar app ou Adicionar à tela inicial). No computador, Chrome e Edge mostram um ícone de instalar na barra de endereço.</p>}
    </section>
  )
}
