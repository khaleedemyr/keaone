import { createContext, useContext, type ReactNode } from 'react'
import type { AppId } from '../desktop/DesktopContext'

type ErpNavApi = {
  openApp: (id: AppId) => void
  openAppSection: (id: AppId, sectionId: string) => void
  pendingSection: { appId: AppId; sectionId: string } | null
  clearPendingSection: () => void
}

const ErpNavContext = createContext<ErpNavApi | null>(null)

export function ErpNavProvider({
  children,
  openApp,
  openAppSection,
  pendingSection,
  clearPendingSection,
}: {
  children: ReactNode
  openApp: (id: AppId) => void
  openAppSection: (id: AppId, sectionId: string) => void
  pendingSection: { appId: AppId; sectionId: string } | null
  clearPendingSection: () => void
}) {
  return (
    <ErpNavContext.Provider value={{ openApp, openAppSection, pendingSection, clearPendingSection }}>
      {children}
    </ErpNavContext.Provider>
  )
}

export function useErpNavOptional() {
  return useContext(ErpNavContext)
}
