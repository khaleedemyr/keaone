import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { useI18n, type MsgKey } from '../../i18n'
import type { ApiOk } from '../../types'
import type { StorefrontAdmin } from './types'

type HubSection =
  | 'storefrontsetup'
  | 'storefrontdomain'
  | 'storefrontproducts'
  | 'storefrontorders'
  | 'storefrontnews'
  | 'storefrontinquiries'

type HubStep = {
  key: string
  label: MsgKey
  ok: boolean
  section: HubSection
}

type Props = {
  siteKind: StorefrontAdmin['site_kind'] | null
  onOpen: (section: HubSection) => void
  menuItems: Array<{ id: string; label: string }>
}

export default function StorefrontHub({ siteKind, onOpen, menuItems }: Props) {
  const { t } = useI18n()
  const [sf, setSf] = useState<StorefrontAdmin | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const { data } = await api.get<ApiOk<StorefrontAdmin>>('/storefront', { silent: true })
        setSf(data.data)
      } catch {
        setSf(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const kind = siteKind ?? sf?.site_kind ?? null
  const steps = useMemo(() => {
    const setupOk = Boolean(sf?.title?.trim())
    const domainOk = (sf?.domains?.length ?? 0) > 0
    const productsOk =
      kind !== 'shop' || Boolean(sf?.publish_readiness?.items?.find((row) => row.key === 'products')?.ok)
    const publishOk = sf?.status === 'published'
    const list: HubStep[] = [
      { key: 'setup', label: 'storefrontHubStepSetup', ok: setupOk, section: 'storefrontsetup' },
      { key: 'domain', label: 'storefrontHubStepDomain', ok: domainOk, section: 'storefrontdomain' },
    ]
    if (kind === 'shop') {
      list.push({
        key: 'products',
        label: 'storefrontHubStepProducts',
        ok: productsOk,
        section: 'storefrontproducts',
      })
    } else {
      list.push({
        key: 'content',
        label: 'storefrontHubStepContent',
        ok: Object.keys(sf?.theme_content ?? {}).length > 0 || Boolean(sf?.title?.trim()),
        section: 'storefrontsetup',
      })
    }
    list.push({ key: 'publish', label: 'storefrontHubStepPublish', ok: publishOk, section: 'storefrontsetup' })
    return list
  }, [sf, kind])

  const doneCount = steps.filter((s) => s.ok).length

  return (
    <div className="space-y-5 px-1 py-2">
      <div>
        <h2 className="font-display text-xl font-bold">{t('storefrontHubTitle')}</h2>
        <p className="mt-1 max-w-xl text-sm text-muted">{t('storefrontHubHint')}</p>
      </div>

      <div className="glass max-w-xl space-y-3 rounded-3xl p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">{t('storefrontHubChecklist')}</div>
          <div className="text-xs text-muted">
            {loading ? t('loading') : `${doneCount}/${steps.length}`}
          </div>
        </div>
        <ul className="space-y-2">
          {steps.map((step) => (
            <li key={step.key}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line px-3 py-2.5 text-left text-sm transition hover:border-teal-300"
                onClick={() => onOpen(step.section)}
              >
                <span className={step.ok ? 'text-emerald-700' : 'text-slate-800'}>
                  <span className="mr-2">{step.ok ? '✓' : '○'}</span>
                  {t(step.label)}
                </span>
                <span className="text-xs text-muted">{t('storefrontHubOpen')}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('pickMenu')}</h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {menuItems.map((item) => (
            <button key={item.id} type="button" className="os-app-pick" onClick={() => onOpen(item.id as HubSection)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
