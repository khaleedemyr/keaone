import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, PlatformOperator } from '../../types'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { useAuth } from '../../auth'
import { useI18n } from '../../i18n'
import { useRoleOptions } from '../../components/RolesManager'
import { useAccess } from '../../access'

const empty = {
  name: '',
  email: '',
  username: '',
  phone: '',
  password: '',
  role_id: '',
}

export default function PlatformUsers() {
  const { t } = useI18n()
  const { me } = useAuth()
  const { can, isOwner } = useAccess()
  const roles = useRoleOptions('/platform/roles')
  const feedback = useFeedback()
  const list = useListQuery()
  const [items, setItems] = useState<PlatformOperator[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PlatformOperator | null>(null)
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { data } = await api.get<ApiOk<PlatformOperator[]>>('/platform/users', {
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

  const roleName = (user: PlatformOperator) =>
    roles.find((item) => item.id === user.role_id)?.name ?? user.role_name ?? user.platform_role

  function openCreate() {
    setEditing(null)
    const fallback = roles.find((item) => item.slug === 'support') ?? roles.find((item) => !item.is_owner) ?? roles[0]
    setForm({ ...empty, role_id: fallback ? String(fallback.id) : '' })
    setError('')
    setOpen(true)
  }

  function openEdit(user: PlatformOperator) {
    setEditing(user)
    setForm({
      name: user.name,
      email: user.email,
      username: user.username ?? '',
      phone: user.phone ?? '',
      password: '',
      role_id: user.role_id ? String(user.role_id) : '',
    })
    setError('')
    setOpen(true)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      name: form.name,
      email: form.email,
      username: form.username.trim() || null,
      phone: form.phone.trim() || null,
      role_id: form.role_id ? Number(form.role_id) : null,
      ...(form.password ? { password: form.password } : {}),
    }
    try {
      if (editing) await api.put(`/platform/users/${editing.id}`, payload)
      else await api.post('/platform/users', { ...payload, password: form.password })
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove(user: PlatformOperator) {
    const ok = await feedback.confirm({
      title: t('deleteUserTitle'),
      message: t('deleteConfirm', { name: user.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/platform/users/${user.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(user: PlatformOperator) {
    try {
      await api.put(`/platform/users/${user.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('appAdmin')}
        title={t('navUsers')}
        subtitle={t('platformUsersLead')}
        action={
          can('operators', 'create') ? (
          <button type="button" className="btn-primary" onClick={openCreate}>
            {t('addUser')}
          </button>
          ) : undefined
        }
      />
      <MasterFilters {...list.filters} searchPlaceholder={t('searchUser')} />
      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('email')}</th>
              <th className="px-4 py-3 font-medium">{t('role')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line hover:bg-fill">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-muted">{item.email}</td>
                <td className="px-4 py-3">{roleName(item)}</td>
                <td className="px-4 py-3">
                  <span className={item.is_active !== false ? 'text-mint' : 'text-rose-300'}>
                    {item.is_active !== false ? t('active') : t('inactive')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {can('operators', 'edit') ? (
                  <button type="button" className="mr-3 text-mint" onClick={() => openEdit(item)}>
                    {t('edit')}
                  </button>
                  ) : null}
                  {item.is_active !== false && can('operators', 'delete') && item.id !== me?.user.id ? (
                    <button type="button" className="text-rose-300" onClick={() => void remove(item)}>
                      {t('delete')}
                    </button>
                  ) : null}
                  {item.is_active === false && can('operators', 'edit') ? (
                    <button type="button" className="text-mint" onClick={() => void activate(item)}>
                      {t('activate')}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={5}>
                  {t('emptyMaster')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <MasterPager page={list.page} lastPage={list.lastPage} total={list.total} onPage={list.setPage} />

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.form
              onSubmit={(e) => void onSubmit(e)}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="glass w-full max-w-lg rounded-3xl p-6"
            >
              <h2 className="font-display mb-4 text-xl font-bold">
                {editing ? t('editUser') : t('newUser')}
              </h2>
              {error ? <FormAlert>{error}</FormAlert> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-muted sm:col-span-2">
                  {t('name')}
                  <input required className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  {t('email')}
                  <input required type="email" className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  {t('username')}
                  <input className="field" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  {t('phone')}
                  <input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  {editing ? t('optionalPassword') : t('password')}
                  <input
                    required={!editing}
                    minLength={8}
                    type="password"
                    className="field"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </label>
                <label className="text-sm text-muted sm:col-span-2">
                  {t('role')}
                  <select required className="field" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                    {roles
                      .filter((item) => isOwner || !item.is_owner)
                      .filter((item) => item.is_active || String(item.id) === form.role_id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                  {t('cancel')}
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {t('save')}
                </button>
              </div>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
