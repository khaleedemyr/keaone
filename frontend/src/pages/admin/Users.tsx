import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, Member, Outlet } from '../../types'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
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
  outlet_id: '',
  is_active: true,
}

export default function AdminUsers() {
  const { t } = useI18n()
  const { can, isOwner } = useAccess()
  const feedback = useFeedback()
  const roles = useRoleOptions('/roles')
  const list = useListQuery()
  const [members, setMembers] = useState<Member[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const users = await api.get<ApiOk<Member[]>>('/users', {
        params: {
          search: list.search || undefined,
          status: list.status,
          page: list.page,
          per_page: list.perPage,
        },
      })
      setMembers(users.data.data)
      list.applyMeta(users.data.meta, users.data.data.length)
      try {
        const outletRes = await api.get<ApiOk<Outlet[]>>('/outlets', { params: { for_select: 1, status: 'all' } })
        setOutlets(outletRes.data.data)
      } catch {
        setOutlets([])
      }
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
    const fallback = roles.find((item) => item.slug === 'cashier') ?? roles.find((item) => !item.is_owner) ?? roles[0]
    setForm({ ...empty, role_id: fallback ? String(fallback.id) : '' })
    setError('')
    setOpen(true)
  }

  function openEdit(member: Member) {
    setEditing(member)
    setForm({
      name: member.name,
      email: member.email,
      username: member.username ?? '',
      phone: member.phone ?? '',
      password: '',
      role_id: member.role_id ? String(member.role_id) : '',
      outlet_id: member.outlet ? String(member.outlet.id) : '',
      is_active: member.is_active,
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
      outlet_id: form.outlet_id ? Number(form.outlet_id) : null,
      is_active: form.is_active,
      ...(form.password ? { password: form.password } : editing ? {} : { password: form.password }),
    }

    try {
      if (editing) await api.put(`/users/${editing.id}`, payload)
      else await api.post('/users', { ...payload, password: form.password })
      setOpen(false)
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function remove(member: Member) {
    const ok = await feedback.confirm({
      title: t('deleteUserTitle'),
      message: t('deleteConfirm', { name: member.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/users/${member.id}`)
      await load()
      feedback.success(t('deleted'))
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  async function activate(member: Member) {
    try {
      await api.put(`/users/${member.id}`, { is_active: true })
      await load()
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  const roleName = (roleId: number | null | undefined, slug: string) =>
    roles.find((item) => item.id === roleId)?.name ?? slug
  const formOutlets = outlets.filter((item) => item.is_active !== false || String(item.id) === form.outlet_id)

  return (
    <div>
      <PageHeader
        eyebrow={t('appAdmin')}
        title={t('navUsers')}
        subtitle={t('usersSubtitle')}
        action={
          can('users', 'create') ? (
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
              <th className="px-4 py-3 font-medium">{t('outlet')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-line hover:bg-fill">
                <td className="px-4 py-3 font-medium">{member.name}</td>
                <td className="px-4 py-3 text-muted">{member.email}</td>
                <td className="px-4 py-3">{roleName(member.role_id, member.role)}</td>
                <td className="px-4 py-3 text-muted">{member.outlet?.name ?? '-'}</td>
                <td className="px-4 py-3">
                  <span className={member.is_active ? 'text-mint' : 'text-rose-300'}>
                    {member.is_active ? t('active') : t('inactive')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {can('users', 'edit') ? (
                  <button type="button" className="mr-3 text-mint" onClick={() => openEdit(member)}>
                    {t('edit')}
                  </button>
                  ) : null}
                  {member.is_active && can('users', 'delete') ? (
                  <button type="button" className="text-rose-300" onClick={() => void remove(member)}>
                    {t('delete')}
                  </button>
                  ) : null}
                  {!member.is_active && can('users', 'edit') ? (
                  <button type="button" className="text-mint" onClick={() => void activate(member)}>
                    {t('activate')}
                  </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {members.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={6}>
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
                <label className="text-sm text-muted">
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
                <label className="text-sm text-muted">
                  {t('outlet')}
                  <select className="field" value={form.outlet_id} onChange={(e) => setForm({ ...form, outlet_id: e.target.value })}>
                    <option value="">-</option>
                    {formOutlets.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.is_active === false ? `${item.name} (${t('inactive')})` : item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  {t('active')}
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
