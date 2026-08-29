export type NotifyTone = 'success' | 'error' | 'info' | 'warning'

export type TrayNotification = {
  id: string
  tone: NotifyTone
  /** Local / already-translated text (feedback toasts). */
  message?: string
  titleKey?: string
  bodyKey?: string
  params?: Record<string, string>
  at: number
  read: boolean
  source: 'local' | 'server'
  serverId?: number
  meta?: Record<string, unknown> | null
}

export type ServerNotificationRow = {
  id: number
  tone: NotifyTone | string
  title_key: string
  body_key: string
  params?: Record<string, string>
  meta?: Record<string, unknown> | null
  read_at?: string | null
  at: number
}

const KEY = 'kea_notifications'
const MAX = 40
const listeners = new Set<() => void>()

function readStored(): TrayNotification[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as TrayNotification[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.at === 'number' &&
          (typeof item.message === 'string' || typeof item.bodyKey === 'string'),
      )
      .map((item) => ({
        ...item,
        source: item.source ?? 'local',
        read: Boolean(item.read),
      }))
  } catch {
    return []
  }
}

let localItems: TrayNotification[] = readStored().filter((item) => item.source !== 'server')
let serverItems: TrayNotification[] = []
/** Cached snapshot for useSyncExternalStore — must be referentially stable until mutate. */
let snapshot: TrayNotification[] = rebuildSnapshot()

function rebuildSnapshot() {
  return [...serverItems, ...localItems].sort((a, b) => b.at - a.at).slice(0, MAX)
}

function emit(persistLocal = true) {
  snapshot = rebuildSnapshot()
  if (persistLocal) {
    try {
      localStorage.setItem(KEY, JSON.stringify(localItems))
    } catch {
      // Quota or private mode — keep the in-memory tray.
    }
  }
  for (const listener of listeners) listener()
}

export function getNotifications() {
  return snapshot
}

export function subscribeNotifications(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function pushNotification(tone: NotifyTone, message: string) {
  const text = message.trim()
  if (!text) return
  localItems = [
    {
      id: crypto.randomUUID(),
      tone,
      message: text,
      at: Date.now(),
      read: false,
      source: 'local',
    },
    ...localItems,
  ].slice(0, MAX)
  emit()
}

function mapServerRows(rows: ServerNotificationRow[]): TrayNotification[] {
  return rows.map((row) => ({
    id: `server-${row.id}`,
    serverId: row.id,
    tone: (['success', 'error', 'info', 'warning'].includes(String(row.tone))
      ? row.tone
      : 'info') as NotifyTone,
    titleKey: row.title_key,
    bodyKey: row.body_key,
    params: row.params ?? {},
    meta: row.meta ?? null,
    at: typeof row.at === 'number' ? row.at : Date.now(),
    read: Boolean(row.read_at),
    source: 'server' as const,
  }))
}

function serverSignature(items: TrayNotification[]) {
  return items
    .map((item) => `${item.serverId}:${item.read ? 1 : 0}:${item.at}:${item.titleKey}:${item.bodyKey}`)
    .join('|')
}

export function setServerNotifications(rows: ServerNotificationRow[]) {
  const next = mapServerRows(rows)
  if (serverSignature(next) === serverSignature(serverItems)) return
  serverItems = next
  emit(false)
}

export function appendServerNotification(row: ServerNotificationRow) {
  const mapped = mapServerRows([row])[0]
  const existing = serverItems.findIndex((item) => item.serverId === row.id)
  if (existing >= 0) {
    serverItems = serverItems.map((item) => (item.serverId === row.id ? mapped : item))
  } else {
    serverItems = [mapped, ...serverItems].slice(0, MAX)
  }
  emit(false)
}

export function markNotificationsRead() {
  const localDirty = localItems.some((item) => !item.read)
  const serverDirty = serverItems.some((item) => !item.read)
  if (!localDirty && !serverDirty) return
  if (localDirty) {
    localItems = localItems.map((item) => (item.read ? item : { ...item, read: true }))
  }
  if (serverDirty) {
    serverItems = serverItems.map((item) => (item.read ? item : { ...item, read: true }))
  }
  emit(localDirty)
}

export function dismissNotification(id: string) {
  const fromLocal = localItems.some((item) => item.id === id)
  const fromServer = serverItems.some((item) => item.id === id)
  if (!fromLocal && !fromServer) return
  if (fromLocal) localItems = localItems.filter((item) => item.id !== id)
  if (fromServer) serverItems = serverItems.filter((item) => item.id !== id)
  emit(fromLocal)
}

export function clearNotifications() {
  if (localItems.length === 0 && serverItems.length === 0) return
  localItems = []
  serverItems = []
  emit(true)
}
