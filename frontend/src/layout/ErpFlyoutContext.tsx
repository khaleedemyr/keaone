import { createContext, useContext, type ReactNode } from 'react'

const ErpFlyoutContext = createContext<HTMLElement | null>(null)

export function ErpFlyoutProvider({ mount, children }: { mount: HTMLElement | null; children: ReactNode }) {
  return <ErpFlyoutContext.Provider value={mount}>{children}</ErpFlyoutContext.Provider>
}

export function useErpFlyoutMount() {
  return useContext(ErpFlyoutContext)
}
