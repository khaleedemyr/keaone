import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { PrefsBar } from '../components/PrefsBar'
import { useAuth } from '../auth'
import { useI18n } from '../i18n'
import './marketing.css'

export function MarketingShell({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { me } = useAuth()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="mkt">
      <header className={`mkt-nav${scrolled ? ' is-scrolled' : ''}`}>
        <div className="mkt-nav-inner">
          <Link to="/" className="mkt-brand" aria-label="KEA One">
            <Logo variant="wordmark" className="mkt-brand-logo" />
          </Link>
          <nav className="mkt-nav-links" aria-label="Primary">
            <a href="/#product">{t('mktNavProduct')}</a>
            <NavLink to="/blog">{t('mktNavBlog')}</NavLink>
          </nav>
          <div className="mkt-nav-actions">
            <div className="mkt-prefs">
              <PrefsBar compact />
            </div>
            {me ? (
              <Link to="/app" className="mkt-btn mkt-btn-primary">
                {t('mktNavOpenApp')}
              </Link>
            ) : (
              <>
                <Link to="/login" className="mkt-btn mkt-btn-ghost">
                  {t('mktNavLogin')}
                </Link>
                <Link to="/login?demo=1" className="mkt-btn mkt-btn-primary">
                  {t('mktNavDemo')}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mkt-main">{children}</main>

      <footer className="mkt-footer">
        <div className="mkt-footer-inner">
          <div>
            <Logo variant="wordmark" className="mkt-footer-logo" />
            <p className="mkt-footer-tag">{t('mktFooterTag')}</p>
          </div>
          <div className="mkt-footer-links">
            <Link to="/blog">{t('mktNavBlog')}</Link>
            {me ? (
              <Link to="/app">{t('mktNavOpenApp')}</Link>
            ) : (
              <>
                <Link to="/login">{t('mktNavLogin')}</Link>
                <Link to="/register">{t('mktNavRegister')}</Link>
              </>
            )}
          </div>
          <p className="mkt-footer-copy">{t('mktFooterRights')}</p>
        </div>
      </footer>
    </div>
  )
}
