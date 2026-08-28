import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../api/client'
import { logMasterForm } from '../api/activity'
import type { ApiOk, Category, SubCategory } from '../types'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../components/MasterModal'
import { useI18n } from '../i18n'
import { useAccess } from '../access'

export default function SubCategories() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<SubCategory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [editing, setEditing] = useState<SubCategory | null>(null)
  const [viewing, setViewing] = useState<SubCategory | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { data } = await api.get<ApiOk<SubCategory[]>>('/subcategories', {
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
    void api
      .get<ApiOk<Category[]>>('/categories', { params: { for_select: 1, status: 'all' } })
      .then(({ data }) => setCategories(data.data))
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load()
    }, 200)
    return () => window.clearTimeout(handle)
  }, [list.search, list.status, list.page, list.perPage])

  function openCreate() {
    setEditing(null)
    setName('')
    setCategoryId('')
    setError('')
    setOpen(true)
    logMasterForm('subcategory', 'create')
  }

  function openEdit(item: SubCategory) {
    setEditing(item)
    setName(item.name)
    setCategoryId(String(item.category_id))
    setError('')
    setOpen(true)
    logMasterForm('subcategory', 'edit', item.name)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { name, category_id: Number(categoryId) }
      if (editing) await api.put(`/subcategories/${editing.id}`, payload)
      else await api.post('/subcategories', payload)
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: SubCategory) {
    const ok = await feedback.confirm({
      title: t('deleteSubCategoryTitle'),
      message: t('deleteConfirm', { name: item.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/subcategories/${item.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(item: SubCategory) {
    try {
      await api.put(`/subcategories/${item.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  const formCategories = categories.filter((c) => c.is_active || String(c.id) === categoryId)
  const canEdit = can('subcategories', 'edit')
  const canDelete = can('subcategories', 'delete')
  const showActions = canEdit || canDelete

  return (
    <div>
      <PageHeader
        eyebrow={t('productsEyebrow')}
        title={t('navSubCategories')}
        subtitle={t('subCategoriesSubtitle')}
        action={
          can('subcategories', 'create') ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              {t('addSubCategory')}
            </button>
          ) : undefined
        }
      />

      <MasterFilters {...list.filters} searchPlaceholder={t('searchSubCategory')} />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('category')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              {showActions ? <th className="px-4 py-3 font-medium"></th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line hover:bg-fill">
                <td className="px-4 py-3">
                  <MasterNameButton onClick={() => setViewing(item)}>{item.name}</MasterNameButton>
                </td>
                <td className="px-4 py-3 text-muted">{item.category?.name ?? '-'}</td>
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
                <td className="px-4 py-8 text-center text-muted" colSpan={showActions ? 4 : 3}>
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
        title={editing ? t('editSubCategory') : t('newSubCategory')}
        error={error}
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
      >
        <label className="text-sm text-muted">
          {t('category')}
          <select required className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">-</option>
            {formCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.is_active ? category.name : `${category.name} (${t('inactive')})`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          {t('name')}
          <input required className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
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
        <ViewField label={t('category')} value={viewing?.category?.name} />
        <ViewField label={t('status')} value={viewing?.is_active ? t('active') : t('inactive')} />
      </MasterViewModal>
    </div>
  )
}
