import { useEffect, useRef } from 'react'
import { api } from '../api/client'
import { openEventStream } from '../api/eventStream'
import type { ApiOk } from '../types'
import { useAuth } from '../auth'
import {
  appendServerNotification,
  clearNotifications,
  markNotificationsRead,
  setServerNotifications,
  type ServerNotificationRow,
} from './notifyStore'

const POLL_MS = 60_000
const SSE_FALLBACK_POLL_MS = 30_000

export function useServerNotifications(enabled: boolean) {
  const { me } = useAuth()
  const companyId = me?.company?.id
  const userId = me?.user?.id
  const timer = useRef<number | null>(null)
  const lastIdRef = useRef(0)
  const streamRef = useRef<ReturnType<typeof openEventStream> | null>(null)

  useEffect(() => {
    if (!enabled || !companyId || !userId || me?.user.is_platform) {
      setServerNotifications([])
      return
    }

    let cancelled = false

    async function pull() {
      try {
        const { data } = await api.get<ApiOk<ServerNotificationRow[]>>('/notifications', {
          params: { per_page: 30 },
          silent: true,
        })
        if (!cancelled) {
          const rows = data.data ?? []
          setServerNotifications(rows)
          lastIdRef.current = rows.reduce((max, row) => Math.max(max, row.id), 0)
        }
      } catch {
        // Silent — tray stays on last known / local toasts.
      }
    }

    function startPoll(intervalMs: number) {
      if (timer.current) window.clearInterval(timer.current)
      timer.current = window.setInterval(() => void pull(), intervalMs)
    }

    function connectSse() {
      streamRef.current?.close()
      streamRef.current = openEventStream('/notifications/stream', {
        params: { last_id: lastIdRef.current },
        onEvent: (event) => {
          try {
            const row = JSON.parse(event.data) as ServerNotificationRow
            if (!row?.id) return
            lastIdRef.current = Math.max(lastIdRef.current, row.id)
            appendServerNotification(row)
          } catch {
            // ignore malformed payload
          }
        },
        onError: () => {
          streamRef.current?.close()
          streamRef.current = null
          startPoll(SSE_FALLBACK_POLL_MS)
        },
      })

      if (!streamRef.current) {
        startPoll(POLL_MS)
      }
    }

    void pull().then(() => {
      if (!cancelled) connectSse()
    })

    function onFocus() {
      void pull()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      streamRef.current?.close()
      streamRef.current = null
      if (timer.current) window.clearInterval(timer.current)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, companyId, userId, me?.user.is_platform])
}

export async function markServerNotificationsRead() {
  markNotificationsRead()
  try {
    await api.post('/notifications/read-all', {}, { silent: true })
  } catch {
    // ignore
  }
}

export async function clearAllNotifications() {
  clearNotifications()
  try {
    await api.post('/notifications/read-all', {}, { silent: true })
  } catch {
    // ignore
  }
}

export async function dismissServerNotification(serverId: number) {
  try {
    await api.post(`/notifications/${serverId}/read`, {}, { silent: true })
  } catch {
    // ignore
  }
}
