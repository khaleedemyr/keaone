import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useAccess } from '../../access'
import { useI18n } from '../../i18n'
import type { ApiOk, Outlet, PriceChannel, Warehouse } from '../../types'
import { ShopChrome, StorefrontShopProvider } from './commerce/StorefrontShop'
import { mergeThemeContent, themeForTemplateSwitch } from './lib/themeDefaults'
import { StorefrontTemplatePreview } from './StorefrontTemplatePreview'
import { StorefrontThemeFields } from './StorefrontThemeFields'
import { openStorefrontPreview } from './previewDraft'
import { StorefrontSite, type StorefrontRenderModel, type StorefrontRenderNews, type StorefrontRenderProduct } from './templates/StorefrontSite'
import type {
  StorefrontAdmin,
  StorefrontBankAccount,
  StorefrontNewsPostRow,
  StorefrontProductRow,
  StorefrontShipping,
  StorefrontShippingDestination,
  StorefrontSiteKind,
  StorefrontStockMode,
  StorefrontThemeContent,
} from './types'

type BrandColors = {
  primary: string
  accent: string
  background: string
  text: string
}

const COURIER_OPTIONS: Array<{ code: string; name: string }> = [
  { code: 'jne', name: 'JNE' },
  { code: 'sicepat', name: 'SiCepat' },
  { code: 'jnt', name: 'J&T' },
  { code: 'tiki', name: 'TIKI' },
  { code: 'pos', name: 'POS Indonesia' },
  { code: 'anteraja', name: 'AnterAja' },
  { code: 'wahana', name: 'Wahana' },
  { code: 'ninja', name: 'Ninja Xpress' },
]

type SetupPanelId = 'brand' | 'content' | 'preview'
type SetupCollapsed = Record<SetupPanelId, boolean>

const SETUP_PANELS_KEY = 'keaone.storefront.setupPanels'
const DEFAULT_SETUP_COLLAPSED: SetupCollapsed = { brand: false, content: false, preview: false }

function readSetupCollapsed(): SetupCollapsed {
  try {
    const raw = localStorage.getItem(SETUP_PANELS_KEY)
    if (!raw) return { ...DEFAULT_SETUP_COLLAPSED }
    const parsed = JSON.parse(raw) as Partial<SetupCollapsed>
    const next: SetupCollapsed = {
      brand: !!parsed.brand,
      content: !!parsed.content,
      preview: !!parsed.preview,
    }
    if (next.brand && next.content && next.preview) return { ...DEFAULT_SETUP_COLLAPSED }
    return next
  } catch {
    return { ...DEFAULT_SETUP_COLLAPSED }
  }
}

/** Col spans for open/collapsed panels (1 = open). Collapsed panels keep a slim rail. */
function setupPanelSpans(c: SetupCollapsed): Record<SetupPanelId, string> {
  const key = `${Number(!c.brand)}${Number(!c.content)}${Number(!c.preview)}`
  const map: Record<string, Record<SetupPanelId, string>> = {
    '111': { brand: 'xl:col-span-3', content: 'xl:col-span-4', preview: 'xl:col-span-5' },
    '011': { brand: 'xl:col-span-1', content: 'xl:col-span-5', preview: 'xl:col-span-6' },
    '101': { brand: 'xl:col-span-5', content: 'xl:col-span-1', preview: 'xl:col-span-6' },
    '110': { brand: 'xl:col-span-4', content: 'xl:col-span-7', preview: 'xl:col-span-1' },
    '100': { brand: 'xl:col-span-10', content: 'xl:col-span-1', preview: 'xl:col-span-1' },
    '010': { brand: 'xl:col-span-1', content: 'xl:col-span-10', preview: 'xl:col-span-1' },
    '001': { brand: 'xl:col-span-1', content: 'xl:col-span-1', preview: 'xl:col-span-10' },
  }
  return map[key] ?? map['111']!
}

export default function StorefrontSetup() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const canEdit = can('storefrontsetup', 'edit')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)
  const [error, setError] = useState('')
  const [siteKind, setSiteKind] = useState<StorefrontSiteKind>('landing')
  const [templateKey, setTemplateKey] = useState('landing_dilabs')
  const [status, setStatus] = useState('draft')
  const [title, setTitle] = useState('')
  const [tagline, setTagline] = useState('')
  const [about, setAbout] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactAddress, setContactAddress] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [outletId, setOutletId] = useState<number | ''>('')
  const [warehouseId, setWarehouseId] = useState<number | ''>('')
  const [priceChannelId, setPriceChannelId] = useState<number | ''>('')
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [priceChannels, setPriceChannels] = useState<PriceChannel[]>([])
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [themeContent, setThemeContent] = useState<StorefrontThemeContent>({})
  const [brandColors, setBrandColors] = useState<BrandColors>({
    primary: '#0f766e',
    accent: '#f59e0b',
    background: '#f8fafc',
    text: '#0f172a',
  })
  const [stockMode, setStockMode] = useState<StorefrontStockMode>('realtime')
  const [banks, setBanks] = useState<StorefrontBankAccount[]>([])
  const [shipping, setShipping] = useState<StorefrontShipping>({
    enabled: false,
    origin_id: null,
    origin_label: '',
    couriers: ['jne', 'sicepat', 'jnt', 'tiki', 'pos'],
    default_weight_gram: 500,
    has_api_key: false,
  })
  const [originQuery, setOriginQuery] = useState('')
  const [originResults, setOriginResults] = useState<StorefrontShippingDestination[]>([])
  const [originBusy, setOriginBusy] = useState(false)
  const [templates, setTemplates] = useState<StorefrontAdmin['templates']>({ landing: [], shop: [] })
  const [hasVisibleProduct, setHasVisibleProduct] = useState(false)
  const [previewProducts, setPreviewProducts] = useState<StorefrontRenderProduct[]>([])
  const [previewNews, setPreviewNews] = useState<StorefrontRenderNews[]>([])
  const [collapsedPanels, setCollapsedPanels] = useState<SetupCollapsed>(() => readSetupCollapsed())

  const panelSpans = useMemo(() => setupPanelSpans(collapsedPanels), [collapsedPanels])

  function togglePanel(id: SetupPanelId) {
    setCollapsedPanels((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      if (next.brand && next.content && next.preview) return prev
      try {
        localStorage.setItem(SETUP_PANELS_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const warehousesForOutlet = useMemo(() => {
    if (outletId === '') return warehouses
    return warehouses.filter((w) => !w.outlet_id || w.outlet_id === outletId)
  }, [warehouses, outletId])

  async function load() {
    setLoading(true)
    try {
      const [sfRes, outletRes, whRes, chRes] = await Promise.all([
        api.get<ApiOk<StorefrontAdmin>>('/storefront'),
        api.get<ApiOk<Outlet[]>>('/outlets', { params: { for_select: 1, status: 'active', per_page: 100 }, silent: true }),
        api.get<ApiOk<Warehouse[]>>('/warehouses', { params: { for_select: 1, status: 'active', per_page: 100 }, silent: true }),
        api.get<ApiOk<PriceChannel[]>>('/price-channels', { params: { for_select: 1, status: 'active', per_page: 100 }, silent: true }),
      ])
      const sf = sfRes.data.data
      setSiteKind(sf.site_kind)
      setTemplateKey(sf.template_key)
      setStatus(sf.status)
      setTitle(sf.title ?? '')
      setTagline(sf.tagline ?? '')
      setAbout(sf.about ?? '')
      setContactEmail(sf.contact_email ?? '')
      setContactPhone(sf.contact_phone ?? '')
      setContactAddress(sf.contact_address ?? '')
      setSeoTitle(sf.seo_title ?? '')
      setSeoDescription(sf.seo_description ?? '')
      setOutletId(sf.outlet_id ?? '')
      setWarehouseId(sf.warehouse_id ?? '')
      setPriceChannelId(sf.price_channel_id ?? '')
      setLogoUrl(sf.logo_url ?? null)
      const slots =
        (sf.templates?.[sf.site_kind] ?? []).find((row) => row.key === sf.template_key)?.slots ??
        sf.template_slots ??
        []
      setThemeContent(mergeThemeContent(slots, sf.theme_content ?? {}))
      setBrandColors({
        primary: sf.brand_colors?.primary || '#0f766e',
        accent: sf.brand_colors?.accent || '#f59e0b',
        background: sf.brand_colors?.background || '#f8fafc',
        text: sf.brand_colors?.text || '#0f172a',
      })
      setStockMode(sf.stock_mode)
      setBanks(Array.isArray(sf.bank_accounts) ? sf.bank_accounts : [])
      setShipping({
        enabled: Boolean(sf.shipping?.enabled),
        origin_id: sf.shipping?.origin_id ?? null,
        origin_label: sf.shipping?.origin_label ?? '',
        couriers: sf.shipping?.couriers?.length ? sf.shipping.couriers : ['jne', 'sicepat', 'jnt', 'tiki', 'pos'],
        default_weight_gram: sf.shipping?.default_weight_gram ?? 500,
        has_api_key: Boolean(sf.shipping?.has_api_key),
        configured: Boolean(sf.shipping?.configured),
      })
      setTemplates(sf.templates)
      setOutlets(outletRes.data.data ?? [])
      setWarehouses(whRes.data.data ?? [])
      setPriceChannels(chRes.data.data ?? [])
      const productsOk = sf.publish_readiness?.items?.find((row) => row.key === 'products')?.ok
      if (sf.site_kind === 'shop') {
        try {
          const list = await api.get<ApiOk<StorefrontProductRow[]>>('/storefront/products?per_page=48', {
            silent: true,
          })
          const rows = list.data.data ?? []
          setHasVisibleProduct(
            typeof productsOk === 'boolean' ? productsOk : rows.some((row) => row.is_visible && row.product),
          )
          setPreviewProducts(
            rows
              .filter((row) => row.is_visible && row.product)
              .map((row) => ({
                id: row.product_id,
                product_id: row.product_id,
                name: row.product?.name ?? `Produk #${row.product_id}`,
                description: row.product?.description ?? null,
                price: row.override_price ?? row.product?.sell_price ?? 0,
                category_id: row.product?.category_id ?? null,
                image_url: row.product?.image_url ?? null,
                images: (row.product?.images ?? [])
                  .map((img) => ({ id: img.id, url: String(img.url || ''), is_primary: Boolean(img.is_primary) }))
                  .filter((img) => img.url),
                weight_gram: row.product?.weight_gram ?? null,
                variant_attributes: row.product?.variant_attributes ?? [],
                is_deal: Boolean(row.is_deal),
                is_new_arrival: Boolean(row.is_new_arrival),
                is_bestseller: Boolean(row.is_bestseller),
                sold_count: row.units_sold ?? 0,
                avg_rating: row.avg_rating ?? 0,
                review_count: row.review_count ?? 0,
              })),
          )
        } catch {
          setHasVisibleProduct(typeof productsOk === 'boolean' ? productsOk : false)
          setPreviewProducts([])
        }
      } else {
        setHasVisibleProduct(true)
        setPreviewProducts([])
      }
      if (sf.has_news) {
        try {
          const list = await api.get<ApiOk<StorefrontNewsPostRow[]>>('/storefront/news?per_page=24', {
            silent: true,
          })
          setPreviewNews(
            (list.data.data ?? [])
              .filter((row) => row.is_published)
              .map((row) => ({
                id: row.id,
                slug: row.slug,
                title: row.title,
                excerpt: row.excerpt ?? null,
                body: row.body ?? null,
                image_url: row.image_url ?? null,
                tags: row.tags ?? null,
                day: row.day ?? null,
                month: row.month ?? null,
                published_at: row.published_at ?? null,
              })),
          )
        } catch {
          setPreviewNews([])
        }
      } else {
        setPreviewNews([])
      }
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kindTemplates = templates[siteKind] ?? []
  const activeSlots = useMemo(() => {
    const tpl = kindTemplates.find((row) => row.key === templateKey)
    return tpl?.slots ?? []
  }, [kindTemplates, templateKey])

  const livePreviewModel = useMemo<StorefrontRenderModel>(
    () => ({
      site_kind: siteKind,
      template_key: templateKey,
      title: title || 'Toko',
      tagline,
      about,
      logo_url: logoUrl,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      contact_address: contactAddress.trim() || null,
      bank_accounts: banks.filter((b) => b.bank_name && b.account_name && b.account_number),
      brand_colors: brandColors,
      theme_content: themeContent,
      products: previewProducts,
      news: previewNews,
      preview: true,
    }),
    [
      siteKind,
      templateKey,
      title,
      tagline,
      about,
      logoUrl,
      contactEmail,
      contactPhone,
      contactAddress,
      banks,
      brandColors,
      themeContent,
      previewProducts,
      previewNews,
    ],
  )

  function selectTemplate(key: string) {
    setTemplateKey(key)
    const slots = kindTemplates.find((row) => row.key === key)?.slots ?? []
    setThemeContent((prev) => themeForTemplateSwitch(slots, prev))
  }

  const publishChecklist = useMemo(() => {
    if (siteKind !== 'shop') return null
    const banksOk = banks.some(
      (b) => b.bank_name?.trim() && b.account_name?.trim() && b.account_number?.trim(),
    )
    const shippingOk =
      !shipping.enabled ||
      Boolean(shipping.origin_id && (shipping.has_api_key || shipping.configured))
    return [
      { key: 'bank' as const, ok: banksOk },
      { key: 'shipping' as const, ok: shippingOk },
      { key: 'products' as const, ok: hasVisibleProduct },
    ]
  }, [siteKind, banks, shipping, hasVisibleProduct])

  const publishReady = publishChecklist ? publishChecklist.every((row) => row.ok) : true

  function openPreviewTab() {
    openStorefrontPreview({
      site_kind: siteKind,
      template_key: templateKey,
      title,
      tagline,
      about,
      status,
      stock_mode: stockMode,
      bank_accounts: banks.filter((b) => b.bank_name && b.account_name && b.account_number),
      shipping: {
        enabled: shipping.enabled,
        configured: Boolean(
          shipping.enabled && shipping.origin_id && (shipping.has_api_key || shipping.configured),
        ),
        origin_id: shipping.origin_id,
        origin_label: shipping.origin_label,
        couriers: shipping.couriers,
        default_weight_gram: shipping.default_weight_gram,
        has_api_key: shipping.has_api_key,
      },
      logo_url: logoUrl,
      brand_colors: brandColors,
      theme_content: themeContent,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      contact_address: contactAddress.trim() || null,
    })
  }

  async function save() {
    if (!canEdit) return
    setSaving(true)
    setError('')
    try {
      await api.put<ApiOk<StorefrontAdmin>>('/storefront', {
        site_kind: siteKind,
        template_key: templateKey,
        status,
        title,
        tagline,
        about,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_address: contactAddress.trim() || null,
        seo_title: seoTitle.trim() || null,
        seo_description: seoDescription.trim() || null,
        outlet_id: outletId === '' ? null : Number(outletId),
        warehouse_id: warehouseId === '' ? null : Number(warehouseId),
        price_channel_id: priceChannelId === '' ? null : Number(priceChannelId),
        stock_mode: stockMode,
        brand_colors: brandColors,
        theme_content: themeContent,
        bank_accounts: banks.filter((b) => b.bank_name && b.account_name && b.account_number),
        shipping: {
          enabled: shipping.enabled,
          origin_id: shipping.origin_id,
          origin_label: shipping.origin_label,
          couriers: shipping.couriers,
          default_weight_gram: shipping.default_weight_gram ?? 500,
        },
        apply_preset: false,
      })
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await save()
  }

  function updateBank(index: number, patch: Partial<StorefrontBankAccount>) {
    setBanks((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  async function searchOrigin() {
    const q = originQuery.trim()
    if (q.length < 2) return
    setOriginBusy(true)
    try {
      const { data } = await api.get<ApiOk<StorefrontShippingDestination[]>>(
        `/storefront/shipping/destinations?search=${encodeURIComponent(q)}&limit=15`,
      )
      setOriginResults(Array.isArray(data.data) ? data.data : [])
    } catch (err) {
      feedback.error(apiMessage(err, t('storefrontShippingSearchFailed')))
      setOriginResults([])
    } finally {
      setOriginBusy(false)
    }
  }

  function toggleCourier(code: string) {
    setShipping((prev) => {
      const current = prev.couriers ?? []
      const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code]
      return { ...prev, couriers: next.length ? next : [code] }
    })
  }

  async function onLogoChange(file: File | undefined) {
    if (!file || !canEdit) return
    setLogoBusy(true)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      const { data } = await api.post<ApiOk<StorefrontAdmin>>('/storefront/logo', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setLogoUrl(data.data.logo_url ?? null)
      feedback.success(t('storefrontLogoSaved'))
    } catch (err) {
      setError(apiMessage(err, t('storefrontMediaFailed')))
    } finally {
      setLogoBusy(false)
    }
  }

  async function onLogoRemove() {
    if (!canEdit) return
    setLogoBusy(true)
    setError('')
    try {
      const { data } = await api.delete<ApiOk<StorefrontAdmin>>('/storefront/logo')
      setLogoUrl(data.data.logo_url ?? null)
    } catch (err) {
      setError(apiMessage(err, t('storefrontMediaFailed')))
    } finally {
      setLogoBusy(false)
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-muted">{t('loading')}</div>
  }

  return (
    <div className="w-full max-w-none space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader eyebrow={t('appStorefront')} title={t('storefrontSetupTitle')} subtitle={t('storefrontSetupHint')} />
        <div className="flex flex-wrap items-center gap-2 pb-1">
          <button type="button" className="btn-ghost" onClick={openPreviewTab}>
            {t('storefrontPreviewTemplate')}
          </button>
          {canEdit ? (
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
              {saving ? t('storefrontSaving') : t('save')}
            </button>
          ) : null}
        </div>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {error ? <FormAlert>{error}</FormAlert> : null}

        <section className="glass rounded-3xl p-5">
          <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="field-block">
              <span>{t('storefrontSiteKind')}</span>
              <select
                className="field"
                disabled={!canEdit}
                value={siteKind}
                onChange={(e) => {
                  const next = e.target.value as StorefrontSiteKind
                  setSiteKind(next)
                  const first = templates[next]?.[0]
                  if (first) {
                    setTemplateKey(first.key)
                    setThemeContent(mergeThemeContent(first.slots ?? [], {}))
                  }
                }}
              >
                <option value="landing">{t('storefrontKindLanding')}</option>
                <option value="shop">{t('storefrontKindShop')}</option>
              </select>
            </label>
            <label className="field-block">
              <span>{t('storefrontStatus')}</span>
              <select
                className="field"
                disabled={!canEdit}
                value={status}
                onChange={(e) => {
                  const next = e.target.value
                  if (next === 'published' && siteKind === 'shop' && !publishReady) {
                    feedback.error(t('storefrontPublishBlocked'))
                    return
                  }
                  setStatus(next)
                }}
              >
                <option value="draft">{t('storefrontStatusDraft')}</option>
                <option value="published">{t('storefrontStatusPublished')}</option>
                <option value="suspended">{t('storefrontStatusSuspended')}</option>
              </select>
            </label>
            {publishChecklist ? (
              <div className="rounded-2xl border border-line bg-slate-50/70 px-3 py-2.5 text-xs md:col-span-2 xl:col-span-2">
                <div className="mb-1.5 font-medium text-slate-800">{t('storefrontPublishChecklist')}</div>
                <ul className="space-y-1">
                  {publishChecklist.map((row) => (
                    <li key={row.key} className={row.ok ? 'text-emerald-700' : 'text-amber-800'}>
                      {row.ok ? '✓' : '○'}{' '}
                      {row.key === 'bank'
                        ? t('storefrontPublishNeedBank')
                        : row.key === 'shipping'
                          ? t('storefrontPublishNeedShipping')
                          : t('storefrontPublishNeedProducts')}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <label className="field-block md:col-span-2 xl:col-span-1">
              <span>{t('name')}</span>
              <input className="field" disabled={!canEdit} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field-block md:col-span-2 xl:col-span-1">
              <span>{t('storefrontTagline')}</span>
              <input className="field" disabled={!canEdit} value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </label>
          </div>

          <div className="mb-2 text-sm text-muted">{t('storefrontTemplate')}</div>
          <p className="mb-3 text-xs text-muted">{t('storefrontPresetHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {kindTemplates.map((tpl) => {
              const active = templateKey === tpl.key
              return (
                <button
                  key={tpl.key}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => selectTemplate(tpl.key)}
                  className={`rounded-2xl border p-2 text-left transition ${
                    active ? 'border-teal-500 ring-2 ring-teal-200' : 'border-line hover:border-teal-300'
                  }`}
                >
                  <StorefrontTemplatePreview templateKey={tpl.key} title={title} tagline={tagline} />
                  <div className="mt-2 px-1">
                    <div className="text-sm font-medium">{tpl.name}</div>
                    <div className="text-xs text-muted">{tpl.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-12">
          <section className={`glass space-y-4 rounded-3xl p-5 ${panelSpans.brand}`}>
            {collapsedPanels.brand ? (
              <button
                type="button"
                onClick={() => togglePanel('brand')}
                className="flex min-h-[220px] w-full flex-col items-center gap-3 py-2 text-muted transition hover:text-teal-700"
                title={t('storefrontExpandPanel')}
                aria-label={t('storefrontExpandPanel')}
              >
                <span className="text-lg leading-none" aria-hidden>
                  ›
                </span>
                <span className="text-xs font-medium tracking-wide" style={{ writingMode: 'vertical-rl' }}>
                  {t('storefrontBrandSection')}
                </span>
              </button>
            ) : (
              <>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{t('storefrontBrandSection')}</div>
              <button
                type="button"
                className="btn-ghost shrink-0 px-2 py-1 text-xs"
                onClick={() => togglePanel('brand')}
                title={t('storefrontCollapsePanel')}
              >
                ‹ {t('storefrontCollapsePanel')}
              </button>
            </div>

            <div className="space-y-3 rounded-2xl border border-line bg-fill/40 p-4">
              <div className="text-sm font-medium text-fg">{t('storefrontLogo')}</div>
              {logoUrl ? (
                <div className="flex items-center gap-3">
                  <img src={logoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover ring-1 ring-black/5" />
                  {canEdit ? (
                    <button type="button" className="btn-ghost text-sm" disabled={logoBusy} onClick={() => void onLogoRemove()}>
                      {t('storefrontRemoveImage')}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="grid h-28 place-items-center rounded-2xl border border-dashed border-line bg-fill text-xs text-muted">
                  {t('storefrontNoImage')}
                </div>
              )}
              {canEdit ? (
                <div className="space-y-1.5">
                  <label className="btn-ghost inline-flex cursor-pointer text-sm">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={logoBusy}
                      onChange={(e) => void onLogoChange(e.target.files?.[0])}
                    />
                    {logoBusy ? t('storefrontUploading') : t('storefrontUploadLogo')}
                  </label>
                  <div className="space-y-0.5 text-[11px] leading-snug text-muted">
                    <p>{t('storefrontImageFormats', { mb: '4' })}</p>
                    <p>{t('storefrontImageHintLogo')}</p>
                    <p>{t('storefrontImageSingleHint')}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-3 rounded-2xl border border-line bg-fill/40 p-4">
              <div className="text-sm font-medium text-fg">{t('storefrontBrandColors')}</div>
              <div className="grid gap-2">
                {(
                  [
                    ['primary', t('storefrontColorPrimary')],
                    ['accent', t('storefrontColorAccent')],
                    ['background', t('storefrontColorBackground')],
                    ['text', t('storefrontColorText')],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-fill px-3 py-2 text-sm"
                  >
                    <span className="text-muted">{label}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[11px] uppercase text-muted">{brandColors[key]}</span>
                      <input
                        type="color"
                        disabled={!canEdit}
                        value={brandColors[key]}
                        onChange={(e) => setBrandColors((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                      />
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <label className="field-block">
              <span>{t('storefrontAbout')}</span>
              <textarea className="field min-h-28" disabled={!canEdit} value={about} onChange={(e) => setAbout(e.target.value)} />
            </label>

            <div className="space-y-3 rounded-2xl border border-line bg-fill/40 p-4">
              <div>
                <div className="text-sm font-medium text-fg">{t('storefrontContactSection')}</div>
                <p className="mt-1 text-xs text-muted">{t('storefrontContactBlockHint')}</p>
              </div>
              <label className="field-block">
                <span>{t('email')}</span>
                <input
                  className="field"
                  type="email"
                  disabled={!canEdit}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </label>
              <label className="field-block">
                <span>{t('phone')}</span>
                <input
                  className="field"
                  disabled={!canEdit}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </label>
              <label className="field-block">
                <span>{t('address')}</span>
                <textarea
                  className="field min-h-20"
                  disabled={!canEdit}
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                />
              </label>
            </div>

            <div className="space-y-3 rounded-2xl border border-line bg-fill/40 p-4">
              <div className="text-sm font-medium text-fg">{t('storefrontSeoSection')}</div>
              <label className="field-block">
                <span>{t('storefrontSeoTitle')}</span>
                <input
                  className="field"
                  disabled={!canEdit}
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder={title || undefined}
                />
              </label>
              <label className="field-block">
                <span>{t('storefrontSeoDescription')}</span>
                <textarea
                  className="field min-h-20"
                  disabled={!canEdit}
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder={tagline || about || undefined}
                />
              </label>
            </div>

            {siteKind === 'shop' ? (
              <>
                <div className="space-y-2 rounded-2xl border border-line p-3">
                  <div className="text-sm font-medium">{t('storefrontOpsSection')}</div>
                  <label className="block space-y-1 text-sm">
                    <span className="text-muted">{t('storefrontOutlet')}</span>
                    <select
                      className="field w-full"
                      disabled={!canEdit}
                      value={outletId === '' ? '' : String(outletId)}
                      onChange={(e) => {
                        const next = e.target.value === '' ? '' : Number(e.target.value)
                        setOutletId(next)
                        if (next !== '' && warehouseId !== '') {
                          const wh = warehouses.find((w) => w.id === warehouseId)
                          if (wh?.outlet_id && wh.outlet_id !== next) setWarehouseId('')
                        }
                      }}
                    >
                      <option value="">—</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="text-muted">{t('storefrontWarehouse')}</span>
                    <select
                      className="field w-full"
                      disabled={!canEdit}
                      value={warehouseId === '' ? '' : String(warehouseId)}
                      onChange={(e) => setWarehouseId(e.target.value === '' ? '' : Number(e.target.value))}
                    >
                      <option value="">—</option>
                      {warehousesForOutlet.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                          {w.is_default ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="text-muted">{t('storefrontPriceChannel')}</span>
                    <select
                      className="field w-full"
                      disabled={!canEdit}
                      value={priceChannelId === '' ? '' : String(priceChannelId)}
                      onChange={(e) => setPriceChannelId(e.target.value === '' ? '' : Number(e.target.value))}
                    >
                      <option value="">—</option>
                      {priceChannels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.name}
                          {ch.code ? ` (${ch.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-muted">{t('storefrontStockMode')}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2">
                      <input
                        type="radio"
                        name="stock_mode"
                        disabled={!canEdit}
                        checked={stockMode === 'realtime'}
                        onChange={() => setStockMode('realtime')}
                      />
                      <span>
                        <div className="font-medium">{t('storefrontStockRealtime')}</div>
                        <div className="text-xs text-muted">{t('storefrontStockRealtimeHint')}</div>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2">
                      <input
                        type="radio"
                        name="stock_mode"
                        disabled={!canEdit}
                        checked={stockMode === 'allocated'}
                        onChange={() => setStockMode('allocated')}
                      />
                      <span>
                        <div className="font-medium">{t('storefrontStockAllocated')}</div>
                        <div className="text-xs text-muted">{t('storefrontStockAllocatedHint')}</div>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted">{t('storefrontBankAccounts')}</div>
                    {canEdit ? (
                      <button
                        type="button"
                        className="btn-ghost text-sm"
                        onClick={() => setBanks((prev) => [...prev, { bank_name: '', account_name: '', account_number: '' }])}
                      >
                        {t('storefrontAddBank')}
                      </button>
                    ) : null}
                  </div>
                  {banks.map((bank, index) => (
                    <div
                      key={index}
                      className="grid gap-2 rounded-2xl border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-center"
                    >
                      <input
                        className="field min-w-0"
                        placeholder={t('storefrontBankName')}
                        disabled={!canEdit}
                        value={bank.bank_name}
                        onChange={(e) => updateBank(index, { bank_name: e.target.value })}
                      />
                      <input
                        className="field min-w-0"
                        placeholder={t('storefrontAccountName')}
                        disabled={!canEdit}
                        value={bank.account_name}
                        onChange={(e) => updateBank(index, { account_name: e.target.value })}
                      />
                      <input
                        className="field min-w-0"
                        placeholder={t('storefrontAccountNumber')}
                        disabled={!canEdit}
                        value={bank.account_number}
                        onChange={(e) => updateBank(index, { account_number: e.target.value })}
                      />
                      {canEdit ? (
                        <button
                          type="button"
                          className="btn-ghost justify-self-start text-xs sm:justify-self-end"
                          onClick={() => setBanks((prev) => prev.filter((_, i) => i !== index))}
                        >
                          {t('storefrontRemoveBank')}
                        </button>
                      ) : (
                        <span className="hidden sm:block" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-2xl border border-line">
                  <div className="flex items-start justify-between gap-4 border-b border-line bg-slate-50/80 px-4 py-3.5">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold tracking-tight">{t('storefrontShippingTitle')}</div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted">{t('storefrontShippingHint')}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={shipping.enabled}
                      disabled={!canEdit}
                      onClick={() => setShipping((s) => ({ ...s, enabled: !s.enabled }))}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                        shipping.enabled ? 'bg-teal-600' : 'bg-slate-300'
                      } ${!canEdit ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                          shipping.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {shipping.enabled ? (
                    <div className="space-y-5 p-4">
                      {!shipping.has_api_key ? (
                        <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
                          {t('storefrontShippingNoApi')}
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                          {t('storefrontShippingStoreLocation')}
                        </div>
                        {shipping.origin_id && shipping.origin_label ? (
                          <div className="flex items-start justify-between gap-3 rounded-xl border border-teal-200/70 bg-teal-50/50 px-3 py-2.5">
                            <div className="min-w-0">
                              <div className="text-[11px] font-medium text-teal-800/80">{t('storefrontShippingOrigin')}</div>
                              <div className="mt-0.5 text-sm font-medium leading-snug text-slate-900">{shipping.origin_label}</div>
                            </div>
                            {canEdit ? (
                              <button
                                type="button"
                                className="shrink-0 text-xs text-muted underline-offset-2 hover:text-slate-800 hover:underline"
                                onClick={() => {
                                  setShipping((s) => ({ ...s, origin_id: null, origin_label: '' }))
                                  setOriginQuery('')
                                  setOriginResults([])
                                }}
                              >
                                {t('storefrontShippingChange')}
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                className="field flex-1"
                                disabled={!canEdit}
                                placeholder={t('storefrontShippingSearchPlaceholder')}
                                value={originQuery}
                                onChange={(e) => setOriginQuery(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    void searchOrigin()
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="btn-ghost shrink-0 text-sm"
                                disabled={!canEdit || originBusy || originQuery.trim().length < 2}
                                onClick={() => void searchOrigin()}
                              >
                                {originBusy ? t('storefrontShippingSearching') : t('storefrontShippingSearch')}
                              </button>
                            </div>
                            {originResults.length > 0 ? (
                              <ul className="max-h-44 overflow-auto rounded-xl border border-line bg-white text-sm shadow-sm">
                                {originResults.map((row) => (
                                  <li key={row.id} className="border-b border-line last:border-0">
                                    <button
                                      type="button"
                                      className="w-full px-3 py-2.5 text-left transition hover:bg-slate-50"
                                      disabled={!canEdit}
                                      onClick={() => {
                                        setShipping((s) => ({
                                          ...s,
                                          origin_id: row.id,
                                          origin_label: row.label,
                                        }))
                                        setOriginResults([])
                                        setOriginQuery('')
                                      }}
                                    >
                                      {row.label}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                          {t('storefrontShippingCouriers')}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {COURIER_OPTIONS.map((opt) => {
                            const active = (shipping.couriers ?? []).includes(opt.code)
                            return (
                              <button
                                key={opt.code}
                                type="button"
                                disabled={!canEdit}
                                onClick={() => toggleCourier(opt.code)}
                                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                                  active
                                    ? 'border-teal-500 bg-teal-50/70 ring-1 ring-teal-200'
                                    : 'border-line bg-white hover:border-slate-300'
                                } ${!canEdit ? 'cursor-not-allowed opacity-60' : ''}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium">{opt.name}</span>
                                  <span
                                    className={`grid h-4 w-4 place-items-center rounded-full border text-[10px] ${
                                      active
                                        ? 'border-teal-600 bg-teal-600 text-white'
                                        : 'border-slate-300 text-transparent'
                                    }`}
                                  >
                                    ✓
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                          {t('storefrontShippingDefaultWeight')}
                        </span>
                        <div className="relative max-w-[180px]">
                          <input
                            className="field w-full pr-14"
                            type="number"
                            min={1}
                            max={30000}
                            disabled={!canEdit}
                            value={shipping.default_weight_gram ?? 500}
                            onChange={(e) =>
                              setShipping((s) => ({
                                ...s,
                                default_weight_gram: Math.max(1, Number(e.target.value) || 500),
                              }))
                            }
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted">
                            {t('storefrontShippingGram')}
                          </span>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="px-4 py-3.5 text-xs leading-relaxed text-muted">{t('storefrontShippingDisabledHint')}</div>
                  )}
                </div>
              </>
            ) : null}
              </>
            )}
          </section>

          <section className={`glass rounded-3xl p-5 ${panelSpans.content}`}>
            {collapsedPanels.content ? (
              <button
                type="button"
                onClick={() => togglePanel('content')}
                className="flex min-h-[220px] w-full flex-col items-center gap-3 py-2 text-muted transition hover:text-teal-700"
                title={t('storefrontExpandPanel')}
                aria-label={t('storefrontExpandPanel')}
              >
                <span className="text-lg leading-none" aria-hidden>
                  ›
                </span>
                <span className="text-xs font-medium tracking-wide" style={{ writingMode: 'vertical-rl' }}>
                  {t('storefrontTemplateContent')}
                </span>
              </button>
            ) : (
              <>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{t('storefrontTemplateContent')}</div>
                    <p className="mt-1 text-xs text-muted">{t('storefrontTemplateContentHint')}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost shrink-0 px-2 py-1 text-xs"
                    onClick={() => togglePanel('content')}
                    title={t('storefrontCollapsePanel')}
                  >
                    ‹ {t('storefrontCollapsePanel')}
                  </button>
                </div>
                <StorefrontThemeFields
                  slots={activeSlots}
                  value={themeContent}
                  disabled={!canEdit}
                  onChange={setThemeContent}
                />
              </>
            )}
          </section>

          <section className={`overflow-hidden rounded-3xl border border-line bg-white ${panelSpans.preview}`}>
            {collapsedPanels.preview ? (
              <button
                type="button"
                onClick={() => togglePanel('preview')}
                className="flex min-h-[220px] w-full flex-col items-center gap-3 py-4 text-muted transition hover:text-teal-700"
                title={t('storefrontExpandPanel')}
                aria-label={t('storefrontExpandPanel')}
              >
                <span className="text-lg leading-none" aria-hidden>
                  ›
                </span>
                <span className="text-xs font-medium tracking-wide" style={{ writingMode: 'vertical-rl' }}>
                  {t('storefrontLivePreview')}
                </span>
              </button>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                  <div className="text-xs text-muted">{t('storefrontLivePreview')}</div>
                  <button
                    type="button"
                    className="btn-ghost shrink-0 px-2 py-1 text-xs"
                    onClick={() => togglePanel('preview')}
                    title={t('storefrontCollapsePanel')}
                  >
                    ‹ {t('storefrontCollapsePanel')}
                  </button>
                </div>
                <div className="max-h-[70vh] overflow-auto bg-white">
                  <div
                    style={
                      collapsedPanels.content
                        ? { zoom: 0.92 }
                        : collapsedPanels.brand
                          ? { zoom: 0.85 }
                          : { zoom: 0.78 }
                    }
                  >
                    <StorefrontShopProvider model={livePreviewModel}>
                      <ShopChrome model={livePreviewModel}>
                        <StorefrontSite model={livePreviewModel} />
                      </ShopChrome>
                    </StorefrontShopProvider>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        {canEdit ? (
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('storefrontSaving') : t('save')}
            </button>
          </div>
        ) : null}
      </form>
    </div>
  )
}
