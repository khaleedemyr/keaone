import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, RequireAuth, useAuth } from './auth'
import Desktop from './desktop/Desktop'
import { DesktopProvider } from './desktop/DesktopContext'
import TenantErpShell from './layout/TenantErpShell'
import Landing from './marketing/Landing'
import BlogIndex from './marketing/BlogIndex'
import BlogPostPage from './marketing/BlogPost'
import Login from './pages/Login'
import NoCompany from './pages/NoCompany'
import PlatformDesktop from './platform/PlatformDesktop'
import PlatformErpShell from './layout/PlatformErpShell'
import Register from './pages/Register'
import PublicPoPage from './pages/PublicPoPage'
import PublicPrPage from './pages/PublicPrPage'
import PublicInvitePage from './pages/PublicInvitePage'
import { useUiSkin } from './uiSkin'
import { MasterTableLabels } from './components/MasterTableLabels'

function AppHome() {
  const { me } = useAuth()
  const { skin } = useUiSkin()

  if (me?.user.is_platform && !me.company) {
    return (
      <DesktopProvider key="platform">
        {skin === 'erp' ? <PlatformErpShell /> : <PlatformDesktop />}
      </DesktopProvider>
    )
  }

  if (!me?.company) {
    return <NoCompany />
  }

  return (
    <DesktopProvider key={me.company.id}>
      {skin === 'erp' ? <TenantErpShell /> : <Desktop />}
    </DesktopProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MasterTableLabels />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/po/:token" element={<PublicPoPage />} />
          <Route path="/pr/:token" element={<PublicPrPage />} />
          <Route path="/invite/:token" element={<PublicInvitePage />} />
          <Route path="/platform" element={<Navigate to="/app" replace />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppHome />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
