import { LANGS, parseLang, useI18n } from '../i18n'
import { useTheme } from '../theme'

/** Theme + language controls styled for the marketing site (not OS PrefsBar). */
export function MktPrefs() {
  const { theme, setTheme } = useTheme()
  const { lang, setLang, t } = useI18n()

  return (
    <div className="mkt-prefs-bar" role="group" aria-label="Preferences">
      <div className="mkt-theme-toggle" role="group" aria-label={t('theme')}>
        <button
          type="button"
          className={theme === 'dark' ? 'is-active' : ''}
          aria-pressed={theme === 'dark'}
          onClick={() => setTheme('dark')}
        >
          {t('dark')}
        </button>
        <button
          type="button"
          className={theme === 'light' ? 'is-active' : ''}
          aria-pressed={theme === 'light'}
          onClick={() => setTheme('light')}
        >
          {t('light')}
        </button>
      </div>
      <label className="mkt-lang">
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
  )
}
