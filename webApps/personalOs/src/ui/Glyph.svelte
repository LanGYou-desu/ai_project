<script lang="ts">
  // 线描图标：24x24、currentColor、圆头线帽（macOS / HarmonyOS 风格）
  import { GLYPHS } from './glyphs.ts'

  interface Props {
    name: string
    size?: number
    stroke?: number
  }
  let { name, size = 18, stroke = 1.7 }: Props = $props()

  const inner = $derived(GLYPHS[name] ?? '')
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>{@html inner}</svg>
