import { useState, type ReactNode } from 'react'
import { Avatar } from '../components/Avatar'
import { useI18n } from '../i18n'
import { ErpFlyoutPanel } from './ErpFlyoutPanel'

type ErpAccountMenuProps = {
  name: string
  avatar?: string | null
  subtitle?: string
  children: ReactNode
}

export function ErpAccountMenu({ name, avatar, subtitle, children }: ErpAccountMenuProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <div className="erp-account-menu">
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

      <ErpFlyoutPanel
        open={open}
        onClose={() => setOpen(false)}
        className="erp-account-dropdown"
        role="menu"
        ariaLabel={name}
      >
        {children}
      </ErpFlyoutPanel>
    </div>
  )
}
