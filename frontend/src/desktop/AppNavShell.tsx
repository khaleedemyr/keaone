import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { useI18n } from '../i18n'

export type AppNavItem<T extends string> = { id: T; label: string }

export type AppNavGroup<T extends string> = {
  id: string
  label: string
  items: AppNavItem<T>[]
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

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <aside className={`os-app-nav ${visibleGroups.length > 0 ? 'os-app-nav--grouped' : ''}`}>
        {visibleGroups.length > 0
          ? visibleGroups.map((group) => {
              const open = openGroups[group.id] !== false
              return (
                <div key={group.id} className="os-app-nav-group">
                  <button
                    type="button"
                    className="os-app-nav-group-toggle"
                    aria-expanded={open}
                    onClick={() => toggleGroup(group.id)}
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
            })
          : flatItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`os-app-nav-item ${current === item.id ? 'is-active' : ''}`}
                onClick={() => onSelect(item.id)}
              >
                {item.label}
              </button>
            ))}
      </aside>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto p-4">
        {current ? (
          <Suspense fallback={<div className="p-6 text-sm text-muted">{t('loadingWork')}</div>}>
            {children}
          </Suspense>
        ) : (
          <div className="px-1 py-2">
            <h2 className="font-display text-xl font-bold">{t('pickMenu')}</h2>
            <p className="mt-1 max-w-lg text-sm text-muted">{t('pickMenuHint')}</p>
            {visibleGroups.length > 0 ? (
              <div className="mt-4 space-y-5">
                {visibleGroups.map((group) => (
                  <div key={group.id}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</h3>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="os-app-pick"
                          onClick={() => onSelect(item.id)}
                        >
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
                  <button
                    key={item.id}
                    type="button"
                    className="os-app-pick"
                    onClick={() => onSelect(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
