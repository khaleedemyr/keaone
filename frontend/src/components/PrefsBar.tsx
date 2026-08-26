import { LayoutGroup, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { LANGS, parseLang, useI18n } from '../i18n'
import { useTheme } from '../theme'
import { IconGlobe, IconMoon, IconSun } from './icons'

function Seg({
  active,
  onClick,
  layoutId,
  children,
}: {
  active: boolean
  onClick: () => void
  layoutId: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative z-0 flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition ${
        active ? 'text-ink' : 'text-muted hover:text-fg'
      }`}
    >
      {active ? (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 -z-10 rounded-md bg-mint shadow-[0_6px_16px_rgba(62,232,197,0.28)]"
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        />
      ) : null}
      {children}
    </button>
  )
}

export function PrefsBar({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme()
  const { lang, setLang, t } = useI18n()

  return (
    <LayoutGroup>
      <div className={`os-prefs${compact ? ' is-compact' : ''}`}>
        <div className="flex items-center">
          <Seg active={theme === 'dark'} onClick={() => setTheme('dark')} layoutId="theme-pill">
            <IconMoon />
            {t('dark')}
          </Seg>
          <Seg active={theme === 'light'} onClick={() => setTheme('light')} layoutId="theme-pill">
            <IconSun />
            {t('light')}
          </Seg>
        </div>
        <div className="os-prefs-split" />
        <label className="os-prefs-lang">
          <IconGlobe />
          <span className="sr-only">{t('language')}</span>
          <select
            value={lang}
            aria-label={t('language')}
            onChange={(event) => setLang(parseLang(event.target.value))}
          >
            {LANGS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.native}
              </option>
            ))}
          </select>
        </label>
      </div>
    </LayoutGroup>
  )
}
