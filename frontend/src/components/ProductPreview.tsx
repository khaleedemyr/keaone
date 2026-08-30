import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { formatRupiah } from '../lib/money'
import type { Outlet, Product } from '../types'
import { useI18n } from '../i18n'

export function ImageLightbox({
  urls,
  index,
  onClose,
  onIndex,
}: {
  urls: string[]
  index: number
  onClose: () => void
  onIndex: (index: number) => void
}) {
  const { t } = useI18n()
  const url = urls[index]

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' && urls.length > 1) onIndex((index + 1) % urls.length)
      if (event.key === 'ArrowLeft' && urls.length > 1) onIndex((index - 1 + urls.length) % urls.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, onClose, onIndex, urls.length])

  if (typeof document === 'undefined' || !url) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <button
          type="button"
          className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white"
          onClick={onClose}
        >
          {t('close')}
        </button>
        {urls.length > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-xl text-white"
              onClick={() => onIndex((index - 1 + urls.length) % urls.length)}
            >
              ‹
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-xl text-white"
              onClick={() => onIndex((index + 1) % urls.length)}
            >
              ›
            </button>
          </>
        ) : null}
        <motion.img
          key={url}
          src={url}
          alt=""
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
        />
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

export function ProductViewModal({
  product,
  outlets,
  onClose,
  onEdit,
  onOpenImage,
}: {
  product: Product
  outlets: Outlet[]
  onClose: () => void
  onEdit?: () => void
  onOpenImage: (index: number) => void
}) {
  const { t, locale } = useI18n()
  const images = (product.images ?? []).filter((image) => image.url)
  const activeOutlets = outlets
    .filter((item) => item.is_active !== false)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default))
  const unitLabel = product.unit_master
    ? product.unit_master.symbol
      ? `${product.unit_master.name} (${product.unit_master.symbol})`
      : product.unit_master.name
    : product.unit

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl"
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
            <h2 className="font-display mb-4 text-xl font-bold">{t('viewProduct')}</h2>
            {images.length > 0 ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {images.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    className="relative overflow-hidden rounded-xl ring-1 ring-line"
                    onClick={() => onOpenImage(index)}
                  >
                    <img src={image.url} alt="" className="h-20 w-20 object-cover" />
                    {image.is_primary ? (
                      <span className="absolute bottom-1 left-1 rounded bg-mint px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                        {t('primaryImage')}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="font-display text-2xl font-bold text-fg">{product.name}</div>
            {product.description ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{product.description}</p>
            ) : null}
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <ViewField label={t('sku')} value={product.sku} />
              <ViewField label={t('barcode')} value={product.barcode} />
              <ViewField label={t('category')} value={product.category?.name} />
              <ViewField label={t('subCategory')} value={product.sub_category?.name} />
              <ViewField label={t('itemType')} value={product.item_type?.name} />
              <ViewField label={t('unit')} value={unitLabel} />
              <ViewField label={t('minStock')} value={String(product.min_stock)} />
              {product.track_stock ? (
                <ViewField label={t('reorderQty')} value={String(product.reorder_qty ?? 0)} />
              ) : null}
              <ViewField label={t('status')} value={product.is_active ? t('active') : t('inactive')} />
            </dl>
            <div className="mt-4">
              <div className="mb-2 text-sm text-muted">
                {activeOutlets.length > 1 ? t('outletPrices') : t('sellPrice')}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(activeOutlets.length > 0 ? activeOutlets : [{ id: 0, name: t('sellPrice') }]).map((outlet) => {
                  const override = product.outlet_prices?.find((row) => row.outlet_id === outlet.id)
                  const price = override?.sell_price ?? product.default_sell_price ?? product.sell_price
                  return (
                    <div key={outlet.id || 'price'} className="rounded-2xl bg-fill px-3 py-2">
                      <div className="text-xs text-muted">{activeOutlets.length > 1 ? outlet.name : t('sellPrice')}</div>
                      <div className="font-medium text-mint">{formatRupiah(price, locale)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
            {(product.channel_prices ?? []).length > 0 ? (
              <div className="mt-4">
                <div className="mb-2 text-sm text-muted">{t('channelPrices')}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(product.channel_prices ?? []).map((row) => (
                    <div key={row.price_channel_id} className="rounded-2xl bg-fill px-3 py-2">
                      <div className="text-xs text-muted">{row.name || t('channelPrices')}</div>
                      <div className="font-medium text-mint">{formatRupiah(row.sell_price, locale)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {(product.choice_types ?? []).length > 0 ? (
              <div className="mt-4">
                <div className="mb-2 text-sm text-muted">{t('productChoices')}</div>
                <div className="grid gap-2">
                  {(product.choice_types ?? []).map((type) => (
                    <div key={type.id} className="rounded-2xl bg-fill px-3 py-2">
                      <div className="text-sm font-medium text-fg">
                        {type.name}
                        <span className="ml-2 text-xs font-normal text-muted">
                          {type.is_required ? t('choiceRequired') : t('choiceOptional')}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(type.choices ?? []).map((choice) => (
                          <span key={choice.id} className="rounded-full bg-line/60 px-2 py-0.5 text-xs text-fg">
                            {choice.name}
                            {choice.extra_price > 0 ? ` · + ${formatRupiah(choice.extra_price, locale)}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {(product.bom_items ?? []).length > 0 ? (
              <div className="mt-4">
                <div className="mb-2 text-sm text-muted">{t('productTabBom')}</div>
                <div className="grid gap-2">
                  {(product.bom_items ?? []).map((row) => {
                    const unitLabel = row.unit
                      ? row.unit.symbol
                        ? `${row.unit.name} (${row.unit.symbol})`
                        : row.unit.name
                      : row.component?.unit
                    return (
                      <div key={row.id} className="flex items-center justify-between rounded-2xl bg-fill px-3 py-2">
                        <div className="text-sm text-fg">{row.component?.name ?? '-'}</div>
                        <div className="text-sm text-muted">
                          {row.qty}
                          {unitLabel ? ` ${unitLabel}` : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-line px-6 py-4">
            <button type="button" className="btn-ghost" onClick={onClose}>
              {t('close')}
            </button>
            {onEdit ? (
              <button type="button" className="btn-primary" onClick={onEdit}>
                {t('edit')}
              </button>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

function ViewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div className="text-fg">{value && value !== '' ? value : '-'}</div>
    </div>
  )
}
