import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Avatar } from '../components/Avatar'
import { BrandLockup, Logo } from '../components/Logo'
import { PrefsBar } from '../components/PrefsBar'
import { useI18n } from '../i18n'

export default function AppShell() {
  const { me, logout } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  const nav = [
    { to: '/', label: t('navDashboard'), hint: t('hintInsight') },
    { to: '/pos', label: t('navPos'), hint: t('hintPos') },
    { to: '/products', label: t('navProducts'), hint: t('hintMaster') },
    { to: '/sales', label: t('navSales'), hint: t('hintHistory') },
  ]

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative z-10 min-h-svh text-fg">
      <div className="noise" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-mint/10 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-violet/15 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-svh max-w-[1500px]">
        <aside className="print:hidden sticky top-0 z-20 hidden h-svh w-64 shrink-0 flex-col p-4 md:flex">
          <div className="glass flex h-full flex-col rounded-3xl p-4">
            <div className="mb-8 px-1">
              <BrandLockup subtitle={t('brandSub')} />
            </div>

            <nav className="space-y-1.5">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `group flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition ${
                      isActive
                        ? 'bg-fill text-fg shadow-[inset_0_0_0_1px_rgba(62,232,197,0.28)]'
                        : 'text-muted hover:bg-fill hover:text-fg'
                    }`
                  }
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted group-hover:text-mint/70">
                    {item.hint}
                  </span>
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto space-y-3">
              <PrefsBar />
              <div className="rounded-2xl border border-line bg-fill p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={me?.user.name ?? ''} src={me?.user.avatar} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-fg">{me?.user.name}</div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {me?.company?.name} · {me?.outlet?.name}
                    </div>
                    <div className="mt-1 text-[11px] text-mint">{me?.user.role}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    void handleLogout()
                  }}
                  className="btn-ghost relative z-30 mt-3 w-full cursor-pointer"
                >
                  {t('logout')}
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="print:hidden sticky top-0 z-20 p-4 md:hidden">
            <div className="glass space-y-2 rounded-2xl px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Logo className="h-8 w-8" />
                  <div className="font-display font-bold">KEA One</div>
                </div>
                <PrefsBar compact />
              </div>
              <div className="flex gap-1">
                {nav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `rounded-xl px-2 py-1 text-xs ${isActive ? 'bg-fill text-fg' : 'text-muted'}`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </header>
          <main className="px-4 pb-8 pt-2 md:pr-6 md:pt-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
