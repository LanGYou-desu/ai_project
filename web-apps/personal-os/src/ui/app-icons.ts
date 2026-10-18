// 应用图标库（自绘 SVG，macOS 式圆角方 + 渐变 + 白色字形）
// 每个图标 = 64x64 圆角底板 + 顶部高光 + 字形。
// 模板中的 ~ID~ 会被替换为唯一的渐变 id；~C~ 是字形主色；~G~ 指向底板渐变（用于“镂空”效果）。

export interface AppIconDef {
  /** 渐变起止色 */
  grad: [string, string]
  /** 字形（在 64x64 画布中央） */
  glyph: string
  /** 字形主色（默认白色） */
  color?: string
}

export const APP_ICONS: Record<string, AppIconDef> = {
  about: {
    grad: ['#6aa6ff', '#2f56e6'],
    glyph: `
      <circle cx="32" cy="24" r="7.6" fill="~C~"/>
      <path d="M32 36.6c8.9 0 15.2 5.2 16.7 13.4a1.55 1.55 0 0 1-1.55 1.85H16.85a1.55 1.55 0 0 1-1.55-1.85C16.8 41.8 23.1 36.6 32 36.6Z" fill="~C~"/>`,
  },
  projects: {
    grad: ['#b18cff', '#6d3df0'],
    glyph: `
      <rect x="13.5" y="23" width="37" height="23" rx="5.5" fill="~C~"/>
      <path d="M25.5 23v-3.4a3.4 3.4 0 0 1 3.4-3.4h6.2a3.4 3.4 0 0 1 3.4 3.4V23" fill="none" stroke="~C~" stroke-width="3.6"/>
      <rect x="29.4" y="31" width="5.2" height="5.2" rx="1.6" fill="rgba(58,28,140,.55)"/>`,
  },
  contact: {
    grad: ['#52e0c4', '#1ba98e'],
    glyph: `
      <rect x="13" y="20.5" width="38" height="24.5" rx="5" fill="~C~"/>
      <path d="M15.8 23.8 32 35.2l16.2-11.4" fill="none" stroke="rgba(9,88,76,.48)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  files: {
    grad: ['#59b6ff', '#2470f2'],
    glyph: `
      <path d="M12.5 22a4 4 0 0 1 4-4h8.1c1 0 2 .4 2.7 1.1l2 2.4h17.7a4 4 0 0 1 4 4V43a4 4 0 0 1-4 4h-30.5a4 4 0 0 1-4-4Z" fill="~C~"/>
      <rect x="12.5" y="37.6" width="39" height="3" fill="rgba(18,58,140,.18)"/>`,
  },
  terminal: {
    grad: ['#3d4657', '#171c28'],
    glyph: `
      <rect x="12.5" y="16.5" width="39" height="31" rx="7" fill="rgba(5,8,14,.62)"/>
      <path d="M20.5 26.6l6.4 5.2-6.4 5.2" fill="none" stroke="#8df0bb" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M31.5 37.4h12" stroke="#8df0bb" stroke-width="3.2" stroke-linecap="round"/>`,
  },
  music: {
    grad: ['#ff7d9c', '#e0396b'],
    glyph: `
      <ellipse cx="29" cy="40" rx="6.4" ry="4.8" transform="rotate(-18 29 40)" fill="~C~"/>
      <path d="M34.7 39V14.6" stroke="~C~" stroke-width="4.4" stroke-linecap="round"/>
      <path d="M34.7 14.6c2.7.6 6.9 2.3 6.9 6.8 0 2.3-1.3 4-2.7 5 .7-2.5.3-4.8-1.3-6.3-1-1-2-1.5-2.9-1.9Z" fill="~C~"/>`,
  },
  settings: {
    grad: ['#a6b3c9', '#68789a'],
    glyph: `
      <circle cx="32" cy="32" r="8.9" fill="none" stroke="~C~" stroke-width="5.6"/>
      <g stroke="~C~" stroke-width="6" stroke-linecap="round">
        <path d="M40.9 32h4.4M36.2 38.2l3.1 3.1M32 40.9v4.4M27.8 38.2l-3.1 3.1M23.1 32h-4.4M27.8 25.8l-3.1-3.1M32 23.1v-4.4M36.2 25.8l3.1-3.1"/>
      </g>
      <circle cx="32" cy="32" r="3.5" fill="~G~"/>`.replace(/~G~/g, 'url(#~ID~-tile)'),
  },
  taskmgr: {
    grad: ['#ffc063', '#f28b1f'],
    glyph: `
      <rect x="18.5" y="30" width="5.6" height="15" rx="2.8" fill="~C~"/>
      <rect x="29.2" y="20.5" width="5.6" height="24.5" rx="2.8" fill="~C~"/>
      <rect x="39.9" y="26.5" width="5.6" height="18.5" rx="2.8" fill="~C~"/>`,
  },
  notepad: {
    grad: ['#ffffff', '#c9d5ea'],
    color: '#4a5c7d',
    glyph: `
      <path d="M20.5 11.5h15.3l8.2 8.2v31.2a2.6 2.6 0 0 1-2.6 2.6h-21a2.6 2.6 0 0 1-2.6-2.6v-36.8a2.6 2.6 0 0 1 2.6-2.6Z" fill="#ffffff"/>
      <path d="M35.8 11.5l8.2 8.2h-8.2Z" fill="rgba(120,140,175,.5)"/>
      <g stroke="rgba(74,92,125,.62)" stroke-width="2.6" stroke-linecap="round">
        <path d="M24 28.5h16M24 34.5h16M24 40.5h10"/>
      </g>`,
  },
}

export const DEFAULT_APP_ICON: AppIconDef = {
  grad: ['#8e9bb3', '#5d6b85'],
  glyph: `<circle cx="32" cy="32" r="12" fill="none" stroke="~C~" stroke-width="5"/>`,
}
