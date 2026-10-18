<script lang="ts">
  // 任务管理器：窗口即进程。可查看调用速率、结束进程。
  import type { Sys } from '../kernel/kernel.ts'
  import type { ProcInfo } from '../kernel/proc.ts'
  import { getKernelOrNull, onKernelEvent } from '../state.svelte.ts'
  import { formatUptime } from '../kernel/clock.ts'
  import { fmtSize } from '../kernel/terminal/commands.ts'
  import { APP_MAP } from '../apps/registry.ts'
  import Glyph from '../ui/Glyph.svelte'

  interface Props {
    sys: Sys | null
    arg?: string
    winId: number
  }
  let { sys }: Props = $props()

  let procs = $state<ProcInfo[]>([])
  let tick = $state(0)
  let selected = $state<number | null>(null)

  $effect(() => {
    if (!sys) return
    const refresh = () => {
      procs = sys.procs.list()
    }
    refresh()
    const off = onKernelEvent('proc:changed', refresh)
    const id = setInterval(() => {
      tick++
      refresh()
    }, 1000)
    return () => {
      off()
      clearInterval(id)
    }
  })

  const stats = $derived.by(() => {
    tick
    const k = getKernelOrNull()
    if (!k) return null
    try {
      const u = k.fs.usage()
      return {
        uptime: formatUptime(k.clock.uptimeMs()),
        disk: `${fmtSize(u.used * 512)} / ${fmtSize(u.total * 512)}`,
        writes: k.dev.writes,
        suspended: procs.filter((p) => p.state === 'suspended').length,
      }
    } catch {
      return null
    }
  })

  const liveRate = (p: ProcInfo): number => p.rate * Math.exp(-Math.max(0, Date.now() - p.rateAt) / 1500)

  const uptimeOf = (p: ProcInfo): string => formatUptime(Date.now() - p.startedAt)

  function kill(pid: number): void {
    if (!sys) return
    if (pid === sys.pid) {
      sys.notify('提示', '不能结束任务管理器自己（关掉窗口即可）。', 'warn')
      return
    }
    sys.procs.exit(pid)
  }
</script>

<div class="page">
  <div class="head">
    <div class="summary">
      <span class="chip">进程 {procs.length}</span>
      {#if stats}
        <span class="chip">挂起 {stats.suspended}</span>
        <span class="chip">磁盘 {stats.disk}</span>
        <span class="chip">写 {stats.writes}</span>
        <span class="chip">开机 {stats.uptime}</span>
      {/if}
    </div>
  </div>

  <div class="table">
    <div class="th">
      <span class="c pid">PID</span>
      <span class="c app">应用</span>
      <span class="c title">标题</span>
      <span class="c state">状态</span>
      <span class="c num">调用</span>
      <span class="c num">速率</span>
      <span class="c num">运行</span>
      <span class="c act"></span>
    </div>
    {#each procs as p (p.pid)}
      <div
        class="tr"
        class:sel={selected === p.pid}
        class:me={sys && p.pid === sys.pid}
        onclick={() => (selected = p.pid)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') selected = p.pid
        }}
        role="button"
        tabindex="0"
      >
        <span class="c pid mono">{p.pid}</span>
        <span class="c app">{APP_MAP[p.appId]?.title ?? p.appId}</span>
        <span class="c title dim">{p.title}</span>
        <span class="c state">
          {#if p.state === 'running'}
            <span class="dot ok-dot"></span>运行
          {:else}
            <span class="dot suspend-dot"></span>挂起
          {/if}
        </span>
        <span class="c num mono">{p.calls}</span>
        <span class="c num mono">{liveRate(p).toFixed(1)}/s</span>
        <span class="c num mono">{uptimeOf(p)}</span>
        <span class="c act">
          <button class="btn-ico" onclick={(e) => { e.stopPropagation(); kill(p.pid) }} aria-label="结束进程 {p.pid}">
            <Glyph name="x" size={12} />
          </button>
        </span>
      </div>
    {/each}
    {#if procs.length === 0}
      <div class="dim empty">没有运行的进程</div>
    {/if}
  </div>

  <div class="foot dim">
    每个窗口都是一个进程；结束进程会立即关闭对应窗口。挂起的窗口不消耗调用速率。
  </div>
</div>

<style>
  .page {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 12px 16px 10px;
    gap: 10px;
  }
  .summary {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
  }
  .table {
    flex: 1;
    min-height: 0;
    overflow: auto;
    border: 1px solid var(--stroke);
    border-radius: 13px;
  }
  .th,
  .tr {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    font-size: 12px;
    min-width: 640px;
  }
  .th {
    position: sticky;
    top: 0;
    background: var(--glass-strong);
    backdrop-filter: blur(10px);
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--stroke);
    z-index: 1;
  }
  .tr {
    border-bottom: 1px solid var(--stroke);
    cursor: default;
  }
  .tr:hover {
    background: var(--glass-soft);
  }
  .tr.sel {
    background: var(--accent-soft);
  }
  .tr.me .app {
    color: var(--accent);
  }
  .c {
    flex: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pid {
    width: 42px;
  }
  .app {
    width: 96px;
  }
  .title {
    flex: 1;
    min-width: 0;
  }
  .state {
    width: 64px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .num {
    width: 66px;
    text-align: right;
  }
  .act {
    width: 30px;
    display: flex;
    justify-content: center;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .ok-dot {
    background: var(--ok);
  }
  .suspend-dot {
    background: var(--warn);
  }
  .empty {
    padding: 26px;
    text-align: center;
    font-size: 12.5px;
  }
  .foot {
    flex: none;
    font-size: 11.5px;
  }
</style>
