import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../api/client'
import { logMasterForm } from '../api/activity'
import type { ApiOk, Category } from '../types'
import { useFeedback } from '../components/feedback'
import { PageHeader } from '../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../components/MasterListBar'
import { MasterModal, MasterViewModal, MasterNameButton, ViewField } from '../components/MasterModal'
import { useI18n } from '../i18n'
import { useAccess } from '../access'

export default function Categories() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [showPos, setShowPos] = useState(true)
  const [rawMaterial, setRawMaterial] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [viewing, setViewing] = useState<Category | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { data } = await api.get<ApiOk<Category[]>>('/categories', {
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

  function openCreate() {
    setEditing(null)
    setName('')
    setShowPos(true)
    setRawMaterial(false)
    setError('')
    setOpen(true)
    logMasterForm('category', 'create')
  }

  function openEdit(item: Category) {
    setEditing(item)
    setName(item.name)
    setShowPos(item.show_pos ?? true)
    setRawMaterial(item.is_raw_material ?? false)
    setError('')
    setOpen(true)
    logMasterForm('category', 'edit', item.name)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      name,
      show_pos: showPos,
      is_raw_material: rawMaterial,
    }
    try {
      if (editing) await api.put(`/categories/${editing.id}`, payload)
      else await api.post('/categories', payload)
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: Category) {
    const ok = await feedback.confirm({
      title: t('deleteCategoryTitle'),
      message: t('deleteConfirm', { name: item.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/categories/${item.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(item: Category) {
    try {
      await api.put(`/categories/${item.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  const canEdit = can('categories', 'edit')
  const canDelete = can('categories', 'delete')
  const showActions = canEdit || canDelete

  return (
    <div>
      <PageHeader
        eyebrow={t('productsEyebrow')}
        title={t('navCategories')}
        subtitle={t('categoriesSubtitle')}
        action={
          can('categories', 'create') ? (
            <button type="button" onClick={openCreate} className="btn-primary">
              {t('addCategory')}
            </button>
          ) : undefined
        }
      />

      <MasterFilters {...list.filters} searchPlaceholder={t('searchCategory')} />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('categoryShowPos')}</th>
              <th className="px-4 py-3 font-medium">{t('categoryRawMaterial')}</th>
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
                <td className="px-4 py-3 text-muted">{item.show_pos ?? true ? t('yes') : t('no')}</td>
                <td className="px-4 py-3 text-muted">{item.is_raw_material ?? false ? t('yes') : t('no')}</td>
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
                <td className="px-4 py-8 text-center text-muted" colSpan={showActions ? 5 : 4}>
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
        title={editing ? t('editCategory') : t('newCategory')}
        error={error}
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
      >
        <label className="text-sm text-muted">
          {t('name')}
          <input required className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showPos} onChange={(e) => setShowPos(e.target.checked)} />
          <span>
            <span className="text-fg">{t('categoryShowPos')}</span>
            <span className="mt-0.5 block text-xs">{t('categoryShowPosHint')}</span>
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={rawMaterial} onChange={(e) => setRawMaterial(e.target.checked)} />
          <span>
            <span className="text-fg">{t('categoryRawMaterial')}</span>
            <span className="mt-0.5 block text-xs">{t('categoryRawMaterialHint')}</span>
          </span>
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
        {viewing ? (
          <>
            <ViewField label={t('name')} value={viewing.name} />
            <ViewField label={t('categoryShowPos')} value={viewing.show_pos ?? true ? t('yes') : t('no')} />
            <ViewField label={t('categoryRawMaterial')} value={viewing.is_raw_material ?? false ? t('yes') : t('no')} />
            <ViewField label={t('status')} value={viewing.is_active ? t('active') : t('inactive')} />
          </>
        ) : null}
      </MasterViewModal>
    </div>
  )
}
