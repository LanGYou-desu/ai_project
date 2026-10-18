// 窗口管理器：纯函数状态机（不碰 DOM），拖拽/吸附/层级全部可单测
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Viewport {
  w: number
  h: number
  /** 菜单栏高度，窗口不允许停靠到它下面之上 */
  top: number
}

export interface WinState {
  id: number
  appId: string
  title: string
  arg?: string
  rect: Rect
  z: number
  minimized: boolean
  maximized: boolean
  restoreRect?: Rect
}

export interface WmState {
  windows: WinState[]
  focusId: number | null
  nextId: number
  nextZ: number
}

export type SnapRegion = 'left' | 'right' | 'top'

export const MIN_W = 340
export const MIN_H = 220

export const initialWm: WmState = { windows: [], focusId: null, nextId: 1, nextZ: 1 }

export type WmAction =
  | { type: 'open'; appId: string; title: string; arg?: string; rect: Rect; single?: boolean }
  | { type: 'close'; id: number }
  | { type: 'focus'; id: number }
  | { type: 'move'; id: number; x: number; y: number; viewport: Viewport }
  | { type: 'resize'; id: number; rect: Rect; viewport: Viewport }
  | { type: 'minimize'; id: number }
  | { type: 'restore'; id: number }
  | { type: 'toggle-max'; id: number; viewport: Viewport }
  | { type: 'snap'; id: number; region: SnapRegion; viewport: Viewport }
  | { type: 'set-title'; id: number; title: string }
  | { type: 'move-window'; id: number; rect: Rect; viewport: Viewport }
  | { type: 'reflow'; viewport: Viewport }
  | { type: 'cycle-focus'; dir: 1 | -1 }
  | { type: 'minimize-all' }
  | { type: 'restore-all' }

function focusOn(s: WmState, id: number): WmState {
  const win = s.windows.find((w) => w.id === id)
  if (!win) return s
  return {
    ...s,
    focusId: id,
    nextZ: s.nextZ + 1,
    windows: s.windows.map((w) => (w.id === id ? { ...w, z: s.nextZ } : w)),
  }
}

export function topOf(s: WmState): WinState | null {
  let top: WinState | null = null
  for (const w of s.windows) if (!w.minimized && (!top || w.z > top.z)) top = w
  return top
}

export function focusedWindow(s: WmState): WinState | null {
  if (s.focusId === null) return null
  return s.windows.find((w) => w.id === s.focusId && !w.minimized) ?? topOf(s)
}

export function windowsOfApp(s: WmState, appId: string): WinState[] {
  return s.windows.filter((w) => w.appId === appId)
}

export function appRunning(s: WmState, appId: string): boolean {
  return s.windows.some((w) => w.appId === appId)
}

export function snapRect(region: SnapRegion, vp: Viewport): Rect {
  const h = vp.h - vp.top
  switch (region) {
    case 'left':
      return { x: 0, y: vp.top, w: Math.round(vp.w / 2), h }
    case 'right':
      return { x: Math.round(vp.w / 2), y: vp.top, w: Math.round(vp.w / 2), h }
    case 'top':
      return { x: 0, y: vp.top, w: vp.w, h }
  }
}

/** 拖拽到屏幕边缘时检测吸附区域 */
export function detectSnapRegion(
  px: number,
  py: number,
  vp: Viewport,
  threshold = 14,
): SnapRegion | null {
  if (py <= vp.top + threshold) return 'top'
  if (px <= threshold) return 'left'
  if (px >= vp.w - threshold) return 'right'
  return null
}

/** 限制拖拽位置：标题栏与一部分窗口体必须留在屏幕内 */
export function clampDrag(
  rect: Rect,
  vp: Viewport,
  opts: { keepTitle?: boolean } = {},
): { x: number; y: number } {
  const keepTitle = opts.keepTitle ?? true
  const minX = -(rect.w - 120)
  const maxX = vp.w - 80
  const minY = keepTitle ? vp.top : vp.top - rect.h + 60
  const maxY = vp.h - 56
  return {
    x: Math.min(Math.max(rect.x, minX), maxX),
    y: Math.min(Math.max(rect.y, minY), maxY),
  }
}

export function clampResize(rect: Rect, vp: Viewport): Rect {
  const w = Math.min(Math.max(rect.w, MIN_W), Math.max(MIN_W, vp.w - 8))
  const h = Math.min(Math.max(rect.h, MIN_H), Math.max(MIN_H, vp.h - vp.top - 8))
  return { x: rect.x, y: rect.y, w: Math.round(w), h: Math.round(h) }
}

export function wmReduce(s: WmState, a: WmAction): WmState {
  switch (a.type) {
    case 'open': {
      const existing = s.windows.find(
        (w) => w.appId === a.appId && (a.single === false ? w.arg === a.arg : true),
      )
      if (existing) {
        return focusOn(
          {
            ...s,
            windows: s.windows.map((w) => (w.id === existing.id ? { ...w, minimized: false } : w)),
          },
          existing.id,
        )
      }
      const id = s.nextId
      const z = s.nextZ
      const win: WinState = {
        id,
        appId: a.appId,
        title: a.title,
        arg: a.arg,
        rect: clampResize(a.rect, { w: 4096, h: 4096, top: 0 }),
        z,
        minimized: false,
        maximized: false,
      }
      return {
        windows: [...s.windows, win],
        focusId: id,
        nextId: id + 1,
        nextZ: z + 1,
      }
    }
    case 'close': {
      const windows = s.windows.filter((w) => w.id !== a.id)
      let focusId = s.focusId
      if (focusId === a.id) {
        let top: WinState | null = null
        for (const w of windows) if (!w.minimized && (!top || w.z > top.z)) top = w
        focusId = top ? top.id : null
      }
      return { ...s, windows, focusId }
    }
    case 'focus':
      return focusOn(s, a.id)
    case 'move': {
      const win = s.windows.find((w) => w.id === a.id)
      if (!win) return s
      if (win.maximized) return s
      const pos = clampDrag({ ...win.rect, x: a.x, y: a.y }, a.viewport)
      return {
        ...s,
        windows: s.windows.map((w) =>
          w.id === a.id ? { ...w, rect: { ...w.rect, x: pos.x, y: pos.y } } : w,
        ),
      }
    }
    case 'resize': {
      const win = s.windows.find((w) => w.id === a.id)
      if (!win || win.maximized) return s
      const rect = clampResize(a.rect, a.viewport)
      return {
        ...s,
        windows: s.windows.map((w) => (w.id === a.id ? { ...w, rect } : w)),
      }
    }
    case 'minimize': {
      const windows = s.windows.map((w) => (w.id === a.id ? { ...w, minimized: true } : w))
      const next = { ...s, windows }
      const top = topOf(next)
      return { ...next, focusId: top ? top.id : null }
    }
    case 'restore': {
      const withRestore = {
        ...s,
        windows: s.windows.map((w) => (w.id === a.id ? { ...w, minimized: false } : w)),
      }
      return focusOn(withRestore, a.id)
    }
    case 'toggle-max': {
      const win = s.windows.find((w) => w.id === a.id)
      if (!win) return s
      if (win.maximized) {
        const rect = win.restoreRect ?? { ...win.rect, w: MIN_W * 2, h: MIN_H * 2 }
        return {
          ...focusOn(s, a.id),
          windows: s.windows.map((w) =>
            w.id === a.id ? { ...w, maximized: false, rect, restoreRect: undefined } : w,
          ),
        }
      }
      const rect = snapRect('top', a.viewport)
      return {
        ...focusOn(s, a.id),
        windows: s.windows.map((w) =>
          w.id === a.id ? { ...w, maximized: true, restoreRect: w.rect, rect } : w,
        ),
      }
    }
    case 'snap': {
      const win = s.windows.find((w) => w.id === a.id)
      if (!win) return s
      const rect = snapRect(a.region, a.viewport)
      return {
        ...focusOn(s, a.id),
        windows: s.windows.map((w) =>
          w.id === a.id
            ? {
                ...w,
                maximized: a.region === 'top',
                // 已吸附/最大化过的窗口保留最初的还原矩形，连续贴边不丢原尺寸
                restoreRect: w.restoreRect ?? w.rect,
                rect,
              }
            : w,
        ),
      }
    }
    case 'set-title':
      return {
        ...s,
        windows: s.windows.map((w) => (w.id === a.id ? { ...w, title: a.title } : w)),
      }
    case 'move-window': {
      const win = s.windows.find((w) => w.id === a.id)
      if (!win) return s
      const rect = clampResize(a.rect, a.viewport)
      return {
        ...s,
        windows: s.windows.map((w) => (w.id === a.id ? { ...w, rect, maximized: false } : w)),
      }
    }
    case 'reflow': {
      // 视口变化（旋转屏幕 / 改窗口大小）：最大化窗口跟随新视口，浮动窗口拉回屏内
      const vp = a.viewport
      return {
        ...s,
        windows: s.windows.map((w) => {
          if (w.maximized) return { ...w, rect: snapRect('top', vp) }
          const sized = clampResize(w.rect, vp)
          const pos = clampDrag(sized, vp)
          return { ...w, rect: { ...sized, x: pos.x, y: pos.y } }
        }),
      }
    }
    case 'cycle-focus': {
      // Alt+Tab：在未最小化的窗口间按 z 序环形切换（切到的窗口置顶并获得焦点）
      const wins = s.windows.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)
      if (wins.length === 0) return s
      const idx = wins.findIndex((w) => w.id === s.focusId)
      const next =
        idx < 0
          ? a.dir === 1
            ? wins[0]
            : wins[wins.length - 1]
          : wins[(idx + a.dir + wins.length) % wins.length]
      return focusOn(s, next.id)
    }
    case 'minimize-all':
      return {
        ...s,
        windows: s.windows.map((w) => (w.minimized ? w : { ...w, minimized: true })),
        focusId: null,
      }
    case 'restore-all': {
      // 恢复全部窗口，焦点给最高 z 的那扇
      const windows = s.windows.map((w) => (w.minimized ? { ...w, minimized: false } : w))
      const top = topOf({ ...s, windows })
      return { ...s, windows, focusId: top ? top.id : null }
    }
  }
}
