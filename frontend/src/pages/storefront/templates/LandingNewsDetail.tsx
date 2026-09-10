import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { prepareBlogHtml } from '../../../marketing/blogContent'
import '../../../components/blogEditor.css'
import { scrollToStorefrontSection } from './storefrontNav'

export type LandingNewsItem = {
  id: string
  title: string
  excerpt: string
  body: string
  image?: string
  day?: string
  month?: string
  tags?: string
  publishedAt?: string
}

export type LandingNewsView = 'home' | 'list' | 'detail'

type Props = {
  item: LandingNewsItem
  onBack: () => void
  primary?: string
  muted?: string
  /** Extra top offset when preview banner is shown */
  preview?: boolean
  /** Optional left padding for side-menu layouts (e.g. 250px) */
  contentClassName?: string
  fontHeading?: string
  /** Site / brand name for byline */
  brand?: string
  children?: ReactNode
}

function estimateReadMinutes(html: string): number {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = text ? text.split(' ').length : 0
  return Math.max(1, Math.round(words / 200))
}

function buildShareUrl(itemId: string): string {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
  url.searchParams.set('news', itemId)
  url.searchParams.delete('view')
  url.hash = ''
  return url.toString()
}

function ShareIcon({ name }: { name: 'wa' | 'fb' | 'x' | 'li' | 'tg' | 'copy' | 'check' }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true as const }
  switch (name) {
    case 'wa':
      return (
        <svg {...common}>
          <path d="M17.47 14.38c-.28-.14-1.64-.81-1.9-.9-.25-.1-.44-.14-.62.14-.18.28-.71.9-.87 1.08-.16.18-.32.2-.6.07-.28-.14-1.17-.43-2.23-1.37-.82-.73-1.38-1.64-1.54-1.92-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.18-.28.28-.46.1-.18.05-.34-.02-.48-.07-.14-.62-1.49-.85-2.04-.22-.53-.45-.46-.62-.47h-.53c-.18 0-.48.07-.73.34-.25.28-.96.94-.96 2.3s.98 2.67 1.12 2.85c.14.18 1.93 2.95 4.68 4.14.65.28 1.16.45 1.56.57.65.21 1.25.18 1.72.11.52-.08 1.64-.67 1.87-1.32.23-.65.23-1.2.16-1.32-.07-.11-.25-.18-.53-.32z" />
          <path d="M12.04 2C6.58 2 2.15 6.43 2.15 11.89c0 1.95.51 3.86 1.48 5.54L2 22l4.7-1.55a9.86 9.86 0 0 0 5.34 1.55h.01c5.46 0 9.89-4.43 9.89-9.89C21.94 6.43 17.5 2 12.04 2zm0 18.06h-.01a8.17 8.17 0 0 1-4.16-1.14l-.3-.18-3.05.8.82-2.97-.2-.31a8.16 8.16 0 0 1-1.25-4.37c0-4.51 3.67-8.18 8.19-8.18 4.51 0 8.18 3.67 8.18 8.18 0 4.51-3.67 8.17-8.18 8.17z" />
        </svg>
      )
    case 'fb':
      return (
        <svg {...common}>
          <path d="M13.5 22v-8.2h2.76l.41-3.2H13.5V8.55c0-.93.26-1.56 1.59-1.56h1.7V4.14A23.1 23.1 0 0 0 14.3 4C11.6 4 9.76 5.66 9.76 8.2v2.4H7.1v3.2h2.66V22h3.74z" />
        </svg>
      )
    case 'x':
      return (
        <svg {...common}>
          <path d="M18.24 3H21l-6.52 7.45L22 21h-6.17l-4.83-6.31L5.5 21H2.74l6.98-7.97L2 3h6.32l4.36 5.77L18.24 3zm-1.08 16.2h1.71L7.02 4.7H5.18l11.98 14.5z" />
        </svg>
      )
    case 'li':
      return (
        <svg {...common}>
          <path d="M6.94 8.5H3.75V21h3.19V8.5zM5.34 3C4.2 3 3.25 3.96 3.25 5.12c0 1.15.94 2.1 2.1 2.1 1.15 0 2.09-.95 2.09-2.1C7.44 3.96 6.5 3 5.34 3zM20.25 21h-3.18v-6.07c0-1.45-.03-3.31-2.02-3.31-2.02 0-2.33 1.58-2.33 3.2V21H9.35V8.5h3.05v1.71h.04c.42-.8 1.46-1.65 3-1.65 3.21 0 3.81 2.11 3.81 4.86V21z" />
        </svg>
      )
    case 'tg':
      return (
        <svg {...common}>
          <path d="M9.78 15.34 9.5 19.2c.4 0 .57-.17.78-.37l1.87-1.79 3.88 2.85c.71.39 1.22.19 1.41-.66l2.56-12.04h.01c.23-1.05-.38-1.46-1.07-1.21L3.7 10.12c-1.02.4-.98.96-.17 1.21l3.74 1.17 8.69-5.47c.41-.25.78-.11.47.14L9.78 15.34z" />
        </svg>
      )
    case 'copy':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12.5 9.5 17 19 7.5" />
        </svg>
      )
  }
}

function ShareBar({
  url,
  title,
  primary,
  compact,
}: {
  url: string
  title: string
  primary: string
  compact?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const actions = [
    {
      key: 'wa',
      label: 'WhatsApp',
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      icon: 'wa' as const,
    },
    {
      key: 'fb',
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: 'fb' as const,
    },
    {
      key: 'x',
      label: 'X',
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      icon: 'x' as const,
    },
    {
      key: 'li',
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: 'li' as const,
    },
    {
      key: 'tg',
      label: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      icon: 'tg' as const,
    },
  ]

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'justify-between'}`}>
      {!compact ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Bagikan</div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <a
            key={action.key}
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            title={action.label}
            aria-label={`Bagikan ke ${action.label}`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900"
          >
            <ShareIcon name={action.icon} />
          </a>
        ))}
        <button
          type="button"
          onClick={() => void copyLink()}
          title={copied ? 'Tautan disalin' : 'Salin tautan'}
          aria-label={copied ? 'Tautan disalin' : 'Salin tautan'}
          className="inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold shadow-sm transition hover:-translate-y-0.5"
          style={{
            borderColor: copied ? primary : 'rgb(226 232 240)',
            background: copied ? primary : '#fff',
            color: copied ? '#fff' : '#475569',
          }}
        >
          <ShareIcon name={copied ? 'check' : 'copy'} />
          {copied ? 'Disalin' : 'Salin tautan'}
        </button>
      </div>
    </div>
  )
}

/** In-template news detail view (no separate route yet). */
export function LandingNewsDetail({
  item,
  onBack,
  primary = '#272727',
  muted = '#64748b',
  preview,
  contentClassName = 'mx-auto w-full max-w-[760px] px-4 sm:px-6',
  fontHeading = 'Georgia, "Times New Roman", serif',
  brand,
}: Props) {
  const dateLabel = [item.day, item.month].filter(Boolean).join(' ')
  const html = prepareBlogHtml(item.body || item.excerpt || '')
  const readMinutes = useMemo(() => estimateReadMinutes(html), [html])
  const tags = (item.tags || '')
    .split(/[,|]/)
    .map((t) => t.trim())
    .filter(Boolean)
  const shareUrl = useMemo(() => buildShareUrl(item.id), [item.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('news', item.id)
    url.searchParams.delete('view')
    window.history.replaceState({}, '', url.toString())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [item.id])

  function handleBack() {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('news')
      window.history.replaceState({}, '', url.toString())
    }
    onBack()
  }

  return (
    <div className={`min-h-screen bg-[#fafafa] text-slate-900 ${preview ? 'pt-2' : ''}`}>
      <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className={`${contentClassName} flex h-14 items-center justify-between gap-3 sm:h-16`}>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <span aria-hidden className="text-lg leading-none">
              ←
            </span>
            Kembali
          </button>
          {brand ? (
            <div className="truncate text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">{brand}</div>
          ) : (
            <div className="truncate text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">Artikel</div>
          )}
        </div>
      </div>

      {item.image ? (
        <div className="relative overflow-hidden bg-slate-900">
          <div className="mx-auto max-w-[1100px]">
            <div className="relative aspect-[16/9] max-h-[520px] w-full sm:aspect-[21/9]">
              <img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-4 pb-8 pt-16 sm:px-8 sm:pb-10">
                <div className="mx-auto max-w-[760px]">
                  {tags.length ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <h1
                    className="max-w-3xl text-[28px] font-bold leading-[1.15] tracking-tight text-white sm:text-[40px] lg:text-[48px]"
                    style={{ fontFamily: fontHeading }}
                  >
                    {item.title}
                  </h1>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-b border-slate-200 bg-white">
          <div className={`${contentClassName} py-10 sm:py-14`}>
            {tags.length ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white"
                    style={{ background: primary }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <h1
              className="text-[30px] font-bold leading-[1.15] tracking-tight sm:text-[42px] lg:text-[48px]"
              style={{ color: primary, fontFamily: fontHeading }}
            >
              {item.title}
            </h1>
          </div>
        </div>
      )}

      <article className={`${contentClassName} py-8 sm:py-12`}>
        <div className="mb-8 flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]" style={{ color: muted }}>
            {dateLabel ? (
              <time className="font-semibold" style={{ color: primary }}>
                {dateLabel}
              </time>
            ) : null}
            {dateLabel ? <span className="text-slate-300">·</span> : null}
            <span>{readMinutes} menit baca</span>
            {brand ? (
              <>
                <span className="text-slate-300">·</span>
                <span>Oleh {brand}</span>
              </>
            ) : null}
          </div>
          <ShareBar url={shareUrl} title={item.title} primary={primary} compact />
        </div>

        {item.excerpt && item.excerpt.trim() && item.excerpt.trim() !== item.title.trim() ? (
          <p
            className="mb-8 border-l-[3px] pl-4 text-[18px] leading-relaxed sm:text-[20px]"
            style={{ borderColor: primary, color: muted, fontFamily: fontHeading }}
          >
            {item.excerpt}
          </p>
        ) : null}

        <div
          className="prose-storefront blog-editor-content news-article-body !min-h-0 !bg-transparent !p-0 text-[17px] leading-[1.8] sm:text-[18px]"
          style={{ color: '#334155' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <ShareBar url={shareUrl} title={item.title} primary={primary} />
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-[14px] font-semibold text-white shadow-sm transition hover:brightness-110"
            style={{ background: primary, fontFamily: fontHeading }}
          >
            Kembali ke beranda
          </button>
          <a
            href="#news"
            onClick={(e) => {
              e.preventDefault()
              handleBack()
            }}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-[14px] font-semibold text-slate-700 transition hover:border-slate-300"
          >
            Lihat artikel lain
          </a>
        </div>
      </article>

      <style>{`
        .news-article-body h2 {
          font-family: ${fontHeading};
          color: ${primary};
          font-size: 1.45rem;
          font-weight: 700;
          margin: 2rem 0 0.75rem;
          line-height: 1.25;
        }
        .news-article-body h3 {
          font-family: ${fontHeading};
          color: ${primary};
          font-size: 1.2rem;
          font-weight: 700;
          margin: 1.6rem 0 0.6rem;
        }
        .news-article-body p { margin: 0 0 1.15rem; }
        .news-article-body ul, .news-article-body ol { margin: 0 0 1.15rem; padding-left: 1.25rem; }
        .news-article-body li { margin: 0.35rem 0; }
        .news-article-body a { color: ${primary}; text-decoration: underline; text-underline-offset: 3px; }
        .news-article-body img { border-radius: 1rem; margin: 1.5rem 0; }
        .news-article-body blockquote {
          margin: 1.5rem 0;
          padding: 0.85rem 1rem;
          border-left: 3px solid ${primary};
          background: #fff;
          color: #475569;
          font-style: italic;
        }
      `}</style>
    </div>
  )
}

/** Open news from `?news=` deep link when present. */
export function useNewsDeepLink(
  news: LandingNewsItem[],
  setSelected: (item: LandingNewsItem | null) => void,
) {
  const newsKey = news.map((n) => n.id).join('|')
  useEffect(() => {
    if (typeof window === 'undefined' || !news.length) return
    const id = new URLSearchParams(window.location.search).get('news')
    if (!id) return
    const found = news.find((n) => n.id === id)
    if (found) setSelected(found)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reopen only when news ids change
  }, [newsKey, setSelected])
}

function clearNewsQuery() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('view')
  url.searchParams.delete('news')
  window.history.replaceState({}, '', url.toString())
}

function setNewsListQuery(open: boolean) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (open) {
    url.searchParams.set('view', 'news')
    url.searchParams.delete('news')
  } else {
    url.searchParams.delete('view')
  }
  window.history.replaceState({}, '', url.toString())
}

/** Shared home → list → detail navigation for storefront news. */
export function useLandingNewsNav(allNews: LandingNewsItem[]) {
  const [view, setView] = useState<LandingNewsView>('home')
  const [selected, setSelected] = useState<LandingNewsItem | null>(null)
  const fromListRef = useRef(false)
  const pendingSectionRef = useRef<string | null>(null)
  const newsKey = allNews.map((n) => n.id).join('|')

  useEffect(() => {
    if (typeof window === 'undefined' || !allNews.length) return
    const params = new URLSearchParams(window.location.search)
    const id = params.get('news')
    const list = params.get('view') === 'news'
    if (id) {
      const found = allNews.find((n) => n.id === id)
      if (found) {
        fromListRef.current = list
        setSelected(found)
        setView('detail')
        return
      }
    }
    if (list) {
      setSelected(null)
      setView('list')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsKey])

  useEffect(() => {
    if (view !== 'home' || !pendingSectionRef.current) return
    const href = pendingSectionRef.current
    pendingSectionRef.current = null
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToStorefrontSection(href)
      })
    })
  }, [view])

  function openList() {
    fromListRef.current = true
    setSelected(null)
    setView('list')
    setNewsListQuery(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openDetail(item: LandingNewsItem, fromList = false) {
    fromListRef.current = fromList || view === 'list'
    setSelected(item)
    setView('detail')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function backFromDetail() {
    setSelected(null)
    if (fromListRef.current) {
      setView('list')
      setNewsListQuery(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setView('home')
    setNewsListQuery(false)
  }

  function backFromList() {
    fromListRef.current = false
    setSelected(null)
    setView('home')
    setNewsListQuery(false)
  }

  function goHome() {
    fromListRef.current = false
    setSelected(null)
    setView('home')
    clearNewsQuery()
  }

  /** Leave news views if needed, then scroll to a home section. */
  function goSection(href: string) {
    const target = (href || '').trim() || '#top'
    if (view === 'home') {
      scrollToStorefrontSection(target)
      return
    }
    pendingSectionRef.current = target
    goHome()
  }

  return {
    view,
    selected,
    openList,
    openDetail,
    backFromDetail,
    backFromList,
    goHome,
    goSection,
  }
}

/** Parse `Label | URL` lines into social links (skip empty). */
export function parseSocialLinks(
  raw: string,
  fallback = 'Facebook | #\nTwitter | #\nInstagram | #\nYoutube | #',
): { label: string; href: string }[] {
  const source = raw.trim() ? raw : fallback
  return source
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe = line.indexOf('|')
      if (pipe < 0) return { label: line, href: '#' }
      return {
        label: line.slice(0, pipe).trim(),
        href: line.slice(pipe + 1).trim() || '#',
      }
    })
    .filter((l) => l.label)
}

/** Map API / render-model news posts into template detail cards. */
export function newsItemsFromModel(
  news: Array<{
    id?: number | string
    title?: string | null
    excerpt?: string | null
    body?: string | null
    image_url?: string | null
    tags?: string | null
    day?: string | null
    month?: string | null
    published_at?: string | null
  }> | null | undefined,
): LandingNewsItem[] {
  if (!news?.length) return []
  return news
    .filter((n) => (n.title ?? '').trim())
    .map((n, i) => {
      const title = (n.title ?? '').trim()
      const excerpt = (n.excerpt ?? '').trim()
      const body = (n.body ?? '').trim() || excerpt
      return {
        id: String(n.id ?? `news-${i + 1}`),
        title,
        excerpt,
        body,
        image: n.image_url || undefined,
        day: n.day || undefined,
        month: n.month || undefined,
        tags: n.tags || undefined,
        publishedAt: n.published_at || undefined,
      }
    })
}
