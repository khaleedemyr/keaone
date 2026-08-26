import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import { useDesktop } from '../DesktopContext'
import { CLOCK_SKINS, type ClockSkin } from '../desktopPrefs'
import { WidgetFrame } from './WidgetFrame'

function RealAnalogFace({
  now,
  skin,
}: {
  now: Date
  skin: 'analog' | 'watch' | 'wall' | 'chrome'
}) {
  const hours = now.getHours() % 12
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()
  const hourDeg = hours * 30 + minutes * 0.5
  const minuteDeg = minutes * 6 + seconds * 0.1
  const secondDeg = seconds * 6

  return (
    <div className={`os-clock-real is-${skin}`} aria-hidden>
      <div className="os-clock-real-bezel">
        <div className="os-clock-real-face">
          <div className="os-clock-real-ring" />
          {Array.from({ length: 60 }, (_, i) => (
            <span
              key={i}
              className={`os-clock-tick${i % 5 === 0 ? ' is-hour' : ''}`}
              style={{ transform: `rotate(${i * 6}deg)` }}
            />
          ))}
          {skin === 'wall' || skin === 'watch'
            ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                <span
                  key={n}
                  className="os-clock-num"
                  style={{ transform: `rotate(${n * 30}deg)` }}
                >
                  <i style={{ transform: `rotate(${-n * 30}deg)` }}>{n}</i>
                </span>
              ))
            : null}
          <i className="os-clock-hand is-hour" style={{ transform: `rotate(${hourDeg}deg)` }} />
          <i className="os-clock-hand is-minute" style={{ transform: `rotate(${minuteDeg}deg)` }} />
          <i className="os-clock-hand is-second" style={{ transform: `rotate(${secondDeg}deg)` }} />
          <i className="os-clock-pivot" />
        </div>
      </div>
    </div>
  )
}

function FlipDigits({ value }: { value: string }) {
  return (
    <div className="os-clock-flip" aria-hidden>
      {value.split('').map((ch, index) =>
        ch === ':' ? (
          <span key={`c-${index}`} className="os-clock-flip-colon">
            :
          </span>
        ) : (
          <span key={`${index}-${ch}`} className="os-clock-flip-digit">
            {ch}
          </span>
        ),
      )}
    </div>
  )
}

const REAL_SKINS: ClockSkin[] = ['analog', 'watch', 'wall', 'chrome']

export function ClockWidget() {
  const { t, locale } = useI18n()
  const { desktop, patchWidgets } = useDesktop()
  const skin = desktop.widgets.clockSkin
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const hhmm = useMemo(
    () =>
      now.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    [now, locale],
  )
  const dateLine = useMemo(
    () =>
      now.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [now, locale],
  )

  function setSkin(next: ClockSkin) {
    patchWidgets({ clockSkin: next })
  }

  const isReal = REAL_SKINS.includes(skin)

  return (
    <WidgetFrame
      id="clock"
      title={t('widgetClock')}
      width={isReal ? 220 : 300}
      variant="bare"
      hideWidgetId="clock"
      className={`os-widget-clock is-${skin}`}
    >
      <div className="os-clock-face-wrap">
        {isReal ? (
          <>
            <RealAnalogFace now={now} skin={skin as 'analog' | 'watch' | 'wall' | 'chrome'} />
            <div className="os-clock-date is-soft">{dateLine}</div>
          </>
        ) : skin === 'flip' ? (
          <>
            <FlipDigits value={hhmm} />
            <div className="os-clock-date is-soft">{dateLine}</div>
          </>
        ) : (
          <div className={`os-clock-face is-${skin}`}>
            <div className="os-clock-time">{hhmm}</div>
            <div className="os-clock-date">{dateLine}</div>
          </div>
        )}
      </div>
      <div className="os-clock-skins os-widget-nodrag">
        {CLOCK_SKINS.map((item) => (
          <button
            key={item}
            type="button"
            className={item === skin ? 'is-active' : ''}
            onClick={() => setSkin(item)}
            title={t(`widgetClockSkin_${item}` as 'widgetClockSkin_classic')}
          />
        ))}
      </div>
    </WidgetFrame>
  )
}
