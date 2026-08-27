import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMarketingBlog, type MarketingBlogPost } from '../api/marketingBlog'
import { useI18n } from '../i18n'
import { MarketingShell } from './MarketingShell'
import { usePageSeo } from './pageSeo'

function formatDate(iso: string | null, locale: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

function BlogCard({ post, locale }: { post: MarketingBlogPost; locale: string }) {
  const { t } = useI18n()

  return (
    <Link to={`/blog/${post.slug}`} className="mkt-blog-card">
      {post.cover ? (
        <img className="mkt-blog-card-cover" src={post.cover} alt="" />
      ) : (
        <div className="mkt-blog-card-cover is-placeholder" aria-hidden />
      )}
      <div className="mkt-blog-card-body">
        <time dateTime={post.published_at ?? undefined}>{formatDate(post.published_at, locale)}</time>
        <h2>{post.title}</h2>
        {post.excerpt ? <p>{post.excerpt}</p> : null}
        <span className="mkt-blog-card-more">{t('blogReadMore')} →</span>
      </div>
    </Link>
  )
}

export default function BlogIndex() {
  const { t, lang, locale } = useI18n()
  const [posts, setPosts] = useState<MarketingBlogPost[]>([])
  const [loading, setLoading] = useState(true)

  usePageSeo({
    title: `${t('mktNavBlog')} · KEA One`,
    description: t('mktBlogLead'),
    path: '/blog',
  })

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

  const [featured, ...rest] = posts

  return (
    <MarketingShell>
      <div className="mkt-blog-page">
        <header className="mkt-blog-page-head">
          <h1>{t('mktNavBlog')}</h1>
          <p>{t('mktBlogLead')}</p>
        </header>

        {loading ? (
          <p className="mkt-muted">{t('connecting')}</p>
        ) : posts.length === 0 ? (
          <p className="mkt-muted">{t('mktBlogEmpty')}</p>
        ) : (
          <>
            {featured ? (
              <Link to={`/blog/${featured.slug}`} className="mkt-blog-featured">
                {featured.cover ? (
                  <img className="mkt-blog-featured-cover" src={featured.cover} alt="" />
                ) : (
                  <div className="mkt-blog-featured-cover is-placeholder" aria-hidden />
                )}
                <div className="mkt-blog-featured-body">
                  <span className="mkt-blog-featured-label">{t('blogFeatured')}</span>
                  <time dateTime={featured.published_at ?? undefined}>
                    {formatDate(featured.published_at, locale)}
                  </time>
                  <h2>{featured.title}</h2>
                  {featured.excerpt ? <p>{featured.excerpt}</p> : null}
                  <span className="mkt-blog-card-more">{t('blogReadMore')} →</span>
                </div>
              </Link>
            ) : null}

            {rest.length > 0 ? (
              <div className="mkt-blog-cards">
                {rest.map((post) => (
                  <BlogCard key={post.id} post={post} locale={locale} />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </MarketingShell>
  )
}
