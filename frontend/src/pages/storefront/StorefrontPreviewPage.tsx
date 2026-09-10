import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiMessage } from '../../api/client'
import { useFeedback } from '../../components/feedback'
import { useI18n } from '../../i18n'
import type { ApiOk } from '../../types'
import { ShopChrome, StorefrontShopProvider } from './commerce/StorefrontShop'
import { readStorefrontPreviewDraft } from './previewDraft'
import { StorefrontSite, type StorefrontRenderModel, type StorefrontRenderProduct } from './templates/StorefrontSite'
import type { StorefrontAdmin, StorefrontProductRow } from './types'

export default function StorefrontPreviewPage() {
  const { t } = useI18n()
  const feedback = useFeedback()
  const [loading, setLoading] = useState(true)
  const [model, setModel] = useState<StorefrontRenderModel | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const draft = readStorefrontPreviewDraft()
        const { data } = await api.get<ApiOk<StorefrontAdmin>>('/storefront')
        const sf = data.data

        let products: StorefrontRenderProduct[] = []
        const kind = draft?.site_kind ?? sf.site_kind
        if (kind === 'shop') {
          try {
            const list = await api.get<ApiOk<StorefrontProductRow[]>>('/storefront/products?per_page=48')
            products = (list.data.data ?? [])
              .filter((row) => row.is_visible && row.product)
              .map((row) => ({
                id: row.product_id,
                product_id: row.product_id,
                name: row.product?.name ?? `Produk #${row.product_id}`,
                description: row.product?.description ?? null,
                price: row.override_price ?? row.product?.sell_price ?? 0,
                available_qty: row.allocated_qty == null ? null : Math.max(0, row.allocated_qty - row.sold_qty),
                category_id: row.product?.category_id ?? null,
                image_url: row.product?.image_url ?? null,
                is_deal: Boolean(row.is_deal),
                is_new_arrival: Boolean(row.is_new_arrival),
                is_bestseller: Boolean(row.is_bestseller),
                sold_count: row.units_sold ?? 0,
                avg_rating: row.avg_rating ?? 0,
                review_count: row.review_count ?? 0,
              }))
          } catch {
            products = []
          }
        }

        const draftTheme = draft?.theme_content
        const hasDraftTheme =
          draftTheme != null && typeof draftTheme === 'object' && Object.keys(draftTheme).length > 0

        setModel({
          site_kind: kind,
          template_key: draft?.template_key ?? sf.template_key,
          title: draft?.title || sf.title || 'Toko',
          tagline: draft?.tagline ?? sf.tagline ?? '',
          about: draft?.about ?? sf.about ?? '',
          logo_url: draft?.logo_url ?? sf.logo_url ?? null,
          contact_email: draft?.contact_email ?? sf.contact_email ?? null,
          contact_phone: draft?.contact_phone ?? sf.contact_phone ?? null,
          contact_address: draft?.contact_address ?? sf.contact_address ?? null,
          bank_accounts: draft?.bank_accounts ?? sf.bank_accounts ?? [],
          shipping: draft?.shipping ?? sf.shipping ?? null,
          brand_colors: draft?.brand_colors ?? sf.brand_colors ?? undefined,
          // Empty draft theme must not wipe saved Setup slots.
          theme_content: hasDraftTheme ? draftTheme : (sf.theme_content ?? {}),
          // Prefer draft blocks when provided (incl. empty = legacy template). Else saved page.
          home_blocks: draft?.home_blocks !== undefined ? draft.home_blocks : (sf.home_blocks ?? []),
          products,
          preview: true,
        })
      } catch (err) {
        feedback.error(apiMessage(err, t('loadFailed')))
      } finally {
        setLoading(false)
      }
    })()
  }, [feedback, t])

  const body = useMemo(() => {
    if (loading) {
      return <div className="grid min-h-screen place-items-center text-sm text-slate-500">{t('loading')}</div>
    }
    if (!model) {
      return (
        <div className="grid min-h-screen place-items-center gap-3 text-center text-sm text-slate-500">
          <div>{t('storefrontPreviewLoadFailed')}</div>
          <Link to="/app" className="underline">
            {t('storefrontBackToApp')}
          </Link>
        </div>
      )
    }
    return (
      <StorefrontShopProvider model={model}>
        <ShopChrome model={model}>
          <StorefrontSite model={model} />
        </ShopChrome>
      </StorefrontShopProvider>
    )
  }, [loading, model, t])

  return body
}
