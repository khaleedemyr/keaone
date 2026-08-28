import { ErrorBoundary } from '../components/ErrorBoundary'
import SettingsApp from '../desktop/SettingsApp'
import type { PlatformAppId } from '../desktop/DesktopContext'
import PlatformAdminApp from '../platform/PlatformAdminApp'
import PlatformBillingApp from '../platform/PlatformBillingApp'
import PlatformOverviewPage from '../pages/platform/Overview'
import PlatformCompanies from '../pages/platform/Companies'
import PlatformBlogPage from '../pages/platform/Blog'

export function PlatformAppView({ appId }: { appId: PlatformAppId }) {
  return (
    <ErrorBoundary>
      {appId === 'overview' ? <PlatformOverviewPage /> : null}
      {appId === 'tenants' ? (
        <div className="p-4">
          <PlatformCompanies />
        </div>
      ) : null}
      {appId === 'billing' ? <PlatformBillingApp /> : null}
      {appId === 'blog' ? (
        <div className="h-full overflow-auto">
          <PlatformBlogPage />
        </div>
      ) : null}
      {appId === 'admin' ? <PlatformAdminApp /> : null}
      {appId === 'settings' ? <SettingsApp /> : null}
    </ErrorBoundary>
  )
}
