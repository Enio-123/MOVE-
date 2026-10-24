import { useEffect, useState } from 'react'
import { repo } from '../services/actions'
import { useApp } from '../services/store'

/** Carrega uma foto guardada no IndexedDB como URL temporária. */
export function usePhotoUrl(id: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!id) return setUrl(null)
    let u: string | null = null
    let alive = true
    void repo.getPhoto(id).then((b) => {
      if (!alive || !b) return
      u = URL.createObjectURL(b)
      setUrl(u)
    })
    return () => {
      alive = false
      if (u) URL.revokeObjectURL(u)
    }
  }, [id])
  return url
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'M'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function Avatar({ size }: { size?: 'lg' }) {
  const name = useApp((s) => s.settings.displayName)
  const avatarId = useApp((s) => s.settings.avatarId)
  const url = usePhotoUrl(avatarId)
  return (
    <span className={`avatar${size ? ' ' + size : ''}`} aria-hidden="true">
      {url ? <img src={url} alt="" /> : initials(name)}
    </span>
  )
}

export function NameAvatar({ name, size }: { name: string; size?: 'lg' }) {
  return (
    <span className={`avatar${size ? ' ' + size : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
