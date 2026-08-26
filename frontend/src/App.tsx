import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, RequireAuth, useAuth } from './auth'
import Desktop from './desktop/Desktop'
import { DesktopProvider } from './desktop/DesktopContext'
import Landing from './marketing/Landing'
import BlogIndex from './marketing/BlogIndex'
import BlogPostPage from './marketing/BlogPost'
import Login from './pages/Login'
import NoCompany from './pages/NoCompany'
import PlatformDesktop from './platform/PlatformDesktop'
import Register from './pages/Register'

function AppHome() {
  const { me } = useAuth()

  if (me?.user.is_platform && !me.company) {
    return (
      <DesktopProvider key="platform">
        <PlatformDesktop />
      </DesktopProvider>
    )
  }

  if (!me?.company) {
    return <NoCompany />
  }

  return (
    <DesktopProvider key={me.company.id}>
      <Desktop />
    </DesktopProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
