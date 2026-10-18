// 主题服务：玻璃拟态（暗/亮），壁纸预设
export type ThemeName = 'glass-dark' | 'glass-light'

export const WALLPAPERS = ['aurora', 'dusk', 'deep', 'mono'] as const
export type WallpaperName = (typeof WALLPAPERS)[number]

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme
}

export function applyWallpaper(wallpaper: string): void {
  document.documentElement.dataset.wallpaper = wallpaper
}

export function isThemeName(v: string): v is ThemeName {
  return v === 'glass-dark' || v === 'glass-light'
}

export function isWallpaperName(v: string): v is WallpaperName {
  return (WALLPAPERS as readonly string[]).includes(v)
}
