import type { AppId } from './DesktopContext'
import { useDesktop } from './DesktopContext'
import { APP_TILE, AppGlyph } from './glyphs'
import { CLOCK_SKINS, WIDGET_IDS, isWidgetVisible, type WidgetId } from './desktopPrefs'
import { widgetLabelKey } from './widgets/DesktopWidgetsLayer'
import { useI18n } from '../i18n'

type SettingsDesktopProps = {
  apps: AppId[]
  titles: Partial<Record<AppId, string>>
}

export function SettingsDesktop({ apps, titles }: SettingsDesktopProps) {
  const { t } = useI18n()
  const { desktop, setShowDesktopIcons, setAppDesktopVisible, setWidgetVisible, patchWidgets } = useDesktop()

  return (
    <>
      <section>
        <h3 className="mb-2 text-sm font-medium">{t('desktopIcons')}</h3>
        <p className="mb-4 text-xs text-muted">{t('desktopIconsLead')}</p>

        <label className="mb-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={desktop.showIcons}
            onChange={(event) => setShowDesktopIcons(event.target.checked)}
          />
          <span>{t('desktopShowIcons')}</span>
        </label>

        <div className="space-y-2">
          {apps.map((id) => {
            const visible = !desktop.hiddenApps.includes(id)
            return (
              <label key={id} className="flex items-center gap-3 rounded-xl border border-line bg-fill px-3 py-2">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(event) => setAppDesktopVisible(id, event.target.checked)}
                />
                <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${APP_TILE[id]} text-ink`}>
                  <AppGlyph id={id} className="h-4 w-4" />
                </span>
                <span className="text-sm">{titles[id] ?? id}</span>
              </label>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-muted">{t('desktopIconsDragHint')}</p>
      </section>

      <section className="mt-8">
        <h3 className="mb-2 text-sm font-medium">{t('desktopWidgets')}</h3>
        <p className="mb-4 text-xs text-muted">{t('desktopWidgetsLead')}</p>
        <div className="space-y-2">
          {WIDGET_IDS.map((id: WidgetId) => {
            const visible = isWidgetVisible(id, desktop)
            return (
              <label key={id} className="flex items-center gap-3 rounded-xl border border-line bg-fill px-3 py-2">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(event) => setWidgetVisible(id, event.target.checked)}
                />
                <span className="text-sm">{t(widgetLabelKey(id))}</span>
              </label>
            )
          })}
        </div>

        <div className="mt-4">
          <div className="mb-2 text-xs font-medium text-muted">{t('widgetClockSkin')}</div>
          <div className="flex flex-wrap gap-2">
            {CLOCK_SKINS.map((skin) => (
              <button
                key={skin}
                type="button"
                className={`btn-ghost !px-3 !py-1.5 !text-xs${desktop.widgets.clockSkin === skin ? ' !border-mint' : ''}`}
                onClick={() => patchWidgets({ clockSkin: skin })}
              >
                {t(`widgetClockSkin_${skin}` as 'widgetClockSkin_classic')}
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
