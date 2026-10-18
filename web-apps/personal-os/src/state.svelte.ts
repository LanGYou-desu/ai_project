// 系统状态编排：桌面环境的“守护进程”
//  - 开机自检 -> 内核引导 -> 装机 -> 会话恢复 -> 进入桌面
//  - 窗口守护：wm 纯函数状态 + 进程表同步 + URL 深链 + 会话自动保存
import { Kernel, type Sys } from './kernel/kernel.ts'
import { buildHash, parseHash } from './kernel/router.ts'
import {
  initialWm,
  wmReduce,
  focusedWindow,
  detectSnapRegion,
  snapRect,
  type Rect,
  type SnapRegion,
  type Viewport,
  type WmAction,
} from './kernel/wm.ts'
import { resolvePersister } from './drivers/disk-http.ts'
import { WebAudioDriver } from './drivers/audio.ts'
import { installSeed, HOME } from './services/installer.ts'
import type { KernelEvents } from './kernel/events.ts'
import {
  loadSession,
  saveSessionLocal,
  SESSION_PATH,
  type SessionData,
} from './services/session.ts'
import { applyTheme, applyWallpaper } from './services/theme.ts'
import { APP_MAP } from './apps/registry.ts'

export const MENUBAR_H = 34

export type Phase = 'boot' | 'login' | 'desktop' | 'shutting-down' | 'off'
export type ToastKind = 'info' | 'ok' | 'warn' | 'err'

export interface BootLine {
  text: string
  cls?: string
}

export interface Toast {
  id: number
  title: string
  body?: string
  kind: ToastKind
  action: 'reload' | 'none'
  at: number
}

export interface MenuItem {
  label?: string
  glyph?: string
  danger?: boolean
  disabled?: boolean
  separator?: boolean
  onClick?: () => void
}

export interface CtxMenuState {
  x: number
  y: number
  items: MenuItem[]
}

export const system = $state({
  phase: 'boot' as Phase,
  bootLines: [] as BootLine[],
  bootSkipped: false,
  theme: 'glass-dark' as 'glass-dark' | 'glass-light',
  wallpaper: 'aurora' as string,
  wm: initialWm,
  toasts: [] as Toast[],
  launcher: false,
  launcherQuery: '',
  ctxMenu: null as CtxMenuState | null,
  snapHint: null as SnapRegion | null,
  diskMode: 'memory',
  diskReady: false,
  conflict: false,
  diskWrites: 0,
  usage: { used: 0, total: 512, free: 512, files: 0, dirs: 0 },
  mobile: false,
  autoLogin: false,
  onboarded: false,
  locked: false,
  /** 拖拽/缩放窗口期间为 true：用于降载（暂停毛玻璃、提示合成器） */
  dragging: false,
  showStats: false,
})

// —— 非响应式句柄 ——

let _kernel: Kernel | null = null
let _audio: WebAudioDriver | null = null
let bootPromise: Promise<void> | null = null

const pidByWindow = new Map<number, number>()
const windowByPid = new Map<number, number>()
const sysByWindow = new Map<number, Sys>()

export function getKernel(): Kernel {
  if (!_kernel) throw new Error('内核尚未启动')
  return _kernel
}

export function getKernelOrNull(): Kernel | null {
  return _kernel
}

export function getAudio(): WebAudioDriver | null {
  return _audio
}

export function sysForWindow(windowId: number): Sys | null {
  return sysByWindow.get(windowId) ?? null
}

export function windowIdForPid(pid: number): number | undefined {
  return windowByPid.get(pid)
}

// —— 工具 ——

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function bootLine(text: string, cls?: string): void {
  system.bootLines.push({ text, cls })
}

async function pushBoot(text: string, cls?: string, delay = 110): Promise<void> {
  bootLine(text, cls)
  if (!system.bootSkipped) await sleep(delay)
}

export function skipBoot(): void {
  system.bootSkipped = true
}

export function viewport(): Viewport {
  const w = window.innerWidth
  const h = window.innerHeight
  return { w, h, top: (w < 760 ? 30 : MENUBAR_H) + safeAreaTop() }
}

// —— 安全区（刘海屏 / 圆角屏）：读取 env(safe-area-inset-top)，旋转时重算 ——

let _safeTop = -1

export function safeAreaTop(): number {
  if (_safeTop >= 0) return _safeTop
  if (typeof document === 'undefined' || !document.body) return 0
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  _safeTop = Math.round(probe.getBoundingClientRect().height)
  probe.remove()
  return _safeTop
}

/** 视口变化后把窗口拉回屏内：最大化窗口跟随新视口，浮动窗口限制尺寸与位置 */
export function reflowWindows(): void {
  system.wm = wmReduce(system.wm, { type: 'reflow', viewport: viewport() })
  scheduleSessionSave()
}

// —— 启动 ——

export function bootSystem(): Promise<void> {
  if (!bootPromise) bootPromise = doBoot()
  return bootPromise
}

async function doBoot(): Promise<void> {
  applyTheme(system.theme)
  applyWallpaper(system.wallpaper)
  setupViewportListener()

  await pushBoot('personal-os 固件 v0.1.0 —— 自检中', 'dim', 240)
  const audioOk = typeof window !== 'undefined' && 'AudioContext' in window
  await pushBoot(`POST：键盘 ok · 显示 ok · 音频 ${audioOk ? 'ok' : '不可用（静音模式）'}`, 'dim')
  const persister = await resolvePersister()
  await pushBoot(
    `磁盘控制器：${persister.kind === 'http' ? '伙伴服务器（disk/disk.img）' : persister.kind === 'static' ? '静态降级（本地暂存）' : '内存盘'}`,
    'dim',
    60,
  )

  const notes: string[] = []
  const kernel = await Kernel.boot(persister, notes)
  _kernel = kernel
  for (const n of notes) await pushBoot(n, '', 70)

  if (kernel.freshInstall || !kernel.fs.exists(HOME)) {
    await pushBoot('首次装机：写入发行内容…', 'accent', 80)
    const report = installSeed(kernel.fs, Date.now())
    await kernel.flush()
    await pushBoot(`装机完成：${report.files} 个文件 / ${report.dirs} 个目录`, 'ok')
  }

  // 会话
  const session = safeLoadSession(kernel)
  system.theme = session.theme
  system.wallpaper = session.wallpaper
  system.autoLogin = session.autoLogin
  system.onboarded = session.onboarded
  applyTheme(session.theme)
  applyWallpaper(session.wallpaper)

  // 音频驱动
  _audio = new WebAudioDriver()
  kernel.audio = _audio

  system.diskMode = kernel.persister.kind
  system.diskReady = true
  system.conflict = kernel.conflict
  updateUsage()
  wireBus(kernel)

  // 恢复窗口布局
  for (const w of session.windows) {
    openAppAt(w.appId, w.arg, { x: w.x, y: w.y, w: w.w, h: w.h }, { minimized: w.minimized, maximized: w.maximized })
  }
  // 深链优先
  const route = parseHash(location.hash)
  if (route.kind === 'app' && route.appId) {
    openApp(route.appId, route.arg)
  } else if (session.focusApp) {
    focusAppWindow(session.focusApp)
  } else if (session.windows.length === 0) {
    // 首次开机的空桌面：自动打开「关于我」，让访客直接看到内容
    openApp('about')
  }
  reconcileProcs()
  syncHash()

  if (kernel.dirtyShutdown) {
    pushToast({ title: '上次未正常关机', body: '已在启动时运行磁盘检查（fsck），数据完好。', kind: 'warn' })
  }

  await pushBoot('启动桌面环境…', '', 140)
  system.phase = system.onboarded ? 'desktop' : 'login'
  if (system.phase === 'desktop' && session.autoLogin) {
    /* 自动登录：直接进入，等用户第一次交互再响铃 */
  }
}

function safeLoadSession(kernel: Kernel): SessionData {
  try {
    return loadSession({
      readText: (p) => kernel.fs.readText(p),
      write: (p, d) => kernel.vfs.write(p, d, '/'),
    })
  } catch {
    try {
      const raw = localStorage.getItem('personalos.session')
      if (raw) return { ...safeParseSession(raw) }
    } catch {
      /* 忽略 */
    }
    return {
      theme: 'glass-dark',
      wallpaper: 'aurora',
      autoLogin: false,
      onboarded: false,
      windows: [],
    }
  }
}

function safeParseSession(raw: string): SessionData {
  try {
    const parsed = JSON.parse(raw) as Partial<SessionData>
    return {
      theme: parsed.theme === 'glass-light' ? 'glass-light' : 'glass-dark',
      wallpaper: typeof parsed.wallpaper === 'string' ? parsed.wallpaper : 'aurora',
      autoLogin: parsed.autoLogin === true,
      onboarded: parsed.onboarded === true,
      windows: Array.isArray(parsed.windows) ? parsed.windows : [],
      focusApp: parsed.focusApp,
    }
  } catch {
    return { theme: 'glass-dark', wallpaper: 'aurora', autoLogin: false, onboarded: false, windows: [] }
  }
}

function setupViewportListener(): void {
  const mq = window.matchMedia('(max-width: 760px)')
  const apply = () => {
    system.mobile = mq.matches
  }
  apply()
  mq.addEventListener('change', apply)

  // 旋转 / 改窗口 / 手机地址栏收放：重置安全区缓存并把窗口拉回屏内（防抖）
  let timer: number | undefined
  const onResize = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      _safeTop = -1
      reflowWindows()
    }, 140)
  }
  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onResize)
}

function wireBus(kernel: Kernel): void {
  kernel.bus.on('toast', (t) =>
    pushToast({ title: t.title, body: t.body, kind: t.kind ?? 'info', action: t.action ?? 'none' }),
  )
  kernel.bus.on('ui:open-app', ({ appId, arg }) => openApp(appId, arg))
  kernel.bus.on('ui:kill-pid', ({ pid }) => {
    const wid = windowByPid.get(pid)
    if (wid !== undefined) closeWindow(wid)
  })
  kernel.bus.on('ui:shutdown', () => void shutdownSystem())
  kernel.bus.on('ui:reboot', () => rebootSystem())
  kernel.bus.on('fs:changed', () => {
    updateUsage()
    scheduleSessionSave()
  })
  kernel.bus.on('disk:activity', () => {
    system.diskWrites = kernel.dev.writes
  })
}

// —— 进入桌面 ——

export function enterDesktop(): void {
  system.onboarded = true
  system.locked = false
  system.phase = 'desktop'
  saveSessionNow()
  if (_audio) void _audio.chime().catch(() => undefined)
}

/** 锁定屏幕：回到登录屏，窗口与磁盘状态原样保留（Win+L 被系统占用，用 Ctrl+Alt+L） */
export function lockScreen(): void {
  if (system.phase !== 'desktop') return
  system.locked = true
  system.ctxMenu = null
  system.launcher = false
  system.phase = 'login'
}

// —— 窗口管理 ——

function cascadeRect(appId: string): Rect {
  const def = APP_MAP[appId]
  const vp = viewport()
  const w = Math.min(def?.size.w ?? 560, vp.w - 24)
  const h = Math.min(def?.size.h ?? 460, vp.h - vp.top - 24)
  const n = system.wm.windows.length % 6
  const x = Math.round(Math.min(Math.max((vp.w - w) / 2 + n * 26 - 65, 12), Math.max(12, vp.w - w - 12)))
  const y = Math.round(
    Math.min(Math.max(vp.top + (vp.h - vp.top - h) / 2 + n * 20 - 50, vp.top + 10), Math.max(vp.top + 10, vp.h - h - 10)),
  )
  return { x, y, w, h }
}

export function wmDispatch(action: WmAction): void {
  system.wm = wmReduce(system.wm, action)
  reconcileProcs()
  scheduleSessionSave()
  syncHash()
}

function openAppAt(
  appId: string,
  arg: string | undefined,
  rect: Rect,
  opts: { minimized?: boolean; maximized?: boolean } = {},
): number | null {
  const def = APP_MAP[appId]
  if (!def) return null
  wmDispatch({ type: 'open', appId, title: def.title, arg, rect, single: def.single })
  const win = focusedWindow(system.wm)
  if (!win) return null
  if (opts.maximized) wmDispatch({ type: 'toggle-max', id: win.id, viewport: viewport() })
  if (opts.minimized) wmDispatch({ type: 'minimize', id: win.id })
  return win.id
}

export function openApp(appId: string, arg?: string): void {
  const def = APP_MAP[appId]
  if (!def) {
    pushToast({ title: '找不到应用', body: `未知应用：${appId}`, kind: 'err' })
    return
  }
  system.launcher = false
  system.ctxMenu = null
  openAppAt(appId, arg, cascadeRect(appId))
}

/** 按文件类型选择合适的应用打开 */
export function openPath(path: string): void {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (['md', 'txt', 'json', 'log', 'app', 'csv'].includes(ext)) {
    openApp('notepad', path)
    return
  }
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    openApp('music', path)
    return
  }
  pushToast({ title: '无法打开', body: `没有可打开 ${path} 的应用`, kind: 'warn' })
}

export function closeWindow(id: number): void {
  wmDispatch({ type: 'close', id })
}

export function focusWindow(id: number, force = false): void {
  if (force || system.wm.focusId !== id) wmDispatch({ type: 'focus', id })
}

export function focusAppWindow(appId: string): void {
  const wins = system.wm.windows.filter((w) => w.appId === appId)
  if (wins.length === 0) return
  const top = wins.reduce((a, b) => (a.z > b.z ? a : b))
  if (!top.minimized) focusWindow(top.id)
  else wmDispatch({ type: 'restore', id: top.id })
}

export function minimizeWindow(id: number): void {
  wmDispatch({ type: 'minimize', id })
}

export function restoreWindow(id: number): void {
  wmDispatch({ type: 'restore', id })
}

export function toggleMaximize(id: number): void {
  wmDispatch({ type: 'toggle-max', id, viewport: viewport() })
}

export function moveWindow(id: number, x: number, y: number): void {
  wmDispatch({ type: 'move', id, x, y, viewport: viewport() })
}

export function resizeWindow(id: number, rect: Rect): void {
  wmDispatch({ type: 'resize', id, rect, viewport: viewport() })
}

export function snapWindow(id: number, region: SnapRegion): void {
  system.snapHint = null
  wmDispatch({ type: 'snap', id, region, viewport: viewport() })
}

export function setWindowTitle(id: number, title: string): void {
  wmDispatch({ type: 'set-title', id, title })
}

export function snapRegionAt(x: number, y: number): SnapRegion | null {
  return detectSnapRegion(x, y, viewport())
}

export function snapPreviewRect(region: SnapRegion): Rect {
  return snapRect(region, viewport())
}

// —— 进程守护 ——

function reconcileProcs(): void {
  const kernel = _kernel
  if (!kernel) return
  const seen = new Set<number>()
  for (const w of system.wm.windows) {
    seen.add(w.id)
    let pid = pidByWindow.get(w.id)
    if (pid === undefined) {
      const def = APP_MAP[w.appId]
      const proc = kernel.procs.spawn(w.appId, w.title)
      pid = proc.pid
      pidByWindow.set(w.id, pid)
      windowByPid.set(pid, w.id)
      sysByWindow.set(w.id, kernel.sysFor(w.appId, pid, def?.caps ?? { fs: 'none' }))
      kernel.bus.emit('proc:changed', {})
    }
    const proc = kernel.procs.get(pid)
    const wanted = w.minimized ? 'suspended' : 'running'
    if (proc && proc.state !== wanted) {
      kernel.procs.setState(pid, wanted)
      kernel.bus.emit('proc:changed', {})
    }
  }
  for (const [wid, pid] of [...pidByWindow]) {
    if (!seen.has(wid)) {
      kernel.procs.exit(pid)
      pidByWindow.delete(wid)
      windowByPid.delete(pid)
      sysByWindow.delete(wid)
      kernel.bus.emit('proc:changed', {})
    }
  }
}

/** 任务管理器用：按 pid 关闭窗口 */
export function closeWindowByPid(pid: number): void {
  const wid = windowByPid.get(pid)
  if (wid !== undefined) closeWindow(wid)
}

// —— 通知 ——

let toastSeq = 0

export function pushToast(t: {
  title: string
  body?: string
  kind?: ToastKind
  action?: 'reload' | 'none'
}): void {
  const toast: Toast = {
    id: ++toastSeq,
    title: t.title,
    body: t.body,
    kind: t.kind ?? 'info',
    action: t.action ?? 'none',
    at: Date.now(),
  }
  system.toasts.push(toast)
  if (toast.action !== 'reload') {
    setTimeout(() => dismissToast(toast.id), 5200)
  }
  while (system.toasts.length > 5) system.toasts.shift()
}

export function dismissToast(id: number): void {
  const i = system.toasts.findIndex((t) => t.id === id)
  if (i >= 0) system.toasts.splice(i, 1)
}

export function reloadPage(): void {
  location.reload()
}

// —— 菜单 / 启动器 ——

export function openContextMenu(x: number, y: number, items: MenuItem[]): void {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const estH = Math.min(items.length * 32 + 16, 420)
  system.ctxMenu = { x: Math.min(x, vw - 230), y: Math.min(y, Math.max(8, vh - estH - 8)), items }
}

export function closeMenus(): void {
  system.ctxMenu = null
}

export function toggleLauncher(v?: boolean): void {
  system.launcher = v ?? !system.launcher
  if (!system.launcher) system.launcherQuery = ''
  system.ctxMenu = null
}

// —— 主题 ——

export function setTheme(t: 'glass-dark' | 'glass-light'): void {
  system.theme = t
  applyTheme(t)
  scheduleSessionSave()
}

export function toggleTheme(): void {
  setTheme(system.theme === 'glass-dark' ? 'glass-light' : 'glass-dark')
}

export function setWallpaper(w: string): void {
  system.wallpaper = w
  applyWallpaper(w)
  scheduleSessionSave()
}

export function cycleWallpaper(): void {
  const presets = ['aurora', 'dusk', 'deep', 'mono']
  const idx = presets.indexOf(system.wallpaper)
  setWallpaper(presets[(idx + 1) % presets.length])
}

// —— 电源 ——

export async function shutdownSystem(): Promise<void> {
  if (system.phase === 'shutting-down' || system.phase === 'off') return
  system.phase = 'shutting-down'
  try {
    _audio?.stop()
  } catch {
    /* 忽略 */
  }
  try {
    if (_kernel) {
      saveSessionNow()
      await _kernel.cleanShutdown()
    }
  } catch {
    /* 忽略 */
  }
  system.phase = 'off'
}

export function rebootSystem(): void {
  if (system.phase === 'shutting-down' || system.phase === 'off') return
  system.phase = 'shutting-down'
  void (async () => {
    try {
      _audio?.stop()
      if (_kernel) {
        saveSessionNow()
        await _kernel.cleanShutdown()
      }
    } catch {
      /* 忽略 */
    }
    location.reload()
  })()
}

// —— 会话保存 ——

let sessionTimer: ReturnType<typeof setTimeout> | null = null

function currentSession(): SessionData {
  return {
    theme: system.theme,
    wallpaper: system.wallpaper,
    autoLogin: system.autoLogin,
    onboarded: system.onboarded,
    windows: system.wm.windows.map((w) => ({
      appId: w.appId,
      arg: w.arg,
      x: w.rect.x,
      y: w.rect.y,
      w: w.rect.w,
      h: w.rect.h,
      minimized: w.minimized,
      maximized: w.maximized,
    })),
    focusApp: focusedWindow(system.wm)?.appId,
  }
}

export function scheduleSessionSave(): void {
  if (sessionTimer) clearTimeout(sessionTimer)
  sessionTimer = setTimeout(() => saveSessionNow(), 600)
}

export function saveSessionNow(): void {
  if (sessionTimer) {
    clearTimeout(sessionTimer)
    sessionTimer = null
  }
  const data = currentSession()
  try {
    if (_kernel) {
      _kernel.vfs.write(SESSION_PATH, JSON.stringify(data, null, 2) + '\n', '/')
      _kernel.scheduleSave()
    } else {
      saveSessionLocal(data)
    }
  } catch {
    saveSessionLocal(data)
  }
}

export function installLifecycleHooks(): void {
  const flush = () => {
    saveSessionNow()
    void _kernel?.flush()
  }
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush()
  })

  // 全局兜底：未捕获异常不静默，进内核日志 + 提示（相同错误 3 秒内只报一次）
  let lastMsg = ''
  let lastAt = 0
  const report = (msg: string): void => {
    const now = Date.now()
    if (msg === lastMsg && now - lastAt < 3000) return
    lastMsg = msg
    lastAt = now
    _kernel?.log.err('kernel', msg)
    pushToast({ title: '内核异常', body: msg, kind: 'err' })
  }
  window.addEventListener('error', (e) => report(e.message || '未知脚本错误'))
  window.addEventListener('unhandledrejection', (e) => {
    const r: unknown = e.reason
    report(r instanceof Error ? r.message : String(r))
  })
}

// —— 用量 / 磁盘信息 ——

function updateUsage(): void {
  const kernel = _kernel
  if (!kernel) return
  try {
    const u = kernel.fs.usage()
    system.usage = { used: u.used, total: u.total, free: u.free, files: u.files, dirs: u.dirs }
    system.conflict = kernel.conflict
    system.diskWrites = kernel.dev.writes
  } catch {
    /* 磁盘损坏：忽略 */
  }
}

export function refreshUsage(): void {
  updateUsage()
}

// —— URL 深链 ——

let suppressHash = false

function syncHash(): void {
  const f = focusedWindow(system.wm)
  const h =
    f && !f.minimized ? buildHash({ kind: 'app', appId: f.appId, arg: f.arg }) : buildHash({ kind: 'desktop' })
  if (location.hash !== h) {
    suppressHash = true
    location.hash = h
    setTimeout(() => {
      suppressHash = false
    }, 0)
  }
}

export function installHashListener(): void {
  window.addEventListener('hashchange', () => {
    if (suppressHash) return
    const route = parseHash(location.hash)
    if (route.kind === 'app' && route.appId) openApp(route.appId, route.arg)
  })
}

// —— 内核事件订阅（给组件用） ——

export function onKernelEvent<K extends keyof KernelEvents>(
  event: K,
  cb: (payload: KernelEvents[K]) => void,
): () => void {
  const kernel = _kernel
  if (!kernel) return () => undefined
  return kernel.bus.on(event, cb)
}
