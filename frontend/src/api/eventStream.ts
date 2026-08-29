import { COMPANY_KEY, TOKEN_KEY, sessionGet } from './client'

export function eventStreamUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
  const token = sessionGet(TOKEN_KEY)
  const companyId = sessionGet(COMPANY_KEY)
  const qs = new URLSearchParams()

  if (token) qs.set('access_token', token)
  if (companyId) qs.set('company_id', companyId)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      qs.set(key, String(value))
    }
  }

  return `/api/v1${path}?${qs.toString()}`
}

export type EventStreamHandle = {
  close: () => void
}

export function openEventStream(
  path: string,
  handlers: {
    onEvent?: (event: MessageEvent<string>) => void
    onError?: () => void
    params?: Record<string, string | number | undefined>
  },
): EventStreamHandle | null {
  if (typeof EventSource === 'undefined') return null

  const es = new EventSource(eventStreamUrl(path, handlers.params))

  if (handlers.onEvent) {
    es.addEventListener('notification', handlers.onEvent)
    es.addEventListener('message', handlers.onEvent)
  }

  es.onerror = () => {
    handlers.onError?.()
  }

  return {
    close: () => {
      es.close()
    },
  }
}
