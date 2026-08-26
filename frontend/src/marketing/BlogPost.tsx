import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMarketingBlog, type MarketingBlogPost } from '../api/marketingBlog'
import { useI18n } from '../i18n'
import { MarketingShell } from './MarketingShell'

function formatDate(iso: string | null, locale: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

function renderBody(body: string) {
  const parts = body
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.map((part, index) => (
    <p key={index}>{part.split('\n').map((line, i, arr) => (i < arr.length - 1 ? [line, <br key={i} />] : line))}</p>
  ))
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
          document.title = `${row.title} · KEA One`
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPost(null)
          setError(true)
          document.title = `KEA One · ${t('mktNavBlog')}`
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

  return (
    <MarketingShell>
      <article className="mkt-page">
        <Link to="/blog" className="mkt-link" style={{ marginTop: 0 }}>
          ← {t('mktNavBlog')}
        </Link>
        {loading ? (
          <p className="mkt-muted" style={{ marginTop: '2rem' }}>
            {t('connecting')}
          </p>
        ) : error || !post ? (
          <p className="mkt-muted" style={{ marginTop: '2rem' }}>
            {t('mktBlogEmpty')}
          </p>
        ) : (
          <>
            <h1 style={{ marginTop: '1.25rem' }}>{post.title}</h1>
            <div className="mkt-article-meta">{formatDate(post.published_at, locale)}</div>
            {post.cover ? <img className="mkt-article-cover" src={post.cover} alt="" /> : null}
            <div className="mkt-article-body">{renderBody(post.body ?? '')}</div>
            {related.length > 0 ? (
              <section style={{ marginTop: '3rem' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem' }}>{t('mktBlogTitle')}</h2>
                <div className="mkt-blog-grid" style={{ marginTop: '1rem' }}>
                  {related.map((row) => (
                    <Link key={row.id} to={`/blog/${row.slug}`} className="mkt-blog-item">
                      <h3>{row.title}</h3>
                      {row.excerpt ? <p>{row.excerpt}</p> : null}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </article>
    </MarketingShell>
  )
}
