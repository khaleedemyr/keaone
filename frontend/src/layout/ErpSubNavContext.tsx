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
  const setRegistration = ctx?.setRegistration
  const onSelectRef = useRef(registration?.onSelect)
  onSelectRef.current = registration?.onSelect
  const groupsRef = useRef(registration?.groups ?? [])
  groupsRef.current = registration?.groups ?? []
  const itemsRef = useRef(registration?.items ?? [])
  itemsRef.current = registration?.items ?? []

  const enabled = registration !== null
  const groupsKey =
    registration?.groups.map((group) => `${group.id}:${group.items.map((item) => item.id).join(',')}`).join('|') ?? ''
  const itemsKey = registration?.items.map((item) => item.id).join(',') ?? ''
  const current = registration?.current ?? null

  useEffect(() => {
    if (!setRegistration) return
    if (!enabled) {
      setRegistration(null)
      return () => setRegistration(null)
    }
    setRegistration({
      groups: groupsRef.current,
      items: itemsRef.current,
      current,
      onSelect: (id) => onSelectRef.current?.(id),
    })
    return () => setRegistration(null)
  }, [setRegistration, enabled, groupsKey, itemsKey, current])
}
