// VFS：命名空间 + 路径策略
// 规则：/系统 下的写入需要 sudo；/设备 是只读虚拟设备视图（由内核提供内容）。
import { DiskFs, type Entry, type WriteMeta, joinPath, splitPath } from './disk/fs.ts'
import { DiskError } from './disk/errors.ts'

export interface WriteCtx {
  sudo?: boolean
  meta?: WriteMeta
}

export interface DeviceFs {
  list(): { name: string; type: 'file' | 'dir' }[]
  read(segs: string[]): string | null
}

export class Vfs {
  dev?: DeviceFs

  constructor(public fs: DiskFs) {}

  resolve(path: string, cwd = '/'): string {
    return joinPath(splitPath(path, cwd))
  }

  isSystem(path: string, cwd = '/'): boolean {
    const p = this.resolve(path, cwd)
    return p === '/系统' || p.startsWith('/系统/')
  }

  isDevice(path: string, cwd = '/'): boolean {
    const p = this.resolve(path, cwd)
    return p === '/设备' || p.startsWith('/设备/')
  }

  private checkWrite(path: string, cwd: string, ctx: WriteCtx): void {
    if (this.isDevice(path, cwd)) throw new DiskError('EPERM', '设备文件是只读的')
    if (this.isSystem(path, cwd) && !ctx.sudo) {
      throw new DiskError('EPERM', `${this.resolve(path, cwd)} 是系统区，需要 sudo`)
    }
  }

  private checkWrites(paths: string[], cwd: string, ctx: WriteCtx): void {
    for (const p of paths) this.checkWrite(p, cwd, ctx)
  }

  // —— 只读 ——

  list(path: string, cwd = '/'): Entry[] {
    if (this.isDevice(path, cwd)) return this.deviceList(path, cwd)
    return this.fs.readdir(path, cwd)
  }

  stat(path: string, cwd = '/'): Entry {
    if (this.isDevice(path, cwd)) {
      const segs = splitPath(path, cwd)
      const kind = this.deviceKind(segs)
      const now = Math.floor(Date.now() / 1000)
      return { name: segs[segs.length - 1] ?? '/设备', type: kind, size: 0, firstBlock: 0, created: now, modified: now }
    }
    return this.fs.stat(path, cwd)
  }

  exists(path: string, cwd = '/'): boolean {
    try {
      this.stat(path, cwd)
      return true
    } catch {
      return false
    }
  }

  readBytes(path: string, cwd = '/'): Uint8Array {
    if (this.isDevice(path, cwd)) {
      const text = this.readDevice(path, cwd)
      if (text === null) throw new DiskError('ENOENT', `找不到设备文件：${this.resolve(path, cwd)}`)
      return new TextEncoder().encode(text)
    }
    return this.fs.readFile(path, cwd)
  }

  readText(path: string, cwd = '/'): string {
    if (this.isDevice(path, cwd)) {
      const text = this.readDevice(path, cwd)
      if (text === null) throw new DiskError('ENOENT', `找不到设备文件：${this.resolve(path, cwd)}`)
      return text
    }
    return this.fs.readText(path, cwd)
  }

  walk(path = '/', cwd = '/'): { path: string; entry: Entry }[] {
    const abs = this.resolve(path, cwd)
    if (this.isDevice(abs)) {
      return this.list(abs).map((e) => ({ path: joinPath([...splitPath(abs), e.name]), entry: e }))
    }
    return this.fs.walk(abs)
  }

  // —— 写入（带策略） ——

  write(path: string, data: Uint8Array | string, cwd = '/', ctx: WriteCtx = {}): Entry {
    this.checkWrite(path, cwd, ctx)
    return typeof data === 'string' ? this.fs.writeFile(path, data, cwd, ctx.meta) : this.fs.writeFile(path, data, cwd, ctx.meta)
  }

  append(path: string, data: Uint8Array | string, cwd = '/', ctx: WriteCtx = {}): Entry {
    this.checkWrite(path, cwd, ctx)
    return this.fs.appendFile(path, data, cwd)
  }

  mkdir(path: string, cwd = '/', ctx: WriteCtx = {}): Entry {
    this.checkWrite(path, cwd, ctx)
    return this.fs.mkdir(path, cwd, ctx.meta)
  }

  unlink(path: string, cwd = '/', ctx: WriteCtx & { recursive?: boolean } = {}): void {
    this.checkWrite(path, cwd, ctx)
    this.fs.unlink(path, cwd, { recursive: ctx.recursive })
  }

  rename(oldPath: string, newPath: string, cwd = '/', ctx: WriteCtx = {}): void {
    this.checkWrites([oldPath, newPath], cwd, ctx)
    this.fs.rename(oldPath, newPath, cwd)
  }

  copy(src: string, dest: string, cwd = '/', ctx: WriteCtx = {}): Entry {
    if (this.isDevice(src, cwd)) throw new DiskError('EPERM', '设备文件是只读的')
    this.checkWrite(dest, cwd, ctx)
    return this.fs.copy(src, dest, cwd)
  }

  // —— 设备视图 ——

  private deviceKind(segs: string[]): 'file' | 'dir' {
    if (segs.length <= 1) return 'dir'
    const entries = this.dev?.list() ?? []
    const top = entries.find((e) => e.name === segs[1])
    if (segs.length === 2 && top) return top.type
    if (top?.type === 'dir' && segs.length === 3) return 'file'
    return 'file'
  }

  private deviceList(path: string, cwd: string): Entry[] {
    const segs = splitPath(path, cwd)
    const now = Math.floor(Date.now() / 1000)
    const toEntry = (name: string, type: 'file' | 'dir'): Entry => ({
      name,
      type,
      size: 0,
      firstBlock: 0,
      created: now,
      modified: now,
    })
    const top = this.dev?.list() ?? []
    if (segs.length <= 1) return top.map((e) => toEntry(e.name, e.type))
    const sub = top.find((e) => e.name === segs[1])
    if (sub?.type === 'dir') {
      const items = this.dev
        ? DEVICE_INDEX[segs[1]] ?? []
        : []
      if (segs.length === 2) return items.map((n) => toEntry(n, 'file'))
    }
    throw new DiskError('ENOTDIR', `${path} 不是目录`)
  }

  private readDevice(path: string, cwd: string): string | null {
    const segs = splitPath(path, cwd)
    if (segs.length === 0) return null
    return this.dev?.read(segs) ?? null
  }
}

/** /设备 下的二级目录内容（静态索引，供 readdir 用） */
const DEVICE_INDEX: Record<string, string[]> = {
  disk: ['status', 'label', 'blocks'],
  system: ['info', 'uptime', 'theme'],
}
