import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { BusinessTypeField } from '../components/BusinessTypeField'
import { PrefsBar } from '../components/PrefsBar'
import { ChatTray } from '../desktop/ChatTray'
import { ClockTray } from '../desktop/ClockTray'
import { LiveSupportTray } from '../desktop/LiveSupportTray'
import { NotesTray } from '../desktop/NotesTray'
import { NotifyTray } from '../desktop/NotifyTray'
import { useTenantApps } from '../desktop/useTenantApps'
import { useI18n } from '../i18n'
import { ErpAccountMenu } from './ErpAccountMenu'
import { ErpShell } from './ErpShell'
import { TenantAppView } from './TenantAppView'
import { useTenantErpSearchEntries } from './useTenantErpSearchEntries'

export default function TenantErpShell() {
  const { t } = useI18n()
  const { me, logout, switchCompany, createCompany } = useAuth()
  const navigate = useNavigate()
  const { apps, titles } = useTenantApps()
  const searchEntries = useTenantErpSearchEntries(apps, titles)
  const [newCompany, setNewCompany] = useState('')
  const [newType, setNewType] = useState('retail')
  const [creating, setCreating] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  async function handleSwitch(companyId: number) {
    if (companyId === me?.company?.id) return
    await switchCompany(companyId)
  }

  async function handleCreateCompany() {
    if (!newCompany.trim()) return
    setCreating(true)
    try {
      await createCompany(newCompany.trim(), newType)
      setNewCompany('')
    } finally {
      setCreating(false)
    }
  }

  async function leaveStore() {
    await switchCompany(null)
    navigate('/app', { replace: true })
  }

  const banners = (
    <>
      {me?.access === 'support' ? (
        <div className="erp-banner">
          <span>
            {t('supportMode')} · {me.company?.name}
          </span>
          <button type="button" onClick={() => void leaveStore()}>
            {t('backToPlatform')}
          </button>
        </div>
      ) : me?.billing && !me.billing.usable ? (
        <div className="erp-banner">
          <span>{t('billingBlocked')}</span>
        </div>
      ) : me?.billing?.status === 'trialing' && me.billing.trial_ends_at ? (
        <div className="erp-banner is-info">
          <span>{t('trialUntil', { date: new Date(me.billing.trial_ends_at).toLocaleDateString() })}</span>
        </div>
      ) : null}
    </>
  )

  const accountSubtitle = me?.company?.name
    ? `${me.company.name}${me.outlet?.name ? ` · ${me.outlet.name}` : ''}`
    : undefined

  return (
    <ErpShell
      apps={apps}
      titles={titles}
      searchEntries={searchEntries}
      eyebrow={t('osLine')}
      renderApp={(id) => <TenantAppView appId={id} />}
      banners={banners}
      sidebarTools={
        <>
          <NotesTray />
          <ClockTray navCompact />
          <ChatTray />
          <LiveSupportTray />
          <NotifyTray />
        </>
      }
      navbarExtras={
        <>
          <NotesTray />
          <ClockTray navCompact />
          <ChatTray />
          <LiveSupportTray />
          <NotifyTray />
        </>
      }
      accountMenu={
        <ErpAccountMenu name={me?.user.name ?? ''} avatar={me?.user.avatar} subtitle={accountSubtitle}>
          <div className="sm:hidden border-b border-line pb-3">
            <PrefsBar compact />
          </div>

          <div className="erp-account-head">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-fg">{me?.user.name}</div>
              <div className="mt-0.5 truncate text-xs text-muted">
                {me?.company?.name}
                {me?.outlet?.name ? ` · ${me.outlet.name}` : ''}
              </div>
              <div className="mt-1 text-[11px] text-mint">
                {me?.access === 'support' ? t('supportMode') : me?.user.role_name ?? me?.user.role}
              </div>
            </div>
          </div>

          {me?.user.is_platform ? (
            <button
              type="button"
              className="btn-ghost mt-3 w-full"
              onClick={() => {
                if (me.access === 'support') void leaveStore()
                else navigate('/app')
              }}
            >
              {t('openPlatform')}
            </button>
          ) : null}

          {(me?.memberships?.length ?? 0) > 1 ? (
            <div className="mt-3">
              <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted">{t('yourCompanies')}</div>
              <div className="max-h-32 space-y-1 overflow-auto">
                {me?.memberships?.map((item) => (
                  <button
                    key={item.company_id}
                    type="button"
                    className={`erp-company ${item.company_id === me.company?.id ? 'is-active' : ''}`}
                    onClick={() => void handleSwitch(item.company_id)}
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="text-[10px] uppercase text-muted">{item.role}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!me?.user.is_platform ? (
            <form
              className="mt-3 space-y-1"
              onSubmit={(event) => {
                event.preventDefault()
                void handleCreateCompany()
              }}
            >
              <div className="flex gap-1">
                <input
                  className="field !py-1.5 !text-xs"
                  placeholder={t('newCompany')}
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                />
                <button type="submit" disabled={creating} className="btn-ghost !px-2 !text-xs">
                  {t('addCompany')}
                </button>
              </div>
              <BusinessTypeField value={newType} onChange={setNewType} />
            </form>
          ) : null}

          <button type="button" className="btn-ghost mt-3 w-full" onClick={() => void handleLogout()}>
            {t('logout')}
          </button>
        </ErpAccountMenu>
      }
    />
  )
}
