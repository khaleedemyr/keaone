import { useCallback, useEffect, useRef, useState } from 'react'
import { listConversations, pingPresence } from '../api/chat'
import { useAccess } from '../access'
import { useFeedback } from '../components/feedback'
import { useI18n } from '../i18n'
import ChatApp from './ChatApp'
import { onOsFlyout, openOsFlyout } from './osFlyout'
import { ErpFlyoutPanel, useFlyoutDismiss } from '../layout/ErpFlyoutPanel'
import { useErpFlyoutMount } from '../layout/ErpFlyoutContext'

function IconChat({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  )
}

export function ChatTray() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const erpMount = useErpFlyoutMount()
  const [unread, setUnread] = useState(0)
  const prevUnread = useRef(0)
  const primed = useRef(false)
  const allowed = can('chat')

  const refreshUnread = useCallback(async () => {
    if (!allowed) return
    try {
      const rows = await listConversations()
      const total = rows.reduce((sum, row) => sum + (row.unread_count || 0), 0)
      setUnread(total)
      if (primed.current && total > prevUnread.current && !open) {
        const delta = total - prevUnread.current
        feedback.info(t('chatNewMessage', { count: String(delta) }))
      }
      prevUnread.current = total
      primed.current = true
    } catch {
      /* ignore background poll */
    }
  }, [allowed, feedback, open, t])

  useEffect(() => {
    if (!allowed) return
    void refreshUnread()
    const id = window.setInterval(() => void refreshUnread(), 12000)
    return () => window.clearInterval(id)
  }, [allowed, refreshUnread])

  useEffect(() => {
    if (!allowed) return
    void pingPresence().catch(() => {})
    const id = window.setInterval(() => {
      void pingPresence().catch(() => {})
    }, 30000)
    return () => window.clearInterval(id)
  }, [allowed])

  useEffect(() => {
    if (!open) return
    openOsFlyout('chat')
    void refreshUnread()
  }, [open, refreshUnread])

  useEffect(() => onOsFlyout('chat', () => setOpen(false)), [])

  useFlyoutDismiss(rootRef, open, () => setOpen(false), Boolean(erpMount))

  if (!allowed) return null

  const badge = unread > 9 ? '9+' : String(unread)

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`os-notify-btn ${open ? 'is-active' : ''}${unread > 0 ? ' has-chat-unread' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? t('chatUnread', { count: String(unread) }) : t('appChat')}
        onClick={() => setOpen((value) => !value)}
      >
        <IconChat className="h-[1.05rem] w-[1.05rem]" />
        {unread > 0 ? <span className="os-notify-badge os-chat-badge">{badge}</span> : null}
      </button>

      <ErpFlyoutPanel
        open={open}
        onClose={() => setOpen(false)}
        className="os-chat-flyout"
        role="dialog"
        ariaLabel={t('appChat')}
      >
        <div className="os-chat-flyout-head">
          <div className="text-sm font-semibold text-fg">{t('appChat')}</div>
          <button type="button" className="os-notify-clear" onClick={() => setOpen(false)}>
            {t('close')}
          </button>
        </div>
        <div className="os-chat-flyout-body">
          <ChatApp compact onActivity={() => void refreshUnread()} />
        </div>
      </ErpFlyoutPanel>
    </div>
  )
}
