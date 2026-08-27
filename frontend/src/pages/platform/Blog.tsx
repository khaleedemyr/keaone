import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  deletePlatformBlog,
  getPlatformBlog,
  listPlatformBlog,
  savePlatformBlog,
  uploadBlogCover,
  type AdminBlogPost,
  type BlogTranslation,
} from '../../api/platformBlog'
import { apiMessage } from '../../api/client'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { LANGS } from '../../i18n/langs'
import { useI18n } from '../../i18n'
import { usePlatformAccess } from '../../platform/access'
import { BlogRichEditor } from '../../components/BlogRichEditor'

function emptyTranslation(locale: string): BlogTranslation {
  return { locale, title: '', slug: '', excerpt: '', body: '' }
}

export default function PlatformBlog() {
  const { t } = useI18n()
  const { can } = usePlatformAccess()
  const canEdit = can('blog', 'edit') || can('blog', 'create')
  const canCreate = can('blog', 'create')
  const canDelete = can('blog', 'delete')
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<AdminBlogPost[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [localeTab, setLocaleTab] = useState('id')
  const [translations, setTranslations] = useState<BlogTranslation[]>([emptyTranslation('id'), emptyTranslation('en')])
  const [cover, setCover] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const active = useMemo(
    () => translations.find((row) => row.locale === localeTab) ?? translations[0],
    [translations, localeTab],
  )

  async function load() {
    try {
      const { rows, meta } = await listPlatformBlog({
        search: list.search || undefined,
        status: list.status === 'all' ? undefined : list.status,
        page: list.page,
        per_page: list.perPage,
      })
      setItems(rows)
      list.applyMeta(meta as { current_page?: number; last_page?: number; total?: number; per_page?: number }, rows.length)
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

  function resetForm() {
    setEditingId(null)
    setStatus('draft')
    setLocaleTab('id')
    setTranslations([emptyTranslation('id'), emptyTranslation('en')])
    setCover(null)
    setError('')
  }

  async function openEdit(id: number) {
    try {
      const row = await getPlatformBlog(id)
      setEditingId(row.id)
      setStatus(row.status)
      setCover(row.cover)
      const rows = row.translations.length
        ? row.translations
        : [emptyTranslation('id'), emptyTranslation('en')]
      setTranslations(rows)
      setLocaleTab(rows[0]?.locale ?? 'id')
      setError('')
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  function patchActive(patch: Partial<BlogTranslation>) {
    setTranslations((prev) =>
      prev.map((row) => (row.locale === active.locale ? { ...row, ...patch } : row)),
    )
  }

  function ensureLocale(locale: string) {
    setTranslations((prev) => {
      if (prev.some((row) => row.locale === locale)) return prev
      return [...prev, emptyTranslation(locale)]
    })
    setLocaleTab(locale)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canEdit && !(canCreate && !editingId)) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        status,
        translations: translations.filter((row) => row.title.trim()),
      }
      if (!payload.translations.length) {
        setError(t('saveFailed'))
        return
      }
      const saved = await savePlatformBlog(payload, editingId ?? undefined)
      setEditingId(saved.id)
      setCover(saved.cover)
      setTranslations(saved.translations)
      await load()
      feedback.success(t('blogSaved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function onCover(file: File | null) {
    if (!file || !editingId) return
    try {
      const saved = await uploadBlogCover(editingId, file)
      setCover(saved.cover)
      feedback.success(t('blogSaved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  async function onDelete(id: number) {
    if (!canDelete || !window.confirm(t('blogDeleteConfirm'))) return
    try {
      await deletePlatformBlog(id)
      if (editingId === id) resetForm()
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  return (
    <div className="p-4">
      <PageHeader eyebrow={t('platformEyebrow')} title={t('appBlog')} subtitle={t('blogLead')} />

      {(canCreate || canEdit) && active ? (
        <form onSubmit={(e) => void onSubmit(e)} className="mb-6 space-y-3 rounded-3xl border border-line bg-panel p-4">
          <div className="flex flex-wrap gap-2">
            {LANGS.map((lang) => {
              const exists = translations.some((row) => row.locale === lang.id)
              return (
                <button
                  key={lang.id}
                  type="button"
                  className={`btn-ghost !px-3 !py-1.5 !text-xs${localeTab === lang.id ? ' !border-mint' : ''}`}
                  onClick={() => (exists ? setLocaleTab(lang.id) : ensureLocale(lang.id))}
                >
                  {lang.code}
                  {exists ? '' : ' +'}
                </button>
              )
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-muted">
              {t('blogTitle')}
              <input
                required
                className="field"
                value={active.title}
                onChange={(e) => patchActive({ title: e.target.value })}
              />
            </label>
            <label className="text-xs text-muted">
              {t('blogSlug')}
              <input
                className="field"
                value={active.slug}
                onChange={(e) => patchActive({ slug: e.target.value })}
                placeholder="auto"
              />
            </label>
          </div>

          <label className="block text-xs text-muted">
            {t('blogExcerpt')}
            <textarea
              className="field min-h-20"
              value={active.excerpt ?? ''}
              onChange={(e) => patchActive({ excerpt: e.target.value })}
            />
          </label>

          <label className="block text-xs text-muted">
            {t('blogBody')}
            <div className="mt-1">
              <BlogRichEditor
                value={active.body ?? ''}
                onChange={(html) => patchActive({ body: html })}
                postId={editingId}
                onNeedSave={() => feedback.error(t('blogEditorSaveFirstForImage'))}
              />
            </div>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-muted">
              {t('blogStatus')}
              <select
                className="field !mt-1"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
              >
                <option value="draft">{t('blogDraft')}</option>
                <option value="published">{t('blogPublished')}</option>
              </select>
            </label>
            {editingId ? (
              <label className="text-xs text-muted">
                {t('blogCover')}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-1 block text-sm"
                  onChange={(e) => void onCover(e.target.files?.[0] ?? null)}
                />
              </label>
            ) : null}
            {cover ? <img src={cover} alt="" className="h-16 w-24 rounded-lg object-cover" /> : null}
          </div>

          {error ? <FormAlert>{error}</FormAlert> : null}

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {editingId ? t('save') : t('blogNew')}
            </button>
            {editingId ? (
              <button type="button" className="btn-ghost" onClick={resetForm}>
                {t('cancel')}
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('searchBlog')}
        statusOptions={[
          { value: 'all', label: t('filterAll') },
          { value: 'draft', label: t('blogDraft') },
          { value: 'published', label: t('blogPublished') },
        ]}
      />
      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('blogTitle')}</th>
              <th className="px-4 py-3 font-medium">{t('blogStatus')}</th>
              <th className="px-4 py-3 font-medium">{t('blogLocale')}</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const primary = item.translations[0]
              return (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-4 py-3">{primary?.title ?? `#${item.id}`}</td>
                  <td className="px-4 py-3">
                    {item.status === 'published' ? t('blogPublished') : t('blogDraft')}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {item.translations.map((row) => row.locale).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canEdit ? (
                      <button type="button" className="mr-3 text-mint" onClick={() => void openEdit(item.id)}>
                        {t('edit')}
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button type="button" className="text-muted" onClick={() => void onDelete(item.id)}>
                        {t('delete')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />
    </div>
  )
}
