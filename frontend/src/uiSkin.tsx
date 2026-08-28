import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { persistPrefs } from './api/prefs'
import { useI18n } from './i18n'

export type UiSkinPreference = 'auto' | 'desktop' | 'erp'
export type UiSkin = 'desktop' | 'erp'

const STORAGE_KEY = 'kea_ui_skin'
const MOBILE_MQ = '(max-width: 767px)'

type UiSkinContextValue = {
  preference: UiSkinPreference
  skin: UiSkin
  setPreference: (preference: UiSkinPreference) => void
}

const UiSkinContext = createContext<UiSkinContextValue | null>(null)

export function readUiSkinPreference(): UiSkinPreference {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'desktop' || saved === 'erp' || saved === 'auto' ? saved : 'auto'
}

export function resolveUiSkin(preference: UiSkinPreference): UiSkin {
  if (preference === 'desktop') return 'desktop'
  if (preference === 'erp') return 'erp'
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches ? 'erp' : 'desktop'
}

export function parseUiSkinPreference(raw: unknown): UiSkinPreference {
  return raw === 'desktop' || raw === 'erp' || raw === 'auto' ? raw : 'auto'
}

export function UiSkinProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<UiSkinPreference>(() =>
    typeof window === 'undefined' ? 'auto' : readUiSkinPreference(),
  )
  const [mobile, setMobile] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(MOBILE_MQ).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const onChange = () => setMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const skin = useMemo<UiSkin>(() => {
    if (preference === 'desktop') return 'desktop'
    if (preference === 'erp') return 'erp'
    return mobile ? 'erp' : 'desktop'
  }, [preference, mobile])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, preference)
    document.documentElement.dataset.uiSkin = skin
    persistPrefs({ uiSkin: preference })
  }, [preference, skin])

  const value = useMemo(
    () => ({
      preference,
      skin,
      setPreference: setPreferenceState,
    }),
    [preference, skin],
  )

  return <UiSkinContext.Provider value={value}>{children}</UiSkinContext.Provider>
}

export function useUiSkin(): UiSkinContextValue {
  const ctx = useContext(UiSkinContext)
  if (!ctx) throw new Error('useUiSkin must be used within UiSkinProvider')
  return ctx
}

export function UiSkinPicker() {
  const { preference, setPreference } = useUiSkin()
  const { t } = useI18n()

  const options: { id: UiSkinPreference; label: string; hint: string }[] = [
    { id: 'auto', label: t('uiSkinAuto'), hint: t('uiSkinAutoHint') },
    { id: 'desktop', label: t('uiSkinDesktop'), hint: t('uiSkinDesktopHint') },
    { id: 'erp', label: t('uiSkinErp'), hint: t('uiSkinErpHint') },
  ]

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const active = preference === option.id
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setPreference(option.id)}
            className={`rounded-2xl border px-3 py-3 text-left transition ${
              active
                ? 'border-mint bg-fill shadow-[inset_0_0_0_1px_rgba(62,232,197,0.28)]'
                : 'border-line hover:border-mint/40'
            }`}
          >
            <div className="text-sm font-medium text-fg">{option.label}</div>
            <div className="mt-1 text-xs text-muted">{option.hint}</div>
          </button>
        )
      })}
    </div>
  )
}
