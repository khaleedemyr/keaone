import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { useDesktop } from '../DesktopContext'
import { WeatherIcon } from './WeatherIcon'
import { WidgetFrame } from './WidgetFrame'

type WeatherState = {
  temp: number
  code: number
  humidity: number
  place: string
} | null

const WMO: Record<number, string> = {
  0: 'clear',
  1: 'mainlyClear',
  2: 'partly',
  3: 'overcast',
  45: 'fog',
  48: 'fog',
  51: 'drizzle',
  61: 'rain',
  63: 'rain',
  65: 'rain',
  71: 'snow',
  80: 'rain',
  95: 'thunder',
}

function weatherKey(code: number) {
  return WMO[code] ?? (code >= 50 && code < 70 ? 'rain' : code >= 70 && code < 80 ? 'snow' : 'partly')
}

async function resolveCoords(city: string): Promise<{ lat: number; lon: number; place: string } | null> {
  if (city.trim()) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=1&language=id&format=json`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      results?: { name: string; country?: string; latitude: number; longitude: number }[]
    }
    const hit = data.results?.[0]
    if (!hit) return null
    return {
      lat: hit.latitude,
      lon: hit.longitude,
      place: hit.country ? `${hit.name}, ${hit.country}` : hit.name,
    }
  }

  const geo = await new Promise<GeolocationPosition | null>((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { timeout: 8000 },
    )
  })

  if (geo) {
    return { lat: geo.coords.latitude, lon: geo.coords.longitude, place: '' }
  }

  return { lat: -6.2088, lon: 106.8456, place: 'Jakarta' }
}

export function WeatherWidget() {
  const { t } = useI18n()
  const { desktop, patchWidgets } = useDesktop()
  const [weather, setWeather] = useState<WeatherState>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [cityDraft, setCityDraft] = useState(desktop.widgets?.weatherCity ?? '')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const coords = await resolveCoords(desktop.widgets?.weatherCity ?? '')
        if (!coords || cancelled) return
        const place = coords.place || desktop.widgets?.weatherCity || t('widgetWeatherNear')
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`
        const res = await fetch(url)
        if (!res.ok) throw new Error('weather')
        const data = (await res.json()) as {
          current: { temperature_2m: number; relative_humidity_2m: number; weather_code: number }
        }
        if (cancelled) return
        setWeather({
          temp: Math.round(data.current.temperature_2m),
          humidity: data.current.relative_humidity_2m,
          code: data.current.weather_code,
          place,
        })
      } catch {
        if (!cancelled) setWeather(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const id = window.setInterval(() => void load(), 15 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [desktop.widgets?.weatherCity, t])

  const condition = weather ? weatherKey(weather.code) : 'partly'

  return (
    <WidgetFrame id="weather" title={t('widgetWeather')} width={280} variant="glass" hideWidgetId="weather" className={`os-widget-weather is-${condition}`}>
      {loading ? (
        <div className="os-widget-muted">{t('loadingWait')}</div>
      ) : weather ? (
        <div className="os-weather-hero">
          <WeatherIcon kind={condition} className="os-weather-glyph" />
          <div className="os-weather-copy">
            <div className="os-weather-temp">
              {weather.temp}
              <span>°</span>
            </div>
            <div className="os-weather-cond">{t(`widgetWeather_${condition}` as 'widgetWeather_clear')}</div>
            <div className="os-weather-meta">
              {weather.place}
              <span aria-hidden> · </span>
              {weather.humidity}%
            </div>
          </div>
        </div>
      ) : (
        <div className="os-widget-muted">{t('widgetWeatherFailed')}</div>
      )}

      {editing ? (
        <form
          className="os-weather-form os-widget-nodrag"
          onSubmit={(event) => {
            event.preventDefault()
            patchWidgets({ weatherCity: cityDraft.trim() })
            setEditing(false)
          }}
        >
          <input
            className="os-weather-input"
            value={cityDraft}
            onChange={(event) => setCityDraft(event.target.value)}
            placeholder={t('widgetWeatherCity')}
          />
          <button type="submit" className="os-weather-save">
            {t('save')}
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="os-weather-edit os-widget-nodrag"
          onClick={() => {
            setCityDraft(desktop.widgets?.weatherCity ?? '')
            setEditing(true)
          }}
        >
          {t('widgetWeatherSetCity')}
        </button>
      )}
    </WidgetFrame>
  )
}
