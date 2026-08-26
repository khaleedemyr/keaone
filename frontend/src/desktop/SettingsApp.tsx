import { lazy, useRef, useState } from 'react'
import { apiMessage, apiUpload } from '../api/client'
import { ProfileForm } from '../components/ProfileForm'
import { useFeedback } from '../components/feedback'
import { PrefsBar } from '../components/PrefsBar'
import { useI18n } from '../i18n'
import { useAccess } from '../access'
import { useAuth } from '../auth'
import { logActivity } from '../api/activity'
import type { ApiOk, PosMode, UserPreferences } from '../types'
import { useDesktop } from './DesktopContext'
import { assertWallpaperFile, WALLPAPER_PRESETS } from './wallpaper'
import { AppNavShell } from './AppNavShell'
import { SettingsDesktop } from './SettingsDesktop'
import { usePlatformApps } from './usePlatformApps'
import { useTenantApps } from './useTenantApps'

type Section = 'account' | 'possettings' | 'cafetables'

const PosSettings = lazy(() => import('../pages/settings/PosSettings'))
const CafeTables = lazy(() => import('../pages/settings/CafeTables'))

function usesCafeTables(mode?: PosMode) {
  return mode === 'restaurant'
}

function SettingsAccount() {
  const { t } = useI18n()
  const { me } = useAuth()
  const { wallpaper, setWallpaper } = useDesktop()
  const tenantApps = useTenantApps()
  const platformApps = usePlatformApps()
  const desktopApps = me?.company ? tenantApps : platformApps
  const feedback = useFeedback()
  const fileRef = useRef<HTMLInputElement>(null)

  async function onUpload(file: File | undefined) {
    if (!file) return
    let localUrl: string | undefined
    try {
      assertWallpaperFile(file)
      localUrl = URL.createObjectURL(file)
      setWallpaper({ kind: 'image', id: 'custom', src: localUrl }, false)

      const body = new FormData()
      body.append('file', file, file.name)
      const data = await apiUpload<ApiOk<{ wallpaper: UserPreferences['wallpaper'] }>>('/me/wallpaper', body, 60000)
      const stored = data.data.wallpaper.src
      if (stored) {
        const preview = localUrl
        setWallpaper({ kind: 'image', id: data.data.wallpaper.id, src: `${stored.split('?')[0]}?t=${Date.now()}` }, false)
        if (preview) window.setTimeout(() => URL.revokeObjectURL(preview), 4000)
      }
      feedback.success(t('wallpaperApplied'))
    } catch (err) {
      const key = err instanceof Error ? err.message : ''
      if (key === 'too-large') feedback.error(t('wallpaperTooLarge'))
      else if (key === 'not-image') feedback.error(t('wallpaperFailed'))
      else feedback.error(apiMessage(err, t('wallpaperFailed')))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mint/80">{t('osLine')}</div>
        <h2 className="font-display mt-1 text-2xl font-bold">{t('navProfile')}</h2>
        <p className="mt-1 text-sm text-muted">{t('settingsLead')}</p>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-medium">{t('navProfile')}</h3>
        <p className="mb-3 text-xs text-muted">{t('profileLead')}</p>
        <ProfileForm />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium">{t('appearance')}</h3>
        <PrefsBar />
      </section>

      <SettingsDesktop apps={desktopApps.apps} titles={desktopApps.titles} />

      <section>
        <h3 className="mb-3 text-sm font-medium">{t('wallpaper')}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {WALLPAPER_PRESETS.map((preset) => {
            const active = wallpaper.kind === 'preset' && wallpaper.id === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setWallpaper({ kind: 'preset', id: preset.id })}
                className={`overflow-hidden rounded-2xl border text-left transition ${
                  active ? 'border-mint shadow-[0_0_0_1px_rgba(62,232,197,0.45)]' : 'border-line hover:border-mint/40'
                }`}
              >
                <div className="h-20 w-full" style={{ background: preset.preview }} />
                <div className="px-3 py-2 text-xs text-fg">{t(preset.labelKey)}</div>
              </button>
            )
          })}
        </div>
        <div className="mt-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(event) => void onUpload(event.target.files?.[0])}
          />
          {wallpaper.kind === 'image' && wallpaper.src ? (
            <div className="mb-3 overflow-hidden rounded-2xl border border-mint/40">
              <img src={wallpaper.src} alt="" className="h-28 w-full object-cover" />
            </div>
          ) : null}
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
            {t('wallpaperCustom')}
          </button>
          <p className="mt-2 text-xs text-muted">{t('wallpaperHint')}</p>
        </div>
      </section>
    </div>
  )
}

export default function SettingsApp() {
  const { t } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const [section, setSection] = useState<Section | null>(null)
  const showTables = usesCafeTables(me?.settings?.pos_mode) && can('cafetables')

  const items: { id: Section; label: string }[] = [
    ...(can('settings') ? [{ id: 'account' as const, label: t('navProfile') }] : []),
    ...(can('possettings') ? [{ id: 'possettings' as const, label: t('navPosSettings') }] : []),
    ...(showTables ? [{ id: 'cafetables' as const, label: t('navCafeTables') }] : []),
  ]

  const current = section && items.some((item) => item.id === section) ? section : null

  return (
    <AppNavShell
      items={items}
      current={current}
      onSelect={(id) => {
        setSection(id)
        logActivity('open_section', id)
      }}
    >
      {current === 'account' ? <SettingsAccount /> : null}
      {current === 'possettings' ? <PosSettings /> : null}
      {current === 'cafetables' ? <CafeTables /> : null}
    </AppNavShell>
  )
}
