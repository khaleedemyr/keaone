import { useAuth } from './auth'
import type { AclAction, Modules } from './types'

export function useAccess() {
  const { me } = useAuth()
  const isOwner = Boolean(me?.acl?.is_owner)

  function can(menu: string, action: AclAction = 'view') {
    if (isOwner) return true
    return Boolean(me?.permissions?.[menu]?.[action])
  }

  function canAny(menus: string[], action: AclAction = 'view') {
    return menus.some((menu) => can(menu, action))
  }

  function hasModule(key: keyof Modules) {
    return Boolean(me?.modules?.[key])
  }

  return {
    can,
    canAny,
    hasModule,
    isOwner,
    roleName: me?.acl?.role_name ?? me?.user.role_name ?? me?.user.role,
    permissions: me?.permissions ?? {},
    modules: me?.modules,
  }
}
