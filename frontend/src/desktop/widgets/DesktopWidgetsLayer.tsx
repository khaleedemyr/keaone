import { useDesktop } from '../DesktopContext'
import { WIDGET_IDS, isWidgetVisible, type WidgetId } from '../desktopPrefs'
import { ClockWidget } from './ClockWidget'
import { StickyNotesWidget } from './StickyNotesWidget'
import { StoreWidget } from './StoreWidget'
import { WeatherWidget } from './WeatherWidget'

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
      {isWidgetVisible('clock', desktop) ? <ClockWidget /> : null}
      {isWidgetVisible('store', desktop) ? <StoreWidget /> : null}
      {isWidgetVisible('weather', desktop) ? <WeatherWidget /> : null}
      {isWidgetVisible('notes', desktop) ? <StickyNotesWidget /> : null}
    </div>
  )
}

export function widgetLabelKey(id: WidgetId) {
  return LABELS[id]
}

export { WIDGET_IDS }
