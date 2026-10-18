<script lang="ts">
  // 菜单栏：Logo 菜单 + 应用菜单 + 状态区（磁盘活动 / 主题 / 搜索 / 时钟）
  import {
    system,
    getKernelOrNull,
    openApp,
    openContextMenu,
    toggleLauncher,
    toggleTheme,
    cycleWallpaper,
    shutdownSystem,
    rebootSystem,
    lockScreen,
    pushToast,
    refreshUsage,
    closeWindow,
    minimizeWindow,
    toggleMaximize,
  } from '../state.svelte.ts'
  import { focusedWindow } from '../kernel/wm.ts'
  import Glyph from '../ui/Glyph.svelte'
  import type { MenuItem } from '../state.svelte.ts'

  let now = $state(new Date())
  let lastWrite = $state(0)
  let tick = $state(0)

  $effect(() => {
    const id = setInterval(() => {
      now = new Date()
      tick++
    }, 1000)
    return () => clearInterval(id)
  })

  $effect(() => {
    const w = system.diskWrites
    if (w > 0) lastWrite = Date.now()
  })

  const busy = $derived.by(() => {
    tick
    return Date.now() - lastWrite < 1500
  })

  const focused = $derived(focusedWindow(system.wm))
  const appTitle = $derived(focused ? focused.title : '桌面')

  const time = $derived(now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
  const day = $derived(now.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' }))

  function drop(e: MouseEvent, items: MenuItem[]): void {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    openContextMenu(Math.round(r.left), Math.round(r.bottom + 6), items)
  }

  function logoMenu(e: MouseEvent): void {
    drop(e, [
      { label: '关于本机', glyph: 'info', onClick: () => openApp('settings') },
      { label: '系统设置', glyph: 'gear', onClick: () => openApp('settings') },
      { separator: true },
      {
        label: '立即同步磁盘',
        glyph: 'save',
        onClick: () => {
          const k = getKernelOrNull()
          if (!k) return
          void k.flush().then(() => {
            refreshUsage()
            pushToast({ title: '磁盘已同步', body: '内存盘已写回磁盘镜像。', kind: 'ok' })
          })
        },
      },
      { label: '切换壁纸', glyph: 'grid', onClick: cycleWallpaper },
      { label: '切换主题', glyph: 'sun', onClick: toggleTheme },
      { separator: true },
      { label: '锁定屏幕', glyph: 'lock', onClick: lockScreen },
      { label: '重启…', glyph: 'refresh', onClick: rebootSystem },
      { label: '关机…', glyph: 'power', danger: true, onClick: () => void shutdownSystem() },
    ])
  }

  function appMenu(e: MouseEvent): void {
    const f = focused
    if (!f) return
    drop(e, [
      { label: '最小化', glyph: 'minus', onClick: () => minimizeWindow(f.id) },
      {
        label: f.maximized ? '还原窗口' : '最大化',
        glyph: 'expand',
        onClick: () => toggleMaximize(f.id),
      },
      { separator: true },
      { label: '关闭窗口', glyph: 'x', danger: true, onClick: () => closeWindow(f.id) },
    ])
  }

  function fileMenu(e: MouseEvent): void {
    drop(e, [
      { label: '新建终端窗口', glyph: 'terminal', onClick: () => openApp('terminal') },
      { label: '打开文件管理器', glyph: 'folder', onClick: () => openApp('files') },
      { separator: true },
      {
        label: '关闭全部窗口',
        glyph: 'x',
        danger: true,
        disabled: system.wm.windows.length === 0,
        onClick: () => {
          for (const w of [...system.wm.windows]) closeWindow(w.id)
        },
      },
    ])
  }

  function viewMenu(e: MouseEvent): void {
    drop(e, [
      { label: '显示启动器', glyph: 'search', onClick: () => toggleLauncher(true) },
      { separator: true },
      { label: '切换主题', glyph: 'sun', onClick: toggleTheme },
      { label: '切换壁纸', glyph: 'grid', onClick: cycleWallpaper },
    ])
  }
</script>

<div class="menubar">
  <button class="mb-logo" onclick={logoMenu} aria-label="系统菜单">
    <svg width="17" height="17" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="mb-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#6ea8ff" />
          <stop offset="1" stop-color="#7c5cd6" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="58" height="58" rx="15" fill="url(#mb-logo-g)" />
      <rect x="15" y="18" width="34" height="28" rx="6" fill="rgba(9,13,24,.55)" />
      <path d="M21 28l5 4-5 4" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M30 37h9" stroke="#fff" stroke-width="3.4" stroke-linecap="round" />
    </svg>
  </button>

  <button class="mb-item strong" onclick={appMenu}>{appTitle}</button>
  <button class="mb-item" onclick={fileMenu}>文件</button>
  <button class="mb-item" onclick={viewMenu}>视图</button>

  <div class="space"></div>

  <span class="led" class:busy={busy} title="磁盘写入活动" aria-label="磁盘写入活动"></span>

  {#if system.conflict}
    <button
      class="mb-icon warn"
      aria-label="磁盘冲突"
      onclick={() =>
        pushToast({
          title: '磁盘冲突',
          body: '另一个标签页修改了磁盘镜像，自动保存已暂停。',
          kind: 'err',
          action: 'reload',
        })}
    >
      <Glyph name="warn" size={15} />
    </button>
  {/if}

  <button class="mb-icon" onclick={toggleTheme} aria-label="切换主题">
    <Glyph name={system.theme === 'glass-dark' ? 'sun' : 'moon'} size={15} />
  </button>

  <button class="mb-icon" onclick={() => toggleLauncher()} aria-label="搜索">
    <Glyph name="search" size={15} />
  </button>

  <button
    class="mb-item clock mono"
    onclick={() =>
      pushToast({
        title: day,
        body: `本机时间 ${now.toLocaleTimeString('zh-CN', { hour12: false })}`,
        kind: 'info',
      })}
  >
    {day} {time}
  </button>
</div>

<style>
  .menubar {
    position: absolute;
    top: env(safe-area-inset-top, 0px);
    left: 0;
    right: 0;
    height: 34px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 calc(10px + env(safe-area-inset-right, 0px)) 0 calc(10px + env(safe-area-inset-left, 0px));
    z-index: 400;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 72%), var(--glass);
    backdrop-filter: blur(var(--blur)) saturate(1.4);
    -webkit-backdrop-filter: blur(var(--blur)) saturate(1.4);
    border-bottom: 1px solid var(--stroke);
    user-select: none;
  }
  @media (max-width: 760px) {
    .menubar {
      height: 30px;
      padding: 0 calc(8px + env(safe-area-inset-right, 0px)) 0 calc(8px + env(safe-area-inset-left, 0px));
    }
  }
  @media (max-width: 480px) {
    .mb-item:not(.strong):not(.clock) {
      display: none;
    }
    .mb-item.strong {
      max-width: 88px;
    }
    .mb-item.clock {
      font-size: 11px;
      padding: 0 6px;
    }
  }
  .mb-logo {
    display: grid;
    place-items: center;
    width: 26px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: 7px;
    cursor: pointer;
  }
  .mb-logo:hover {
    background: var(--glass-soft);
  }
  .mb-item {
    height: 24px;
    padding: 0 9px;
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 12.5px;
    border-radius: 7px;
    cursor: pointer;
    white-space: nowrap;
  }
  .mb-item:hover {
    background: var(--glass-hover);
  }
  .mb-item.strong {
    font-weight: 600;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mb-item.clock {
    font-size: 12px;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
  .space {
    flex: 1;
  }
  .mb-icon {
    display: grid;
    place-items: center;
    width: 26px;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--text-dim);
    border-radius: 7px;
    cursor: pointer;
  }
  .mb-icon:hover {
    background: var(--glass-hover);
    color: var(--text);
  }
  .mb-icon.warn {
    color: var(--warn);
  }
  .led {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--stroke-strong);
    margin: 0 7px;
    transition: background 0.2s ease, box-shadow 0.2s ease;
  }
  .led.busy {
    background: var(--ok);
    box-shadow: 0 0 8px var(--ok);
  }
</style>
