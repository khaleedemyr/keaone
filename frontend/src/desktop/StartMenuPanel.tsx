import type { ReactNode } from 'react'
import { Logo } from '../components/Logo'
import { useI18n } from '../i18n'
import type { AppId } from './DesktopContext'
import { APP_TILE, AppGlyph } from './glyphs'

type StartMenuPanelProps = {
  open: boolean
  onClose: () => void
  apps: AppId[]
  titles: Partial<Record<AppId, string>>
  onOpenApp: (id: AppId) => void
  eyebrow: string
  accountPanel: ReactNode
}

export function StartMenuPanel({
  open,
  onClose,
  apps,
  titles,
  onOpenApp,
  eyebrow,
  accountPanel,
}: StartMenuPanelProps) {
  const { t } = useI18n()
  if (!open) return null

  return (
    <>
      <button type="button" className="os-start-scrim" aria-label="Close start" onClick={onClose} />
      <div className="os-start">
        <div className="os-start-layout">
          <div className="os-start-apps">
            <div className="mb-3 flex items-center gap-3">
              <Logo className="h-11 w-11" />
              <div>
                <div className="font-display text-base font-bold">KEA One</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-mint/80">{eyebrow}</div>
              </div>
            </div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              {t('startMenuApps')}
            </div>
            <div className="os-start-grid">
              {apps.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="os-start-app"
                  onClick={() => {
                    onClose()
                    onOpenApp(id)
                  }}
                >
                  <span className={`os-start-app-tile bg-gradient-to-br ${APP_TILE[id]} text-ink`}>
                    <AppGlyph id={id} />
                  </span>
                  <span className="os-start-app-label">{titles[id] ?? id}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="os-start-account">{accountPanel}</div>
        </div>
      </div>
    </>
  )
}
