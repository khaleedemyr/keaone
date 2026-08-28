import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  listMessages,
  markRead,
  openLiveSupport,
  sendMessage,
  type ChatConversation,
  type ChatMessage,
} from '../api/chat'
import { apiMessage } from '../api/client'
import { useAuth } from '../auth'
import { Avatar } from '../components/Avatar'
import { useFeedback } from '../components/feedback'
import { useAccess } from '../access'
import { useI18n } from '../i18n'
import { onOsFlyout, openOsFlyout } from './osFlyout'
import { ErpFlyoutPanel, useFlyoutDismiss } from '../layout/ErpFlyoutPanel'
import { useErpFlyoutMount } from '../layout/ErpFlyoutContext'

function IconLifeSupport({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M12 21a9 9 0 1 0-9-9" />
      <path d="M12 8v4l2.5 1.5" />
      <path d="M3 12h4l1.5-3 2 6L13 12h8" />
    </svg>
  )
}

function formatTime(iso: string | null | undefined, locale: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

export function LiveSupportTray() {
  const { t, locale } = useI18n()
  const { can } = useAccess()
  const { me } = useAuth()
  const feedback = useFeedback()
  const rootRef = useRef<HTMLDivElement>(null)
  const erpMount = useErpFlyoutMount()
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [conv, setConv] = useState<ChatConversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const allowed = can('chat', 'create') || can('chat')
  const meId = me?.user.id ?? 0

  const refreshThread = useCallback(async () => {
    if (!allowed) return
    try {
      const row = await openLiveSupport()
      setConv(row)
      setUnread(row.unread_count || 0)
      return row
    } catch {
      return null
    }
  }, [allowed])

  const loadMessages = useCallback(
    async (conversationId: number, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      try {
        const rows = await listMessages(conversationId)
        setMessages(rows)
        lastIdRef.current = rows.length ? rows[rows.length - 1].id : 0
        await markRead(conversationId)
        setUnread(0)
        setConv((prev) => (prev ? { ...prev, unread_count: 0 } : prev))
      } catch (err) {
        if (!opts?.silent) feedback.error(apiMessage(err, t('loadFailed')))
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [feedback, t],
  )

  const pollMessages = useCallback(async (conversationId: number) => {
    const afterId = lastIdRef.current
    try {
      const rows = afterId
        ? await listMessages(conversationId, { afterId })
        : await listMessages(conversationId)
      if (!rows.length) return
      if (afterId) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id))
          const next = [...prev]
          for (const row of rows) {
            if (!seen.has(row.id)) next.push(row)
          }
          return next
        })
        lastIdRef.current = rows[rows.length - 1].id
      } else {
        setMessages(rows)
        lastIdRef.current = rows[rows.length - 1].id
      }
      await markRead(conversationId)
      setUnread(0)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!allowed) return
    void refreshThread()
    const id = window.setInterval(() => {
      void refreshThread()
    }, 20000)
    return () => window.clearInterval(id)
  }, [allowed, refreshThread])

  useEffect(() => {
    if (!open) return
    openOsFlyout('support')
    void (async () => {
      const row = await refreshThread()
      if (row) await loadMessages(row.id)
    })()
  }, [open, refreshThread, loadMessages])

  useEffect(() => onOsFlyout('support', () => setOpen(false)), [])

  useEffect(() => {
    if (!open || !conv?.id) return
    const id = window.setInterval(() => void pollMessages(conv.id), 4000)
    return () => window.clearInterval(id)
  }, [open, conv?.id, pollMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, open])

  useFlyoutDismiss(rootRef, open, () => setOpen(false), Boolean(erpMount))

  async function onSend(e: FormEvent) {
    e.preventDefault()
    if (!conv?.id || !draft.trim() || sending) return
    setSending(true)
    const body = draft.trim()
    setDraft('')
    try {
      const msg = await sendMessage(conv.id, body)
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      lastIdRef.current = Math.max(lastIdRef.current, msg.id)
      await refreshThread()
    } catch (err) {
      setDraft(body)
      feedback.error(apiMessage(err, t('chatSendFailed')))
    } finally {
      setSending(false)
    }
  }

  if (!allowed) return null

  const badge = unread > 9 ? '9+' : String(unread)
  const peerName = conv?.peer?.name || t('liveSupportTitle')

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`os-notify-btn ${open ? 'is-active' : ''}${unread > 0 ? ' has-chat-unread' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? t('liveSupportUnread', { count: String(unread) }) : t('liveSupportTitle')}
        onClick={() => setOpen((value) => !value)}
        title={t('liveSupportTitle')}
      >
        <IconLifeSupport className="h-[1.05rem] w-[1.05rem]" />
        {unread > 0 ? <span className="os-notify-badge os-chat-badge">{badge}</span> : null}
      </button>

      <ErpFlyoutPanel
        open={open}
        onClose={() => setOpen(false)}
        className="os-chat-flyout os-support-flyout"
        role="dialog"
        ariaLabel={t('liveSupportTitle')}
      >
          <div className="os-chat-flyout-head">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-fg">{t('liveSupportTitle')}</div>
              <div className="truncate text-[11px] text-muted">{t('liveSupportLead')}</div>
            </div>
            <button type="button" className="os-notify-clear" onClick={() => setOpen(false)}>
              {t('close')}
            </button>
          </div>
          <div className="os-support-body">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <Avatar name={peerName} src={conv?.peer?.avatar} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-fg">{peerName}</div>
                <div className="text-[10px] text-mint">{t('liveSupportOnline')}</div>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
              {loading && messages.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">{t('loadingWait')}</div>
              ) : messages.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">{t('liveSupportEmpty')}</div>
              ) : (
                messages.map((msg) => {
                  const mine = msg.user_id === meId
                  return (
                    <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          mine ? 'bg-mint/20 text-fg' : 'bg-fill text-fg'
                        }`}
                      >
                        {!mine ? (
                          <div className="mb-0.5 text-[10px] font-medium text-muted">
                            {msg.user?.name || t('liveSupportTitle')}
                          </div>
                        ) : null}
                        <div className="whitespace-pre-wrap break-words">{msg.body}</div>
                        <div className="mt-1 text-[10px] text-muted">{formatTime(msg.created_at, locale)}</div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={(e) => void onSend(e)} className="flex gap-2 border-t border-line p-3">
              <input
                className="field !mt-0 min-w-0 flex-1"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t('liveSupportPlaceholder')}
                disabled={sending || !conv}
              />
              <button type="submit" className="btn-primary shrink-0 px-3" disabled={sending || !draft.trim() || !conv}>
                {t('chatSend')}
              </button>
            </form>
          </div>
      </ErpFlyoutPanel>
    </div>
  )
}
