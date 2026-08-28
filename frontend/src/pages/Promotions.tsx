import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../api/client'
import { logMasterForm } from '../api/activity'
import { formatRupiah } from '../lib/money'
import { formatPromotionLabel } from '../lib/promoCalc'
import type { ApiOk, Category, ProductOption, Promotion, PromotionConfig } from '../types'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../components/MasterModal'
import { SearchMultiSelect } from '../components/SearchMultiSelect'
import { useI18n, type MsgKey } from '../i18n'
import { useAccess } from '../access'

function formatPromoType(type: Promotion['type'], t: (key: MsgKey) => string) {
  if (type === 'percent') return t('promoTypePercent')
  if (type === 'fixed') return t('promoTypeFixed')
  if (type === 'bogo') return t('promoTypeBogo')
  return t('promoTypeBundle')
}

function formatDateTime(value: string | null, locale: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString(locale)
}

export default function Promotions() {
  const { t, locale } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<Promotion[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState<Promotion['type']>('percent')
  const [value, setValue] = useState('10')
  const [scope, setScope] = useState<'item' | 'sale'>('sale')
  const [maxDiscount, setMaxDiscount] = useState('')
  const [minSubtotal, setMinSubtotal] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [code, setCode] = useState('')
  const [applyMode, setApplyMode] = useState<'manual' | 'auto'>('manual')
  const [priority, setPriority] = useState('0')
  const [productIds, setProductIds] = useState<number[]>([])
  const [buyProductIds, setBuyProductIds] = useState<number[]>([])
  const [getProductIds, setGetProductIds] = useState<number[]>([])
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [buyQty, setBuyQty] = useState('1')
  const [getQty, setGetQty] = useState('1')
  const [bundlePrice, setBundlePrice] = useState('')
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [viewing, setViewing] = useState<Promotion | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { data } = await api.get<ApiOk<Promotion[]>>('/promotions', {
        params: {
          search: list.search || undefined,
          status: list.status,
          page: list.page,
          per_page: list.perPage,
        },
      })
      setItems(data.data)
      list.applyMeta(data.meta, data.data.length)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load()
    }, 200)
    return () => window.clearTimeout(handle)
  }, [list.search, list.status, list.page, list.perPage])

  useEffect(() => {
    void api
      .get<ApiOk<ProductOption[]>>('/products', { params: { for_select: 1, status: 'all' }, silent: true })
      .then(({ data }) => {
        const rows = Array.isArray(data.data) ? data.data : []
        setProducts(rows.filter((item) => item.is_active !== false))
      })
      .catch((err) => {
        setProducts([])
        feedback.error(apiMessage(err, t('loadFailed')))
      })
    void api
      .get<ApiOk<Category[]>>('/categories', { params: { for_select: 1, status: 'all' }, silent: true })
      .then(({ data }) => {
        const rows = Array.isArray(data.data) ? data.data : []
        setCategories(rows.filter((item) => item.is_active !== false))
      })
      .catch(() => setCategories([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when opening Master Promo
  }, [])

  const productOptions = useMemo(
    () =>
      products.map((item) => ({
        value: String(item.id),
        label: item.sku ? `${item.name} (${item.sku})` : item.name,
        keywords: `${item.name} ${item.sku ?? ''}`,
      })),
    [products],
  )

  const categoryOptions = useMemo(
    () =>
      categories.map((item) => ({
        value: String(item.id),
        label: item.name,
        keywords: item.name,
      })),
    [categories],
  )

  function resetForm() {
    setName('')
    setType('percent')
    setValue('10')
    setScope('sale')
    setMaxDiscount('')
    setMinSubtotal('')
    setStartsAt('')
    setEndsAt('')
    setCode('')
    setApplyMode('manual')
    setPriority('0')
    setProductIds([])
    setBuyProductIds([])
    setGetProductIds([])
    setCategoryIds([])
    setBuyQty('1')
    setGetQty('1')
    setBundlePrice('')
  }

  function openCreate() {
    setEditing(null)
    resetForm()
    setError('')
    setOpen(true)
    logMasterForm('promotion', 'create')
  }

  function openEdit(item: Promotion) {
    const config = item.config ?? {}
    setEditing(item)
    setName(item.name)
    setType(item.type)
    setValue(String(item.value))
    setScope(item.scope)
    setMaxDiscount(item.max_discount ? String(item.max_discount) : '')
    setMinSubtotal(item.min_subtotal ? String(item.min_subtotal) : '')
    setStartsAt(item.starts_at ? item.starts_at.slice(0, 16) : '')
    setEndsAt(item.ends_at ? item.ends_at.slice(0, 16) : '')
    setCode(item.code ?? '')
    setApplyMode(item.apply_mode)
    setPriority(String(item.priority))
    const relatedIds = item.products?.map((row) => row.id) ?? []
    setProductIds(relatedIds)
    setBuyProductIds(config.buy_product_ids?.length ? config.buy_product_ids.map(Number) : relatedIds)
    setGetProductIds(config.get_product_ids?.length ? config.get_product_ids.map(Number) : [])
    setCategoryIds(item.categories?.map((row) => row.id) ?? [])
    setBuyQty(String(config.buy_qty ?? 1))
    setGetQty(String(config.get_qty ?? 1))
    setBundlePrice(String(config.bundle_price ?? item.value ?? ''))
    setError('')
    setOpen(true)
    logMasterForm('promotion', 'edit', item.name)
  }

  function buildConfig(): PromotionConfig | null {
    if (type === 'bogo') {
      return {
        buy_qty: Number(buyQty),
        get_qty: Number(getQty),
        buy_product_ids: buyProductIds,
        get_product_ids: getProductIds,
      }
    }
    if (type === 'bundle') {
      return {
        bundle_price: Number(bundlePrice),
        items: productIds.map((productId) => ({ product_id: productId, qty: 1 })),
      }
    }
    return null
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const syncedProductIds =
        type === 'bogo'
          ? Array.from(new Set([...buyProductIds, ...getProductIds]))
          : productIds
      const payload = {
        name,
        type,
        value: type === 'bundle' ? Number(bundlePrice || value) : Number(value),
        scope: type === 'bogo' || type === 'bundle' ? 'item' : scope,
        max_discount: maxDiscount ? Number(maxDiscount) : null,
        min_subtotal: minSubtotal ? Number(minSubtotal) : null,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        code: code.trim() || null,
        apply_mode: applyMode,
        priority: Number(priority || 0),
        config: buildConfig(),
        product_ids: syncedProductIds,
        category_ids: type === 'bogo' ? [] : categoryIds,
      }
      if (editing) await api.put(`/promotions/${editing.id}`, payload)
      else await api.post('/promotions', payload)
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: Promotion) {
    const ok = await feedback.confirm({
      title: t('deletePromotionTitle'),
      message: t('deleteConfirm', { name: item.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/promotions/${item.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(item: Promotion) {
    try {
      await api.put(`/promotions/${item.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  const canEdit = can('promotions', 'edit')
  const canDelete = can('promotions', 'delete')
  const showActions = canEdit || canDelete
  const showValueFields = type === 'percent' || type === 'fixed'
  const showScope = showValueFields

  return (
    <div>
      <PageHeader
        eyebrow={t('productsEyebrow')}
        title={t('navPromotions')}
        subtitle={t('promotionsSubtitle')}
        action={
          can('promotions', 'create') ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              {t('addPromotion')}
            </button>
          ) : undefined
        }
      />

      <MasterFilters {...list.filters} searchPlaceholder={t('searchPromotion')} />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('promoType')}</th>
              <th className="px-4 py-3 font-medium">{t('promoApplyMode')}</th>
              <th className="px-4 py-3 font-medium">{t('promoPeriod')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              {showActions ? <th className="px-4 py-3 font-medium"></th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line hover:bg-fill">
                <td className="px-4 py-3">
                  <MasterNameButton onClick={() => setViewing(item)}>{item.name}</MasterNameButton>
                  {item.code ? <div className="text-xs text-muted">{item.code}</div> : null}
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatPromoType(item.type, t)}
                  <div className="text-xs tabular-nums text-fg">
                    {formatPromotionLabel(item, (amount) => formatRupiah(amount, locale))}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">
                  {item.apply_mode === 'auto' ? t('promoApplyAuto') : t('promoApplyManual')}
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {formatDateTime(item.starts_at, locale)} — {formatDateTime(item.ends_at, locale)}
                </td>
                <td className="px-4 py-3">
                  <span className={item.is_active ? 'text-mint' : 'text-rose-300'}>
                    {item.is_active ? t('active') : t('inactive')}
                  </span>
                </td>
                {showActions ? (
                  <td className="px-4 py-3 text-right">
                    {canEdit ? (
                      <button type="button" className="mr-3 text-mint" onClick={() => openEdit(item)}>
                        {t('edit')}
                      </button>
                    ) : null}
                    {item.is_active && canDelete ? (
                      <button type="button" className="text-rose-300" onClick={() => void remove(item)}>
                        {t('delete')}
                      </button>
                    ) : null}
                    {!item.is_active && canEdit ? (
                      <button type="button" className="text-mint" onClick={() => void activate(item)}>
                        {t('activate')}
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={showActions ? 6 : 5}>
                  {t('emptyMaster')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterModal
        open={open}
        title={editing ? t('editPromotion') : t('newPromotion')}
        error={error}
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
      >
        <label className="text-sm text-muted">
          {t('name')}
          <input required className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-sm text-muted">
          {t('promoType')}
          <select className="field" value={type} onChange={(e) => setType(e.target.value as Promotion['type'])}>
            <option value="percent">{t('promoTypePercent')}</option>
            <option value="fixed">{t('promoTypeFixed')}</option>
            <option value="bogo">{t('promoTypeBogo')}</option>
            <option value="bundle">{t('promoTypeBundle')}</option>
          </select>
        </label>
        {showValueFields ? (
          <label className="text-sm text-muted">
            {type === 'percent' ? t('discountPercentValue') : t('discountFixedValue')}
            <input
              required
              type="number"
              min={1}
              max={type === 'percent' ? 100 : undefined}
              className="field"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
        ) : null}
        {showScope ? (
          <label className="text-sm text-muted">
            {t('discountScope')}
            <select className="field" value={scope} onChange={(e) => setScope(e.target.value as 'item' | 'sale')}>
              <option value="sale">{t('discountScopeSale')}</option>
              <option value="item">{t('discountScopeItem')}</option>
            </select>
          </label>
        ) : null}
        {type === 'bogo' ? (
          <>
            <label className="text-sm text-muted">
              {t('promoBuyQty')}
              <input required type="number" min={1} className="field" value={buyQty} onChange={(e) => setBuyQty(e.target.value)} />
            </label>
            <label className="text-sm text-muted">
              {t('promoGetQty')}
              <input required type="number" min={1} className="field" value={getQty} onChange={(e) => setGetQty(e.target.value)} />
            </label>
            <label className="text-sm text-muted">
              {t('promoBuyProducts')}
              <SearchMultiSelect
                values={buyProductIds.map(String)}
                onChange={(next) => setBuyProductIds(next.map(Number).filter((id) => Number.isFinite(id)))}
                options={productOptions}
                placeholder={t('promoSelectBuyProducts')}
                searchPlaceholder={t('searchProduct')}
              />
            </label>
            <label className="text-sm text-muted">
              {t('promoGetProducts')}
              <SearchMultiSelect
                values={getProductIds.map(String)}
                onChange={(next) => setGetProductIds(next.map(Number).filter((id) => Number.isFinite(id)))}
                options={productOptions}
                placeholder={t('promoSelectGetProducts')}
                searchPlaceholder={t('searchProduct')}
              />
              <span className="mt-1 block text-xs text-muted">{t('promoBogoGetHint')}</span>
            </label>
          </>
        ) : null}
        {type === 'bundle' ? (
          <label className="text-sm text-muted">
            {t('promoBundlePrice')}
            <input required type="number" min={0} className="field" value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} />
          </label>
        ) : null}
        <label className="text-sm text-muted">
          {t('promoCode')}
          <input className="field" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t('promoCodeHint')} />
        </label>
        <label className="text-sm text-muted">
          {t('promoApplyMode')}
          <select className="field" value={applyMode} onChange={(e) => setApplyMode(e.target.value as 'manual' | 'auto')}>
            <option value="manual">{t('promoApplyManual')}</option>
            <option value="auto">{t('promoApplyAuto')}</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          {t('promoPriority')}
          <input type="number" min={0} className="field" value={priority} onChange={(e) => setPriority(e.target.value)} />
        </label>
        <label className="text-sm text-muted">
          {t('promoStartsAt')}
          <input type="datetime-local" className="field" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label className="text-sm text-muted">
          {t('promoEndsAt')}
          <input type="datetime-local" className="field" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
        {type === 'percent' ? (
          <label className="text-sm text-muted">
            {t('discountMax')}
            <input type="number" min={0} className="field" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} />
          </label>
        ) : null}
        <label className="text-sm text-muted">
          {t('discountMinSubtotal')}
          <input type="number" min={0} className="field" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} />
        </label>
        {type !== 'bogo' ? (
          <>
            <label className="text-sm text-muted">
              {t('promoTargetProducts')}
              <SearchMultiSelect
                values={productIds.map(String)}
                onChange={(next) => setProductIds(next.map(Number).filter((id) => Number.isFinite(id)))}
                options={productOptions}
                placeholder={t('promoSelectProducts')}
                searchPlaceholder={t('searchProduct')}
              />
            </label>
            <label className="text-sm text-muted">
              {t('promoTargetCategories')}
              <SearchMultiSelect
                values={categoryIds.map(String)}
                onChange={(next) => setCategoryIds(next.map(Number).filter((id) => Number.isFinite(id)))}
                options={categoryOptions}
                placeholder={t('promoSelectCategories')}
                searchPlaceholder={t('searchCategory')}
              />
            </label>
          </>
        ) : null}
      </MasterModal>

      <MasterViewModal
        open={Boolean(viewing)}
        title={t('viewRecord')}
        onClose={() => setViewing(null)}
        onEdit={
          viewing && canEdit
            ? () => {
                const item = viewing
                setViewing(null)
                openEdit(item)
              }
            : undefined
        }
      >
        <ViewField label={t('name')} value={viewing?.name} />
        <ViewField label={t('promoType')} value={viewing ? formatPromoType(viewing.type, t) : undefined} />
        <ViewField
          label={t('promoValue')}
          value={viewing ? formatPromotionLabel(viewing, (amount) => formatRupiah(amount, locale)) : undefined}
        />
        {viewing?.type === 'bogo' ? (
          <>
            <ViewField
              label={t('promoBuyProducts')}
              value={
                (viewing.config?.buy_product_ids?.length
                  ? products.filter((p) => viewing.config?.buy_product_ids?.includes(p.id))
                  : viewing.products ?? []
                )
                  .map((p) => p.name)
                  .join(', ') || '—'
              }
            />
            <ViewField
              label={t('promoGetProducts')}
              value={
                viewing.config?.get_product_ids?.length
                  ? products
                      .filter((p) => viewing.config?.get_product_ids?.includes(p.id))
                      .map((p) => p.name)
                      .join(', ') || '—'
                  : '—'
              }
            />
          </>
        ) : null}
        <ViewField label={t('promoCode')} value={viewing?.code ?? '—'} />
        <ViewField
          label={t('promoApplyMode')}
          value={viewing ? (viewing.apply_mode === 'auto' ? t('promoApplyAuto') : t('promoApplyManual')) : undefined}
        />
        <ViewField label={t('promoStartsAt')} value={viewing ? formatDateTime(viewing.starts_at, locale) : undefined} />
        <ViewField label={t('promoEndsAt')} value={viewing ? formatDateTime(viewing.ends_at, locale) : undefined} />
        <ViewField label={t('status')} value={viewing?.is_active ? t('active') : t('inactive')} />
      </MasterViewModal>
    </div>
  )
}
