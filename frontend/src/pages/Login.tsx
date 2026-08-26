import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LAST_EMAIL_KEY, apiMessage, isRemembered, sessionGet } from '../api/client'
import { homePath, useAuth } from '../auth'
import { AuthShell } from '../components/AuthShell'
import {
  IconArrow,
  IconEye,
  IconEyeOff,
  IconLock,
  IconMail,
  IconShield,
} from '../components/icons'
import { FormAlert } from '../components/feedback'
import { Logo } from '../components/Logo'
import { useI18n } from '../i18n'

function Sparkle({ className, delay }: { className?: string; delay: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={{ animation: `twinkle 2.1s ease-in-out ${delay} infinite` }}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 0c.4 4.8 2.4 8.4 7.2 10.2L24 12l-4.8 1.8C14.4 15.6 12.4 19.2 12 24c-.4-4.8-2.4-8.4-7.2-10.2L0 12l4.8-1.8C9.6 8.4 11.6 4.8 12 0Z" />
    </svg>
  )
}

export default function Login() {
  const { me, loading, login } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? ''

  const [email, setEmail] = useState(() => sessionGet(LAST_EMAIL_KEY) ?? '')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => isRemembered())
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const busy = useRef(false)

  if (loading) {
    return <AuthShell />
  }

  if (me) {
    const fallback = homePath(me)
    const dest =
      me.user.is_platform
        ? fallback
        : from && from !== '/login' && from !== '/register' && from !== '/platform'
          ? from
          : fallback
    return <Navigate to={dest} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy.current || submitting) return
    busy.current = true
    setError('')
    setSubmitting(true)
    try {
      const next = await login(email, password, remember)
      navigate(homePath(next), { replace: true })
    } catch (err) {
      setError(apiMessage(err, t('loginError')))
      busy.current = false
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
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="relative inline-flex items-center">
            <div className="pointer-events-none absolute -left-11 top-1/2 h-16 w-12 -translate-y-1/2 sm:-left-14">
              <Sparkle className="absolute left-1 top-1 h-3.5 w-3.5 text-mint" delay="0s" />
              <Sparkle className="absolute left-6 top-5 h-2 w-2 text-gold" delay="0.7s" />
              <Sparkle className="absolute left-0.5 bottom-1 h-2.5 w-2.5 text-mint/80" delay="1.3s" />
              <Sparkle className="absolute left-7 -top-1 h-[7px] w-[7px] text-violet" delay="1.8s" />
            </div>
            <Logo variant="wordmark" className="h-20 w-[165px] sm:h-24 sm:w-[198px]" glow />
          </div>
          <p className="font-greeting mt-8 text-lg font-medium tracking-tight text-muted sm:text-xl">
            {t('welcomeBack')}
          </p>
          <h2 className="font-greeting mt-2 text-[2.5rem] font-bold leading-[1.12] tracking-[-0.04em] text-fg sm:text-5xl">
            {t('enterConsole')}
          </h2>
        </div>

        {error ? <FormAlert>{error}</FormAlert> : null}

        <label className="mb-4 block text-sm text-muted">
          {t('email')}
          <span className="relative mt-1.5 block">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
              <IconMail />
            </span>
            <input
              className="field field-icon-left !mt-0"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="owner@demo.test"
            />
          </span>
        </label>

        <label className="mb-4 block text-sm text-muted">
          {t('password')}
          <span className="relative mt-1.5 block">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
              <IconLock />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              className="field field-icon-both !mt-0"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <IconEyeOff /> : <IconEye />}
            </button>
          </span>
        </label>

        <label className="mb-5 flex cursor-pointer items-center gap-2.5 text-sm text-muted">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line accent-[#3ee8c5]"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          {t('rememberMe')}
        </label>

        <motion.button
          type="submit"
          disabled={submitting}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="btn-primary flex w-full items-center justify-center gap-2 py-3.5"
        >
          {submitting ? t('connecting') : t('signIn')}
          {!submitting ? <IconArrow /> : null}
        </motion.button>

        <p className="mt-5 text-center text-sm text-muted">
          {t('noAccount')}{' '}
          <Link to="/register" className="text-mint hover:underline">
            {t('createAccount')}
          </Link>
        </p>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-muted">
          <IconShield />
          {t('loginSecure')}
        </div>
        <p className="mt-2 text-center text-xs text-muted">{t('demoHint')}</p>
        <p className="mt-1 text-center text-xs text-muted">{t('demoPlatform')}</p>
      </motion.form>
    </AuthShell>
  )
}
