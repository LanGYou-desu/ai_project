<script lang="ts">
  // 应用图标：macOS 式圆角方瓷砖 + 渐变 + 顶部高光 + 底部景深 + 对角光泽 + 自绘字形
  import { APP_ICONS, DEFAULT_APP_ICON } from './app-icons.ts'

  interface Props {
    id?: string
    size?: number
  }
  let { id = 'unknown', size = 48 }: Props = $props()

  const uid = `ai${Math.random().toString(36).slice(2, 9)}`
  const def = $derived(APP_ICONS[id] ?? DEFAULT_APP_ICON)
  const glyph = $derived(
    def.glyph
      .replace(/~ID~/g, uid)
      .replace(/~C~/g, def.color ?? 'rgba(255,255,255,.96)'),
  )
</script>

<svg class="app-icon" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="{uid}-tile" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color={def.grad[0]} />
      <stop offset="100%" stop-color={def.grad[1]} />
    </linearGradient>
    <linearGradient id="{uid}-sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,.34)" />
      <stop offset="42%" stop-color="rgba(255,255,255,0)" />
    </linearGradient>
    <linearGradient id="{uid}-depth" x1="0" y1="0" x2="0" y2="1">
      <stop offset="52%" stop-color="rgba(0,0,0,0)" />
      <stop offset="100%" stop-color="rgba(0,0,0,.24)" />
    </linearGradient>
    <linearGradient id="{uid}-gloss" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,.22)" />
      <stop offset="36%" stop-color="rgba(255,255,255,0)" />
    </linearGradient>
  </defs>
  <rect x="3" y="3" width="58" height="58" rx="15.5" fill="url(#{uid}-tile)" />
  <rect x="3" y="3" width="58" height="58" rx="15.5" fill="url(#{uid}-depth)" />
  <rect x="3" y="3" width="58" height="58" rx="15.5" fill="url(#{uid}-gloss)" />
  <rect x="3" y="3" width="58" height="58" rx="15.5" fill="url(#{uid}-sheen)" />
  <rect
    x="3.6"
    y="3.6"
    width="56.8"
    height="56.8"
    rx="15"
    fill="none"
    stroke="rgba(255,255,255,.18)"
    stroke-width="1.2"
  />
  {@html glyph}
</svg>

<style>
  .app-icon {
    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.28));
  }
  :global(html[data-theme='glass-light']) .app-icon {
    filter: drop-shadow(0 5px 10px rgba(38, 52, 84, 0.2));
  }
</style>
