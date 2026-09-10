import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
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
  variantLineKey,
  writeCart,
  type StorefrontCartLine,
  type StorefrontSelectedOption,
} from '../lib/cart'
import {
  clearCustomerSession,
  readCustomer,
  readCustomerToken,
  writeCustomerSession,
  type StorefrontCustomer,
} from '../lib/customerSession'
import { STOREFRONT_PREVIEW_BANNER } from '../previewDraft'
import { ShopCatalogPage, ShopCategoriesPage } from '../templates/ShopCatalogPages'
import { Reveal } from '../templates/storefrontMotion'

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

export type ShopView =
  | 'home'
  | 'catalog'
  | 'categories'
  | 'product'
  | 'cart'
  | 'checkout'
  | 'success'
  | 'login'
  | 'register'
  | 'account'

function syncShopBrowseQuery(view: 'home' | 'catalog' | 'categories', categoryId?: number | null) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (view === 'catalog') {
    url.searchParams.set('view', 'catalog')
    if (categoryId) url.searchParams.set('category', String(categoryId))
    else url.searchParams.delete('category')
  } else if (view === 'categories') {
    url.searchParams.set('view', 'categories')
    url.searchParams.delete('category')
  } else {
    const current = url.searchParams.get('view')
    if (current === 'catalog' || current === 'categories') {
      url.searchParams.delete('view')
      url.searchParams.delete('category')
    }
  }
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

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
  catalogCategoryId: number | null
  openHome: () => void
  openCatalog: (opts?: { categoryId?: number | null }) => void
  openCategories: () => void
  openBrowseBack: () => void
  openProduct: (product: StorefrontRenderProduct) => void
  openCart: () => void
  openCheckout: () => void
  openLogin: () => void
  openRegister: () => void
  openAccount: () => void
  addToCart: (
    product: StorefrontRenderProduct,
    qty?: number,
    selectedOptions?: StorefrontSelectedOption[],
  ) => void
  setQty: (lineKey: string, qty: number) => void
  removeLine: (lineKey: string) => void
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
  const [catalogCategoryId, setCatalogCategoryId] = useState<number | null>(null)
  const [browseReturn, setBrowseReturn] = useState<'home' | 'catalog' | 'categories'>('home')
  const [cart, setCart] = useState<StorefrontCartLine[]>(() => readCart(scope))
  const [order, setOrder] = useState<PlacedOrderSummary | null>(null)
  const [customer, setCustomer] = useState<StorefrontCustomer | null>(() => readCustomer(scope))
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const checkoutUuidRef = useRef<string | null>(null)
  const placeInFlightRef = useRef(false)
  const viewRef = useRef<ShopView>('home')
  viewRef.current = view

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const browse = params.get('view')
    if (browse === 'catalog') {
      const raw = Number(params.get('category') || 0)
      setCatalogCategoryId(raw > 0 ? raw : null)
      setBrowseReturn('catalog')
      setView('catalog')
      setProduct(null)
      return
    }
    if (browse === 'categories') {
      setCatalogCategoryId(null)
      setBrowseReturn('categories')
      setView('categories')
      setProduct(null)
    }
  }, [])

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
    setCatalogCategoryId(null)
    setBrowseReturn('home')
    setError('')
    syncShopBrowseQuery('home')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openCatalog = useCallback((opts?: { categoryId?: number | null }) => {
    const nextCategory =
      opts && 'categoryId' in opts ? (opts.categoryId && opts.categoryId > 0 ? opts.categoryId : null) : null
    const staying = viewRef.current === 'catalog'
    setCatalogCategoryId(nextCategory)
    setBrowseReturn('catalog')
    setProduct(null)
    setView('catalog')
    setError('')
    syncShopBrowseQuery('catalog', nextCategory)
    if (!staying) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openCategories = useCallback(() => {
    const staying = viewRef.current === 'categories'
    setCatalogCategoryId(null)
    setBrowseReturn('categories')
    setProduct(null)
    setView('categories')
    setError('')
    syncShopBrowseQuery('categories')
    if (!staying) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openBrowseBack = useCallback(() => {
    if (browseReturn === 'catalog') {
      setProduct(null)
      setView('catalog')
      setError('')
      syncShopBrowseQuery('catalog', catalogCategoryId)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (browseReturn === 'categories') {
      setProduct(null)
      setView('categories')
      setError('')
      syncShopBrowseQuery('categories')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    openHome()
  }, [browseReturn, catalogCategoryId, openHome])

  const openProduct = useCallback(
    (next: StorefrontRenderProduct) => {
      setBrowseReturn((prev) => {
        if (view === 'catalog') return 'catalog'
        if (view === 'categories') return 'categories'
        if (view === 'product') return prev
        return 'home'
      })
      setProduct(next)
      setView('product')
      setError('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [view],
  )

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

  const addToCart = useCallback(
    (item: StorefrontRenderProduct, qty = 1, selectedOptions?: StorefrontSelectedOption[]) => {
      if (item.id <= 0) {
        setError('Produk demo tidak bisa ditambahkan. Tambahkan produk asli di menu Produk toko.')
        return
      }
      const attrs = (item.variant_attributes ?? []).filter((attr) => (attr.options ?? []).length > 0)
      if (attrs.length > 0 && (!selectedOptions || selectedOptions.length < attrs.length)) {
        setProduct(item)
        setView('product')
        setError(selectedOptions && selectedOptions.length > 0 ? 'Lengkapi pilihan produk.' : '')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (item.available_qty != null && item.available_qty <= 0) {
        setError('Stok habis.')
        return
      }
      const extra = (selectedOptions ?? []).reduce((sum, opt) => sum + Math.max(0, opt.extra_price || 0), 0)
      const imageFromOpt = [...(selectedOptions ?? [])].reverse().find((opt) => opt.image_url)?.image_url
      const variant_label =
        selectedOptions && selectedOptions.length > 0
          ? selectedOptions.map((opt) => `${opt.attribute_name}: ${opt.option_name}`).join(', ')
          : null
      setError('')
      setCart((prev) =>
        upsertCartLine(prev, {
          product_id: item.id,
          line_key: variantLineKey(item.id, selectedOptions),
          name: item.name,
          price: item.price + extra,
          qty,
          image_url: imageFromOpt || item.image_url,
          available_qty: item.available_qty ?? null,
          selected_options: selectedOptions ?? [],
          variant_label,
        }),
      )
    },
    [],
  )

  const setQty = useCallback((lineKey: string, qty: number) => {
    setCart((prev) => setCartLineQty(prev, lineKey, qty))
  }, [])

  const removeLine = useCallback((lineKey: string) => {
    setCart((prev) => prev.filter((line) => line.line_key !== lineKey))
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
          items: cart.map((line) => ({
            product_id: line.product_id,
            qty: line.qty,
            selected_options: (line.selected_options ?? []).map((opt) => ({
              attribute_id: opt.attribute_id,
              option_id: opt.option_id,
            })),
          })),
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
      catalogCategoryId,
      openHome,
      openCatalog,
      openCategories,
      openBrowseBack,
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
      catalogCategoryId,
      openHome,
      openCatalog,
      openCategories,
      openBrowseBack,
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

  if (shop.view === 'catalog') {
    return <ShopCatalogPage model={model} />
  }
  if (shop.view === 'categories') {
    return <ShopCategoriesPage model={model} />
  }
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
            <button type="button" className="hover:text-neutral-900" onClick={() => shop?.openBrowseBack()}>
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
            className="relative inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-[12px] font-medium tracking-wide text-neutral-800 shadow-sm transition hover:border-black/20 hover:shadow"
            onClick={() => shop?.openCart()}
            aria-label={`Cart${(shop?.cartCount ?? 0) > 0 ? `, ${shop?.cartCount} item` : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6.5 8h11l-1.05 10.2a1.5 1.5 0 01-1.49 1.3H9.04a1.5 1.5 0 01-1.49-1.3L6.5 8z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M9 8V7.2A3 3 0 0112 4.2 3 3 0 0115 7.2V8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path d="M5 8h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span>Cart</span>
            {(shop?.cartCount ?? 0) > 0 ? (
              <span
                className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold"
                style={{ background: c.primary, color: '#ffffff' }}
              >
                {shop!.cartCount > 99 ? '99+' : shop!.cartCount}
              </span>
            ) : null}
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
  useEffect(() => {
    setFailed(false)
  }, [src])
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

function productGalleryUrls(product: StorefrontRenderProduct): string[] {
  const fromList = (product.images ?? [])
    .map((img) => String(img.url || '').trim())
    .filter(Boolean)
  if (fromList.length > 0) return fromList
  return product.image_url ? [product.image_url] : []
}

function ImageZoomLightbox({
  open,
  src,
  alt,
  images,
  index,
  onClose,
  onIndexChange,
}: {
  open: boolean
  src: string | null
  alt: string
  images: string[]
  index: number
  onClose: () => void
  onIndexChange?: (index: number) => void
}) {
  const reduce = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [scale, setScale] = useState(1)
  const [localIndex, setLocalIndex] = useState(index)
  const list = images.length > 0 ? images : src ? [src] : []
  const currentSrc = list[localIndex] || src
  const canNav = list.length > 1

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setLocalIndex(index >= 0 ? index : 0)
    setScale(1)
  }, [open, index])

  useEffect(() => {
    setScale(1)
  }, [currentSrc])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'ArrowLeft' && canNav) goTo(localIndex - 1)
      if (e.key === 'ArrowRight' && canNav) goTo(localIndex + 1)
      if (e.key === '+' || e.key === '=') setScale((s) => Math.min(4, Number((s + 0.5).toFixed(1))))
      if (e.key === '-' || e.key === '_') setScale((s) => Math.max(1, Number((s - 0.5).toFixed(1))))
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, canNav, localIndex, list.length, onClose])

  function goTo(next: number) {
    if (!canNav) return
    const i = (next + list.length) % list.length
    setLocalIndex(i)
    onIndexChange?.(i)
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && currentSrc ? (
        <motion.div
          className="fixed inset-0 z-[99999]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label="Foto produk"
        >
          {/* Full-screen dim — click to close */}
          <div className="absolute inset-0 bg-black/90" onClick={onClose} />

          {/* Close — always visible, high contrast */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-[100] flex h-12 w-12 items-center justify-center rounded-full bg-white text-[28px] leading-none text-black shadow-lg transition hover:scale-105 sm:right-6 sm:top-6"
            aria-label="Tutup"
          >
            ×
          </button>

          {/* Counter */}
          {canNav ? (
            <div className="pointer-events-none absolute left-1/2 top-5 z-[100] -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[12px] font-medium tabular-nums text-white backdrop-blur-sm">
              {localIndex + 1} / {list.length}
            </div>
          ) : null}

          {/* Prev / Next — solid, obvious */}
          {canNav ? (
            <>
              <button
                type="button"
                onClick={() => goTo(localIndex - 1)}
                className="absolute left-3 top-1/2 z-[100] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[28px] leading-none text-black shadow-lg transition hover:scale-105 sm:left-5"
                aria-label="Sebelumnya"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => goTo(localIndex + 1)}
                className="absolute right-3 top-1/2 z-[100] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[28px] leading-none text-black shadow-lg transition hover:scale-105 sm:right-5"
                aria-label="Berikutnya"
              >
                ›
              </button>
            </>
          ) : null}

          {/* Image only — does not block controls */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-14 sm:p-16">
            <motion.img
              key={currentSrc}
              src={currentSrc}
              alt={alt}
              drag={scale > 1}
              dragConstraints={{ left: -280, right: 280, top: -280, bottom: 280 }}
              dragElastic={0.1}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setScale((s) => (s > 1 ? 1 : 2.5))
              }}
              initial={reduce ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto max-h-[85vh] max-w-[min(92vw,1100px)] select-none object-contain ${
                scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
              }`}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Zoom bar */}
          <div className="absolute bottom-5 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white p-1.5 shadow-lg">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-black transition hover:bg-neutral-100"
              aria-label="Zoom out"
              onClick={() => setScale((s) => Math.max(1, Number((s - 0.5).toFixed(1))))}
            >
              −
            </button>
            <button
              type="button"
              className="min-w-[3.25rem] px-1 text-center text-[12px] font-semibold tabular-nums text-neutral-700"
              aria-label="Reset zoom"
              onClick={() => setScale(1)}
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-black transition hover:bg-neutral-100"
              aria-label="Zoom in"
              onClick={() => setScale((s) => Math.min(4, Number((s + 0.5).toFixed(1))))}
            >
              +
            </button>
            <div className="mx-1 h-6 w-px bg-neutral-200" />
            <button
              type="button"
              className="rounded-full px-3 py-2 text-[12px] font-semibold text-neutral-800 transition hover:bg-neutral-100"
              onClick={onClose}
            >
              Tutup
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

function ProductGallery({
  product,
  coverSrc,
  activeIndex,
  onSelectIndex,
  primary,
  aspectClass = 'aspect-[5/4] sm:aspect-[4/3] lg:min-h-[520px] lg:aspect-auto',
  imageClass = 'h-full min-h-[320px] w-full object-cover lg:min-h-[520px]',
}: {
  product: StorefrontRenderProduct
  coverSrc: string | null
  activeIndex: number
  onSelectIndex: (index: number) => void
  primary: string
  aspectClass?: string
  imageClass?: string
}) {
  const gallery = productGalleryUrls(product)
  const reduce = useReducedMotion()
  const coverKey = coverSrc || `fallback-${product.id}`
  const [zoomOpen, setZoomOpen] = useState(false)
  const [zoomIdx, setZoomIdx] = useState(0)

  const zoomImages = useMemo(() => {
    const list = [...gallery]
    if (coverSrc && !list.includes(coverSrc)) list.unshift(coverSrc)
    if (list.length === 0 && coverSrc) return [coverSrc]
    return list
  }, [gallery, coverSrc])

  function openZoom() {
    if (zoomImages.length === 0) return
    const idx = coverSrc ? zoomImages.indexOf(coverSrc) : Math.max(0, activeIndex)
    setZoomIdx(idx >= 0 ? idx : 0)
    setZoomOpen(true)
  }

  function handleZoomIndex(next: number) {
    setZoomIdx(next)
    const src = zoomImages[next]
    if (!src) return
    const gi = gallery.indexOf(src)
    if (gi >= 0) onSelectIndex(gi)
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={openZoom}
        disabled={zoomImages.length === 0}
        aria-label="Perbesar foto produk"
        className="group relative block w-full overflow-hidden rounded-[28px] bg-neutral-100 text-left shadow-[0_28px_70px_rgba(0,0,0,0.1)] ring-1 ring-black/5 transition hover:ring-black/15 disabled:cursor-default"
      >
        <div className={`relative ${aspectClass}`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={coverKey}
              className="absolute inset-0"
              initial={reduce ? false : { opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <ProductImage src={coverSrc} alt={product.name} primary={primary} className={imageClass} />
            </motion.div>
          </AnimatePresence>
        </div>
        {coverSrc ? (
          <span className="pointer-events-none absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-medium text-white opacity-90 backdrop-blur-md transition group-hover:bg-black/70 sm:opacity-0 sm:group-hover:opacity-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16.5 16.5L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M11 8.5v5M8.5 11h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Lihat
          </span>
        ) : null}
      </button>
      {gallery.length > 1 ? (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {gallery.map((src, index) => {
            const selected = index === activeIndex
            return (
              <motion.button
                key={`${src}-${index}`}
                type="button"
                whileHover={reduce ? undefined : { y: -2 }}
                whileTap={reduce ? undefined : { scale: 0.96 }}
                onClick={() => onSelectIndex(index)}
                onDoubleClick={() => {
                  onSelectIndex(index)
                  setZoomIdx(zoomImages.indexOf(src) >= 0 ? zoomImages.indexOf(src) : index)
                  setZoomOpen(true)
                }}
                aria-label={`Foto ${index + 1}`}
                aria-pressed={selected}
                className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl transition-shadow sm:h-20 sm:w-20 ${
                  selected
                    ? 'ring-2 ring-neutral-900 ring-offset-2 shadow-md'
                    : 'ring-1 ring-black/10 hover:ring-neutral-400'
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </motion.button>
            )
          })}
        </div>
      ) : null}

      <ImageZoomLightbox
        open={zoomOpen}
        src={zoomImages[zoomIdx] || coverSrc}
        alt={product.name}
        images={zoomImages}
        index={zoomIdx}
        onClose={() => setZoomOpen(false)}
        onIndexChange={zoomImages.length > 1 ? handleZoomIndex : undefined}
      />
    </div>
  )
}

function VariantOptionButton({
  active,
  name,
  imageUrl,
  extraPrice,
  onClick,
}: {
  active: boolean
  name: string
  imageUrl?: string | null
  extraPrice: number
  onClick: () => void
}) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      whileTap={reduce ? undefined : { scale: 0.97 }}
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all duration-200 ${
        active
          ? 'border-neutral-900 bg-neutral-900 shadow-[0_8px_20px_rgba(0,0,0,0.18)]'
          : 'border-black/10 bg-white hover:border-black/25 hover:shadow-sm'
      }`}
      style={{ color: active ? '#ffffff' : '#374151' }}
    >
      {imageUrl ? (
        <span className="inline-block h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        </span>
      ) : null}
      <span>{name}</span>
      {extraPrice > 0 ? (
        <span className="text-[12px] font-normal opacity-80">+{formatRupiah(extraPrice)}</span>
      ) : null}
    </motion.button>
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
  const reduce = useReducedMotion()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [selected, setSelected] = useState<Record<number, number>>({})
  const [galleryIndex, setGalleryIndex] = useState(0)
  /** When true, user picked a gallery thumb — don't override with variant image. */
  const [preferGallery, setPreferGallery] = useState(false)
  const attrs = (product.variant_attributes ?? []).filter((attr) => (attr.options ?? []).length > 0)
  const gallery = productGalleryUrls(product)
  const outOfStock = product.available_qty != null && product.available_qty <= 0
  const max = outOfStock ? 0 : product.available_qty == null ? 99 : Math.max(1, product.available_qty)
  const related = relatedProducts(model, product.id, 4)

  useEffect(() => {
    const next: Record<number, number> = {}
    for (const attr of attrs) {
      const first = attr.options[0]
      if (first) next[attr.id] = first.id
    }
    setSelected(next)
    setGalleryIndex(0)
    setPreferGallery(false)
  }, [product.id])

  useEffect(() => {
    if (outOfStock) setQty(0)
    else setQty((prev) => Math.min(Math.max(1, prev), max || 1))
  }, [outOfStock, max, product.id])

  const selectedOptions: StorefrontSelectedOption[] = attrs.flatMap((attr) => {
    const opt = attr.options.find((row) => row.id === selected[attr.id])
    if (!opt) return []
    return [
      {
        attribute_id: attr.id,
        attribute_name: attr.name,
        option_id: opt.id,
        option_name: opt.name,
        extra_price: opt.extra_price || 0,
        image_url: opt.image_url ?? null,
      },
    ]
  })

  const extra = selectedOptions.reduce((sum, opt) => sum + Math.max(0, opt.extra_price || 0), 0)
  const unitPrice = product.price + extra
  const variantCover =
    [...selectedOptions].reverse().find((opt) => opt.image_url)?.image_url || null
  const optionsReady = attrs.length === 0 || selectedOptions.length === attrs.length

  const coverSrc = preferGallery
    ? gallery[galleryIndex] || product.image_url || null
    : variantCover || gallery[galleryIndex] || product.image_url || null

  const highlightThumbIndex = preferGallery
    ? galleryIndex
    : variantCover
      ? gallery.findIndex((src) => src === variantCover)
      : galleryIndex
  const activeThumb = preferGallery || !variantCover ? galleryIndex : highlightThumbIndex

  function pickVariant(attrId: number, optionId: number) {
    setSelected((prev) => ({ ...prev, [attrId]: optionId }))
    setPreferGallery(false)
  }

  function pickGallery(index: number) {
    setGalleryIndex(index)
    setPreferGallery(true)
  }

  function pushToCart(mode: 'cart' | 'checkout') {
    if (outOfStock || !optionsReady) return
    shop?.addToCart(product, qty, selectedOptions)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1800)
    if (mode === 'checkout') shop?.openCheckout()
    else shop?.openCart()
  }

  return (
    <ShopShell model={model} title="Product">
      <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
        <Reveal className="lg:col-span-7" y={28} delay={0.02}>
          <ProductGallery
            product={product}
            coverSrc={coverSrc}
            activeIndex={activeThumb}
            onSelectIndex={pickGallery}
            primary={c.primary}
          />
        </Reveal>

        <Reveal
          className="relative flex flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white/90 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:p-8 lg:col-span-5 lg:sticky lg:top-24"
          y={36}
          delay={0.08}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-30 blur-3xl"
            style={{ background: c.accent }}
          />

          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500">
            {model.title}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-neutral-950 sm:text-[2.35rem] sm:leading-[1.15]">
            {product.name}
          </h1>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={unitPrice}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="mt-3 text-2xl font-semibold tracking-tight"
              style={{ color: c.primary }}
            >
              {formatRupiah(unitPrice)}
            </motion.div>
          </AnimatePresence>

          <div className="mt-5 flex flex-wrap gap-2 text-[12px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-50 px-3 py-1.5 text-neutral-600 ring-1 ring-black/5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Transfer bank
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-50 px-3 py-1.5 text-neutral-600 ring-1 ring-black/5">
              {outOfStock ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Stok habis
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  {product.available_qty == null ? 'Siap order' : `Stok ${product.available_qty}`}
                </>
              )}
            </span>
          </div>

          {attrs.length > 0 ? (
            <div className="mt-6 space-y-5 border-t border-black/5 pt-6">
              {attrs.map((attr) => {
                const current = attr.options.find((row) => row.id === selected[attr.id])
                return (
                  <div key={attr.id}>
                    <div className="mb-2.5 flex items-baseline justify-between gap-3">
                      <div className="text-[13px] font-medium text-neutral-800">{attr.name}</div>
                      {current ? (
                        <div className="text-[12px] text-neutral-500">
                          Dipilih: <span className="font-medium text-neutral-800">{current.name}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {attr.options.map((opt) => (
                        <VariantOptionButton
                          key={opt.id}
                          active={selected[attr.id] === opt.id}
                          name={opt.name}
                          imageUrl={opt.image_url}
                          extraPrice={opt.extra_price || 0}
                          onClick={() => pickVariant(attr.id, opt.id)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          <div className="mt-6 border-t border-black/5 pt-6">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">Deskripsi</div>
            {product.description?.trim() ? (
              <p className="text-[14px] leading-relaxed text-neutral-600 whitespace-pre-wrap">{product.description}</p>
            ) : (
              <p className="text-[14px] leading-relaxed text-neutral-500">
                Deskripsi belum diisi. Anda tetap bisa menambahkan produk ini ke keranjang dan checkout.
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">Jumlah</div>
              <QtyStepper value={Math.max(1, qty)} max={Math.max(1, max)} onChange={setQty} />
            </div>
          </div>

          {shop?.error ? <div className="mt-4 text-sm text-rose-600">{shop.error}</div> : null}
          {outOfStock ? <div className="mt-4 text-sm text-rose-600">Stok habis untuk produk ini.</div> : null}

          <div className="mt-7 flex flex-col gap-2.5">
            <PrimaryButton
              color={c.primary}
              disabled={outOfStock || !optionsReady}
              className="w-full"
              onClick={() => pushToCart('cart')}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={added ? 'ok' : 'add'}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="inline-block"
                >
                  {added ? '✓ Ditambahkan ke keranjang' : 'Tambah ke keranjang'}
                </motion.span>
              </AnimatePresence>
            </PrimaryButton>
            <GhostButton
              disabled={outOfStock || !optionsReady}
              className="w-full"
              onClick={() => pushToCart('checkout')}
            >
              Beli sekarang
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
        </Reveal>
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
  const [selected, setSelected] = useState<Record<number, number>>({})
  const attrs = (product.variant_attributes ?? []).filter((attr) => (attr.options ?? []).length > 0)
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
    const next: Record<number, number> = {}
    for (const attr of attrs) {
      const first = attr.options[0]
      if (first) next[attr.id] = first.id
    }
    setSelected(next)
  }, [product.id])

  useEffect(() => {
    if (outOfStock) setQty(0)
    else setQty((prev) => Math.min(Math.max(1, prev), max || 1))
  }, [outOfStock, max, product.id])

  const selectedOptions: StorefrontSelectedOption[] = attrs.flatMap((attr) => {
    const opt = attr.options.find((row) => row.id === selected[attr.id])
    if (!opt) return []
    return [
      {
        attribute_id: attr.id,
        attribute_name: attr.name,
        option_id: opt.id,
        option_name: opt.name,
        extra_price: opt.extra_price || 0,
        image_url: opt.image_url ?? null,
      },
    ]
  })

  const extra = selectedOptions.reduce((sum, opt) => sum + Math.max(0, opt.extra_price || 0), 0)
  const cover =
    [...selectedOptions].reverse().find((opt) => opt.image_url)?.image_url || product.image_url
  const optionsReady = attrs.length === 0 || selectedOptions.length === attrs.length

  const gallery = productGalleryUrls(product)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [preferGallery, setPreferGallery] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  useEffect(() => {
    setGalleryIndex(0)
    setPreferGallery(false)
    setZoomOpen(false)
  }, [product.id])
  const variantCover = [...selectedOptions].reverse().find((opt) => opt.image_url)?.image_url || null
  const displayCover = preferGallery
    ? gallery[galleryIndex] || cover
    : variantCover || gallery[galleryIndex] || cover
  const highlightThumbIndex = preferGallery
    ? galleryIndex
    : variantCover
      ? gallery.findIndex((src) => src === variantCover)
      : galleryIndex
  const activeThumb = highlightThumbIndex >= 0 ? highlightThumbIndex : galleryIndex
  const zoomImages = useMemo(() => {
    const list = [...gallery]
    if (displayCover && !list.includes(displayCover)) list.unshift(displayCover)
    if (list.length === 0 && displayCover) return [displayCover]
    return list
  }, [gallery, displayCover])
  const [zoomIdx, setZoomIdx] = useState(0)

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
          <button type="button" className="text-[24px] font-bold lowercase" onClick={() => shop?.openBrowseBack()}>
            {model.title || 'avalon'}
          </button>
          <div className="flex items-center gap-5 text-[14px] font-medium">
            <button type="button" onClick={() => shop?.openBrowseBack()}>
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
        <button type="button" className="hover:text-black" onClick={() => shop?.openBrowseBack()}>
          Home
        </button>
        <span className="mx-2">/</span>
        <span className="text-black">{product.name}</span>
      </div>

      <div className="mx-auto grid max-w-[1620px] gap-10 px-[30px] pb-14 lg:grid-cols-2 lg:gap-14">
        <div>
          <button
            type="button"
            className="group relative block w-full overflow-hidden bg-[#f5f5f5] text-left"
            aria-label="Zoom product image"
            disabled={!displayCover}
            onClick={() => {
              if (!displayCover) return
              const idx = zoomImages.indexOf(displayCover)
              setZoomIdx(idx >= 0 ? idx : 0)
              setZoomOpen(true)
            }}
          >
            <div className="relative aspect-[4/5] w-full">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={displayCover || product.id}
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.28 }}
                >
                  <ProductImage
                    src={displayCover}
                    alt={product.name}
                    primary={primary}
                    className="h-full w-full object-cover"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            {displayCover ? (
              <span className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-medium text-white opacity-0 backdrop-blur-md transition group-hover:opacity-100">
                Zoom
              </span>
            ) : null}
          </button>
          {gallery.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {gallery.map((src, index) => (
                <button
                  key={`${src}-${index}`}
                  type="button"
                  onClick={() => {
                    setGalleryIndex(index)
                    setPreferGallery(true)
                  }}
                  aria-pressed={index === activeThumb}
                  className={`h-16 w-16 shrink-0 overflow-hidden border-2 transition ${
                    index === activeThumb ? 'border-black' : 'border-transparent hover:border-[#999]'
                  }`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
          <ImageZoomLightbox
            open={zoomOpen}
            src={zoomImages[zoomIdx] || (displayCover ?? null)}
            alt={product.name}
            images={zoomImages}
            index={zoomIdx}
            onClose={() => setZoomOpen(false)}
            onIndexChange={
              zoomImages.length > 1
                ? (next) => {
                    setZoomIdx(next)
                    const src = zoomImages[next]
                    const gi = src ? gallery.indexOf(src) : -1
                    if (gi >= 0) {
                      setGalleryIndex(gi)
                      setPreferGallery(true)
                    }
                  }
                : undefined
            }
          />
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
          <div className="mt-4 text-[22px] font-bold">{formatRupiah(product.price + extra)}</div>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#4c4c4c]">
            {product.description?.trim() ||
              'Street-ready essentials with clean cuts and everyday comfort. Pair with denim or layered looks.'}
          </p>

          {attrs.length > 0 ? (
            <div className="mt-6 space-y-4">
              {attrs.map((attr) => {
                const current = attr.options.find((row) => row.id === selected[attr.id])
                return (
                  <div key={attr.id}>
                    <div className="mb-2 flex items-baseline justify-between gap-3 text-[12px] font-semibold uppercase tracking-wide text-[#4c4c4c]">
                      <span>{attr.name}</span>
                      {current ? (
                        <span className="normal-case tracking-normal text-black">{current.name}</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {attr.options.map((opt) => {
                        const active = selected[attr.id] === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setSelected((prev) => ({ ...prev, [attr.id]: opt.id }))
                              setPreferGallery(false)
                            }}
                            className="border px-3 py-1.5 text-[13px] transition"
                            style={{
                              borderColor: active ? '#000' : '#cdcdcd',
                              background: active ? '#000' : '#fff',
                              color: active ? '#fff' : '#111',
                            }}
                          >
                            {opt.name}
                            {opt.extra_price > 0 ? ` (+${formatRupiah(opt.extra_price)})` : ''}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

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
              disabled={outOfStock || !optionsReady}
              className="bg-black px-[25px] py-[10px] text-[15px] font-bold text-white transition hover:opacity-85 disabled:opacity-40"
              onClick={() => {
                if (outOfStock || !optionsReady) return
                shop?.addToCart(product, qty, selectedOptions)
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
                key={line.line_key}
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
                      {line.variant_label ? (
                        <div className="mt-1 text-xs text-neutral-500">{line.variant_label}</div>
                      ) : null}
                      <div className="mt-1 text-sm text-neutral-500">{formatRupiah(line.price)}</div>
                    </div>
                    <button
                      type="button"
                      className="text-[12px] text-neutral-400 transition hover:text-rose-600"
                      onClick={() => shop?.removeLine(line.line_key)}
                    >
                      Hapus
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <QtyStepper
                      value={line.qty}
                      max={line.available_qty == null ? 99 : Math.max(1, line.available_qty)}
                      onChange={(n) => shop?.setQty(line.line_key, n)}
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
                <div key={line.line_key} className="flex justify-between gap-2">
                  <span className="truncate">
                    {line.name}
                    {line.variant_label ? ` (${line.variant_label})` : ''} × {line.qty}
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
          items: (shop?.cart ?? []).map((line) => ({
            product_id: line.product_id,
            qty: line.qty,
            selected_options: (line.selected_options ?? []).map((opt) => ({
              attribute_id: opt.attribute_id,
              option_id: opt.option_id,
            })),
          })),
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
                <div key={line.line_key} className="flex justify-between gap-3 text-sm">
                  <span className="text-neutral-600">
                    {line.name}
                    {line.variant_label ? ` (${line.variant_label})` : ''}{' '}
                    <span className="text-neutral-400">× {line.qty}</span>
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

