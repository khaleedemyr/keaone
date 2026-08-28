import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { persistPrefs } from '../api/prefs'
import { logActivity } from '../api/activity'
import { useAuth } from '../auth'
import {
  DEFAULT_DESKTOP_PREFS,
  normalizeDesktopPrefs,
  readDesktopPrefs,
  saveDesktopPrefs,
  type DesktopIconPosition,
  type DesktopPreferences,
  type DesktopWidgetsPrefs,
  type WidgetId,
} from './desktopPrefs'
import {
  normalizeWallpaper,
  readWallpaper,
  saveWallpaper,
  type Wallpaper,
} from './wallpaper'

export type TenantAppId = 'beranda' | 'insight' | 'pos' | 'master' | 'sales' | 'purchase' | 'approvals' | 'hr' | 'admin' | 'settings'
export type PlatformAppId = 'overview' | 'tenants' | 'billing' | 'blog' | 'admin' | 'settings'
export type AppId = TenantAppId | PlatformAppId

export type OsWindow = {
  id: AppId
  x: number
  y: number
  w: number
  h: number
  maximized: boolean
  minimized: boolean
  z: number
}

type DesktopApi = {
  wallpaper: Wallpaper
  setWallpaper: (wallpaper: Wallpaper, persist?: boolean) => void
  desktop: DesktopPreferences
  setDesktop: (patch: Partial<DesktopPreferences>, persist?: boolean) => void
  setIconPosition: (appId: string, position: DesktopIconPosition, persist?: boolean) => void
  setWidgetPosition: (widgetId: string, position: DesktopIconPosition, persist?: boolean) => void
  setWidgetVisible: (widgetId: WidgetId, visible: boolean) => void
  showAllWidgets: () => void
  patchWidgets: (patch: Partial<DesktopWidgetsPrefs>, persist?: boolean) => void
  setAppDesktopVisible: (appId: string, visible: boolean) => void
  setShowDesktopIcons: (show: boolean) => void
  windows: OsWindow[]
  openApp: (id: AppId) => void
  focusApp: (id: AppId) => void
  closeApp: (id: AppId) => void
  minimizeApp: (id: AppId) => void
  toggleMaximize: (id: AppId) => void
  moveApp: (id: AppId, x: number, y: number) => void
  resizeApp: (id: AppId, w: number, h: number) => void
}

const DesktopContext = createContext<DesktopApi | null>(null)

export const TASKBAR_H = 56
const MIN_W = 520
const MIN_H = 360

function centeredFrame(id?: AppId) {
  const wide = id === 'pos'
  const w = Math.min(wide ? 1280 : 980, window.innerWidth - 48)
  const h = Math.min(wide ? 760 : 640, window.innerHeight - TASKBAR_H - 36)
  return {
    x: Math.max(16, Math.round((window.innerWidth - w) / 2)),
    y: Math.max(16, Math.round((window.innerHeight - TASKBAR_H - h) / 2)),
    w,
    h,
  }
}

export function DesktopProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  const [wallpaper, setWallpaperState] = useState<Wallpaper>(() =>
    typeof document === 'undefined' ? { kind: 'preset', id: 'aurora' } : readWallpaper(),
  )
  const [desktop, setDesktopState] = useState<DesktopPreferences>(() =>
    typeof document === 'undefined' ? DEFAULT_DESKTOP_PREFS : readDesktopPrefs(),
  )
  const [windows, setWindows] = useState<OsWindow[]>([])

  useEffect(() => {
    const remote = me?.preferences?.wallpaper
    if (!remote) return
    const next = normalizeWallpaper(remote)
    setWallpaperState(next)
    saveWallpaper(next)
  }, [me?.user.id])

  useEffect(() => {
    const remote = me?.preferences?.desktop
    if (!remote) return
    const next = normalizeDesktopPrefs(remote)
    setDesktopState(next)
    saveDesktopPrefs(next)
  }, [me?.user.id])

  const setWallpaper = useCallback((next: Wallpaper, persist = true) => {
    setWallpaperState(next)
    saveWallpaper(next)
    if (persist) persistPrefs({ wallpaper: next })
  }, [])

  const setDesktop = useCallback((patch: Partial<DesktopPreferences>, persist = true) => {
    setDesktopState((current) => {
      const next = normalizeDesktopPrefs({
        ...current,
        ...patch,
        widgets: patch.widgets ? { ...current.widgets, ...patch.widgets } : current.widgets,
      })
      saveDesktopPrefs(next)
      if (persist) persistPrefs({ desktop: next })
      return next
    })
  }, [])

  const setIconPosition = useCallback((appId: string, position: DesktopIconPosition, persist = true) => {
    setDesktopState((current) => {
      const next = normalizeDesktopPrefs({
        ...current,
        iconPositions: { ...current.iconPositions, [appId]: position },
      })
      saveDesktopPrefs(next)
      if (persist) persistPrefs({ desktop: next })
      return next
    })
  }, [])

  const setWidgetPosition = useCallback((widgetId: string, position: DesktopIconPosition, persist = true) => {
    setDesktopState((current) => {
      const widgets = current.widgets ?? DEFAULT_DESKTOP_PREFS.widgets
      const next = normalizeDesktopPrefs({
        ...current,
        widgets: {
          ...widgets,
          positions: { ...widgets.positions, [widgetId]: position },
        },
      })
      saveDesktopPrefs(next)
      if (persist) persistPrefs({ desktop: next })
      return next
    })
  }, [])

  const setWidgetVisible = useCallback((widgetId: WidgetId, visible: boolean) => {
    setDesktopState((current) => {
      const widgets = current.widgets ?? DEFAULT_DESKTOP_PREFS.widgets
      const hidden = new Set(widgets.hidden ?? [])
      if (visible) hidden.delete(widgetId)
      else hidden.add(widgetId)
      const next = normalizeDesktopPrefs({
        ...current,
        widgets: { ...widgets, hidden: [...hidden] },
      })
      saveDesktopPrefs(next)
      persistPrefs({ desktop: next })
      return next
    })
  }, [])

  const showAllWidgets = useCallback(() => {
    setDesktopState((current) => {
      const widgets = current.widgets ?? DEFAULT_DESKTOP_PREFS.widgets
      const next = normalizeDesktopPrefs({
        ...current,
        widgets: { ...widgets, hidden: [], positions: {} },
      })
      saveDesktopPrefs(next)
      persistPrefs({ desktop: next })
      return next
    })
  }, [])

  const patchWidgets = useCallback((patch: Partial<DesktopWidgetsPrefs>, persist = true) => {
    setDesktopState((current) => {
      const widgets = current.widgets ?? DEFAULT_DESKTOP_PREFS.widgets
      const next = normalizeDesktopPrefs({
        ...current,
        widgets: { ...widgets, ...patch },
      })
      saveDesktopPrefs(next)
      if (persist) persistPrefs({ desktop: next })
      return next
    })
  }, [])

  const setAppDesktopVisible = useCallback((appId: string, visible: boolean) => {
    setDesktopState((current) => {
      const hidden = new Set(current.hiddenApps)
      if (visible) hidden.delete(appId)
      else hidden.add(appId)
      const next = normalizeDesktopPrefs({
        ...current,
        hiddenApps: [...hidden],
      })
      saveDesktopPrefs(next)
      persistPrefs({ desktop: next })
      return next
    })
  }, [])

  const setShowDesktopIcons = useCallback((show: boolean) => {
    setDesktop({ showIcons: show })
  }, [setDesktop])

  const focusApp = useCallback((id: AppId) => {
    setWindows((current) => {
      const maxZ = Math.max(20, ...current.map((win) => win.z))
      const nextZ = maxZ >= 40 ? 21 : maxZ + 1
      const reset = maxZ >= 40
      return current.map((win, index) => {
        if (win.id === id) return { ...win, z: nextZ, minimized: false }
        return reset ? { ...win, z: 20 + index } : win
      })
    })
  }, [])

  const openApp = useCallback((id: AppId) => {
    setWindows((current) => {
      const existing = current.find((win) => win.id === id)
      const maxZ = Math.max(20, ...current.map((win) => win.z))
      const nextZ = maxZ >= 40 ? 21 : maxZ + 1
      if (existing) {
        return current.map((win) =>
          win.id === id ? { ...win, minimized: false, z: nextZ } : win,
        )
      }
      queueMicrotask(() => logActivity('open_app', id))
      const pos = centeredFrame(id)
      const mobile = window.innerWidth < 768
      return [
        ...current,
        {
          id,
          ...pos,
          maximized: mobile || id === 'pos',
          minimized: false,
          z: nextZ,
        },
      ]
    })
  }, [])

  const closeApp = useCallback((id: AppId) => {
    setWindows((current) => current.filter((win) => win.id !== id))
  }, [])

  const minimizeApp = useCallback((id: AppId) => {
    setWindows((current) =>
      current.map((win) => (win.id === id ? { ...win, minimized: true } : win)),
    )
  }, [])

  const toggleMaximize = useCallback((id: AppId) => {
    setWindows((current) =>
      current.map((win) =>
        win.id === id ? { ...win, maximized: !win.maximized, minimized: false } : win,
      ),
    )
  }, [])

  const moveApp = useCallback((id: AppId, x: number, y: number) => {
    setWindows((current) =>
      current.map((win) =>
        win.id === id
          ? {
              ...win,
              maximized: false,
              x: Math.max(0, Math.min(x, window.innerWidth - 120)),
              y: Math.max(0, Math.min(y, window.innerHeight - TASKBAR_H - 48)),
            }
          : win,
      ),
    )
  }, [])

  const resizeApp = useCallback((id: AppId, w: number, h: number) => {
    setWindows((current) =>
      current.map((win) =>
        win.id === id
          ? {
              ...win,
              w: Math.max(MIN_W, Math.min(w, window.innerWidth - win.x - 8)),
              h: Math.max(MIN_H, Math.min(h, window.innerHeight - TASKBAR_H - win.y - 8)),
            }
          : win,
      ),
    )
  }, [])

  const value = useMemo<DesktopApi>(
    () => ({
      wallpaper,
      setWallpaper,
      desktop,
      setDesktop,
      setIconPosition,
      setWidgetPosition,
      setWidgetVisible,
      showAllWidgets,
      patchWidgets,
      setAppDesktopVisible,
      setShowDesktopIcons,
      windows,
      openApp,
      focusApp,
      closeApp,
      minimizeApp,
      toggleMaximize,
      moveApp,
      resizeApp,
    }),
    [
      wallpaper,
      setWallpaper,
      desktop,
      setDesktop,
      setIconPosition,
      setWidgetPosition,
      setWidgetVisible,
      showAllWidgets,
      patchWidgets,
      setAppDesktopVisible,
      setShowDesktopIcons,
      windows,
      openApp,
      focusApp,
      closeApp,
      minimizeApp,
      toggleMaximize,
      moveApp,
      resizeApp,
    ],
  )

  return <DesktopContext.Provider value={value}>{children}</DesktopContext.Provider>
}

export function useDesktop(): DesktopApi {
  const ctx = useContext(DesktopContext)
  if (!ctx) throw new Error('useDesktop must be used within DesktopProvider')
  return ctx
}
