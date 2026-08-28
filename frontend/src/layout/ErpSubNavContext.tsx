import { createContext, useContext, useEffect, useRef, useMemo, useState, type ReactNode } from 'react'
import type { AppNavGroup, AppNavItem } from '../desktop/AppNavShell'

export type ErpSubNavRegistration = {
  groups: AppNavGroup<string>[]
  items: AppNavItem<string>[]
  current: string | null
  onSelect: (id: string) => void
}

type ErpSubNavContextValue = {
  registration: ErpSubNavRegistration | null
  setRegistration: (registration: ErpSubNavRegistration | null) => void
}

const ErpSubNavContext = createContext<ErpSubNavContextValue | null>(null)

export function ErpSubNavProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<ErpSubNavRegistration | null>(null)
  const value = useMemo(() => ({ registration, setRegistration }), [registration])
  return <ErpSubNavContext.Provider value={value}>{children}</ErpSubNavContext.Provider>
}

export function useErpSubNavContext() {
  return useContext(ErpSubNavContext)
}

export function useErpSubNavEffect(registration: ErpSubNavRegistration | null) {
  const ctx = useErpSubNavContext()
  const onSelectRef = useRef(registration?.onSelect)
  onSelectRef.current = registration?.onSelect

  const groupsKey =
    registration?.groups.map((group) => `${group.id}:${group.items.map((item) => item.id).join(',')}`).join('|') ?? ''
  const itemsKey = registration?.items.map((item) => item.id).join(',') ?? ''
  const current = registration?.current ?? null

  useEffect(() => {
    if (!ctx) return
    if (!registration) {
      ctx.setRegistration(null)
      return () => ctx.setRegistration(null)
    }
    ctx.setRegistration({
      groups: registration.groups,
      items: registration.items,
      current,
      onSelect: (id) => onSelectRef.current?.(id),
    })
    return () => ctx.setRegistration(null)
  }, [ctx, groupsKey, itemsKey, current, registration?.groups, registration?.items])
}
