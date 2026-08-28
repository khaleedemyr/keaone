import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { useDesktop } from './DesktopContext'
import { onOsFlyout, openOsFlyout } from './osFlyout'
import { StickyNotesPanel } from './widgets/StickyNotesPanel'
import { ErpFlyoutPanel, useFlyoutDismiss } from '../layout/ErpFlyoutPanel'
import { useErpFlyoutMount } from '../layout/ErpFlyoutContext'

function IconNotes({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M6 4h11l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M17 4v3h3M8 11h8M8 14h6" />
    </svg>
  )
}

export function NotesTray() {
  const { t } = useI18n()
  const { desktop } = useDesktop()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const erpMount = useErpFlyoutMount()
  const notes = Array.isArray(desktop.widgets?.stickyNotes) ? desktop.widgets.stickyNotes : []
  const filled = notes.some((note) => note.text.trim().length > 0)

  useEffect(() => {
    if (!open) return
    openOsFlyout('notes')
  }, [open])

  useEffect(() => onOsFlyout('notes', () => setOpen(false)), [])

  useFlyoutDismiss(rootRef, open, () => setOpen(false), Boolean(erpMount))

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`os-notify-btn ${open ? 'is-active' : ''}${filled ? ' has-chat-unread' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('widgetNotes')}
        onClick={() => setOpen((value) => !value)}
      >
        <IconNotes className="h-[1.05rem] w-[1.05rem]" />
      </button>

      <ErpFlyoutPanel
        open={open}
        onClose={() => setOpen(false)}
        className="os-notes-flyout"
        role="dialog"
        ariaLabel={t('widgetNotes')}
      >
        <div className="os-notes-flyout-body">
          <StickyNotesPanel />
        </div>
      </ErpFlyoutPanel>
    </div>
  )
}
