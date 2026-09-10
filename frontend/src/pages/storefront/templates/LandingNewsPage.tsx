import { useMemo, useState } from 'react'
import type { LandingNewsItem } from './LandingNewsDetail'

type SortKey = 'newest' | 'oldest' | 'title_asc' | 'title_desc'

type Props = {
  items: LandingNewsItem[]
  onSelect: (item: LandingNewsItem) => void
  onBack: () => void
  primary?: string
  muted?: string
  preview?: boolean
  contentClassName?: string
  fontHeading?: string
  brand?: string
  title?: string
  kicker?: string
}

function parseTags(raw?: string): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[,|]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function estimateReadMinutes(item: LandingNewsItem): number {
  const text = `${item.excerpt || ''} ${item.body || ''}`
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = text ? text.split(' ').length : 0
  return Math.max(1, Math.round(words / 200) || 1)
}

function sortStamp(item: LandingNewsItem): number {
  if (item.publishedAt) {
    const t = Date.parse(item.publishedAt)
    if (!Number.isNaN(t)) return t
  }
  const monthMap: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  }
  const day = Number(item.day) || 0
  const monthKey = (item.month || '').toLowerCase().replace(/\./g, '')
  const month = monthMap[monthKey]
  if (month != null) {
    const year = new Date().getFullYear()
    return new Date(year, month, day || 1).getTime()
  }
  return 0
}

function dateLabel(item: LandingNewsItem): string {
  const parts = [item.day, item.month].filter(Boolean)
  if (parts.length) return parts.join(' ')
  if (item.publishedAt) {
    const d = new Date(item.publishedAt)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    }
  }
  return ''
}

export function LandingNewsPage({
  items,
  onSelect,
  onBack,
  primary = '#272727',
  muted = '#64748b',
  preview,
  contentClassName = 'mx-auto w-full max-w-[1180px] px-4 sm:px-6',
  fontHeading = 'Georgia, "Times New Roman", serif',
  brand,
  title = 'Semua artikel',
  kicker = 'Blog & News',
}: Props) {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('newest')

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) {
      for (const t of parseTags(item.tags)) set.add(t)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = items.filter((item) => {
      const tags = parseTags(item.tags)
      if (tag !== 'all' && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return false
      if (!q) return true
      const hay = `${item.title} ${item.excerpt} ${item.tags || ''}`.toLowerCase()
      return hay.includes(q)
    })

    list = [...list].sort((a, b) => {
      if (sort === 'title_asc') return a.title.localeCompare(b.title)
      if (sort === 'title_desc') return b.title.localeCompare(a.title)
      const da = sortStamp(a)
      const db = sortStamp(b)
      if (sort === 'oldest') return da - db || a.title.localeCompare(b.title)
      return db - da || a.title.localeCompare(b.title)
    })
    return list
  }, [items, query, tag, sort])

  return (
    <div className={`min-h-screen bg-[#f7f7f5] text-slate-900 ${preview ? 'pt-2' : ''}`}>
      <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className={`${contentClassName} flex h-14 items-center justify-between gap-3 sm:h-16`}>
          <button
            type="button"
            onClick={onBack}
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
            <div className="truncate text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">News</div>
          )}
        </div>
      </div>

      <header className="border-b border-slate-200 bg-white">
        <div className={`${contentClassName} py-10 sm:py-14`}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: primary }}>
            {kicker}
          </p>
          <h1
            className="mt-3 max-w-3xl text-[32px] font-bold leading-[1.1] tracking-tight sm:text-[44px]"
            style={{ fontFamily: fontHeading, color: primary }}
          >
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed sm:text-[16px]" style={{ color: muted }}>
            Jelajahi semua berita dan artikel. Filter berdasarkan topik, urutkan, lalu buka detail untuk dibaca atau
            dibagikan.
          </p>
        </div>
      </header>

      <div className={`${contentClassName} py-8 sm:py-10`}>
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Cari artikel</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari judul, ringkasan, atau tag…"
                className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 px-4 text-[14px] outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </label>
            <label className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
              <span className="whitespace-nowrap">Urutkan</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-11 min-w-[180px] rounded-full border border-slate-200 bg-white px-3 text-[13px] outline-none"
              >
                <option value="newest">Terbaru</option>
                <option value="oldest">Terlama</option>
                <option value="title_asc">Judul A–Z</option>
                <option value="title_desc">Judul Z–A</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTag('all')}
              className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition"
              style={
                tag === 'all'
                  ? { background: primary, color: '#fff' }
                  : { background: '#f1f5f9', color: '#475569' }
              }
            >
              Semua
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(t)}
                className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition"
                style={
                  tag.toLowerCase() === t.toLowerCase()
                    ? { background: primary, color: '#fff' }
                    : { background: '#f1f5f9', color: '#475569' }
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between gap-3 text-[13px]" style={{ color: muted }}>
          <span>
            Menampilkan <strong className="text-slate-800">{filtered.length}</strong> dari {items.length} artikel
          </span>
          {query || tag !== 'all' ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setTag('all')
              }}
              className="font-semibold hover:underline"
              style={{ color: primary }}
            >
              Reset filter
            </button>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-[16px] font-semibold text-slate-800">Tidak ada artikel yang cocok</p>
            <p className="mt-2 text-[14px]" style={{ color: muted }}>
              Coba ubah kata kunci, tag, atau urutan.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => {
              const tags = parseTags(item.tags).slice(0, 3)
              const label = dateLabel(item)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {item.image ? (
                    <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                      <img
                        src={item.image}
                        alt=""
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div
                      className="flex aspect-[16/10] items-end p-5"
                      style={{
                        background: `linear-gradient(145deg, ${primary} 0%, #0f172a 100%)`,
                      }}
                    >
                      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">
                        {brand || 'Artikel'}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    {tags.length ? (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{ background: `${primary}14`, color: primary }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <h2
                      className="line-clamp-2 text-[18px] font-bold leading-snug tracking-tight sm:text-[19px]"
                      style={{ fontFamily: fontHeading, color: primary }}
                    >
                      {item.title}
                    </h2>
                    {item.excerpt ? (
                      <p className="mt-2 line-clamp-2 flex-1 text-[14px] leading-relaxed" style={{ color: muted }}>
                        {item.excerpt}
                      </p>
                    ) : (
                      <div className="flex-1" />
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium" style={{ color: muted }}>
                      {label ? <span>{label}</span> : null}
                      {label ? <span className="text-slate-300">·</span> : null}
                      <span>{estimateReadMinutes(item)} mnt baca</span>
                      <span className="text-slate-300">·</span>
                      <span style={{ color: primary }}>Baca →</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
