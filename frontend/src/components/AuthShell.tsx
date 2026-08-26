import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Globe } from './Globe'
import { NetworkField } from './NetworkField'
import { PrefsBar } from './PrefsBar'
import { useI18n } from '../i18n'

export function AuthShell({ children }: { children?: ReactNode }) {
  const { t } = useI18n()

  return (
    <div className="relative min-h-svh overflow-hidden">
      <div className="noise" />
      <div className="grid-fade absolute inset-0 opacity-50" />

      <div className="relative grid min-h-svh lg:grid-cols-[6fr_4fr]">
        <motion.section
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="relative hidden min-h-svh flex-col justify-center overflow-hidden px-10 py-16 lg:flex xl:px-20"
        >
          <NetworkField />
          <div className="relative z-10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-mint/80">
              {t('osLine')}
            </div>
            <h1 className="font-display mt-4 text-6xl font-extrabold leading-[1.02] text-fg xl:text-7xl">
              KEA One
              <span className="block bg-gradient-to-r from-mint via-cyan-200 to-violet bg-clip-text text-transparent">
                ERP
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{t('loginLead')}</p>
            <div className="mt-12 flex justify-center xl:justify-start">
              <Globe />
            </div>
          </div>
        </motion.section>

        <div className="login-card glass relative flex min-h-svh w-full flex-col justify-center overflow-hidden rounded-none p-6 sm:p-10 lg:rounded-l-[36px] lg:p-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-mint/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-violet/15 blur-3xl" />
          <div className="absolute right-4 top-4 z-10 lg:right-8 lg:top-8">
            <PrefsBar compact />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
