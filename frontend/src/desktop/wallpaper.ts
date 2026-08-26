export type WallpaperKind = 'preset' | 'image'

export type Wallpaper = {
  kind: WallpaperKind
  id: string
  src?: string
}

export type WallpaperPreset = {
  id: string
  labelKey: 'wpAurora' | 'wpVoid' | 'wpNebula' | 'wpHorizon' | 'wpPaper' | 'wpConsole'
  preview: string
  style: string
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'aurora',
    labelKey: 'wpAurora',
    preview: 'linear-gradient(135deg, #071018 0%, #12352f 48%, #1a1438 100%)',
    style:
      'radial-gradient(1200px 600px at 10% -10%, rgba(62,232,197,.28), transparent 55%), radial-gradient(900px 500px at 110% 0%, rgba(139,108,255,.32), transparent 50%), radial-gradient(700px 400px at 50% 120%, rgba(231,192,122,.14), transparent 45%), #05070c',
  },
  {
    id: 'void',
    labelKey: 'wpVoid',
    preview: 'linear-gradient(180deg, #05070c, #101624)',
    style: 'linear-gradient(180deg, #05070c 0%, #0b1220 100%)',
  },
  {
    id: 'nebula',
    labelKey: 'wpNebula',
    preview: 'linear-gradient(135deg, #1a1030, #8b6cff 40%, #3ee8c5)',
    style:
      'radial-gradient(800px 500px at 20% 20%, rgba(139,108,255,.45), transparent 50%), radial-gradient(700px 480px at 90% 80%, rgba(62,232,197,.28), transparent 50%), #12081f',
  },
  {
    id: 'horizon',
    labelKey: 'wpHorizon',
    preview: 'linear-gradient(180deg, #1b2a4a, #e7c07a)',
    style:
      'linear-gradient(180deg, #0b1630 0%, #1d3b5a 42%, #c9845a 78%, #e7c07a 100%)',
  },
  {
    id: 'paper',
    labelKey: 'wpPaper',
    preview: 'linear-gradient(180deg, #f4f7fb, #d7e2ee)',
    style:
      'radial-gradient(900px 500px at 10% 0%, rgba(16,185,129,.16), transparent 50%), radial-gradient(800px 480px at 100% 100%, rgba(99,102,241,.12), transparent 50%), #e8eef6',
  },
  {
    id: 'console',
    labelKey: 'wpConsole',
    preview: 'linear-gradient(135deg, #04110d, #3ee8c5)',
    style:
      'linear-gradient(rgba(62,232,197,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(62,232,197,.06) 1px, transparent 1px), radial-gradient(900px 500px at 80% 0%, rgba(62,232,197,.2), transparent 50%), #04110d',
  },
]

const STORAGE_KEY = 'kea_wallpaper'

export const DEFAULT_WALLPAPER: Wallpaper = { kind: 'preset', id: 'aurora' }

export function wallpaperCss(wallpaper: Wallpaper): string {
  if (wallpaper.kind === 'image' && wallpaper.src) {
    return `center / cover no-repeat url("${wallpaper.src}")`
  }
  const preset = WALLPAPER_PRESETS.find((item) => item.id === wallpaper.id) ?? WALLPAPER_PRESETS[0]
  return preset.style
}

function isWallpaperSrc(src: string): boolean {
  return (
    src.startsWith('/storage/') ||
    src.startsWith('/media/') ||
    src.startsWith('blob:') ||
    src.startsWith('http://') ||
    src.startsWith('https://')
  )
}

export function normalizeWallpaper(value: unknown): Wallpaper {
  if (!value || typeof value !== 'object') return DEFAULT_WALLPAPER
  const parsed = value as Wallpaper
  if (parsed.kind === 'image' && typeof parsed.src === 'string' && parsed.src.length > 0) {
    if (isWallpaperSrc(parsed.src) && !parsed.src.startsWith('data:')) {
      return { kind: 'image', id: parsed.id || 'custom', src: parsed.src }
    }
  }
  if (parsed.kind === 'preset' && WALLPAPER_PRESETS.some((item) => item.id === parsed.id)) {
    return { kind: 'preset', id: parsed.id }
  }
  return DEFAULT_WALLPAPER
}

export function readWallpaper(): Wallpaper {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WALLPAPER
    return normalizeWallpaper(JSON.parse(raw))
  } catch {
    return DEFAULT_WALLPAPER
  }
}

export function saveWallpaper(wallpaper: Wallpaper) {
  if (wallpaper.src?.startsWith('blob:') || wallpaper.src?.startsWith('data:')) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeWallpaper(wallpaper)))
}

export const WALLPAPER_MAX_BYTES = 20 * 1024 * 1024

export function assertWallpaperFile(file: File) {
  if (file.size > WALLPAPER_MAX_BYTES) {
    throw new Error('too-large')
  }
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('not-image')
  }
}
