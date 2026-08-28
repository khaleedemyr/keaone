import type { Lang } from './i18n/langs'

export type User = {
  id: number
  name: string
  email: string
  username: string | null
  phone: string | null
  avatar: string | null
  role: string | null
  role_name?: string | null
  is_platform: boolean
  platform_role: string | null
}

export type AclAction = 'view' | 'create' | 'edit' | 'delete'

export type MenuAcl = Record<AclAction, boolean>

export type RoleMenu = {
  key: string
  actions: AclAction[]
}

export type RoleRecord = {
  id: number
  name: string
  slug: string
  is_system: boolean
  is_owner: boolean
  is_active: boolean
  permissions: Record<string, MenuAcl>
}

export type RoleCatalogPayload = {
  menus: RoleMenu[]
  roles: RoleRecord[]
}

export type Company = {
  id: number
  name: string
  business_type: string
  business_type_name?: string | null
  phone: string | null
  address: string | null
  logo?: string | null
  status: string
  modules?: Modules
  settings?: Settings
}

export type Plan = {
  id: number
  slug: string
  name: string
  price_monthly: number
  price_yearly: number
  trial_days: number
  max_users: number | null
  max_outlets: number | null
  modules: Modules
  is_default: boolean
  is_active: boolean
  sort_order: number
}

export type BusinessType = {
  id?: number
  slug: string
  name: string
  is_active?: boolean
  sort_order?: number
}

export type BillingSnapshot = {
  status: string
  billing_cycle: string
  trial_ends_at: string | null
  current_period_end: string | null
  usable: boolean
  plan: Plan | null
}

export type BillingInvoice = {
  id: number
  number: string
  amount: number
  status: string
  billing_cycle: string
  period_start: string | null
  period_end: string | null
  due_at: string | null
  paid_at: string | null
  note: string | null
  plan: { id: number; name: string } | null
  company: { id: number; name: string } | null
}

export type Outlet = {
  id: number
  name: string
  address?: string | null
  is_default?: boolean
  is_active?: boolean
}

export type Member = {
  id: number
  membership_id?: number
  name: string
  email: string
  username: string | null
  phone: string | null
  role: string
  role_id?: number | null
  is_active: boolean
  employee_code?: string | null
  hired_at?: string | null
  employment_status?: 'active' | 'resigned'
  outlet: { id: number; name: string } | null
  department?: { id: number; name: string } | null
  position?: { id: number; name: string } | null
  job_level?: { id: number; name: string } | null
  manager?: { membership_id: number; name: string | null | undefined } | null
}

export type RoleDef = RoleRecord

export type Modules = {
  pos: boolean
  stock: boolean
  invoice: boolean
  purchase: boolean
  work_order: boolean
  promotions: boolean
  choices: boolean
}

export type PosMode = 'retail' | 'restaurant' | 'cafe'

export type Settings = {
  tax_percent: number
  allow_credit: boolean
  receipt_width: number
  receipt_footer: string
  pos_mode?: PosMode
  purchase_flow?: 'strict_pr_po_gr' | 'po_gr' | 'direct'
  purchase_update_cost?: boolean
  pr_need_approval?: boolean
  po_need_approval?: boolean
  receipt_layout?: import('./lib/receiptLayout').ReceiptLayout
}

export type UserPreferences = {
  theme: 'dark' | 'light'
  lang: Lang
  uiSkin?: 'auto' | 'desktop' | 'erp'
  wallpaper: {
    kind: 'preset' | 'image'
    id: string
    src?: string
  }
  desktop?: {
    showIcons: boolean
    hiddenApps: string[]
    iconPositions: Record<string, { x: number; y: number }>
    widgets?: {
      hidden: string[]
      positions: Record<string, { x: number; y: number }>
      clockSkin: string
      stickyNotes?: { id: string; text: string; color: string }[]
      notesText?: string
      notesColor?: string
      weatherCity: string
    }
  }
}

export type Membership = {
  company_id: number
  name: string
  role: string
  status: string
}

export type MePayload = {
  user: User
  company: Company | null
  access: 'member' | 'support' | null
  memberships: Membership[]
  modules: Modules
  settings: Settings
  outlet: Outlet | null
  billing: BillingSnapshot | null
  preferences: UserPreferences | null
  acl: {
    scope: 'tenant' | 'platform'
    role_id: number | null
    role_name: string | null
    role_slug: string | null
    is_owner: boolean
  }
  permissions: Record<string, MenuAcl>
}

export type AuthPayload = MePayload & {
  token: string
  token_type: string
}

export type Category = {
  id: number
  name: string
  sort_order: number
  is_active: boolean
  show_pos?: boolean
  is_raw_material?: boolean
}

export type Unit = {
  id: number
  name: string
  symbol: string | null
  sort_order: number
  is_active: boolean
}

export type Department = {
  id: number
  name: string
  code: string | null
  parent_id: number | null
  parent_name?: string | null
  sort_order: number
  is_active: boolean
}

export type Position = {
  id: number
  name: string
  code: string | null
  rank: number
  sort_order: number
  is_active: boolean
}

export type JobLevel = {
  id: number
  name: string
  code: string | null
  rank: number
  sort_order: number
  is_active: boolean
}

export type ItemType = {
  id: number
  name: string
  sort_order: number
  is_active: boolean
}

export type PriceChannel = {
  id: number
  name: string
  code: string
  sort_order: number
  is_active: boolean
}

export type Discount = {
  id: number
  name: string
  value_type: 'percent' | 'fixed'
  value: number
  scope: 'item' | 'sale'
  max_discount: number | null
  min_subtotal: number | null
  sort_order: number
  is_active: boolean
}

export type PromotionConfig = {
  buy_qty?: number
  get_qty?: number
  /** Products that trigger BOGO (buy side). Empty = use promotion.products / all. */
  buy_product_ids?: number[]
  /** Free / discounted products (get side). Empty = same as buy (same-item BOGO). */
  get_product_ids?: number[]
  bundle_price?: number
  items?: { product_id: number; qty?: number }[]
}

export type Promotion = {
  id: number
  name: string
  type: 'percent' | 'fixed' | 'bogo' | 'bundle'
  value: number
  scope: 'item' | 'sale'
  max_discount: number | null
  min_subtotal: number | null
  starts_at: string | null
  ends_at: string | null
  code: string | null
  apply_mode: 'manual' | 'auto'
  priority: number
  config: PromotionConfig | null
  sort_order: number
  is_active: boolean
  products?: { id: number; name: string }[]
  categories?: { id: number; name: string }[]
}

export type TableShape = 'rect' | 'round'

export type FloorObjectKind = 'wall' | 'separator' | 'counter' | 'label' | 'plant' | 'pos' | 'cashier'

export type FloorObject = {
  id: string
  kind: FloorObjectKind
  x: number
  y: number
  w: number
  h: number
  rotation: number
  label?: string | null
}

export type DiningTable = {
  id: number
  outlet_id: number
  dining_layout_id?: number | null
  outlet?: { id: number; name: string } | null
  name: string
  area: string | null
  shape?: TableShape
  seats: number
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  sort_order: number
  is_active: boolean
}

export type DiningLayout = {
  id: number
  outlet_id: number
  outlet: { id: number; name: string } | null
  name: string
  canvas_width: number
  canvas_height: number
  objects: FloorObject[]
  tables: DiningTable[]
  is_active: boolean
}

export type ChoiceOption = {
  id: number
  choice_type_id?: number
  choice_type?: { id: number; name: string } | null
  name: string
  extra_price: number
  sort_order?: number
  is_active: boolean
}

export type ChoiceType = {
  id: number
  name: string
  is_required: boolean
  min_select: number
  max_select: number
  sort_order: number
  is_active: boolean
  choices?: ChoiceOption[]
}

export type ProductChoiceGroup = {
  id: number
  name: string
  is_required?: boolean
  min_select?: number
  max_select?: number
  choices?: { id: number; name: string; extra_price: number }[]
}

export type SubCategory = {
  id: number
  category_id: number
  category: { id: number; name: string } | null
  name: string
  sort_order: number
  is_active: boolean
}

export type Warehouse = {
  id: number
  outlet_id: number | null
  outlet: { id: number; name: string } | null
  name: string
  address: string | null
  is_default: boolean
  is_active: boolean
}

export type CustomFieldEntity = 'product' | 'customer' | 'supplier'
export type CustomFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'select'

export type CustomFieldDefinition = {
  id: number
  entity: CustomFieldEntity
  key: string
  label: string
  type: CustomFieldType
  options: string[] | null
  is_required: boolean
  is_active: boolean
  sort_order: number
}

export type Party = {
  id: number
  type: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  npwp: string | null
  bank_name: string | null
  bank_account: string | null
  bank_account_name: string | null
  payment_term: string | null
  payment_days: number | null
  is_taxable?: boolean
  tax_percent?: number | null
  custom_fields?: Record<string, string | number | boolean | null> | null
  is_active: boolean
}

export type ProductImage = {
  id: number
  url: string
  sort_order: number
  is_primary: boolean
}

export type ProductOutletPrice = {
  outlet_id: number
  sell_price: number
}

export type ProductChannelPrice = {
  price_channel_id: number
  sell_price: number
  name?: string | null
  code?: string | null
}

export type ProductBomItem = {
  id: number
  component_id: number
  component: { id: number; name: string; sku: string | null; unit: string; unit_id: number | null } | null
  qty: number
  unit_id: number | null
  unit: { id: number; name: string; symbol: string | null } | null
  sort_order: number
}

export type ProductOption = {
  id: number
  name: string
  sku: string | null
  unit: string
  unit_id: number | null
  is_active: boolean
}

export type ProductUnitLevel = 'small' | 'medium' | 'large'

export type ProductUnitRow = {
  level: ProductUnitLevel
  unit_id: number
  unit: { id: number; name: string; symbol: string | null } | null
  label: string
  factor_to_base: number
}

export type Product = {
  id: number
  category_id: number | null
  category: { id: number; name: string } | null
  sub_category_id: number | null
  sub_category: { id: number; name: string; category_id: number } | null
  item_type_id: number | null
  item_type: { id: number; name: string } | null
  type: string
  name: string
  description: string | null
  sku: string | null
  barcode: string | null
  unit: string
  unit_id: number | null
  unit_master: { id: number; name: string; symbol: string | null } | null
  units?: ProductUnitRow[]
  sell_price: number
  default_sell_price: number
  outlet_prices: ProductOutletPrice[]
  channel_prices?: ProductChannelPrice[]
  images: ProductImage[]
  track_stock: boolean
  min_stock: number
  is_active: boolean
  stock_qty: number
  choice_ids?: number[]
  choice_types?: ProductChoiceGroup[]
  bom_items?: ProductBomItem[]
  has_bom?: boolean
  custom_fields?: Record<string, string | number | boolean | null> | null
}

export type SaleItem = {
  id: number
  product_id: number
  name: string
  qty: number
  unit: string
  price: number
  discount: number
  tax: number
  total: number
}

export type SalePayment = {
  id: number
  method: string
  amount: number
  paid_at: string | null
  client_uuid: string | null
  note: string | null
}

export type Sale = {
  id: number
  number: string
  client_uuid: string
  status: string
  channel: string
  sold_at: string | null
  discount_id?: number | null
  discount_name?: string | null
  promotion_id?: number | null
  promotion_name?: string | null
  contact: { id: number; name: string; phone: string | null } | null
  cashier: { id: number; name: string } | null
  outlet: Outlet | null
  subtotal: number
  discount: number
  tax: number
  total: number
  paid_amount: number
  change_amount: number
  note: string | null
  items: SaleItem[]
  payments: SalePayment[]
}

export type EngineeringProductRow = {
  product_id?: number | null
  name: string
  qty: number
  discount: number
  revenue: number
}

export type EngineeringCategory = {
  category_id: number
  category_name: string
  qty: number
  discount: number
  revenue: number
  products: EngineeringProductRow[]
}

export type EngineeringGrandTotal = {
  qty: number
  discount: number
  revenue: number
}

export type SalesReportKind = 'summary' | 'products' | 'cashiers' | 'methods' | 'channels' | 'daily'

export type SalesReportMethod = { count: number; amount: number }

export type SalesReportRow = {
  product_id?: number | null
  name?: string
  qty?: number
  discount?: number
  revenue?: number
  sales_count?: number
  paid?: number
  channel?: string
  day?: string
  tax?: number
}

export type SalesReport = {
  kind: SalesReportKind
  from: string
  to: string
  sales_count?: number
  cancelled_count?: number
  items_sold?: number
  subtotal?: number
  discount?: number
  tax?: number
  revenue?: number
  paid?: number
  change?: number
  cash_net?: number
  average_ticket?: number
  payment_methods?: {
    cash: SalesReportMethod
    transfer: SalesReportMethod
    qris: SalesReportMethod
  }
  top_products?: SalesReportRow[]
  rows?: SalesReportRow[]
  categories?: EngineeringCategory[]
  grand_total?: EngineeringGrandTotal
}

export type TodayReport = {
  date: string
  sales_count: number
  revenue: number
  paid: number
  items_sold: number
  average_ticket: number
  payment_methods: {
    cash: number
    transfer: number
    qris: number
  }
}

export type PosSettlement = {
  company: {
    name: string | null
    phone: string | null
    address: string | null
    logo?: string | null
  }
  outlet: { id: number; name: string } | null
  cashier: string | null
  printed_at: string
  date: string
  from: string
  to: string
  receipt_width: number
  sales_count: number
  cancelled_count: number
  items_sold: number
  subtotal: number
  discount: number
  tax: number
  revenue: number
  paid: number
  change: number
  cash_net: number
  average_ticket: number
  first_sale_at: string | null
  last_sale_at: string | null
  payment_methods: {
    cash: { count: number; amount: number }
    transfer: { count: number; amount: number }
    qris: { count: number; amount: number }
  }
  cashiers: { name: string; sales_count: number; revenue: number }[]
}

export type ReceiptPayload = {
  company: {
    name: string | null
    phone: string | null
    address: string | null
    logo?: string | null
  }
  outlet: Outlet | null
  sale: Sale
  footer: string
  receipt_width: number
  cashier: string | null
  layout?: import('./lib/receiptLayout').ReceiptLayout
}

export type PlatformOperator = {
  id: number
  name: string
  email: string
  username: string | null
  phone: string | null
  platform_role: string
  role_id?: number | null
  role_name?: string | null
  is_active?: boolean
}

export type PlatformOverview = {
  companies: number
  active: number
  trialing: number
  past_due: number
  open_invoices: number
  open_amount: number
}

export type PlatformCompany = {
  id: number
  name: string
  business_type: string
  business_type_name?: string | null
  phone: string | null
  status: string
  users_count: number
  outlets_count: number
  created_at: string | null
  billing: {
    status: string
    billing_cycle: string
    trial_ends_at: string | null
    current_period_end: string | null
    plan: { id: number; name: string } | null
  } | null
}

export type ApiOk<T> = {
  data: T
  meta: {
    current_page?: number
    last_page?: number
    total?: number
    per_page?: number
  }
}

export type ActivityLogRow = {
  id: number
  scope: string
  action: string
  menu_key: string | null
  summary: string
  target: string | null
  method: string | null
  path: string | null
  ip: string | null
  status: number | null
  meta?: {
    changes?: Array<{
      field: string
      label: string
      from: string | number | boolean | null
      to: string | number | boolean | null
    }>
    keys?: string[]
    [key: string]: unknown
  } | null
  created_at: string | null
  user: { id: number; name: string; email: string } | null
  company: { id: number; name: string } | null
}

export type CartLine = {
  product: Product
  qty: number
  /** Qty auto-added as free get-item for cross B1G1 (portion of qty). */
  promo_free_qty?: number
}

export type CalendarHoliday = {
  date: string
  kind: 'national' | 'joint' | string
  name_id: string
  name_en: string
}

export type Reminder = {
  id: number
  title: string
  note: string | null
  remind_on: string
  remind_at: string | null
}

export type CalendarPayload = {
  year: number
  holidays: CalendarHoliday[]
  reminders: Reminder[]
}
