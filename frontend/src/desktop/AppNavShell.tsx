import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Suspense } from 'react'
import { useI18n } from '../i18n'

export type AppNavItem<T extends string> = { id: T; label: string }

export type AppNavGroup<T extends string> = {
  id: string
  label: string
  items: AppNavItem<T>[]
}

function NavGroups<T extends string>({
  groups,
  current,
  openGroups,
  onToggleGroup,
  onSelect,
}: {
  groups: AppNavGroup<T>[]
  current: T | null
  openGroups: Record<string, boolean>
  onToggleGroup: (groupId: string) => void
  onSelect: (id: T) => void
}) {
  return (
    <>
      {groups.map((group) => {
        const open = openGroups[group.id] !== false
        return (
          <div key={group.id} className="os-app-nav-group">
            <button
              type="button"
              className="os-app-nav-group-toggle"
              aria-expanded={open}
              onClick={() => onToggleGroup(group.id)}
            >
              <span>{group.label}</span>
              <span className="os-app-nav-group-caret" aria-hidden>
                {open ? '▾' : '▸'}
              </span>
            </button>
            {open
              ? group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`os-app-nav-item ${current === item.id ? 'is-active' : ''}`}
                    onClick={() => onSelect(item.id)}
                  >
                    {item.label}
                  </button>
                ))
              : null}
          </div>
        )
      })}
    </>
  )
}

function NavFlat<T extends string>({
  items,
  current,
  onSelect,
}: {
  items: AppNavItem<T>[]
  current: T | null
  onSelect: (id: T) => void
}) {
  return (
    <>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`os-app-nav-item ${current === item.id ? 'is-active' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </>
  )
}

export function AppNavShell<T extends string>({
  items,
  groups,
  current,
  onSelect,
  children,
}: {
  items?: AppNavItem<T>[]
  groups?: AppNavGroup<T>[]
  current: T | null
  onSelect: (id: T) => void
  children: ReactNode
}) {
  const { t } = useI18n()
  const visibleGroups = useMemo(
    () => (groups ?? []).filter((group) => group.items.length > 0),
    [groups],
  )
  const flatItems = useMemo(
    () => (visibleGroups.length > 0 ? visibleGroups.flatMap((group) => group.items) : (items ?? [])),
    [visibleGroups, items],
  )
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const grouped = visibleGroups.length > 0
  const currentLabel = flatItems.find((item) => item.id === current)?.label ?? t('pickMenu')

  useEffect(() => {
    if (visibleGroups.length === 0) return
    setOpenGroups((prev) => {
      const next = { ...prev }
      let changed = false
      visibleGroups.forEach((group) => {
        if (next[group.id] === undefined) {
          next[group.id] = true
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [visibleGroups])

  useEffect(() => {
    if (!current || visibleGroups.length === 0) return
    const activeGroup = visibleGroups.find((group) => group.items.some((item) => item.id === current))
    if (!activeGroup) return
    setOpenGroups((prev) => (prev[activeGroup.id] ? prev : { ...prev, [activeGroup.id]: true }))
  }, [current, visibleGroups])

  useEffect(() => {
    if (!mobileNavOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileNavOpen])

  if (flatItems.length === 0) {
    return <div className="p-6 text-sm text-muted">{t('emptyMaster')}</div>
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  function selectItem(id: T) {
    onSelect(id)
    setMobileNavOpen(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <aside className={`os-app-nav hidden md:flex ${grouped ? 'os-app-nav--grouped' : ''}`}>
        {grouped ? (
          <NavGroups
            groups={visibleGroups}
            current={current}
            openGroups={openGroups}
            onToggleGroup={toggleGroup}
            onSelect={selectItem}
          />
        ) : (
          <NavFlat items={flatItems} current={current} onSelect={selectItem} />
        )}
      </aside>

      {mobileNavOpen ? (
        <>
          <button
            type="button"
            className="os-app-nav-mobile-backdrop md:hidden"
            aria-label={t('close')}
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="os-app-nav-mobile-sheet md:hidden" role="dialog" aria-label={t('pickMenu')}>
            <div className="os-app-nav-mobile-sheet-head">
              <div className="text-sm font-semibold text-fg">{t('pickMenu')}</div>
              <button type="button" className="os-notify-clear" onClick={() => setMobileNavOpen(false)}>
                {t('close')}
              </button>
            </div>
            <div className={`os-app-nav os-app-nav-mobile-list ${grouped ? 'os-app-nav--grouped' : ''}`}>
              {grouped ? (
                <NavGroups
                  groups={visibleGroups}
                  current={current}
                  openGroups={openGroups}
                  onToggleGroup={toggleGroup}
                  onSelect={selectItem}
                />
              ) : (
                <NavFlat items={flatItems} current={current} onSelect={selectItem} />
              )}
            </div>
          </div>
        </>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {current ? (
          <div className="os-app-nav-mobile-bar md:hidden">
            <button type="button" className="os-app-nav-mobile-trigger" onClick={() => setMobileNavOpen(true)}>
              <span className="os-app-nav-mobile-kicker">{t('pickMenu')}</span>
              <span className="os-app-nav-mobile-label">{currentLabel}</span>
              <svg viewBox="0 0 24 24" className="os-app-nav-mobile-chevron" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {current ? (
            <Suspense fallback={<div className="p-6 text-sm text-muted">{t('loadingWork')}</div>}>
              {children}
            </Suspense>
          ) : (
            <div className="px-1 py-2">
              <h2 className="font-display text-xl font-bold">{t('pickMenu')}</h2>
              <p className="mt-1 max-w-lg text-sm text-muted">{t('pickMenuHint')}</p>
              {grouped ? (
                <div className="mt-4 space-y-5">
                  {visibleGroups.map((group) => (
                    <div key={group.id}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</h3>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {group.items.map((item) => (
                          <button key={item.id} type="button" className="os-app-pick" onClick={() => selectItem(item.id)}>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {flatItems.map((item) => (
                    <button key={item.id} type="button" className="os-app-pick" onClick={() => selectItem(item.id)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
