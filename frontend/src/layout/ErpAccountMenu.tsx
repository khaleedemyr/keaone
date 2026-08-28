import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar } from '../components/Avatar'
import { useI18n } from '../i18n'

type ErpAccountMenuProps = {
  name: string
  avatar?: string | null
  subtitle?: string
  children: ReactNode
}

export function ErpAccountMenu({ name, avatar, subtitle, children }: ErpAccountMenuProps) {
  const { t } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="erp-account-menu">
      <button
        type="button"
        className={`erp-account-trigger ${open ? 'is-active' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={name}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={name} src={avatar} size="sm" />
        <span className="erp-account-trigger-text">
          <span className="truncate font-medium">{name}</span>
          {subtitle ? <span className="truncate text-[11px] text-muted">{subtitle}</span> : null}
        </span>
        <svg viewBox="0 0 24 24" className="erp-account-chevron" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <>
          <button type="button" className="erp-account-backdrop md:hidden" aria-label={t('close')} onClick={() => setOpen(false)} />
          <div className="erp-account-dropdown" role="menu">
            {children}
          </div>
        </>
      ) : null}
    </div>
  )
}
