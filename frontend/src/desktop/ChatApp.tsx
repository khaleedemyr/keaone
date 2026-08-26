import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  listConversations,
  listMessages,
  listPeers,
  markRead,
  openDirect,
  sendMessage,
  type ChatConversation,
  type ChatMessage,
  type ChatUser,
} from '../api/chat'
import { apiMessage } from '../api/client'
import { useAuth } from '../auth'
import { Avatar } from '../components/Avatar'
import { useFeedback } from '../components/feedback'
import { useI18n } from '../i18n'

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

export default function ChatApp() {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const feedback = useFeedback()
  const meId = me?.user.id ?? 0

  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [peers, setPeers] = useState<ChatUser[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [peerSearch, setPeerSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [sending, setSending] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const lastIdRef = useRef(0)

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  )

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      const name = c.peer?.name?.toLowerCase() ?? ''
      const preview = c.last_message?.body?.toLowerCase() ?? ''
      return name.includes(q) || preview.includes(q)
    })
  }, [conversations, search])

  const refreshInbox = useCallback(async () => {
    try {
      const rows = await listConversations()
      setConversations(rows)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }, [feedback, t])

  const loadMessages = useCallback(
    async (conversationId: number, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoadingMsgs(true)
      try {
        const rows = await listMessages(conversationId)
        setMessages(rows)
        lastIdRef.current = rows.length ? rows[rows.length - 1].id : 0
        await markRead(conversationId)
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)),
        )
      } catch (err) {
        if (!opts?.silent) feedback.error(apiMessage(err, t('loadFailed')))
      } finally {
        if (!opts?.silent) setLoadingMsgs(false)
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
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)),
      )
    } catch {
      /* ignore poll errors */
    }
  }, [])

  useEffect(() => {
    void refreshInbox()
    const id = window.setInterval(() => void refreshInbox(), 15000)
    return () => window.clearInterval(id)
  }, [refreshInbox])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      lastIdRef.current = 0
      return
    }
    void loadMessages(activeId)
    const id = window.setInterval(() => void pollMessages(activeId), 4000)
    return () => window.clearInterval(id)
  }, [activeId, loadMessages, pollMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, activeId])

  useEffect(() => {
    if (!showNew) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await listPeers(peerSearch)
        if (!cancelled) setPeers(rows)
      } catch (err) {
        if (!cancelled) feedback.error(apiMessage(err, t('loadFailed')))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showNew, peerSearch, feedback, t])

  async function startChat(userId: number) {
    try {
      const conv = await openDirect(userId)
      setShowNew(false)
      setPeerSearch('')
      await refreshInbox()
      setActiveId(conv.id)
    } catch (err) {
      feedback.error(apiMessage(err, t('chatStartFailed')))
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault()
    if (!activeId || !draft.trim() || sending) return
    setSending(true)
    const body = draft.trim()
    setDraft('')
    try {
      const msg = await sendMessage(activeId, body)
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 md:flex-row">
      <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-panel md:w-72">
        <div className="flex items-center gap-2 border-b border-line p-3">
          <input
            className="field !mt-0 min-w-0 flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('chatSearch')}
          />
          <button
            type="button"
            className="btn-primary shrink-0 px-3"
            onClick={() => setShowNew((v) => !v)}
            title={t('chatNew')}
          >
            +
          </button>
        </div>

        {showNew ? (
          <div className="border-b border-line p-3">
            <div className="mb-2 text-xs font-medium text-muted">{t('chatPickPeer')}</div>
            <input
              className="field !mt-0 mb-2 w-full"
              value={peerSearch}
              onChange={(e) => setPeerSearch(e.target.value)}
              placeholder={t('chatSearchPeer')}
              autoFocus
            />
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {peers.length === 0 ? (
                <div className="px-1 py-2 text-xs text-muted">{t('chatNoPeers')}</div>
              ) : (
                peers.map((peer) => (
                  <button
                    key={peer.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-fill"
                    onClick={() => void startChat(peer.id)}
                  >
                    <Avatar name={peer.name} src={peer.avatar} size="sm" />
                    <span className="truncate text-sm text-fg">{peer.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {filteredConversations.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs text-muted">{t('chatEmpty')}</div>
          ) : (
            filteredConversations.map((c) => {
              const selected = c.id === activeId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`mb-1 flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left ${
                    selected ? 'bg-fill ring-1 ring-line' : 'hover:bg-fill/70'
                  }`}
                >
                  <Avatar name={c.peer?.name ?? '?'} src={c.peer?.avatar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-fg">{c.peer?.name ?? t('chatUnknown')}</span>
                      {c.unread_count > 0 ? (
                        <span className="rounded-full bg-mint/20 px-1.5 text-[10px] font-semibold text-mint">
                          {c.unread_count}
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      {c.last_message?.body || t('chatNoMessages')}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-panel">
        {!active ? (
          <div className="grid flex-1 place-items-center px-6 text-center text-sm text-muted">
            {t('chatPickHint')}
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Avatar name={active.peer?.name ?? '?'} src={active.peer?.avatar} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-fg">{active.peer?.name}</div>
                <div className="truncate text-[11px] text-muted">{active.peer?.email}</div>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {loadingMsgs && messages.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">{t('connecting')}</div>
              ) : messages.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">{t('chatStartTyping')}</div>
              ) : (
                messages.map((m) => {
                  const mine = m.user_id === meId
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          mine ? 'bg-mint/20 text-fg' : 'bg-fill text-fg'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div className={`mt-1 text-[10px] ${mine ? 'text-right' : ''} text-muted`}>
                          {formatTime(m.created_at, locale)}
                        </div>
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
                placeholder={t('chatPlaceholder')}
                maxLength={4000}
                disabled={sending}
              />
              <button type="submit" className="btn-primary shrink-0" disabled={sending || !draft.trim()}>
                {t('chatSend')}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
