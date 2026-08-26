import { useEffect, useMemo, useState } from 'react'
import { formatDate, formatRupiah } from '../lib/money'
import { exportEngineeringExcel, exportEngineeringPdf } from '../lib/engineeringExport'
import { useI18n } from '../i18n'
import type { EngineeringCategory, EngineeringGrandTotal } from '../types'

function share(part: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

function filterCategories(categories: EngineeringCategory[], query: string): EngineeringCategory[] {
  const q = query.trim().toLowerCase()
  if (!q) return categories

  return categories
    .map((category) => {
      const categoryMatch = category.category_name.toLowerCase().includes(q)
      const products = categoryMatch
        ? category.products
        : category.products.filter((product) => product.name.toLowerCase().includes(q))
      if (products.length === 0) return null

      return {
        ...category,
        products,
        qty: products.reduce((sum, product) => sum + product.qty, 0),
        discount: products.reduce((sum, product) => sum + product.discount, 0),
        revenue: products.reduce((sum, product) => sum + product.revenue, 0),
      }
    })
    .filter((category): category is EngineeringCategory => category !== null)
}

function sumGrandTotal(categories: EngineeringCategory[]): EngineeringGrandTotal {
  return categories.reduce(
    (acc, category) => ({
      qty: acc.qty + category.qty,
      discount: acc.discount + category.discount,
      revenue: acc.revenue + category.revenue,
    }),
    { qty: 0, discount: 0, revenue: 0 },
  )
}

export function EngineeringReport({
  from,
  to,
  categories,
  grandTotal,
}: {
  from: string
  to: string
  categories: EngineeringCategory[]
  grandTotal: EngineeringGrandTotal
}) {
  const { t, locale } = useI18n()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  const filteredCategories = useMemo(() => filterCategories(categories, search), [categories, search])
  const displayGrandTotal = useMemo(
    () => (search.trim() ? sumGrandTotal(filteredCategories) : grandTotal),
    [search, filteredCategories, grandTotal],
  )

  useEffect(() => {
    setExpanded(Object.fromEntries(categories.map((category) => [category.category_id, true])))
  }, [categories])

  useEffect(() => {
    if (!search.trim()) return
    setExpanded(Object.fromEntries(filteredCategories.map((category) => [category.category_id, true])))
  }, [search, filteredCategories])

  const revenueTotal = displayGrandTotal.revenue
  const allExpanded = useMemo(
    () => filteredCategories.length > 0 && filteredCategories.every((category) => expanded[category.category_id] !== false),
    [filteredCategories, expanded],
  )

  const exportLabels = useMemo(
    () => ({
      title: t('salesReportProducts'),
      period: `${formatDate(from, locale)} — ${formatDate(to, locale)}`,
      category: t('category'),
      product: t('product'),
      qty: t('posColQty'),
      discount: t('receiptDiscount'),
      revenue: t('cardRevenue'),
      share: t('salesReportShare'),
      subtotal: t('salesReportEngineeringSubtotal'),
      grandTotal: t('salesReportGrandTotal'),
    }),
    [from, to, locale, t],
  )

  const filename = `report-engineering-${from}-${to}`

  function toggleCategory(categoryId: number) {
    setExpanded((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }))
  }

  function setAll(open: boolean) {
    setExpanded(Object.fromEntries(filteredCategories.map((category) => [category.category_id, open])))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="min-w-[14rem] flex-1 text-xs text-muted sm:max-w-xs">
          {t('search')}
          <input
            type="search"
            className="field mt-1 py-2"
            placeholder={t('searchEngineeringItem')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" className="btn-ghost py-2 text-xs" onClick={() => setAll(!allExpanded)}>
          {allExpanded ? t('collapseAll') : t('expandAll')}
        </button>
        <button
          type="button"
          className="btn-ghost py-2 text-xs"
          disabled={filteredCategories.length === 0}
          onClick={() => exportEngineeringExcel(filteredCategories, displayGrandTotal, exportLabels, filename)}
        >
          {t('exportExcel')}
        </button>
        <button
          type="button"
          className="btn-ghost py-2 text-xs"
          disabled={filteredCategories.length === 0}
          onClick={() =>
            exportEngineeringPdf(filteredCategories, displayGrandTotal, exportLabels, filename, (value) =>
              formatRupiah(value, locale),
            )
          }
        >
          {t('exportPdf')}
        </button>
        </div>
      </div>

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('category')} / {t('product')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('posColQty')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('receiptDiscount')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('cardRevenue')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('salesReportShare')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredCategories.map((category) => {
              const open = expanded[category.category_id] !== false
              return (
                <CategoryBlock
                  key={category.category_id}
                  category={category}
                  open={open}
                  revenueTotal={revenueTotal}
                  locale={locale}
                  subtotalLabel={t('salesReportEngineeringSubtotal')}
                  onToggle={() => toggleCategory(category.category_id)}
                />
              )
            })}
            {filteredCategories.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={5}>
                  {categories.length === 0 ? t('salesReportEmpty') : t('searchEngineeringEmpty')}
                </td>
              </tr>
            ) : (
              <tr className="border-t-2 border-line bg-fill/40 font-semibold">
                <td className="px-4 py-3">{t('salesReportGrandTotal')}</td>
                <td className="px-4 py-3 text-right tabular-nums">{displayGrandTotal.qty}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(displayGrandTotal.discount, locale)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-mint">{formatRupiah(displayGrandTotal.revenue, locale)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">100%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CategoryBlock({
  category,
  open,
  revenueTotal,
  locale,
  subtotalLabel,
  onToggle,
}: {
  category: EngineeringCategory
  open: boolean
  revenueTotal: number
  locale: string
  subtotalLabel: string
  onToggle: () => void
}) {
  return (
    <>
      <tr className="border-t border-line bg-fill/20">
        <td className="px-4 py-3" colSpan={5}>
          <button type="button" className="flex w-full items-center gap-2 text-left font-semibold" onClick={onToggle}>
            <Chevron open={open} />
            <span>{category.category_name}</span>
            {!open ? (
              <span className="ml-auto flex flex-wrap items-center gap-4 text-xs font-normal text-muted">
                <span>{category.qty} qty</span>
                <span className="text-mint">{formatRupiah(category.revenue, locale)}</span>
                <span>{share(category.revenue, revenueTotal)}</span>
              </span>
            ) : null}
          </button>
        </td>
      </tr>
      {open
        ? category.products.map((product, index) => (
            <tr key={`${product.product_id ?? product.name}-${index}`} className="border-t border-line/60">
              <td className="px-4 py-2.5 pl-10">{product.name}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{product.qty}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatRupiah(product.discount, locale)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-mint">{formatRupiah(product.revenue, locale)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted">{share(product.revenue, revenueTotal)}</td>
            </tr>
          ))
        : null}
      <tr className="border-t border-line bg-fill/10 text-xs font-medium uppercase tracking-wide text-muted">
        <td className="px-4 py-2 pl-10">{subtotalLabel}</td>
        <td className="px-4 py-2 text-right tabular-nums text-fg">{category.qty}</td>
        <td className="px-4 py-2 text-right tabular-nums text-fg">{formatRupiah(category.discount, locale)}</td>
        <td className="px-4 py-2 text-right tabular-nums text-mint">{formatRupiah(category.revenue, locale)}</td>
        <td className="px-4 py-2 text-right tabular-nums">{share(category.revenue, revenueTotal)}</td>
      </tr>
    </>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden
    >
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  )
}
