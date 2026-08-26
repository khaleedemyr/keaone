import { TOKEN_KEY, api, sessionGet } from './client'

let lastKey = ''
let lastAt = 0

export function logActivity(kind: 'open_app' | 'open_section' | 'open_calendar', target: string) {
  if (typeof localStorage === 'undefined' || !sessionGet(TOKEN_KEY)) return
  const key = `${kind}:${target}`
  const now = Date.now()
  if (key === lastKey && now - lastAt < 2000) return
  lastKey = key
  lastAt = now
  void api.post('/activity-logs/events', { kind, target }, { silent: true }).catch(() => {})
}
