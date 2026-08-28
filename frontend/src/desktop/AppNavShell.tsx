import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Suspense } from 'react'
import { useI18n } from '../i18n'
import { useErpSubNavContext, useErpSubNavEffect, type ErpSubNavRegistration } from '../layout/ErpSubNavContext'
import { useErpNavOptional } from '../layout/ErpNavContext'

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
  const erpCtx = useErpSubNavContext()
  const erpMode = Boolean(erpCtx)
  const visibleGroups = useMemo(
    () => (groups ?? []).filter((group) => group.items.length > 0),
    [groups],
  )
  const flatItems = useMemo(
    () => (visibleGroups.length > 0 ? visibleGroups.flatMap((group) => group.items) : (items ?? [])),
    [visibleGroups, items],
  )
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const grouped = visibleGroups.length > 0

  const selectItem = useCallback(
    (id: T) => {
      onSelect(id)
    },
    [onSelect],
  )

  const erpRegistration = useMemo<ErpSubNavRegistration | null>(() => {
    if (!erpMode) return null
    return {
      groups: visibleGroups as AppNavGroup<string>[],
      items: grouped ? [] : (flatItems as AppNavItem<string>[]),
      current,
      onSelect: (id) => selectItem(id as T),
    }
  }, [erpMode, visibleGroups, grouped, flatItems, current, selectItem])

  useErpSubNavEffect(erpRegistration)

  const erpNav = useErpNavOptional()
  useEffect(() => {
    if (!erpMode || !erpNav?.pendingSection) return
    const { sectionId } = erpNav.pendingSection
    if (flatItems.some((item) => item.id === sectionId)) {
      erpNav.clearPendingSection()
      selectItem(sectionId as T)
    }
  }, [erpMode, erpNav, erpNav?.pendingSection, flatItems, selectItem])

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

  if (flatItems.length === 0) {
    return <div className="p-6 text-sm text-muted">{t('emptyMaster')}</div>
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  if (erpMode) {
    if (current) {
      return (
        <Suspense fallback={<div className="p-6 text-sm text-muted">{t('loadingWork')}</div>}>{children}</Suspense>
      )
    }

    return (
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
    )
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {current ? (
            <Suspense fallback={<div className="p-6 text-sm text-muted">{t('loadingWork')}</div>}>{children}</Suspense>
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
