import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { isSilentRequest, setLoadingProgress, startLoading, stopLoading } from '../loading/store'

declare module 'axios' {
  interface AxiosRequestConfig {
    silent?: boolean
  }
}

export const TOKEN_KEY = 'kea_token'
export const COMPANY_KEY = 'kea_company'
export const REMEMBER_KEY = 'kea_remember'
export const LAST_EMAIL_KEY = 'kea_last_email'

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 20000,
})

export function isRemembered(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(REMEMBER_KEY) !== '0'
}

export function sessionGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(key) ?? sessionStorage.getItem(key)
}

export function sessionSet(key: string, value: string | null, remember?: boolean) {
  if (typeof window === 'undefined') return
  const persist = remember ?? isRemembered()
  if (value == null || value === '') {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
    return
  }
  if (persist) {
    sessionStorage.removeItem(key)
    localStorage.setItem(key, value)
  } else {
    localStorage.removeItem(key)
    sessionStorage.setItem(key, value)
  }
}

export function setRememberMode(remember: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
}

export function clearAuthSession() {
  sessionSet(TOKEN_KEY, null)
  sessionSet(COMPANY_KEY, null)
}

function silentConfig(config?: InternalAxiosRequestConfig) {
  if (!config) return true
  if (config.silent) return true
  return isSilentRequest(String(config.url ?? ''))
}

api.interceptors.request.use((config) => {
  const url = String(config.url ?? '')
  const isAuth = url.includes('/auth/login') || url.includes('/auth/register')
  const isCatalog = url.includes('/catalog')
  const token = sessionGet(TOKEN_KEY)
  if (token && !isAuth) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const headers = config.headers as { delete?: (name: string) => void }
    if (typeof headers.delete === 'function') headers.delete('Content-Type')
    else delete config.headers['Content-Type']
  }
  const companyId = sessionGet(COMPANY_KEY)
  if (companyId && !isAuth && !isCatalog) {
    config.headers['X-Company-Id'] = companyId
  }
  if (!silentConfig(config)) {
    startLoading()
    const prev = config.onUploadProgress
    config.onUploadProgress = (event) => {
      if (event.total) {
        setLoadingProgress(Math.round((event.loaded / event.total) * 88))
      }
      prev?.(event)
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    if (!silentConfig(response.config)) stopLoading()
    return response
  },
  (error: AxiosError) => {
    if (!silentConfig(error.config)) stopLoading()
    const url = String(error.config?.url ?? '')
    if (error.response?.status === 401 && !url.includes('/auth/logout')) {
      clearAuthSession()
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

export function rememberCompany(id: number | null | undefined) {
  sessionSet(COMPANY_KEY, id ? String(id) : null)
}

export function apiMessage(error: unknown, fallback = 'Terjadi kesalahan.'): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        return 'Koneksi timeout. Coba lagi.'
      }
      return 'Tidak bisa terhubung ke server.'
    }
    if (error.response.status === 502 || error.response.status === 503 || error.response.status === 504) {
      return 'Tidak bisa terhubung ke server.'
    }
    if (error.response.status === 429) {
      const throttled = error.response.data as { message?: string } | undefined
      return throttled?.message ?? 'Terlalu banyak percobaan. Coba lagi sebentar.'
    }
    const data = error.response.data as { message?: string } | undefined
    return data?.message ?? fallback
  }
  if (error instanceof Error && error.message && error.message !== 'too-large' && error.message !== 'not-image') {
    return error.message
  }
  return fallback
}

export async function apiUpload<T>(path: string, body: FormData, timeoutMs = 60000): Promise<T> {
  const { data } = await api.post<T>(path, body, { timeout: timeoutMs })
  return data
}
