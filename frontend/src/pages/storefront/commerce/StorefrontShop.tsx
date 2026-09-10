import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, apiMessage } from '../../../api/client'
import { formatRupiah } from '../../../lib/money'
import type { ApiOk } from '../../../types'
import type { StorefrontBankAccount, StorefrontShippingOption, StorefrontShippingDestination } from '../types'
import type { StorefrontRenderModel, StorefrontRenderProduct } from '../templates/StorefrontSite'
import {
  cartCount,
  cartSubtotal,
  newClientUuid,
  readCart,
  setCartLineQty,
  upsertCartLine,
  writeCart,
  type StorefrontCartLine,
} from '../lib/cart'
import {
  clearCustomerSession,
  readCustomer,
  readCustomerToken,
  writeCustomerSession,
  type StorefrontCustomer,
} from '../lib/customerSession'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'

/** Public (tenant-host) API options — skip ERP auth, send storefront host. */
function publicApiConfig(
  model: Pick<StorefrontRenderModel, 'preview' | 'host'>,
  extraHeaders?: Record<string, string>,
) {
  if (model.preview) {
    return extraHeaders ? { headers: extraHeaders } : {}
  }
  const host =
    model.host ||
    (typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '')
  return {
    skipAuth: true as const,
    headers: {
      'X-Storefront-Host': host,
      ...extraHeaders,
    },
  }
}

export type ShopView = 'home' | 'product' | 'cart' | 'checkout' | 'success' | 'login' | 'register' | 'account'

export type PlacedOrderSummary = {
  number: string
  subtotal: number
  shipping_cost: number
  total: number
  customer_address?: string | null
  note?: string | null
  shipping_snapshot?: {
    destination_label?: string | null
    courier?: string
    courier_name?: string
    service?: string
    cost?: number
    etd?: string | null
  } | null
  bank_accounts: StorefrontBankAccount[]
  items: Array<{ name: string; qty: number; line_total: number }>
}

export type CustomerOrderRow = {
  id: number
  number: string
  status: string
  subtotal?: number
  shipping_cost?: number
  total: number
  customer_address?: string | null
  note?: string | null
  shipping_snapshot?: PlacedOrderSummary['shipping_snapshot']
  placed_at?: string | null
  can_review?: boolean
  items: Array<{
    product_id?: number
    name: string
    qty: number
    line_total: number
    reviewed?: boolean
  }>
}

type ShopContextValue = {
  view: ShopView
  product: StorefrontRenderProduct | null
  cart: StorefrontCartLine[]
  cartCount: number
  cartSubtotal: number
  order: PlacedOrderSummary | null
  customer: StorefrontCustomer | null
  customerOrders: CustomerOrderRow[]
  busy: boolean
  error: string
  openHome: () => void
  openProduct: (product: StorefrontRenderProduct) => void
  openCart: () => void
  openCheckout: () => void
  openLogin: () => void
  openRegister: () => void
  openAccount: () => void
  addToCart: (product: StorefrontRenderProduct, qty?: number) => void
  setQty: (productId: number, qty: number) => void
  removeLine: (productId: number) => void
  clearError: () => void
  login: (email: string, password: string, remember?: boolean) => Promise<boolean>
  register: (form: {
    name: string
    email: string
    password: string
    phone?: string
    address?: string
  }) => Promise<boolean>
  logout: () => Promise<void>
  refreshOrders: () => Promise<void>
  submitReview: (payload: {
    order_id: number
    product_id: number
    rating: number
    comment?: string
  }) => Promise<boolean>
  placeOrder: (form: {
    customer_name: string
    customer_phone?: string
    customer_email?: string
    customer_address?: string
    note?: string
    shipping_destination_id?: number
    shipping_destination_label?: string
    shipping_courier?: string
    shipping_service?: string
  }) => Promise<boolean>
}

const ShopContext = createContext<ShopContextValue | null>(null)

export function useShop(): ShopContextValue | null {
  return useContext(ShopContext)
}

export function StorefrontShopProvider({
  model,
  children,
}: {
  model: StorefrontRenderModel
  children: ReactNode
}) {
  const host = model.host || (typeof window !== 'undefined' ? window.location.hostname : '')
  const scope = model.preview
    ? `sf-preview-${model.title || 'preview'}-${model.template_key}`
    : `sf-live-${host || 'store'}`
  const [view, setView] = useState<ShopView>('home')
  const [product, setProduct] = useState<StorefrontRenderProduct | null>(null)
  const [cart, setCart] = useState<StorefrontCartLine[]>(() => readCart(scope))
  const [order, setOrder] = useState<PlacedOrderSummary | null>(null)
  const [customer, setCustomer] = useState<StorefrontCustomer | null>(() => readCustomer(scope))
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const checkoutUuidRef = useRef<string | null>(null)
  const placeInFlightRef = useRef(false)

  useEffect(() => {
    writeCart(scope, cart)
  }, [cart, scope])

  const customerHeaders = useCallback(() => {
    const token = readCustomerToken(scope)
    if (!token) return {}
    if (model.preview) {
      return { 'X-Storefront-Customer-Token': token }
    }
    return { Authorization: `Bearer ${token}` }
  }, [model.preview, scope])

  const authPath = useCallback(
    (action: 'register' | 'login' | 'me' | 'logout' | 'orders') => {
      if (model.preview && (action === 'register' || action === 'login')) {
        return `/storefront/shop/auth/${action}`
      }
      return `/public/storefront/auth/${action}`
    },
    [model.preview],
  )

  const refreshOrders = useCallback(async () => {
    const token = readCustomerToken(scope)
    if (!token) {
      setCustomerOrders([])
      return
    }
    try {
      const { data } = await api.get<ApiOk<CustomerOrderRow[]>>(authPath('orders'), {
        ...publicApiConfig(model, { Authorization: `Bearer ${token}` }),
        silent: true,
      })
      setCustomerOrders(Array.isArray(data.data) ? data.data : [])
    } catch {
      setCustomerOrders([])
    }
  }, [authPath, model, scope])

  useEffect(() => {
    const token = readCustomerToken(scope)
    if (!token) return
    void (async () => {
      try {
        const { data } = await api.get<ApiOk<StorefrontCustomer>>(authPath('me'), {
          ...publicApiConfig(model, { Authorization: `Bearer ${token}` }),
          silent: true,
        })
        if (data.data) {
          setCustomer(data.data)
          writeCustomerSession(scope, token, data.data)
          void refreshOrders()
        }
      } catch {
        clearCustomerSession(scope)
        setCustomer(null)
      }
    })()
  }, [authPath, model, refreshOrders, scope])

  const openHome = useCallback(() => {
    setView('home')
    setProduct(null)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openProduct = useCallback((next: StorefrontRenderProduct) => {
    setProduct(next)
    setView('product')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openCart = useCallback(() => {
    setView('cart')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openCheckout = useCallback(() => {
    checkoutUuidRef.current = newClientUuid()
    setView('checkout')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openLogin = useCallback(() => {
    setView('login')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openRegister = useCallback(() => {
    setView('register')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openAccount = useCallback(() => {
    setView('account')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    void refreshOrders()
  }, [refreshOrders])

  const addToCart = useCallback((item: StorefrontRenderProduct, qty = 1) => {
    if (item.id <= 0) {
      setError('Produk demo tidak bisa ditambahkan. Tambahkan produk asli di menu Produk toko.')
      return
    }
    if (item.available_qty != null && item.available_qty <= 0) {
      setError('Stok habis.')
      return
    }
    setError('')
    setCart((prev) =>
      upsertCartLine(prev, {
        product_id: item.id,
        name: item.name,
        price: item.price,
        qty,
        image_url: item.image_url,
        available_qty: item.available_qty ?? null,
      }),
    )
  }, [])

  const setQty = useCallback((productId: number, qty: number) => {
    setCart((prev) => setCartLineQty(prev, productId, qty))
  }, [])

  const removeLine = useCallback((productId: number) => {
    setCart((prev) => prev.filter((line) => line.product_id !== productId))
  }, [])

  const login = useCallback(
    async (email: string, password: string, remember = true) => {
      setBusy(true)
      setError('')
      try {
        const { data } = await api.post<
          ApiOk<{ token: string; customer: StorefrontCustomer }>
        >(authPath('login'), { email, password, remember }, publicApiConfig(model))
        writeCustomerSession(scope, data.data.token, data.data.customer)
        setCustomer(data.data.customer)
        setView('account')
        void refreshOrders()
        return true
      } catch (err) {
        setError(apiMessage(err, 'Login gagal.'))
        return false
      } finally {
        setBusy(false)
      }
    },
    [authPath, model, refreshOrders, scope],
  )

  const register = useCallback(
    async (form: {
      name: string
      email: string
      password: string
      phone?: string
      address?: string
    }) => {
      setBusy(true)
      setError('')
      try {
        const { data } = await api.post<
          ApiOk<{ token: string; customer: StorefrontCustomer }>
        >(authPath('register'), form, publicApiConfig(model))
        writeCustomerSession(scope, data.data.token, data.data.customer)
        setCustomer(data.data.customer)
        setView('account')
        void refreshOrders()
        return true
      } catch (err) {
        setError(apiMessage(err, 'Registrasi gagal.'))
        return false
      } finally {
        setBusy(false)
      }
    },
    [authPath, model, refreshOrders, scope],
  )

  const logout = useCallback(async () => {
    const token = readCustomerToken(scope)
    try {
      if (token) {
        await api.post(
          authPath('logout'),
          {},
          { ...publicApiConfig(model, { Authorization: `Bearer ${token}` }), silent: true },
        )
      }
    } catch {
      // ignore
    }
    clearCustomerSession(scope)
    setCustomer(null)
    setCustomerOrders([])
    setView('home')
  }, [authPath, model, scope])

  const placeOrder = useCallback(
    async (form: {
      customer_name: string
      customer_phone?: string
      customer_email?: string
      customer_address?: string
      note?: string
      shipping_destination_id?: number
      shipping_destination_label?: string
      shipping_courier?: string
      shipping_service?: string
    }) => {
      if (placeInFlightRef.current || busy) return false
      if (cart.length === 0) {
        setError('Keranjang masih kosong.')
        return false
      }
      placeInFlightRef.current = true
      setBusy(true)
      setError('')
      try {
        if (!checkoutUuidRef.current) {
          checkoutUuidRef.current = newClientUuid()
        }
        const body = {
          ...form,
          client_uuid: checkoutUuidRef.current,
          items: cart.map((line) => ({ product_id: line.product_id, qty: line.qty })),
        }
        const path = model.preview ? '/storefront/orders' : '/public/storefront/orders'
        const { data } = await api.post<
          ApiOk<{
            number: string
            subtotal?: number
            shipping_cost?: number
            total: number
            customer_address?: string | null
            note?: string | null
            shipping_snapshot?: PlacedOrderSummary['shipping_snapshot']
            bank_accounts?: StorefrontBankAccount[]
            bank_snapshot?: StorefrontBankAccount[]
            items?: Array<{ name?: string; name_snapshot?: string; qty: number; line_total: number }>
          }>
        >(path, body, publicApiConfig(model, customerHeaders() as Record<string, string>))

        const payload = data.data
        setOrder({
          number: payload.number,
          subtotal: payload.subtotal ?? cartSubtotal(cart),
          shipping_cost: payload.shipping_cost ?? 0,
          total: payload.total,
          customer_address: payload.customer_address ?? form.customer_address ?? null,
          note: payload.note ?? form.note ?? null,
          shipping_snapshot: payload.shipping_snapshot ?? null,
          bank_accounts: payload.bank_accounts ?? payload.bank_snapshot ?? model.bank_accounts ?? [],
          items: (payload.items ?? []).map((item) => ({
            name: item.name || item.name_snapshot || 'Produk',
            qty: item.qty,
            line_total: item.line_total,
          })),
        })
        setCart([])
        checkoutUuidRef.current = null
        setView('success')
        void refreshOrders()
        return true
      } catch (err) {
        setError(apiMessage(err, 'Gagal membuat order.'))
        return false
      } finally {
        placeInFlightRef.current = false
        setBusy(false)
      }
    },
    [busy, cart, customerHeaders, model, refreshOrders],
  )

  const submitReview = useCallback(
    async (payload: { order_id: number; product_id: number; rating: number; comment?: string }) => {
      const token = readCustomerToken(scope)
      if (!token) {
        setError('Silakan login terlebih dahulu.')
        return false
      }
      setBusy(true)
      setError('')
      try {
        await api.post(
          '/public/storefront/auth/reviews',
          payload,
          publicApiConfig(model, { Authorization: `Bearer ${token}` }),
        )
        await refreshOrders()
        return true
      } catch (err) {
        setError(apiMessage(err, 'Ulasan gagal dikirim.'))
        return false
      } finally {
        setBusy(false)
      }
    },
    [model, refreshOrders, scope],
  )

  const value = useMemo<ShopContextValue>(
    () => ({
      view,
      product,
      cart,
      cartCount: cartCount(cart),
      cartSubtotal: cartSubtotal(cart),
      order,
      customer,
      customerOrders,
      busy,
      error,
      openHome,
      openProduct,
      openCart,
      openCheckout,
      openLogin,
      openRegister,
      openAccount,
      addToCart,
      setQty,
      removeLine,
      clearError: () => setError(''),
      login,
      register,
      logout,
      refreshOrders,
      submitReview,
      placeOrder,
    }),
    [
      view,
      product,
      cart,
      order,
      customer,
      customerOrders,
      busy,
      error,
      openHome,
      openProduct,
      openCart,
      openCheckout,
      openLogin,
      openRegister,
      openAccount,
      addToCart,
      setQty,
      removeLine,
      login,
      register,
      logout,
      refreshOrders,
      submitReview,
      placeOrder,
    ],
  )

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function ShopChrome({
  model,
  children,
}: {
  model: StorefrontRenderModel
  children?: ReactNode
}) {
  const shop = useShop()
  if (!shop) return children

  if (shop.view === 'product' && shop.product) {
    if (model.template_key === 'shop_avalon') {
      return <AvalonProductDetailPage model={model} product={shop.product} />
    }
    return <ProductDetailPage model={model} product={shop.product} />
  }
  if (shop.view === 'cart') {
    return <CartPage model={model} />
  }
  if (shop.view === 'checkout') {
    return <CheckoutPage model={model} />
  }
  if (shop.view === 'success' && shop.order) {
    return <OrderSuccessPage model={model} order={shop.order} />
  }
  if (shop.view === 'login') {
    return <LoginPage model={model} />
  }
  if (shop.view === 'register') {
    return <RegisterPage model={model} />
  }
  if (shop.view === 'account') {
    if (!shop.customer) return <LoginPage model={model} />
    return <AccountPage model={model} />
  }

  return children
}

function brand(model: StorefrontRenderModel) {
  return {
    primary: model.brand_colors?.primary || '#111111',
    accent: model.brand_colors?.accent || '#525252',
    background: model.brand_colors?.background || '#f7f5f2',
    text: model.brand_colors?.text || '#171717',
  }
}

function relatedProducts(model: StorefrontRenderModel, excludeId?: number, limit = 4) {
  return (model.products ?? []).filter((p) => p.id > 0 && p.id !== excludeId).slice(0, limit)
}

function ShopShell({
  model,
  title,
  children,
}: {
  model: StorefrontRenderModel
  title: string
  children: ReactNode
}) {
  const shop = useShop()
  const c = brand(model)

  return (
    <div className="flex min-h-screen flex-col antialiased" style={{ background: c.background, color: c.text }}>
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        {model.preview ? (
          <div className="border-b border-amber-200/60 bg-amber-50/90 px-4 py-2 text-center text-[11px] tracking-wide text-amber-950">
            {STOREFRONT_PREVIEW_BANNER}
          </div>
        ) : null}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <button
            type="button"
            className="group flex min-w-0 items-center gap-2 text-left transition"
            onClick={() => shop?.openHome()}
          >
            {model.logo_url ? (
              <img src={model.logo_url} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-black/5" />
            ) : (
              <span
                className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold text-white"
                style={{ background: c.primary }}
              >
                {(model.title || 'T').slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="truncate text-[13px] font-medium tracking-tight group-hover:opacity-70">{model.title}</span>
          </button>
          <nav className="hidden items-center gap-6 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500 md:flex">
            <button type="button" className="hover:text-neutral-900" onClick={() => shop?.openHome()}>
              Shop
            </button>
            <span className="text-neutral-900">{title}</span>
            <button
              type="button"
              className="hover:text-neutral-900"
              onClick={() => (shop?.customer ? shop.openAccount() : shop?.openLogin())}
            >
              {shop?.customer ? 'Akun' : 'Login'}
            </button>
            <button type="button" className="hover:text-neutral-900" onClick={() => shop?.openCart()}>
              Cart
            </button>
          </nav>
          <button
            type="button"
            className="relative rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-[12px] font-medium tracking-wide shadow-sm transition hover:border-black/20 hover:shadow"
            onClick={() => shop?.openCart()}
          >
            Cart
            <span
              className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
              style={{ background: c.primary }}
            >
              {shop?.cartCount ?? 0}
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-8 sm:py-8">{children}</main>

      <section className="border-t border-black/5 bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-8 sm:grid-cols-3 sm:px-8">
          {[
            { title: 'Transfer manual', body: 'Bayar via rekening toko, konfirmasi cepat setelah transfer.' },
            { title: 'Stok & harga toko', body: 'Harga mengikuti katalog online. Stok dicek saat checkout.' },
            { title: 'Bantuan', body: model.contact_phone || model.contact_email || 'Hubungi toko lewat kontak di beranda.' },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-black/5 bg-[var(--sf-card,#fafafa)] p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: c.primary }}>
                {item.title}
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-black/5 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <div className="font-medium tracking-tight">{model.title}</div>
            <div className="mt-1 text-[12px] text-white/55">{model.tagline || 'Belanja online resmi toko Anda'}</div>
          </div>
          <button type="button" className="text-[13px] text-white/70 underline-offset-4 hover:text-white hover:underline" onClick={() => shop?.openHome()}>
            Kembali ke beranda
          </button>
        </div>
      </footer>
    </div>
  )
}

function ProductImage({
  src,
  alt,
  primary,
  className = '',
}: {
  src?: string | null
  alt: string
  primary: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div
        className={`grid place-items-center ${className}`}
        style={{ background: `linear-gradient(145deg, ${primary}, #1f2937)` }}
      >
        <div className="px-6 text-center text-white">
          <div className="text-4xl font-semibold tracking-tight sm:text-5xl">{(alt || '?').slice(0, 1).toUpperCase()}</div>
          <div className="mt-3 line-clamp-2 text-sm font-medium opacity-90">{alt}</div>
        </div>
      </div>
    )
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
}

function QtyStepper({
  value,
  max,
  onChange,
}: {
  value: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-black/10 bg-white p-1 shadow-sm">
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-full text-lg text-neutral-600 transition hover:bg-neutral-100"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Kurangi"
      >
        −
      </button>
      <span className="w-10 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-full text-lg text-neutral-600 transition hover:bg-neutral-100"
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Tambah"
      >
        +
      </button>
    </div>
  )
}

function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
  className = '',
  color,
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
  color: string
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-[13px] font-semibold tracking-wide transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      style={{ background: color, color: '#ffffff' }}
    >
      {children}
    </button>
  )
}

function GhostButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-full border border-black/10 bg-white/80 px-6 py-3 text-[13px] font-medium tracking-wide text-neutral-800 shadow-sm transition hover:border-black/20 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}

function RelatedGrid({
  model,
  products,
  title,
}: {
  model: StorefrontRenderModel
  products: StorefrontRenderProduct[]
  title: string
}) {
  const shop = useShop()
  const c = brand(model)
  if (products.length === 0) return null

  return (
    <section className="mt-10 border-t border-black/5 pt-10">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">{title}</div>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">Lanjutkan belanja</h2>
        </div>
        <button type="button" className="text-[13px] text-neutral-500 underline-offset-4 hover:underline" onClick={() => shop?.openHome()}>
          Lihat semua
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            className="overflow-hidden rounded-2xl border border-black/5 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            onClick={() => shop?.openProduct(p)}
          >
            <div className="aspect-[4/5] overflow-hidden bg-neutral-100">
              <ProductImage src={p.image_url} alt={p.name} primary={c.primary} className="h-full w-full object-cover" />
            </div>
            <div className="space-y-1 p-3">
              <div className="line-clamp-2 text-[13px] font-medium leading-snug">{p.name}</div>
              <div className="text-[13px] font-semibold" style={{ color: c.primary }}>
                {formatRupiah(p.price)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

function ProductDetailPage({
  model,
  product,
}: {
  model: StorefrontRenderModel
  product: StorefrontRenderProduct
}) {
  const shop = useShop()
  const c = brand(model)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const outOfStock = product.available_qty != null && product.available_qty <= 0
  const max = outOfStock ? 0 : product.available_qty == null ? 99 : Math.max(1, product.available_qty)
  const related = relatedProducts(model, product.id, 4)

  useEffect(() => {
    if (outOfStock) setQty(0)
    else setQty((prev) => Math.min(Math.max(1, prev), max || 1))
  }, [outOfStock, max, product.id])

  return (
    <ShopShell model={model} title="Product">
      <div className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.08)] ring-1 ring-black/5 lg:col-span-7">
          <div className="aspect-[5/4] sm:aspect-[4/3] lg:min-h-[520px] lg:aspect-auto">
            <ProductImage
              src={product.image_url}
              alt={product.name}
              primary={c.primary}
              className="h-full min-h-[320px] w-full object-cover lg:min-h-[520px]"
            />
          </div>
        </div>

        <div className="flex flex-col rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_16px_40px_rgba(0,0,0,0.04)] sm:p-7 lg:col-span-5 lg:sticky lg:top-24">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">{model.title}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-[2.4rem] sm:leading-tight">
            {product.name}
          </h1>
          <div className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: c.primary }}>
            {formatRupiah(product.price)}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-neutral-50 px-3 py-3 text-[12px]">
              <div className="text-neutral-500">Pembayaran</div>
              <div className="mt-1 font-medium">Transfer bank</div>
            </div>
            <div className="rounded-2xl bg-neutral-50 px-3 py-3 text-[12px]">
              <div className="text-neutral-500">Ketersediaan</div>
              <div className="mt-1 font-medium">
                {outOfStock
                  ? 'Habis'
                  : product.available_qty == null
                    ? 'Siap order'
                    : `Stok ${product.available_qty}`}
              </div>
            </div>
          </div>

          <div className="mt-5 border-y border-black/5 py-4">
            {product.description ? (
              <p className="text-[14px] leading-relaxed text-neutral-600 whitespace-pre-wrap">{product.description}</p>
            ) : (
              <p className="text-[14px] leading-relaxed text-neutral-500">
                Deskripsi belum diisi. Anda tetap bisa menambahkan produk ini ke keranjang dan checkout.
              </p>
            )}
          </div>

          <div className="mt-5">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">Qty</div>
            <QtyStepper value={Math.max(1, qty)} max={Math.max(1, max)} onChange={setQty} />
          </div>

          {shop?.error ? <div className="mt-4 text-sm text-rose-600">{shop.error}</div> : null}
          {outOfStock ? <div className="mt-4 text-sm text-rose-600">Stok habis untuk produk ini.</div> : null}

          <div className="mt-6 flex flex-col gap-3">
            <PrimaryButton
              color={c.primary}
              disabled={outOfStock}
              onClick={() => {
                if (outOfStock) return
                shop?.addToCart(product, qty)
                setAdded(true)
                window.setTimeout(() => setAdded(false), 1600)
                shop?.openCart()
              }}
            >
              {added ? 'Ditambahkan' : 'Tambah ke cart'}
            </PrimaryButton>
            <GhostButton
              disabled={outOfStock}
              onClick={() => {
                if (outOfStock) return
                shop?.addToCart(product, qty)
                setAdded(true)
                window.setTimeout(() => setAdded(false), 1600)
              }}
            >
              Simpan di cart
            </GhostButton>
          </div>

          {(model.bank_accounts?.length ?? 0) > 0 ? (
            <div className="mt-6 rounded-2xl bg-neutral-950 p-4 text-white">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/50">Rekening toko</div>
              <div className="mt-2 space-y-1 text-[13px] text-white/85">
                {model.bank_accounts!.slice(0, 2).map((b, i) => (
                  <div key={`${b.bank_name}-${i}`}>
                    {b.bank_name} · {b.account_number}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <RelatedGrid model={model} products={related} title="Rekomendasi" />
    </ShopShell>
  )
}

/** Avalon PDP — matches https://demo.anarieldesign.com/avalon/product/street-hoodie/ */
function AvalonProductDetailPage({
  model,
  product,
}: {
  model: StorefrontRenderModel
  product: StorefrontRenderProduct
}) {
  const shop = useShop()
  const [qty, setQty] = useState(1)
  const [tab, setTab] = useState<'description' | 'info' | 'reviews'>('description')
  const [added, setAdded] = useState(false)
  const outOfStock = product.available_qty != null && product.available_qty <= 0
  const max = outOfStock ? 0 : product.available_qty == null ? 99 : Math.max(1, product.available_qty)
  const related = relatedProducts(model, product.id, 4)
  const primary = model.brand_colors?.primary || '#da3f3f'
  const rating = product.avg_rating ?? 5
  const reviews = product.review_count ?? 1

  useEffect(() => {
    const id = 'avalon-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap'
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    if (outOfStock) setQty(0)
    else setQty((prev) => Math.min(Math.max(1, prev), max || 1))
  }, [outOfStock, max, product.id])

  return (
    <div
      className="min-h-screen bg-white text-black antialiased"
      style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
    >
      {model.preview ? (
        <div className="border-b border-amber-200/60 bg-amber-50 px-4 py-2 text-center text-[11px] text-amber-950">
          {STOREFRONT_PREVIEW_BANNER}
        </div>
      ) : null}

      <header className="border-b border-[#eee]">
        <div className="mx-auto flex h-14 max-w-[1620px] items-center justify-between px-[30px]">
          <button type="button" className="text-[24px] font-bold lowercase" onClick={() => shop?.openHome()}>
            {model.title || 'avalon'}
          </button>
          <div className="flex items-center gap-5 text-[14px] font-medium">
            <button type="button" onClick={() => shop?.openHome()}>
              Shop
            </button>
            <button type="button" onClick={() => (shop?.customer ? shop.openAccount() : shop?.openLogin())}>
              {shop?.customer ? 'Account' : 'Login'}
            </button>
            <button type="button" className="font-bold" onClick={() => shop?.openCart()}>
              Cart {shop?.cartCount ?? 0}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1620px] px-[30px] py-4 text-[13px] text-[#4c4c4c]">
        <button type="button" className="hover:text-black" onClick={() => shop?.openHome()}>
          Home
        </button>
        <span className="mx-2">/</span>
        <span className="text-black">{product.name}</span>
      </div>

      <div className="mx-auto grid max-w-[1620px] gap-10 px-[30px] pb-14 lg:grid-cols-2 lg:gap-14">
        <div className="overflow-hidden bg-[#f5f5f5]">
          <div className="aspect-[4/5] w-full">
            <ProductImage
              src={product.image_url}
              alt={product.name}
              primary={primary}
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <div>
          <h1 className="text-[32px] font-bold leading-tight sm:text-[40px]">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px] text-[#4c4c4c]">
            <span className="tracking-wide" style={{ color: primary }}>
              {'★'.repeat(Math.round(Math.min(5, rating)))}
            </span>
            <span>
              Rated <strong>{rating.toFixed(2)}</strong> out of 5
            </span>
            <span>({reviews} customer review{reviews === 1 ? '' : 's'})</span>
          </div>
          <div className="mt-4 text-[22px] font-bold">{formatRupiah(product.price)}</div>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#4c4c4c]">
            {product.description?.trim() ||
              'Street-ready essentials with clean cuts and everyday comfort. Pair with denim or layered looks.'}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="flex items-center border border-[#cdcdcd]">
              <button
                type="button"
                className="px-3 py-2 text-[16px]"
                disabled={qty <= 1 || outOfStock}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="min-w-10 text-center text-[15px] font-semibold">{Math.max(1, qty)}</span>
              <button
                type="button"
                className="px-3 py-2 text-[16px]"
                disabled={outOfStock || qty >= max}
                onClick={() => setQty((q) => Math.min(max || 99, q + 1))}
              >
                ＋
              </button>
            </div>
            <button
              type="button"
              disabled={outOfStock}
              className="bg-black px-[25px] py-[10px] text-[15px] font-bold text-white transition hover:opacity-85 disabled:opacity-40"
              onClick={() => {
                if (outOfStock) return
                shop?.addToCart(product, qty)
                setAdded(true)
                window.setTimeout(() => setAdded(false), 1600)
                shop?.openCart()
              }}
            >
              {added ? 'Added' : 'Add to cart'}
            </button>
          </div>
          {outOfStock ? <div className="mt-3 text-sm text-rose-600">Out of stock.</div> : null}
          {shop?.error ? <div className="mt-3 text-sm text-rose-600">{shop.error}</div> : null}

          <div className="mt-6 space-y-1 text-[13px] text-[#4c4c4c]">
            <div>
              <span className="font-semibold text-black">SKU:</span> {product.id}
            </div>
            <div>
              <span className="font-semibold text-black">Categories:</span> Street Fashion
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1620px] px-[30px] pb-16">
        <div className="flex flex-wrap gap-6 border-b border-[#eee] text-[14px] font-bold">
          {(
            [
              ['description', 'Description'],
              ['info', 'Additional information'],
              ['reviews', `Reviews (${reviews})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`border-b-2 pb-3 transition ${
                tab === key ? 'border-black text-black' : 'border-transparent text-[#4c4c4c]'
              }`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="max-w-3xl py-8 text-[15px] leading-relaxed text-[#4c4c4c]">
          {tab === 'description' ? (
            <p className="whitespace-pre-wrap">
              {product.description?.trim() ||
                'This piece is built for everyday street looks — soft hand-feel, durable seams, and a silhouette that layers cleanly.'}
            </p>
          ) : null}
          {tab === 'info' ? (
            <table className="w-full text-left text-[14px]">
              <tbody>
                <tr className="border-b border-[#eee]">
                  <th className="py-3 pr-6 font-semibold text-black">Availability</th>
                  <td className="py-3">
                    {outOfStock
                      ? 'Out of stock'
                      : product.available_qty == null
                        ? 'In stock'
                        : `${product.available_qty} in stock`}
                  </td>
                </tr>
                <tr className="border-b border-[#eee]">
                  <th className="py-3 pr-6 font-semibold text-black">Payment</th>
                  <td className="py-3">Bank transfer</td>
                </tr>
              </tbody>
            </table>
          ) : null}
          {tab === 'reviews' ? (
            <div>
              <p className="font-semibold text-black">
                {reviews} review{reviews === 1 ? '' : 's'} for {product.name}
              </p>
              <div className="mt-4 border border-[#eee] p-4">
                <div style={{ color: primary }}>{'★'.repeat(Math.round(Math.min(5, rating)))}</div>
                <p className="mt-2 text-[14px]">
                  Solid everyday fit and great quality for the price. Exactly what I expected from a streetwear staple.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <section className="border-t border-[#eee] py-14">
          <div className="mx-auto max-w-[1620px] px-[30px]">
            <h2 className="mb-8 text-center text-[28px] font-bold sm:text-[32px]">Related products</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="group text-center"
                  onClick={() => shop?.openProduct(p)}
                >
                  <div className="aspect-[3/4] overflow-hidden bg-[#f5f5f5]">
                    <ProductImage
                      src={p.image_url}
                      alt={p.name}
                      primary={primary}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="mt-3 text-[15px] font-bold">{p.name}</div>
                  <div className="mt-1 text-[14px]">{formatRupiah(p.price)}</div>
                  <div className="mt-2 text-[13px] font-bold underline-offset-4 group-hover:underline">Select options</div>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t border-[#eee] bg-[#f5f5f5] py-12">
        <div className="mx-auto grid max-w-[1620px] gap-8 px-[30px] sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Free Shipping', 'Free Shipping for orders over Rp 110.000'],
            ['Money Guarantee', 'Within 30 days for an exchange.'],
            ['Online Support', '24 hours a day, 7 days a week'],
            ['Flexible Payment', 'Pay with Multiple Credit Cards'],
          ].map(([title, body]) => (
            <div key={title}>
              <div className="text-[15px] font-bold">{title}</div>
              <p className="mt-1 text-[13px] text-[#4c4c4c]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#eee] py-8 text-center text-[13px] text-[#4c4c4c]">
        © {new Date().getFullYear()} {model.title || 'avalon'}
      </footer>
    </div>
  )
}

function CartPage({ model }: { model: StorefrontRenderModel }) {
  const shop = useShop()
  const c = brand(model)
  const lines = shop?.cart ?? []
  const related = relatedProducts(model, lines[0]?.product_id, 4)

  return (
    <ShopShell model={model} title="Cart">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Keranjang</h1>
          <p className="mt-1 text-sm text-neutral-500">{lines.length} item siap checkout</p>
        </div>
        <button type="button" className="text-[13px] text-neutral-500 underline-offset-4 hover:underline" onClick={() => shop?.openHome()}>
          + Tambah produk lain
        </button>
      </div>

      {lines.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-black/10 bg-white px-6 py-14 text-center shadow-sm">
          <div className="text-lg font-medium">Keranjang masih kosong</div>
          <p className="mt-2 text-sm text-neutral-500">Pilih produk dari beranda untuk mulai belanja.</p>
          <PrimaryButton color={c.primary} className="mt-6" onClick={() => shop?.openHome()}>
            Mulai belanja
          </PrimaryButton>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-8">
            {lines.map((line) => (
              <div
                key={line.product_id}
                className="flex gap-4 rounded-[22px] border border-black/5 bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:p-4"
              >
                <div className="h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-neutral-100 sm:h-32 sm:w-28">
                  <ProductImage
                    src={line.image_url}
                    alt={line.name}
                    primary={c.primary}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium tracking-tight">{line.name}</div>
                      <div className="mt-1 text-sm text-neutral-500">{formatRupiah(line.price)}</div>
                    </div>
                    <button
                      type="button"
                      className="text-[12px] text-neutral-400 transition hover:text-rose-600"
                      onClick={() => shop?.removeLine(line.product_id)}
                    >
                      Hapus
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <QtyStepper
                      value={line.qty}
                      max={line.available_qty == null ? 99 : Math.max(1, line.available_qty)}
                      onChange={(n) => shop?.setQty(line.product_id, n)}
                    />
                    <div className="text-sm font-semibold">{formatRupiah(line.price * line.qty)}</div>
                  </div>
                </div>
              </div>
            ))}

            <div className="grid gap-3 rounded-[22px] border border-black/5 bg-white p-4 sm:grid-cols-3">
              <div className="rounded-xl bg-neutral-50 p-3 text-[12px]">
                <div className="font-medium">Checkout aman</div>
                <div className="mt-1 text-neutral-500">Order masuk ke toko untuk dikonfirmasi.</div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3 text-[12px]">
                <div className="font-medium">Bayar transfer</div>
                <div className="mt-1 text-neutral-500">Instruksi rekening muncul setelah order.</div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3 text-[12px]">
                <div className="font-medium">Ubah qty bebas</div>
                <div className="mt-1 text-neutral-500">Sesuaikan jumlah sebelum checkout.</div>
              </div>
            </div>
          </div>

          <aside className="h-fit rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.06)] lg:col-span-4 lg:sticky lg:top-24">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Ringkasan</div>
            <div className="mt-4 space-y-2 text-sm text-neutral-600">
              {lines.map((line) => (
                <div key={line.product_id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {line.name} × {line.qty}
                  </span>
                  <span>{formatRupiah(line.price * line.qty)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-end justify-between gap-3 border-t border-black/5 pt-4">
              <span className="text-sm text-neutral-500">Subtotal</span>
              <span className="text-2xl font-semibold tracking-tight">{formatRupiah(shop?.cartSubtotal ?? 0)}</span>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-neutral-400">
              {model.shipping?.configured
                ? 'Ongkir dihitung otomatis di checkout (RajaOngkir).'
                : 'Ongkir (jika ada) dikonfirmasi seller setelah order.'}
            </p>
            <PrimaryButton color={c.primary} className="mt-6 w-full" onClick={() => shop?.openCheckout()}>
              Lanjut checkout
            </PrimaryButton>
            <button
              type="button"
              className="mt-3 w-full text-center text-[13px] text-neutral-500 underline-offset-4 hover:underline"
              onClick={() => shop?.openHome()}
            >
              Belanja lagi
            </button>
          </aside>
        </div>
      )}

      <RelatedGrid model={model} products={related} title="Sering dibeli" />
    </ShopShell>
  )
}


function CheckoutPage({ model }: { model: StorefrontRenderModel }) {
  const shop = useShop()
  const c = brand(model)
  const [name, setName] = useState(shop?.customer?.name ?? '')
  const [phone, setPhone] = useState(shop?.customer?.phone ?? '')
  const [email, setEmail] = useState(shop?.customer?.email ?? '')
  const [address, setAddress] = useState(shop?.customer?.address ?? '')
  const [note, setNote] = useState('')
  // RajaOngkir only when merchant enabled + configured (origin + platform key).
  const shippingWanted = Boolean(model.shipping?.enabled)
  const shippingReady = Boolean(
    model.shipping?.configured ||
      (model.shipping?.enabled && model.shipping?.origin_id && model.shipping?.has_api_key),
  )
  const shippingEnabled = shippingWanted && shippingReady
  const [destQuery, setDestQuery] = useState('')
  const [destResults, setDestResults] = useState<StorefrontShippingDestination[]>([])
  const [destBusy, setDestBusy] = useState(false)
  const [destination, setDestination] = useState<StorefrontShippingDestination | null>(null)
  const [shipOptions, setShipOptions] = useState<StorefrontShippingOption[]>([])
  const [shipBusy, setShipBusy] = useState(false)
  const [selectedShip, setSelectedShip] = useState<StorefrontShippingOption | null>(null)
  const [shipError, setShipError] = useState('')
  const destReqId = useRef(0)
  const shipReqId = useRef(0)
  const banks = model.bank_accounts ?? []
  const fieldClass =
    'mt-1.5 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/25 focus:ring-4 focus:ring-black/5'

  useEffect(() => {
    if (!shop?.customer) return
    setName((prev) => prev || shop.customer!.name || '')
    setPhone((prev) => prev || shop.customer!.phone || '')
    setEmail((prev) => prev || shop.customer!.email || '')
    setAddress((prev) => prev || shop.customer!.address || '')
  }, [shop?.customer])

  async function searchDestination() {
    const q = destQuery.trim()
    if (q.length < 2) return
    const reqId = ++destReqId.current
    setDestBusy(true)
    setShipError('')
    try {
      const path = model.preview
        ? `/storefront/shipping/destinations?search=${encodeURIComponent(q)}&limit=15`
        : `/public/storefront/shipping/destinations?search=${encodeURIComponent(q)}&limit=15`
      const { data } = await api.get<ApiOk<StorefrontShippingDestination[]>>(
        path,
        publicApiConfig(model),
      )
      if (reqId !== destReqId.current) return
      setDestResults(Array.isArray(data.data) ? data.data : [])
    } catch (err) {
      if (reqId !== destReqId.current) return
      setShipError(apiMessage(err, 'Gagal mencari destinasi.'))
      setDestResults([])
    } finally {
      if (reqId === destReqId.current) setDestBusy(false)
    }
  }

  async function loadShippingCost(dest: StorefrontShippingDestination) {
    const reqId = ++shipReqId.current
    setDestination(dest)
    setDestResults([])
    setDestQuery(dest.label)
    setSelectedShip(null)
    setShipOptions([])
    setShipBusy(true)
    setShipError('')
    try {
      const path = model.preview ? '/storefront/shipping/cost' : '/public/storefront/shipping/cost'
      const { data } = await api.post<
        ApiOk<{ weight_gram: number; options: StorefrontShippingOption[] }>
      >(
        path,
        {
          destination_id: dest.id,
          items: (shop?.cart ?? []).map((line) => ({ product_id: line.product_id, qty: line.qty })),
        },
        publicApiConfig(model),
      )
      if (reqId !== shipReqId.current) return
      const options = data.data?.options ?? []
      setShipOptions(options)
      if (options[0]) setSelectedShip(options[0])
      if (options.length === 0) setShipError('Tidak ada layanan ongkir untuk destinasi ini.')
    } catch (err) {
      if (reqId !== shipReqId.current) return
      setShipError(apiMessage(err, 'Gagal menghitung ongkir.'))
    } finally {
      if (reqId === shipReqId.current) setShipBusy(false)
    }
  }

  const shippingCost = selectedShip?.cost ?? 0
  const grandTotal = (shop?.cartSubtotal ?? 0) + shippingCost

  return (
    <ShopShell model={model} title="Checkout">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {shop?.customer
            ? `Halo ${shop.customer.name} — data pengiriman sudah diisi dari akun Anda.`
            : 'Isi data pengiriman, atau login agar checkout lebih cepat.'}
        </p>
        {!shop?.customer ? (
          <button
            type="button"
            className="mt-3 text-[13px] font-medium underline-offset-4 hover:underline"
            style={{ color: c.primary }}
            onClick={() => shop?.openLogin()}
          >
            Login pembeli
          </button>
        ) : null}
      </div>

      <form
        className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]"
        onSubmit={(e) => {
          e.preventDefault()
          if (shippingEnabled && !destination) {
            setShipError('Pilih kota/kecamatan tujuan dulu.')
            return
          }
          if (shippingEnabled && !selectedShip) {
            setShipError('Pilih layanan ongkir dulu.')
            return
          }
          void shop?.placeOrder({
            customer_name: name,
            customer_phone: phone || undefined,
            customer_email: email || undefined,
            customer_address: shippingEnabled && destination
              ? [address.trim(), destination.label].filter(Boolean).join('\n')
              : address || undefined,
            note: note || undefined,
            shipping_destination_id: shippingEnabled ? destination?.id : undefined,
            shipping_destination_label: shippingEnabled ? destination?.label : undefined,
            shipping_courier: shippingEnabled ? selectedShip?.code : undefined,
            shipping_service: shippingEnabled ? selectedShip?.service : undefined,
          })
        }}
      >
        <div className="space-y-4 rounded-[28px] border border-black/5 bg-white/90 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.04)] sm:p-7">
          <label className="block text-sm">
            <span className="font-medium">Nama penerima</span>
            <input className={fieldClass} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">WhatsApp / telepon</span>
              <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08…" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Email</span>
              <input type="email" className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="opsional" />
            </label>
          </div>
          {shippingWanted && !shippingReady ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Pengiriman aktif tapi belum lengkap di Setup (lokasi toko). Lengkapi lalu refresh.
            </div>
          ) : null}

          {shippingEnabled ? (
            <div className="space-y-3 rounded-2xl border border-black/10 bg-neutral-50/90 p-4">
              <div>
                <div className="text-sm font-medium">Kota / kecamatan tujuan</div>
                <p className="mt-1 text-[12px] text-neutral-500">
                  Cari & pilih dari RajaOngkir — wajib untuk hitung ongkir.
                </p>
              </div>
              {model.shipping?.origin_label ? (
                <div className="text-[12px] text-neutral-500">Dikirim dari {model.shipping.origin_label}</div>
              ) : null}
              <div className="flex gap-2">
                <input
                  className={fieldClass + ' !mt-0'}
                  placeholder="Ketik nama kecamatan / kota…"
                  value={destQuery}
                  onChange={(e) => {
                    setDestQuery(e.target.value)
                    if (destination) {
                      setDestination(null)
                      setShipOptions([])
                      setSelectedShip(null)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void searchDestination()
                    }
                  }}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-2xl border border-black/10 bg-white px-4 text-sm font-medium"
                  disabled={destBusy}
                  onClick={() => void searchDestination()}
                >
                  {destBusy ? '…' : 'Cari'}
                </button>
              </div>
              {destination ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-[13px] text-emerald-950">
                  Tujuan: <span className="font-medium">{destination.label}</span>
                </div>
              ) : null}
              {destResults.length > 0 ? (
                <ul className="max-h-44 overflow-auto rounded-xl border border-black/10 bg-white text-sm">
                  {destResults.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-neutral-50"
                        onClick={() => void loadShippingCost(row)}
                      >
                        {row.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {shipBusy ? <div className="text-[13px] text-neutral-500">Menghitung ongkir…</div> : null}

              {shipOptions.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-500">Pilih layanan</div>
                  {shipOptions.map((opt) => {
                    const key = `${opt.code}-${opt.service}`
                    const active = selectedShip?.code === opt.code && selectedShip?.service === opt.service
                    return (
                      <label
                        key={key}
                        className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                          active ? 'border-black/30 bg-white shadow-sm' : 'border-black/5 bg-white/70'
                        }`}
                      >
                        <span className="flex items-start gap-2">
                          <input
                            type="radio"
                            name="shipping_service"
                            checked={active}
                            onChange={() => setSelectedShip(opt)}
                            className="mt-1"
                          />
                          <span>
                            <span className="font-medium uppercase">{opt.code}</span> {opt.service}
                            <span className="mt-0.5 block text-[12px] text-neutral-500">
                              {opt.description}
                              {opt.etd ? ` · estimasi ${opt.etd}` : ''}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold">{formatRupiah(opt.cost)}</span>
                      </label>
                    )
                  })}
                </div>
              ) : null}
              {shipError ? <div className="text-sm text-rose-600">{shipError}</div> : null}
            </div>
          ) : null}

          <label className="block text-sm">
            <span className="font-medium">{shippingEnabled ? 'Detail alamat' : 'Alamat pengiriman'}</span>
            <textarea
              className={`${fieldClass} min-h-24`}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={
                shippingEnabled
                  ? 'Nama jalan, nomor rumah, RT/RW, patokan…'
                  : 'Jalan, kecamatan, kota, kode pos'
              }
            />
            {shippingEnabled ? (
              <span className="mt-1.5 block text-[12px] text-neutral-400">
                Kecamatan dipilih di atas; di sini hanya detail jalan & nomor.
              </span>
            ) : null}
          </label>

<label className="block text-sm">
            <span className="font-medium">Catatan</span>
            <input className={fieldClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: kirim sore hari" />
          </label>
          {shop?.error ? <div className="text-sm text-rose-600">{shop.error}</div> : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Order</div>
            <div className="mt-4 space-y-3">
              {(shop?.cart ?? []).map((line) => (
                <div key={line.product_id} className="flex justify-between gap-3 text-sm">
                  <span className="text-neutral-600">
                    {line.name} <span className="text-neutral-400">× {line.qty}</span>
                  </span>
                  <span className="font-medium">{formatRupiah(line.price * line.qty)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-black/5 pt-4 text-sm">
              <div className="flex justify-between text-neutral-500">
                <span>Subtotal</span>
                <span>{formatRupiah(shop?.cartSubtotal ?? 0)}</span>
              </div>
              {shippingEnabled ? (
                <div className="flex justify-between text-neutral-500">
                  <span>Ongkir</span>
                  <span>{selectedShip ? formatRupiah(shippingCost) : '—'}</span>
                </div>
              ) : null}
              <div className="flex items-end justify-between pt-1">
                <span className="text-sm text-neutral-500">Total</span>
                <span className="text-2xl font-semibold tracking-tight">{formatRupiah(grandTotal)}</span>
              </div>
            </div>
            <PrimaryButton
              type="submit"
              color={c.primary}
              className="mt-6 w-full"
              disabled={shop?.busy || (shop?.cart.length ?? 0) === 0 || (shippingEnabled && (!destination || !selectedShip))}
            >
              {shop?.busy ? 'Memproses…' : 'Buat order'}
            </PrimaryButton>
          </div>

          {banks.length > 0 ? (
            <div className="rounded-[28px] border border-black/5 bg-neutral-900 p-6 text-white shadow-lg">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">Transfer ke</div>
              <ul className="mt-4 space-y-3 text-sm">
                {banks.map((b, i) => (
                  <li key={`${b.bank_name}-${i}`} className="leading-relaxed">
                    <div className="font-medium">{b.bank_name}</div>
                    <div className="text-white/80">
                      {b.account_number} · a/n {b.account_name}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
              Rekening transfer belum diisi di Setup. Order tetap bisa dibuat.
            </div>
          )}
        </aside>
      </form>
      <RelatedGrid model={model} products={relatedProducts(model, undefined, 4)} title="Belanja lagi" />
    </ShopShell>
  )
}

function OrderSuccessPage({
  model,
  order,
}: {
  model: StorefrontRenderModel
  order: PlacedOrderSummary
}) {
  const shop = useShop()
  const c = brand(model)
  const ship = order.shipping_snapshot

  return (
    <ShopShell model={model} title="Success">
      <div className="mx-auto max-w-xl rounded-[32px] border border-black/5 bg-white px-6 py-12 text-center shadow-[0_30px_80px_rgba(0,0,0,0.08)] sm:px-10">
        <div
          className="mx-auto grid h-14 w-14 place-items-center rounded-full text-xl text-white"
          style={{ background: c.primary }}
        >
          ✓
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Order berhasil</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-500">
          Nomor order <span className="font-semibold text-neutral-800">{order.number}</span>
        </p>

        <div className="mt-6 space-y-2 rounded-2xl bg-neutral-50 p-5 text-left text-sm text-neutral-600">
          {(order.items ?? []).map((item, i) => (
            <div key={`${item.name}-${i}`} className="flex justify-between gap-2">
              <span>
                {item.name} × {item.qty}
              </span>
              <span>{formatRupiah(item.line_total)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-2 border-t border-black/5 pt-2">
            <span>Subtotal</span>
            <span>{formatRupiah(order.subtotal)}</span>
          </div>
          {order.shipping_cost > 0 || ship ? (
            <div className="flex justify-between gap-2">
              <span>
                Ongkir
                {ship?.courier_name || ship?.service
                  ? ` (${[ship?.courier_name || ship?.courier, ship?.service].filter(Boolean).join(' ')})`
                  : ''}
              </span>
              <span>{formatRupiah(order.shipping_cost)}</span>
            </div>
          ) : null}
          {ship?.destination_label ? (
            <div className="text-[12px] text-neutral-400">Tujuan: {ship.destination_label}</div>
          ) : null}
          {order.customer_address ? (
            <div className="text-[12px] text-neutral-400 whitespace-pre-wrap">Alamat: {order.customer_address}</div>
          ) : null}
          {order.note ? <div className="text-[12px] text-neutral-400">Catatan: {order.note}</div> : null}
          <div className="flex justify-between gap-2 border-t border-black/5 pt-2 text-base font-semibold text-neutral-900">
            <span>Total</span>
            <span>{formatRupiah(order.total)}</span>
          </div>
        </div>

        {order.bank_accounts.length > 0 ? (
          <div className="mt-8 rounded-2xl bg-neutral-50 p-5 text-left text-sm">
            <div className="font-medium">Silakan transfer ke</div>
            <ul className="mt-3 space-y-2 text-neutral-600">
              {order.bank_accounts.map((b, i) => (
                <li key={`${b.bank_name}-${i}`}>
                  {b.bank_name} · {b.account_number} a/n {b.account_name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-5 text-[12px] text-neutral-400">
          Setelah transfer, toko akan mengonfirmasi di menu Order storefront.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <PrimaryButton color={c.primary} onClick={() => shop?.openHome()}>
            Kembali ke beranda
          </PrimaryButton>
          {shop?.customer ? (
            <button
              type="button"
              className="text-[13px] text-neutral-500 underline-offset-4 hover:underline"
              onClick={() => shop.openAccount()}
            >
              Lihat riwayat order
            </button>
          ) : (
            <button
              type="button"
              className="text-[13px] text-neutral-500 underline-offset-4 hover:underline"
              onClick={() => shop?.openRegister()}
            >
              Buat akun untuk lacak order
            </button>
          )}
        </div>
      </div>
    </ShopShell>
  )
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending_payment: 'Menunggu bayar',
    awaiting_confirmation: 'Menunggu konfirmasi',
    paid: 'Lunas',
    shipped: 'Dikirim',
    delivered: 'Diterima',
    cancelled: 'Dibatalkan',
  }
  return map[status] || status
}

function LoginPage({ model }: { model: StorefrontRenderModel }) {
  const shop = useShop()
  const c = brand(model)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const fieldClass =
    'mt-1.5 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/25 focus:ring-4 focus:ring-black/5'

  return (
    <ShopShell model={model} title="Login">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Login pembeli</h1>
        <p className="mt-2 text-sm text-neutral-500">Masuk untuk checkout lebih cepat dan lihat riwayat order.</p>
        <form
          className="mt-8 space-y-4 rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_16px_40px_rgba(0,0,0,0.04)]"
          onSubmit={(e) => {
            e.preventDefault()
            void shop?.login(email, password)
          }}
        >
          <label className="block text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              required
              className={fieldClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Password</span>
            <input
              type="password"
              required
              minLength={6}
              className={fieldClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {shop?.error ? <div className="text-sm text-rose-600">{shop.error}</div> : null}
          <PrimaryButton type="submit" color={c.primary} className="w-full" disabled={shop?.busy}>
            {shop?.busy ? 'Masuk…' : 'Masuk'}
          </PrimaryButton>
        </form>
        <p className="mt-5 text-center text-sm text-neutral-500">
          Belum punya akun?{' '}
          <button type="button" className="font-medium underline-offset-4 hover:underline" style={{ color: c.primary }} onClick={() => shop?.openRegister()}>
            Daftar
          </button>
        </p>
      </div>
    </ShopShell>
  )
}

function RegisterPage({ model }: { model: StorefrontRenderModel }) {
  const shop = useShop()
  const c = brand(model)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [address, setAddress] = useState('')
  const fieldClass =
    'mt-1.5 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/25 focus:ring-4 focus:ring-black/5'

  return (
    <ShopShell model={model} title="Daftar">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Daftar pembeli</h1>
        <p className="mt-2 text-sm text-neutral-500">Akun terikat ke toko ini — data pengiriman tersimpan untuk order berikutnya.</p>
        <form
          className="mt-8 space-y-4 rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_16px_40px_rgba(0,0,0,0.04)]"
          onSubmit={(e) => {
            e.preventDefault()
            void shop?.register({
              name,
              email,
              password,
              phone: phone || undefined,
              address: address || undefined,
            })
          }}
        >
          <label className="block text-sm">
            <span className="font-medium">Nama</span>
            <input required className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Email</span>
            <input type="email" required className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">WhatsApp / telepon</span>
            <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Password</span>
            <input
              type="password"
              required
              minLength={6}
              className={fieldClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Alamat (opsional)</span>
            <textarea className={`${fieldClass} min-h-24`} value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          {shop?.error ? <div className="text-sm text-rose-600">{shop.error}</div> : null}
          <PrimaryButton type="submit" color={c.primary} className="w-full" disabled={shop?.busy}>
            {shop?.busy ? 'Mendaftar…' : 'Buat akun'}
          </PrimaryButton>
        </form>
        <p className="mt-5 text-center text-sm text-neutral-500">
          Sudah punya akun?{' '}
          <button type="button" className="font-medium underline-offset-4 hover:underline" style={{ color: c.primary }} onClick={() => shop?.openLogin()}>
            Login
          </button>
        </p>
      </div>
    </ShopShell>
  )
}

function AccountPage({ model }: { model: StorefrontRenderModel }) {
  const shop = useShop()
  const c = brand(model)
  const customer = shop?.customer
  const [reviewDraft, setReviewDraft] = useState<{
    orderId: number
    productId: number
    rating: number
    comment: string
  } | null>(null)

  if (!customer) return null

  return (
    <ShopShell model={model} title="Akun">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Halo, {customer.name}</h1>
          <p className="mt-2 text-sm text-neutral-500">{customer.email}</p>
        </div>
        <button
          type="button"
          className="text-[13px] text-neutral-500 underline-offset-4 hover:underline"
          onClick={() => void shop?.logout()}
        >
          Keluar
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm lg:col-span-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Profil</div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-neutral-400">Telepon</dt>
              <dd className="mt-0.5 font-medium">{customer.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-neutral-400">Alamat</dt>
              <dd className="mt-0.5 font-medium whitespace-pre-wrap">{customer.address || '—'}</dd>
            </div>
          </dl>
          <PrimaryButton color={c.primary} className="mt-6 w-full" onClick={() => shop?.openHome()}>
            Belanja lagi
          </PrimaryButton>
        </div>

        <div className="lg:col-span-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Riwayat order</h2>
            <button
              type="button"
              className="text-[12px] text-neutral-500 underline-offset-4 hover:underline"
              onClick={() => void shop?.refreshOrders()}
            >
              Refresh
            </button>
          </div>
          {(shop?.customerOrders.length ?? 0) === 0 ? (
            <div className="rounded-[28px] border border-dashed border-black/10 bg-white px-6 py-12 text-center text-sm text-neutral-500">
              Belum ada order. Checkout sebagai guest juga bisa, tapi login memudahkan pelacakan.
            </div>
          ) : (
            <div className="space-y-3">
              {shop!.customerOrders.map((row) => (
                <div key={row.id} className="rounded-[22px] border border-black/5 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium tracking-tight">{row.number}</div>
                      <div className="mt-1 text-[12px] text-neutral-400">
                        {row.placed_at ? new Date(row.placed_at).toLocaleString('id-ID') : '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatRupiah(row.total)}</div>
                      <div className="mt-1 text-[12px] text-neutral-500">{statusLabel(row.status)}</div>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2 border-t border-black/5 pt-3 text-[13px] text-neutral-600">
                    {row.items.map((item, i) => (
                      <li key={`${row.id}-${i}`} className="space-y-2">
                        <div className="flex justify-between gap-2">
                          <span>
                            {item.name} × {item.qty}
                          </span>
                          <span>{formatRupiah(item.line_total)}</span>
                        </div>
                        {row.can_review && item.product_id ? (
                          item.reviewed ? (
                            <div className="text-[11px] text-emerald-700">Sudah diulas</div>
                          ) : reviewDraft?.orderId === row.id && reviewDraft.productId === item.product_id ? (
                            <div className="space-y-2 rounded-xl border border-black/5 bg-slate-50 p-3">
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <button
                                    key={n}
                                    type="button"
                                    className={`text-lg ${n <= reviewDraft.rating ? 'text-amber-500' : 'text-slate-300'}`}
                                    onClick={() => setReviewDraft({ ...reviewDraft, rating: n })}
                                  >
                                    ★
                                  </button>
                                ))}
                              </div>
                              <textarea
                                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                                rows={2}
                                placeholder="Komentar (opsional)"
                                value={reviewDraft.comment}
                                onChange={(e) => setReviewDraft({ ...reviewDraft, comment: e.target.value })}
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                                  style={{ background: c.primary }}
                                  disabled={shop?.busy}
                                  onClick={() =>
                                    void (async () => {
                                      const ok = await shop?.submitReview({
                                        order_id: reviewDraft.orderId,
                                        product_id: reviewDraft.productId,
                                        rating: reviewDraft.rating,
                                        comment: reviewDraft.comment.trim() || undefined,
                                      })
                                      if (ok) setReviewDraft(null)
                                    })()
                                  }
                                >
                                  Kirim ulasan
                                </button>
                                <button type="button" className="text-xs text-neutral-500" onClick={() => setReviewDraft(null)}>
                                  Batal
                                </button>
                              </div>
                              {shop?.error ? <div className="text-xs text-rose-600">{shop.error}</div> : null}
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="text-[11px] font-medium underline-offset-2 hover:underline"
                              style={{ color: c.primary }}
                              onClick={() =>
                                setReviewDraft({
                                  orderId: row.id,
                                  productId: item.product_id!,
                                  rating: 5,
                                  comment: '',
                                })
                              }
                            >
                              Tulis ulasan
                            </button>
                          )
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 space-y-1 text-[12px] text-neutral-400">
                    {(row.shipping_cost ?? 0) > 0 || row.shipping_snapshot ? (
                      <div>
                        Ongkir {formatRupiah(row.shipping_cost ?? row.shipping_snapshot?.cost ?? 0)}
                        {row.shipping_snapshot?.service
                          ? ` · ${row.shipping_snapshot.courier_name || row.shipping_snapshot.courier || ''} ${row.shipping_snapshot.service}`
                          : ''}
                        {row.shipping_snapshot?.destination_label
                          ? ` · ${row.shipping_snapshot.destination_label}`
                          : ''}
                      </div>
                    ) : null}
                    {row.customer_address ? <div className="whitespace-pre-wrap">Alamat: {row.customer_address}</div> : null}
                    {row.note ? <div>Catatan: {row.note}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ShopShell>
  )
}

