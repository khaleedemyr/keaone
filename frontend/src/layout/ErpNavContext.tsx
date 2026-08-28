import { createContext, useContext, type ReactNode } from 'react'
import type { AppId } from '../desktop/DesktopContext'

type ErpNavApi = {
  openApp: (id: AppId) => void
}

const ErpNavContext = createContext<ErpNavApi | null>(null)

export function ErpNavProvider({ children, openApp }: { children: ReactNode; openApp: (id: AppId) => void }) {
  return <ErpNavContext.Provider value={{ openApp }}>{children}</ErpNavContext.Provider>
}

export function useErpNavOptional() {
  return useContext(ErpNavContext)
}
