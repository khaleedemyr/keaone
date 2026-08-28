import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Avatar } from '../components/Avatar'
import { NotifyTray } from '../desktop/NotifyTray'
import { usePlatformApps } from '../desktop/usePlatformApps'
import { useI18n } from '../i18n'
import { usePlatformAccess } from '../platform/access'
import { SupportTray } from '../platform/SupportTray'
import { ErpShell } from './ErpShell'
import { PlatformAppView } from './PlatformAppView'

export default function PlatformErpShell() {
  const { t } = useI18n()
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const { apps, titles } = usePlatformApps()
  const { roleName } = usePlatformAccess()
  const roleLabel = roleName || t('roleSupport')

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <ErpShell
      apps={apps}
      titles={titles}
      eyebrow={t('platformEyebrow')}
      renderApp={(id) => <PlatformAppView appId={id} />}
      navbarExtras={
        <>
          <NotifyTray />
          <SupportTray />
        </>
      }
      accountPanel={
        <div className="rounded-2xl border border-line bg-fill p-3">
          <div className="flex items-center gap-3">
            <Avatar name={me?.user.name ?? ''} src={me?.user.avatar} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-fg">{me?.user.name}</div>
              <div className="mt-0.5 truncate text-xs text-muted">{me?.user.email}</div>
              <div className="mt-1 text-[11px] text-mint">{roleLabel}</div>
            </div>
          </div>
          <button type="button" className="btn-ghost mt-3 w-full" onClick={() => void handleLogout()}>
            {t('logout')}
          </button>
        </div>
      }
    />
  )
}
