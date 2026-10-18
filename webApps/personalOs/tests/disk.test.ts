// FAT-lite 文件系统：读写、路径、错误码、空间回收、块归属
import { describe, it, expect } from 'vitest'
import { BlockDevice, BLOCK_COUNT } from '../src/kernel/disk/blockdev.ts'
import { DiskFs, validateName } from '../src/kernel/disk/fs.ts'
import { DiskError } from '../src/kernel/disk/errors.ts'
import { readSuperblockLoose } from '../src/kernel/disk/superblock.ts'

function fresh(): { dev: BlockDevice; fs: DiskFs } {
  const dev = new BlockDevice()
  const fs = DiskFs.format(dev, { label: 'TEST', time: 1000000 })
  return { dev, fs }
}

function expectCode(fn: () => unknown, code: string): void {
  let thrown: unknown = null
  try {
    fn()
  } catch (e) {
    thrown = e
  }
  expect(thrown, `应当抛出 ${code}`).toBeInstanceOf(DiskError)
  expect((thrown as DiskError).code).toBe(code)
}

const bytes = (s: string) => new TextEncoder().encode(s).length

describe('磁盘文件系统（FAT-lite）', () => {
  it('格式化：超级块、空闲块、根目录', () => {
    const { dev, fs } = fresh()
    const { sb, magicOk, checksumOk } = readSuperblockLoose(dev)
    expect(magicOk).toBe(true)
    expect(checksumOk).toBe(true)
    expect(sb.label).toBe('TEST')
    expect(sb.freeBlocks).toBe(507)
    const u = fs.usage()
    expect(u.total).toBe(BLOCK_COUNT)
    expect(u.used).toBe(5) // 超级块 + 2×FAT + 引导区 + 根目录
    expect(u.free).toBe(507)
    expect(u.files).toBe(0)
    expect(u.dirs).toBe(1)
  })

  it('目录与文件的增删改查', () => {
    const { fs } = fresh()
    fs.mkdir('/文档')
    fs.writeFile('/文档/笔记.txt', '你好，世界')
    expect(fs.readText('/文档/笔记.txt')).toBe('你好，世界')
    const st = fs.stat('/文档/笔记.txt')
    expect(st.type).toBe('file')
    expect(st.size).toBe(bytes('你好，世界'))
    expect(st.created).toBeGreaterThan(0)
    expect(fs.exists('/文档/笔记.txt')).toBe(true)
    expect(fs.exists('/文档/没有.txt')).toBe(false)
  })

  it('copy：文件与目录递归复制，重名与自嵌套会报错', () => {
    const { fs } = fresh()
    fs.mkdir('/源')
    fs.mkdir('/源/子')
    fs.writeFile('/源/子/笔记.txt', '内容')
    const e = fs.copy('/源', '/备份')
    expect(e.type).toBe('dir')
    expect(fs.readText('/备份/子/笔记.txt')).toBe('内容')
    // 副本独立：改原文件不影响副本
    fs.writeFile('/源/子/笔记.txt', '改过了')
    expect(fs.readText('/备份/子/笔记.txt')).toBe('内容')
    // 单文件复制
    fs.copy('/源/子/笔记.txt', '/单文件.txt')
    expect(fs.readText('/单文件.txt')).toBe('改过了')
    // 重名报 EEXIST，目录不能复制进自身
    expectCode(() => fs.copy('/源/子/笔记.txt', '/单文件.txt'), 'EEXIST')
    expectCode(() => fs.copy('/源', '/源/子/坏'), 'EINVAL')
    // 空间账本：删除副本后块数回到复制前
    const before = fs.usage().free
    fs.copy('/源', '/临时')
    expect(fs.usage().free).toBeLessThan(before)
    fs.unlink('/临时', '/', { recursive: true })
    expect(fs.usage().free).toBe(before)
  })

  it('readdir：目录在前，名称字典序', () => {
    const { fs } = fresh()
    fs.writeFile('/b.txt', 'b')
    fs.writeFile('/a.txt', 'a')
    fs.mkdir('/zz')
    expect(fs.readdir('/').map((e) => e.name)).toEqual(['zz', 'a.txt', 'b.txt'])
  })

  it('多字节文本跨块读写一致', () => {
    const { fs } = fresh()
    const text = '行'.repeat(2000) // 6000 字节 → 12 块
    fs.writeFile('/big.txt', text)
    expect(fs.stat('/big.txt').size).toBe(6000)
    expect(fs.readText('/big.txt')).toBe(text)
    expect(fs.readFile('/big.txt').length).toBe(6000)
  })

  it('路径语义：父目录必须存在（不允许越级创建）', () => {
    const { fs } = fresh()
    expectCode(() => fs.mkdir('/不存在/子目录'), 'ENOENT')
    expectCode(() => fs.writeFile('/不存在/文件.txt', 'x'), 'ENOENT')
  })

  it('错误码：EEXIST / EISDIR / ENOTDIR / ENOTEMPTY / ENOENT / EINVAL', () => {
    const { fs } = fresh()
    fs.mkdir('/d')
    expectCode(() => fs.mkdir('/d'), 'EEXIST')
    fs.writeFile('/f.txt', 'x')
    expectCode(() => fs.writeFile('/f.txt/子.txt', 'x'), 'ENOTDIR')
    expectCode(() => fs.readText('/d'), 'EISDIR')
    fs.writeFile('/d/内.txt', 'x')
    expectCode(() => fs.unlink('/d'), 'ENOTEMPTY')
    expectCode(() => fs.readText('/没有这个'), 'ENOENT')
    expectCode(() => fs.writeFile('/' + '名'.repeat(60), 'x'), 'EINVAL') // 180 字节 > 100
    expectCode(() => validateName('a/b'), 'EINVAL')
    expectCode(() => validateName(''), 'EINVAL')
    expectCode(() => validateName('..'), 'EINVAL')
    validateName('合法名字.txt')
  })

  it('递归删除目录并把空间还回来', () => {
    const { fs } = fresh()
    const freeBefore = fs.usage().free
    fs.mkdir('/d')
    fs.writeFile('/d/a.txt', 'A'.repeat(1500))
    fs.mkdir('/d/e')
    fs.writeFile('/d/e/b.txt', 'B'.repeat(700))
    expect(fs.usage().free).toBeLessThan(freeBefore)
    fs.unlink('/d', '/', { recursive: true })
    expect(fs.usage().free).toBe(freeBefore)
    expectCode(() => fs.stat('/d'), 'ENOENT')
  })

  it('重命名文件与目录', () => {
    const { fs } = fresh()
    fs.mkdir('/旧目录')
    fs.writeFile('/旧目录/文件.txt', '内容')
    fs.rename('/旧目录/文件.txt', '/旧目录/新文件.txt')
    expect(fs.readText('/旧目录/新文件.txt')).toBe('内容')
    fs.rename('/旧目录', '/新目录')
    expect(fs.readText('/新目录/新文件.txt')).toBe('内容')
    fs.writeFile('/存在.txt', 'x')
    expectCode(() => fs.rename('/新目录', '/存在.txt'), 'EEXIST')
  })

  it('追加与 touch 的语义', () => {
    const { fs } = fresh()
    fs.appendFile('/log.txt', '第一行\n')
    fs.appendFile('/log.txt', '第二行\n')
    expect(fs.readText('/log.txt')).toBe('第一行\n第二行\n')
    fs.touch('/empty.txt')
    expect(fs.stat('/empty.txt').size).toBe(0)
    fs.touch('/log.txt')
    expect(fs.readText('/log.txt')).toBe('第一行\n第二行\n')
  })

  it('copyFile 复制内容', () => {
    const { fs } = fresh()
    fs.writeFile('/src.bin', '二进制内容'.repeat(100))
    fs.copyFile('/src.bin', '/dst.bin')
    expect(Array.from(fs.readFile('/dst.bin'))).toEqual(Array.from(fs.readFile('/src.bin')))
  })

  it('根目录随条目增长扩容（块号可搬迁）', () => {
    const { dev, fs } = fresh()
    for (let i = 0; i < 30; i++) fs.writeFile(`/文件-${String(i).padStart(2, '0')}.txt`, `第 ${i} 号`)
    expect(fs.readdir('/')).toHaveLength(30)
    const { sb } = readSuperblockLoose(dev)
    expect(sb.rootDirSize).toBeGreaterThan(512)
    expect(fs.readText('/文件-29.txt')).toBe('第 29 号')
    expect(fs.usage().files).toBe(30)
  })

  it('块归属图与 whoOwnsBlock', () => {
    const { fs } = fresh()
    fs.writeFile('/big.bin', 'A'.repeat(2000)) // 4 块
    const entry = fs.stat('/big.bin')
    expect(fs.whoOwnsBlock(entry.firstBlock)?.entry.name).toBe('big.bin')
    const map = fs.blockMap()
    expect(map[0]).toBe(1) // 超级块
    expect(map[1]).toBe(2) // FAT
    expect(map[2]).toBe(2)
    expect(map[3]).toBe(3) // 保留
    expect(map[4]).toBe(4) // 根目录
    let fileBlocks = 0
    for (let b = 0; b < BLOCK_COUNT; b++) if (map[b] === 5) fileBlocks++
    expect(fileBlocks).toBe(4)
  })

  it('walk：深度优先遍历全盘', () => {
    const { fs } = fresh()
    fs.mkdir('/x')
    fs.writeFile('/x/1.txt', '1')
    fs.writeFile('/y.txt', '2')
    const paths = fs.walk('/').map((w) => w.path)
    expect(paths).toContain('/x/1.txt')
    expect(paths).toContain('/y.txt')
    expect(paths[0]).toBe('/')
  })

  it('重新挂载后内容仍在（镜像级持久性）', () => {
    const { dev, fs } = fresh()
    fs.mkdir('/持久')
    fs.writeFile('/持久/内容.txt', '还在')
    const again = DiskFs.mount(dev)
    expect(again.readText('/持久/内容.txt')).toBe('还在')
  })

  it('删除文件后其块可被再次分配', () => {
    const { fs } = fresh()
    fs.writeFile('/a.bin', 'A'.repeat(1024))
    const freeAfterWrite = fs.usage().free
    fs.unlink('/a.bin')
    expect(fs.usage().free).toBe(freeAfterWrite + 2)
    fs.writeFile('/b.bin', 'B'.repeat(1024))
    expect(fs.usage().free).toBe(freeAfterWrite)
    expect(fs.readText('/b.bin')).toBe('B'.repeat(1024))
  })
})
