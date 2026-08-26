import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { persistPrefs } from './api/prefs'
import { applyDocumentLang, langMeta, parseLang, type Lang } from './i18n/langs'
import { messages, type MsgKey } from './i18n/messages'

export type { Lang, MsgKey }
export { LANGS, parseLang } from './i18n/langs'

type I18nContextValue = {
  lang: Lang
  locale: string
  setLang: (lang: Lang) => void
  t: (key: MsgKey, vars?: Record<string, string>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)
const STORAGE_KEY = 'kea_lang'

function readLang(): Lang {
  return parseLang(localStorage.getItem(STORAGE_KEY))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    typeof document === 'undefined' ? 'id' : readLang(),
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang)
    applyDocumentLang(lang)
    persistPrefs({ lang })
  }, [lang])

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      locale: langMeta(lang).locale,
      setLang: setLangState,
      t: (key, vars) => {
        let text = messages[lang][key] || messages.id[key]
        if (vars) {
          for (const [name, value] of Object.entries(vars)) {
            text = text.replaceAll(`{${name}}`, value)
          }
        }
        return text
      },
    }),
    [lang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
