import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  joinPlatformSupport,
  listPlatformSupportConversations,
  listPlatformSupportMessages,
  markPlatformSupportRead,
  sendPlatformSupportMessage,
  type ChatConversation,
  type ChatMessage,
} from '../api/chat'
import { apiMessage } from '../api/client'
import { useAuth } from '../auth'
import { Avatar } from '../components/Avatar'
import { useFeedback } from '../components/feedback'
import { useAccess } from '../access'
import { useI18n } from '../i18n'
import { onOsFlyout, openOsFlyout } from '../desktop/osFlyout'
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
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function SupportTray() {
  const { t, locale } = useI18n()
  const { can } = useAccess()
  const { me } = useAuth()
  const feedback = useFeedback()
  const rootRef = useRef<HTMLDivElement>(null)
  const erpMount = useErpFlyoutMount()
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ChatConversation[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const allowed = can('livesupport')
  const meId = me?.user.id ?? 0

  const unread = rows.reduce((sum, row) => sum + (row.unread_count || 0), 0)
  const active = rows.find((r) => r.id === activeId) ?? null

  const refreshInbox = useCallback(async () => {
    if (!allowed) return
    try {
      const list = await listPlatformSupportConversations()
      setRows(list)
    } catch {
      /* ignore poll */
    }
  }, [allowed])

  const openThread = useCallback(
    async (id: number) => {
      setActiveId(id)
      setLoadingMsgs(true)
      try {
        await joinPlatformSupport(id)
        const msgs = await listPlatformSupportMessages(id)
        setMessages(msgs)
        lastIdRef.current = msgs.length ? msgs[msgs.length - 1].id : 0
        await markPlatformSupportRead(id)
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, unread_count: 0 } : r)))
      } catch (err) {
        feedback.error(apiMessage(err, t('loadFailed')))
      } finally {
        setLoadingMsgs(false)
      }
    },
    [feedback, t],
  )

  const pollMessages = useCallback(async (conversationId: number) => {
    const afterId = lastIdRef.current
    try {
      const next = afterId
        ? await listPlatformSupportMessages(conversationId, { afterId })
        : await listPlatformSupportMessages(conversationId)
      if (!next.length) return
      if (afterId) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id))
          const merged = [...prev]
          for (const row of next) {
            if (!seen.has(row.id)) merged.push(row)
          }
          return merged
        })
        lastIdRef.current = next[next.length - 1].id
      } else {
        setMessages(next)
        lastIdRef.current = next[next.length - 1].id
      }
      await markPlatformSupportRead(conversationId)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!allowed) return
    void refreshInbox()
    const id = window.setInterval(() => void refreshInbox(), 12000)
    return () => window.clearInterval(id)
  }, [allowed, refreshInbox])

  useEffect(() => {
    if (!open) return
    openOsFlyout('support')
    void refreshInbox()
  }, [open, refreshInbox])

  useEffect(() => onOsFlyout('support', () => setOpen(false)), [])

  useEffect(() => {
    if (!open || !activeId) return
    const id = window.setInterval(() => void pollMessages(activeId), 4000)
    return () => window.clearInterval(id)
  }, [open, activeId, pollMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, activeId])

  useFlyoutDismiss(rootRef, open, () => setOpen(false), Boolean(erpMount))

  async function onSend(e: FormEvent) {
    e.preventDefault()
    if (!activeId || !draft.trim() || sending) return
    setSending(true)
    const body = draft.trim()
    setDraft('')
    try {
      const msg = await sendPlatformSupportMessage(activeId, body)
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      lastIdRef.current = Math.max(lastIdRef.current, msg.id)
      await refreshInbox()
    } catch (err) {
      setDraft(body)
      feedback.error(apiMessage(err, t('chatSendFailed')))
    } finally {
      setSending(false)
    }
  }

  if (!allowed) return null

  const badge = unread > 9 ? '9+' : String(unread)

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`os-notify-btn ${open ? 'is-active' : ''}${unread > 0 ? ' has-chat-unread' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? t('liveSupportUnread', { count: String(unread) }) : t('liveSupportInbox')}
        onClick={() => setOpen((value) => !value)}
        title={t('liveSupportInbox')}
      >
        <IconLifeSupport className="h-[1.05rem] w-[1.05rem]" />
        {unread > 0 ? <span className="os-notify-badge os-chat-badge">{badge}</span> : null}
      </button>

      <ErpFlyoutPanel
        open={open}
        onClose={() => setOpen(false)}
        className="os-chat-flyout os-support-flyout is-wide"
        role="dialog"
        ariaLabel={t('liveSupportInbox')}
      >
          <div className="os-chat-flyout-head">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-fg">{t('liveSupportInbox')}</div>
              <div className="truncate text-[11px] text-muted">{t('liveSupportInboxLead')}</div>
            </div>
            <button type="button" className="os-notify-clear" onClick={() => setOpen(false)}>
              {t('close')}
            </button>
          </div>
          <div className="os-support-split">
            <aside className="os-support-list">
              {rows.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-muted">{t('liveSupportInboxEmpty')}</div>
              ) : (
                rows.map((row) => {
                  const selected = row.id === activeId
                  const label = row.peer?.name || t('chatUnknown')
                  const company = row.company?.name
                  return (
                    <button
                      key={row.id}
                      type="button"
                      className={`os-support-item ${selected ? 'is-active' : ''}`}
                      onClick={() => void openThread(row.id)}
                    >
                      <Avatar name={label} src={row.peer?.avatar} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm text-fg">{label}</span>
                          {row.unread_count > 0 ? (
                            <span className="rounded-full bg-mint px-1.5 text-[10px] font-bold text-[#04120f]">
                              {row.unread_count}
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-[10px] text-muted">
                          {company || row.last_message?.body || t('chatNoMessages')}
                        </span>
                      </span>
                    </button>
                  )
                })
              )}
            </aside>
            <section className="os-support-thread">
              {!activeId ? (
                <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-muted">
                  {t('liveSupportPick')}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                    <Avatar name={active?.peer?.name || '?'} src={active?.peer?.avatar} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-fg">{active?.peer?.name}</div>
                      <div className="truncate text-[10px] text-muted">{active?.company?.name}</div>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
                    {loadingMsgs && messages.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted">{t('loadingWait')}</div>
                    ) : messages.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted">{t('chatNoMessages')}</div>
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
                                <div className="mb-0.5 text-[10px] font-medium text-muted">{msg.user?.name}</div>
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
                      placeholder={t('liveSupportReply')}
                      disabled={sending}
                    />
                    <button type="submit" className="btn-primary shrink-0 px-3" disabled={sending || !draft.trim()}>
                      {t('chatSend')}
                    </button>
                  </form>
                </>
              )}
            </section>
          </div>
      </ErpFlyoutPanel>
    </div>
  )
}
