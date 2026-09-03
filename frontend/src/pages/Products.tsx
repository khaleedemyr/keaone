import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { api, apiMessage, apiUpload } from '../api/client'
import { logMasterForm } from '../api/activity'
import { formatRupiah } from '../lib/money'
import type { ApiOk, Category, ChoiceType, CustomFieldDefinition, ItemType, Outlet, PriceChannel, Product, ProductImage, ProductOption, SubCategory, Unit } from '../types'
import { PageEnter } from '../components/motion'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { MasterFilters, MasterPager } from '../components/MasterListBar'
import { MasterModal } from '../components/MasterModal'
import { SearchSelect } from '../components/SearchSelect'
import { ImageLightbox, ProductViewModal } from '../components/ProductPreview'
import { CustomFieldsEditor } from '../components/CustomFieldsEditor'
import { useI18n } from '../i18n'
import { useAccess } from '../access'

const MAX_IMAGES = 8

const emptyForm = {
  name: '',
  description: '',
  sku: '',
  barcode: '',
  category_id: '',
  sub_category_id: '',
  unit_id: '',
  item_type_id: '',
  min_stock: '0',
  max_stock: '0',
  reorder_qty: '0',
  initial_qty: '0',
  track_stock: true,
  is_procurement_item: false,
  is_fixed_asset_item: false,
  preferred_supplier_id: '',
}

type UnitLevelDraft = {
  unit_id: string
  factor_to_base: string
}

const emptyUnitLevels = (): { small: UnitLevelDraft; medium: UnitLevelDraft; large: UnitLevelDraft } => ({
  small: { unit_id: '', factor_to_base: '1' },
  medium: { unit_id: '', factor_to_base: '' },
  large: { unit_id: '', factor_to_base: '' },
})

type DraftImage = {
  key: string
  file: File
  url: string
}

type PrimaryPick = { kind: 'existing'; id: number } | { kind: 'draft'; key: string }

type ProductTab = 'info' | 'bom' | 'choices' | 'price' | 'images'

type BomDraft = {
  key: string
  component_id: string
  qty: string
  unit_id: string
}

function newBomRow(): BomDraft {
  return { key: `bom-${Date.now()}-${Math.random()}`, component_id: '', qty: '1', unit_id: '' }
}

function coverImage(product: Product): ProductImage | undefined {
  return product.images?.find((image) => image.is_primary) ?? product.images?.[0]
}

function resolveExistingPrimaryId(
  existing: ProductImage[],
  removedIds: number[],
  primaryPick: PrimaryPick | null,
): number | null {
  const removed = new Set(removedIds)
  const remaining = existing.filter((image) => !removed.has(image.id))
  if (remaining.length === 0) return null

  if (primaryPick?.kind === 'existing' && !removed.has(primaryPick.id)) {
    return primaryPick.id
  }

  return remaining.find((image) => image.is_primary)?.id ?? remaining[0]?.id ?? null
}

export default function Products() {
  const { t, locale } = useI18n()
  const { can, hasModule } = useAccess()
  const feedback = useFeedback()
  const choicesEnabled = hasModule('choices')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [unitLevels, setUnitLevels] = useState(emptyUnitLevels)
  const [itemTypes, setItemTypes] = useState<ItemType[]>([])
  const [choiceTypes, setChoiceTypes] = useState<ChoiceType[]>([])
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [bomLines, setBomLines] = useState<BomDraft[]>([])
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<number[]>([])
  const [useChoices, setUseChoices] = useState(false)
  const [useBom, setUseBom] = useState(false)
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [priceChannels, setPriceChannels] = useState<PriceChannel[]>([])
  const [suppliers, setSuppliers] = useState<Array<{ id: number; name: string }>>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [categoryId, setCategoryId] = useState('')
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [perPage, setPerPage] = useState(20)
  const [formError, setFormError] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [viewing, setViewing] = useState<Product | null>(null)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [outletPrices, setOutletPrices] = useState<Record<number, string>>({})
  const [channelPrices, setChannelPrices] = useState<Record<number, string>>({})
  const [existingImages, setExistingImages] = useState<ProductImage[]>([])
  const [draftImages, setDraftImages] = useState<DraftImage[]>([])
  const [removedImageIds, setRemovedImageIds] = useState<number[]>([])
  const [primaryPick, setPrimaryPick] = useState<PrimaryPick | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<ProductTab>('info')
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([])
  const [customFields, setCustomFields] = useState<Record<string, string | number | boolean | null>>({})
  const lookupsLoaded = useRef(false)
  const lookupsLoading = useRef(false)

  async function load() {
    try {
      const { data } = await api.get<ApiOk<Product[]>>('/products', {
        params: {
          search: search || undefined,
          status,
          category_id: categoryId || undefined,
          page,
          per_page: perPage,
        },
      })
      const last = data.meta.last_page ?? 1
      setProducts(data.data)
      setLastPage(last)
      setTotal(data.meta.total ?? data.data.length)
      if (page > last) setPage(last)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    void api
      .get<ApiOk<Category[]>>('/categories', { params: { for_select: 1, status: 'all' }, silent: true })
      .then(({ data }) => setCategories(data.data))
      .catch((err) => feedback.error(apiMessage(err, t('loadFailed'))))
  }, [feedback, t])

  async function ensureFormLookups() {
    if (lookupsLoaded.current || lookupsLoading.current) return
    lookupsLoading.current = true
    try {
      const [subs, unitRes, itemTypeRes, choiceRes, outletRes, channelRes, productRes, supplierRes] = await Promise.all([
        api.get<ApiOk<SubCategory[]>>('/subcategories', { params: { for_select: 1, status: 'all' }, silent: true }),
        api.get<ApiOk<Unit[]>>('/units', { params: { for_select: 1, status: 'all' }, silent: true }),
        api.get<ApiOk<ItemType[]>>('/item-types', { params: { for_select: 1, status: 'all' }, silent: true }),
        api.get<ApiOk<ChoiceType[]>>('/choice-types', { params: { for_select: 1, with_choices: 1, status: 'all' }, silent: true }),
        api.get<ApiOk<Outlet[]>>('/outlets', { params: { for_select: 1, status: 'all' }, silent: true }),
        api.get<ApiOk<PriceChannel[]>>('/price-channels', { params: { for_select: 1, status: 'all' }, silent: true }),
        api.get<ApiOk<ProductOption[]>>('/products', { params: { for_select: 1, status: 'all' }, silent: true }),
        api.get<ApiOk<Array<{ id: number; name: string }>>>('/suppliers', { params: { for_select: 1, status: 'active', per_page: 200 }, silent: true }),
      ])
      setSubCategories(subs.data.data)
      setUnits(unitRes.data.data)
      setItemTypes(itemTypeRes.data.data)
      setChoiceTypes(choiceRes.data.data)
      setOutlets(outletRes.data.data)
      setPriceChannels(channelRes.data.data)
      setProductOptions(productRes.data.data)
      setSuppliers(supplierRes.data.data ?? [])
      lookupsLoaded.current = true
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    } finally {
      lookupsLoading.current = false
    }
  }

  useEffect(() => {
    if (!open) return
    void ensureFormLookups()
    void api
      .get<ApiOk<CustomFieldDefinition[]>>('/custom-fields', {
        params: { for_form: 1, for_select: 1, entity: 'product' },
        silent: true,
      })
      .then(({ data }) => setCustomFieldDefs(data.data))
      .catch(() => setCustomFieldDefs([]))
  }, [open])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load()
    }, 200)
    return () => window.clearTimeout(handle)
  }, [search, status, categoryId, page, perPage])

  useEffect(() => {
    if (!open) return
    setOutletPrices((current) => {
      const next = { ...current }
      let changed = false
      for (const outlet of outlets.filter((item) => item.is_active !== false)) {
        if (next[outlet.id] === undefined) {
          next[outlet.id] = editing ? String(editing.default_sell_price ?? editing.sell_price ?? '') : ''
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [open, outlets, editing])

  useEffect(() => {
    return () => {
      draftImages.forEach((item) => URL.revokeObjectURL(item.url))
    }
  }, [draftImages])

  const activeOutlets = useMemo(
    () => outlets.filter((item) => item.is_active !== false).sort((a, b) => Number(b.is_default) - Number(a.is_default)),
    [outlets],
  )

  const activeChannels = useMemo(
    () => priceChannels.filter((item) => item.is_active !== false),
    [priceChannels],
  )

  function priceMapFor(product?: Product | null): Record<number, string> {
    const next: Record<number, string> = {}
    const fallback = product ? String(product.default_sell_price ?? product.sell_price ?? '') : ''
    for (const outlet of outlets.filter((item) => item.is_active !== false || product?.outlet_prices?.some((row) => row.outlet_id === item.id))) {
      const found = product?.outlet_prices?.find((row) => row.outlet_id === outlet.id)
      next[outlet.id] = found ? String(found.sell_price) : fallback
    }
    return next
  }

  function resetImages() {
    setDraftImages((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.url))
      return []
    })
    setExistingImages([])
    setRemovedImageIds([])
    setPrimaryPick(null)
  }

  function imageUrls(product: Product) {
    return (product.images ?? []).map((image) => image.url).filter((url): url is string => Boolean(url))
  }

  async function loadDetail(product: Product) {
    const { data } = await api.get<ApiOk<Product>>(`/products/${product.id}`)
    return data.data
  }

  function openLightbox(product: Product, startUrl?: string) {
    const urls = imageUrls(product)
    if (urls.length === 0) return
    const index = startUrl ? Math.max(0, urls.indexOf(startUrl)) : 0
    setLightbox({ urls, index })
  }

  async function openView(product: Product) {
    try {
      setViewing(await loadDetail(product))
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setUnitLevels(emptyUnitLevels())
    setCustomFields({})
    setOutletPrices(priceMapFor(null))
    setChannelPrices({})
    setSelectedChoiceIds([])
    setBomLines([])
    setUseChoices(false)
    setUseBom(false)
    resetImages()
    setFormError('')
    setTab('info')
    setOpen(true)
    logMasterForm('product', 'create')
  }

  async function openEdit(product: Product) {
    try {
      const full = await loadDetail(product)
      applyEdit(full)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  function applyEdit(product: Product) {
    setEditing(product)
    const nextLevels = emptyUnitLevels()
    for (const row of product.units ?? []) {
      const level = row.level
      if (level === 'small' || level === 'medium' || level === 'large') {
        nextLevels[level] = {
          unit_id: String(row.unit_id),
          factor_to_base: String(row.factor_to_base || (level === 'small' ? 1 : '')),
        }
      }
    }
    if (!nextLevels.small.unit_id && product.unit_id) {
      nextLevels.small.unit_id = String(product.unit_id)
    }
    setUnitLevels(nextLevels)
    setForm({
      name: product.name,
      description: product.description ?? '',
      sku: product.sku ?? '',
      barcode: product.barcode ?? '',
      category_id: product.category_id ? String(product.category_id) : '',
      sub_category_id: product.sub_category_id ? String(product.sub_category_id) : '',
      unit_id: nextLevels.small.unit_id || (product.unit_id ? String(product.unit_id) : ''),
      item_type_id: product.item_type_id ? String(product.item_type_id) : '',
      min_stock: String(product.min_stock),
      max_stock: String(product.max_stock ?? 0),
      reorder_qty: String(product.reorder_qty ?? 0),
      initial_qty: '0',
      track_stock: product.track_stock,
      is_procurement_item: product.is_procurement_item ?? false,
      is_fixed_asset_item: product.is_fixed_asset_item ?? false,
      preferred_supplier_id: product.preferred_supplier_id ? String(product.preferred_supplier_id) : '',
    })
    setOutletPrices(priceMapFor(product))
    setChannelPrices(
      Object.fromEntries((product.channel_prices ?? []).map((row) => [row.price_channel_id, String(row.sell_price)])),
    )
    setSelectedChoiceIds(product.choice_ids ?? [])
    setBomLines(
      (product.bom_items ?? []).map((row) => ({
        key: `bom-${row.id}`,
        component_id: String(row.component_id),
        qty: String(row.qty),
        unit_id: row.unit_id ? String(row.unit_id) : '',
      })),
    )
    setUseChoices((product.choice_ids ?? []).length > 0 || (product.choice_types ?? []).length > 0)
    setUseBom(Boolean(product.has_bom) || (product.bom_items ?? []).length > 0)
    setCustomFields({ ...(product.custom_fields ?? {}) })
    setDraftImages((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.url))
      return []
    })
    setExistingImages(product.images ?? [])
    setRemovedImageIds([])
    const cover = coverImage(product)
    setPrimaryPick(cover ? { kind: 'existing', id: cover.id } : null)
    setFormError('')
    setTab('info')
    setOpen(true)
    const ref = product.sku ? `${product.name} (${product.sku})` : product.name
    logMasterForm('product', 'edit', ref)
  }

  function onPickImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return
    const room = MAX_IMAGES - existingImages.length - draftImages.length
    if (room <= 0) {
      setFormError(t('maxProductImages', { n: String(MAX_IMAGES) }))
      return
    }
    const accepted = files.slice(0, room).filter((file) => file.type.startsWith('image/'))
    const added = accepted.map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
    }))
    setDraftImages((current) => [...current, ...added])
    setPrimaryPick((current) => current ?? (added[0] ? { kind: 'draft', key: added[0].key } : null))
  }

  function pickNextPrimary(existing: ProductImage[], drafts: DraftImage[], removedId?: number, removedKey?: string) {
    const remainExisting = existing.filter((item) => item.id !== removedId)
    const remainDrafts = drafts.filter((item) => item.key !== removedKey)
    if (remainExisting[0]) return { kind: 'existing' as const, id: remainExisting[0].id }
    if (remainDrafts[0]) return { kind: 'draft' as const, key: remainDrafts[0].key }
    return null
  }

  function removeExisting(image: ProductImage) {
    setExistingImages((current) => {
      const next = current.filter((item) => item.id !== image.id)
      setDraftImages((drafts) => {
        setPrimaryPick((pick) =>
          pick?.kind === 'existing' && pick.id === image.id ? pickNextPrimary(next, drafts, image.id) : pick,
        )
        return drafts
      })
      return next
    })
    setRemovedImageIds((current) => [...current, image.id])
  }

  function removeDraft(key: string) {
    setDraftImages((current) => {
      const found = current.find((item) => item.key === key)
      if (found) URL.revokeObjectURL(found.url)
      const next = current.filter((item) => item.key !== key)
      setExistingImages((existing) => {
        setPrimaryPick((pick) =>
          pick?.kind === 'draft' && pick.key === key ? pickNextPrimary(existing, next, undefined, key) : pick,
        )
        return existing
      })
      return next
    })
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError('')

    const prices = activeOutlets
      .map((outlet) => ({
        outlet_id: outlet.id,
        sell_price: Number(outletPrices[outlet.id] || 0),
      }))
      .filter((row) => Number.isFinite(row.sell_price) && String(outletPrices[row.outlet_id] ?? '') !== '')

    const defaultOutlet = activeOutlets.find((item) => item.is_default) ?? activeOutlets[0]
    const sellPrice = defaultOutlet
      ? Number(outletPrices[defaultOutlet.id] || prices[0]?.sell_price || 0)
      : Number(prices[0]?.sell_price || 0)

    const unitsPayload = (['small', 'medium', 'large'] as const)
      .filter((level) => unitLevels[level].unit_id)
      .map((level) => ({
        level,
        unit_id: Number(unitLevels[level].unit_id),
        factor_to_base: level === 'small' ? 1 : Number(unitLevels[level].factor_to_base || 0),
      }))

    if (!unitLevels.small.unit_id) {
      setFormError(t('productUnitSmallRequired'))
      setSaving(false)
      return
    }
    if (unitLevels.medium.unit_id && Number(unitLevels.medium.factor_to_base || 0) < 2) {
      setFormError(t('productUnitFactorInvalid'))
      setSaving(false)
      return
    }
    if (unitLevels.large.unit_id) {
      if (!unitLevels.medium.unit_id || Number(unitLevels.large.factor_to_base || 0) <= Number(unitLevels.medium.factor_to_base || 0)) {
        setFormError(t('productUnitLargeInvalid'))
        setSaving(false)
        return
      }
    }

    const payload = {
      name: form.name,
      description: form.description.trim() === '' ? null : form.description.trim(),
      sku: form.sku.trim() === '' ? null : form.sku.trim(),
      barcode: form.barcode.trim() === '' ? null : form.barcode.trim(),
      category_id: form.category_id ? Number(form.category_id) : null,
      sub_category_id: form.sub_category_id ? Number(form.sub_category_id) : null,
      unit_id: Number(unitLevels.small.unit_id),
      units: unitsPayload,
      item_type_id: form.item_type_id ? Number(form.item_type_id) : null,
      sell_price: sellPrice,
      outlet_prices: prices,
      channel_prices: activeChannels
        .filter((channel) => String(channelPrices[channel.id] ?? '').trim() !== '')
        .map((channel) => ({
          price_channel_id: channel.id,
          sell_price: Number(channelPrices[channel.id] || 0),
        }))
        .filter((row) => Number.isFinite(row.sell_price)),
      min_stock: Number(form.min_stock || 0),
      max_stock: Number(form.max_stock || 0),
      reorder_qty: Number(form.reorder_qty || 0),
      track_stock: form.is_procurement_item || form.is_fixed_asset_item ? false : form.track_stock,
      is_procurement_item: form.is_procurement_item,
      is_fixed_asset_item: form.is_fixed_asset_item,
      preferred_supplier_id: form.preferred_supplier_id ? Number(form.preferred_supplier_id) : null,
      initial_qty: Number(form.initial_qty || 0),
      custom_fields: customFields,
      choice_ids: useChoices && choicesEnabled ? selectedChoiceIds : [],
      bom_items: useBom
        ? bomLines
            .filter((row) => row.component_id && Number(row.qty) > 0)
            .map((row) => ({
              component_id: Number(row.component_id),
              qty: Number(row.qty),
              unit_id: row.unit_id ? Number(row.unit_id) : null,
            }))
        : [],
    }

    try {
      const saved = editing
        ? await api.put<ApiOk<Product>>(`/products/${editing.id}`, payload)
        : await api.post<ApiOk<Product>>('/products', payload)
      const productId = saved.data.data.id

      for (const imageId of removedImageIds) {
        await api.delete(`/products/${productId}/images/${imageId}`)
      }

      if (draftImages.length > 0) {
        const body = new FormData()
        draftImages.forEach((item) => body.append('images[]', item.file))
        const primaryIndex =
          primaryPick?.kind === 'draft' ? draftImages.findIndex((item) => item.key === primaryPick.key) : -1
        if (primaryIndex >= 0) body.append('primary_index', String(primaryIndex))
        await apiUpload(`/products/${productId}/images`, body)
      }

      const wantsDraftPrimary = primaryPick?.kind === 'draft' && draftImages.length > 0
      const primaryExistingId = wantsDraftPrimary
        ? null
        : resolveExistingPrimaryId(existingImages, removedImageIds, primaryPick)
      if (primaryExistingId) {
        await api.post(`/products/${productId}/images/${primaryExistingId}/primary`)
      }

      setOpen(false)
      resetImages()
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setFormError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove(product: Product) {
    const ok = await feedback.confirm({
      title: t('deleteTitle'),
      message: t('deleteConfirm', { name: product.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/products/${product.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(product: Product) {
    try {
      await api.put(`/products/${product.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  const formCategories = categories.filter((c) => c.is_active || String(c.id) === form.category_id)
  const formUnits = units.filter(
    (u) =>
      u.is_active ||
      [unitLevels.small.unit_id, unitLevels.medium.unit_id, unitLevels.large.unit_id, form.unit_id].includes(String(u.id)),
  )
  const formItemTypes = itemTypes.filter((item) => item.is_active || String(item.id) === form.item_type_id)
  const formSubCategories = subCategories.filter(
    (item) =>
      String(item.category_id) === form.category_id && (item.is_active || String(item.id) === form.sub_category_id),
  )
  const formChoiceTypes = choiceTypes.filter(
    (type) => type.is_active || (type.choices ?? []).some((choice) => selectedChoiceIds.includes(choice.id)),
  )

  function choiceIdsOf(type: ChoiceType) {
    return (type.choices ?? [])
      .filter((choice) => choice.is_active || selectedChoiceIds.includes(choice.id))
      .map((choice) => choice.id)
  }

  function isTypePaired(type: ChoiceType) {
    return choiceIdsOf(type).some((id) => selectedChoiceIds.includes(id))
  }

  function toggleChoice(id: number) {
    setSelectedChoiceIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function pairChoiceType(type: ChoiceType) {
    const ids = choiceIdsOf(type)
    setSelectedChoiceIds((current) => [...new Set([...current, ...ids])])
  }

  function unpairChoiceType(type: ChoiceType) {
    const ids = new Set((type.choices ?? []).map((choice) => choice.id))
    setSelectedChoiceIds((current) => current.filter((id) => !ids.has(id)))
  }

  function updateBomLine(key: string, patch: Partial<BomDraft>) {
    setBomLines((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function pickBomComponent(key: string, componentId: string) {
    const picked = productOptions.find((item) => String(item.id) === componentId)
    updateBomLine(key, {
      component_id: componentId,
      unit_id: picked?.unit_id ? String(picked.unit_id) : '',
    })
  }

  function bomOptionsFor(row: BomDraft) {
    const taken = new Set(bomLines.filter((item) => item.key !== row.key && item.component_id).map((item) => item.component_id))
    const selfId = editing ? String(editing.id) : ''
    return productOptions.filter(
      (item) =>
        String(item.id) !== selfId &&
        (item.is_active || String(item.id) === row.component_id) &&
        (!taken.has(String(item.id)) || String(item.id) === row.component_id),
    )
  }

  function toggleAllInType(type: ChoiceType) {
    const ids = choiceIdsOf(type)
    const allOn = ids.length > 0 && ids.every((id) => selectedChoiceIds.includes(id))
    if (allOn) {
      setSelectedChoiceIds((current) => current.filter((id) => !ids.includes(id)))
      return
    }
    pairChoiceType(type)
  }

  function setExtraTab(kind: 'choices' | 'bom', on: boolean) {
    if (kind === 'choices') setUseChoices(on)
    else {
      setUseBom(on)
      if (on && bomLines.length === 0) setBomLines([newBomRow()])
    }
    if (on) setTab(kind)
    else if (tab === kind) setTab('info')
  }
  const totalImages = existingImages.length + draftImages.length
  const canEdit = can('products', 'edit')
  const canDelete = can('products', 'delete')
  const showActions = canEdit || canDelete

  return (
    <PageEnter>
      <PageHeader
        eyebrow={t('productsEyebrow')}
        title={t('productsTitle')}
        subtitle={t('productsSubtitle')}
        action={
          can('products', 'create') ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              {t('addProduct')}
            </button>
          ) : undefined
        }
      />

      <MasterFilters
        search={search}
        onSearch={(value) => {
          setPage(1)
          setSearch(value)
        }}
        searchPlaceholder={t('searchProduct')}
        status={status}
        onStatus={(value) => {
          setPage(1)
          setStatus(value)
        }}
        perPage={perPage}
        onPerPage={(value) => {
          setPage(1)
          setPerPage(value)
        }}
        extra={
          <select
            className="field !mt-0 max-w-[12rem]"
            value={categoryId}
            onChange={(e) => {
              setPage(1)
              setCategoryId(e.target.value)
            }}
          >
            <option value="">{t('allCategories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.is_active ? c.name : `${c.name} (${t('inactive')})`}
              </option>
            ))}
          </select>
        }
      />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('product')}</th>
              <th className="px-4 py-3 font-medium">{t('sku')}</th>
              <th className="px-4 py-3 font-medium">{t('price')}</th>
              <th className="px-4 py-3 font-medium">{t('minStock')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              {showActions ? <th className="px-4 py-3 font-medium"></th> : null}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const cover = coverImage(product)
              return (
              <tr key={product.id} className="border-t border-line hover:bg-fill">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {cover?.url ? (
                      <button
                        type="button"
                        className="shrink-0"
                        onClick={() => openLightbox(product, cover.url)}
                      >
                        <img
                          src={cover.url}
                          alt=""
                          className="h-11 w-11 rounded-xl object-cover"
                        />
                      </button>
                    ) : (
                      <div className="bg-fill text-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs">
                        —
                      </div>
                    )}
                    <div>
                      <button
                        type="button"
                        className="font-medium text-fg hover:text-mint"
                        onClick={() => void openView(product)}
                      >
                        {product.name}
                      </button>
                      <div className="text-xs text-muted">
                        {[product.category?.name, product.sub_category?.name].filter(Boolean).join(' Â· ') || '-'}
                      </div>
                      {(product.choice_types ?? []).length > 0 || product.has_bom ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {product.choice_types?.map((type) => (
                            <span key={type.id} className="rounded-full bg-fill px-2 py-0.5 text-[11px] text-muted">
                              {type.name}
                            </span>
                          ))}
                          {product.has_bom ? (
                            <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] text-muted">
                              {t('productTabBom')}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{product.sku ?? '-'}</td>
                <td className="px-4 py-3 text-mint">{formatRupiah(product.sell_price, locale)}</td>
                <td className="px-4 py-3 text-fg">{product.min_stock}</td>
                <td className="px-4 py-3">
                  <span className={product.is_active ? 'text-mint' : 'text-rose-300'}>
                    {product.is_active ? t('active') : t('inactive')}
                  </span>
                </td>
                {showActions ? (
                <td className="px-4 py-3 text-right">
                  {canEdit ? (
                    <button type="button" className="mr-3 text-mint" onClick={() => void openEdit(product)}>
                      {t('edit')}
                    </button>
                  ) : null}
                  {product.is_active && canDelete ? (
                    <button type="button" className="text-rose-300" onClick={() => void remove(product)}>
                      {t('delete')}
                    </button>
                  ) : null}
                  {!product.is_active && canEdit ? (
                    <button type="button" className="text-mint" onClick={() => void activate(product)}>
                      {t('activate')}
                    </button>
                  ) : null}
                </td>
                ) : null}
              </tr>
              )
            })}
            {products.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={showActions ? 6 : 5}>
                  {t('emptyMaster')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <MasterPager page={page} lastPage={lastPage} total={total} onPage={setPage} />

      <MasterModal
        open={open}
        title={editing ? t('editProduct') : t('newProduct')}
        error={formError}
        saving={saving}
        onClose={() => {
          setOpen(false)
          resetImages()
        }}
        onSubmit={(e) => void onSubmit(e)}
        onInvalid={(event) => {
          const field = event.target as HTMLElement
          const panel = field.closest('[data-product-tab]') as HTMLElement | null
          const next = panel?.dataset.productTab
          if (next === 'info' || next === 'bom' || next === 'choices' || next === 'price' || next === 'images') {
            setTab(next)
          }
        }}
        size="2xl"
        tabs={
          <div className="os-acl-tabs">
            {(
              [
                ['info', 'productTabInfo'],
                ...(useBom ? ([['bom', 'productTabBom']] as const) : []),
                ...(useChoices && choicesEnabled ? ([['choices', 'productTabChoices']] as const) : []),
                ['price', 'productTabPrice'],
                ['images', 'productTabImages'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`os-acl-tab ${tab === id ? 'is-active' : ''}`}
                onClick={() => setTab(id)}
              >
                {t(label)}
              </button>
            ))}
          </div>
        }
      >
        <div className={tab === 'info' ? 'grid gap-3 sm:grid-cols-2' : 'hidden'} data-product-tab="info">
          <label className="text-sm text-muted sm:col-span-2">
            {t('name')}
            <input
              required
              className="field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="text-sm text-muted sm:col-span-2">
            {t('productDescription')}
            <textarea
              rows={3}
              className="field min-h-[5.5rem] resize-y"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="text-sm text-muted">
            {t('sku')}
            <input className="field" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </label>
          <label className="text-sm text-muted">
            {t('barcode')}
            <input className="field" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          </label>
          <label className="text-sm text-muted">
            {t('category')}
            <select
              className="field"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value, sub_category_id: '' })}
            >
              <option value="">-</option>
              {formCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.is_active ? c.name : `${c.name} (${t('inactive')})`}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-muted">
            {t('subCategory')}
            <select
              className="field"
              value={form.sub_category_id}
              disabled={!form.category_id}
              onChange={(e) => setForm({ ...form, sub_category_id: e.target.value })}
            >
              <option value="">-</option>
              {formSubCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.is_active ? item.name : `${item.name} (${t('inactive')})`}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-full space-y-3 rounded-2xl border border-line bg-fill/40 p-3">
            <div>
              <div className="text-sm font-medium text-fg">{t('productUnitsTitle')}</div>
              <div className="mt-0.5 text-xs text-muted">{t('productUnitsHint')}</div>
            </div>
            {(
              [
                { level: 'small' as const, label: t('productUnitSmall'), required: true },
                { level: 'medium' as const, label: t('productUnitMedium'), required: false },
                { level: 'large' as const, label: t('productUnitLarge'), required: false },
              ] as const
            ).map(({ level, label, required }) => (
              <div key={level} className="grid gap-2 sm:grid-cols-[120px_1fr_140px] sm:items-end">
                <div className="text-sm font-medium text-fg">
                  {label}
                  {required ? ' *' : ''}
                </div>
                <label className="text-sm text-muted">
                  {t('unit')}
                  <select
                    required={required}
                    className="field"
                    value={unitLevels[level].unit_id}
                    onChange={(e) => {
                      const unit_id = e.target.value
                      setUnitLevels((current) => ({
                        ...current,
                        [level]: { ...current[level], unit_id },
                      }))
                      if (level === 'small') setForm((current) => ({ ...current, unit_id }))
                    }}
                  >
                    <option value="">{required ? t('selectUnit') : '—'}</option>
                    {formUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.is_active
                          ? unit.symbol
                            ? `${unit.name} (${unit.symbol})`
                            : unit.name
                          : `${unit.name} (${t('inactive')})`}
                      </option>
                    ))}
                  </select>
                </label>
                {level === 'small' ? (
                  <div className="text-xs text-muted sm:pb-3">{t('productUnitBaseNote')}</div>
                ) : (
                  <label className="text-sm text-muted">
                    {t('productUnitFactor')}
                    <input
                      type="number"
                      min={2}
                      className="field"
                      disabled={!unitLevels[level].unit_id}
                      value={unitLevels[level].factor_to_base}
                      onChange={(e) =>
                        setUnitLevels((current) => ({
                          ...current,
                          [level]: { ...current[level], factor_to_base: e.target.value },
                        }))
                      }
                      placeholder={t('productUnitFactorPlaceholder')}
                    />
                  </label>
                )}
              </div>
            ))}
            {formUnits.length === 0 ? <div className="text-xs text-muted">{t('noUnits')}</div> : null}
          </div>
          <label className="text-sm text-muted">
            {t('itemType')}
            <select
              className="field"
              value={form.item_type_id}
              onChange={(e) => setForm({ ...form, item_type_id: e.target.value })}
            >
              <option value="">{t('selectItemType')}</option>
              {formItemTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.is_active ? item.name : `${item.name} (${t('inactive')})`}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-muted">
            {t('minStock')}
            <input
              type="number"
              min={0}
              className="field"
              value={form.min_stock}
              onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
            />
          </label>
          <label className="text-sm text-muted">
            {t('maxStock')}
            <input
              type="number"
              min={0}
              className="field"
              value={form.max_stock}
              onChange={(e) => setForm({ ...form, max_stock: e.target.value })}
            />
            <span className="mt-1 block text-xs">{t('maxStockHint')}</span>
          </label>
          {form.track_stock && !form.is_procurement_item && !form.is_fixed_asset_item ? (
            <label className="text-sm text-muted">
              {t('reorderQty')}
              <input
                type="number"
                min={0}
                className="field"
                value={form.reorder_qty}
                onChange={(e) => setForm({ ...form, reorder_qty: e.target.value })}
              />
              <span className="mt-1 block text-xs">{t('reorderQtyHint')}</span>
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_procurement_item}
              disabled={form.is_fixed_asset_item}
              onChange={(e) =>
                setForm({
                  ...form,
                  is_procurement_item: e.target.checked,
                  is_fixed_asset_item: e.target.checked ? false : form.is_fixed_asset_item,
                  track_stock: e.target.checked ? false : form.track_stock,
                })
              }
            />
            <span>
              <span className="text-fg">{t('productProcurementItem')}</span>
              <span className="mt-0.5 block text-xs">{t('productProcurementItemHint')}</span>
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_fixed_asset_item}
              disabled={form.is_procurement_item}
              onChange={(e) =>
                setForm({
                  ...form,
                  is_fixed_asset_item: e.target.checked,
                  is_procurement_item: e.target.checked ? false : form.is_procurement_item,
                  track_stock: e.target.checked ? false : form.track_stock,
                })
              }
            />
            <span>
              <span className="text-fg">{t('productFixedAssetItem')}</span>
              <span className="mt-0.5 block text-xs">{t('productFixedAssetItemHint')}</span>
            </span>
          </label>
          <label className="block text-sm text-muted sm:col-span-2">
            {t('productPreferredSupplier')}
            <SearchSelect
              className="!mt-0"
              value={form.preferred_supplier_id}
              onChange={(value) => setForm({ ...form, preferred_supplier_id: value })}
              options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
              placeholder={t('purchaseSelectSupplier')}
              allowEmpty
              emptyLabel={t('filterAll')}
            />
            <span className="mt-0.5 block text-xs">{t('productPreferredSupplierHint')}</span>
          </label>
          {!editing ? (
            <label className="text-sm text-muted">
              {t('initialStock')}
              <input
                type="number"
                min={0}
                className="field"
                value={form.initial_qty}
                onChange={(e) => setForm({ ...form, initial_qty: e.target.value })}
              />
            </label>
          ) : null}
          <div className="sm:col-span-2 grid gap-2">
            <div className="text-xs text-muted">{t('useProductExtraHint')}</div>
            {choicesEnabled ? (
              <button
                type="button"
                className="glass flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left"
                onClick={() => setExtraTab('choices', !useChoices)}
              >
                <span className="text-sm font-medium text-fg">{t('useProductChoices')}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs ${useChoices ? 'bg-mint/15 text-mint' : 'bg-fill text-muted'}`}>
                  {useChoices ? t('active') : t('inactive')}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className="glass flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left"
              onClick={() => setExtraTab('bom', !useBom)}
            >
              <span className="text-sm font-medium text-fg">{t('useProductBom')}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${useBom ? 'bg-mint/15 text-mint' : 'bg-fill text-muted'}`}>
                {useBom ? t('active') : t('inactive')}
              </span>
            </button>
          </div>
          <CustomFieldsEditor fields={customFieldDefs} values={customFields} onChange={setCustomFields} />
        </div>

        {useBom ? (
        <div className={tab === 'bom' ? 'grid gap-3' : 'hidden'} data-product-tab="bom">
          <div className="text-xs text-muted">{t('bomHint')}</div>
          {bomLines.length === 0 ? (
            <div className="rounded-2xl bg-fill px-3 py-3 text-xs text-muted">{t('noBom')}</div>
          ) : (
            <div className="grid gap-2">
              {bomLines.map((row) => {
                const options = bomOptionsFor(row)
                return (
                  <div key={row.key} className="grid gap-2 rounded-2xl bg-fill px-3 py-3 sm:grid-cols-[1fr_6rem_7rem_auto]">
                    <label className="text-xs text-muted">
                      {t('bomComponent')}
                      <SearchSelect
                        required
                        value={row.component_id}
                        placeholder={t('selectBomComponent')}
                        onChange={(value) => pickBomComponent(row.key, value)}
                        options={options.map((item) => ({
                          value: String(item.id),
                          label: item.is_active ? item.name : `${item.name} (${t('inactive')})`,
                          keywords: `${item.sku ?? ''} ${item.unit ?? ''}`,
                        }))}
                      />
                    </label>
                    <label className="text-xs text-muted">
                      {t('bomQty')}
                      <input
                        required
                        type="number"
                        min={0.0001}
                        step="any"
                        className="field"
                        value={row.qty}
                        onChange={(e) => updateBomLine(row.key, { qty: e.target.value })}
                      />
                    </label>
                    <label className="text-xs text-muted">
                      {t('unit')}
                      <SearchSelect
                        allowEmpty
                        emptyLabel="-"
                        value={row.unit_id}
                        placeholder={t('selectUnit')}
                        onChange={(value) => updateBomLine(row.key, { unit_id: value })}
                        options={formUnits.map((unit) => ({
                          value: String(unit.id),
                          label: unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name,
                          keywords: unit.symbol ?? '',
                        }))}
                      />
                    </label>
                    <button
                      type="button"
                      className="self-end pb-2 text-xs text-rose-300"
                      onClick={() => setBomLines((current) => current.filter((item) => item.key !== row.key))}
                    >
                      {t('removeBomLine')}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <button type="button" className="text-sm text-mint" onClick={() => setBomLines((current) => [...current, newBomRow()])}>
            {t('addBomLine')}
          </button>
        </div>
        ) : null}

        {useChoices && choicesEnabled ? (
        <div className={tab === 'choices' ? 'grid gap-3' : 'hidden'} data-product-tab="choices">
          <div className="text-xs text-muted">{t('productChoicesHint')}</div>
          {formChoiceTypes.length === 0 ? (
            <div className="rounded-2xl bg-fill px-3 py-3 text-xs text-muted">{t('noChoiceTypes')}</div>
          ) : (
            <div className="grid gap-2">
              {formChoiceTypes.map((type) => {
                const options = (type.choices ?? []).filter(
                  (choice) => choice.is_active || selectedChoiceIds.includes(choice.id),
                )
                const paired = isTypePaired(type)
                const selectedCount = options.filter((choice) => selectedChoiceIds.includes(choice.id)).length
                const allOn = options.length > 0 && selectedCount === options.length
                const maxLabel = type.max_select === 0 ? t('unlimited') : String(type.max_select)
                return (
                  <div key={type.id} className="rounded-2xl bg-fill px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-fg">{type.name}</div>
                        <div className="text-xs text-muted">
                          {type.is_required ? t('choiceRequired') : t('choiceOptional')}
                          {' Â· '}
                          {t('maxSelect')} {maxLabel}
                          {paired ? ` Â· ${selectedCount}/${options.length}` : ''}
                        </div>
                      </div>
                      {paired ? (
                        <button type="button" className="text-xs text-rose-300" onClick={() => unpairChoiceType(type)}>
                          {t('unpairChoiceType')}
                        </button>
                      ) : (
                        <button type="button" className="text-xs text-mint" onClick={() => pairChoiceType(type)}>
                          {t('pairChoiceType')}
                        </button>
                      )}
                    </div>
                    {paired ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {options.length > 1 ? (
                          <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2">
                            <input type="checkbox" checked={allOn} onChange={() => toggleAllInType(type)} />
                            {t('selectAllChoices')}
                          </label>
                        ) : null}
                        {options.map((choice) => (
                          <label key={choice.id} className="flex items-center gap-2 text-sm text-fg">
                            <input
                              type="checkbox"
                              checked={selectedChoiceIds.includes(choice.id)}
                              onChange={() => toggleChoice(choice.id)}
                            />
                            <span>
                              {choice.name}
                              {choice.is_active ? '' : ` (${t('inactive')})`}
                            </span>
                            <span className="text-xs text-muted">
                              {choice.extra_price > 0
                                ? `+ ${formatRupiah(choice.extra_price, locale)}`
                                : t('extraPriceNone')}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        ) : null}

        <div className={tab === 'price' ? 'grid gap-3' : 'hidden'} data-product-tab="price">
          {activeOutlets.length > 1 ? (
            <div className="text-sm text-muted">{t('outletPrices')}</div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {(activeOutlets.length > 0 ? activeOutlets : [{ id: 0, name: t('sellPrice') }]).map((outlet) => (
              <label key={outlet.id} className="text-sm text-muted">
                {activeOutlets.length > 1 ? outlet.name : t('sellPrice')}
                <input
                  required
                  type="number"
                  min={0}
                  className="field"
                  value={outlet.id ? (outletPrices[outlet.id] ?? '') : ''}
                  onChange={(e) =>
                    setOutletPrices((current) => ({
                      ...current,
                      [outlet.id || 0]: e.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          {activeChannels.length > 0 ? (
            <>
              <div className="mt-2 text-sm text-muted">{t('channelPrices')}</div>
              <div className="text-xs text-muted">{t('channelPricesHint')}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {activeChannels.map((channel) => (
                  <label key={channel.id} className="text-sm text-muted">
                    {channel.name}
                    <input
                      type="number"
                      min={0}
                      className="field"
                      placeholder={t('channelPriceInherit')}
                      value={channelPrices[channel.id] ?? ''}
                      onChange={(e) =>
                        setChannelPrices((current) => ({
                          ...current,
                          [channel.id]: e.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className={tab === 'images' ? 'grid gap-3' : 'hidden'} data-product-tab="images">
          <div className="text-sm text-muted">{t('productImages')}</div>
          <div className="flex flex-wrap gap-2">
            {existingImages.map((image) => {
              const selected = primaryPick?.kind === 'existing' && primaryPick.id === image.id
              return (
                <div key={image.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setPrimaryPick({ kind: 'existing', id: image.id })}
                    className={`block overflow-hidden rounded-xl ${selected ? 'ring-2 ring-mint' : 'ring-1 ring-line'}`}
                  >
                    <img src={image.url} alt="" className="h-20 w-20 object-cover" />
                    {selected ? (
                      <span className="absolute bottom-1 left-1 rounded bg-mint px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                        {t('primaryImage')}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs text-white"
                    onClick={() => removeExisting(image)}
                    aria-label={t('removeImage')}
                  >
                    Ã—
                  </button>
                </div>
              )
            })}
            {draftImages.map((image) => {
              const selected = primaryPick?.kind === 'draft' && primaryPick.key === image.key
              return (
                <div key={image.key} className="relative">
                  <button
                    type="button"
                    onClick={() => setPrimaryPick({ kind: 'draft', key: image.key })}
                    className={`block overflow-hidden rounded-xl ${selected ? 'ring-2 ring-mint' : 'ring-1 ring-line'}`}
                  >
                    <img src={image.url} alt="" className="h-20 w-20 object-cover" />
                    {selected ? (
                      <span className="absolute bottom-1 left-1 rounded bg-mint px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                        {t('primaryImage')}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs text-white"
                    onClick={() => removeDraft(image.key)}
                    aria-label={t('removeImage')}
                  >
                    Ã—
                  </button>
                </div>
              )
            })}
            {totalImages < MAX_IMAGES ? (
              <label className="border-line text-muted hover:border-mint/50 flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border border-dashed text-xl">
                +
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onPickImages} />
              </label>
            ) : null}
          </div>
          <div className="text-xs text-muted">{t('maxProductImages', { n: String(MAX_IMAGES) })}</div>
          {totalImages > 1 ? <div className="text-xs text-muted">{t('pickPrimaryImage')}</div> : null}
        </div>
      </MasterModal>

      {viewing ? (
        <ProductViewModal
          product={viewing}
          outlets={outlets}
          onClose={() => setViewing(null)}
          onEdit={
            canEdit
              ? () => {
                  const product = viewing
                  setViewing(null)
                  void openEdit(product)
                }
              : undefined
          }
          onOpenImage={(index) => {
            const urls = imageUrls(viewing)
            if (urls[index]) setLightbox({ urls, index })
          }}
        />
      ) : null}

      {lightbox ? (
        <ImageLightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndex={(index) => setLightbox((current) => (current ? { ...current, index } : current))}
        />
      ) : null}
    </PageEnter>
  )
}
