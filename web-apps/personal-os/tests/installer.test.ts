// 装机服务：金样镜像确定性 + 发行内容完整性
import { describe, it, expect } from 'vitest'
import { BlockDevice } from '../src/kernel/disk/blockdev.ts'
import { DiskFs } from '../src/kernel/disk/fs.ts'
import { installSeed, PATHS } from '../src/services/installer.ts'
import { profile } from '../src/data/profile.ts'

const TIME = 1700000000000

function install(): { dev: BlockDevice; fs: DiskFs } {
  const dev = new BlockDevice()
  const fs = DiskFs.format(dev, { label: 'PERSONAL-OS', time: TIME })
  installSeed(fs, TIME)
  return { dev, fs }
}

describe('装机服务', () => {
  it('同一时间戳 → 逐字节一致的金样镜像', () => {
    const a = install()
    const b = install()
    expect(a.dev.snapshot()).toEqual(b.dev.snapshot())
  })

  it('不同时间戳 → 镜像不同', () => {
    const a = install()
    const dev = new BlockDevice()
    const fs = DiskFs.format(dev, { label: 'PERSONAL-OS', time: TIME + 1 })
    installSeed(fs, TIME + 1)
    expect(Array.from(dev.snapshot())).not.toEqual(Array.from(a.dev.snapshot()))
  })

  it('发行内容齐全：16 文件 / 12 目录（含根）', () => {
    const { fs } = install()
    const u = fs.usage()
    expect(u.files).toBe(16)
    expect(u.dirs).toBe(12)
  })

  it('关键路径都在，内容可解析', () => {
    const { fs } = install()
    expect(fs.readText(PATHS.about)).toContain('# 关于我')
    expect(fs.readText(PATHS.syslog)).toContain('装机')

    const contact = JSON.parse(fs.readText(PATHS.contact)) as { email: string }
    expect(contact.email).toBe(profile.contact.email)

    const playlist = JSON.parse(fs.readText(PATHS.playlist)) as { entries: unknown[] }
    expect(playlist.entries).toHaveLength(3)

    const theme = JSON.parse(fs.readText(PATHS.theme)) as { theme: string; wallpaper: string }
    expect(theme.theme).toBe('glass-dark')
    expect(theme.wallpaper).toBe('aurora')

    const system = JSON.parse(fs.readText('/系统/config/system.json')) as { hostname: string }
    expect(system.hostname).toBe('personal-os')

    expect(fs.readdir(PATHS.projects)).toHaveLength(profile.projects.length)
    const desktop = fs.readdir(PATHS.desktop)
    expect(desktop).toHaveLength(profile.desktop.length)
    for (const f of desktop) {
      expect(f.name.endsWith('.app')).toBe(true)
      const def = JSON.parse(fs.readText(`${PATHS.desktop}/${f.name}`)) as { app: string; title: string }
      expect(def.app).toBeTruthy()
      expect(def.title).toBeTruthy()
    }
  })

  it('项目文件符合约定格式（标题 / 简介 / 标签）', () => {
    const { fs } = install()
    const p0 = fs.readText(`${PATHS.projects}/${profile.projects[0].file}`)
    expect(p0.startsWith('# ')).toBe(true)
    expect(p0).toContain('标签:')
    expect(p0).toContain('> ')
  })

  it('磁盘写满时报 ENOSPC', () => {
    const { fs } = install()
    const free = fs.usage().free
    expect(free).toBeGreaterThan(100)
    let thrown: unknown = null
    try {
      fs.writeFile('/巨无霸.bin', new Uint8Array((free + 5) * 512))
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toMatch(/空间|ENOSPC/)
  })

  it('装机后磁盘是干净的（可以安全断电）', () => {
    const { dev } = install()
    expect(dev.bytes[36] & 1).toBe(0)
  })
})
