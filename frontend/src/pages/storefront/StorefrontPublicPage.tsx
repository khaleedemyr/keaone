import { useEffect, useMemo, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk } from '../../types'
import { ShopChrome, StorefrontShopProvider } from './commerce/StorefrontShop'
import { resolveStorefrontHost } from './lib/storefrontHost'
import { StorefrontSite, type StorefrontRenderModel, type StorefrontRenderProduct } from './templates/StorefrontSite'
import type { StorefrontShipping } from './types'

type PublicStorefrontPayload = {
  host: string
  site_kind: StorefrontRenderModel['site_kind']
  template_key: string
  title?: string | null
  tagline?: string | null
  about?: string | null
  logo_url?: string | null
  brand_colors?: StorefrontRenderModel['brand_colors']
  theme_content?: StorefrontRenderModel['theme_content']
  home_blocks?: StorefrontRenderModel['home_blocks']
  contact_email?: string | null
  contact_phone?: string | null
  contact_address?: string | null
  bank_accounts?: StorefrontRenderModel['bank_accounts']
  shipping?: StorefrontShipping | null
  has_news?: boolean
  news?: StorefrontRenderModel['news']
}

type PublicProductPayload = {
  product_id: number
  name?: string | null
  description?: string | null
  price?: number
  available_qty?: number | null
  category_id?: number | null
  image_url?: string | null
  images?: Array<{ id?: number; url?: string | null; is_primary?: boolean }>
  weight_gram?: number | null
  variant_attributes?: StorefrontRenderProduct['variant_attributes']
  is_deal?: boolean
  is_new_arrival?: boolean
  is_bestseller?: boolean
  sold_count?: number
  avg_rating?: number
  review_count?: number
}

export default function StorefrontPublicPage() {
  const host = resolveStorefrontHost()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [model, setModel] = useState<StorefrontRenderModel | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const headers = { 'X-Storefront-Host': host }
        const { data } = await api.get<ApiOk<PublicStorefrontPayload>>('/public/storefront', {
          headers,
          skipAuth: true,
          silent: true,
        })
        const sf = data.data

        let products: StorefrontRenderProduct[] = []
        if (sf.site_kind === 'shop') {
          try {
            const list = await api.get<ApiOk<PublicProductPayload[]>>('/public/storefront/products', {
              headers,
              skipAuth: true,
              silent: true,
            })
            products = (list.data.data ?? []).map((row) => ({
              id: row.product_id,
              product_id: row.product_id,
              name: row.name || `Produk #${row.product_id}`,
              description: row.description ?? null,
              price: row.price ?? 0,
              available_qty: row.available_qty ?? null,
              category_id: row.category_id ?? null,
              image_url: row.image_url ?? null,
              images: (row.images ?? [])
                .map((img) => ({
                  id: img.id,
                  url: String(img.url || ''),
                  is_primary: Boolean(img.is_primary),
                }))
                .filter((img) => img.url),
              weight_gram: row.weight_gram ?? null,
              variant_attributes: row.variant_attributes ?? [],
              is_deal: Boolean(row.is_deal),
              is_new_arrival: Boolean(row.is_new_arrival),
              is_bestseller: Boolean(row.is_bestseller),
              sold_count: row.sold_count ?? 0,
              avg_rating: row.avg_rating ?? 0,
              review_count: row.review_count ?? 0,
            }))
          } catch {
            products = []
          }
        }

        setModel({
          site_kind: sf.site_kind,
          template_key: sf.template_key,
          title: sf.title || 'Toko',
          tagline: sf.tagline ?? '',
          about: sf.about ?? '',
          logo_url: sf.logo_url ?? null,
          contact_email: sf.contact_email ?? null,
          contact_phone: sf.contact_phone ?? null,
          contact_address: sf.contact_address ?? null,
          bank_accounts: sf.bank_accounts ?? [],
          shipping: sf.shipping ?? null,
          brand_colors: sf.brand_colors ?? undefined,
          theme_content: sf.theme_content ?? {},
          home_blocks: sf.home_blocks ?? [],
          products,
          news: sf.has_news ? (sf.news ?? []) : [],
          preview: false,
          host: sf.host || host,
        })
      } catch (err) {
        setModel(null)
        setError(apiMessage(err, 'Toko tidak ditemukan untuk domain ini.'))
      } finally {
        setLoading(false)
      }
    })()
  }, [host])

  const body = useMemo(() => {
    if (loading) {
      return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Memuat toko…</div>
    }
    if (!model) {
      return (
        <div className="grid min-h-screen place-items-center gap-2 px-6 text-center text-sm text-slate-500">
          <div className="text-base font-medium text-slate-800">Toko tidak tersedia</div>
          <div>{error || 'Domain belum terhubung atau storefront belum dipublish.'}</div>
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
  }, [error, loading, model])

  return body
}
