import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useFeedback } from './feedback'
import type { Product } from '../types'
import { useI18n } from '../i18n'
import { findProductByScan, resolveProductFromScan, type ProductScanOption } from '../lib/productScan'
import { ProcurementBarcodeScanner } from '../pages/purchase/ProcurementBarcodeScanner'

function CameraScanButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-fill text-fg active:bg-fill/80"
      title={t('stockScanCamera')}
      aria-label={t('stockScanCamera')}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 8h2l1.5-2h9L18 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
        />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    </button>
  )
}

export function InventoryScanBar({
  productOptions,
  products,
  onPick,
  disabled,
}: {
  productOptions: ProductScanOption[]
  products: Product[]
  onPick: (product: Product) => void
  disabled?: boolean
}) {
  const { t } = useI18n()
  const feedback = useFeedback()
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [menu, setMenu] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 1) return []
    return productOptions
      .filter((item) => {
        const hay = `${item.label} ${item.keywords ?? ''}`.toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 12)
  }, [productOptions, query])

  const showMenu = open && query.trim().length >= 1 && !disabled

  function placeMenu() {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return
    const gap = 6
    const spaceBelow = window.innerHeight - box.bottom - 12
    const spaceAbove = box.top - 12
    const maxHeight = Math.min(280, Math.max(120, spaceBelow >= 160 ? spaceBelow : spaceAbove))
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow
    setMenu({
      top: openUp ? Math.max(8, box.top - maxHeight - gap) : box.bottom + gap,
      left: box.left,
      width: box.width,
      maxHeight,
    })
  }

  useEffect(() => {
    if (!showMenu) return
    placeMenu()
    setActive(0)
    function onDoc(event: MouseEvent) {
      const target = event.target as Node
      if (wrapRef.current?.contains(target)) return
      if ((event.target as HTMLElement | null)?.closest?.('[data-inventory-scan-menu]')) return
      setOpen(false)
    }
    function onReposition() {
      placeMenu()
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [showMenu, filtered.length])

  function pick(product: Product) {
    onPick(product)
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function pickFromCode(code: string) {
    const trimmed = code.trim()
    if (!trimmed) return false
    const product = resolveProductFromScan(trimmed, products, productOptions)
    if (product) {
      pick(product)
      return true
    }
    feedback.error(t('stockScanNotFound', { code: trimmed }))
    return false
  }

  function tryExactMatch() {
    const exact = findProductByScan(query, products)
    if (exact) {
      pick(exact)
      return true
    }
    return false
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    if (!showMenu) {
      if (event.key === 'Enter') {
        event.preventDefault()
        if (tryExactMatch()) return
        const match = filtered[0]
        if (match) {
          const product = products.find((p) => String(p.id) === match.value)
          if (product) pick(product)
        }
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => Math.min(current + 1, Math.max(0, filtered.length - 1)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => Math.max(current - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const item = filtered[active]
      if (item) {
        const product = products.find((p) => String(p.id) === item.value)
        if (product) pick(product)
        return
      }
      tryExactMatch()
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div ref={wrapRef} className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="search"
            className="field !mt-0 w-full text-base"
            placeholder={t('stockScanHint')}
            value={query}
            disabled={disabled}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={showMenu}
            aria-controls={listId}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
          />
        </div>
        <CameraScanButton onClick={() => !disabled && setScannerOpen(true)} />
      </div>

      {showMenu && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-inventory-scan-menu
              id={listId}
              role="listbox"
              className="fixed z-[95] overflow-hidden rounded-xl border border-line shadow-2xl"
              style={{
                top: menu.top,
                left: menu.left,
                width: menu.width,
                background: 'var(--menu-bg)',
                color: 'var(--fg)',
              }}
            >
              <div className="overflow-y-auto py-1" style={{ maxHeight: menu.maxHeight }}>
                {filtered.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted">{t('noSearchResults')}</div>
                ) : (
                  filtered.map((item, index) => (
                    <button
                      key={item.value}
                      type="button"
                      role="option"
                      aria-selected={index === active}
                      className={`block w-full truncate px-3 py-2.5 text-left text-sm ${
                        index === active ? 'bg-fill text-mint' : 'text-fg hover:bg-fill'
                      }`}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        const product = products.find((p) => String(p.id) === item.value)
                        if (product) pick(product)
                      }}
                    >
                      {item.label}
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}

      <ProcurementBarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          pickFromCode(code)
        }}
      />
    </>
  )
}
