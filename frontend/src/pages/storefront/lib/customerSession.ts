export type StorefrontCustomer = {
  id: number
  name: string
  email: string
  phone?: string | null
  address?: string | null
  contact_id?: number | null
}

const TOKEN_PREFIX = 'kea_sf_customer_token:'
const CUSTOMER_PREFIX = 'kea_sf_customer:'

function tokenKey(scope: string) {
  return TOKEN_PREFIX + (scope || 'preview')
}

function customerKey(scope: string) {
  return CUSTOMER_PREFIX + (scope || 'preview')
}

export function readCustomerToken(scope: string): string | null {
  try {
    return localStorage.getItem(tokenKey(scope))
  } catch {
    return null
  }
}

export function readCustomer(scope: string): StorefrontCustomer | null {
  try {
    const raw = localStorage.getItem(customerKey(scope))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StorefrontCustomer
    if (!parsed?.id || !parsed?.email) return null
    return parsed
  } catch {
    return null
  }
}

export function writeCustomerSession(scope: string, token: string, customer: StorefrontCustomer): void {
  localStorage.setItem(tokenKey(scope), token)
  localStorage.setItem(customerKey(scope), JSON.stringify(customer))
}

export function clearCustomerSession(scope: string): void {
  localStorage.removeItem(tokenKey(scope))
  localStorage.removeItem(customerKey(scope))
}
