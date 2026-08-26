import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, BusinessType } from '../../types'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { useI18n } from '../../i18n'
import { usePlatformAccess } from '../../platform/access'

export default function PlatformBusinessTypes() {
  const { t } = useI18n()
  const { canManage } = usePlatformAccess()
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<BusinessType[]>([])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [editing, setEditing] = useState<BusinessType | null>(null)
  const [error, setError] = useState('')

  async function load() {
    try {
      const { data } = await api.get<ApiOk<BusinessType[]>>('/platform/business-types', {
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      if (editing?.id) await api.put(`/platform/business-types/${editing.id}`, { name })
      else await api.post('/platform/business-types', { name, slug })
      setName('')
      setSlug('')
      setEditing(null)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    }
  }

  async function toggle(item: BusinessType) {
    if (!item.id) return
    try {
      await api.put(`/platform/business-types/${item.id}`, { is_active: !item.is_active })
      await load()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  return (
    <div>
      <PageHeader eyebrow={t('platformEyebrow')} title={t('navBusinessTypes')} subtitle={t('businessTypesLead')} />
      {canManage ? (
        <form onSubmit={(e) => void onSubmit(e)} className="mb-4 flex flex-wrap gap-2">
          <input required className="field !mt-0 max-w-xs" placeholder={t('name')} value={name} onChange={(e) => setName(e.target.value)} />
          {editing ? null : (
            <input required className="field !mt-0 max-w-xs" placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          )}
          <button type="submit" className="btn-primary">{editing ? t('save') : t('addType')}</button>
          {editing ? (
            <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setName(''); setSlug('') }}>
              {t('cancel')}
            </button>
          ) : null}
        </form>
      ) : null}
      {error ? <FormAlert>{error}</FormAlert> : null}
      <MasterFilters {...list.filters} searchPlaceholder={t('searchType')} />
      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.slug} className="border-t border-line">
                <td className="px-4 py-3">{item.name}</td>
                <td className="px-4 py-3 text-muted">{item.slug}</td>
                <td className="px-4 py-3">{item.is_active ? t('active') : t('inactive')}</td>
                <td className="px-4 py-3 text-right">
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        className="mr-3 text-mint"
                        onClick={() => {
                          setEditing(item)
                          setName(item.name)
                        }}
                      >
                        {t('edit')}
                      </button>
                      <button type="button" className="text-muted" onClick={() => void toggle(item)}>
                        {item.is_active ? t('delete') : t('activate')}
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={4}>
                  {t('emptyMaster')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />
    </div>
  )
}
