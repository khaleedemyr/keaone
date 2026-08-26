import { TOKEN_KEY, api, sessionGet } from './client'
import { parseLang } from '../i18n/langs'
import type { UserPreferences } from '../types'
import {
  DEFAULT_DESKTOP_PREFS,
  normalizeDesktopPrefs,
  readDesktopPrefs,
  type DesktopPreferences,
} from '../desktop/desktopPrefs'
import { DEFAULT_WALLPAPER, normalizeWallpaper, type Wallpaper } from '../desktop/wallpaper'

let hydrated = false
let timer: number | undefined
let pending: Partial<UserPreferences> = {}

export function resetPrefsHydration() {
  hydrated = false
  pending = {}
  if (timer) window.clearTimeout(timer)
}

export function markPrefsHydrated() {
  hydrated = true
}

export function persistPrefs(patch: Partial<UserPreferences>) {
  if (!hydrated || !sessionGet(TOKEN_KEY)) return
  const next = { ...patch }
  if (next.wallpaper?.kind === 'preset') {
    next.wallpaper = { kind: 'preset', id: next.wallpaper.id }
  }
  const src = next.wallpaper?.src
  if (src?.startsWith('data:') || src?.startsWith('blob:')) {
    delete next.wallpaper
  }
  pending = { ...pending, ...next }
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    const body = pending
    pending = {}
    void api.put('/me/preferences', body, { silent: true }).catch(() => {})
  }, 450)
}

export function devicePrefsSnapshot(
  theme: 'dark' | 'light',
  lang: UserPreferences['lang'],
  wallpaper: Wallpaper,
  desktop: DesktopPreferences = readDesktopPrefs(),
): UserPreferences {
  return {
    theme,
    lang,
    wallpaper: normalizeWallpaper(wallpaper),
    desktop: normalizeDesktopPrefs(desktop),
  }
}

export function parseRemotePrefs(raw: UserPreferences | null | undefined): UserPreferences | null {
  if (!raw) return null
  return {
    theme: raw.theme === 'light' ? 'light' : 'dark',
    lang: parseLang(raw.lang),
    wallpaper: normalizeWallpaper(raw.wallpaper ?? DEFAULT_WALLPAPER),
    desktop: normalizeDesktopPrefs(raw.desktop ?? DEFAULT_DESKTOP_PREFS),
  }
}
