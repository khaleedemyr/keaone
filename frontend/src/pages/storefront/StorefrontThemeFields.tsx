import { useEffect, useMemo, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import { SearchMultiSelect } from '../../components/SearchMultiSelect'
import { useI18n } from '../../i18n'
import type { ApiOk, Category } from '../../types'
import type {
  StorefrontCarouselSlide,
  StorefrontCategoryThemeItem,
  StorefrontTemplateSlot,
  StorefrontThemeContent,
} from './types'

type Props = {
  slots: StorefrontTemplateSlot[]
  value: StorefrontThemeContent
  disabled?: boolean
  onChange: (next: StorefrontThemeContent) => void
}

export function StorefrontThemeFields({ slots, value, disabled, onChange }: Props) {
  const { t } = useI18n()
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<Category[]>([])

  const needsCategories = slots.some((slot) => slot.type === 'categories')

  useEffect(() => {
    if (!needsCategories) return
    void (async () => {
      try {
        const { data } = await api.get<ApiOk<Category[]>>('/categories', {
          params: { for_select: 1, status: 'active' },
          silent: true,
        })
        setCategories(data.data ?? [])
      } catch {
        setCategories([])
      }
    })()
  }, [needsCategories])

  const categoryOptions = useMemo(
    () => categories.map((item) => ({ value: String(item.id), label: item.name, keywords: item.name })),
    [categories],
  )

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">
        {t('storefrontThemeEmpty')}
      </div>
    )
  }

  async function uploadFile(file: File): Promise<string> {
    const body = new FormData()
    body.append('file', file)
    const { data } = await api.post<ApiOk<{ url: string }>>('/storefront/media', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.data.url
  }

  async function onPickImage(slotKey: string, file: File | undefined, mode: 'replace' | 'gallery' | 'carousel') {
    if (!file || disabled) return
    setError('')
    setUploading(slotKey)
    try {
      const url = await uploadFile(file)
      if (mode === 'replace') {
        onChange({ ...value, [slotKey]: url })
      } else if (mode === 'gallery') {
        const prev = Array.isArray(value[slotKey]) ? (value[slotKey] as string[]) : []
        onChange({ ...value, [slotKey]: [...prev, url] })
      } else {
        const prev = Array.isArray(value[slotKey]) ? (value[slotKey] as StorefrontCarouselSlide[]) : []
        onChange({ ...value, [slotKey]: [...prev, { image: url, title: '', subtitle: '' }] })
      }
    } catch (err) {
      setError(apiMessage(err, t('storefrontMediaFailed')))
    } finally {
      setUploading(null)
    }
  }

  function setText(slotKey: string, text: string) {
    onChange({ ...value, [slotKey]: text })
  }

  function removeGalleryItem(slotKey: string, index: number) {
    const prev = Array.isArray(value[slotKey]) ? (value[slotKey] as string[]) : []
    onChange({ ...value, [slotKey]: prev.filter((_, i) => i !== index) })
  }

  function removeCarouselItem(slotKey: string, index: number) {
    const prev = Array.isArray(value[slotKey]) ? (value[slotKey] as StorefrontCarouselSlide[]) : []
    onChange({ ...value, [slotKey]: prev.filter((_, i) => i !== index) })
  }

  function patchCarousel(slotKey: string, index: number, patch: Partial<StorefrontCarouselSlide>) {
    const prev = Array.isArray(value[slotKey]) ? (value[slotKey] as StorefrontCarouselSlide[]) : []
    onChange({
      ...value,
      [slotKey]: prev.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)),
    })
  }

  function syncCategories(ids: number[]) {
    const prev = Array.isArray(value.categories) ? value.categories : []
    const next: StorefrontCategoryThemeItem[] = ids.map((id) => {
      const existing = prev.find((row) => row.category_id === id)
      const cat = categories.find((c) => c.id === id)
      return {
        category_id: id,
        label: existing?.label || cat?.name || '',
        image: existing?.image ?? null,
      }
    })
    onChange({ ...value, categories: next })
  }

  async function setCategoryImage(categoryId: number, file: File | undefined) {
    if (!file || disabled) return
    setError('')
    setUploading(`cat-${categoryId}`)
    try {
      const url = await uploadFile(file)
      const prev = Array.isArray(value.categories) ? value.categories : []
      onChange({
        ...value,
        categories: prev.map((row) => (row.category_id === categoryId ? { ...row, image: url } : row)),
      })
    } catch (err) {
      setError(apiMessage(err, t('storefrontMediaFailed')))
    } finally {
      setUploading(null)
    }
  }

  const sections = useMemo(() => {
    const ordered: Array<{ title: string; slots: StorefrontTemplateSlot[] }> = []
    const index = new Map<string, number>()
    for (const slot of slots) {
      const title = (slot.section && slot.section.trim()) || t('storefrontThemeTitle')
      let i = index.get(title)
      if (i === undefined) {
        i = ordered.length
        index.set(title, i)
        ordered.push({ title, slots: [] })
      }
      ordered[i].slots.push(slot)
    }
    return ordered
  }, [slots, t])

  function renderSlot(slot: StorefrontTemplateSlot) {
    const busy = uploading === slot.key
    const max = slot.max ?? 5
    const placeholder = typeof slot.default === 'string' ? slot.default : undefined

    if (slot.type === 'categories') {
      const items = Array.isArray(value.categories) ? value.categories : []
      return (
        <div key={slot.key} className="space-y-3 rounded-2xl border border-line p-3 sm:col-span-2">
          <div className="text-sm text-muted">{slot.label}</div>
          <p className="text-xs text-muted">{t('storefrontPickCategoriesHint')}</p>
          <SearchMultiSelect
            values={items.filter((row) => row.category_id > 0).map((row) => String(row.category_id))}
            onChange={(next) =>
              syncCategories(next.map(Number).filter((id) => Number.isFinite(id) && id > 0).slice(0, max))
            }
            options={categoryOptions}
            placeholder={t('storefrontPickCategoriesPlaceholder')}
            disabled={disabled}
          />
          {items.map((item) => {
            const catName = categories.find((c) => c.id === item.category_id)?.name
            const itemBusy = uploading === `cat-${item.category_id}`
            return (
              <div key={item.category_id} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_140px]">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted">{catName || `ID ${item.category_id}`}</div>
                  <input
                    className="input w-full text-sm"
                    placeholder={t('storefrontCategoryLabelOverride')}
                    disabled={disabled}
                    value={item.label || ''}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        categories: items.map((row) =>
                          row.category_id === item.category_id ? { ...row, label: e.target.value } : row,
                        ),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  {item.image ? (
                    <div className="relative overflow-hidden rounded-lg bg-slate-100">
                      <img src={item.image} alt="" className="aspect-[4/3] w-full object-cover object-top" />
                      {!disabled ? (
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] shadow-sm"
                          onClick={() =>
                            onChange({
                              ...value,
                              categories: items.map((row) =>
                                row.category_id === item.category_id ? { ...row, image: null } : row,
                              ),
                            })
                          }
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="grid aspect-[4/3] place-items-center rounded-lg border border-dashed border-line text-[10px] text-muted">
                      {t('storefrontNoImage')}
                    </div>
                  )}
                  {!disabled ? (
                    <label className="btn-ghost inline-flex cursor-pointer text-xs">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={itemBusy}
                        onChange={(e) => void setCategoryImage(item.category_id, e.target.files?.[0])}
                      />
                      {itemBusy ? t('storefrontUploading') : t('storefrontUploadImage')}
                    </label>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    if (slot.type === 'text') {
      const text = typeof value[slot.key] === 'string' ? (value[slot.key] as string) : ''
      return (
        <label key={slot.key} className="block space-y-1 text-sm">
          <span className="text-muted">{slot.label}</span>
          <input
            className="input w-full"
            disabled={disabled}
            value={text}
            placeholder={placeholder}
            onChange={(e) => setText(slot.key, e.target.value)}
          />
        </label>
      )
    }

    if (slot.type === 'select') {
      const selected = typeof value[slot.key] === 'string' ? (value[slot.key] as string) : ''
      const options = Array.isArray(slot.options) ? slot.options : []
      const fallback = placeholder || options[0]?.value || ''
      return (
        <label key={slot.key} className="block space-y-1 text-sm sm:col-span-2">
          <span className="text-muted">{slot.label}</span>
          <select
            className="input w-full"
            disabled={disabled}
            value={selected || fallback}
            onChange={(e) => setText(slot.key, e.target.value)}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )
    }

    if (slot.type === 'textarea') {
      const text = typeof value[slot.key] === 'string' ? (value[slot.key] as string) : ''
      return (
        <label key={slot.key} className="block space-y-1 text-sm sm:col-span-2">
          <span className="text-muted">{slot.label}</span>
          <textarea
            className="input min-h-20 w-full"
            disabled={disabled}
            value={text}
            placeholder={placeholder}
            onChange={(e) => setText(slot.key, e.target.value)}
          />
        </label>
      )
    }

    if (slot.type === 'image') {
      const url = typeof value[slot.key] === 'string' ? (value[slot.key] as string) : ''
      return (
        <div key={slot.key} className="space-y-2 rounded-2xl border border-line p-3">
          <div className="text-sm text-muted">{slot.label}</div>
          {url ? (
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-slate-200">
              <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
              {!disabled ? (
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-xs shadow-sm"
                  onClick={() => onChange({ ...value, [slot.key]: undefined })}
                >
                  {t('storefrontRemoveImage')}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid h-28 place-items-center rounded-xl border border-dashed border-line text-xs text-muted">
              {t('storefrontNoImage')}
            </div>
          )}
          {!disabled ? (
            <label className="btn-ghost inline-flex cursor-pointer text-sm">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={busy}
                onChange={(e) => void onPickImage(slot.key, e.target.files?.[0], 'replace')}
              />
              {busy ? t('storefrontUploading') : t('storefrontUploadImage')}
            </label>
          ) : null}
        </div>
      )
    }

    if (slot.type === 'gallery') {
      const images = Array.isArray(value[slot.key]) ? (value[slot.key] as string[]) : []
      return (
        <div key={slot.key} className="space-y-2 rounded-2xl border border-line p-3 sm:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-muted">
              {slot.label} ({images.length}/{max})
            </div>
            {!disabled && images.length < max ? (
              <label className="btn-ghost cursor-pointer text-sm">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => void onPickImage(slot.key, e.target.files?.[0], 'gallery')}
                />
                {busy ? t('storefrontUploading') : t('storefrontAddImage')}
              </label>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((src, index) => (
              <div key={`${src}-${index}`} className="relative overflow-hidden rounded-xl bg-slate-100">
                <img src={src} alt="" className="aspect-[4/3] w-full object-cover object-top" />
                {!disabled ? (
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] shadow-sm"
                    onClick={() => removeGalleryItem(slot.key, index)}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (slot.type === 'carousel') {
      const realSlides = Array.isArray(value[slot.key]) ? (value[slot.key] as StorefrontCarouselSlide[]) : []
      return (
        <div key={slot.key} className="space-y-3 rounded-2xl border border-line p-3 sm:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-muted">
              {slot.label} ({realSlides.length}/{max})
            </div>
            {!disabled && realSlides.length < max ? (
              <label className="btn-ghost cursor-pointer text-sm">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => void onPickImage(slot.key, e.target.files?.[0], 'carousel')}
                />
                {busy ? t('storefrontUploading') : t('storefrontAddSlide')}
              </label>
            ) : null}
          </div>
          {realSlides.map((slide, index) => (
            <div key={`${slide.image}-${index}`} className="grid gap-2 rounded-xl border border-line p-2 sm:grid-cols-[120px_1fr]">
              <div className="relative overflow-hidden rounded-lg bg-slate-100">
                <img src={slide.image} alt="" className="aspect-[4/3] w-full object-cover object-top" />
                {!disabled ? (
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] shadow-sm"
                    onClick={() => removeCarouselItem(slot.key, index)}
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <div className="space-y-2">
                <input
                  className="input w-full text-sm"
                  placeholder={t('storefrontSlideTitle')}
                  disabled={disabled}
                  value={slide.title ?? ''}
                  onChange={(e) => patchCarousel(slot.key, index, { title: e.target.value })}
                />
                <input
                  className="input w-full text-sm"
                  placeholder={t('storefrontSlideSubtitle')}
                  disabled={disabled}
                  value={slide.subtitle ?? ''}
                  onChange={(e) => patchCarousel(slot.key, index, { subtitle: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <div className="space-y-5">
      {error ? <div className="text-sm text-rose-500">{error}</div> : null}
      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <div className="border-b border-line pb-1.5 text-sm font-semibold text-slate-800">{section.title}</div>
          <div className="grid gap-3 sm:grid-cols-2">{section.slots.map((slot) => renderSlot(slot))}</div>
        </section>
      ))}
    </div>
  )
}
