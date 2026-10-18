<script lang="ts">
  // 关于我：磁盘上的 about.md + 主机概览
  import type { Sys } from '../kernel/kernel.ts'
  import { renderMarkdown } from '../kernel/markdown.ts'
  import { formatUptime } from '../kernel/clock.ts'
  import { seededColors } from '../kernel/rng.ts'
  import { PATHS } from '../services/installer.ts'
  import { profile } from '../data/profile.ts'
  import { openApp, getKernelOrNull, onKernelEvent } from '../state.svelte.ts'

  interface Props {
    sys: Sys | null
    arg?: string
    winId: number
  }
  let { sys }: Props = $props()

  let content = $state('')
  let error = $state('')
  let tick = $state(0)
  const [c1, c2] = seededColors(profile.owner)

  function load(): void {
    if (!sys) return
    try {
      content = sys.fs.readText(PATHS.about)
      error = ''
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }

  $effect(() => {
    load()
    const off = onKernelEvent('fs:changed', (p) => {
      if (p.path.includes('about')) load()
    })
    const id = setInterval(() => tick++, 1000)
    return () => {
      off()
      clearInterval(id)
    }
  })

  const html = $derived(renderMarkdown(content))
  const stats = $derived.by(() => {
    tick
    const k = getKernelOrNull()
    if (!k) return { pct: 0, procs: 0, uptime: '-' }
    try {
      const u = k.fs.usage()
      return {
        pct: Math.round((u.used / u.total) * 100),
        procs: k.procs.list().length,
        uptime: formatUptime(k.clock.uptimeMs()),
      }
    } catch {
      return { pct: 0, procs: 0, uptime: '-' }
    }
  })
</script>

<div class="page">
  <div class="hero">
    <div class="avatar" style="background: linear-gradient(135deg, {c1}, {c2})">{profile.owner.slice(0, 1)}</div>
    <div class="meta">
      <div class="name">{profile.owner}</div>
      <div class="dim sub">{profile.hostname} · personal-os v{profile.version}</div>
      <div class="chips">
        <span class="chip">磁盘已用 {stats.pct}%</span>
        <span class="chip">进程 {stats.procs}</span>
        <span class="chip">开机 {stats.uptime}</span>
      </div>
    </div>
    <div class="actions">
      <button class="btn" onclick={() => openApp('projects')}>看项目</button>
      <button class="btn" onclick={() => openApp('contact')}>联系我</button>
    </div>
  </div>

  <div class="scroll">
    {#if error}
      <div class="err mono">{error}</div>
    {:else}
      <div class="md">{@html html}</div>
    {/if}
  </div>
</div>

<style>
  .page {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .hero {
    flex: none;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--stroke);
  }
  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 26px;
    color: #fff;
    flex: none;
    box-shadow: inset 0 2px 8px rgba(255, 255, 255, 0.28), 0 8px 22px rgba(0, 0, 0, 0.3);
  }
  .meta {
    flex: 1;
    min-width: 0;
  }
  .name {
    font-size: 19px;
    font-weight: 650;
  }
  .sub {
    font-size: 12.5px;
  }
  .chips {
    display: flex;
    gap: 7px;
    margin-top: 8px;
    flex-wrap: wrap;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 7px;
    flex: none;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 18px 26px 26px;
  }
  .err {
    color: var(--err);
    font-size: 12.5px;
  }
</style>
