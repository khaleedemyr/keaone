import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMarketingBlog, type MarketingBlogPost } from '../api/marketingBlog'
import { Logo } from '../components/Logo'
import { useAuth } from '../auth'
import { useI18n } from '../i18n'
import { MarketingShell } from './MarketingShell'

function formatDate(iso: string | null, locale: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Landing() {
  const { t, lang, locale } = useI18n()
  const { me } = useAuth()
  const [posts, setPosts] = useState<MarketingBlogPost[]>([])

  useEffect(() => {
    document.title = `KEA One · ${t('mktHeroTitle')}`
  }, [t])

  useEffect(() => {
    let cancelled = false
    void listMarketingBlog(lang, 3)
      .then((rows) => {
        if (!cancelled) setPosts(rows)
      })
      .catch(() => {
        if (!cancelled) setPosts([])
      })
    return () => {
      cancelled = true
    }
  }, [lang])

  return (
    <MarketingShell>
      <section className="mkt-hero">
        <div className="mkt-hero-bg" aria-hidden />
        <div className="mkt-hero-grid" aria-hidden />
        <div className="mkt-hero-plane" aria-hidden />
        <div className="mkt-hero-inner">
          <Logo variant="wordmark" className="mkt-hero-brand" glow />
          <h1>{t('mktHeroTitle')}</h1>
          <p className="mkt-hero-lead">{t('mktHeroLead')}</p>
          <div className="mkt-hero-cta">
            {me ? (
              <Link to="/app" className="mkt-btn mkt-btn-primary">
                {t('mktNavOpenApp')}
              </Link>
            ) : (
              <>
                <Link to="/login?demo=1" className="mkt-btn mkt-btn-primary">
                  {t('mktHeroDemo')}
                </Link>
                <Link to="/login" className="mkt-btn mkt-btn-ghost">
                  {t('mktHeroLogin')}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section id="product" className="mkt-product">
        <div className="mkt-section">
          <div className="mkt-section-head">
            <h2>{t('mktProductTitle')}</h2>
            <p>{t('mktProductLead')}</p>
          </div>
          <div className="mkt-os-frame" aria-hidden>
            <div className="mkt-os-bar">
              <span className="mkt-os-dot" />
              <span className="mkt-os-dot" />
              <span className="mkt-os-dot" />
            </div>
            <div className="mkt-os-body">
              <div className="mkt-os-rail">
                <div className="mkt-os-icon" />
                <div className="mkt-os-icon" />
                <div className="mkt-os-icon" />
              </div>
              <div className="mkt-os-stage">
                <div className="mkt-os-window">
                  <strong>KEA One Desktop</strong>
                  <span>{t('osLine')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-section-head">
          <h2>{t('mktCapTitle')}</h2>
          <p>{t('mktCapLead')}</p>
        </div>
        <div className="mkt-cap-list">
          <div className="mkt-cap-item">
            <h3>{t('mktCapPos')}</h3>
            <p>{t('mktCapPosLead')}</p>
          </div>
          <div className="mkt-cap-item">
            <h3>{t('mktCapInv')}</h3>
            <p>{t('mktCapInvLead')}</p>
          </div>
          <div className="mkt-cap-item">
            <h3>{t('mktCapOutlets')}</h3>
            <p>{t('mktCapOutletsLead')}</p>
          </div>
          <div className="mkt-cap-item">
            <h3>{t('mktCapRoles')}</h3>
            <p>{t('mktCapRolesLead')}</p>
          </div>
          <div className="mkt-cap-item">
            <h3>{t('mktCapInsight')}</h3>
            <p>{t('mktCapInsightLead')}</p>
          </div>
        </div>
      </section>

      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-section-head">
          <h2>{t('mktIndTitle')}</h2>
          <p>{t('mktIndLead')}</p>
        </div>
        <div className="mkt-ind-row">
          <div className="mkt-ind-item">{t('mktIndRetail')}</div>
          <div className="mkt-ind-item">{t('mktIndRestaurant')}</div>
          <div className="mkt-ind-item">{t('mktIndCafe')}</div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-section-head">
          <h2>{t('mktBlogTitle')}</h2>
          <p>{t('mktBlogLead')}</p>
        </div>
        {posts.length === 0 ? (
          <p className="mkt-muted">{t('mktBlogEmpty')}</p>
        ) : (
          <div className="mkt-blog-grid">
            {posts.map((post) => (
              <Link key={post.id} to={`/blog/${post.slug}`} className="mkt-blog-item">
                <time dateTime={post.published_at ?? undefined}>{formatDate(post.published_at, locale)}</time>
                <h3>{post.title}</h3>
                {post.excerpt ? <p>{post.excerpt}</p> : null}
              </Link>
            ))}
          </div>
        )}
        <Link to="/blog" className="mkt-link">
          {t('mktBlogAll')} →
        </Link>
      </section>

      <section className="mkt-cta">
        <h2>{t('mktCtaTitle')}</h2>
        <p>{t('mktCtaLead')}</p>
        <div className="mkt-cta-actions">
          {me ? (
            <Link to="/app" className="mkt-btn mkt-btn-primary">
              {t('mktNavOpenApp')}
            </Link>
          ) : (
            <>
              <Link to="/login?demo=1" className="mkt-btn mkt-btn-primary">
                {t('mktCtaDemo')}
              </Link>
              <Link to="/register" className="mkt-btn mkt-btn-ghost">
                {t('mktCtaRegister')}
              </Link>
            </>
          )}
        </div>
      </section>
    </MarketingShell>
  )
}
