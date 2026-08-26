import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n'

export type SearchSelectOption = {
  value: string
  label: string
  keywords?: string
}

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  required = false,
  allowEmpty = false,
  emptyLabel = '-',
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  options: SearchSelectOption[]
  placeholder: string
  required?: boolean
  allowEmpty?: boolean
  emptyLabel?: string
  disabled?: boolean
}) {
  const { t } = useI18n()
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [menu, setMenu] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 })

  const selected = options.find((item) => item.value === value)
  const display = selected?.label ?? (value === '' && allowEmpty ? emptyLabel : placeholder)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = options.filter((item) => {
      if (!q) return true
      const hay = `${item.label} ${item.keywords ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
    if (allowEmpty && (!q || emptyLabel.toLowerCase().includes(q))) {
      return [{ value: '', label: emptyLabel }, ...rows]
    }
    return rows
  }, [allowEmpty, emptyLabel, options, query])

  function placeMenu() {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return
    const gap = 6
    const spaceBelow = window.innerHeight - box.bottom - 12
    const spaceAbove = box.top - 12
    const maxHeight = Math.min(240, Math.max(120, spaceBelow >= 160 ? spaceBelow : spaceAbove))
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow
    setMenu({
      top: openUp ? Math.max(8, box.top - maxHeight - gap) : box.bottom + gap,
      left: box.left,
      width: box.width,
      maxHeight,
    })
  }

  useEffect(() => {
    if (!open) return
    placeMenu()
    setActive(0)
    const id = window.requestAnimationFrame(() => searchRef.current?.focus())
    function onDoc(event: MouseEvent) {
      const target = event.target as Node
      if (wrapRef.current?.contains(target)) return
      if ((event.target as HTMLElement | null)?.closest?.('[data-search-select-menu]')) return
      setOpen(false)
    }
    function onReposition() {
      placeMenu()
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.cancelAnimationFrame(id)
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  function pick(next: string) {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  function onKey(event: KeyboardEvent) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setOpen(true)
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
      if (item) pick(item.value)
    }
  }

  return (
    <div ref={wrapRef} className="relative mt-1.5">
      <input
        tabIndex={-1}
        required={required}
        value={value}
        onChange={() => {}}
        className="pointer-events-none absolute h-px w-px opacity-0"
        aria-hidden
      />
      <button
        type="button"
        disabled={disabled}
        className={`field !mt-0 flex w-full items-center justify-between gap-2 text-left ${value ? 'text-fg' : 'text-muted'}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return
          setQuery('')
          setOpen((current) => !current)
        }}
        onKeyDown={onKey}
      >
        <span className="truncate">{display}</span>
        <span className="text-muted">▾</span>
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-search-select-menu
              id={listId}
              className="fixed z-[95] overflow-hidden rounded-xl border border-line shadow-2xl"
              style={{
                top: menu.top,
                left: menu.left,
                width: menu.width,
                background: 'var(--menu-bg)',
                color: 'var(--fg)',
              }}
            >
              <div className="border-b border-line p-2">
                <input
                  ref={searchRef}
                  className="field !mt-0"
                  placeholder={t('searchOption')}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setActive(0)
                  }}
                  onKeyDown={onKey}
                />
              </div>
              <div className="overflow-y-auto py-1" style={{ maxHeight: menu.maxHeight }}>
                {filtered.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted">{t('noSearchResults')}</div>
                ) : (
                  filtered.map((item, index) => (
                    <button
                      key={`${item.value || 'empty'}-${index}`}
                      type="button"
                      className={`block w-full truncate px-3 py-2 text-left text-sm ${
                        index === active ? 'bg-fill text-mint' : 'text-fg hover:bg-fill'
                      }`}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => pick(item.value)}
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
    </div>
  )
}
