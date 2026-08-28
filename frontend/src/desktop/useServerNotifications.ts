import { useEffect, useRef } from 'react'
import { api } from '../api/client'
import type { ApiOk } from '../types'
import { useAuth } from '../auth'
import {
  clearNotifications,
  markNotificationsRead,
  setServerNotifications,
  type ServerNotificationRow,
} from './notifyStore'

const POLL_MS = 25_000

export function useServerNotifications(enabled: boolean) {
  const { me } = useAuth()
  const companyId = me?.company?.id
  const userId = me?.user?.id
  const timer = useRef<number | null>(null)

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
        if (!cancelled) setServerNotifications(data.data ?? [])
      } catch {
        // Silent — tray stays on last known / local toasts.
      }
    }

    void pull()
    timer.current = window.setInterval(() => void pull(), POLL_MS)

    function onFocus() {
      void pull()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
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
