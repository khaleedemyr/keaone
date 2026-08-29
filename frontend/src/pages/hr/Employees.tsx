import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, apiMessage } from '../../api/client'
import { logMasterForm } from '../../api/activity'
import type { ApiOk, Department, EmploymentStatus, JobLevel, Member, Outlet, Position } from '../../types'
import { FormAlert, useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { MasterFilters, MasterPager, useListQuery } from '../../components/MasterListBar'
import { useI18n } from '../../i18n'
import type { MsgKey } from '../../i18n/messages/types'
import { useRoleOptions } from '../../components/RolesManager'
import { useAccess } from '../../access'
import { EmployeeInviteModal } from './EmployeeInviteModal'
import { EmployeeOnboardingModal } from './EmployeeOnboardingModal'
import {
  EmployeeDocumentField,
  emptyEmployeeDocuments,
  employeeDocumentAccept,
  uploadEmployeeDocuments,
  type EmployeeDocumentFiles,
} from './EmployeeDocumentField'

const empty = {
  name: '',
  email: '',
  username: '',
  phone: '',
  password: '',
  national_id: '',
  tax_id: '',
  birth_date: '',
  birth_place: '',
  gender: '',
  marital_status: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  employee_code: '',
  role_id: '',
  outlet_id: '',
  department_id: '',
  position_id: '',
  job_level_id: '',
  manager_id: '',
  hired_at: '',
  employment_status: 'active',
  contract_type: '',
  contract_end_at: '',
  terminated_at: '',
  is_active: true,
}

function employmentLabel(status: EmploymentStatus | undefined, t: (key: MsgKey) => string) {
  const map: Record<EmploymentStatus, MsgKey> = {
    active: 'employmentActive',
    probation: 'employmentProbation',
    resigned: 'employmentResigned',
    terminated: 'employmentTerminated',
  }
  return t(map[status ?? 'active'])
}

export default function Employees() {
  const { t } = useI18n()
  const { can, isOwner } = useAccess()
  const feedback = useFeedback()
  const roles = useRoleOptions('/roles')
  const list = useListQuery()
  const [employmentFilter, setEmploymentFilter] = useState('all')
  const [onboardingFilter, setOnboardingFilter] = useState('complete')
  const [members, setMembers] = useState<Member[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [jobLevels, setJobLevels] = useState<JobLevel[]>([])
  const [managerOptions, setManagerOptions] = useState<Member[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [reviewMember, setReviewMember] = useState<Member | null>(null)
  const [documents, setDocuments] = useState<EmployeeDocumentFiles>(emptyEmployeeDocuments())
  const [documentFlags, setDocumentFlags] = useState({ photo: false, ktp: false, kk: false })

  async function loadLookups() {
    try {
      const [outletRes, deptRes, posRes, levelRes, managerRes] = await Promise.all([
        api.get<ApiOk<Outlet[]>>('/outlets', { params: { for_select: 1, status: 'all' } }),
        api.get<ApiOk<Department[]>>('/departments', { params: { for_select: 1, status: 'active' } }),
        api.get<ApiOk<Position[]>>('/positions', { params: { for_select: 1, status: 'active' } }),
        api.get<ApiOk<JobLevel[]>>('/job-levels', { params: { for_select: 1, status: 'active' } }),
        api.get<ApiOk<Member[]>>('/users', { params: { for_select: 1, status: 'active' } }),
      ])
      setOutlets(outletRes.data.data)
      setDepartments(deptRes.data.data)
      setPositions(posRes.data.data)
      setJobLevels(levelRes.data.data)
      setManagerOptions(managerRes.data.data)
    } catch {
      setOutlets([])
      setDepartments([])
      setPositions([])
      setJobLevels([])
      setManagerOptions([])
    }
  }

  async function load() {
    try {
      const users = await api.get<ApiOk<Member[]>>('/users', {
        params: {
          search: list.search || undefined,
          status: onboardingFilter === 'pending_hr' ? 'all' : list.status,
          employment_status: employmentFilter !== 'all' ? employmentFilter : undefined,
          onboarding_status: onboardingFilter,
          page: list.page,
          per_page: list.perPage,
        },
      })
      setMembers(users.data.data)
      list.applyMeta(users.data.meta, users.data.data.length)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load()
    }, 200)
    return () => window.clearTimeout(handle)
  }, [list.search, list.status, list.page, list.perPage, employmentFilter, onboardingFilter])

  function openCreate() {
    void loadLookups()
    setEditing(null)
    const fallback = roles.find((item) => item.slug === 'cashier') ?? roles.find((item) => !item.is_owner) ?? roles[0]
    setForm({ ...empty, role_id: fallback ? String(fallback.id) : '' })
    setDocuments(emptyEmployeeDocuments())
    setDocumentFlags({ photo: false, ktp: false, kk: false })
    setError('')
    setOpen(true)
    logMasterForm('employee', 'create')
  }

  function openEdit(member: Member) {
    void loadLookups()
    setEditing(member)
    setDocuments(emptyEmployeeDocuments())
    setDocumentFlags({
      photo: member.has_employee_photo ?? false,
      ktp: member.has_ktp_document ?? false,
      kk: member.has_kk_document ?? false,
    })
    setForm({
      name: member.name,
      email: member.email,
      username: member.username ?? '',
      phone: member.phone ?? '',
      password: '',
      national_id: member.national_id ?? '',
      tax_id: member.tax_id ?? '',
      birth_date: member.birth_date ?? '',
      birth_place: member.birth_place ?? '',
      gender: member.gender ?? '',
      marital_status: member.marital_status ?? '',
      address: member.address ?? '',
      emergency_contact_name: member.emergency_contact_name ?? '',
      emergency_contact_phone: member.emergency_contact_phone ?? '',
      employee_code: member.employee_code ?? '',
      role_id: member.role_id ? String(member.role_id) : '',
      outlet_id: member.outlet ? String(member.outlet.id) : '',
      department_id: member.department ? String(member.department.id) : '',
      position_id: member.position ? String(member.position.id) : '',
      job_level_id: member.job_level ? String(member.job_level.id) : '',
      manager_id: member.manager ? String(member.manager.membership_id) : '',
      hired_at: member.hired_at ?? '',
      employment_status: member.employment_status ?? 'active',
      contract_type: member.contract_type ?? '',
      contract_end_at: member.contract_end_at ?? '',
      terminated_at: member.terminated_at ?? '',
      is_active: member.is_active,
    })
    setError('')
    setOpen(true)
    logMasterForm('employee', 'edit', member.name)
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
      national_id: form.national_id.trim() || null,
      tax_id: form.tax_id.trim() || null,
      birth_date: form.birth_date || null,
      birth_place: form.birth_place.trim() || null,
      gender: form.gender || null,
      marital_status: form.marital_status || null,
      address: form.address.trim() || null,
      emergency_contact_name: form.emergency_contact_name.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.trim() || null,
      employee_code: form.employee_code.trim() || null,
      role_id: form.role_id ? Number(form.role_id) : null,
      outlet_id: form.outlet_id ? Number(form.outlet_id) : null,
      department_id: form.department_id ? Number(form.department_id) : null,
      position_id: form.position_id ? Number(form.position_id) : null,
      job_level_id: form.job_level_id ? Number(form.job_level_id) : null,
      manager_id: form.manager_id ? Number(form.manager_id) : null,
      hired_at: form.hired_at || null,
      employment_status: form.employment_status,
      contract_type: form.contract_type || null,
      contract_end_at: form.contract_end_at || null,
      terminated_at: form.terminated_at || null,
      is_active: form.is_active,
      ...(form.password ? { password: form.password } : {}),
    }

    try {
      let userId = editing?.id
      if (editing) {
        await api.put(`/users/${editing.id}`, payload)
      } else {
        const created = await api.post<ApiOk<Member>>('/users', { ...payload, password: form.password })
        userId = created.data.data.id
      }

      if (userId && (documents.photo || documents.ktp || documents.kk)) {
        try {
          await uploadEmployeeDocuments(userId, documents)
        } catch (uploadErr) {
          feedback.error(apiMessage(uploadErr, t('employeeDocumentFailed')))
        }
      }

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
      title: t('deleteEmployeeTitle'),
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

  const formOutlets = outlets.filter((item) => item.is_active !== false || String(item.id) === form.outlet_id)
  const managerChoices = managerOptions.filter((item) => item.membership_id !== editing?.membership_id)
  const showContractEnd = form.contract_type === 'contract'
  const showTerminatedAt = form.employment_status === 'resigned' || form.employment_status === 'terminated'

  return (
    <div>
      <PageHeader
        eyebrow={t('appHr')}
        title={t('navEmployees')}
        subtitle={t('employeesSubtitle')}
        action={
          can('users', 'create') ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => setInviteOpen(true)}>
                {t('inviteEmployeeTitle')}
              </button>
              <button type="button" className="btn-primary" onClick={openCreate}>
                {t('addEmployee')}
              </button>
            </div>
          ) : undefined
        }
      />

      <MasterFilters
        {...list.filters}
        searchPlaceholder={t('searchEmployee')}
        extra={
          <>
            <select
              className="field !mt-0 max-w-[11rem]"
              value={onboardingFilter}
              onChange={(e) => {
                list.setPage(1)
                setOnboardingFilter(e.target.value)
              }}
            >
              <option value="complete">{t('onboardingFilterActive')}</option>
              <option value="pending_hr">{t('onboardingFilterPending')}</option>
              <option value="all">{t('onboardingFilterAll')}</option>
            </select>
            <select
              className="field !mt-0 max-w-[12rem]"
              value={employmentFilter}
              onChange={(e) => {
                list.setPage(1)
                setEmploymentFilter(e.target.value)
              }}
            >
              <option value="all">{t('filterEmploymentAll')}</option>
              <option value="active">{t('employmentActive')}</option>
              <option value="probation">{t('employmentProbation')}</option>
              <option value="resigned">{t('employmentResigned')}</option>
              <option value="terminated">{t('employmentTerminated')}</option>
            </select>
          </>
        }
      />

      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('employeeCode')}</th>
              <th className="px-4 py-3 font-medium">{t('nationalId')}</th>
              <th className="px-4 py-3 font-medium">{t('navDepartments')}</th>
              <th className="px-4 py-3 font-medium">{t('navPositions')}</th>
              <th className="px-4 py-3 font-medium">{t('navJobLevels')}</th>
              <th className="px-4 py-3 font-medium">{t('employmentStatus')}</th>
              <th className="px-4 py-3 font-medium">{t('status')}</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.membership_id ?? member.id} className="border-t border-line hover:bg-fill">
                <td className="px-4 py-3 font-medium">{member.name}</td>
                <td className="px-4 py-3 text-muted">{member.employee_code ?? '-'}</td>
                <td className="px-4 py-3 text-muted">{member.national_id ?? '-'}</td>
                <td className="px-4 py-3 text-muted">{member.department?.name ?? '-'}</td>
                <td className="px-4 py-3 text-muted">{member.position?.name ?? '-'}</td>
                <td className="px-4 py-3 text-muted">{member.job_level?.name ?? '-'}</td>
                <td className="px-4 py-3 text-muted">
                  {member.onboarding_status === 'pending_hr' ? t('onboardingPendingBadge') : employmentLabel(member.employment_status, t)}
                </td>
                <td className="px-4 py-3">
                  <span className={member.is_active ? 'text-mint' : 'text-rose-300'}>
                    {member.is_active ? t('active') : t('inactive')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {member.onboarding_status === 'pending_hr' && can('users', 'edit') ? (
                    <button type="button" className="mr-3 text-gold" onClick={() => setReviewMember(member)}>
                      {t('onboardingReview')}
                    </button>
                  ) : null}
                  {can('users', 'edit') && member.onboarding_status !== 'pending_hr' ? (
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
                <td className="px-4 py-8 text-center text-muted" colSpan={9}>
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
              className="glass max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl p-6"
            >
              <h2 className="font-display mb-1 text-xl font-bold">
                {editing ? t('editEmployee') : t('newEmployee')}
              </h2>
              {!editing ? <p className="mb-4 text-xs text-muted">{t('employeeInviteHint')}</p> : null}
              {error ? <FormAlert>{error}</FormAlert> : null}

              <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{t('sectionAccount')}</h3>
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
                  {editing ? t('optionalPassword') : t('password')}
                  <input
                    minLength={8}
                    type="password"
                    className="field"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
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
                <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  {t('loginActive')}
                </label>
              </div>

              <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{t('sectionBiodata')}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-muted">
                  {t('nationalId')}
                  <input
                    className="field"
                    inputMode="numeric"
                    maxLength={16}
                    value={form.national_id}
                    onChange={(e) => setForm({ ...form, national_id: e.target.value.replace(/\D/g, '') })}
                  />
                </label>
                <label className="text-sm text-muted">
                  {t('taxId')}
                  <input className="field" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  {t('birthDate')}
                  <input type="date" className="field" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  {t('birthPlace')}
                  <input className="field" value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  {t('gender')}
                  <select className="field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option value="">-</option>
                    <option value="male">{t('genderMale')}</option>
                    <option value="female">{t('genderFemale')}</option>
                  </select>
                </label>
                <label className="text-sm text-muted">
                  {t('maritalStatus')}
                  <select className="field" value={form.marital_status} onChange={(e) => setForm({ ...form, marital_status: e.target.value })}>
                    <option value="">-</option>
                    <option value="single">{t('maritalSingle')}</option>
                    <option value="married">{t('maritalMarried')}</option>
                    <option value="divorced">{t('maritalDivorced')}</option>
                    <option value="widowed">{t('maritalWidowed')}</option>
                  </select>
                </label>
                <label className="text-sm text-muted sm:col-span-2">
                  {t('address')}
                  <textarea className="field min-h-[72px]" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  {t('emergencyContactName')}
                  <input
                    className="field"
                    value={form.emergency_contact_name}
                    onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
                  />
                </label>
                <label className="text-sm text-muted">
                  {t('emergencyContactPhone')}
                  <input
                    className="field"
                    value={form.emergency_contact_phone}
                    onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })}
                  />
                </label>
              </div>

              <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{t('sectionDocuments')}</h3>
              <p className="mb-3 text-xs text-muted">{t('employeeDocumentsOptional')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <EmployeeDocumentField
                  type="photo"
                  label={t('employeePhoto')}
                  hint={t('employeePhotoHint')}
                  accept={employeeDocumentAccept('photo')}
                  value={documents.photo}
                  existing={documentFlags.photo}
                  userId={editing?.id}
                  onChange={(file) => setDocuments({ ...documents, photo: file })}
                />
                <EmployeeDocumentField
                  type="ktp"
                  label={t('ktpDocument')}
                  hint={t('ktpDocumentHint')}
                  accept={employeeDocumentAccept('ktp')}
                  value={documents.ktp}
                  existing={documentFlags.ktp}
                  userId={editing?.id}
                  onChange={(file) => setDocuments({ ...documents, ktp: file })}
                />
                <EmployeeDocumentField
                  type="kk"
                  label={t('kkDocument')}
                  hint={t('kkDocumentHint')}
                  accept={employeeDocumentAccept('kk')}
                  value={documents.kk}
                  existing={documentFlags.kk}
                  userId={editing?.id}
                  onChange={(file) => setDocuments({ ...documents, kk: file })}
                />
              </div>

              <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{t('sectionEmployment')}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-muted">
                  {t('employeeCode')}
                  <input className="field" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  {t('hiredAt')}
                  <input type="date" className="field" value={form.hired_at} onChange={(e) => setForm({ ...form, hired_at: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  {t('navDepartments')}
                  <select className="field" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                    <option value="">-</option>
                    {departments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-muted">
                  {t('navPositions')}
                  <select className="field" value={form.position_id} onChange={(e) => setForm({ ...form, position_id: e.target.value })}>
                    <option value="">-</option>
                    {positions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-muted">
                  {t('navJobLevels')}
                  <select className="field" value={form.job_level_id} onChange={(e) => setForm({ ...form, job_level_id: e.target.value })}>
                    <option value="">-</option>
                    {jobLevels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-muted">
                  {t('manager')}
                  <select className="field" value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
                    <option value="">-</option>
                    {managerChoices.map((item) => (
                      <option key={item.membership_id ?? item.id} value={item.membership_id ?? item.id}>
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
                <label className="text-sm text-muted">
                  {t('employmentStatus')}
                  <select
                    className="field"
                    value={form.employment_status}
                    onChange={(e) => setForm({ ...form, employment_status: e.target.value })}
                  >
                    <option value="active">{t('employmentActive')}</option>
                    <option value="probation">{t('employmentProbation')}</option>
                    <option value="resigned">{t('employmentResigned')}</option>
                    <option value="terminated">{t('employmentTerminated')}</option>
                  </select>
                </label>
                <label className="text-sm text-muted">
                  {t('contractType')}
                  <select className="field" value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })}>
                    <option value="">-</option>
                    <option value="permanent">{t('contractPermanent')}</option>
                    <option value="contract">{t('contractFixed')}</option>
                    <option value="intern">{t('contractIntern')}</option>
                    <option value="part_time">{t('contractPartTime')}</option>
                  </select>
                </label>
                {showContractEnd ? (
                  <label className="text-sm text-muted">
                    {t('contractEndAt')}
                    <input
                      type="date"
                      className="field"
                      value={form.contract_end_at}
                      onChange={(e) => setForm({ ...form, contract_end_at: e.target.value })}
                    />
                  </label>
                ) : null}
                {showTerminatedAt ? (
                  <label className="text-sm text-muted">
                    {t('terminatedAt')}
                    <input
                      type="date"
                      className="field"
                      value={form.terminated_at}
                      onChange={(e) => setForm({ ...form, terminated_at: e.target.value })}
                    />
                  </label>
                ) : null}
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

      <EmployeeInviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <EmployeeOnboardingModal
        member={reviewMember}
        open={!!reviewMember}
        onClose={() => setReviewMember(null)}
        onDone={() => void load()}
      />
    </div>
  )
}
