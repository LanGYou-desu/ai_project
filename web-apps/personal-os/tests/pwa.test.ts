// PWA 外壳：manifest 可安装、离线 SW 策略正确，且绝不碰虚拟磁盘 API
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

describe('PWA 外壳', () => {
  it('manifest：可安装所需字段齐全，图标指向自绘 SVG', () => {
    const raw = fs.readFileSync(path.join(root, 'public', 'manifest.webmanifest'), 'utf8')
    const m = JSON.parse(raw) as {
      name: string
      short_name: string
      start_url: string
      display: string
      theme_color: string
      background_color: string
      icons: { src: string; sizes: string; type: string }[]
    }
    expect(m.name).toContain('personal-os')
    expect(m.short_name.length).toBeGreaterThan(0)
    expect(m.start_url).toBe('./')
    expect(m.display).toBe('standalone')
    expect(m.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(m.background_color).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(m.icons.length).toBeGreaterThan(0)
    for (const icon of m.icons) {
      expect(icon.type).toBe('image/svg+xml')
      expect(icon.sizes).toBe('any')
      const rel = icon.src.replace(/^\.\//, '')
      expect(fs.existsSync(path.join(root, 'public', rel))).toBe(true)
    }
  })

  it('index.html：manifest / 主题色 / 可安装与刘海屏元信息齐全', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    expect(html).toContain('rel="manifest"')
    expect(html).toContain('manifest.webmanifest')
    expect(html).toContain('name="theme-color"')
    expect(html).toContain('apple-mobile-web-app-capable')
    expect(html).toContain('viewport-fit=cover')
    expect(html).toContain('name="description"')
  })

  it('service worker：跳过非 GET 与 /api/*，导航离线回退到外壳页', () => {
    const sw = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8')
    expect(sw).toContain("req.method !== 'GET'")
    expect(sw).toContain('self.skipWaiting()')
    expect(sw).toContain("req.mode === 'navigate'")
    // /api/* 的放行判断必须发生在写缓存之前（虚拟磁盘接口永远走网络）
    const apiGuard = sw.indexOf("url.pathname.includes('/api/')")
    const cachePut = sw.indexOf('c.put(req, copy)')
    expect(apiGuard).toBeGreaterThan(-1)
    expect(cachePut).toBeGreaterThan(apiGuard)
  })
})
