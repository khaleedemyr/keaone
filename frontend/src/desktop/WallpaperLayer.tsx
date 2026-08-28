import { wallpaperCss, type Wallpaper } from './wallpaper'

export function WallpaperLayer({ wallpaper }: { wallpaper: Wallpaper }) {
  return <div className="os-wallpaper" style={{ background: wallpaperCss(wallpaper) }} aria-hidden />
}
