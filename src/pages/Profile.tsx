import { Award, Camera, Settings2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SPORTS, SPORT_LABEL } from '../domain/activity'
import { fmtInt, km, relative } from '../domain/format'
import { levelName, xpForLevel } from '../domain/levels'
import type { Sport } from '../domain/types'
import { repo, updateSettings } from '../services/actions'
import { uid } from '../services/ids'
import { useApp, useDerived } from '../services/store'
import { Avatar } from '../ui/Avatar'
import { PageHead, Progress, SPORT_ICON } from '../ui/components'

export function ProfilePage() {
  const s = useApp((x) => x.settings)
  const d = useDerived()
  const [name, setName] = useState(s.displayName)
  const [bio, setBio] = useState(s.bio)
  const [saved, setSaved] = useState(false)
  const totalKm = d.counted.reduce((sum, a) => sum + a.distanceM, 0)
  const unlocked = d.achievements.filter((a) => a.unlockedAt).length

  const setAvatar = async (f: File | undefined) => {
    if (!f) return
    const bmp = await createImageBitmap(f)
    const size = 320
    const c = document.createElement('canvas')
    c.width = c.height = size
    const scale = Math.max(size / bmp.width, size / bmp.height)
    c.getContext('2d')!.drawImage(bmp, (size - bmp.width * scale) / 2, (size - bmp.height * scale) / 2, bmp.width * scale, bmp.height * scale)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85))
    if (!blob) return
    const id = uid()
    await repo.putPhoto(id, blob)
    if (s.avatarId) await repo.removePhoto(s.avatarId)
    await updateSettings({ avatarId: id })
  }

  const toggleSport = (sp: Sport) => {
    const next = s.favoriteSports.includes(sp) ? s.favoriteSports.filter((x) => x !== sp) : [...s.favoriteSports, sp]
    if (next.length) void updateSettings({ favoriteSports: next })
  }

  return (
    <div>
      <PageHead title="Perfil" actions={<a className="btn sm" href="#/ajustes"><Settings2 size={16} aria-hidden="true" /> Ajustes</a>} />
      <div className="grid lg-split">
        <div className="stack">
          <div className="panel row profile-card">
            <div className="avatar-edit">
              <Avatar size="lg" />
              <label className="icon-btn avatar-btn" aria-label="Trocar foto">
                <Camera size={16} />
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void setAvatar(e.target.files?.[0])} />
              </label>
            </div>
            <div className="grow">
              <h2>{s.displayName || 'Sem nome'}</h2>
              <p className="small muted">{s.bio || 'Adicione uma bio curta.'}</p>
              {s.avatarId && <button className="link tiny" onClick={async () => { await repo.removePhoto(s.avatarId!); await updateSettings({ avatarId: null }) }}><Trash2 size={12} aria-hidden="true" /> Remover foto</button>}
            </div>
          </div>

          <form className="panel stack" onSubmit={async (e) => { e.preventDefault(); await updateSettings({ displayName: name.trim(), bio: bio.trim() }); setSaved(true); setTimeout(() => setSaved(false), 2000) }}>
            <label className="field"><span>Nome de exibição</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
            <label className="field"><span>Bio</span><textarea className="input" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} /></label>
            <div className="field">
              <span>Modalidades favoritas</span>
              <div className="row wrap">
                {SPORTS.map((sp) => {
                  const I = SPORT_ICON[sp]
                  return <button key={sp} type="button" className="chip" aria-pressed={s.favoriteSports.includes(sp)} onClick={() => toggleSport(sp)}><I size={14} aria-hidden="true" /> {SPORT_LABEL[sp]}</button>
                })}
              </div>
            </div>
            <div className="row"><button className="btn primary sm" type="submit">Salvar perfil</button>{saved && <span className="small muted" role="status">Salvo</span>}</div>
            <p className="tiny faint">Informações médicas nunca são pedidas. Nome, foto e bio ficam neste aparelho até a comunidade online existir; lá, você decide o que é público.</p>
          </form>
        </div>

        <div className="stack">
          <div className="panel stack">
            <div className="row">
              <span className="level-chip num big-chip" aria-hidden="true">{d.level.level}</span>
              <div className="grow">
                <div className="small muted">Nível {d.level.level}</div>
                <h2>{d.level.name}</h2>
              </div>
              <div className="num big">{fmtInt(d.xpTotal)} XP</div>
            </div>
            <Progress value={d.level.progress} label="Progresso de nível" />
            <p className="tiny faint">{fmtInt(d.level.nextXp - d.xpTotal)} XP para {levelName(d.level.level + 1)} (nível {d.level.level + 1}, {fmtInt(xpForLevel(d.level.level + 1))} XP).</p>
            <div className="grid three">
              <div className="stat"><div className="label">Distância total</div><div className="value" style={{ fontSize: '1.2rem' }}>{km(totalKm)}<small>km</small></div></div>
              <div className="stat"><div className="label">Atividades</div><div className="value" style={{ fontSize: '1.2rem' }}>{d.counted.length}</div></div>
              <a className="stat" href="#/conquistas"><div className="label">Conquistas</div><div className="value" style={{ fontSize: '1.2rem' }}><Award size={16} aria-hidden="true" /> {unlocked}</div></a>
            </div>
          </div>

          <section className="panel flush">
            <h3 style={{ padding: '14px 16px 4px' }}>Histórico de XP</h3>
            <div className="list xp-list">
              {[...d.xp].reverse().slice(0, 30).map((e) => (
                <div key={e.key} className="list-item">
                  <div className="grow"><div className="title small">{e.label}</div><div className="meta tiny">{relative(e.at)}</div></div>
                  <span className="num accent-num">+{e.amount}</span>
                </div>
              ))}
              {d.xp.length === 0 && <div className="list-item small muted">O XP aparece aqui quando você registra atividades, cumpre missões e participa de encontros.</div>}
            </div>
          </section>
          <p className="tiny faint">O XP é recalculado a partir dos seus registros e não pode ser editado manualmente. Nesta versão local, a validação acontece no próprio aparelho; com o servidor, ela passa a ser feita no backend.</p>
        </div>
      </div>
    </div>
  )
}
