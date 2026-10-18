// @vitest-environment happy-dom
// UI 冒烟：组件能编译加载、图标是自绘 SVG、注册表完整
import { describe, it, expect } from 'vitest'
import { mount, unmount } from 'svelte'
import Glyph from '../src/ui/Glyph.svelte'
import AppIcon from '../src/ui/AppIcon.svelte'
import { APPS, APP_MAP, DOCK_PINNED } from '../src/apps/registry.ts'
import { APP_ICONS } from '../src/ui/app-icons.ts'
import { GLYPHS } from '../src/ui/glyphs.ts'
import App from '../src/App.svelte'
import BootScreen from '../src/shell/BootScreen.svelte'
import LoginScreen from '../src/shell/LoginScreen.svelte'
import OffScreen from '../src/shell/OffScreen.svelte'
import Desktop from '../src/shell/Desktop.svelte'
import MenuBar from '../src/shell/MenuBar.svelte'
import Dock from '../src/shell/Dock.svelte'
import Launcher from '../src/shell/Launcher.svelte'
import WindowFrame from '../src/shell/WindowFrame.svelte'
import ContextMenu from '../src/shell/ContextMenu.svelte'
import Toasts from '../src/shell/Toasts.svelte'

describe('应用注册表', () => {
  it('9 个应用，id 唯一', () => {
    const ids = APPS.map((a) => a.id)
    expect(ids).toHaveLength(9)
    expect(new Set(ids).size).toBe(9)
  })

  it('Dock 常驻项全部指向真实应用', () => {
    for (const id of DOCK_PINNED) {
      expect(APP_MAP[id], id).toBeTruthy()
    }
  })

  it('每个应用都有自绘图标与合法窗口尺寸', () => {
    for (const a of APPS) {
      expect(APP_ICONS[a.icon], a.id).toBeTruthy()
      expect(a.size.w).toBeGreaterThanOrEqual(340)
      expect(a.size.h).toBeGreaterThanOrEqual(220)
      expect(a.title.length).toBeGreaterThan(0)
    }
  })

  it('能力与单实例策略符合设计', () => {
    expect(APP_MAP['about'].caps.fs).toBe('ro')
    expect(APP_MAP['files'].caps.fs).toBe('rw')
    expect(APP_MAP['terminal'].caps.fs).toBe('sys')
    expect(APP_MAP['taskmgr'].caps.fs).toBe('none')
    expect(APP_MAP['about'].single).toBe(true)
    expect(APP_MAP['terminal'].single).toBe(false)
    expect(APP_MAP['notepad'].single).toBe(false)
  })

  it('壳与应用组件全部能编译加载（模块冒烟）', () => {
    const comps = [
      App,
      BootScreen,
      LoginScreen,
      OffScreen,
      Desktop,
      MenuBar,
      Dock,
      Launcher,
      WindowFrame,
      ContextMenu,
      Toasts,
      ...APPS.map((a) => a.component),
    ]
    for (const c of comps) expect(c).toBeTruthy()
  })
})

describe('图标组件（happy-dom 冒烟）', () => {
  it('Glyph 渲染 24 视图线描 SVG', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const inst = mount(Glyph, { target, props: { name: 'folder', size: 24 } })
    const svg = target.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24')
    expect((svg?.innerHTML ?? '').length).toBeGreaterThan(10)
    unmount(inst)
    target.remove()
  })

  it('AppIcon 渲染 64 视图圆角瓷砖（渐变 + 高光 + 描边）', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const inst = mount(AppIcon, { target, props: { id: 'about', size: 64 } })
    const svg = target.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 64 64')
    expect(target.querySelectorAll('rect').length).toBeGreaterThanOrEqual(3)
    expect(target.querySelectorAll('linearGradient').length).toBeGreaterThanOrEqual(2)
    unmount(inst)
    target.remove()
  })

  it('未知图标 id 回退到默认瓷砖', () => {
    const target = document.createElement('div')
    const inst = mount(AppIcon, { target, props: { id: '不存在的应用' } })
    expect(target.querySelector('svg')).toBeTruthy()
    unmount(inst)
  })

  it('Glyph 表全部是安全的 SVG 片段', () => {
    const entries = Object.entries(GLYPHS)
    expect(entries.length).toBeGreaterThan(20)
    for (const [name, frag] of entries) {
      expect(typeof frag, name).toBe('string')
      expect(frag.includes('<script'), name).toBe(false)
      expect(frag.length, name).toBeGreaterThan(4)
    }
  })
})
