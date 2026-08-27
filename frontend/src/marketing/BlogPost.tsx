import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMarketingBlog, type MarketingBlogPost } from '../api/marketingBlog'
import { useI18n } from '../i18n'
import { MarketingShell } from './MarketingShell'
import { applyPageSeo } from './pageSeo'
import { prepareBlogHtml } from './blogContent'

function formatDate(iso: string | null, locale: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BlogPostPage() {
  const { slug = '' } = useParams()
  const { t, lang, locale } = useI18n()
  const [post, setPost] = useState<MarketingBlogPost | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    void getMarketingBlog(slug, lang)
      .then((row) => {
        if (!cancelled) {
          setPost(row)
          applyPageSeo({
            title: `${row.title} · KEA One`,
            description: row.excerpt || row.title,
            path: `/blog/${row.slug}`,
            image: row.cover || undefined,
            type: 'article',
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPost(null)
          setError(true)
          applyPageSeo({
            title: `KEA One · ${t('mktNavBlog')}`,
            description: t('mktBlogLead'),
            path: `/blog/${slug}`,
            noindex: true,
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, lang, t])

  const related = useMemo(() => (Array.isArray(post?.related) ? post.related : []), [post])
  const bodyHtml = useMemo(() => (post?.body ? prepareBlogHtml(post.body) : ''), [post?.body])

  return (
    <MarketingShell>
      <article className="mkt-article">
        <div className="mkt-article-shell">
          <Link to="/blog" className="mkt-article-back">
            ← {t('mktNavBlog')}
          </Link>

          {loading ? (
            <p className="mkt-muted mkt-article-loading">{t('connecting')}</p>
          ) : error || !post ? (
            <p className="mkt-muted mkt-article-loading">{t('mktBlogEmpty')}</p>
          ) : (
            <>
              <header className="mkt-article-header">
                <time className="mkt-article-date" dateTime={post.published_at ?? undefined}>
                  {formatDate(post.published_at, locale)}
                </time>
                <h1>{post.title}</h1>
                {post.excerpt ? <p className="mkt-article-deck">{post.excerpt}</p> : null}
              </header>

              {post.cover ? (
                <figure className="mkt-article-hero">
                  <img src={post.cover} alt={post.title} />
                </figure>
              ) : null}

              <div
                className="mkt-article-body mkt-prose"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />

              {related.length > 0 ? (
                <section className="mkt-article-related" aria-labelledby="mkt-related-heading">
                  <h2 id="mkt-related-heading">{t('blogRelated')}</h2>
                  <div className="mkt-blog-cards">
                    {related.map((row) => (
                      <Link key={row.id} to={`/blog/${row.slug}`} className="mkt-blog-card">
                        {row.cover ? (
                          <img className="mkt-blog-card-cover" src={row.cover} alt="" />
                        ) : (
                          <div className="mkt-blog-card-cover is-placeholder" aria-hidden />
                        )}
                        <div className="mkt-blog-card-body">
                          <h3>{row.title}</h3>
                          {row.excerpt ? <p>{row.excerpt}</p> : null}
                          <span className="mkt-blog-card-more">{t('blogReadMore')} →</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </article>
    </MarketingShell>
  )
}
