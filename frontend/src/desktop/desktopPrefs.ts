export type DesktopIconPosition = { x: number; y: number }

export type WidgetId = 'clock' | 'store' | 'weather' | 'notes'

export type ClockSkin =
  | 'classic'
  | 'minimal'
  | 'neon'
  | 'flip'
  | 'analog'
  | 'watch'
  | 'wall'
  | 'chrome'

export type StickyNoteColor = 'mint' | 'gold' | 'rose' | 'sky'

export type StickyNote = {
  id: string
  text: string
  color: StickyNoteColor
}

export const WIDGET_IDS: WidgetId[] = ['clock', 'store', 'weather', 'notes']

export const CLOCK_SKINS: ClockSkin[] = [
  'classic',
  'minimal',
  'neon',
  'flip',
  'analog',
  'watch',
  'wall',
  'chrome',
]

export const STICKY_NOTE_COLORS: StickyNoteColor[] = ['mint', 'gold', 'rose', 'sky']

export const MAX_STICKY_NOTES = 12

export type DesktopWidgetsPrefs = {
  hidden: WidgetId[]
  positions: Record<string, DesktopIconPosition>
  clockSkin: ClockSkin
  stickyNotes: StickyNote[]
  /** @deprecated migrated into stickyNotes */
  notesText?: string
  /** @deprecated migrated into stickyNotes */
  notesColor?: StickyNoteColor
  weatherCity: string
}

export type DesktopPreferences = {
  showIcons: boolean
  hiddenApps: string[]
  iconPositions: Record<string, DesktopIconPosition>
  widgets: DesktopWidgetsPrefs
}

/** Vertical slot for tile + two-line label + gap between icons. */
export const DESKTOP_ICON_SLOT_H = 120
export const DESKTOP_ICON_STEP_Y = DESKTOP_ICON_SLOT_H
export const DESKTOP_ICON_SLOT_W = 88
export const DESKTOP_ICON_COL_GAP = 12
export const DESKTOP_TASKBAR_H = 56
export const DESKTOP_ICON_DEFAULT_X = 16
export const DESKTOP_ICON_DEFAULT_Y = 16

function newNoteId() {
  return `n_${Math.random().toString(36).slice(2, 10)}`
}

export function createStickyNote(color: StickyNoteColor = 'mint', text = ''): StickyNote {
  return { id: newNoteId(), text, color }
}

export const DEFAULT_WIDGETS: DesktopWidgetsPrefs = {
  hidden: [],
  positions: {},
  clockSkin: 'classic',
  stickyNotes: [createStickyNote('mint')],
  weatherCity: '',
}

export const DEFAULT_DESKTOP_PREFS: DesktopPreferences = {
  showIcons: true,
  hiddenApps: [],
  iconPositions: {},
  widgets: {
    ...DEFAULT_WIDGETS,
    stickyNotes: [createStickyNote('mint')],
  },
}

const STORAGE_KEY = 'kea_desktop'

export function desktopIconGridMetrics(viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800) {
  const usableH = Math.max(
    DESKTOP_ICON_SLOT_H,
    viewportHeight - DESKTOP_TASKBAR_H - DESKTOP_ICON_DEFAULT_Y - 8,
  )
  const rowsPerCol = Math.max(1, Math.floor(usableH / DESKTOP_ICON_STEP_Y))
  const colStride = DESKTOP_ICON_SLOT_W + DESKTOP_ICON_COL_GAP
  return { rowsPerCol, colStride }
}

export function defaultIconPosition(index: number, viewportHeight?: number): DesktopIconPosition {
  const { rowsPerCol, colStride } = desktopIconGridMetrics(viewportHeight)
  const col = Math.floor(index / rowsPerCol)
  const row = index % rowsPerCol
  return {
    x: DESKTOP_ICON_DEFAULT_X + col * colStride,
    y: DESKTOP_ICON_DEFAULT_Y + row * DESKTOP_ICON_STEP_Y,
  }
}

export function defaultWidgetPosition(id: string): DesktopIconPosition {
  const order = ['clock', 'store', 'weather', 'notes']
  const index = Math.max(0, order.indexOf(id))
  const width = typeof window !== 'undefined' ? window.innerWidth : 1280
  if (id.startsWith('note:')) {
    const noteIndex = Number(id.split(':')[1]?.replace(/\D/g, '') || 0) % 6
    return {
      x: Math.max(16, width - 520 - (noteIndex % 3) * 20),
      y: 40 + noteIndex * 24,
    }
  }
  return {
    x: Math.max(16, width - 300),
    y: 20 + index * 150,
  }
}

export function notePositionKey(noteId: string) {
  return `note:${noteId}`
}

function normalizePosition(value: unknown): DesktopIconPosition | null {
  if (!value || typeof value !== 'object') return null
  const row = value as DesktopIconPosition
  if (typeof row.x !== 'number' || typeof row.y !== 'number') return null
  if (!Number.isFinite(row.x) || !Number.isFinite(row.y)) return null
  return {
    x: Math.max(0, Math.round(row.x)),
    y: Math.max(0, Math.round(row.y)),
  }
}

function normalizeClockSkin(value: unknown): ClockSkin {
  return CLOCK_SKINS.includes(value as ClockSkin) ? (value as ClockSkin) : 'classic'
}

function normalizeNotesColor(value: unknown): StickyNoteColor {
  return STICKY_NOTE_COLORS.includes(value as StickyNoteColor) ? (value as StickyNoteColor) : 'mint'
}

function normalizeStickyNotes(parsed: Partial<DesktopWidgetsPrefs>): StickyNote[] {
  if (Array.isArray(parsed.stickyNotes)) {
    const notes = parsed.stickyNotes
      .filter((item): item is StickyNote => Boolean(item && typeof item === 'object' && typeof (item as StickyNote).id === 'string'))
      .slice(0, MAX_STICKY_NOTES)
      .map((item) => ({
        id: String(item.id).slice(0, 40),
        text: typeof item.text === 'string' ? item.text.slice(0, 2000) : '',
        color: normalizeNotesColor(item.color),
      }))
    if (notes.length > 0) return notes
  }

  const legacyText = typeof parsed.notesText === 'string' ? parsed.notesText : ''
  const legacyColor = normalizeNotesColor(parsed.notesColor)
  return [createStickyNote(legacyColor, legacyText)]
}

export function normalizeWidgetsPrefs(value: unknown): DesktopWidgetsPrefs {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_WIDGETS, stickyNotes: [createStickyNote('mint')] }
  }
  const parsed = value as Partial<DesktopWidgetsPrefs>
  const hidden = Array.isArray(parsed.hidden)
    ? [...new Set(parsed.hidden.filter((item): item is WidgetId => WIDGET_IDS.includes(item as WidgetId)))]
    : []
  const positions: Record<string, DesktopIconPosition> = {}
  if (parsed.positions && typeof parsed.positions === 'object') {
    Object.entries(parsed.positions).forEach(([id, pos]) => {
      const normalized = normalizePosition(pos)
      if (normalized) positions[id] = normalized
    })
  }
  return {
    hidden,
    positions,
    clockSkin: normalizeClockSkin(parsed.clockSkin),
    stickyNotes: normalizeStickyNotes(parsed),
    weatherCity: typeof parsed.weatherCity === 'string' ? parsed.weatherCity.slice(0, 80) : '',
  }
}

export function normalizeDesktopPrefs(value: unknown): DesktopPreferences {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_DESKTOP_PREFS, widgets: { ...DEFAULT_WIDGETS, stickyNotes: [createStickyNote('mint')] } }
  }
  const parsed = value as Partial<DesktopPreferences>
  const hiddenApps = Array.isArray(parsed.hiddenApps)
    ? [...new Set(parsed.hiddenApps.filter((item): item is string => typeof item === 'string' && item.length > 0))]
    : []
  const iconPositions: Record<string, DesktopIconPosition> = {}
  if (parsed.iconPositions && typeof parsed.iconPositions === 'object') {
    Object.entries(parsed.iconPositions).forEach(([id, pos]) => {
      const normalized = normalizePosition(pos)
      if (normalized) iconPositions[id] = normalized
    })
  }
  return {
    showIcons: parsed.showIcons !== false,
    hiddenApps,
    iconPositions,
    widgets: normalizeWidgetsPrefs(parsed.widgets),
  }
}

export function readDesktopPrefs(): DesktopPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return normalizeDesktopPrefs(null)
    return normalizeDesktopPrefs(JSON.parse(raw))
  } catch {
    return normalizeDesktopPrefs(null)
  }
}

export function saveDesktopPrefs(prefs: DesktopPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeDesktopPrefs(prefs)))
}

function positionsOverlap(a: DesktopIconPosition, b: DesktopIconPosition) {
  return (
    Math.abs(a.x - b.x) < DESKTOP_ICON_SLOT_W - 4 &&
    Math.abs(a.y - b.y) < DESKTOP_ICON_SLOT_H - 4
  )
}

function isPositionVisible(pos: DesktopIconPosition, viewportHeight?: number) {
  const vh = viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 800)
  const maxY = vh - DESKTOP_TASKBAR_H - DESKTOP_ICON_SLOT_H - 8
  return pos.y >= 8 && pos.y <= maxY
}

function nextFreeIconPosition(startIndex: number, placed: DesktopIconPosition[], viewportHeight?: number) {
  for (let slot = startIndex; slot < startIndex + 128; slot += 1) {
    const candidate = defaultIconPosition(slot, viewportHeight)
    if (!placed.some((pos) => positionsOverlap(pos, candidate))) return candidate
  }
  return defaultIconPosition(startIndex, viewportHeight)
}

/** Resolve non-overlapping positions for all visible desktop icons. */
export function layoutDesktopIcons(
  appIds: string[],
  prefs: DesktopPreferences,
  viewportHeight?: number,
): Record<string, DesktopIconPosition> {
  const placed: DesktopIconPosition[] = []
  const result: Record<string, DesktopIconPosition> = {}

  appIds.forEach((appId, index) => {
    const saved = prefs.iconPositions[appId]
    let pos = saved ?? defaultIconPosition(index, viewportHeight)
    if (!isPositionVisible(pos, viewportHeight) || placed.some((item) => positionsOverlap(item, pos))) {
      pos = nextFreeIconPosition(index, placed, viewportHeight)
    }
    result[appId] = pos
    placed.push(pos)
  })

  return result
}

export function resolveIconPosition(
  appId: string,
  index: number,
  prefs: DesktopPreferences,
  appIds: string[] = [],
  viewportHeight?: number,
): DesktopIconPosition {
  if (appIds.length > 0) {
    return layoutDesktopIcons(appIds, prefs, viewportHeight)[appId] ?? defaultIconPosition(index, viewportHeight)
  }
  return prefs.iconPositions[appId] ?? defaultIconPosition(index, viewportHeight)
}

export function resolveWidgetPosition(id: string, prefs: DesktopPreferences): DesktopIconPosition {
  return prefs.widgets?.positions?.[id] ?? defaultWidgetPosition(id)
}

export function isDesktopIconVisible(appId: string, prefs: DesktopPreferences) {
  return prefs.showIcons !== false && !(prefs.hiddenApps ?? []).includes(appId)
}

export function isWidgetVisible(id: WidgetId, prefs: DesktopPreferences) {
  return !(prefs.widgets?.hidden ?? []).includes(id)
}
