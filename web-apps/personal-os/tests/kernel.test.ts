// 内核：启动流程、脏位与 fsck、能力门面、镜像导入导出
import { describe, it, expect } from 'vitest'
import { Kernel } from '../src/kernel/kernel.ts'
import { BlockDevice, IMAGE_SIZE, type Persister } from '../src/kernel/disk/blockdev.ts'
import { DiskError } from '../src/kernel/disk/errors.ts'
import { Fat } from '../src/kernel/disk/fat.ts'
import { readSuperblockLoose, setDirtyBit } from '../src/kernel/disk/superblock.ts'
import { DiskConflictError } from '../src/drivers/disk-http.ts'
import { installSeed, PATHS } from '../src/services/installer.ts'
import type { KernelEvents } from '../src/kernel/events.ts'

class SnapshotPersister implements Persister {
  readonly kind = 'memory' as const
  bytes: Uint8Array | null
  constructor(bytes: Uint8Array | null = null) {
    this.bytes = bytes
  }
  async load(): Promise<Uint8Array | null> {
    return this.bytes
  }
  async save(b: Uint8Array): Promise<void> {
    this.bytes = new Uint8Array(b)
  }
}

class ConflictPersister extends SnapshotPersister {
  override async save(): Promise<void> {
    throw new DiskConflictError('CONFLICT')
  }
}

describe('内核启动与持久化', () => {
  it('首次启动：格式化新盘，镜像尺寸正确，挂载置脏', async () => {
    const p = new SnapshotPersister()
    const notes: string[] = []
    const k = await Kernel.boot(p, notes)
    expect(k.freshInstall).toBe(true)
    expect(k.dirtyShutdown).toBe(false)
    expect(k.fs.usage().files).toBe(0)

    await k.flush()
    expect(p.bytes?.length).toBe(IMAGE_SIZE)
    expect(readSuperblockLoose(k.dev).sb.flags & 1).toBe(1) // 运行中：脏位开着
    expect(notes.join('\n')).toContain('格式化')
  })

  it('干净关机后再启动：不触发 fsck，内容还在', async () => {
    const p = new SnapshotPersister()
    const k1 = await Kernel.boot(p, [])
    installSeed(k1.fs, 1700000000000)
    await k1.cleanShutdown()
    expect(readSuperblockLoose(k1.dev).sb.flags & 1).toBe(0) // 关机清除脏位

    const notes: string[] = []
    const k2 = await Kernel.boot(new SnapshotPersister(p.bytes), notes)
    expect(k2.freshInstall).toBe(false)
    expect(k2.dirtyShutdown).toBe(false)
    expect(k2.fsckReport).toBeUndefined()
    expect(k2.fs.readText(PATHS.about)).toContain('关于我')
  })

  it('崩溃后重启（脏位未清）：自动 fsck 并保住文件', async () => {
    const p = new SnapshotPersister()
    const k1 = await Kernel.boot(p, [])
    installSeed(k1.fs, 1700000000000)
    await k1.flush() // 模拟崩溃：镜像已落盘但脏位未清

    const notes: string[] = []
    const k2 = await Kernel.boot(new SnapshotPersister(p.bytes), notes)
    expect(k2.dirtyShutdown).toBe(true)
    expect(notes.join('\n')).toContain('脏位')
    expect(k2.fsckReport?.ok).toBe(true)
    expect(k2.fs.readText(PATHS.about)).toContain('关于我')
    expect(readSuperblockLoose(k2.dev).sb.flags & 1).toBe(1) // 重新挂载又置脏
  })

  it('能力门面：ro 只读、rw 不进系统区、sys 可 sudo', async () => {
    const k = await Kernel.boot(new SnapshotPersister(), [])
    installSeed(k.fs, 1700000000000)

    const ro = k.sysFor('about', 1, { fs: 'ro' })
    expect(ro.fs.readText(PATHS.about)).toContain('关于我')
    expect(() => ro.fs.write(`${PATHS.desktop}/ro.txt`, 'x')).toThrow()

    const rw = k.sysFor('files', 2, { fs: 'rw' })
    rw.fs.write(`${PATHS.desktop}/rw.txt`, 'ok')
    expect(rw.fs.readText(`${PATHS.desktop}/rw.txt`)).toBe('ok')
    let eperm: unknown = null
    try {
      rw.fs.write('/系统/禁止.txt', 'x')
    } catch (e) {
      eperm = e
    }
    expect(eperm).toBeInstanceOf(DiskError)
    expect((eperm as DiskError).code).toBe('EPERM')

    const sys = k.sysFor('terminal', 3, { fs: 'sys', allowSudo: true })
    sys.fs.write('/系统/允许.txt', 'x', { sudo: true })
    expect(sys.fs.readText('/系统/允许.txt')).toBe('x')
  })

  it('mountImage：导入合法镜像 / 拒绝尺寸错误', async () => {
    const k1 = await Kernel.boot(new SnapshotPersister(), [])
    installSeed(k1.fs, 1700000000000)
    k1.fs.writeFile('/标记.txt', 'X')
    const snapshot = k1.dev.snapshot()

    const k2 = await Kernel.boot(new SnapshotPersister(), [])
    expect(k2.fs.exists('/标记.txt')).toBe(false)
    k2.mountImage(snapshot)
    expect(k2.fs.readText('/标记.txt')).toBe('X')

    expect(() => k2.mountImage(new Uint8Array(10))).toThrowError(/尺寸/)
  })

  it('reformat：换新文件系统实例并清空内容', async () => {
    const k = await Kernel.boot(new SnapshotPersister(), [])
    installSeed(k.fs, 1700000000000)
    const fs2 = k.reformat()
    expect(k.fs).toBe(fs2)
    expect(k.vfs.fs).toBe(fs2)
    expect(fs2.usage().files).toBe(0)
    expect(fs2.usage().free).toBe(507)
  })

  it('导出镜像与设备快照一致', async () => {
    const k = await Kernel.boot(new SnapshotPersister(), [])
    installSeed(k.fs, 1700000000000)
    const image = k.exportImage()
    expect(image).toEqual(k.dev.snapshot())
  })

  it('冲突：保存被拒时停止自动保存并弹通知', async () => {
    const k = await Kernel.boot(new ConflictPersister(), [])
    const toasts: KernelEvents['toast'][] = []
    k.bus.on('toast', (t) => toasts.push(t))
    await k.flush()
    expect(k.conflict).toBe(true)
    expect(toasts).toHaveLength(1)
    expect(toasts[0].action).toBe('reload')
  })

  it('proc 表：sysFor 不建进程，进程由桌面层管理', async () => {
    const k = await Kernel.boot(new SnapshotPersister(), [])
    expect(k.procs.list()).toHaveLength(0)
    k.procs.spawn('test', '测试')
    expect(k.procs.list()).toHaveLength(1)
  })

  it('脏位 + FAT 链损坏：启动自动 fsck 并修复', async () => {
    // 构造一块脏掉的镜像：先正常装机，再把一个项目文件的链截断
    const p = new SnapshotPersister()
    const k1 = await Kernel.boot(p, [])
    installSeed(k1.fs, 1700000000000)
    setDirtyBit(k1.dev, true)
    const st = k1.fs.stat(`${PATHS.projects}/${'这个网站.md'}`)
    const fat = Fat.load(k1.dev)
    const second = fat.entries[st.firstBlock]
    fat.entries[second] = 0
    fat.save(k1.dev)
    await k1.flush()

    const notes: string[] = []
    const k2 = await Kernel.boot(new SnapshotPersister(p.bytes), notes)
    expect(k2.dirtyShutdown).toBe(true)
    expect(k2.fsckReport?.ok).toBe(true)
    expect(notes.join('\n')).toContain('fsck:')
  })
})

describe('块设备', () => {
  it('读写块与快照', () => {
    const dev = new BlockDevice()
    const block = new Uint8Array(512)
    block[0] = 42
    dev.writeBlock(7, block)
    expect(dev.readBlock(7)[0]).toBe(42)
    const snap = dev.snapshot()
    expect(snap.length).toBe(IMAGE_SIZE)
    dev.bytes[7 * 512] = 0
    expect(snap[7 * 512]).toBe(42) // 快照是拷贝
    expect(() => dev.readBlock(512)).toThrowError(/越界/)
  })
})
