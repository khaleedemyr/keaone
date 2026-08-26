import { wallpaperCss, type Wallpaper } from './wallpaper'

export function WallpaperLayer({ wallpaper }: { wallpaper: Wallpaper }) {
  if (wallpaper.kind === 'image' && wallpaper.src) {
    return (
      <img
        className="os-wallpaper-img"
        src={wallpaper.src}
        alt=""
        decoding="async"
        fetchPriority="high"
      />
    )
  }

  return <div className="os-wallpaper" style={{ background: wallpaperCss(wallpaper) }} />
}
