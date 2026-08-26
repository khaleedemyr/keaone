import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'

export function Clock() {
  const { locale } = useI18n()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <span className="block px-2 text-right text-[11px] leading-tight">
      <span className="block font-medium text-fg">
        {now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="block text-muted">
        {now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
      </span>
    </span>
  )
}
