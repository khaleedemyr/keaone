import { ErrorBoundary } from '../components/ErrorBoundary'
import AdminApp from '../desktop/AdminApp'
import ApprovalsApp from '../desktop/ApprovalsApp'
import type { TenantAppId } from '../desktop/DesktopContext'
import HrApp from '../desktop/HrApp'
import MasterApp from '../desktop/MasterApp'
import PurchaseApp from '../desktop/PurchaseApp'
import SalesApp from '../desktop/SalesApp'
import SettingsApp from '../desktop/SettingsApp'
import Beranda from '../pages/Beranda'
import Dashboard from '../pages/Dashboard'
import Pos from '../pages/Pos'

export function TenantAppView({ appId }: { appId: TenantAppId }) {
  return (
    <ErrorBoundary>
      {appId === 'beranda' ? <Beranda /> : null}
      {appId === 'insight' ? <Dashboard /> : null}
      {appId === 'pos' ? <Pos /> : null}
      {appId === 'master' ? <MasterApp /> : null}
      {appId === 'sales' ? <SalesApp /> : null}
      {appId === 'purchase' ? <PurchaseApp /> : null}
      {appId === 'hr' ? <HrApp /> : null}
      {appId === 'approvals' ? <ApprovalsApp /> : null}
      {appId === 'admin' ? <AdminApp /> : null}
      {appId === 'settings' ? <SettingsApp /> : null}
    </ErrorBoundary>
  )
}
