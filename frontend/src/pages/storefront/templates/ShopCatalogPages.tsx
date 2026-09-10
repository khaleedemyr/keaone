import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatRupiah } from '../../../lib/money'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import { useShop } from '../commerce/StorefrontShop'
import type { StorefrontRenderModel, StorefrontRenderProduct } from './renderTypes'

export type ShopCategoryCard = {
  categoryId: number
  label: string
  image?: string | null
  count: number
}

type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc'

function brandColors(model: StorefrontRenderModel) {
  return {
    primary: model.brand_colors?.primary || '#111111',
    muted: '#64748b',
    text: model.brand_colors?.text || '#171717',
  }
}

/** Build category cards from theme slots + product counts. */
export function shopCategoriesFromModel(model: StorefrontRenderModel): ShopCategoryCard[] {
  const products = (model.products ?? []).filter((p) => p.id > 0)
  const fromSlot = Array.isArray(model.theme_content?.categories) ? model.theme_content.categories : []
  const cards: ShopCategoryCard[] = []

  for (const row of fromSlot) {
    if (!row || typeof row !== 'object') continue
    const categoryId = 'category_id' in row ? Number(row.category_id) : 0
    if (!categoryId) continue
    const label =
      typeof row.label === 'string' && row.label.trim()
        ? row.label.trim()
        : `Kategori ${categoryId}`
    const image = typeof row.image === 'string' ? row.image : null
    const count = products.filter((p) => p.category_id === categoryId).length
    cards.push({ categoryId, label, image, count })
  }

  if (cards.length) return cards

  const byId = new Map<number, number>()
  for (const p of products) {
    if (!p.category_id) continue
    byId.set(p.category_id, (byId.get(p.category_id) || 0) + 1)
  }
  return Array.from(byId.entries()).map(([categoryId, count]) => ({
    categoryId,
    label: `Kategori ${categoryId}`,
    image: products.find((p) => p.category_id === categoryId)?.image_url || null,
    count,
  }))
}

function Shell({
  model,
  title,
  onBack,
  children,
  trailing,
}: {
  model: StorefrontRenderModel
  title: string
  onBack: () => void
  children: ReactNode
  trailing?: ReactNode
}) {
  const c = brandColors(model)
  return (
    <div className="min-h-screen bg-[#f7f7f5] text-slate-900 antialiased" style={{ color: c.text }}>
      {model.preview ? (
        <div className="sticky top-0 z-50 border-b border-amber-200/70 bg-amber-50 px-4 py-2 text-center text-[11px] text-amber-950">
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
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
          <div className="truncate text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {title}
          </div>
          {trailing || <div className="w-16" />}
        </div>
      </header>
      {children}
    </div>
  )
}

function ProductCard({
  product,
  primary,
  onOpen,
}: {
  product: StorefrontRenderProduct
  primary: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="aspect-[4/5] overflow-hidden bg-slate-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-end p-4" style={{ background: `linear-gradient(145deg, ${primary}, #0f172a)` }}>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Produk</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight">{product.name}</div>
        {product.description ? (
          <p className="mt-1 line-clamp-2 flex-1 text-[13px] leading-relaxed text-slate-500">{product.description}</p>
        ) : (
          <div className="flex-1" />
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[15px] font-bold" style={{ color: primary }}>
            {formatRupiah(product.price)}
          </span>
          <span className="text-[12px] font-semibold" style={{ color: primary }}>
            Lihat →
          </span>
        </div>
      </div>
    </button>
  )
}

export function ShopCategoriesPage({ model }: { model: StorefrontRenderModel }) {
  const shop = useShop()
  const c = brandColors(model)
  const categories = useMemo(() => shopCategoriesFromModel(model), [model])

  return (
    <Shell
      model={model}
      title="Kategori"
      onBack={() => shop?.openHome()}
      trailing={
        <button
          type="button"
          className="text-[12px] font-semibold"
          style={{ color: c.primary }}
          onClick={() => shop?.openCatalog()}
        >
          Semua produk
        </button>
      }
    >
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: c.primary }}>
          Belanja
        </p>
        <h1 className="mt-2 text-[28px] font-bold tracking-tight sm:text-[36px]">Semua kategori</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-slate-500">
          Pilih kategori untuk melihat produknya, atau buka katalog lengkap.
        </p>

        {categories.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-[16px] font-semibold">Belum ada kategori</p>
            <p className="mt-2 text-[14px] text-slate-500">Atur kategori di setup toko, atau buka semua produk.</p>
            <button
              type="button"
              className="mt-6 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white"
              style={{ background: c.primary }}
              onClick={() => shop?.openCatalog()}
            >
              Lihat semua produk
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <button
                key={cat.categoryId}
                type="button"
                onClick={() => shop?.openCatalog({ categoryId: cat.categoryId })}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                  {cat.image ? (
                    <img
                      src={cat.image}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="flex h-full items-end p-5"
                      style={{ background: `linear-gradient(145deg, ${c.primary}, #0f172a)` }}
                    >
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-white/70">
                        Kategori
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="text-[17px] font-bold tracking-tight">{cat.label}</div>
                  <div className="mt-1 text-[13px] text-slate-500">
                    {cat.count} produk · <span style={{ color: c.primary }}>Lihat →</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}

export function ShopCatalogPage({ model }: { model: StorefrontRenderModel }) {
  const shop = useShop()
  const c = brandColors(model)
  const categories = useMemo(() => shopCategoriesFromModel(model), [model])
  const allProducts = useMemo(() => (model.products ?? []).filter((p) => p.id > 0), [model.products])

  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<number | 'all'>(shop?.catalogCategoryId ?? 'all')
  const [flag, setFlag] = useState<'all' | 'deal' | 'new' | 'bestseller'>('all')
  const [sort, setSort] = useState<SortKey>('newest')

  useEffect(() => {
    setCategoryId(shop?.catalogCategoryId ?? 'all')
  }, [shop?.catalogCategoryId])

  const activeCategoryLabel =
    categoryId === 'all' ? null : categories.find((x) => x.categoryId === categoryId)?.label || null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = allProducts.filter((p) => {
      if (categoryId !== 'all' && p.category_id !== categoryId) return false
      if (flag === 'deal' && !p.is_deal) return false
      if (flag === 'new' && !p.is_new_arrival) return false
      if (flag === 'bestseller' && !p.is_bestseller) return false
      if (!q) return true
      const hay = `${p.name} ${p.description || ''}`.toLowerCase()
      return hay.includes(q)
    })
    list = [...list].sort((a, b) => {
      if (sort === 'price_asc') return a.price - b.price
      if (sort === 'price_desc') return b.price - a.price
      if (sort === 'name_asc') return a.name.localeCompare(b.name)
      if (sort === 'name_desc') return b.name.localeCompare(a.name)
      return b.id - a.id
    })
    return list
  }, [allProducts, categoryId, flag, query, sort])

  function selectCategory(next: number | 'all') {
    setCategoryId(next)
    shop?.openCatalog({ categoryId: next === 'all' ? null : next })
  }

  return (
    <Shell
      model={model}
      title={activeCategoryLabel || 'Katalog'}
      onBack={() => {
        if (shop?.catalogCategoryId) shop.openCategories()
        else shop?.openHome()
      }}
      trailing={
        <button
          type="button"
          className="text-[12px] font-semibold"
          style={{ color: c.primary }}
          onClick={() => shop?.openCategories()}
        >
          Kategori
        </button>
      }
    >
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: c.primary }}>
            {activeCategoryLabel ? 'Kategori' : 'Katalog'}
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-tight sm:text-[36px]">
            {activeCategoryLabel || 'Semua produk'}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-slate-500">
            Cari, filter, dan urutkan produk. Klik kartu untuk membuka detail.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Cari produk</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama atau deskripsi produk…"
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
                <option value="price_asc">Harga terendah</option>
                <option value="price_desc">Harga tertinggi</option>
                <option value="name_asc">Nama A–Z</option>
                <option value="name_desc">Nama Z–A</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectCategory('all')}
              className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition"
              style={
                categoryId === 'all'
                  ? { background: c.primary, color: '#fff' }
                  : { background: '#f1f5f9', color: '#475569' }
              }
            >
              Semua kategori
            </button>
            {categories.map((cat) => (
              <button
                key={cat.categoryId}
                type="button"
                onClick={() => selectCategory(cat.categoryId)}
                className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition"
                style={
                  categoryId === cat.categoryId
                    ? { background: c.primary, color: '#fff' }
                    : { background: '#f1f5f9', color: '#475569' }
                }
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', 'Semua'],
                ['deal', 'Promo'],
                ['new', 'Baru'],
                ['bestseller', 'Best seller'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFlag(key)}
                className="rounded-full border px-3 py-1 text-[12px] font-semibold transition"
                style={
                  flag === key
                    ? { borderColor: c.primary, color: c.primary, background: `${c.primary}12` }
                    : { borderColor: '#e2e8f0', color: '#64748b', background: '#fff' }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between gap-3 text-[13px] text-slate-500">
          <span>
            Menampilkan <strong className="text-slate-800">{filtered.length}</strong> dari {allProducts.length}{' '}
            produk
          </span>
          {query || categoryId !== 'all' || flag !== 'all' ? (
            <button
              type="button"
              className="font-semibold hover:underline"
              style={{ color: c.primary }}
              onClick={() => {
                setQuery('')
                setFlag('all')
                selectCategory('all')
              }}
            >
              Reset filter
            </button>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-[16px] font-semibold">Tidak ada produk yang cocok</p>
            <p className="mt-2 text-[14px] text-slate-500">Coba ubah pencarian, kategori, atau filter.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                primary={c.primary}
                onOpen={() => shop?.openProduct(product)}
              />
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}
