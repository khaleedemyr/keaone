import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, apiMessage } from '../../api/client'
import { FormAlert, useFeedback } from '../../components/feedback'
import { useRoleOptions } from '../../components/RolesManager'
import { useAccess } from '../../access'
import { useI18n } from '../../i18n'
import type { Department, JobLevel, Member, Outlet, Position } from '../../types'
import type { ApiOk } from '../../types'

type Props = {
  member: Member | null
  open: boolean
  onClose: () => void
  onDone: () => void
}

export function EmployeeOnboardingModal({ member, open, onClose, onDone }: Props) {
  const { t } = useI18n()
  const { isOwner } = useAccess()
  const feedback = useFeedback()
  const roles = useRoleOptions('/roles')
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [jobLevels, setJobLevels] = useState<JobLevel[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [managers, setManagers] = useState<Member[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
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
  })

  useEffect(() => {
    if (!open || !member) return
    void Promise.all([
      api.get<ApiOk<Department[]>>('/departments', { params: { for_select: 1, status: 'active' } }),
      api.get<ApiOk<Position[]>>('/positions', { params: { for_select: 1, status: 'active' } }),
      api.get<ApiOk<JobLevel[]>>('/job-levels', { params: { for_select: 1, status: 'active' } }),
      api.get<ApiOk<Outlet[]>>('/outlets', { params: { for_select: 1, status: 'all' } }),
      api.get<ApiOk<Member[]>>('/users', { params: { for_select: 1, status: 'active' } }),
    ]).then(([dept, pos, level, outlet, manager]) => {
      setDepartments(dept.data.data)
      setPositions(pos.data.data)
      setJobLevels(level.data.data)
      setOutlets(outlet.data.data)
      setManagers(manager.data.data)
    })

    const role = roles.find((item) => item.slug === member.role)
    setForm({
      employee_code: '',
      role_id: role ? String(role.id) : member.role_id ? String(member.role_id) : '',
      outlet_id: member.outlet ? String(member.outlet.id) : '',
      department_id: '',
      position_id: '',
      job_level_id: '',
      manager_id: '',
      hired_at: new Date().toISOString().slice(0, 10),
      employment_status: 'active',
      contract_type: '',
      contract_end_at: '',
    })
    setError('')
  }, [open, member, roles])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!member) return
    setSaving(true)
    setError('')
    try {
      await api.post(`/users/${member.id}/approve-onboarding`, {
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
      })
      feedback.success(t('onboardingApproved'))
      onDone()
      onClose()
    } catch (err) {
      setError(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function reject() {
    if (!member) return
    const ok = await feedback.confirm({
      title: t('onboardingRejectTitle'),
      message: t('onboardingRejectConfirm', { name: member.name }),
      confirmLabel: t('delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.post(`/users/${member.id}/reject-onboarding`)
      feedback.success(t('deleted'))
      onDone()
      onClose()
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  if (!member) return null

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.form onSubmit={(e) => void onSubmit(e)} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl p-6">
            <h2 className="font-display mb-1 text-xl font-bold">{t('onboardingReviewTitle')}</h2>
            <p className="mb-4 text-xs text-muted">{t('onboardingReviewLead')}</p>
            {error ? <FormAlert>{error}</FormAlert> : null}

            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('sectionBiodata')}</h3>
            <div className="mb-4 grid gap-2 rounded-2xl bg-fill p-4 text-sm sm:grid-cols-2">
              <div><span className="text-muted">{t('name')}:</span> {member.name}</div>
              <div><span className="text-muted">{t('email')}:</span> {member.email}</div>
              <div><span className="text-muted">{t('phone')}:</span> {member.phone ?? '-'}</div>
              <div><span className="text-muted">{t('nationalId')}:</span> {member.national_id ?? '-'}</div>
              <div><span className="text-muted">{t('birthDate')}:</span> {member.birth_date ?? '-'}</div>
              <div><span className="text-muted">{t('gender')}:</span> {member.gender ?? '-'}</div>
              <div className="sm:col-span-2"><span className="text-muted">{t('address')}:</span> {member.address ?? '-'}</div>
            </div>

            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('sectionEmployment')}</h3>
            <p className="mb-3 text-xs text-muted">{t('onboardingHrFillHint')}</p>
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
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-muted">
                {t('navPositions')}
                <select className="field" value={form.position_id} onChange={(e) => setForm({ ...form, position_id: e.target.value })}>
                  <option value="">-</option>
                  {positions.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-muted">
                {t('navJobLevels')}
                <select className="field" value={form.job_level_id} onChange={(e) => setForm({ ...form, job_level_id: e.target.value })}>
                  <option value="">-</option>
                  {jobLevels.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-muted">
                {t('manager')}
                <select className="field" value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
                  <option value="">-</option>
                  {managers.filter((item) => item.id !== member.id).map((item) => (
                    <option key={item.membership_id ?? item.id} value={item.membership_id ?? item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-muted">
                {t('role')}
                <select className="field" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                  {roles.filter((item) => isOwner || !item.is_owner).map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-muted">
                {t('outlet')}
                <select className="field" value={form.outlet_id} onChange={(e) => setForm({ ...form, outlet_id: e.target.value })}>
                  <option value="">-</option>
                  {outlets.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
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
              {form.contract_type === 'contract' ? (
                <label className="text-sm text-muted">
                  {t('contractEndAt')}
                  <input type="date" className="field" value={form.contract_end_at} onChange={(e) => setForm({ ...form, contract_end_at: e.target.value })} />
                </label>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-ghost text-rose-300" onClick={() => void reject()}>
                {t('onboardingReject')}
              </button>
              <button type="button" className="btn-ghost" onClick={onClose}>{t('cancel')}</button>
              <button type="submit" disabled={saving} className="btn-primary">{t('onboardingApprove')}</button>
            </div>
          </motion.form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
