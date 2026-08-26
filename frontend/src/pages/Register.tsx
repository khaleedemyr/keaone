import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { apiMessage } from '../api/client'
import { homePath, useAuth } from '../auth'
import { AuthShell } from '../components/AuthShell'
import { FormAlert } from '../components/feedback'
import { IconArrow, IconLock, IconMail } from '../components/icons'
import { BusinessTypeField } from '../components/BusinessTypeField'
import { Logo } from '../components/Logo'
import { useI18n } from '../i18n'

export default function Register() {
  const { me, loading, register } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    company_name: '',
    business_type: 'retail',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && me) {
    return <Navigate to={homePath(me)} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const next = await register(form)
      navigate(homePath(next), { replace: true })
    } catch (err) {
      setError(apiMessage(err, t('registerFailed')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <motion.form
        onSubmit={(e) => void onSubmit(e)}
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo variant="wordmark" className="h-16 w-[132px] sm:h-20 sm:w-[165px]" glow />
          <p className="font-greeting mt-6 text-lg font-medium tracking-tight text-muted">
            {t('createAccount')}
          </p>
          <h2 className="font-greeting mt-2 text-4xl font-bold leading-[1.12] tracking-[-0.04em] text-fg sm:text-5xl">
            {t('registerTitle')}
          </h2>
          <p className="mt-3 max-w-sm text-sm text-muted">{t('registerLead')}</p>
        </div>

        {error ? <FormAlert>{error}</FormAlert> : null}

        <label className="mb-3 block text-sm text-muted">
          {t('name')}
          <input
            required
            className="field"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoComplete="name"
          />
        </label>
        <label className="mb-3 block text-sm text-muted">
          {t('email')}
          <span className="relative mt-1.5 block">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
              <IconMail />
            </span>
            <input
              required
              type="email"
              className="field field-icon-left !mt-0"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
            />
          </span>
        </label>
        <label className="mb-3 block text-sm text-muted">
          {t('password')}
          <span className="relative mt-1.5 block">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
              <IconLock />
            </span>
            <input
              required
              minLength={8}
              type="password"
              className="field field-icon-left !mt-0"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
            />
          </span>
          <span className="mt-1 block text-[11px] text-muted">{t('passwordMin')}</span>
        </label>
        <label className="mb-3 block text-sm text-muted">
          {t('companyName')}
          <input
            required
            className="field"
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
          />
        </label>
        <div className="mb-6">
          <BusinessTypeField
            value={form.business_type}
            onChange={(slug) => setForm({ ...form, business_type: slug })}
          />
        </div>

        <motion.button
          type="submit"
          disabled={submitting}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="btn-primary flex w-full items-center justify-center gap-2 py-3.5"
        >
          {submitting ? t('registering') : t('register')}
          {!submitting ? <IconArrow /> : null}
        </motion.button>

        <p className="mt-5 text-center text-sm text-muted">
          {t('haveAccount')}{' '}
          <Link to="/login" className="text-mint hover:underline">
            {t('signIn')}
          </Link>
        </p>
      </motion.form>
    </AuthShell>
  )
}
