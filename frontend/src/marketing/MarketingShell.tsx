import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useAuth } from '../auth'
import { useI18n } from '../i18n'
import { MktPrefs } from './MktPrefs'
import './marketing.css'
import './marketing-redesign.css'

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n()

  return (
    <>
      <a href="/#product" onClick={onNavigate}>
        {t('mktNavProduct')}
      </a>
      <a href="/#features" onClick={onNavigate}>
        {t('mktNavFeatures')}
      </a>
      <a href="/#industries" onClick={onNavigate}>
        {t('mktNavIndustries')}
      </a>
      <a href="/#pricing" onClick={onNavigate}>
        {t('mktNavPricing')}
      </a>
      <a href="/#contact" onClick={onNavigate}>
        {t('mktNavContact')}
      </a>
      <NavLink to="/blog" onClick={onNavigate}>
        {t('mktNavBlog')}
      </NavLink>
    </>
  )
}

function NavActions({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const { t } = useI18n()
  const { me } = useAuth()

  return (
    <div className={className}>
      {me ? (
        <Link to="/app" className="mkt-btn mkt-btn-primary" onClick={onNavigate}>
          {t('mktNavOpenApp')}
        </Link>
      ) : (
        <>
          <Link to="/login" className="mkt-btn mkt-btn-ghost" onClick={onNavigate}>
            {t('mktNavLogin')}
          </Link>
          <Link to="/login?demo=1" className="mkt-btn mkt-btn-primary" onClick={onNavigate}>
            {t('mktNavDemo')}
          </Link>
        </>
      )}
    </div>
  )
}

export function MarketingShell({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { me } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('mkt-menu-open', menuOpen)
    return () => document.body.classList.remove('mkt-menu-open')
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div className="mkt">
      <header className={`mkt-nav${scrolled ? ' is-scrolled' : ''}${menuOpen ? ' is-menu-open' : ''}`}>
        <div className="mkt-nav-inner">
          <Link to="/" className="mkt-brand" aria-label="KEA One" onClick={closeMenu}>
            <Logo variant="wordmark" className="mkt-brand-logo" />
          </Link>
          <nav className="mkt-nav-links" aria-label="Primary">
            <NavLinks />
          </nav>
          <div className="mkt-nav-actions">
            <MktPrefs />
            <NavActions className="mkt-nav-actions-desktop" />
            <button
              type="button"
              className="mkt-nav-toggle"
              aria-expanded={menuOpen}
              aria-controls="mkt-mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="mkt-nav-toggle-icon" aria-hidden />
              <span className="sr-only">{menuOpen ? t('mktNavClose') : t('mktNavMenu')}</span>
            </button>
          </div>
        </div>
        <div
          id="mkt-mobile-menu"
          className={`mkt-nav-drawer${menuOpen ? ' is-open' : ''}`}
          aria-hidden={!menuOpen}
        >
          <nav className="mkt-nav-drawer-links" aria-label="Mobile">
            <NavLinks onNavigate={closeMenu} />
          </nav>
          <div className="mkt-nav-drawer-actions">
            <NavActions className="mkt-nav-drawer-btns" onNavigate={closeMenu} />
          </div>
        </div>
        {menuOpen ? (
          <button
            type="button"
            className="mkt-nav-backdrop"
            aria-label={t('mktNavClose')}
            onClick={closeMenu}
          />
        ) : null}
      </header>

      <main className="mkt-main">{children}</main>

      <footer className="mkt-footer">
        <div className="mkt-footer-inner">
          <div>
            <Logo variant="wordmark" className="mkt-footer-logo" />
            <p className="mkt-footer-tag">{t('mktFooterTag')}</p>
          </div>
          <div className="mkt-footer-links">
            <a href="/#pricing">{t('mktNavPricing')}</a>
            <a href="/#contact">{t('mktNavContact')}</a>
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
