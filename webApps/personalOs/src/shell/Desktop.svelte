<script lang="ts">
  // 桌面：壁纸、桌面图标、窗口层、Dock、菜单栏、启动器、吸附预览
  import {
    system,
    openApp,
    openPath,
    closeWindow,
    minimizeWindow,
    closeMenus,
    cycleWallpaper,
    toggleTheme,
    toggleLauncher,
    lockScreen,
    openContextMenu,
    getKernelOrNull,
    snapPreviewRect,
    snapWindow,
    toggleMaximize,
    wmDispatch,
    onKernelEvent,
    pushToast,
  } from '../state.svelte.ts'
  import { focusedWindow } from '../kernel/wm.ts'
  import { PATHS } from '../services/installer.ts'
  import { profile } from '../data/profile.ts'
  import { APP_MAP } from '../apps/registry.ts'
  import AppIcon from '../ui/AppIcon.svelte'
  import MenuBar from './MenuBar.svelte'
  import Dock from './Dock.svelte'
  import Launcher from './Launcher.svelte'
  import ContextMenu from './ContextMenu.svelte'
  import Toasts from './Toasts.svelte'
  import WindowFrame from './WindowFrame.svelte'

  interface DeskIcon {
    app: string
    title: string
  }

  let icons = $state<DeskIcon[]>([])
  let selected = $state<string | null>(null)

  function loadIcons(): void {
    const fallback = profile.desktop.map((d) => ({ app: d.app, title: d.title }))
    const k = getKernelOrNull()
    if (!k) {
      icons = fallback
      return
    }
    try {
      const entries = k.fs.readdir(PATHS.desktop)
      const list: DeskIcon[] = []
      for (const e of entries) {
        if (e.type !== 'file' || !e.name.endsWith('.app')) continue
        try {
          const j = JSON.parse(k.fs.readText(PATHS.desktop + '/' + e.name)) as DeskIcon
          if (j.app && APP_MAP[j.app]) list.push({ app: j.app, title: j.title ?? APP_MAP[j.app].title })
        } catch {
          /* 损坏的快捷方式：跳过 */
        }
      }
      icons = list.length > 0 ? list : fallback
    } catch {
      icons = fallback
    }
  }

  $effect(() => {
    loadIcons()
    return onKernelEvent('fs:changed', () => loadIcons())
  })

  function desktopMenu(e: MouseEvent): void {
    const t = e.target as HTMLElement
    if (t.closest('.win') || t.closest('.dock') || t.closest('.menubar')) return
    e.preventDefault()
    openContextMenu(e.clientX, e.clientY, [
      { label: '新建终端窗口', glyph: 'terminal', onClick: () => openApp('terminal') },
      { label: '打开文件管理器', glyph: 'folder', onClick: () => openApp('files') },
      { separator: true },
      { label: '切换壁纸', glyph: 'grid', onClick: cycleWallpaper },
      { label: system.theme === 'glass-dark' ? '切换为亮色主题' : '切换为暗色主题', glyph: 'sun', onClick: toggleTheme },
      { label: '显示启动器', glyph: 'search', onClick: () => toggleLauncher(true) },
      { separator: true },
      { label: '重新加载系统', glyph: 'refresh', onClick: () => location.reload() },
    ])
  }

  function iconMenu(e: MouseEvent, icon: DeskIcon): void {
    e.preventDefault()
    e.stopPropagation()
    openContextMenu(e.clientX, e.clientY, [
      { label: '打开', glyph: 'external', onClick: () => openApp(icon.app) },
      { label: '在文件中显示', glyph: 'folder', onClick: () => openApp('files', PATHS.desktop) },
    ])
  }

  /** 触屏设备：桌面图标单击即打开（双击是桌面系统的习惯，手机上单点更顺手） */
  const COARSE =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false

  // 快捷键对齐 Windows 习惯（取浏览器可拦截的子集；Alt+F4 与 Win 组合被操作系统占用，用近邻键位替代）
  function onKeydown(e: KeyboardEvent): void {
    const k = e.key.toLowerCase()
    if ((e.ctrlKey || e.metaKey) && !e.altKey && k === 'k') {
      e.preventDefault()
      toggleLauncher()
      return
    }
    if (e.key === 'Escape') {
      closeMenus()
      toggleLauncher(false)
      return
    }
    if (e.key === 'F1') {
      e.preventDefault()
      openApp('about')
      return
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'Tab') {
      // 同 Windows：Alt+Tab 切换窗口，加 Shift 反向
      e.preventDefault()
      wmDispatch({ type: 'cycle-focus', dir: e.shiftKey ? -1 : 1 })
      return
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey && (k === 'w' || k === 'm')) {
      // Alt+W 关窗 / Alt+M 最小化
      const f = focusedWindow(system.wm)
      if (!f) return
      e.preventDefault()
      if (k === 'w') closeWindow(f.id)
      else minimizeWindow(f.id)
      return
    }
    if (e.ctrlKey && e.altKey) {
      const f = focusedWindow(system.wm)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // 同 Windows 的 Win+左/右：贴左半屏 / 贴右半屏
        if (!f) return
        e.preventDefault()
        snapWindow(f.id, e.key === 'ArrowLeft' ? 'left' : 'right')
        return
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // 同 Windows 的 Win+上/下：最大化 / 还原（未最大化则最小化）
        if (!f) return
        e.preventDefault()
        if (e.key === 'ArrowUp') {
          if (!f.maximized) toggleMaximize(f.id)
        } else if (f.maximized) {
          toggleMaximize(f.id)
        } else {
          minimizeWindow(f.id)
        }
        return
      }
      if (k === 'd') {
        // 同 Windows 的 Win+D：显示桌面；再按一次恢复
        e.preventDefault()
        const anyVisible = system.wm.windows.some((w) => !w.minimized)
        wmDispatch({ type: anyVisible ? 'minimize-all' : 'restore-all' })
        return
      }
      if (k === 'l') {
        // 同 Windows 的 Win+L：锁定屏幕（Win 键被系统占用，改用 Ctrl+Alt+L）
        e.preventDefault()
        lockScreen()
      }
    }
  }

  function emptyClick(e: PointerEvent): void {
    const t = e.target as HTMLElement
    if (!t.closest('.desk-icon')) selected = null
  }

  // 触屏去重：双击序列里的第二次点击不再打开（500ms 窗口内同图标只开一次）
  let lastTap = { app: '', at: 0 }
  function tapOpen(appId: string): void {
    if (!COARSE) return
    const now = Date.now()
    if (lastTap.app === appId && now - lastTap.at < 500) return
    lastTap = { app: appId, at: now }
    openApp(appId)
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="desktop" oncontextmenu={desktopMenu} onpointerdown={emptyClick} role="presentation">
  <MenuBar />

  <div class="icons">
    {#each icons as icon (icon.app + icon.title)}
      <button
        class="desk-icon"
        class:sel={selected === icon.title}
        ondblclick={() => {
          if (!COARSE) openApp(icon.app)
        }}
        onclick={() => tapOpen(icon.app)}
        onpointerdown={(e) => {
          if ((e.target as HTMLElement).closest('button')) selected = icon.title
        }}
        oncontextmenu={(e) => iconMenu(e, icon)}
        title={icon.title}
      >
        <AppIcon id={icon.app} size={54} />
        <span class="label">{icon.title}</span>
      </button>
    {/each}
  </div>

  <div class="windows" class:dragging={system.dragging}>
    {#each system.wm.windows as win (win.id)}
      <WindowFrame {win} />
    {/each}
  </div>

  {#if system.snapHint}
    {@const rect = snapPreviewRect(system.snapHint)}
    <div
      class="snap-preview"
      style="left: {rect.x}px; top: {rect.y}px; width: {rect.w}px; height: {rect.h}px;"
    ></div>
  {/if}

  <Dock />
  <Launcher />
  <ContextMenu />
  <Toasts />
</div>

<style>
  .desktop {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }
  .icons {
    position: absolute;
    top: calc(48px + env(safe-area-inset-top, 0px));
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 5;
  }
  .desk-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    width: 88px;
    padding: 9px 4px 7px;
    touch-action: manipulation;
    border: none;
    border-radius: 12px;
    background: transparent;
    cursor: default;
    transition: background var(--dur-fast) ease;
  }
  .desk-icon:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .desk-icon.sel {
    background: var(--accent-soft);
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  .desk-icon .label {
    font-size: 12px;
    color: #fff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.65);
    max-width: 84px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(html[data-theme='glass-light']) .desk-icon .label {
    color: #1b2334;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.7);
  }
  .windows {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .windows :global(.win) {
    pointer-events: auto;
  }
  /* 拖拽/缩放期间降载：暂停毛玻璃，并把位移动画交给合成器 */
  .windows.dragging :global(.win) {
    will-change: left, top, width, height;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .snap-preview {
    position: absolute;
    z-index: 8;
    border-radius: 14px;
    background: var(--accent-soft);
    border: 2px solid var(--accent);
    transition: all 0.12s ease-out;
    pointer-events: none;
  }
  @media (max-width: 700px) {
    .icons {
      top: calc(42px + env(safe-area-inset-top, 0px));
      right: 8px;
      gap: 4px;
    }
    .desk-icon {
      width: 78px;
      padding: 7px 4px 6px;
    }
    .desk-icon :global(svg) {
      width: 46px;
      height: 46px;
    }
    .desk-icon .label {
      font-size: 11.5px;
      max-width: 74px;
    }
  }
</style>
