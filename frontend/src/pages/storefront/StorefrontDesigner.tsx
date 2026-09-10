import { useEffect, useMemo, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { FormAlert, useFeedback } from '../../components/feedback'
import { SearchMultiSelect } from '../../components/SearchMultiSelect'
import { PageHeader } from '../../components/ui'
import { useAccess } from '../../access'
import { useI18n } from '../../i18n'
import type { ApiOk, Category } from '../../types'
import {
  blockTypeLabel,
  isStorefrontBlockType,
  newStorefrontBlock,
  normalizeStorefrontBlocks,
  type StorefrontBlock,
  type StorefrontBlockProps,
  type StorefrontBlockType,
  type StorefrontBlockTypeMeta,
  type StorefrontCategoryItem,
} from './lib/storefrontBlocks'
import { openStorefrontPreview } from './previewDraft'
import { ShopChrome, StorefrontShopProvider } from './commerce/StorefrontShop'
import { StorefrontThemeFields } from './StorefrontThemeFields'
import { StorefrontBlockRenderer } from './templates/StorefrontBlockRenderer'
import { StorefrontSite, type StorefrontRenderModel } from './templates/StorefrontSite'
import type { StorefrontHomePage, StorefrontProductRow, StorefrontTemplateSlot, StorefrontThemeContent } from './types'

const LIBRARY: StorefrontBlockType[] = [
  'hero',
  'carousel',
  'gallery',
  'rich_text',
  'product_grid',
  'category_split',
  'banner',
  'contact',
  'spacer',
]

export default function StorefrontDesigner() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const canEdit = can('storefrontpages', 'edit') || can('storefrontsetup', 'edit')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState<StorefrontHomePage | null>(null)
  const [blocks, setBlocks] = useState<StorefrontBlock[]>([])
  const [blockTypes, setBlockTypes] = useState<StorefrontBlockTypeMeta[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [brandColors, setBrandColors] = useState({
    primary: '#0f766e',
    accent: '#f59e0b',
    background: '#f8fafc',
    text: '#0f172a',
  })
  const [products, setProducts] = useState<
    Array<{
      id: number
      name: string
      description?: string | null
      price: number
      image_url?: string | null
      category_id?: number | null
    }>
  >([])
  const [categories, setCategories] = useState<Category[]>([])
  const [uploading, setUploading] = useState(false)
  const [themeContent, setThemeContent] = useState<StorefrontThemeContent>({})
  const [templateSlots, setTemplateSlots] = useState<StorefrontTemplateSlot[]>([])

  const selected = blocks.find((b) => b.id === selectedId) ?? null

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get<ApiOk<StorefrontHomePage>>('/storefront/pages/home')
      const home = data.data
      setPage(home)
      setThemeContent(home.theme_content ?? {})
      setTemplateSlots(home.template_slots ?? [])
      const nextBlocks = normalizeStorefrontBlocks(home.blocks)
      setBlocks(nextBlocks)
      setSelectedId(nextBlocks[0]?.id ?? null)
      setBlockTypes(home.block_types ?? [])
      setBrandColors({
        primary: home.brand_colors?.primary || '#0f766e',
        accent: home.brand_colors?.accent || '#f59e0b',
        background: home.brand_colors?.background || '#f8fafc',
        text: home.brand_colors?.text || '#0f172a',
      })

      if (home.site_kind === 'shop') {
        try {
          const list = await api.get<ApiOk<StorefrontProductRow[]>>('/storefront/products?per_page=24')
          setProducts(
            (list.data.data ?? [])
              .filter((row) => row.is_visible && row.product)
              .map((row) => ({
                id: row.product_id,
                product_id: row.product_id,
                name: row.product?.name ?? `Produk #${row.product_id}`,
                description: null,
                price: row.override_price ?? row.product?.sell_price ?? 0,
                category_id: row.product?.category_id ?? null,
                image_url: row.product?.image_url ?? null,
                is_deal: Boolean(row.is_deal),
                is_new_arrival: Boolean(row.is_new_arrival),
                is_bestseller: Boolean(row.is_bestseller),
                sold_count: row.units_sold ?? 0,
                avg_rating: row.avg_rating ?? 0,
                review_count: row.review_count ?? 0,
              })),
          )
        } catch {
          setProducts([])
        }
      } else {
        setProducts([])
      }

      try {
        const cats = await api.get<ApiOk<Category[]>>('/categories', {
          params: { for_select: 1, status: 'active' },
          silent: true,
        })
        setCategories(cats.data.data ?? [])
      } catch {
        setCategories([])
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

  const previewModel = useMemo(
    () => ({
      title: page?.title_site || page?.title || 'Toko',
      tagline: page?.tagline || '',
      about: page?.about || '',
      logo_url: page?.logo_url,
      contact_email: page?.contact_email,
      contact_phone: page?.contact_phone,
      contact_address: page?.contact_address,
      bank_accounts: page?.bank_accounts ?? [],
      brand_colors: brandColors,
      products,
      preview: true,
      site_kind: page?.site_kind,
    }),
    [page, brandColors, products],
  )

  const isNexora = page?.template_key === 'shop_nexora'

  const nexoraPreviewModel = useMemo<StorefrontRenderModel | null>(() => {
    if (!isNexora || !page) return null
    return {
      site_kind: page.site_kind || 'shop',
      template_key: 'shop_nexora',
      title: page.title_site || page.title || 'Toko',
      tagline: page.tagline || '',
      about: page.about || '',
      logo_url: page.logo_url,
      contact_email: page.contact_email,
      contact_phone: page.contact_phone,
      contact_address: page.contact_address,
      bank_accounts: page.bank_accounts ?? [],
      brand_colors: brandColors,
      theme_content: themeContent,
      products,
      preview: true,
    }
  }, [isNexora, page, brandColors, products, themeContent])

  function patchBlock(id: string, patch: Partial<StorefrontBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  function patchProps(id: string, patch: Partial<StorefrontBlockProps>) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, props: { ...b.props, ...patch } } : b)),
    )
  }

  function move(id: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id)
      const next = index + dir
      if (index < 0 || next < 0 || next >= prev.length) return prev
      const copy = [...prev]
      const [row] = copy.splice(index, 1)
      copy.splice(next, 0, row)
      return copy
    })
  }

  function add(type: StorefrontBlockType) {
    if (!canEdit) return
    const block = newStorefrontBlock(type)
    setBlocks((prev) => [...prev, block])
    setSelectedId(block.id)
  }

  function remove(id: string) {
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id)
      if (selectedId === id) setSelectedId(next[0]?.id ?? null)
      return next
    })
  }

  async function uploadImage(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/jpeg,image/png,image/webp'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) {
          resolve(null)
          return
        }
        setUploading(true)
        try {
          const body = new FormData()
          body.append('file', file)
          const { data } = await api.post<ApiOk<{ url: string }>>('/storefront/media', body, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          resolve(data.data.url)
        } catch (err) {
          feedback.error(apiMessage(err, t('storefrontMediaFailed')))
          resolve(null)
        } finally {
          setUploading(false)
        }
      }
      input.click()
    })
  }

  async function save() {
    if (!canEdit) return
    setSaving(true)
    setError('')
    try {
      const payload = isNexora
        ? { theme_content: themeContent }
        : { blocks }
      const { data } = await api.put<ApiOk<StorefrontHomePage>>('/storefront/pages/home', payload)
      const home = data.data
      setPage(home)
      setThemeContent(home.theme_content ?? {})
      setTemplateSlots(home.template_slots ?? [])
      setBlocks(normalizeStorefrontBlocks(home.blocks))
      setBrandColors({
        primary: home.brand_colors?.primary || '#0f766e',
        accent: home.brand_colors?.accent || '#f59e0b',
        background: home.brand_colors?.background || '#f8fafc',
        text: home.brand_colors?.text || '#0f172a',
      })
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function applyPreset() {
    if (!canEdit) return
    const ok = await feedback.confirm({
      title: t('storefrontApplyPreset'),
      message: t('storefrontApplyPresetConfirm'),
      confirmLabel: t('storefrontApplyPreset'),
      cancelLabel: t('cancel'),
      tone: 'danger',
    })
    if (!ok) return
    setSaving(true)
    setError('')
    try {
      const { data } = await api.post<ApiOk<StorefrontHomePage>>('/storefront/pages/home/apply-preset')
      const home = data.data
      setPage(home)
      const next = normalizeStorefrontBlocks(home.blocks)
      setBlocks(next)
      setSelectedId(next[0]?.id ?? null)
      feedback.success(t('storefrontPresetApplied'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  function openPreview() {
    const ship = page?.shipping
    openStorefrontPreview({
      site_kind: page?.site_kind || 'landing',
      template_key: page?.template_key || 'landing_minimal',
      title: page?.title_site || 'Toko',
      tagline: page?.tagline || '',
      about: page?.about || '',
      status: 'draft',
      stock_mode: page?.stock_mode || 'realtime',
      bank_accounts: page?.bank_accounts ?? [],
      shipping: ship
        ? {
            enabled: Boolean(ship.enabled),
            configured: Boolean(ship.configured),
            origin_id: ship.origin_id ?? null,
            origin_label: ship.origin_label ?? '',
            couriers: ship.couriers ?? [],
            default_weight_gram: ship.default_weight_gram ?? 500,
            has_api_key: Boolean(ship.has_api_key),
          }
        : null,
      logo_url: page?.logo_url,
      brand_colors: brandColors,
      theme_content: themeContent,
      home_blocks: blocks,
      contact_email: page?.contact_email ?? null,
      contact_phone: page?.contact_phone ?? null,
      contact_address: page?.contact_address ?? null,
    })
  }

  if (loading) {
    return <div className="p-4 text-sm text-muted">{t('loading')}</div>
  }

  return (
    <div className="w-full max-w-none space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          eyebrow={t('appStorefront')}
          title={t('storefrontDesignerTitle')}
          subtitle={t('storefrontDesignerHint')}
        />
        <div className="flex flex-wrap items-center gap-2 pb-1">
          {!isNexora ? (
            <button type="button" className="btn-ghost" onClick={() => void applyPreset()} disabled={!canEdit || saving}>
              {t('storefrontApplyPreset')}
            </button>
          ) : null}
          <button type="button" className="btn-ghost" onClick={openPreview}>
            {t('storefrontPreviewTemplate')}
          </button>
          {canEdit ? (
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
              {saving ? t('storefrontSaving') : t('save')}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <FormAlert>{error}</FormAlert> : null}
      {isNexora ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          {t('storefrontDesignerNexoraHint')}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        {isNexora ? (
          <>
            <section className="glass rounded-3xl p-4 xl:col-span-7">
              <div className="mb-3 text-sm font-medium">{t('storefrontTemplateContent')}</div>
              <p className="mb-3 text-xs text-muted">{t('storefrontTemplateContentHint')}</p>
              <StorefrontThemeFields
                slots={templateSlots}
                value={themeContent}
                disabled={!canEdit}
                onChange={setThemeContent}
              />
            </section>
            <section className="overflow-hidden rounded-3xl border border-line bg-white xl:col-span-5">
              <div className="border-b border-line px-4 py-2 text-xs text-muted">{t('storefrontLivePreview')}</div>
              <div className="max-h-[78vh] overflow-auto">
                <div className="origin-top scale-[0.85]">
                  {nexoraPreviewModel ? (
                    <StorefrontShopProvider model={nexoraPreviewModel}>
                      <ShopChrome model={nexoraPreviewModel}>
                        <StorefrontSite model={nexoraPreviewModel} />
                      </ShopChrome>
                    </StorefrontShopProvider>
                  ) : null}
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
        <aside className="space-y-4 xl:col-span-3">
          <section className="glass rounded-3xl p-4">
            <div className="mb-2 text-sm font-medium">{t('storefrontBlockLibrary')}</div>
            <div className="flex flex-wrap gap-2">
              {(blockTypes.length
                ? blockTypes.map((row) => row.type).filter(isStorefrontBlockType)
                : LIBRARY
              ).map((type) => (
                <button
                  key={type}
                  type="button"
                  disabled={!canEdit}
                  className="btn-ghost text-xs"
                  onClick={() => add(type)}
                >
                  + {blockTypes.find((b) => b.type === type)?.label || blockTypeLabel(type)}
                </button>
              ))}
            </div>
          </section>

          <section className="glass rounded-3xl p-4">
            <div className="mb-2 text-sm font-medium">{t('storefrontBlockList')}</div>
            <div className="space-y-2">
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  className={`rounded-2xl border px-3 py-2 ${
                    selectedId === block.id ? 'border-teal-500 ring-1 ring-teal-200' : 'border-line'
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left text-sm font-medium"
                    onClick={() => setSelectedId(block.id)}
                  >
                    {blockTypeLabel(block.type)}
                    {!block.visible ? (
                      <span className="ml-2 text-xs text-muted">({t('storefrontBlockHidden')})</span>
                    ) : null}
                  </button>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button type="button" className="btn-ghost text-xs" disabled={!canEdit || index === 0} onClick={() => move(block.id, -1)}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      disabled={!canEdit || index === blocks.length - 1}
                      onClick={() => move(block.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      disabled={!canEdit}
                      onClick={() => patchBlock(block.id, { visible: !block.visible })}
                    >
                      {block.visible ? t('storefrontHideBlock') : t('storefrontShowBlock')}
                    </button>
                    <button type="button" className="btn-ghost text-xs text-rose-600" disabled={!canEdit} onClick={() => remove(block.id)}>
                      {t('delete')}
                    </button>
                  </div>
                </div>
              ))}
              {blocks.length === 0 ? <div className="text-xs text-muted">{t('storefrontNoBlocks')}</div> : null}
            </div>
          </section>

          <section className="glass space-y-2 rounded-3xl p-4">
            <div className="text-sm font-medium">{t('storefrontBrandColors')}</div>
            <p className="text-xs text-muted">{t('storefrontBrandColorsSetupOnly')}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {(
                [
                  ['primary', t('storefrontColorPrimary')],
                  ['accent', t('storefrontColorAccent')],
                  ['background', t('storefrontColorBackground')],
                  ['text', t('storefrontColorText')],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2 rounded-xl border border-line px-2.5 py-1.5 text-xs">
                  <span
                    className="h-4 w-4 rounded-full border border-black/10"
                    style={{ backgroundColor: brandColors[key] }}
                    title={label}
                  />
                  <span className="text-muted">{label}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="glass rounded-3xl p-4 xl:col-span-4">
          <div className="mb-3 text-sm font-medium">{t('storefrontBlockProps')}</div>
          {!selected ? (
            <div className="text-sm text-muted">{t('storefrontSelectBlock')}</div>
          ) : (
            <BlockPropsEditor
              block={selected}
              disabled={!canEdit || uploading}
              uploading={uploading}
              categories={categories}
              onPatch={(patch) => patchProps(selected.id, patch)}
              onUpload={uploadImage}
            />
          )}
        </section>

        <section className="overflow-hidden rounded-3xl border border-line bg-white xl:col-span-5">
          <div className="border-b border-line px-4 py-2 text-xs text-muted">{t('storefrontLivePreview')}</div>
          <div className="max-h-[78vh] overflow-auto">
            <div className="origin-top scale-[0.85]">
              <StorefrontBlockRenderer model={previewModel} blocks={blocks} />
            </div>
          </div>
        </section>
          </>
        )}
      </div>
    </div>
  )
}

function BlockPropsEditor({
  block,
  disabled,
  uploading,
  categories,
  onPatch,
  onUpload,
}: {
  block: StorefrontBlock
  disabled?: boolean
  uploading?: boolean
  categories: Category[]
  onPatch: (patch: Partial<StorefrontBlockProps>) => void
  onUpload: () => Promise<string | null>
}) {
  const { t } = useI18n()
  const p = block.props
  const categoryOptions = useMemo(
    () => categories.map((item) => ({ value: String(item.id), label: item.name, keywords: item.name })),
    [categories],
  )

  async function pickImage(field: keyof StorefrontBlockProps) {
    const url = await onUpload()
    if (url) onPatch({ [field]: url })
  }

  async function addGalleryImage() {
    const url = await onUpload()
    if (!url) return
    onPatch({ images: [...(p.images || []), url] })
  }

  async function addCarouselSlide() {
    const url = await onUpload()
    if (!url) return
    onPatch({ slides: [...(p.slides || []), { image: url, title: '', subtitle: '' }] })
  }

  function syncCategoryItems(ids: number[]) {
    const prev = Array.isArray(p.items) ? p.items : []
    const next: StorefrontCategoryItem[] = ids.map((id) => {
      const existing = prev.find((row) => row.category_id === id)
      const cat = categories.find((c) => c.id === id)
      return {
        category_id: id,
        label: existing?.label || cat?.name || '',
        image: existing?.image ?? null,
      }
    })
    onPatch({ items: next })
  }

  async function setItemImage(categoryId: number) {
    const url = await onUpload()
    if (!url) return
    onPatch({
      items: (p.items || []).map((row) => (row.category_id === categoryId ? { ...row, image: url } : row)),
    })
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="text-xs uppercase tracking-wide text-muted">{blockTypeLabel(block.type)}</div>

      {block.type === 'hero' || block.type === 'banner' ? (
        <>
          <ImageField
            label={t('storefrontImage')}
            src={p.image}
            disabled={disabled}
            uploading={uploading}
            onPick={() => void pickImage('image')}
            onClear={() => onPatch({ image: null })}
          />
          {block.type === 'hero' ? (
            <>
              <TextField label={t('storefrontHeadline')} value={p.headline || ''} disabled={disabled} onChange={(v) => onPatch({ headline: v })} />
              <TextField label={t('storefrontSubheadline')} value={p.subheadline || ''} disabled={disabled} onChange={(v) => onPatch({ subheadline: v })} />
              <TextField label={t('storefrontCta')} value={p.cta || ''} disabled={disabled} onChange={(v) => onPatch({ cta: v })} />
            </>
          ) : (
            <>
              <TextField label={t('name')} value={p.title || ''} disabled={disabled} onChange={(v) => onPatch({ title: v })} />
              <TextAreaField label={t('storefrontAbout')} value={p.body || ''} disabled={disabled} onChange={(v) => onPatch({ body: v })} />
            </>
          )}
          <TextField label={t('storefrontKickerLeft')} value={p.kicker_left || ''} disabled={disabled} onChange={(v) => onPatch({ kicker_left: v })} />
          <TextField label={t('storefrontKickerRight')} value={p.kicker_right || ''} disabled={disabled} onChange={(v) => onPatch({ kicker_right: v })} />
          <label className="block space-y-1">
            <span className="text-muted">{t('storefrontBlockStyle')}</span>
            <select
              className="input w-full"
              disabled={disabled}
              value={p.style || (block.type === 'hero' ? 'standard' : 'collection')}
              onChange={(e) => onPatch({ style: e.target.value })}
            >
              {block.type === 'hero' ? (
                <>
                  <option value="standard">Standard</option>
                  <option value="fullbleed">Full-bleed</option>
                </>
              ) : (
                <>
                  <option value="collection">Collection</option>
                  <option value="shoppable">Shoppable</option>
                  <option value="compact">Compact</option>
                </>
              )}
            </select>
          </label>
        </>
      ) : null}

      {block.type === 'rich_text' || block.type === 'product_grid' ? (
        <>
          <TextField label={t('name')} value={p.title || ''} disabled={disabled} onChange={(v) => onPatch({ title: v })} />
          <TextAreaField label={t('storefrontAbout')} value={p.body || ''} disabled={disabled} onChange={(v) => onPatch({ body: v })} />
          {block.type === 'product_grid' ? (
            <label className="block space-y-1">
              <span className="text-muted">{t('storefrontProductLimit')}</span>
              <input
                type="number"
                min={1}
                max={24}
                className="input w-full"
                disabled={disabled}
                value={p.limit ?? 8}
                onChange={(e) => onPatch({ limit: Number(e.target.value) || 8 })}
              />
            </label>
          ) : null}
        </>
      ) : null}

      {block.type === 'category_split' ? (
        <>
          <TextField label={t('name')} value={p.title || ''} disabled={disabled} onChange={(v) => onPatch({ title: v })} />
          <div className="space-y-1">
            <div className="text-muted">{t('storefrontPickCategories')}</div>
            <SearchMultiSelect
              values={(p.items || []).filter((row) => row.category_id > 0).map((row) => String(row.category_id))}
              onChange={(next) => syncCategoryItems(next.map(Number).filter((id) => Number.isFinite(id) && id > 0))}
              options={categoryOptions}
              placeholder={t('storefrontPickCategoriesPlaceholder')}
              disabled={disabled}
            />
            <p className="text-xs text-muted">{t('storefrontPickCategoriesHint')}</p>
          </div>
          {(p.items || []).map((item) => {
            const catName = categories.find((c) => c.id === item.category_id)?.name
            return (
              <div key={item.category_id} className="space-y-2 rounded-2xl border border-line p-3">
                <div className="text-xs font-medium text-muted">{catName || `ID ${item.category_id}`}</div>
                <TextField
                  label={t('storefrontCategoryLabelOverride')}
                  value={item.label || ''}
                  disabled={disabled}
                  onChange={(v) =>
                    onPatch({
                      items: (p.items || []).map((row) =>
                        row.category_id === item.category_id ? { ...row, label: v } : row,
                      ),
                    })
                  }
                />
                <ImageField
                  label={t('storefrontImage')}
                  src={item.image}
                  disabled={disabled}
                  uploading={uploading}
                  onPick={() => void setItemImage(item.category_id)}
                  onClear={() =>
                    onPatch({
                      items: (p.items || []).map((row) =>
                        row.category_id === item.category_id ? { ...row, image: null } : row,
                      ),
                    })
                  }
                />
              </div>
            )
          })}
        </>
      ) : null}

      {block.type === 'gallery' ? (
        <>
          <TextField label={t('name')} value={p.title || ''} disabled={disabled} onChange={(v) => onPatch({ title: v })} />
          <TextAreaField label={t('storefrontAbout')} value={p.body || ''} disabled={disabled} onChange={(v) => onPatch({ body: v })} />
          <TextField label={t('storefrontCta')} value={p.cta || ''} disabled={disabled} onChange={(v) => onPatch({ cta: v })} />
          <div className="flex flex-wrap gap-2">
            {(p.images || []).map((src, i) => (
              <div key={`${src}-${i}`} className="relative h-16 w-16 overflow-hidden rounded-xl">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute inset-x-0 bottom-0 bg-black/60 text-[10px] text-white"
                  disabled={disabled}
                  onClick={() => onPatch({ images: (p.images || []).filter((_, idx) => idx !== i) })}
                >
                  {t('delete')}
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost text-sm" disabled={disabled} onClick={() => void addGalleryImage()}>
            {uploading ? t('storefrontUploading') : t('storefrontAddImage')}
          </button>
        </>
      ) : null}

      {block.type === 'carousel' ? (
        <>
          {(p.slides || []).map((slide, i) => (
            <div key={i} className="space-y-2 rounded-2xl border border-line p-3">
              <img src={slide.image} alt="" className="h-24 w-full rounded-xl object-cover" />
              <TextField
                label={t('name')}
                value={slide.title || ''}
                disabled={disabled}
                onChange={(v) =>
                  onPatch({
                    slides: (p.slides || []).map((s, idx) => (idx === i ? { ...s, title: v } : s)),
                  })
                }
              />
              <TextField
                label={t('storefrontSubheadline')}
                value={slide.subtitle || ''}
                disabled={disabled}
                onChange={(v) =>
                  onPatch({
                    slides: (p.slides || []).map((s, idx) => (idx === i ? { ...s, subtitle: v } : s)),
                  })
                }
              />
              <button
                type="button"
                className="btn-ghost text-xs text-rose-600"
                disabled={disabled}
                onClick={() => onPatch({ slides: (p.slides || []).filter((_, idx) => idx !== i) })}
              >
                {t('delete')}
              </button>
            </div>
          ))}
          <button type="button" className="btn-ghost text-sm" disabled={disabled} onClick={() => void addCarouselSlide()}>
            {uploading ? t('storefrontUploading') : t('storefrontAddSlide')}
          </button>
        </>
      ) : null}

      {block.type === 'spacer' ? (
        <label className="block space-y-1">
          <span className="text-muted">{t('storefrontSpacerSize')}</span>
          <select
            className="input w-full"
            disabled={disabled}
            value={p.size || 'md'}
            onChange={(e) => onPatch({ size: e.target.value as 'sm' | 'md' | 'lg' })}
          >
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </select>
        </label>
      ) : null}

      {block.type === 'contact' ? (
        <div className="rounded-2xl border border-dashed border-line px-3 py-2 text-xs text-muted">
          {t('storefrontContactBlockHint')}
        </div>
      ) : null}
    </div>
  )
}

function TextField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  onChange: (v: string) => void
}) {
  return (
    <label className="block space-y-1">
      <span className="text-muted">{label}</span>
      <input className="input w-full" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function TextAreaField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  onChange: (v: string) => void
}) {
  return (
    <label className="block space-y-1">
      <span className="text-muted">{label}</span>
      <textarea className="input min-h-24 w-full" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function ImageField({
  label,
  src,
  disabled,
  uploading,
  onPick,
  onClear,
}: {
  label: string
  src?: string | null
  disabled?: boolean
  uploading?: boolean
  onPick: () => void
  onClear: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="space-y-2 rounded-2xl border border-line p-3">
      <div className="text-muted">{label}</div>
      {src ? <img src={src} alt="" className="h-28 w-full rounded-xl object-cover" /> : <div className="text-xs text-muted">{t('storefrontNoImage')}</div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost text-sm" disabled={disabled} onClick={onPick}>
          {uploading ? t('storefrontUploading') : t('storefrontUploadImage')}
        </button>
        {src ? (
          <button type="button" className="btn-ghost text-sm" disabled={disabled} onClick={onClear}>
            {t('storefrontRemoveImage')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
