import { useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'

export const MASTER_PER_PAGE = [10, 20, 50, 100] as const

export type StatusOption = { value: string; label: string }

export function useListQuery(initialPerPage = 20, initialStatus = 'all') {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(initialStatus)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [perPage, setPerPage] = useState(initialPerPage)

  function applyMeta(meta?: { last_page?: number; total?: number }, count = 0) {
    const last = meta?.last_page ?? 1
    setLastPage(last)
    setTotal(meta?.total ?? count)
    if (page > last) setPage(last)
  }

  return {
    search,
    status,
    page,
    setPage,
    lastPage,
    total,
    perPage,
    applyMeta,
    filters: {
      search,
      onSearch: (value: string) => {
        setPage(1)
        setSearch(value)
      },
      status,
      onStatus: (value: string) => {
        setPage(1)
        setStatus(value)
      },
      perPage,
      onPerPage: (value: number) => {
        setPage(1)
        setPerPage(value)
      },
    },
  }
}

export function MasterFilters({
  search,
  onSearch,
  searchPlaceholder,
  status,
  onStatus,
  statusOptions,
  hideStatus,
  extra,
  dateFrom,
  dateTo,
  onDateFrom,
  onDateTo,
  perPage,
  onPerPage,
}: {
  search: string
  onSearch: (value: string) => void
  searchPlaceholder: string
  status: string
  onStatus: (value: string) => void
  statusOptions?: StatusOption[]
  hideStatus?: boolean
  extra?: ReactNode
  dateFrom?: string
  dateTo?: string
  onDateFrom?: (value: string) => void
  onDateTo?: (value: string) => void
  perPage: number
  onPerPage: (value: number) => void
}) {
  const { t } = useI18n()
  const options = statusOptions ?? [
    { value: 'all', label: t('filterAll') },
    { value: 'active', label: t('active') },
    { value: 'inactive', label: t('inactive') },
  ]

  return (
    <div className="master-filters mb-4 flex flex-wrap items-end gap-2">
      <input
        className="field !mt-0 max-w-xs"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      {hideStatus ? null : (
        <select className="field !mt-0 max-w-[10rem]" value={status} onChange={(e) => onStatus(e.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      {extra}
      {onDateFrom || onDateTo ? (
        <div className="master-filters-dates">
          {onDateFrom ? (
            <label className="master-filter-field text-sm text-muted">
              {t('stockFrom')}
              <input
                type="date"
                className="field !mt-1"
                value={dateFrom ?? ''}
                max={dateTo || undefined}
                onChange={(e) => onDateFrom(e.target.value)}
              />
            </label>
          ) : null}
          {onDateTo ? (
            <label className="master-filter-field text-sm text-muted">
              {t('stockTo')}
              <input
                type="date"
                className="field !mt-1"
                value={dateTo ?? ''}
                min={dateFrom || undefined}
                onChange={(e) => onDateTo(e.target.value)}
              />
            </label>
          ) : null}
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-sm text-muted">
        {t('perPage')}
        <select className="field !mt-0 w-20" value={perPage} onChange={(e) => onPerPage(Number(e.target.value))}>
          {MASTER_PER_PAGE.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export function MasterPager({
  page,
  lastPage,
  total,
  onPage,
}: {
  page: number
  lastPage: number
  total: number
  onPage: (page: number) => void
}) {
  const { t } = useI18n()

  return (
    <div className="master-pager mt-3 flex items-center justify-between gap-3 text-sm text-muted">
      <span>{t('pagerInfo', { page: String(page), last: String(lastPage), total: String(total) })}</span>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}>
          {t('logsPrev')}
        </button>
        <button type="button" className="btn-ghost" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
          {t('logsNext')}
        </button>
      </div>
    </div>
  )
}
