import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { IconCheck, IconClose, IconInfo, IconWarn } from '../components/icons'
import { useI18n, type MsgKey } from '../i18n'
import {
  dismissNotification,
  getNotifications,
  subscribeNotifications,
  type NotifyTone,
  type TrayNotification,
} from './notifyStore'
import { onOsFlyout, openOsFlyout } from './osFlyout'
import { useDesktop } from './DesktopContext'
import {
  clearAllNotifications,
  dismissServerNotification,
  markServerNotificationsRead,
  useServerNotifications,
} from './useServerNotifications'

function IconBell({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5V13a3.5 3.5 0 0 1-3.5 3.5H10l-5 3.5V16.5A3.5 3.5 0 0 1 5 13V6.5Z" />
    </svg>
  )
}

const toneIcon: Record<NotifyTone, typeof IconInfo> = {
  success: IconCheck,
  error: IconWarn,
  warning: IconWarn,
  info: IconInfo,
}

function formatWhen(at: number, locale: string, justNow: string) {
  const delta = Date.now() - at
  if (delta < 12_000) return justNow
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const minutes = Math.round(delta / 60_000)
  if (minutes < 60) return rtf.format(-Math.max(1, minutes), 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  return new Date(at).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function NotifyTray() {
  const { t, locale } = useI18n()
  const desktop = useDesktop()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  useServerNotifications(true)
  const items = useSyncExternalStore(subscribeNotifications, getNotifications, getNotifications)
  const unread = items.filter((item) => !item.read).length

  useEffect(() => {
    if (!open) return
    openOsFlyout('notify')
    void markServerNotificationsRead()
  }, [open])

  useEffect(() => onOsFlyout('notify', () => setOpen(false)), [])

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

  const badge = unread > 9 ? '9+' : String(unread)

  function resolveText(item: TrayNotification) {
    if (item.titleKey || item.bodyKey) {
      const title = item.titleKey ? t(item.titleKey as MsgKey, item.params) : ''
      const body = item.bodyKey ? t(item.bodyKey as MsgKey, item.params) : item.message ?? ''
      return { title, body }
    }
    return { title: '', body: item.message ?? '' }
  }

  function onOpenItem(item: TrayNotification) {
    const app = item.meta && typeof item.meta.app === 'string' ? item.meta.app : null
    if (app === 'approvals' || app === 'purchase' || app === 'insight' || app === 'pos' || app === 'master' || app === 'sales' || app === 'admin' || app === 'settings') {
      desktop.openApp(app)
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`os-notify-btn ${open ? 'is-active' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? t('notifUnread', { count: String(unread) }) : t('notifTitle')}
        onClick={() => setOpen((value) => !value)}
      >
        <IconBell className="h-[1.05rem] w-[1.05rem]" />
        {unread > 0 ? <span className="os-notify-badge">{badge}</span> : null}
      </button>

      {open ? (
        <div className="os-notify" role="dialog" aria-label={t('notifTitle')}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-fg">{t('notifTitle')}</div>
            {items.length > 0 ? (
              <button type="button" className="os-notify-clear" onClick={() => void clearAllNotifications()}>
                {t('notifClear')}
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="os-notify-empty">{t('notifEmpty')}</p>
          ) : (
            <div className="os-notify-list">
              {items.map((item) => {
                const text = resolveText(item)
                return (
                  <NotifyCard
                    key={item.id}
                    item={item}
                    title={text.title}
                    body={text.body}
                    when={formatWhen(item.at, locale, t('notifJustNow'))}
                    closeLabel={t('close')}
                    onOpen={() => onOpenItem(item)}
                    onDismiss={() => {
                      dismissNotification(item.id)
                      if (item.serverId) void dismissServerNotification(item.serverId)
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function NotifyCard({
  item,
  title,
  body,
  when,
  closeLabel,
  onOpen,
  onDismiss,
}: {
  item: TrayNotification
  title: string
  body: string
  when: string
  closeLabel: string
  onOpen: () => void
  onDismiss: () => void
}) {
  const Icon = toneIcon[item.tone] ?? IconInfo
  const clickable = Boolean(item.meta && typeof item.meta.app === 'string')
  return (
    <article className={`os-notify-card is-${item.tone}${item.read ? '' : ' is-unread'}`}>
      <span className="os-notify-icon">
        <Icon className="h-4 w-4" />
      </span>
      <button
        type="button"
        className={`min-w-0 flex-1 text-left ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={clickable ? onOpen : undefined}
        disabled={!clickable}
      >
        {title ? <p className="text-[12.5px] font-medium leading-snug text-fg">{title}</p> : null}
        <p className={`text-[12.5px] leading-snug text-fg${title ? ' mt-0.5 text-muted' : ''}`}>{body}</p>
        <p className="mt-1 text-[10px] text-muted">{when}</p>
      </button>
      <button type="button" className="os-notify-dismiss" aria-label={closeLabel} onClick={onDismiss}>
        <IconClose className="h-3.5 w-3.5" />
      </button>
    </article>
  )
}
