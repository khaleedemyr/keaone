import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { filterErpSearchEntries, type ErpSearchEntry } from './erpNavSearch'

export function ErpSidebarSearch({
  entries,
  collapsed,
  onSelect,
}: {
  entries: ErpSearchEntry[]
  collapsed: boolean
  onSelect: (entry: ErpSearchEntry) => void
}) {
  const { t } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const results = filterErpSearchEntries(entries, query)
  const showResults = open && (query.trim().length > 0 || results.length > 0)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function pick(entry: ErpSearchEntry) {
    onSelect(entry)
    setQuery('')
    setOpen(false)
  }

  function openSearch() {
    setOpen(true)
    queueMicrotask(() => inputRef.current?.focus())
  }

  if (collapsed) {
    return (
      <div ref={rootRef} className="erp-sidebar-search is-collapsed">
        <button
          type="button"
          className="erp-sidebar-search-toggle"
          aria-label={t('erpSearchMenu')}
          onClick={() => (open ? setOpen(false) : openSearch())}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </button>
        {open ? (
          <div className="erp-sidebar-search-popover">
            <input
              ref={inputRef}
              className="erp-sidebar-search-input"
              placeholder={t('erpSearchMenuPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <SearchResults results={results} query={query} onPick={pick} />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={rootRef} className="erp-sidebar-search">
      <div className="erp-sidebar-search-field">
        <svg viewBox="0 0 24 24" className="erp-sidebar-search-icon" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          className="erp-sidebar-search-input"
          placeholder={t('erpSearchMenuPlaceholder')}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
        />
      </div>
      {showResults ? (
        <div className="erp-sidebar-search-results">
          <SearchResults results={results} query={query} onPick={pick} />
        </div>
      ) : null}
    </div>
  )
}

function SearchResults({
  results,
  query,
  onPick,
}: {
  results: ErpSearchEntry[]
  query: string
  onPick: (entry: ErpSearchEntry) => void
}) {
  const { t } = useI18n()

  if (results.length === 0) {
    return <div className="erp-sidebar-search-empty">{t('erpSearchNoResults')}</div>
  }

  return (
    <ul className="erp-sidebar-search-list">
      {results.map((entry) => (
        <li key={entry.id}>
          <button type="button" className="erp-sidebar-search-item" onClick={() => onPick(entry)}>
            <span className="erp-sidebar-search-item-label">{entry.label}</span>
            {entry.sectionId ? (
              <span className="erp-sidebar-search-item-meta">{entry.breadcrumb}</span>
            ) : query.trim() ? (
              <span className="erp-sidebar-search-item-meta">{entry.appLabel}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  )
}
