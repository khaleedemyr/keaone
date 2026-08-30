import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n'
import type { SearchSelectOption } from './SearchSelect'

export function AutocompleteSelect({
  options,
  placeholder,
  onSelect,
  disabled = false,
  className = '',
  minChars = 1,
  maxResults = 10,
}: {
  options: SearchSelectOption[]
  placeholder: string
  onSelect: (value: string) => void
  disabled?: boolean
  className?: string
  minChars?: number
  maxResults?: number
}) {
  const { t } = useI18n()
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [menu, setMenu] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < minChars) return []

    return options
      .filter((item) => {
        const hay = `${item.label} ${item.keywords ?? ''}`.toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, maxResults)
  }, [maxResults, minChars, options, query])

  const showMenu = open && query.trim().length >= minChars

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
    if (!showMenu) return
    placeMenu()
    setActive(0)
    function onDoc(event: MouseEvent) {
      const target = event.target as Node
      if (wrapRef.current?.contains(target)) return
      if ((event.target as HTMLElement | null)?.closest?.('[data-autocomplete-menu]')) return
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

  function pick(next: string) {
    onSelect(next)
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (!showMenu) {
      if (event.key === 'ArrowDown' && filtered.length > 0) {
        event.preventDefault()
        setOpen(true)
        setActive(0)
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
    <div ref={wrapRef} className={`relative ${className.includes('!mt-0') ? '' : 'mt-1.5'} ${className}`}>
      <input
        ref={inputRef}
        type="search"
        disabled={disabled}
        className="field !mt-0"
        placeholder={placeholder}
        value={query}
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
      {showMenu && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-autocomplete-menu
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
                      className={`block w-full truncate px-3 py-2 text-left text-sm ${
                        index === active ? 'bg-fill text-mint' : 'text-fg hover:bg-fill'
                      }`}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => event.preventDefault()}
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
