import { useEffect, useMemo, useRef, useState } from 'react'
import { api, apiMessage } from '../api/client'
import { logActivity } from '../api/activity'
import { useAuth } from '../auth'
import { useFeedback } from '../components/feedback'
import { useI18n } from '../i18n'
import type { ApiOk, CalendarHoliday, CalendarPayload, Reminder } from '../types'
import { Clock } from './Clock'
import { onOsFlyout, openOsFlyout } from './osFlyout'

function ymd(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function holidayLabel(item: CalendarHoliday, lang: string) {
  return lang === 'id' ? item.name_id : item.name_en
}

function buildCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

const NOTIFIED_KEY = 'kea_cal_notified'

function readNotified() {
  try {
    const raw = sessionStorage.getItem(NOTIFIED_KEY)
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set<string>()
  }
}

const notified = readNotified()

function markNotified(key: string) {
  notified.add(key)
  sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified]))
}

export function ClockTray() {
  const { t, locale, lang } = useI18n()
  const { me } = useAuth()
  const feedback = useFeedback()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const today = ymd(new Date())
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(today)
  const [holidays, setHolidays] = useState<CalendarHoliday[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [dueReminders, setDueReminders] = useState<Reminder[]>([])
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const currentYear = new Date().getFullYear()
  const cells = useMemo(() => buildCells(year, month), [year, month])

  const holidayMap = useMemo(() => {
    const map = new Map<string, CalendarHoliday[]>()
    for (const item of holidays) {
      const list = map.get(item.date) ?? []
      list.push(item)
      map.set(item.date, list)
    }
    return map
  }, [holidays])

  const reminderMap = useMemo(() => {
    const map = new Map<string, Reminder[]>()
    for (const item of reminders) {
      const list = map.get(item.remind_on) ?? []
      list.push(item)
      map.set(item.remind_on, list)
    }
    return map
  }, [reminders])

  async function loadYear(nextYear: number) {
    const { data } = await api.get<ApiOk<CalendarPayload>>('/calendar', { params: { year: nextYear } })
    setHolidays(data.data.holidays)
    setReminders(data.data.reminders)
    if (nextYear === currentYear) setDueReminders(data.data.reminders)
  }

  useEffect(() => {
    if (!me || !open) return
    void loadYear(year).catch(() => {})
  }, [me?.user.id, year, open])

  useEffect(() => {
    if (open) openOsFlyout('clock')
  }, [open])

  useEffect(() => onOsFlyout('clock', () => setOpen(false)), [])

  useEffect(() => {
    if (!open) return
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const date = ymd(now)
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      for (const item of dueReminders) {
        if (item.remind_on !== date) continue
        const due = item.remind_at ?? '00:00'
        if (due > hhmm) continue
        const key = `${item.id}-${date}-${due}`
        if (notified.has(key)) continue
        markNotified(key)
        feedback.info(`${t('calDue')}: ${item.title}`)
      }
    }
    tick()
    const id = window.setInterval(tick, 30000)
    return () => window.clearInterval(id)
  }, [dueReminders, feedback, t])

  const selectedHolidays = holidayMap.get(selected) ?? []
  const selectedReminders = reminderMap.get(selected) ?? []

  function rememberDue(next: Reminder) {
    if (!next.remind_on.startsWith(String(currentYear))) return
    setDueReminders((current) => [...current.filter((item) => item.id !== next.id), next])
  }

  async function addReminder() {
    if (!title.trim()) return
    setSaving(true)
    try {
      const { data } = await api.post<ApiOk<Reminder>>('/reminders', {
        title: title.trim(),
        remind_on: selected,
        remind_at: time ? time.slice(0, 5) : null,
      })
      setReminders((current) => [...current, data.data].sort((a, b) => a.remind_on.localeCompare(b.remind_on)))
      rememberDue(data.data)
      setTitle('')
      setTime('')
      feedback.success(t('calReminderAdded'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  async function removeReminder(id: number) {
    try {
      await api.delete(`/reminders/${id}`)
      setReminders((current) => current.filter((item) => item.id !== id))
      setDueReminders((current) => current.filter((item) => item.id !== id))
      feedback.success(t('calReminderRemoved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Date(2026, 7, 2 + index).toLocaleDateString(locale, { weekday: 'short' }),
  )

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`os-clock ${open ? 'is-active' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((value) => {
            if (!value) logActivity('open_calendar', 'calendar')
            return !value
          })
        }}
      >
        <Clock />
      </button>

      {open ? (
        <div className="os-calendar" role="dialog" aria-label={t('calReminder')}>
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="os-cal-nav" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label={t('calPrev')}>
              ‹
            </button>
            <button type="button" className="os-cal-title" onClick={() => setCursor(new Date())}>
              {cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
            </button>
            <button type="button" className="os-cal-nav" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label={t('calNext')}>
              ›
            </button>
          </div>

          <div className="os-cal-grid mt-3">
            {weekdays.map((label, index) => (
              <div key={index} className="os-cal-dow">
                {label}
              </div>
            ))}
            {cells.map((date) => {
              const key = ymd(date)
              const outside = date.getMonth() !== month
              const holiday = holidayMap.get(key)
              const hasReminder = (reminderMap.get(key)?.length ?? 0) > 0
              const isNational = holiday?.some((item) => item.kind === 'national')
              const isJoint = holiday?.some((item) => item.kind === 'joint')
              return (
                <button
                  key={key}
                  type="button"
                  className={`os-cal-day${outside ? ' is-outside' : ''}${key === today ? ' is-today' : ''}${key === selected ? ' is-selected' : ''}${isNational ? ' is-holiday' : ''}${date.getDay() === 0 ? ' is-sunday' : ''}`}
                  onClick={() => {
                    setSelected(key)
                    if (outside) setCursor(new Date(date.getFullYear(), date.getMonth(), 1))
                  }}
                >
                  <span>{date.getDate()}</span>
                  <span className="os-cal-dots">
                    {isNational ? <i className="is-national" /> : null}
                    {isJoint ? <i className="is-joint" /> : null}
                    {hasReminder ? <i className="is-note" /> : null}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted">
            <span className="inline-flex items-center gap-1">
              <i className="os-cal-legend is-national" /> {t('calNational')}
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="os-cal-legend is-joint" /> {t('calJoint')}
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="os-cal-legend is-note" /> {t('calReminder')}
            </span>
          </div>

          <div className="os-cal-detail">
            <div className="text-sm font-medium text-fg">
              {new Date(`${selected}T00:00:00`).toLocaleDateString(locale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </div>
            {selectedHolidays.length === 0 && selectedReminders.length === 0 ? (
              <p className="mt-1 text-xs text-muted">{t('calNoEvents')}</p>
            ) : null}
            {selectedHolidays.map((item) => (
              <div key={`${item.date}-${item.name_id}`} className={`os-cal-event ${item.kind === 'joint' ? 'is-joint' : 'is-national'}`}>
                {holidayLabel(item, lang)}
              </div>
            ))}
            {selectedReminders.map((item) => (
              <div key={item.id} className="os-cal-event is-note">
                <span>
                  {item.remind_at ? `${item.remind_at} · ` : ''}
                  {item.title}
                </span>
                <button type="button" onClick={() => void removeReminder(item.id)}>
                  {t('delete')}
                </button>
              </div>
            ))}

            <form
              className="os-cal-form"
              onSubmit={(event) => {
                event.preventDefault()
                void addReminder()
              }}
            >
              <input
                className="os-cal-input"
                placeholder={t('calReminderTitle')}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <div className="os-cal-form-row">
                <input
                  type="time"
                  className="os-cal-input os-cal-time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  aria-label={t('calReminderTime')}
                />
                <button type="submit" disabled={saving || !title.trim()} className="os-cal-add">
                  {t('calAddReminder')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
