import { useEffect, useMemo, useState } from 'react'
import { api, apiMessage } from '../api/client'
import { useAuth } from '../auth'
import { useFeedback } from '../components/feedback'
import { useI18n } from '../i18n'
import type { ApiOk, CalendarPayload, Reminder } from '../types'

function ymd(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function BerandaRemindersPanel() {
  const { t } = useI18n()
  const { me } = useAuth()
  const feedback = useFeedback()
  const today = ymd(new Date())
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!me) return
    const year = new Date().getFullYear()
    void (async () => {
      try {
        const [current, next] = await Promise.all([
          api.get<ApiOk<CalendarPayload>>('/calendar', { params: { year } }),
          api.get<ApiOk<CalendarPayload>>('/calendar', { params: { year: year + 1 } }),
        ])
        const merged = [...current.data.data.reminders, ...next.data.data.reminders]
        const seen = new Set<number>()
        setReminders(merged.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true))))
      } catch {
        /* ignore */
      }
    })()
  }, [me?.user.id])

  const upcomingReminders = useMemo(() => {
    return reminders
      .filter((item) => item.remind_on >= today)
      .sort((a, b) => {
        const byDate = a.remind_on.localeCompare(b.remind_on)
        if (byDate !== 0) return byDate
        return (a.remind_at ?? '00:00').localeCompare(b.remind_at ?? '00:00')
      })
  }, [reminders, today])

  async function addReminder() {
    if (!title.trim()) return
    setSaving(true)
    try {
      const { data } = await api.post<ApiOk<Reminder>>('/reminders', {
        title: title.trim(),
        remind_on: date,
        remind_at: time ? time.slice(0, 5) : null,
      })
      setReminders((current) => [...current, data.data].sort((a, b) => a.remind_on.localeCompare(b.remind_on)))
      setTitle('')
      setTime('')
      setDate(today)
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

  return (
    <div className="beranda-reminders">
      {upcomingReminders.length > 0 ? (
        <div className="beranda-upcoming">
          {upcomingReminders.map((item) => (
            <div key={item.id} className="beranda-upcoming-item">
              <div className="beranda-upcoming-meta">
                <div className="beranda-upcoming-title">
                  {item.remind_at ? `${item.remind_at.slice(0, 5)} · ` : ''}
                  {item.title}
                </div>
              </div>
              <button type="button" onClick={() => void removeReminder(item.id)}>
                {t('delete')}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="beranda-reminders-empty">{t('berandaRemindersEmpty')}</p>
      )}

      <form
        className="beranda-reminder-form"
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
        <div className="beranda-reminder-form-row">
          <input
            type="date"
            className="os-cal-input"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-label={t('berandaReminderDate')}
          />
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
  )
}
