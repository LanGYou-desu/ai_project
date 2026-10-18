<script lang="ts">
  // Dock：鸿蒙式胶囊玻璃条。点击已聚焦的应用 = 最小化（macOS 习惯）。
  import {
    system,
    openApp,
    focusWindow,
    minimizeWindow,
    restoreWindow,
    closeWindow,
    openContextMenu,
    toggleLauncher,
  } from '../state.svelte.ts'
  import { APP_MAP, DOCK_PINNED } from '../apps/registry.ts'
  import AppIcon from '../ui/AppIcon.svelte'
  import Glyph from '../ui/Glyph.svelte'

  const running = $derived(new Set(system.wm.windows.map((w) => w.appId)))
  const extraRunning = $derived([...running].filter((id) => !DOCK_PINNED.includes(id) && APP_MAP[id]))
  const items = $derived([...DOCK_PINNED, ...extraRunning])

  function clickApp(appId: string): void {
    const wins = system.wm.windows.filter((w) => w.appId === appId)
    if (wins.length === 0) {
      openApp(appId)
      return
    }
    const top = wins.reduce((a, b) => (a.z > b.z ? a : b))
    if (top.minimized) {
      restoreWindow(top.id)
      return
    }
    if (system.wm.focusId === top.id) {
      minimizeWindow(top.id)
      return
    }
    focusWindow(top.id)
  }

  function appMenu(e: MouseEvent, appId: string): void {
    e.preventDefault()
    e.stopPropagation()
    const wins = system.wm.windows.filter((w) => w.appId === appId)
    openContextMenu(e.clientX, e.clientY, [
      { label: '打开', glyph: 'external', onClick: () => openApp(appId) },
      { label: '新建窗口', glyph: 'plus', onClick: () => openApp(appId) },
      { separator: true },
      {
        label: '关闭窗口',
        glyph: 'x',
        danger: true,
        disabled: wins.length === 0,
        onClick: () => {
          for (const w of [...system.wm.windows]) if (w.appId === appId) closeWindow(w.id)
        },
      },
    ])
  }
</script>

<div class="dock-wrap">
  <div class="dock">
    <button class="item launcher" onclick={() => toggleLauncher()} title="启动器" aria-label="启动器">
      <span class="tile">
        <Glyph name="grid" size={22} stroke={1.6} />
      </span>
      <span class="label">启动器</span>
    </button>

    <div class="divider"></div>

    {#each items as appId (appId)}
      {@const def = APP_MAP[appId]}
      {#if def}
        <button
          class="item"
          class:running={running.has(appId)}
          onclick={() => clickApp(appId)}
          oncontextmenu={(e) => appMenu(e, appId)}
          title={def.title}
        >
          <AppIcon id={def.icon} size={46} />
          {#if running.has(appId)}<span class="dot"></span>{/if}
          <span class="label">{def.title}</span>
        </button>
      {/if}
    {/each}
  </div>
</div>

<style>
  .dock-wrap {
    position: absolute;
    bottom: calc(10px + env(safe-area-inset-bottom, 0px));
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    z-index: 300;
    pointer-events: none;
  }
  .dock {
    position: relative;
    pointer-events: auto;
    display: flex;
    align-items: flex-end;
    gap: 9px;
    padding: 8px 13px;
    border-radius: 24px;
    background: var(--glass-strong);
    backdrop-filter: blur(calc(var(--blur) + 6px)) saturate(1.5);
    -webkit-backdrop-filter: blur(calc(var(--blur) + 6px)) saturate(1.5);
    border: 1px solid var(--stroke);
    box-shadow:
      0 18px 50px rgba(0, 0, 0, 0.42),
      inset 0 1px 0 rgba(255, 255, 255, 0.09),
      inset 0 -16px 30px rgba(0, 0, 0, 0.14);
    max-width: calc(100vw - 14px);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
  /* 顶部玻璃光泽：让胶囊条更有"厚度" */
  .dock::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0) 46%);
    pointer-events: none;
  }
  .dock::-webkit-scrollbar {
    display: none;
  }
  .divider {
    width: 1px;
    align-self: stretch;
    margin: 4px 3px;
    background: var(--stroke);
  }
  .item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 0;
    border: none;
    touch-action: manipulation;
    background: transparent;
    cursor: pointer;
    transition: transform var(--dur-med) cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .item:hover {
    transform: translateY(-6px) scale(1.12);
  }
  .item:active {
    transform: translateY(-2px) scale(1.02);
  }
  /* 邻居联动：悬停时相邻图标也被轻轻抬起（macOS 放大效果的简化版） */
  .item:hover + .item,
  .item:has(+ .item:hover) {
    transform: translateY(-3px) scale(1.05);
  }
  .item .label {
    position: absolute;
    bottom: calc(100% + 12px);
    padding: 3px 10px;
    border-radius: 8px;
    background: var(--glass-strong);
    border: 1px solid var(--stroke);
    backdrop-filter: blur(10px);
    font-size: 12px;
    color: var(--text);
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transform: translateY(4px);
    transition: opacity var(--dur-fast) ease, transform var(--dur-fast) ease;
    box-shadow: var(--shadow-pop);
  }
  .item:hover .label {
    opacity: 1;
    transform: translateY(0);
  }
  .item .dot {
    position: absolute;
    bottom: -5px;
    left: 50%;
    margin-left: -2.5px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 7px var(--accent);
  }
  .tile {
    width: 46px;
    height: 46px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    background: linear-gradient(160deg, #6ea8ff, #7c5cd6);
    border: 1px solid rgba(255, 255, 255, 0.22);
    color: #fff;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 6px 12px rgba(0, 0, 0, 0.28);
  }
  @media (max-width: 700px) {
    .dock {
      gap: 6px;
      padding: 6px 10px;
      border-radius: 20px;
    }
    .dock .item :global(svg) {
      width: 36px;
      height: 36px;
    }
    .tile {
      width: 36px;
      height: 36px;
      border-radius: 11px;
    }
    .item:hover {
      transform: none;
    }
    .item:hover + .item,
    .item:has(+ .item:hover) {
      transform: none;
    }
  }
</style>
