import { useEffect, useState, type FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { MasterModal } from '../../components/MasterModal'
import { BlogRichEditor } from '../../components/BlogRichEditor'
import { useAccess } from '../../access'
import { useI18n } from '../../i18n'
import type { ApiOk } from '../../types'
import type { StorefrontAdmin, StorefrontNewsPostRow } from './types'

const emptyForm = {
  title: '',
  excerpt: '',
  body: '',
  tags: '',
  sort_order: '0',
  is_published: true,
  image_path: '' as string,
  image_url: '' as string,
}

async function uploadStorefrontImage(file: File): Promise<{ url: string; path: string }> {
  const body = new FormData()
  body.append('file', file)
  const { data } = await api.post<ApiOk<{ path: string; url: string }>>('/storefront/media', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

export default function StorefrontNews() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery(20)
  const canCreate = can('storefrontnews', 'create')
  const canEdit = can('storefrontnews', 'edit')
  const canDelete = can('storefrontnews', 'delete')
  const [rows, setRows] = useState<StorefrontNewsPostRow[]>([])
  const [hasNews, setHasNews] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StorefrontNewsPostRow | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const [sf, listRes] = await Promise.all([
        api.get<ApiOk<StorefrontAdmin>>('/storefront', { silent: true }),
        api.get<ApiOk<StorefrontNewsPostRow[]>>('/storefront/news', {
          params: {
            search: list.search || undefined,
            status: list.status !== 'all' ? list.status : undefined,
            page: list.page,
            per_page: list.perPage,
          },
        }),
      ])
      setHasNews(Boolean(sf.data.data.has_news))
      const items = listRes.data.data ?? []
      setRows(items)
      list.applyMeta(listRes.data.meta, items.length)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.search, list.status, list.page, list.perPage])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setOpen(true)
  }

  function openEdit(row: StorefrontNewsPostRow) {
    setEditing(row)
    setForm({
      title: row.title,
      excerpt: row.excerpt ?? '',
      body: row.body ?? '',
      tags: row.tags ?? '',
      sort_order: String(row.sort_order ?? 0),
      is_published: row.is_published,
      image_path: row.image_path ?? '',
      image_url: row.image_url ?? '',
    })
    setError('')
    setOpen(true)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) return
    if (editing ? !canEdit : !canCreate) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        title: form.title.trim(),
        excerpt: form.excerpt.trim() || null,
        body: form.body.trim() || null,
        tags: form.tags.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_published: form.is_published,
        image_path: form.image_path || null,
      }
      if (editing) {
        await api.put(`/storefront/news/${editing.id}`, payload)
      } else {
        await api.post('/storefront/news', payload)
      }
      setOpen(false)
      feedback.success(t('saved'))
      await load()
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function onRemove(row: StorefrontNewsPostRow) {
    if (!canDelete) return
    const ok = await feedback.confirm({
      title: t('storefrontNewsDeleteTitle'),
      message: t('deleteConfirm', { name: row.title }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/storefront/news/${row.id}`)
      feedback.success(t('deleted'))
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function onCoverPick(file: File | null) {
    if (!file) return
    try {
      const media = await uploadStorefrontImage(file)
      setForm((prev) => ({ ...prev, image_path: media.path, image_url: media.url }))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  if (!hasNews) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow={t('appStorefront')} title={t('storefrontNewsTitle')} subtitle={t('storefrontNewsDisabledHint')} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t('appStorefront')}
        title={t('storefrontNewsTitle')}
        subtitle={t('storefrontNewsHint')}
        action={
          canCreate ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              {t('storefrontNewsAdd')}
            </button>
          ) : null
        }
      />

      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('storefrontNewsSearch')}
        statusOptions={[
          { value: 'all', label: t('filterAll') },
          { value: 'published', label: t('storefrontNewsPublished') },
          { value: 'draft', label: t('storefrontNewsDraft') },
        ]}
      />

      <div className="glass overflow-auto rounded-3xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">{t('storefrontNewsFieldImage')}</th>
              <th className="px-4 py-3">{t('storefrontNewsFieldTitle')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('storefrontNewsFieldOrder')}</th>
              <th className="px-4 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  {t('storefrontNewsEmpty')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-3">
                    {row.image_url ? (
                      <img src={row.image_url} alt="" className="h-12 w-16 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-black/5 text-xs text-muted">
                        —
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.title}</div>
                    {row.excerpt ? <div className="mt-0.5 line-clamp-1 text-xs text-muted">{row.excerpt}</div> : null}
                    {row.tags ? <div className="mt-0.5 text-[11px] text-muted">{row.tags}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    {row.is_published ? t('storefrontNewsPublished') : t('storefrontNewsDraft')}
                    {row.day && row.month ? (
                      <div className="text-xs text-muted">
                        {row.day} {row.month}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{row.sort_order}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {canEdit ? (
                        <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => openEdit(row)}>
                          {t('edit')}
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button type="button" className="btn-ghost !px-2 !text-xs" onClick={() => void onRemove(row)}>
                          {t('delete')}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <MasterModal
        open={open}
        title={editing ? t('storefrontNewsEdit') : t('storefrontNewsAdd')}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
        saving={saving}
        error={error}
        size="2xl"
        defaultMaximized
        submitLabel={t('save')}
        submitDisabled={!form.title.trim()}
      >
        <div className="space-y-3">
          <label className="block text-sm text-muted">
            {t('storefrontNewsFieldTitle')}
            <input
              className="field"
              required
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </label>
          <label className="block text-sm text-muted">
            {t('storefrontNewsFieldExcerpt')}
            <textarea
              className="field min-h-20"
              value={form.excerpt}
              onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
            />
          </label>
          <div className="text-sm text-muted">
            {t('storefrontNewsFieldBody')}
            <div className="mt-1">
              <BlogRichEditor
                value={form.body}
                onChange={(html) => setForm((p) => ({ ...p, body: html }))}
                uploadImage={async (file) => {
                  try {
                    const media = await uploadStorefrontImage(file)
                    return { url: media.url }
                  } catch (err) {
                    feedback.error(apiMessage(err, t('saveFailed')))
                    throw err
                  }
                }}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-muted">
              {t('storefrontNewsFieldTags')}
              <input
                className="field"
                value={form.tags}
                onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                placeholder="Tech, Arts"
              />
            </label>
            <label className="text-sm text-muted">
              {t('storefrontNewsFieldOrder')}
              <input
                type="number"
                className="field"
                value={form.sort_order}
                onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))}
              />
              {t('storefrontNewsPublished')}
            </label>
            <label className="text-sm text-muted">
              {t('storefrontNewsCover')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mt-1 block text-xs"
                onChange={(e) => void onCoverPick(e.target.files?.[0] ?? null)}
              />
              <span className="mt-1 block text-[11px] leading-snug">
                {t('storefrontImageFormats', { mb: '5' })}
                <br />
                {t('storefrontImageHintHero')}
                <br />
                {t('storefrontImageSingleHint')}
              </span>
            </label>
            {form.image_url ? <img src={form.image_url} alt="" className="h-16 w-24 rounded-lg object-cover" /> : null}
          </div>
        </div>
      </MasterModal>
    </div>
  )
}
