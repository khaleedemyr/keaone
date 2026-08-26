import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n'
import type { SearchSelectOption } from './SearchSelect'

export function SearchMultiSelect({
  values,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  disabled = false,
}: {
  values: string[]
  onChange: (values: string[]) => void
  options: SearchSelectOption[]
  placeholder: string
  searchPlaceholder?: string
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

  const selected = useMemo(
    () => options.filter((item) => values.includes(item.value)),
    [options, values],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options.filter((item) => {
      if (!q) return true
      const hay = `${item.label} ${item.keywords ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [options, query])

  function placeMenu() {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return
    const gap = 6
    const spaceBelow = window.innerHeight - box.bottom - 12
    const spaceAbove = box.top - 12
    const maxHeight = Math.min(280, Math.max(140, spaceBelow >= 160 ? spaceBelow : spaceAbove))
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
      if ((event.target as HTMLElement | null)?.closest?.('[data-search-multi-menu]')) return
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

  function toggle(value: string) {
    if (values.includes(value)) onChange(values.filter((row) => row !== value))
    else onChange([...values, value])
  }

  function remove(value: string) {
    onChange(values.filter((row) => row !== value))
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
      if (item) toggle(item.value)
    }
  }

  return (
    <div ref={wrapRef} className="relative mt-1.5">
      <button
        type="button"
        disabled={disabled}
        className={`field !mt-0 flex min-h-[42px] w-full flex-wrap items-center gap-1.5 text-left ${
          selected.length ? 'text-fg' : 'text-muted'
        }`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return
          setQuery('')
          setOpen((current) => !current)
        }}
        onKeyDown={onKey}
      >
        {selected.length === 0 ? (
          <span className="truncate">{placeholder}</span>
        ) : (
          selected.map((item) => (
            <span
              key={item.value}
              className="inline-flex max-w-full items-center gap-1 rounded-lg bg-fill px-2 py-0.5 text-xs text-fg"
            >
              <span className="truncate">{item.label}</span>
              <span
                role="button"
                tabIndex={-1}
                className="text-muted hover:text-rose-300"
                onClick={(event) => {
                  event.stopPropagation()
                  remove(item.value)
                }}
              >
                ×
              </span>
            </span>
          ))
        )}
        <span className="ml-auto text-muted">▾</span>
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-search-multi-menu
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
                  placeholder={searchPlaceholder ?? t('searchOption')}
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
                  filtered.map((item, index) => {
                    const checked = values.includes(item.value)
                    return (
                      <button
                        key={item.value}
                        type="button"
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                          index === active ? 'bg-fill text-mint' : 'text-fg hover:bg-fill'
                        }`}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => toggle(item.value)}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                            checked ? 'border-mint bg-mint text-ink' : 'border-line text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
