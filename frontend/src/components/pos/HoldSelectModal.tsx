import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n'
import type { PosHoldSnapshot } from '../../lib/posHolds'

export function HoldSelectModal({
  open,
  holds,
  onResume,
  onDelete,
  onClose,
  formatMoney,
  formatWhen,
}: {
  open: boolean
  holds: PosHoldSnapshot[]
  onResume: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
  formatMoney: (value: number) => string
  formatWhen: (iso: string) => string
}) {
  const { t } = useI18n()
  const listRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const rows = useMemo(
    () =>
      holds.map((hold) => {
        const qty = hold.lines.reduce((sum, line) => sum + Math.max(0, line.qty - (line.promo_free_qty ?? 0)), 0)
        const subtotal = hold.lines.reduce(
          (sum, line) => sum + line.sell_price * Math.max(0, line.qty - (line.promo_free_qty ?? 0)),
          0,
        )
        return { hold, qty, subtotal }
      }),
    [holds],
  )

  useEffect(() => {
    if (!open) return
    setActive(0)
    window.setTimeout(() => listRef.current?.focus(), 0)
  }, [open, holds.length])

  useEffect(() => {
    if (!open) return
    const node = listRef.current?.querySelector<HTMLElement>(`[data-hold-index="${active}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()
        setActive((current) => Math.min(current + 1, Math.max(0, rows.length - 1)))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        setActive((current) => Math.max(current - 1, 0))
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        const row = rows[active]
        if (row) onResume(row.hold.id)
        return
      }
      if (event.key === 'Delete') {
        event.preventDefault()
        event.stopPropagation()
        const row = rows[active]
        if (row) onDelete(row.hold.id)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, rows, active, onResume, onDelete, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div
        className="pos-list-modal w-full max-w-lg overflow-hidden rounded-2xl border border-line shadow-2xl"
        style={{ background: 'var(--menu-bg)', color: 'var(--fg)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-line px-4 py-4">
          <div className="font-display text-xl font-bold">{t('posHoldListTitle')}</div>
          <div className="mt-1 text-sm text-muted">{t('posHoldListHint')}</div>
        </div>
        <div ref={listRef} tabIndex={-1} className="max-h-[min(480px,60vh)] overflow-y-auto py-1 outline-none">
          {rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted">{t('posHoldEmpty')}</div>
          ) : (
            rows.map((row, index) => {
              const focused = index === active
              return (
                <div
                  key={row.hold.id}
                  data-hold-index={index}
                  className={`flex items-stretch gap-2 border-b border-line/60 px-3 py-2 ${
                    focused ? 'bg-fill' : ''
                  }`}
                  onMouseEnter={() => setActive(index)}
                >
                  <button
                    type="button"
                    className={`min-h-14 min-w-0 flex-1 rounded-xl px-3 py-2 text-left ${
                      focused ? 'text-mint' : 'text-fg'
                    }`}
                    onClick={() => onResume(row.hold.id)}
                  >
                    <div className="truncate font-semibold">{row.hold.label}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {formatWhen(row.hold.savedAt)} · {t('posItemsCount', { count: String(row.qty) })} ·{' '}
                      {formatMoney(row.subtotal)}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="btn-ghost min-h-14 shrink-0 px-3 text-rose-300"
                    onClick={() => onDelete(row.hold.id)}
                  >
                    {t('delete')}
                  </button>
                </div>
              )
            })
          )}
        </div>
        <div className="border-t border-line px-4 py-3 text-right">
          <button type="button" className="btn-ghost min-h-11 px-4 text-sm" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
