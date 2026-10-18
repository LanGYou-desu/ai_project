// DiskFs：FAT-lite 文件系统。目录 = 固定 128 字节条目的链式文件；文件 = 数据块链。
// 全部操作结束后立即同步 FAT + 超级块，保证任何时候的镜像都是一致的。
import { BlockDevice, BLOCK_COUNT, BLOCK_SIZE } from './blockdev.ts'
import { Fat } from './fat.ts'
import {
  formatDevice,
  readSuperblock,
  readSuperblockLoose,
  writeSuperblock,
  type FormatOptions,
  type Superblock,
} from './superblock.ts'
import { DiskError } from './errors.ts'

export const ENTRY_SIZE = 128
export const NAME_MAX_BYTES = 100
const NAME_OFF = 18

const enc = new TextEncoder()
const dec = new TextDecoder()

export interface Entry {
  name: string
  type: 'file' | 'dir'
  size: number
  firstBlock: number
  created: number
  modified: number
}

/** 解析路径为段落数组（处理 . 与 ..） */
export function splitPath(path: string, cwd = '/'): string[] {
  const out: string[] = path.startsWith('/') ? [] : cwd.split('/').filter(Boolean)
  for (const seg of path.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      out.pop()
      continue
    }
    out.push(seg)
  }
  return out
}

export function joinPath(segs: string[]): string {
  return '/' + segs.join('/')
}

export function validateName(name: string): void {
  if (!name || name === '.' || name === '..') throw new DiskError('EINVAL', '文件名不合法')
  if (name.includes('/') || name.includes('\u0000')) {
    throw new DiskError('EINVAL', '文件名不能包含斜杠')
  }
  if (enc.encode(name).length > NAME_MAX_BYTES) {
    throw new DiskError('EINVAL', `文件名过长（最多 ${NAME_MAX_BYTES} 字节）`)
  }
}

interface DirFrame {
  key: string
  segs: string[]
  depth: number
  dirEntry: Entry
  entries: Entry[]
}

export interface WriteMeta {
  created?: number
  modified?: number
}

export class DiskFs {
  readonly fat: Fat
  private sb: Superblock

  private constructor(readonly dev: BlockDevice) {
    this.sb = readSuperblock(dev)
    this.fat = Fat.load(dev)
  }

  static format(dev: BlockDevice, opts: FormatOptions = {}): DiskFs {
    formatDevice(dev, opts)
    return new DiskFs(dev)
  }

  /** 挂载一块已有镜像（严格校验，损坏会抛 ECORRUPT，由调用方决定是否 fsck） */
  static mount(dev: BlockDevice): DiskFs {
    return new DiskFs(dev)
  }

  get superblock(): Superblock {
    return { ...this.sb }
  }

  get label(): string {
    return this.sb.label
  }

  private nowSec(): number {
    return Math.floor(Date.now() / 1000)
  }

  private rootEntry(): Entry {
    return {
      name: '/',
      type: 'dir',
      size: this.sb.rootDirSize,
      firstBlock: this.sb.rootDirBlock,
      created: Math.floor(this.sb.installTime / 1000),
      modified: Math.floor(this.sb.lastMount / 1000),
    }
  }

  private sync(patch: Partial<Superblock> = {}): void {
    // 只把本层负责的字段（根目录块/空闲计数）写回去；
    // flags / lastMount 等外部字段以磁盘上的当前值为准，避免覆盖脏位等外部改动。
    const disk = readSuperblockLoose(this.dev).sb
    this.sb = {
      ...disk,
      ...patch,
      rootDirBlock: this.sb.rootDirBlock,
      rootDirSize: this.sb.rootDirSize,
      freeBlocks: this.fat.freeCount,
    }
    this.fat.save(this.dev)
    writeSuperblock(this.dev, this.sb)
  }

  // —— 底层读写 ——

  private readDirEntries(firstBlock: number, size: number): Entry[] {
    if (size === 0 || firstBlock === 0) return []
    let blocks: number[]
    try {
      blocks = this.fat.chain(firstBlock)
    } catch {
      return [] // 损坏的目录链：宽容返回空，交给 fsck
    }
    const data = new Uint8Array(blocks.length * BLOCK_SIZE)
    blocks.forEach((b, i) => data.set(this.dev.readBlock(b), i * BLOCK_SIZE))
    const view = new DataView(data.buffer)
    const out: Entry[] = []
    const limit = Math.min(size, blocks.length * BLOCK_SIZE)
    for (let off = 0; off + ENTRY_SIZE <= limit; off += ENTRY_SIZE) {
      const type = data[off]
      const nameLen = data[off + 2]
      if ((type !== 1 && type !== 2) || nameLen === 0 || nameLen > NAME_MAX_BYTES) continue
      const name = dec.decode(data.subarray(off + NAME_OFF, off + NAME_OFF + nameLen))
      if (!name) continue
      out.push({
        name,
        type: type === 1 ? 'file' : 'dir',
        size: view.getUint32(off + 4, true),
        firstBlock: view.getUint16(off + 8, true),
        created: view.getUint32(off + 10, true),
        modified: view.getUint32(off + 14, true),
      })
    }
    return out
  }

  private packEntries(entries: Entry[]): Uint8Array {
    const data = new Uint8Array(entries.length * ENTRY_SIZE)
    const view = new DataView(data.buffer)
    entries.forEach((e, i) => {
      const off = i * ENTRY_SIZE
      const nameBytes = enc.encode(e.name)
      data[off] = e.type === 'file' ? 1 : 2
      data[off + 2] = nameBytes.length
      view.setUint32(off + 4, e.size, true)
      view.setUint16(off + 8, e.firstBlock, true)
      view.setUint32(off + 10, e.created, true)
      view.setUint32(off + 14, e.modified, true)
      data.set(nameBytes, off + NAME_OFF)
    })
    return data
  }

  /** 写入一段字节，旧链先释放；返回新的链首与长度。minBlocks 用于让空目录至少占一块。 */
  private writeBytes(
    data: Uint8Array,
    old?: { firstBlock: number; size: number },
    minBlocks = 0,
  ): { firstBlock: number; size: number } {
    const need = Math.max(minBlocks, Math.ceil(data.length / BLOCK_SIZE))
    // 先算好旧链长度：即使旧链马上要释放，它也能腾出空间给新数据
    let oldCount = 0
    if (old && old.firstBlock) oldCount = this.fat.chain(old.firstBlock).length
    if (need > 0 && need > this.fat.freeCount + oldCount) {
      throw new DiskError('ENOSPC', `磁盘空间不足：需要 ${need} 块，仅剩 ${this.fat.freeCount + oldCount} 块`)
    }
    if (oldCount > 0) this.fat.freeChain(old!.firstBlock)
    if (need === 0) return { firstBlock: 0, size: 0 }
    const start = this.fat.allocate(need)
    const blocks = this.fat.chain(start)
    for (let i = 0; i < blocks.length; i++) {
      const block = new Uint8Array(BLOCK_SIZE)
      const from = i * BLOCK_SIZE
      block.set(data.subarray(from, Math.min(from + BLOCK_SIZE, data.length)))
      this.dev.writeBlock(blocks[i], block)
    }
    return { firstBlock: start, size: data.length }
  }

  private readBytes(firstBlock: number, size: number): Uint8Array {
    if (size === 0 || firstBlock === 0) return new Uint8Array(0)
    const blocks = this.fat.chain(firstBlock)
    const out = new Uint8Array(size)
    let written = 0
    for (const b of blocks) {
      if (written >= size) break
      const chunk = Math.min(BLOCK_SIZE, size - written)
      out.set(this.dev.readBlock(b).subarray(0, chunk), written)
      written += chunk
    }
    return out
  }

  // —— 目录框架：一次操作里共享同一组目录帧，避免重复读盘 ——

  private frame(map: Map<string, DirFrame>, segs: string[], dirEntry: Entry, depth: number): DirFrame {
    const key = joinPath(segs)
    let f = map.get(key)
    if (!f) {
      f = {
        key,
        segs,
        depth,
        dirEntry,
        entries: this.readDirEntries(dirEntry.firstBlock, dirEntry.size),
      }
      map.set(key, f)
    }
    return f
  }

  private walkTo(
    segs: string[],
    map: Map<string, DirFrame>,
  ): { parent: DirFrame; entry: Entry | null; frame: DirFrame | null; missingAt?: number } {
    const root = this.frame(map, [], this.rootEntry(), 0)
    let cur = root
    for (let i = 0; i < segs.length; i++) {
      const e = cur.entries.find((x) => x.name === segs[i])
      if (!e) return { parent: cur, entry: null, frame: null, missingAt: i }
      if (i === segs.length - 1) {
        const frame = e.type === 'dir' ? this.frame(map, segs, e, i + 1) : null
        return { parent: cur, entry: e, frame }
      }
      if (e.type !== 'dir') throw new DiskError('ENOTDIR', `${joinPath(segs.slice(0, i + 1))} 不是目录`)
      cur = this.frame(map, segs.slice(0, i + 1), e, i + 1)
    }
    return { parent: root, entry: null, frame: root }
  }

  /** 父目录必须存在（允许最后一段缺失） */
  private requireParent(missingAt: number | undefined, segs: string[]): void {
    if (missingAt !== undefined && missingAt < segs.length - 1) {
      throw new DiskError('ENOENT', `父目录不存在：${joinPath(segs.slice(0, missingAt + 1))}`)
    }
  }

  /** 自底向上把 map 里所有目录帧写回磁盘 */
  private flushFrames(map: Map<string, DirFrame>): void {
    const frames = [...map.values()].sort((a, b) => b.depth - a.depth)
    for (const f of frames) {
      const data = this.packEntries(f.entries)
      // 根目录永远保留至少一个块（超级块指向它，不能变空指针）
      const { firstBlock, size } = this.writeBytes(
        data,
        { firstBlock: f.dirEntry.firstBlock, size: f.dirEntry.size },
        f.depth === 0 ? 1 : 0,
      )
      f.dirEntry.firstBlock = firstBlock
      f.dirEntry.size = size
      if (f.depth === 0) {
        this.sb = { ...this.sb, rootDirBlock: firstBlock, rootDirSize: size }
      } else {
        const parentKey = joinPath(f.segs.slice(0, -1))
        const parent = map.get(parentKey)
        if (parent) {
          const idx = parent.entries.findIndex((e) => e.name === f.segs[f.segs.length - 1])
          if (idx >= 0) {
            parent.entries[idx] = {
              ...parent.entries[idx],
              firstBlock,
              size,
              modified: parent.entries[idx].modified,
            }
          }
        }
      }
    }
  }

  // —— 对外操作 ——

  exists(path: string, cwd = '/'): boolean {
    try {
      this.stat(path, cwd)
      return true
    } catch {
      return false
    }
  }

  stat(path: string, cwd = '/'): Entry {
    const segs = splitPath(path, cwd)
    if (segs.length === 0) {
      const r = this.rootEntry()
      return { ...r }
    }
    const map = new Map<string, DirFrame>()
    const { entry } = this.walkTo(segs, map)
    if (!entry) throw new DiskError('ENOENT', `找不到：${joinPath(segs)}`)
    return { ...entry }
  }

  readdir(path: string, cwd = '/'): Entry[] {
    const segs = splitPath(path, cwd)
    const map = new Map<string, DirFrame>()
    const { entry, frame } = segs.length === 0 ? { entry: this.rootEntry(), frame: null } : this.walkTo(segs, map)
    if (segs.length > 0 && !entry) throw new DiskError('ENOENT', `找不到：${joinPath(segs)}`)
    const target = segs.length === 0 ? this.rootEntry() : entry!
    if (target.type !== 'dir') throw new DiskError('ENOTDIR', `${joinPath(segs)} 不是目录`)
    const entries = frame ? frame.entries : this.readDirEntries(target.firstBlock, target.size)
    return entries
      .map((e) => ({ ...e }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
      })
  }

  readFile(path: string, cwd = '/'): Uint8Array {
    const entry = this.stat(path, cwd)
    if (entry.type !== 'file') throw new DiskError('EISDIR', `${path} 是目录`)
    return this.readBytes(entry.firstBlock, entry.size)
  }

  readText(path: string, cwd = '/'): string {
    return dec.decode(this.readFile(path, cwd))
  }

  private writeFileMeta(path: string, cwd: string, data: Uint8Array, meta: WriteMeta = {}): Entry {
    const segs = splitPath(path, cwd)
    if (segs.length === 0) throw new DiskError('EISDIR', '不能写入根目录')
    const name = segs[segs.length - 1]
    validateName(name)
    const map = new Map<string, DirFrame>()
    const { parent, entry, missingAt } = this.walkTo(segs, map)
    this.requireParent(missingAt, segs)
    const now = this.nowSec()
    let result: Entry
    if (entry) {
      if (entry.type === 'dir') throw new DiskError('EISDIR', `${path} 是目录`)
      const { firstBlock, size } = this.writeBytes(data, entry)
      result = { ...entry, firstBlock, size, modified: meta.modified ?? now }
      const idx = parent.entries.findIndex((e) => e.name === name)
      parent.entries[idx] = result
    } else {
      const { firstBlock, size } = this.writeBytes(data)
      result = {
        name,
        type: 'file',
        size,
        firstBlock,
        created: meta.created ?? now,
        modified: meta.modified ?? now,
      }
      parent.entries.push(result)
      parent.entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    }
    parent.dirEntry.modified = meta.modified ?? now
    this.flushFrames(map)
    this.sync()
    return { ...result }
  }

  writeFile(path: string, data: Uint8Array | string, cwd = '/', meta: WriteMeta = {}): Entry {
    const bytes = typeof data === 'string' ? enc.encode(data) : data
    return this.writeFileMeta(path, cwd, bytes, meta)
  }

  appendFile(path: string, data: Uint8Array | string, cwd = '/'): Entry {
    const bytes = typeof data === 'string' ? enc.encode(data) : data
    let existing: Uint8Array = new Uint8Array(0)
    try {
      existing = this.readFile(path, cwd)
    } catch (e) {
      if (!(e instanceof DiskError) || e.code !== 'ENOENT') throw e
    }
    const merged = new Uint8Array(existing.length + bytes.length)
    merged.set(existing)
    merged.set(bytes, existing.length)
    return this.writeFileMeta(path, cwd, merged)
  }

  mkdir(path: string, cwd = '/', meta: WriteMeta = {}): Entry {
    const segs = splitPath(path, cwd)
    if (segs.length === 0) throw new DiskError('EEXIST', '根目录已存在')
    const name = segs[segs.length - 1]
    validateName(name)
    const map = new Map<string, DirFrame>()
    const { parent, entry, missingAt } = this.walkTo(segs, map)
    this.requireParent(missingAt, segs)
    if (entry) throw new DiskError('EEXIST', `${joinPath(segs)} 已存在`)
    const now = this.nowSec()
    const created: Entry = {
      name,
      type: 'dir',
      size: 0,
      firstBlock: 0,
      created: meta.created ?? now,
      modified: meta.modified ?? now,
    }
    parent.entries.push(created)
    parent.entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    parent.dirEntry.modified = meta.modified ?? now
    this.flushFrames(map)
    this.sync()
    return { ...created }
  }

  /** 递归释放一条目录/文件的所有块 */
  private freeTree(entry: Entry): void {
    if (entry.type === 'dir' && entry.firstBlock) {
      const children = this.readDirEntries(entry.firstBlock, entry.size)
      for (const c of children) this.freeTree(c)
    }
    if (entry.firstBlock) this.fat.freeChain(entry.firstBlock)
  }

  countTree(entry: Entry): { files: number; dirs: number; bytes: number } {
    const stat = { files: 0, dirs: 0, bytes: 0 }
    const visit = (e: Entry) => {
      if (e.type === 'file') {
        stat.files++
        stat.bytes += e.size
      } else {
        stat.dirs++
        if (e.firstBlock) {
          for (const c of this.readDirEntries(e.firstBlock, e.size)) visit(c)
        }
      }
    }
    if (entry.type === 'dir' && entry.firstBlock) {
      for (const c of this.readDirEntries(entry.firstBlock, entry.size)) visit(c)
    } else if (entry.type === 'file') {
      stat.files++
      stat.bytes += entry.size
    }
    return stat
  }

  unlink(path: string, cwd = '/', opts: { recursive?: boolean } = {}): void {
    const segs = splitPath(path, cwd)
    if (segs.length === 0) throw new DiskError('EINVAL', '不能删除根目录')
    const map = new Map<string, DirFrame>()
    const { parent, entry } = this.walkTo(segs, map)
    if (!entry) throw new DiskError('ENOENT', `找不到：${joinPath(segs)}`)
    if (entry.type === 'dir') {
      const children = this.readDirEntries(entry.firstBlock, entry.size)
      if (children.length > 0 && !opts.recursive) {
        throw new DiskError('ENOTEMPTY', `目录非空：${joinPath(segs)}`)
      }
      this.freeTree(entry)
      map.delete(joinPath(segs)) // 目录已释放，别把它的陈旧帧写回去
    } else if (entry.firstBlock) {
      this.fat.freeChain(entry.firstBlock)
    }
    parent.entries = parent.entries.filter((e) => e.name !== entry.name)
    parent.dirEntry.modified = this.nowSec()
    this.flushFrames(map)
    this.sync()
  }

  rename(oldPath: string, newPath: string, cwd = '/'): void {
    const oldSegs = splitPath(oldPath, cwd)
    const newSegs = splitPath(newPath, cwd)
    if (oldSegs.length === 0 || newSegs.length === 0) throw new DiskError('EINVAL', '路径不合法')
    if (
      newSegs.length > oldSegs.length &&
      oldSegs.every((s, i) => newSegs[i] === s)
    ) {
      throw new DiskError('EINVAL', '不能把目录移动到自身内部')
    }
    const map = new Map<string, DirFrame>()
    const oldWalk = this.walkTo(oldSegs, map)
    if (!oldWalk.entry) throw new DiskError('ENOENT', `找不到：${joinPath(oldSegs)}`)
    const newWalk = this.walkTo(newSegs, map)
    this.requireParent(newWalk.missingAt, newSegs)
    if (newWalk.entry) throw new DiskError('EEXIST', `目标已存在：${joinPath(newSegs)}`)
    const newName = newSegs[newSegs.length - 1]
    validateName(newName)
    const now = this.nowSec()
    const moved: Entry = { ...oldWalk.entry, name: newName, modified: now }
    oldWalk.parent.entries = oldWalk.parent.entries.filter((e) => e.name !== oldWalk.entry!.name)
    newWalk.parent.entries.push(moved)
    newWalk.parent.entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    if (oldWalk.parent.key === newWalk.parent.key) {
      oldWalk.parent.dirEntry.modified = now
    } else {
      oldWalk.parent.dirEntry.modified = now
      newWalk.parent.dirEntry.modified = now
    }
    this.flushFrames(map)
    this.sync()
  }

  touch(path: string, cwd = '/'): Entry {
    try {
      const e = this.stat(path, cwd)
      if (e.type === 'dir') throw new DiskError('EISDIR', `${path} 是目录`)
      return e
    } catch (e) {
      if (e instanceof DiskError && e.code === 'ENOENT') return this.writeFile(path, '', cwd)
      throw e
    }
  }

  copyFile(src: string, dest: string, cwd = '/'): Entry {
    const data = this.readFile(src, cwd)
    return this.writeFile(dest, data, cwd)
  }

  /** 复制文件或目录（目录递归）；目标已存在时报 EEXIST */
  copy(src: string, dest: string, cwd = '/'): Entry {
    if (this.exists(dest, cwd)) throw new DiskError('EEXIST', `目标已存在：${dest}`)
    const entry = this.stat(src, cwd)
    if (entry.type === 'file') return this.copyFile(src, dest, cwd)
    const srcSegs = splitPath(src, cwd)
    const destSegs = splitPath(dest, cwd)
    if (destSegs.length > srcSegs.length && srcSegs.every((s, i) => destSegs[i] === s)) {
      throw new DiskError('EINVAL', '不能把目录复制到自身内部')
    }
    const out = this.mkdir(dest, cwd)
    try {
      for (const child of this.readdir(src, cwd)) {
        this.copy(joinPath([...srcSegs, child.name]), joinPath([...destSegs, child.name]), cwd)
      }
    } catch (e) {
      // 复制中途失败：尽力清掉半成品，别留垃圾
      try {
        this.unlink(dest, cwd, { recursive: true })
      } catch {
        /* 清理失败则保留现状 */
      }
      throw e
    }
    return out
  }

  usage(): { total: number; used: number; free: number; files: number; dirs: number } {
    const counts = this.countTree(this.rootEntry())
    return {
      total: BLOCK_COUNT,
      used: BLOCK_COUNT - this.fat.freeCount,
      free: this.fat.freeCount,
      files: counts.files,
      dirs: counts.dirs + 1, // 含根目录
    }
  }

  /** 全盘遍历（深度优先，按名称排序） */
  walk(rootPath = '/'): { path: string; entry: Entry }[] {
    const out: { path: string; entry: Entry }[] = []
    const rootSegs = splitPath(rootPath)
    const map = new Map<string, DirFrame>()
    const start = rootSegs.length === 0 ? this.rootEntry() : this.walkTo(rootSegs, map).entry
    if (!start) throw new DiskError('ENOENT', `找不到：${rootPath}`)
    const visit = (entry: Entry, segs: string[], depth: number) => {
      if (depth > 24) return
      const path = joinPath(segs)
      out.push({ path, entry })
      if (entry.type === 'dir' && entry.firstBlock) {
        const children = this.readDirEntries(entry.firstBlock, entry.size)
          .slice()
          .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        for (const c of children) visit(c, [...segs, c.name], depth + 1)
      }
    }
    visit(start, rootSegs, 0)
    return out
  }

  /** 块归属图：0 空闲 / 1 超级块 / 2 FAT / 3 保留 / 4 目录 / 5 文件 */
  blockMap(): Uint8Array {
    const map = new Uint8Array(BLOCK_COUNT)
    map[0] = 1
    map[1] = 2
    map[2] = 2
    map[3] = 3
    const mark = (entry: Entry, kind: number) => {
      if (!entry.firstBlock) return
      try {
        for (const b of this.fat.chain(entry.firstBlock)) map[b] = kind
      } catch {
        /* 损坏链：跳过，fsck 负责 */
      }
    }
    mark(this.rootEntry(), 4)
    for (const { entry } of this.walk()) {
      if (entry.name === '/') continue
      mark(entry, entry.type === 'dir' ? 4 : 5)
    }
    return map
  }

  /** 某块属于哪个文件/目录 */
  whoOwnsBlock(n: number): { path: string; entry: Entry } | null {
    const check = (entry: Entry, path: string) => {
      if (!entry.firstBlock) return null
      try {
        return this.fat.chain(entry.firstBlock).includes(n) ? { path, entry } : null
      } catch {
        return null
      }
    }
    const rootHit = check(this.rootEntry(), '/')
    if (rootHit) return rootHit
    for (const { path, entry } of this.walk()) {
      if (entry.name === '/') continue
      const hit = check(entry, path)
      if (hit) return hit
    }
    return null
  }
}
