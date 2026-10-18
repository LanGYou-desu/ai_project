// 窗口管理器：纯 reducer 的状态机行为
import { describe, it, expect } from 'vitest'
import {
  initialWm,
  wmReduce,
  topOf,
  focusedWindow,
  appRunning,
  windowsOfApp,
  clampDrag,
  clampResize,
  detectSnapRegion,
  snapRect,
  MIN_W,
  MIN_H,
  type Viewport,
  type WmState,
  type Rect,
} from '../src/kernel/wm.ts'

const vp: Viewport = { w: 1440, h: 900, top: 34 }
const base: Rect = { x: 120, y: 120, w: 600, h: 420 }

function open(
  s: WmState,
  appId: string,
  extra: Partial<{ rect: Rect; single: boolean; arg: string }> = {},
): WmState {
  return wmReduce(s, {
    type: 'open',
    appId,
    title: appId,
    rect: extra.rect ?? { ...base },
    single: extra.single ?? true,
    arg: extra.arg,
  })
}

describe('窗口管理器', () => {
  it('打开窗口：递增 id/z，新窗口获得焦点', () => {
    let s = open(initialWm, 'about')
    s = open(s, 'projects')
    expect(s.windows).toHaveLength(2)
    expect(s.focusId).toBe(2)
    expect(topOf(s)?.id).toBe(2)
    expect(s.nextId).toBe(3)
    expect(focusedWindow(s)?.appId).toBe('projects')
    expect(appRunning(s, 'about')).toBe(true)
  })

  it('单实例应用重复打开：聚焦并取消最小化，不新建窗口', () => {
    let s = open(initialWm, 'about')
    s = wmReduce(s, { type: 'minimize', id: 1 })
    expect(focusedWindow(s)).toBeNull()
    s = open(s, 'about')
    expect(s.windows).toHaveLength(1)
    expect(s.windows[0].minimized).toBe(false)
    expect(s.focusId).toBe(1)
  })

  it('多实例应用按 arg 去重（single: false）', () => {
    let s = open(initialWm, 'notepad', { single: false, arg: '/a.txt' })
    s = open(s, 'notepad', { single: false, arg: '/b.txt' })
    expect(s.windows).toHaveLength(2)
    s = open(s, 'notepad', { single: false, arg: '/a.txt' })
    expect(s.windows).toHaveLength(2)
    expect(s.focusId).toBe(1)
    expect(windowsOfApp(s, 'notepad')).toHaveLength(2)
  })

  it('移动：标题栏与部分窗口体必须留在视口内', () => {
    let s = open(initialWm, 'about')
    s = wmReduce(s, { type: 'move', id: 1, x: -5000, y: -5000, viewport: vp })
    let r = s.windows[0].rect
    expect(r.x).toBe(-(600 - 120))
    expect(r.y).toBe(vp.top)
    s = wmReduce(s, { type: 'move', id: 1, x: 99999, y: 99999, viewport: vp })
    r = s.windows[0].rect
    expect(r.x).toBe(vp.w - 80)
    expect(r.y).toBe(vp.h - 56)
  })

  it('缩放：不小于最小尺寸，不大于视口', () => {
    let s = open(initialWm, 'about')
    s = wmReduce(s, { type: 'resize', id: 1, rect: { x: 10, y: 10, w: 10, h: 10 }, viewport: vp })
    expect(s.windows[0].rect.w).toBe(MIN_W)
    expect(s.windows[0].rect.h).toBe(MIN_H)
    s = wmReduce(s, { type: 'resize', id: 1, rect: { x: 10, y: 10, w: 9999, h: 9999 }, viewport: vp })
    expect(s.windows[0].rect.w).toBe(vp.w - 8)
    expect(s.windows[0].rect.h).toBe(vp.h - vp.top - 8)
  })

  it('最大化与还原：restoreRect 记录原始位置', () => {
    let s = open(initialWm, 'about')
    const before = { ...s.windows[0].rect }
    s = wmReduce(s, { type: 'toggle-max', id: 1, viewport: vp })
    expect(s.windows[0].maximized).toBe(true)
    expect(s.windows[0].rect).toEqual(snapRect('top', vp))
    expect(s.windows[0].restoreRect).toEqual(before)
    s = wmReduce(s, { type: 'toggle-max', id: 1, viewport: vp })
    expect(s.windows[0].maximized).toBe(false)
    expect(s.windows[0].rect).toEqual(before)
  })

  it('贴边吸附：左右半屏，原尺寸保留在 restoreRect', () => {
    let s = open(initialWm, 'files')
    s = wmReduce(s, { type: 'snap', id: 1, region: 'left', viewport: vp })
    expect(s.windows[0].rect).toEqual(snapRect('left', vp))
    s = wmReduce(s, { type: 'snap', id: 1, region: 'right', viewport: vp })
    expect(s.windows[0].rect).toEqual(snapRect('right', vp))
    expect(s.windows[0].maximized).toBe(false)
    expect(s.windows[0].restoreRect).toEqual(base)
  })

  it('关闭窗口：焦点回落到最上层，全部关闭后为 null', () => {
    let s = open(initialWm, 'about')
    s = open(s, 'projects')
    s = wmReduce(s, { type: 'close', id: 2 })
    expect(s.windows).toHaveLength(1)
    expect(s.focusId).toBe(1)
    s = wmReduce(s, { type: 'close', id: 1 })
    expect(s.windows).toHaveLength(0)
    expect(s.focusId).toBeNull()
  })

  it('修改窗口标题', () => {
    let s = open(initialWm, 'notepad', { single: false })
    s = wmReduce(s, { type: 'set-title', id: 1, title: '未命名 — 记事本' })
    expect(s.windows[0].title).toBe('未命名 — 记事本')
  })

  it('拖拽到屏幕边缘：吸附区域检测', () => {
    expect(detectSnapRegion(5, 300, vp)).toBe('left')
    expect(detectSnapRegion(vp.w - 5, 300, vp)).toBe('right')
    expect(detectSnapRegion(700, vp.top + 5, vp)).toBe('top')
    expect(detectSnapRegion(700, 500, vp)).toBeNull()
  })

  it('clampDrag / clampResize 是稳定纯函数', () => {
    expect(clampDrag({ x: -9999, y: -9999, w: 400, h: 300 }, vp)).toEqual({
      x: -(400 - 120),
      y: vp.top,
    })
    expect(clampResize({ x: 0, y: 0, w: 1, h: 1 }, vp)).toEqual({
      x: 0,
      y: 0,
      w: MIN_W,
      h: MIN_H,
    })
  })

  it('最大化窗口拒绝移动与缩放', () => {
    let s = open(initialWm, 'about')
    s = wmReduce(s, { type: 'toggle-max', id: 1, viewport: vp })
    const rect = { ...s.windows[0].rect }
    s = wmReduce(s, { type: 'move', id: 1, x: 10, y: 10, viewport: vp })
    s = wmReduce(s, { type: 'resize', id: 1, rect: { x: 0, y: 0, w: 200, h: 200 }, viewport: vp })
    expect(s.windows[0].rect).toEqual(rect)
  })

  it('reflow：视口变小后最大化窗口跟随、浮动窗口拉回屏内', () => {
    let s = open(initialWm, 'about', { rect: { x: 300, y: 200, w: 800, h: 600 } })
    s = wmReduce(s, { type: 'toggle-max', id: 1, viewport: vp })
    s = open(s, 'terminal', { single: false, rect: { x: 1200, y: 700, w: 900, h: 700 } })

    const phone: Viewport = { w: 390, h: 844, top: 30 }
    s = wmReduce(s, { type: 'reflow', viewport: phone })

    const max = s.windows.find((w) => w.id === 1)!
    expect(max.maximized).toBe(true)
    expect(max.rect).toEqual(snapRect('top', phone))

    const flo = s.windows.find((w) => w.id === 2)!
    expect(flo.rect.w).toBeLessThanOrEqual(phone.w - 8)
    expect(flo.rect.h).toBeLessThanOrEqual(phone.h - phone.top - 8)
    expect(flo.rect.w).toBeGreaterThanOrEqual(MIN_W)
    expect(flo.rect.x).toBeLessThanOrEqual(phone.w - 80)
    expect(flo.rect.y).toBeGreaterThanOrEqual(phone.top)
    expect(flo.rect.y).toBeLessThanOrEqual(phone.h - 56)
  })

  it('cycle-focus：Alt+Tab 环形切换（可反向），最小化窗口不参与', () => {
    let s = open(initialWm, 'about')
    s = open(s, 'files')
    s = open(s, 'terminal', { single: false })
    expect(focusedWindow(s)?.appId).toBe('terminal')

    s = wmReduce(s, { type: 'cycle-focus', dir: 1 })
    expect(focusedWindow(s)?.appId).toBe('files')
    // 切到的窗口被置顶（z 最大）
    expect(topOf(s)?.appId).toBe('files')

    // 反向：从顶层绕回环的末尾
    s = wmReduce(s, { type: 'cycle-focus', dir: -1 })
    expect(focusedWindow(s)?.appId).toBe('about')

    // 最小化的窗口不参与轮转
    s = wmReduce(s, { type: 'minimize', id: 3 })
    s = wmReduce(s, { type: 'cycle-focus', dir: 1 })
    expect(focusedWindow(s)?.id).toBe(2)
    expect(focusedWindow(s)?.minimized).toBe(false)
  })

  it('minimize-all / restore-all：显示桌面再恢复', () => {
    let s = open(initialWm, 'about')
    s = open(s, 'files')
    s = wmReduce(s, { type: 'minimize-all' })
    expect(s.windows.every((w) => w.minimized)).toBe(true)
    expect(s.focusId).toBeNull()

    s = wmReduce(s, { type: 'restore-all' })
    expect(s.windows.every((w) => !w.minimized)).toBe(true)
    expect(focusedWindow(s)?.id).toBe(2) // 焦点回到最高 z 的窗口
  })
})
