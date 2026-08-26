import { useAuth } from '../../auth'
import { useI18n } from '../../i18n'
import { WidgetFrame } from './WidgetFrame'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'K'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function StoreWidget() {
  const { t } = useI18n()
  const { me } = useAuth()

  const company = me?.company?.name ?? t('widgetStoreNone')
  const outlet = me?.outlet?.name
  const role = me?.access === 'support' ? t('supportMode') : me?.user.role_name ?? me?.user.role
  const platform = !me?.company
  const title = platform ? t('platformEyebrow') : company

  return (
    <WidgetFrame id="store" title={t('widgetStore')} width={280} variant="glass" hideWidgetId="store" className="os-widget-store">
      <div className="os-store-hero">
        <div className="os-store-mark" aria-hidden>
          {initials(title)}
        </div>
        <div className="os-store-copy">
          <div className="os-store-label">{t('widgetStore')}</div>
          <div className="os-store-name">{title}</div>
          {outlet ? <div className="os-store-outlet">{outlet}</div> : null}
        </div>
      </div>
      <div className="os-store-footer">
        {role ? <span className="os-store-pill">{role}</span> : null}
        {(me?.memberships.length ?? 0) > 1 ? (
          <span className="os-store-meta">{t('widgetStoreCount', { n: String(me?.memberships.length ?? 0) })}</span>
        ) : null}
      </div>
    </WidgetFrame>
  )
}
