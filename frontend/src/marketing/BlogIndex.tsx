import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMarketingBlog, type MarketingBlogPost } from '../api/marketingBlog'
import { useI18n } from '../i18n'
import { MarketingShell } from './MarketingShell'

function formatDate(iso: string | null, locale: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BlogIndex() {
  const { t, lang, locale } = useI18n()
  const [posts, setPosts] = useState<MarketingBlogPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = `${t('mktNavBlog')} · KEA One`
  }, [t])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listMarketingBlog(lang, 50)
      .then((rows) => {
        if (!cancelled) setPosts(rows)
      })
      .catch(() => {
        if (!cancelled) setPosts([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [lang])

  return (
    <MarketingShell>
      <div className="mkt-page">
        <h1>{t('mktNavBlog')}</h1>
        <p className="mkt-page-lead">{t('mktBlogLead')}</p>
        {loading ? (
          <p className="mkt-muted" style={{ marginTop: '2rem' }}>
            {t('connecting')}
          </p>
        ) : posts.length === 0 ? (
          <p className="mkt-muted" style={{ marginTop: '2rem' }}>
            {t('mktBlogEmpty')}
          </p>
        ) : (
          <div className="mkt-blog-grid" style={{ marginTop: '2rem' }}>
            {posts.map((post) => (
              <Link key={post.id} to={`/blog/${post.slug}`} className="mkt-blog-item">
                <time dateTime={post.published_at ?? undefined}>{formatDate(post.published_at, locale)}</time>
                <h3>{post.title}</h3>
                {post.excerpt ? <p>{post.excerpt}</p> : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </MarketingShell>
  )
}
