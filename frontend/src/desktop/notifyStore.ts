export type NotifyTone = 'success' | 'error' | 'info' | 'warning'

export type TrayNotification = {
  id: string
  tone: NotifyTone
  message: string
  at: number
  read: boolean
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
    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        typeof item.message === 'string' &&
        typeof item.at === 'number',
    )
  } catch {
    return []
  }
}

let items: TrayNotification[] = readStored()

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // Quota or private mode — keep the in-memory tray.
  }
  for (const listener of listeners) listener()
}

export function getNotifications() {
  return items
}

export function subscribeNotifications(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function pushNotification(tone: NotifyTone, message: string) {
  const text = message.trim()
  if (!text) return
  items = [
    {
      id: crypto.randomUUID(),
      tone,
      message: text,
      at: Date.now(),
      read: false,
    },
    ...items,
  ].slice(0, MAX)
  emit()
}

export function markNotificationsRead() {
  if (items.every((item) => item.read)) return
  items = items.map((item) => (item.read ? item : { ...item, read: true }))
  emit()
}

export function dismissNotification(id: string) {
  const next = items.filter((item) => item.id !== id)
  if (next.length === items.length) return
  items = next
  emit()
}

export function clearNotifications() {
  if (items.length === 0) return
  items = []
  emit()
}
