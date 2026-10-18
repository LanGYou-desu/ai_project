// 磁盘一致性检查与修复：损坏注入 → 检测 → 抢救重建 → 幂等
import { describe, it, expect } from 'vitest'
import { BlockDevice, BLOCK_COUNT } from '../src/kernel/disk/blockdev.ts'
import { DiskFs } from '../src/kernel/disk/fs.ts'
import { Fat } from '../src/kernel/disk/fat.ts'
import { fsckAnalyze, fsckRepair } from '../src/kernel/disk/fsck.ts'
import { readSuperblockLoose, setDirtyBit } from '../src/kernel/disk/superblock.ts'
import { mulberry32 } from '../src/kernel/rng.ts'

const NOTE = '你好，磁盘！'.repeat(50) // 900 字节 → 2 块

function populated(label = 'FSCK', time = 5000): { dev: BlockDevice; fs: DiskFs } {
  const dev = new BlockDevice()
  const fs = DiskFs.format(dev, { label, time })
  fs.mkdir('/文档')
  fs.writeFile('/文档/笔记.txt', NOTE)
  fs.writeFile('/readme.md', '# 标题\n正文内容。'.repeat(20))
  fs.writeFile('/文档/空.txt', '')
  return { dev, fs }
}

describe('fsck 检查与修复', () => {
  it('干净的盘：检查通过，无错误', () => {
    const { dev } = populated()
    const r = fsckAnalyze(dev)
    expect(r.ok).toBe(true)
    expect(r.fatal).toBeUndefined()
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0)
    expect(r.stats.files).toBe(3)
    expect(r.stats.dirs).toBe(2) // 根 + /文档
  })

  it('脏位：只报提示信息，修复时清除', () => {
    const { dev } = populated()
    setDirtyBit(dev, true)
    const r = fsckAnalyze(dev)
    expect(r.ok).toBe(true)
    expect(r.issues.some((i) => i.kind === 'dirty')).toBe(true)
    const rep = fsckRepair(dev)
    expect(rep.after.ok).toBe(true)
    expect(rep.fixed).toContain('清除脏位')
    expect(readSuperblockLoose(dev).sb.flags & 1).toBe(0)
  })

  it('超级块校验和被翻转：能被检测并修复', () => {
    const { dev } = populated('KEEP')
    dev.bytes[88] ^= 0xff // 校验和字段
    const r = fsckAnalyze(dev)
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.kind === 'checksum')).toBe(true)
    const rep = fsckRepair(dev)
    expect(rep.after.ok).toBe(true)
    expect(readSuperblockLoose(dev).checksumOk).toBe(true)
    expect(readSuperblockLoose(dev).sb.label).toBe('KEEP')
  })

  it('FAT 链被截断：文件被抢救为可达前缀', () => {
    const { dev, fs } = populated()
    const st = fs.stat('/文档/笔记.txt')
    const fat = Fat.load(dev)
    const second = fat.entries[st.firstBlock] // 第二个块号
    fat.entries[second] = 0 // 截断链
    fat.save(dev)

    const r = fsckAnalyze(dev)
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.severity === 'error')).toBe(true)

    const rep = fsckRepair(dev)
    expect(rep.after.ok).toBe(true)
    expect(rep.before.stats.files).toBe(3)

    const fs2 = DiskFs.mount(dev)
    const text = fs2.readText('/文档/笔记.txt')
    expect(text.startsWith('你好，磁盘！')).toBe(true)
    expect(text.length).toBeLessThanOrEqual(512)

    // 修复幂等
    const rep2 = fsckRepair(dev)
    expect(rep2.after.ok).toBe(true)
    expect(rep2.fixed).toEqual(['磁盘无需修复'])
  })

  it('孤儿块：检测并释放', () => {
    const { dev } = populated()
    const fat = Fat.load(dev)
    let free = -1
    for (let b = 5; b < BLOCK_COUNT; b++) {
      if (fat.entries[b] === 0) {
        free = b
        break
      }
    }
    expect(free).toBeGreaterThan(0)
    fat.entries[free] = 0xffff // 分配一个没人引用的块
    fat.save(dev)

    const r = fsckAnalyze(dev)
    expect(r.stats.orphans).toBeGreaterThan(0)
    expect(r.ok).toBe(false)

    const rep = fsckRepair(dev)
    expect(rep.after.ok).toBe(true)
    expect(rep.after.stats.orphans).toBe(0)
  })

  it('FAT 自环：检测并解除', () => {
    const { dev, fs } = populated()
    fs.writeFile('/循环.txt', 'x'.repeat(100))
    const b = fs.stat('/循环.txt').firstBlock
    const fat = Fat.load(dev)
    fat.entries[b] = b
    fat.save(dev)

    const r = fsckAnalyze(dev)
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.kind === 'cycle' || i.kind === 'chain')).toBe(true)

    const rep = fsckRepair(dev)
    expect(rep.after.ok).toBe(true)
    const fs2 = DiskFs.mount(dev)
    expect(fs2.readText('/循环.txt')).toBe('x'.repeat(100))
  })

  it('交叉链：检测并截断，内容各自保留', () => {
    const { dev, fs } = populated()
    fs.writeFile('/x.txt', 'X'.repeat(100))
    fs.writeFile('/y.txt', 'Y'.repeat(100))
    const bx = fs.stat('/x.txt').firstBlock
    const by = fs.stat('/y.txt').firstBlock
    const fat = Fat.load(dev)
    fat.entries[by] = bx // y 的链伸进 x 的块
    fat.save(dev)

    const r = fsckAnalyze(dev)
    expect(r.ok).toBe(false)
    expect(r.stats.crossLinks).toBeGreaterThan(0)

    const rep = fsckRepair(dev)
    expect(rep.after.ok).toBe(true)
    const fs2 = DiskFs.mount(dev)
    expect(fs2.readText('/x.txt')).toBe('X'.repeat(100))
    expect(fs2.readText('/y.txt')).toBe('Y'.repeat(100))
  })

  it('空闲计数被改坏：重建计数', () => {
    const { dev } = populated()
    const sb = readSuperblockLoose(dev).sb
    // 直接篡改超级块里的 freeBlocks 字段（偏移 32，u32 LE）
    dev.bytes[32] ^= 0x0f
    expect(readSuperblockLoose(dev).sb.freeBlocks).not.toBe(sb.freeBlocks)
    const r = fsckAnalyze(dev)
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.kind === 'free-count' || i.kind === 'checksum')).toBe(true)
    const rep = fsckRepair(dev)
    expect(rep.after.ok).toBe(true)
  })

  it('外来镜像（magic 不对）：致命错误，不做修复', () => {
    const dev = new BlockDevice() // 全零
    const r = fsckAnalyze(dev)
    expect(r.ok).toBe(false)
    expect(r.fatal).toBeTruthy()
    const rep = fsckRepair(dev)
    expect(rep.after.ok).toBe(false)
    expect(rep.fixed).toHaveLength(0)
  })

  it('随机位翻转 fuzz：fsck 总能修复到一致状态', () => {
    for (let round = 0; round < 12; round++) {
      const dev = new BlockDevice()
      const fs = DiskFs.format(dev, { label: 'FUZZ', time: 1000 + round })
      fs.mkdir('/数据')
      fs.writeFile('/数据/a.txt', 'AAA'.repeat(300))
      fs.writeFile('/数据/b.bin', 'B'.repeat(1500))
      fs.writeFile('/c.md', '# 标题\n内容'.repeat(10))

      // 跳过超级块（第 0 块），在其余区域翻转 6 个 bit
      const rng = mulberry32(0xc0ffee + round)
      for (let i = 0; i < 6; i++) {
        const block = 1 + Math.floor(rng() * (BLOCK_COUNT - 1))
        const off = Math.floor(rng() * 512)
        dev.bytes[block * 512 + off] ^= 1 << Math.floor(rng() * 8)
      }

      const rep = fsckRepair(dev)
      expect(
        rep.after.ok,
        `round ${round}: ${rep.before.fatal ?? rep.before.issues
          .slice(0, 3)
          .map((i) => `${i.kind}(${i.detail})`)
          .join(' / ')}`,
      ).toBe(true)
      expect(fsckAnalyze(dev).ok).toBe(true)

      const fs2 = DiskFs.mount(dev)
      expect(fs2.usage().total).toBe(BLOCK_COUNT)
    }
  })
})
