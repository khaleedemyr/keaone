import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, LAST_EMAIL_KEY, TOKEN_KEY, clearAuthSession, rememberCompany, sessionGet, sessionSet, setRememberMode } from './api/client'
import { markPrefsHydrated, parseRemotePrefs, persistPrefs, resetPrefsHydration, devicePrefsSnapshot } from './api/prefs'
import { clearNotifications } from './desktop/notifyStore'
import { readDesktopPrefs } from './desktop/desktopPrefs'
import { readWallpaper } from './desktop/wallpaper'
import type { ApiOk, AuthPayload, MePayload } from './types'
import { useI18n } from './i18n'
import { useTheme } from './theme'

type AuthContextValue = {
  me: MePayload | null
  loading: boolean
  login: (email: string, password: string, remember?: boolean) => Promise<MePayload>
  register: (input: {
    name: string
    email: string
    password: string
    company_name: string
    business_type?: string
  }) => Promise<MePayload>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  switchCompany: (companyId: number | null) => Promise<MePayload>
  createCompany: (name: string, businessType?: string) => Promise<MePayload>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function PrefsSync() {
  const { me } = useAuth()
  const { theme, setTheme } = useTheme()
  const { lang, setLang } = useI18n()

  useEffect(() => {
    if (!me) {
      resetPrefsHydration()
      return
    }

    const remote = parseRemotePrefs(me.preferences)
    if (remote) {
      setTheme(remote.theme)
      setLang(remote.lang)
      const id = window.setTimeout(() => markPrefsHydrated(), 0)
      return () => window.clearTimeout(id)
    }

    markPrefsHydrated()
    persistPrefs(devicePrefsSnapshot(theme, lang, readWallpaper(), readDesktopPrefs()))
  }, [me?.user.id])

  return null
}

function applySession(data: AuthPayload, remember = true): MePayload {
  setRememberMode(remember)
  sessionSet(TOKEN_KEY, data.token, remember)
  rememberCompany(data.company?.id)
  const { token: _token, token_type: _type, ...me } = data
  return me
}

export function homePath(_me?: MePayload): string {
  return '/'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MePayload | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMe = useCallback(async () => {
    const token = sessionGet(TOKEN_KEY)
    if (!token) {
      setMe(null)
      setLoading(false)
      return
    }

    try {
      const { data } = await api.get<ApiOk<MePayload>>('/me')
      rememberCompany(data.data.company?.id)
      setMe(data.data)
    } catch {
      clearAuthSession()
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMe()
  }, [loadMe])

  const login = useCallback(async (email: string, password: string, remember = true) => {
    rememberCompany(null)
    const { data } = await api.post<ApiOk<AuthPayload>>('/auth/login', {
      email,
      password,
      device_name: 'web',
      remember,
    })
    const next = applySession(data.data, remember)
    if (remember) sessionSet(LAST_EMAIL_KEY, email.trim(), true)
    else sessionSet(LAST_EMAIL_KEY, null)
    clearNotifications()
    setMe(next)
    return next
  }, [])

  const register = useCallback(
    async (input: {
      name: string
      email: string
      password: string
      company_name: string
      business_type?: string
    }) => {
      const { data } = await api.post<ApiOk<AuthPayload>>('/auth/register', {
        ...input,
        device_name: 'web',
      })
      const next = applySession(data.data, true)
      clearNotifications()
      setMe(next)
      return next
    },
    [],
  )

  const logout = useCallback(async () => {
    resetPrefsHydration()
    const token = sessionGet(TOKEN_KEY)
    clearAuthSession()
    clearNotifications()
    setMe(null)

    if (!token) {
      return
    }

    try {
      await api.post('/auth/logout', null, {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // Local session is already cleared.
    }
  }, [])

  const refresh = useCallback(async () => {
    const token = sessionGet(TOKEN_KEY)
    if (!token) return
    const { data } = await api.get<ApiOk<MePayload>>('/me')
    rememberCompany(data.data.company?.id)
    setMe(data.data)
  }, [])

  const switchCompany = useCallback(async (companyId: number | null) => {
    rememberCompany(companyId)
    const { data } = await api.put<ApiOk<MePayload>>('/me/company', {
      company_id: companyId,
    })
    rememberCompany(data.data.company?.id)
    setMe(data.data)
    return data.data
  }, [])

  const createCompany = useCallback(async (name: string, businessType?: string) => {
    const { data } = await api.post<ApiOk<MePayload>>('/me/companies', {
      name,
      business_type: businessType,
    })
    rememberCompany(data.data.company?.id)
    setMe(data.data)
    return data.data
  }, [])

  const value = useMemo(
    () => ({
      me,
      loading,
      login,
      register,
      logout,
      refresh,
      switchCompany,
      createCompany,
    }),
    [me, loading, login, register, logout, refresh, switchCompany, createCompany],
  )

  return <AuthContext.Provider value={value}><PrefsSync />{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="min-h-svh bg-[var(--page)]" />
  }

  if (!me) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

export function RequirePlatform({ children }: { children: ReactNode }) {
  const { me } = useAuth()

  if (!me?.user.is_platform) {
    return <Navigate to="/" replace />
  }

  return children
}
