import { useEffect, useState } from 'react'
import { api, apiMessage } from '../api/client'
import { useAccess } from '../access'
import { useAuth } from '../auth'
import { Avatar } from '../components/Avatar'
import { PageEnter } from '../components/motion'
import { useFeedback } from '../components/feedback'
import { useDesktop, type TenantAppId } from '../desktop/DesktopContext'
import { APP_TILE, AppGlyph } from '../desktop/glyphs'
import { StickyNotesPanel } from '../desktop/widgets/StickyNotesPanel'
import { useTenantApps } from '../desktop/useTenantApps'
import { wallpaperCss } from '../desktop/wallpaper'
import { useI18n } from '../i18n'
import { useErpNavOptional } from '../layout/ErpNavContext'
import { formatRupiah } from '../lib/money'
import type { ApiOk, TodayReport } from '../types'
import { BerandaCalendarPanel } from './BerandaCalendarPanel'

export default function Beranda() {
  const { t, locale } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const { wallpaper, openApp: openDesktopApp } = useDesktop()
  const { apps, titles } = useTenantApps()
  const erpNav = useErpNavOptional()
  const [report, setReport] = useState<TodayReport | null>(null)

  const shortcuts = apps.filter((id) => id !== 'beranda')
  const showStats = can('insight')

  useEffect(() => {
    if (!showStats) return
    void api
      .get<ApiOk<TodayReport>>('/reports/today')
      .then(({ data }) => setReport(data.data))
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
  }, [feedback, showStats, t])

  function openApp(id: TenantAppId) {
    if (erpNav) erpNav.openApp(id)
    else openDesktopApp(id)
  }

  const roleLabel =
    me?.access === 'support' ? t('supportMode') : me?.user.role_name ?? me?.user.role ?? ''
  const outletLine = me?.outlet?.name ? ` · ${me.outlet.name}` : ''

  return (
    <PageEnter>
      <div className="beranda-page">
        <div className="beranda-cover" style={{ background: wallpaperCss(wallpaper) }} aria-hidden />

        <div className="beranda-body">
          <header className="beranda-profile">
            <div className="beranda-avatar-wrap">
              <Avatar name={me?.user.name ?? ''} src={me?.user.avatar} size="lg" />
            </div>
            <div className="beranda-profile-meta">
              <p className="beranda-eyebrow">{t('berandaWelcome')}</p>
              <h1 className="beranda-name">{me?.user.name}</h1>
              {me?.company?.name ? (
                <p className="beranda-subtitle">
                  {me.company.name}
                  {outletLine}
                </p>
              ) : null}
              {roleLabel ? <p className="beranda-role">{roleLabel}</p> : null}
            </div>
          </header>

          {showStats && report ? (
            <section className="beranda-section">
              <h2 className="beranda-section-title">{t('berandaTodaySnapshot')}</h2>
              <div className="beranda-stats">
                <div className="beranda-stat">
                  <span className="beranda-stat-label">{t('cardTx')}</span>
                  <span className="beranda-stat-value">{report.sales_count}</span>
                </div>
                <div className="beranda-stat">
                  <span className="beranda-stat-label">{t('cardRevenue')}</span>
                  <span className="beranda-stat-value">{formatRupiah(report.revenue, locale)}</span>
                </div>
                <div className="beranda-stat">
                  <span className="beranda-stat-label">{t('cardItems')}</span>
                  <span className="beranda-stat-value">{report.items_sold}</span>
                </div>
                <div className="beranda-stat">
                  <span className="beranda-stat-label">{t('cashIn')}</span>
                  <span className="beranda-stat-value">{formatRupiah(report.paid, locale)}</span>
                </div>
              </div>
            </section>
          ) : null}

          {shortcuts.length > 0 ? (
            <section className="beranda-section">
              <h2 className="beranda-section-title">{t('berandaShortcuts')}</h2>
              <div className="beranda-shortcuts">
                {shortcuts.map((id) => (
                  <button key={id} type="button" className="beranda-shortcut" onClick={() => openApp(id)}>
                    <span className={`beranda-shortcut-glyph bg-gradient-to-br ${APP_TILE[id]}`}>
                      <AppGlyph id={id} className="h-5 w-5" />
                    </span>
                    <span className="beranda-shortcut-label">{titles[id] ?? id}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div className="beranda-widgets">
            <section className="beranda-card">
              <StickyNotesPanel />
            </section>
            <section className="beranda-card">
              <div className="beranda-card-head">
                <h2 className="beranda-section-title !mb-0">{t('calReminder')}</h2>
              </div>
              <BerandaCalendarPanel />
            </section>
          </div>
        </div>
      </div>
    </PageEnter>
  )
}
