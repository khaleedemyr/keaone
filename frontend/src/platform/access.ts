import { useAuth } from '../auth'
import { useAccess } from '../access'

export function usePlatformAccess() {
  const { me } = useAuth()
  const { can, isOwner, roleName } = useAccess()
  const role = me?.user.platform_role || (me?.user.is_platform ? 'owner' : '')

  return {
    role,
    roleName,
    canManage: can('billing') || can('catalog'),
    canUsers: can('operators') || can('roles') || can('logs'),
    isOwner,
    can,
  }
}
