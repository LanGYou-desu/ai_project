// 内核：把块设备 / 文件系统 / 日志 / 进程表 / 事件总线组装在一起，
// 对应用只暴露带“能力”约束的 Sys 门面（所有变更都会计费到进程并写审计日志）。
import { BlockDevice, IMAGE_SIZE, type Persister } from './disk/blockdev.ts'
import { DiskFs, type Entry, type WriteMeta } from './disk/fs.ts'
import { DiskError } from './disk/errors.ts'
import { fsckAnalyze, fsckRepair, type FsckReport } from './disk/fsck.ts'
import { formatDevice, readSuperblockLoose, setDirtyBit, updateSuperblock, type Superblock } from './disk/superblock.ts'
import { LogRing } from './log.ts'
import { EventBus } from './eventbus.ts'
import type { KernelEvents } from './events.ts'
import { ProcTable, type ProcInfo } from './proc.ts'
import { Clock } from './clock.ts'
import { Vfs } from './vfs.ts'

// —— 应用能力表 ——

export interface AppCaps {
  fs: 'none' | 'ro' | 'rw' | 'sys'
  /** rw 应用是否允许通过 sudo 写系统区（终端为 sys，天然允许） */
  allowSudo?: boolean
  audio?: boolean
  notify?: boolean
}

export interface AudioTrackInfo {
  id: string
  name: string
  builtin: boolean
  duration?: number
}

export interface AudioDriver {
  playTrack(id: string): Promise<void>
  toggle(): Promise<void>
  next(): Promise<void>
  prev(): Promise<void>
  stop(): void
  setVolume(v: number): void
  getVolume(): number
  state(): { trackId: string | null; playing: boolean; position: number; duration: number }
  spectrum(): Uint8Array | null
  loadFile(url: string, name: string): Promise<string>
}

export interface DiskStatus {
  mode: string
  label: string
  version: number
  total: number
  used: number
  free: number
  files: number
  dirs: number
  writes: number
  conflict: boolean
  installTime: number
}

export interface SysFs {
  list(path: string, cwd?: string): Entry[]
  stat(path: string, cwd?: string): Entry
  exists(path: string, cwd?: string): boolean
  readText(path: string, cwd?: string): string
  readBytes(path: string, cwd?: string): Uint8Array
  write(path: string, data: string | Uint8Array, opts?: { cwd?: string; sudo?: boolean }): Entry
  append(path: string, data: string | Uint8Array, opts?: { cwd?: string; sudo?: boolean }): Entry
  mkdir(path: string, opts?: { cwd?: string; sudo?: boolean }): Entry
  unlink(path: string, opts?: { cwd?: string; sudo?: boolean; recursive?: boolean }): void
  rename(oldPath: string, newPath: string, opts?: { cwd?: string; sudo?: boolean }): void
  copy(src: string, dest: string, opts?: { cwd?: string; sudo?: boolean }): Entry
  walk(path?: string, cwd?: string): { path: string; entry: Entry }[]
}

export interface Sys {
  readonly appId: string
  readonly pid: number
  readonly caps: AppCaps
  fs: SysFs
  log(level: 'info' | 'ok' | 'warn' | 'err', msg: string): void
  notify(title: string, body?: string, kind?: 'info' | 'ok' | 'warn' | 'err'): void
  readonly disk: {
    status(): DiskStatus
    usage(): { total: number; used: number; free: number; files: number; dirs: number }
    blockMap(): Uint8Array
    whoOwns(block: number): { path: string; entry: Entry } | null
    fsck(repair?: boolean): FsckReport | { before: FsckReport; after: FsckReport; fixed: string[] }
    sync(): Promise<void>
    exportImage(): Uint8Array
  }
  readonly procs: {
    list(): ProcInfo[]
    exit(pid: number): void
  }
  openApp(appId: string, arg?: string): void
  readonly power: {
    shutdown(): void
    reboot(): void
  }
  readonly audio?: AudioDriver
}

export class Kernel {
  readonly bus = new EventBus<KernelEvents>()
  readonly log = new LogRing()
  readonly clock = new Clock()
  readonly procs = new ProcTable()
  readonly vfs: Vfs
  /** 当前挂载的文件系统（导入镜像 / 重新格式化后会换新实例） */
  fs: DiskFs
  /** 启动时发现上次未正常关机 */
  readonly dirtyShutdown: boolean
  readonly freshInstall: boolean
  fsckReport?: FsckReport
  conflict = false
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private saving: Promise<void> | null = null

  constructor(
    readonly dev: BlockDevice,
    readonly persister: Persister,
    fs: DiskFs,
    opts: { dirtyShutdown: boolean; freshInstall: boolean; fsck?: FsckReport },
  ) {
    this.fs = fs
    this.dirtyShutdown = opts.dirtyShutdown
    this.freshInstall = opts.freshInstall
    this.fsckReport = opts.fsck
    this.vfs = new Vfs(fs)
    this.vfs.dev = {
      list: () => [
        { name: 'disk', type: 'dir' },
        { name: 'system', type: 'dir' },
      ],
      read: (segs) => this.readDevice(segs),
    }
  }

  static async boot(persister: Persister, notes: string[]): Promise<Kernel> {
    const image = await persister.load()
    let fresh = false
    let dev: BlockDevice
    if (image && image.length === IMAGE_SIZE) {
      dev = new BlockDevice(image)
      notes.push(`读取磁盘镜像 ${(IMAGE_SIZE / 1024).toFixed(0)} KiB（${persister.kind === 'http' ? '伙伴服务器' : persister.kind === 'static' ? '静态镜像' : '本地暂存'}）`)
    } else {
      dev = new BlockDevice()
      formatDevice(dev, { label: 'PERSONAL-OS', time: Date.now() })
      fresh = true
      notes.push('未发现磁盘镜像，已格式化为 256 KiB 新盘')
    }

    const { sb } = readSuperblockLoose(dev)
    const dirty = (sb.flags & 1) !== 0
    let fsck: FsckReport | undefined
    if (dirty && !fresh) {
      notes.push('检测到脏位：上次未正常关机，运行磁盘检查…')
      const r = fsckRepair(dev)
      fsck = r.after
      for (const f of r.fixed) notes.push(`fsck: ${f}`)
    }

    let fs: DiskFs
    try {
      fs = DiskFs.mount(dev)
    } catch {
      notes.push('挂载失败，尝试修复后重新挂载…')
      const r = fsckRepair(dev)
      fsck = r.after
      for (const f of r.fixed) notes.push(`fsck: ${f}`)
      fs = DiskFs.mount(dev)
    }
    // 挂载即置脏（并记录最近挂载时间）；正常关机时清除脏位，否则下次启动自动 fsck
    updateSuperblock(dev, { flags: readSuperblockLoose(dev).sb.flags | 1, lastMount: Date.now() })
    notes.push('挂载 / … ok')

    const kernel = new Kernel(dev, persister, fs, { dirtyShutdown: dirty, freshInstall: fresh, fsck })
    kernel.log.ok('kernel', `磁盘已挂载：${fs.label}（${fs.usage().used}/${fs.usage().total} 块已用）`)
    kernel.scheduleSave()
    return kernel
  }

  private readDevice(segs: string[]): string | null {
    if (segs.length < 2) return null
    const [top, name] = [segs[1], segs[2]]
    if (top === 'disk') {
      if (name === 'status') return JSON.stringify(this.diskStatus(), null, 2)
      if (name === 'label') return this.fs.label
      if (name === 'blocks') {
        const map = this.fs.blockMap()
        const counts = { free: 0, super: 0, fat: 0, reserved: 0, dirs: 0, files: 0 }
        for (const v of map) counts[['free', 'super', 'fat', 'reserved', 'dirs', 'files'][v] as keyof typeof counts]++
        return JSON.stringify(counts, null, 2)
      }
    }
    if (top === 'system') {
      if (name === 'info')
        return JSON.stringify(
          { hostname: 'personal-os', version: '0.1.0', owner: '主人', windows: this.procs.list().length, disk: this.fs.label },
          null,
          2,
        )
      if (name === 'uptime') return `${Math.floor(this.clock.uptimeMs() / 1000)}s`
      if (name === 'theme') return 'glass-dark'
    }
    return null
  }

  diskStatus(): DiskStatus {
    const usage = this.fs.usage()
    const sb = this.fs.superblock
    return {
      mode: this.persister.kind,
      label: this.fs.label,
      version: sb.version,
      total: usage.total * 512,
      used: usage.used * 512,
      free: usage.free * 512,
      files: usage.files,
      dirs: usage.dirs,
      writes: this.dev.writes,
      conflict: this.conflict,
      installTime: sb.installTime,
    }
  }

  // —— 落盘 ——

  scheduleSave(delayMs = 700): void {
    if (this.conflict) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      void this.flush()
    }, delayMs)
  }

  async flush(): Promise<void> {
    if (this.saving) return this.saving
    const task = (async () => {
      try {
        await this.persister.save(this.dev.snapshot())
        this.dev.clearMemoryDirty()
        this.bus.emit('disk:activity', { writes: this.dev.writes })
      } catch (e) {
        if (e instanceof Error && e.name === 'DiskConflict') {
          this.conflict = true
          this.log.err('disk', '磁盘被另一个标签页修改，已停止自动保存')
          this.bus.emit('toast', {
            title: '磁盘冲突',
            body: '这个磁盘镜像已被另一个标签页修改。为避免互相覆盖，自动保存已暂停。',
            kind: 'err',
            action: 'reload',
          })
        } else {
          this.log.warn('disk', `写盘失败：${e instanceof Error ? e.message : String(e)}`)
        }
      } finally {
        this.saving = null
      }
    })()
    this.saving = task
    return task
  }

  async cleanShutdown(): Promise<void> {
    this.log.info('power', '关机流程：同步磁盘 → 清除脏位 → 卸载')
    await this.flush()
    try {
      setDirtyBit(this.dev, false)
    } catch {
      /* 磁盘损坏：忽略 */
    }
    await this.flush()
    this.log.ok('power', '磁盘已卸载，可以安全断电')
  }

  exportImage(): Uint8Array {
    return this.dev.snapshot()
  }

  /** 导入一块新镜像（严格校验后重挂载） */
  mountImage(bytes: Uint8Array): void {
    if (bytes.length !== IMAGE_SIZE) {
      throw new Error(`镜像尺寸不合法：${bytes.length} 字节（应为 ${IMAGE_SIZE}）`)
    }
    this.dev.bytes.set(bytes)
    const fs = DiskFs.mount(this.dev) // 严格校验；损坏会抛 ECORRUPT
    this.fs = fs
    this.vfs.fs = fs
    this.conflict = false
    this.bus.emit('fs:changed', { path: '/' })
    this.scheduleSave()
  }

  /** 重新格式化 + 由调用方写入发行内容 */
  reformat(label = 'PERSONAL-OS'): DiskFs {
    formatDevice(this.dev, { label, time: Date.now() })
    const fs = DiskFs.mount(this.dev)
    this.fs = fs
    this.vfs.fs = fs
    this.conflict = false
    this.bus.emit('fs:changed', { path: '/' })
    this.scheduleSave()
    return fs
  }

  // —— 系统调用门面 ——

  sysFor(appId: string, pid: number, caps: AppCaps): Sys {
    const kernel = this
    const audit = (msg: string) => {
      kernel.procs.bump(pid)
      kernel.log.info(appId, msg)
    }
    const requireWrite = (sudo: boolean) => {
      if (caps.fs !== 'rw' && caps.fs !== 'sys') {
        throw new DiskError('EPERM', `${appId} 没有写权限（能力：${caps.fs}）`)
      }
      if (caps.fs === 'sys') return sudo
      return caps.allowSudo === true && sudo
    }

    const fs: SysFs = {
      list: (path, cwd) => this.vfs.list(path, cwd),
      stat: (path, cwd) => this.vfs.stat(path, cwd),
      exists: (path, cwd) => this.vfs.exists(path, cwd),
      readText: (path, cwd) => {
        kernel.procs.bump(pid)
        return this.vfs.readText(path, cwd)
      },
      readBytes: (path, cwd) => {
        kernel.procs.bump(pid)
        return this.vfs.readBytes(path, cwd)
      },
      write: (path, data, opts = {}) => {
        const effSudo = requireWrite(opts.sudo ?? false)
        const entry = this.vfs.write(path, data, opts.cwd ?? '/', { sudo: effSudo })
        audit(`写入 ${this.vfs.resolve(path, opts.cwd ?? '/')}（${entry.size} 字节）`)
        kernel.bus.emit('fs:changed', { path: this.vfs.resolve(path, opts.cwd ?? '/') })
        kernel.scheduleSave()
        return entry
      },
      append: (path, data, opts = {}) => {
        const effSudo = requireWrite(opts.sudo ?? false)
        const entry = this.vfs.append(path, data, opts.cwd ?? '/', { sudo: effSudo })
        audit(`追加 ${this.vfs.resolve(path, opts.cwd ?? '/')}`)
        kernel.bus.emit('fs:changed', { path: this.vfs.resolve(path, opts.cwd ?? '/') })
        kernel.scheduleSave()
        return entry
      },
      mkdir: (path, opts = {}) => {
        const effSudo = requireWrite(opts.sudo ?? false)
        const entry = this.vfs.mkdir(path, opts.cwd ?? '/', { sudo: effSudo })
        audit(`新建目录 ${this.vfs.resolve(path, opts.cwd ?? '/')}`)
        kernel.bus.emit('fs:changed', { path: this.vfs.resolve(path, opts.cwd ?? '/') })
        kernel.scheduleSave()
        return entry
      },
      unlink: (path, opts = {}) => {
        const effSudo = requireWrite(opts.sudo ?? false)
        this.vfs.unlink(path, opts.cwd ?? '/', { sudo: effSudo, recursive: opts.recursive })
        audit(`删除 ${this.vfs.resolve(path, opts.cwd ?? '/')}`)
        kernel.bus.emit('fs:changed', { path: this.vfs.resolve(path, opts.cwd ?? '/') })
        kernel.scheduleSave()
      },
      rename: (oldPath, newPath, opts = {}) => {
        const effSudo = requireWrite(opts.sudo ?? false)
        this.vfs.rename(oldPath, newPath, opts.cwd ?? '/', { sudo: effSudo })
        audit(`移动 ${this.vfs.resolve(oldPath, opts.cwd ?? '/')} → ${this.vfs.resolve(newPath, opts.cwd ?? '/')}`)
        kernel.bus.emit('fs:changed', { path: this.vfs.resolve(newPath, opts.cwd ?? '/') })
        kernel.scheduleSave()
      },
      copy: (src, dest, opts = {}) => {
        const effSudo = requireWrite(opts.sudo ?? false)
        const entry = this.vfs.copy(src, dest, opts.cwd ?? '/', { sudo: effSudo })
        audit(`复制 ${this.vfs.resolve(src, opts.cwd ?? '/')} → ${this.vfs.resolve(dest, opts.cwd ?? '/')}`)
        kernel.bus.emit('fs:changed', { path: this.vfs.resolve(dest, opts.cwd ?? '/') })
        kernel.scheduleSave()
        return entry
      },
      walk: (path = '/', cwd = '/') => this.vfs.walk(path, cwd),
    }

    const notify = (title: string, body?: string, kind: 'info' | 'ok' | 'warn' | 'err' = 'info') => {
      kernel.procs.bump(pid)
      if (caps.notify) kernel.bus.emit('toast', { title, body, kind })
      kernel.log.info(appId, `通知：${title}`)
    }

    return {
      appId,
      pid,
      caps,
      fs,
      log: (level, msg) => {
        kernel.procs.bump(pid)
        kernel.log.push(level, appId, msg)
      },
      notify,
      disk: {
        status: () => this.diskStatus(),
        usage: () => this.fs.usage(),
        blockMap: () => this.fs.blockMap(),
        whoOwns: (block) => this.fs.whoOwnsBlock(block),
        fsck: (repair = false) => {
          audit(repair ? '运行 fsck --repair' : '运行 fsck')
          if (repair) {
            const r = fsckRepair(this.dev)
            kernel.scheduleSave()
            return r
          }
          return fsckAnalyze(this.dev)
        },
        sync: async () => {
          audit('同步磁盘')
          await this.flush()
        },
        exportImage: () => this.exportImage(),
      },
      procs: {
        list: () => this.procs.list(),
        exit: (target) => {
          audit(`终止进程 ${target}`)
          this.procs.exit(target)
          this.bus.emit('ui:kill-pid', { pid: target })
          this.bus.emit('proc:changed', {})
        },
      },
      openApp: (appId, arg) => {
        kernel.procs.bump(pid)
        kernel.bus.emit('ui:open-app', { appId, arg })
      },
      power: {
        shutdown: () => kernel.bus.emit('ui:shutdown', {}),
        reboot: () => kernel.bus.emit('ui:reboot', {}),
      },
      get audio() {
        return kernel.audio
      },
    }
  }

  /** 音频驱动在 UI 侧初始化后注入 */
  audio?: AudioDriver
}
