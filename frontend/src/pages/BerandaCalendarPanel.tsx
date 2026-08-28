import { useEffect, useMemo, useState } from 'react'
import { api, apiMessage } from '../api/client'
import { useAuth } from '../auth'
import { useFeedback } from '../components/feedback'
import { useI18n } from '../i18n'
import type { ApiOk, CalendarHoliday, CalendarPayload, Reminder } from '../types'

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

export function BerandaCalendarPanel() {
  const { t, locale, lang } = useI18n()
  const { me } = useAuth()
  const feedback = useFeedback()
  const today = ymd(new Date())
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(today)
  const [holidays, setHolidays] = useState<CalendarHoliday[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
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
  }

  useEffect(() => {
    if (!me) return
    void loadYear(year).catch(() => {})
  }, [me?.user.id, year])

  const selectedHolidays = holidayMap.get(selected) ?? []
  const selectedReminders = reminderMap.get(selected) ?? []

  const upcomingReminders = useMemo(() => {
    return reminders
      .filter((item) => item.remind_on >= today)
      .sort((a, b) => {
        const byDate = a.remind_on.localeCompare(b.remind_on)
        if (byDate !== 0) return byDate
        return (a.remind_at ?? '00:00').localeCompare(b.remind_at ?? '00:00')
      })
      .slice(0, 6)
  }, [reminders, today])

  function openDate(dateKey: string) {
    setSelected(dateKey)
    const [y, m] = dateKey.split('-').map(Number)
    if (y && m) setCursor(new Date(y, m - 1, 1))
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
      feedback.success(t('calReminderRemoved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Date(2026, 7, 2 + index).toLocaleDateString(locale, { weekday: 'short' }),
  )

  return (
    <div className="beranda-calendar os-calendar">
      {upcomingReminders.length > 0 ? (
        <div className="beranda-upcoming">
          <div className="beranda-section-title !mb-0">{t('berandaUpcomingReminders')}</div>
          {upcomingReminders.map((item) => (
            <div key={item.id} className="beranda-upcoming-item">
              <button type="button" className="beranda-upcoming-meta text-left" onClick={() => openDate(item.remind_on)}>
                <div className="beranda-upcoming-date">
                  {new Date(`${item.remind_on}T00:00:00`).toLocaleDateString(locale, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  {item.remind_at ? ` · ${item.remind_at.slice(0, 5)}` : ''}
                </div>
                <div className="beranda-upcoming-title">{item.title}</div>
              </button>
              <button type="button" onClick={() => void removeReminder(item.id)}>
                {t('delete')}
              </button>
            </div>
          ))}
        </div>
      ) : null}

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
  )
}
