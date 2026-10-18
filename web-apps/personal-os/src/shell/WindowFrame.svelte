<script lang="ts">
  // 窗口框：交通灯 + 拖拽 + 八向缩放 + 贴边吸附（吸附预览由 Desktop 渲染）
  import {
    system,
    focusWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximize,
    moveWindow,
    resizeWindow,
    snapWindow,
    snapRegionAt,
    openContextMenu,
    getKernelOrNull,
    pushToast,
    sysForWindow,
  } from '../state.svelte.ts'
  import { APP_MAP } from '../apps/registry.ts'
  import { MIN_W, MIN_H, type WinState, type Rect } from '../kernel/wm.ts'
  import Glyph from '../ui/Glyph.svelte'

  interface Props {
    win: WinState
  }
  let { win }: Props = $props()

  const active = $derived(system.wm.focusId === win.id)
  const def = $derived(APP_MAP[win.appId])

  let drag: { px: number; py: number; x: number; y: number } | null = null
  let resize: { dir: string; px: number; py: number; rect: Rect } | null = null

  /** 八向缩放手柄的方向（鼠标热区，不参与键盘导航） */
  const RESIZE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const

  /** 右键标题栏：Windows 式窗口系统菜单 */
  function titleMenu(e: MouseEvent): void {
    e.preventDefault()
    openContextMenu(e.clientX, e.clientY, [
      { label: win.maximized ? '还原窗口' : '最大化', glyph: 'expand', onClick: () => toggleMaximize(win.id) },
      { label: '最小化', glyph: 'minus', onClick: () => minimizeWindow(win.id) },
      { separator: true },
      { label: '关闭窗口', glyph: 'x', danger: true, onClick: () => closeWindow(win.id) },
    ])
  }

  /** 应用崩溃（渲染/副作用抛错）：记内核日志 + 提示，窗口内显示重试面板 */
  function reportAppCrash(error: unknown): void {
    const msg = error instanceof Error ? error.message : String(error)
    getKernelOrNull()?.log.err('app', `${win.appId} 崩溃：${msg}`)
    pushToast({ title: '应用异常', body: `${win.title} 内部出错，已隔离在窗口内`, kind: 'err' })
  }

  function onTitleDown(e: PointerEvent): void {
    if ((e.target as HTMLElement).closest('.tl-group') || (e.target as HTMLElement).closest('.ttl-actions')) {
      return
    }
    focusWindow(win.id)
    if (win.maximized) return
    const el = e.currentTarget as HTMLElement
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* 忽略 */
    }
    drag = { px: e.clientX, py: e.clientY, x: win.rect.x, y: win.rect.y }
    system.dragging = true
  }

  function onTitleMove(e: PointerEvent): void {
    if (!drag) return
    moveWindow(win.id, drag.x + (e.clientX - drag.px), drag.y + (e.clientY - drag.py))
    system.snapHint = snapRegionAt(e.clientX, e.clientY)
  }

  function onTitleUp(e: PointerEvent): void {
    system.dragging = false
    if (!drag) return
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* 忽略 */
    }
    drag = null
    if (system.snapHint) {
      snapWindow(win.id, system.snapHint)
    } else {
      system.snapHint = null
    }
  }

  function onResizeDown(e: PointerEvent, dir: string): void {
    e.stopPropagation()
    focusWindow(win.id)
    const el = e.currentTarget as HTMLElement
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* 忽略 */
    }
    resize = { dir, px: e.clientX, py: e.clientY, rect: { ...win.rect } }
    system.dragging = true
  }

  function onResizeMove(e: PointerEvent): void {
    const r = resize
    if (!r) return
    const dx = e.clientX - r.px
    const dy = e.clientY - r.py
    let { x, y, w, h } = r.rect
    if (r.dir.includes('e')) w = r.rect.w + dx
    if (r.dir.includes('s')) h = r.rect.h + dy
    if (r.dir.includes('w')) {
      x = r.rect.x + dx
      w = r.rect.w - dx
      if (w < MIN_W) {
        x = r.rect.x + r.rect.w - MIN_W
        w = MIN_W
      }
    }
    if (r.dir.includes('n')) {
      y = r.rect.y + dy
      h = r.rect.h - dy
      if (h < MIN_H) {
        y = r.rect.y + r.rect.h - MIN_H
        h = MIN_H
      }
    }
    if (w < MIN_W) w = MIN_W
    if (h < MIN_H) h = MIN_H
    resizeWindow(win.id, { x, y, w, h })
  }

  function onResizeUp(e: PointerEvent): void {
    system.dragging = false
    if (!resize) return
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* 忽略 */
    }
    resize = null
  }
</script>

<div
  class="win"
  class:active
  class:maximized={win.maximized}
  style="left: {win.rect.x}px; top: {win.rect.y}px; width: {win.rect.w}px; height: {win.rect.h}px; z-index: {10 + win.z}; display: {win.minimized ? 'none' : 'flex'};"
  onpointerdown={() => focusWindow(win.id)}
  role="dialog"
  aria-label={win.title}
  tabindex="-1"
>
  <!-- 自绘标题栏（拖拽/双击最大化）；键盘用户可用 Alt+Tab、Dock 与菜单栏操作窗口 -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <header class="titlebar" onpointerdown={onTitleDown} onpointermove={onTitleMove} onpointerup={onTitleUp} onpointercancel={onTitleUp} ondblclick={() => toggleMaximize(win.id)} oncontextmenu={titleMenu}>
    <div class="tl-group">
      <button class="tl-dot close" aria-label="关闭" onclick={(e) => { e.stopPropagation(); closeWindow(win.id) }}>
        <Glyph name="x" size={7} stroke={2.6} />
      </button>
      <button class="tl-dot min" aria-label="最小化" onclick={(e) => { e.stopPropagation(); minimizeWindow(win.id) }}>
        <Glyph name="minus" size={7} stroke={2.6} />
      </button>
      <button class="tl-dot max" aria-label="最大化" onclick={(e) => { e.stopPropagation(); toggleMaximize(win.id) }}>
        <Glyph name="expand" size={7} stroke={2.4} />
      </button>
    </div>
    <div class="title" class:dim={!active}>{win.title}</div>
    <div class="ttl-actions"></div>
  </header>

  <div class="body">
    {#if def}
      {@const Comp = def.component}
      <!-- 崩溃隔离：单个应用出错不至于带走整个桌面 -->
      <svelte:boundary onerror={reportAppCrash}>
        <Comp sys={sysForWindow(win.id)} arg={win.arg} winId={win.id} />
        {#snippet failed(error, reset)}
          <div class="crash">
            <Glyph name="warn" size={26} />
            <div class="crash-title">这个应用崩溃了</div>
            <div class="crash-msg mono">{error instanceof Error ? error.message : String(error)}</div>
            <div class="crash-actions">
              <button class="btn" onclick={reset}>重试</button>
              <button class="btn" onclick={() => closeWindow(win.id)}>关闭窗口</button>
            </div>
          </div>
        {/snippet}
      </svelte:boundary>
    {/if}
  </div>

  {#if !win.maximized}
    {#each RESIZE_DIRS as dir (dir)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="rz {dir}" onpointerdown={(e) => onResizeDown(e, dir)} onpointermove={onResizeMove} onpointerup={onResizeUp} onpointercancel={onResizeUp}></div>
    {/each}
  {/if}
</div>

<style>
  .win {
    position: absolute;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    border-radius: 16px;
    overflow: hidden;
    background: var(--glass-strong);
    backdrop-filter: blur(calc(var(--blur) + 6px)) saturate(1.45);
    -webkit-backdrop-filter: blur(calc(var(--blur) + 6px)) saturate(1.45);
    border: 1px solid var(--stroke);
    box-shadow: 0 10px 34px rgba(0, 0, 0, 0.3);
    animation: po-window-in 0.26s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .win.active {
    border-color: var(--stroke-strong);
    box-shadow: var(--shadow-window), inset 0 1px 0 rgba(255, 255, 255, 0.07);
  }
  .win.maximized {
    border-radius: 0;
  }
  .titlebar {
    flex: none;
    display: grid;
    grid-template-columns: 78px 1fr 78px;
    align-items: center;
    height: 38px;
    padding: 0 12px;
    cursor: default;
    touch-action: none;
    user-select: none;
    border-bottom: 1px solid var(--stroke);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0));
  }
  .win.active .titlebar {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0));
  }
  .tl-group {
    display: flex;
    gap: 8px;
    justify-self: start;
  }
  .title {
    justify-self: center;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .title.dim {
    color: var(--text-dim);
    font-weight: 500;
  }
  .ttl-actions {
    justify-self: end;
    width: 60px;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .rz {
    position: absolute;
    z-index: 3;
    touch-action: none;
  }
  .rz.n {
    top: -3px;
    left: 10px;
    right: 10px;
    height: 7px;
    cursor: ns-resize;
  }
  .rz.s {
    bottom: -3px;
    left: 10px;
    right: 10px;
    height: 7px;
    cursor: ns-resize;
  }
  .rz.e {
    right: -3px;
    top: 10px;
    bottom: 10px;
    width: 7px;
    cursor: ew-resize;
  }
  .rz.w {
    left: -3px;
    top: 10px;
    bottom: 10px;
    width: 7px;
    cursor: ew-resize;
  }
  .rz.ne,
  .rz.nw,
  .rz.se,
  .rz.sw {
    width: 13px;
    height: 13px;
  }
  .rz.ne {
    top: -3px;
    right: -3px;
    cursor: nesw-resize;
  }
  .rz.nw {
    top: -3px;
    left: -3px;
    cursor: nwse-resize;
  }
  .rz.se {
    bottom: -3px;
    right: -3px;
    cursor: nwse-resize;
  }
  .rz.sw {
    bottom: -3px;
    left: -3px;
    cursor: nesw-resize;
  }
  /* 触屏：放大八向缩放手柄，方便手指点中 */
  @media (pointer: coarse) {
    .rz.n,
    .rz.s {
      height: 14px;
    }
    .rz.e,
    .rz.w {
      width: 14px;
    }
    .rz.ne,
    .rz.nw,
    .rz.se,
    .rz.sw {
      width: 22px;
      height: 22px;
    }
  }
  .crash {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 26px;
    text-align: center;
    color: var(--text-dim);
  }
  .crash-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }
  .crash-msg {
    font-size: 12px;
    max-width: 90%;
    overflow-wrap: anywhere;
  }
  .crash-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .crash-actions .btn {
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid var(--stroke);
    background: var(--glass-strong);
    color: var(--text);
    font-size: 12px;
    cursor: pointer;
  }
  .crash-actions .btn:hover {
    border-color: var(--stroke-strong);
  }
</style>
