import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n'

export type PosListOption = { id: number | ''; label: string }

export function PosListModal({
  open,
  title,
  hint,
  emptyLabel,
  options,
  value,
  onSelect,
  onClose,
  footer,
}: {
  open: boolean
  title: string
  hint?: string
  emptyLabel?: string
  options: PosListOption[]
  value: number | ''
  onSelect: (value: number | '') => void
  onClose: () => void
  footer?: ReactNode
}) {
  const { t } = useI18n()
  const listRef = useRef<HTMLDivElement>(null)
  const initialIndex = Math.max(
    0,
    options.findIndex((item) => item.id === value),
  )
  const [active, setActive] = useState(initialIndex)

  const optionKey = useMemo(() => options.map((item) => `${item.id}:${item.label}`).join('|'), [options])

  useEffect(() => {
    if (!open) return
    setActive(Math.max(0, options.findIndex((item) => item.id === value)))
    // Ambil fokusus dari field scan/cash di belakang modal biar Enter/↑↓ jalan.
    window.setTimeout(() => {
      listRef.current?.focus()
    }, 0)
  }, [open, optionKey, value, options])

  useEffect(() => {
    if (!open) return
    const node = listRef.current?.querySelector<HTMLElement>(`[data-pos-list-index="${active}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      const target = event.target
      const inCodeField =
        target instanceof HTMLElement && Boolean(target.closest('[data-pos-list-code="1"]'))

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key === 'ArrowDown') {
        if (inCodeField) return
        event.preventDefault()
        event.stopPropagation()
        setActive((current) => Math.min(current + 1, Math.max(0, options.length - 1)))
        return
      }
      if (event.key === 'ArrowUp') {
        if (inCodeField) return
        event.preventDefault()
        event.stopPropagation()
        setActive((current) => Math.max(current - 1, 0))
        return
      }
      if (event.key === 'Enter') {
        if (inCodeField) return
        event.preventDefault()
        event.stopPropagation()
        const item = options[active]
        if (item) {
          onSelect(item.id === '' ? '' : item.id)
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, options, active, onSelect, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div
        className="pos-list-modal w-full max-w-lg overflow-hidden rounded-2xl border border-line shadow-2xl"
        style={{ background: 'var(--menu-bg)', color: 'var(--fg)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-line px-4 py-4">
          <div className="font-display text-xl font-bold">{title}</div>
          {hint ? <div className="mt-1 text-sm text-muted">{hint}</div> : null}
        </div>
        <div
          ref={listRef}
          tabIndex={-1}
          className="max-h-[min(360px,45vh)] overflow-y-auto py-1 outline-none"
        >
          {options.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted">{emptyLabel ?? t('posPromoEmpty')}</div>
          ) : (
            options.map((item, index) => {
              const selected = item.id === value
              const focused = index === active
              return (
                <button
                  key={item.id === '' ? 'none' : item.id}
                  type="button"
                  data-pos-list-index={index}
                  className={`flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-base ${
                    focused ? 'bg-fill text-mint' : 'text-fg hover:bg-fill'
                  }`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => {
                    onSelect(item.id === '' ? '' : item.id)
                    onClose()
                  }}
                >
                  <span className="truncate">{item.label}</span>
                  {selected ? <span className="text-xs text-mint">✓</span> : null}
                </button>
              )
            })
          )}
        </div>
        {footer}
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
