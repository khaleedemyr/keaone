import { useDesktop } from '../DesktopContext'
import { isWidgetVisible } from '../desktopPrefs'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { ClockWidget } from './ClockWidget'
import { StickyNotesWidget } from './StickyNotesWidget'
import { StoreWidget } from './StoreWidget'
import { WeatherWidget } from './WeatherWidget'
import type { WidgetId } from '../desktopPrefs'

const LABELS: Record<WidgetId, 'widgetClock' | 'widgetStore' | 'widgetWeather' | 'widgetNotes'> = {
  clock: 'widgetClock',
  store: 'widgetStore',
  weather: 'widgetWeather',
  notes: 'widgetNotes',
}

export function DesktopWidgetsLayer() {
  const { desktop } = useDesktop()

  return (
    <div className="os-widgets-layer">
      {isWidgetVisible('clock', desktop) ? (
        <ErrorBoundary fallback={null}>
          <ClockWidget />
        </ErrorBoundary>
      ) : null}
      {isWidgetVisible('store', desktop) ? (
        <ErrorBoundary fallback={null}>
          <StoreWidget />
        </ErrorBoundary>
      ) : null}
      {isWidgetVisible('weather', desktop) ? (
        <ErrorBoundary fallback={null}>
          <WeatherWidget />
        </ErrorBoundary>
      ) : null}
      {isWidgetVisible('notes', desktop) ? (
        <ErrorBoundary fallback={null}>
          <StickyNotesWidget />
        </ErrorBoundary>
      ) : null}
    </div>
  )
}

export function widgetLabelKey(id: WidgetId) {
  return LABELS[id]
}

export { WIDGET_IDS } from '../desktopPrefs'
