import { formatDateTime, formatRupiah } from '../lib/money'
import {
  normalizeReceiptLayout,
  type ReceiptBlock,
  type ReceiptLayout,
} from '../lib/receiptLayout'
import type { ReceiptPayload } from '../types'
import { useI18n, type MsgKey } from '../i18n'

const KIND_LABEL: Record<ReceiptBlock['kind'], MsgKey> = {
  logo: 'receiptBlockLogo',
  company: 'receiptBlockCompany',
  outlet: 'receiptBlockOutlet',
  address: 'receiptBlockAddress',
  phone: 'receiptBlockPhone',
  divider: 'receiptBlockDivider',
  number: 'receiptBlockNumber',
  datetime: 'receiptBlockDatetime',
  cashier: 'receiptBlockCashier',
  channel: 'receiptBlockChannel',
  items: 'receiptBlockItems',
  totals: 'receiptBlockTotals',
  payments: 'receiptBlockPayments',
  footer: 'receiptBlockFooter',
  text: 'receiptBlockText',
  spacer: 'receiptBlockSpacer',
}

function blockClass(block: ReceiptBlock) {
  const align = block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : 'text-left'
  const size = block.size === 'sm' ? 'text-[11px] leading-4' : block.size === 'lg' ? 'text-[16px] leading-5' : 'text-[13px] leading-5'
  return `${align} ${size} ${block.bold ? 'font-bold' : ''}`
}

function payLabel(method: string, t: (key: MsgKey) => string) {
  if (method === 'cash') return t('cash')
  if (method === 'transfer') return t('transfer')
  if (method === 'qris') return t('qris')
  return method
}

function BlockBody({
  block,
  receipt,
  placeholder = false,
}: {
  block: ReceiptBlock
  receipt: ReceiptPayload
  placeholder?: boolean
}) {
  const { t, locale } = useI18n()
  const cls = blockClass(block)

  if (block.kind === 'logo') {
    const src = receipt.company.logo
    const size = block.size === 'sm' ? 'is-sm' : block.size === 'lg' ? 'is-lg' : 'is-md'
    const align = block.align === 'right' ? 'is-right' : block.align === 'left' ? 'is-left' : 'is-center'
    if (!src) {
      return placeholder ? <div className="receipt-logo-empty">{t('receiptLogoEmpty')}</div> : null
    }
    return (
      <div className={`receipt-logo-wrap ${align}`}>
        <img src={src} alt={receipt.company.name || ''} className={`receipt-logo ${size}`} />
      </div>
    )
  }
  if (block.kind === 'divider') {
    return <div className="my-1.5 border-t border-dashed border-slate-400" />
  }
  if (block.kind === 'spacer') {
    return <div className="h-2" />
  }
  if (block.kind === 'company') {
    return <div className={cls}>{receipt.company.name || '—'}</div>
  }
  if (block.kind === 'outlet') {
    return receipt.outlet?.name ? <div className={cls}>{receipt.outlet.name}</div> : null
  }
  if (block.kind === 'address') {
    return receipt.company.address ? <div className={cls}>{receipt.company.address}</div> : null
  }
  if (block.kind === 'phone') {
    return receipt.company.phone ? <div className={cls}>{receipt.company.phone}</div> : null
  }
  if (block.kind === 'number') {
    return <div className={cls}>{receipt.sale.number}</div>
  }
  if (block.kind === 'datetime') {
    return <div className={cls}>{formatDateTime(receipt.sale.sold_at, locale)}</div>
  }
  if (block.kind === 'cashier') {
    return (
      <div className={cls}>
        {t('cashier')}: {receipt.cashier ?? receipt.sale.cashier?.name ?? '—'}
      </div>
    )
  }
  if (block.kind === 'channel') {
    const channel = receipt.sale.channel === 'pos' || !receipt.sale.channel ? t('posChannelPos') : receipt.sale.channel
    return <div className={cls}>{channel}</div>
  }
  if (block.kind === 'text' || block.kind === 'footer') {
    const text = (block.text ?? receipt.footer ?? '').trim()
    return text ? <div className={`${cls} whitespace-pre-wrap`}>{text}</div> : null
  }
  if (block.kind === 'items') {
    return (
      <div className={cls}>
        {receipt.sale.items.map((item) => (
          <div key={item.id} className="mb-1">
            <div>{item.name}</div>
            <div className="flex justify-between gap-2">
              <span>
                {item.qty} x {formatRupiah(item.price, locale)}
              </span>
              <span>{formatRupiah(item.total, locale)}</span>
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (block.kind === 'totals') {
    const sale = receipt.sale
    return (
      <div className={cls}>
        {sale.subtotal !== sale.total ? (
          <div className="flex justify-between gap-2">
            <span>{t('receiptSubtotal')}</span>
            <span>{formatRupiah(sale.subtotal, locale)}</span>
          </div>
        ) : null}
        {sale.discount ? (
          <div className="flex justify-between gap-2">
            <span>{t('receiptDiscount')}</span>
            <span>-{formatRupiah(sale.discount, locale)}</span>
          </div>
        ) : null}
        {sale.tax ? (
          <div className="flex justify-between gap-2">
            <span>{t('receiptTax')}</span>
            <span>{formatRupiah(sale.tax, locale)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-2 font-semibold">
          <span>{t('total')}</span>
          <span>{formatRupiah(sale.total, locale)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>{t('payLabel')}</span>
          <span>{formatRupiah(sale.paid_amount, locale)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>{t('changeLabel')}</span>
          <span>{formatRupiah(sale.change_amount, locale)}</span>
        </div>
      </div>
    )
  }
  if (block.kind === 'payments') {
    return (
      <div className={cls}>
        {receipt.sale.payments.map((payment) => (
          <div key={payment.id} className="flex justify-between gap-2">
            <span>{payLabel(payment.method, t)}</span>
            <span>{formatRupiah(payment.amount, locale)}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function receiptKindLabel(kind: ReceiptBlock['kind']) {
  return KIND_LABEL[kind]
}

export function ReceiptPaper({
  receipt,
  layout,
  selectedId,
  onSelect,
}: {
  receipt: ReceiptPayload
  layout?: ReceiptLayout | null
  selectedId?: string | null
  onSelect?: (id: string) => void
}) {
  const resolved = normalizeReceiptLayout(layout ?? receipt.layout, {
    receipt_width: receipt.receipt_width,
    receipt_footer: receipt.footer,
  })
  const interactive = Boolean(onSelect)

  return (
    <div id={interactive ? undefined : 'receipt'} className="receipt-paper" style={{ width: `${resolved.width}mm` }}>
      {resolved.blocks.map((block) => {
        if (!block.enabled && !interactive) return null
        const body = <BlockBody block={block} receipt={receipt} placeholder={interactive} />
        if (!interactive) return <div key={block.id}>{body}</div>
        return (
          <button
            key={block.id}
            type="button"
            className={`receipt-block ${selectedId === block.id ? 'is-on' : ''} ${block.enabled ? '' : 'is-off'}`}
            onClick={() => onSelect?.(block.id)}
          >
            {body ?? <span className="text-[10px] text-slate-400">{block.kind}</span>}
          </button>
        )
      })}
    </div>
  )
}
