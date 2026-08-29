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
import { api, LAST_EMAIL_KEY, TOKEN_KEY, clearAuthSession, rememberCompany, sessionGet, sessionSet, setRememberMode, apiUpload } from './api/client'
import { markPrefsHydrated, parseRemotePrefs, persistPrefs, resetPrefsHydration, devicePrefsSnapshot } from './api/prefs'
import { clearNotifications } from './desktop/notifyStore'
import { readDesktopPrefs } from './desktop/desktopPrefs'
import { readWallpaper } from './desktop/wallpaper'
import type { ApiOk, AuthPayload, MePayload } from './types'
import { useI18n } from './i18n'
import { useTheme } from './theme'
import { useUiSkin } from './uiSkin'

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
  acceptInvite: (input: {
    token: string
    name?: string
    email?: string
    password?: string
    phone?: string
    national_id?: string
    tax_id?: string
    birth_date?: string
    birth_place?: string
    gender?: string
    marital_status?: string
    address?: string
    emergency_contact_name?: string
    emergency_contact_phone?: string
    documents?: { photo?: File | null; ktp?: File | null; kk?: File | null }
  }) => Promise<MePayload | { pendingHr: true; companyName?: string; message?: string }>
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
  const { setPreference: setUiSkinPreference } = useUiSkin()

  useEffect(() => {
    if (!me) {
      resetPrefsHydration()
      return
    }

    const remote = parseRemotePrefs(me.preferences)
    if (remote) {
      setTheme(remote.theme)
      setLang(remote.lang)
      setUiSkinPreference(remote.uiSkin ?? 'auto')
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
  return '/app'
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

  const acceptInvite = useCallback(
    async (input: {
      token: string
      name?: string
      email?: string
      password?: string
      phone?: string
      national_id?: string
      tax_id?: string
      birth_date?: string
      birth_place?: string
      gender?: string
      marital_status?: string
      address?: string
      emergency_contact_name?: string
      emergency_contact_phone?: string
      documents?: { photo?: File | null; ktp?: File | null; kk?: File | null }
    }) => {
      const docs = input.documents
      const hasDocs = docs?.photo || docs?.ktp || docs?.kk

      let data: ApiOk<AuthPayload & { pending_hr?: boolean; company_name?: string; message?: string }>

      if (hasDocs) {
        const body = new FormData()
        body.append('token', input.token)
        body.append('device_name', 'web')
        if (input.name) body.append('name', input.name)
        if (input.email) body.append('email', input.email)
        if (input.password) body.append('password', input.password)
        if (input.phone) body.append('phone', input.phone)
        if (input.national_id) body.append('national_id', input.national_id)
        if (input.tax_id) body.append('tax_id', input.tax_id)
        if (input.birth_date) body.append('birth_date', input.birth_date)
        if (input.birth_place) body.append('birth_place', input.birth_place)
        if (input.gender) body.append('gender', input.gender)
        if (input.marital_status) body.append('marital_status', input.marital_status)
        if (input.address) body.append('address', input.address)
        if (input.emergency_contact_name) body.append('emergency_contact_name', input.emergency_contact_name)
        if (input.emergency_contact_phone) body.append('emergency_contact_phone', input.emergency_contact_phone)
        if (docs?.photo) body.append('employee_photo', docs.photo, docs.photo.name)
        if (docs?.ktp) body.append('ktp_document', docs.ktp, docs.ktp.name)
        if (docs?.kk) body.append('kk_document', docs.kk, docs.kk.name)
        data = await apiUpload<ApiOk<AuthPayload & { pending_hr?: boolean; company_name?: string; message?: string }>>('/auth/accept-invite', body)
      } else {
        const response = await api.post<ApiOk<AuthPayload & { pending_hr?: boolean; company_name?: string; message?: string }>>('/auth/accept-invite', {
          ...input,
          device_name: 'web',
        })
        data = response.data
      }

      if (data.data.pending_hr) {
        return {
          pendingHr: true as const,
          companyName: data.data.company_name,
          message: data.data.message,
        }
      }
      const next = applySession(data.data, true)
      rememberCompany(next.company?.id)
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
      acceptInvite,
      logout,
      refresh,
      switchCompany,
      createCompany,
    }),
    [me, loading, login, register, acceptInvite, logout, refresh, switchCompany, createCompany],
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
    return <Navigate to="/app" replace />
  }

  return children
}
