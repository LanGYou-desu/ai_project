// fsck：磁盘一致性检查与修复
// 分析：校验超级块、FAT、目录项、交叉链、孤儿块、空闲计数、脏位
// 修复：抢救“可达”的目录树 -> 重新格式化 -> 原样写回（按构造保证一致性，且修复幂等）
import { BlockDevice, BLOCK_COUNT, BLOCK_SIZE } from './blockdev.ts'
import { Fat, EOC } from './fat.ts'
import { formatDevice, readSuperblockLoose, setDirtyBit, type Superblock } from './superblock.ts'
import { DiskFs } from './fs.ts'
import { NAME_MAX_BYTES, ENTRY_SIZE } from './fs.ts'

export interface FsckIssue {
  kind: string
  detail: string
  block?: number
  path?: string
  severity: 'info' | 'error'
}

export interface FsckReport {
  ok: boolean
  fatal?: string
  issues: FsckIssue[]
  super?: Superblock
  stats: {
    blocks: number
    used: number
    free: number
    files: number
    dirs: number
    crossLinks: number
    orphans: number
  }
}

const enc = new TextEncoder()
const dec = new TextDecoder()

interface RawEntry {
  name: string
  type: 1 | 2
  size: number
  firstBlock: number
  created: number
  modified: number
}

/** 沿 FAT 安全取链：越界/断裂/成环即停，返回可走的块前缀 */
function chainSafe(
  fat: Uint16Array,
  start: number,
): { blocks: number[]; broken?: 'range' | 'free-link' | 'cycle' | 'reserved' } {
  const blocks: number[] = []
  if (start === 0) return { blocks }
  if (start < 4 || start >= BLOCK_COUNT) return { blocks, broken: 'range' }
  const seen = new Set<number>()
  let cur = start
  while (true) {
    if (seen.has(cur)) return { blocks, broken: 'cycle' }
    seen.add(cur)
    blocks.push(cur)
    const next = fat[cur]
    if (next === EOC) return { blocks }
    if (next === 0) return { blocks, broken: 'free-link' }
    if (next >= BLOCK_COUNT || next < 4) return { blocks, broken: 'range' }
    cur = next
    if (blocks.length > BLOCK_COUNT) return { blocks, broken: 'cycle' }
  }
}

function readDirRaw(
  dev: BlockDevice,
  fat: Uint16Array,
  firstBlock: number,
  size: number,
  repairMode = false,
): { entries: RawEntry[]; broken?: 'range' | 'free-link' | 'cycle' | 'reserved' } {
  if (size === 0 || firstBlock === 0) return { entries: [] }
  const { blocks, broken } = chainSafe(fat, firstBlock)
  const data = new Uint8Array(blocks.length * BLOCK_SIZE)
  blocks.forEach((b, i) => data.set(dev.readBlock(b), i * BLOCK_SIZE))
  const view = new DataView(data.buffer)
  const out: RawEntry[] = []
  const limit = Math.min(size, blocks.length * BLOCK_SIZE)
  for (let off = 0; off + ENTRY_SIZE <= limit; off += ENTRY_SIZE) {
    const type = data[off]
    const nameLen = data[off + 2]
    if ((type !== 1 && type !== 2) || nameLen === 0 || nameLen > NAME_MAX_BYTES) continue
    const name = dec.decode(data.subarray(off + 18, off + 18 + nameLen))
    if (!name || name.includes('/')) continue
    out.push({
      name,
      type,
      size: view.getUint32(off + 4, true),
      firstBlock: view.getUint16(off + 8, true),
      created: view.getUint32(off + 10, true),
      modified: view.getUint32(off + 14, true),
    })
  }
  return { entries: out, broken }
}

export function fsckAnalyze(dev: BlockDevice): FsckReport {
  const issues: FsckIssue[] = []
  const stats = { blocks: BLOCK_COUNT, used: 0, free: 0, files: 0, dirs: 0, crossLinks: 0, orphans: 0 }
  const { sb, magicOk, checksumOk } = readSuperblockLoose(dev)
  if (!magicOk) {
    return {
      ok: false,
      fatal: '磁盘 magic 不匹配（不是 POSDISK1 镜像）',
      issues: [{ kind: 'magic', detail: 'magic 校验失败', severity: 'error' }],
      stats,
    }
  }
  if (sb.blockSize !== BLOCK_SIZE || sb.blockCount !== BLOCK_COUNT) {
    return {
      ok: false,
      fatal: '磁盘几何参数不匹配',
      issues: [{ kind: 'geometry', detail: `blockSize=${sb.blockSize} blockCount=${sb.blockCount}`, severity: 'error' }],
      super: sb,
      stats,
    }
  }
  if (!checksumOk) {
    issues.push({ kind: 'checksum', detail: '超级块校验和不匹配', severity: 'error' })
  }
  if (sb.flags & 1) {
    issues.push({ kind: 'dirty', detail: '上次未正常关机（脏位未清除）', severity: 'info' })
  }

  const fat = Fat.load(dev).entries
  // 保留区必须占用
  for (let b = 0; b < 4; b++) {
    if (fat[b] === 0) issues.push({ kind: 'fat-reserved', detail: `保留块 ${b} 未被占用`, block: b, severity: 'error' })
  }
  // FAT 表项范围检查
  for (let b = 0; b < BLOCK_COUNT; b++) {
    const v = fat[b]
    if (v !== 0 && v !== EOC && (v >= BLOCK_COUNT || v < 4)) {
      issues.push({ kind: 'fat-link', detail: `块 ${b} 的 FAT 表项越界：${v}`, block: b, severity: 'error' })
    }
  }

  const claim = new Int32Array(BLOCK_COUNT).fill(-1) // 块 -> 归属序号
  const owners: string[] = []
  let nextOwner = 0

  const claimChain = (start: number, path: string): void => {
    const { blocks, broken } = chainSafe(fat, start)
    if (broken) {
      issues.push({ kind: broken === 'cycle' ? 'cycle' : 'chain', detail: `链损坏（${broken}）：${path}`, path, severity: 'error' })
    }
    for (const b of blocks) {
      if (claim[b] === -1) {
        claim[b] = nextOwner
      } else if (owners[claim[b]] !== path) {
        stats.crossLinks++
        issues.push({
          kind: 'cross-link',
          detail: `块 ${b} 被多个条目引用：${owners[claim[b]]} 与 ${path}`,
          block: b,
          path,
          severity: 'error',
        })
      }
    }
    owners[nextOwner++] = path
  }

  const visitDir = (firstBlock: number, size: number, path: string, depth: number): void => {
    stats.dirs++
    claimChain(firstBlock, path)
    if (depth > 24) return
    const { entries } = readDirRaw(dev, fat, firstBlock, size)
    for (const e of entries) {
      const childPath = (path === '/' ? '' : path) + '/' + e.name
      if (e.type === 1) stats.files++
      if (e.type === 2) {
        if (e.firstBlock === 0 && e.size > 0) {
          issues.push({ kind: 'entry', detail: `目录大小异常：${childPath}`, path: childPath, severity: 'error' })
          stats.dirs++
          continue
        }
        if (e.firstBlock === 0) {
          stats.dirs++
        } else {
          visitDir(e.firstBlock, e.size, childPath, depth + 1)
        }
        continue
      }
      // 文件
      if (e.size > 0) {
        if (e.firstBlock === 0) {
          issues.push({ kind: 'entry', detail: `文件缺少数据块：${childPath}`, path: childPath, severity: 'error' })
          continue
        }
        const { blocks } = chainSafe(fat, e.firstBlock)
        const capacity = blocks.length * BLOCK_SIZE
        if (e.size > capacity) {
          issues.push({ kind: 'size', detail: `文件大小超出链容量：${childPath}`, path: childPath, severity: 'error' })
        }
        claimChain(e.firstBlock, childPath)
      } else if (e.firstBlock !== 0) {
        issues.push({ kind: 'entry', detail: `空文件仍占用数据块：${childPath}`, path: childPath, severity: 'error' })
        claimChain(e.firstBlock, childPath)
      }
    }
  }

  if (sb.rootDirBlock < 4 || sb.rootDirBlock >= BLOCK_COUNT) {
    issues.push({ kind: 'root', detail: `根目录块越界：${sb.rootDirBlock}`, severity: 'error' })
  } else {
    visitDir(sb.rootDirBlock, sb.rootDirSize, '/', 0)
  }

  // 孤儿块
  for (let b = 4; b < BLOCK_COUNT; b++) {
    if (fat[b] !== 0 && claim[b] === -1) stats.orphans++
  }
  if (stats.orphans > 0) {
    issues.push({ kind: 'orphan', detail: `${stats.orphans} 个已分配但不可达的孤儿块`, severity: 'error' })
  }

  // 空闲计数
  let freeActual = 0
  for (let b = 0; b < BLOCK_COUNT; b++) if (fat[b] === 0) freeActual++
  stats.free = freeActual
  stats.used = BLOCK_COUNT - freeActual
  if (freeActual !== sb.freeBlocks) {
    issues.push({
      kind: 'free-count',
      detail: `空闲块计数不符：超级块 ${sb.freeBlocks}，实际 ${freeActual}`,
      severity: 'error',
    })
  }

  const ok = !issues.some((i) => i.severity === 'error')
  return { ok, issues, super: sb, stats }
}

// —— 抢救与重建 ——

interface SalvagedDir {
  name: string
  created: number
  modified: number
  dirs: SalvagedDir[]
  files: { name: string; created: number; modified: number; data: Uint8Array }[]
}

function salvage(dev: BlockDevice): SalvagedDir | null {
  const fat = Fat.load(dev).entries
  const { sb } = readSuperblockLoose(dev)
  const visited = new Set<number>()

  const readFileData = (firstBlock: number, size: number): Uint8Array => {
    const { blocks } = chainSafe(fat, firstBlock)
    const capacity = blocks.length * BLOCK_SIZE
    const len = Math.min(size, capacity)
    const out = new Uint8Array(len)
    let written = 0
    for (const b of blocks) {
      if (written >= len) break
      const chunk = Math.min(BLOCK_SIZE, len - written)
      out.set(dev.readBlock(b).subarray(0, chunk), written)
      written += chunk
    }
    return out
  }

  const visitDir = (firstBlock: number, size: number, name: string): SalvagedDir => {
    const dir: SalvagedDir = { name, created: 0, modified: 0, dirs: [], files: [] }
    if (firstBlock === 0 || size === 0) return dir
    if (visited.has(firstBlock)) return dir // 交叉链/环：只抢救第一次遇到的分支
    visited.add(firstBlock)
    const { entries } = readDirRaw(dev, fat, firstBlock, size, true)
    for (const e of entries) {
      if (e.type === 2) {
        if (e.firstBlock !== 0) dir.dirs.push(visitDir(e.firstBlock, e.size, e.name))
        else dir.dirs.push({ name: e.name, created: e.created, modified: e.modified, dirs: [], files: [] })
      } else {
        dir.files.push({ name: e.name, created: e.created, modified: e.modified, data: readFileData(e.firstBlock, e.size) })
      }
    }
    return dir
  }

  if (sb.rootDirBlock < 4 || sb.rootDirBlock >= BLOCK_COUNT) return null
  const root = visitDir(sb.rootDirBlock, sb.rootDirSize, '/')
  root.name = '/'
  return root
}

function writeSalvaged(fs: DiskFs, dir: SalvagedDir, prefix: string): void {
  for (const sub of dir.dirs) {
    const p = prefix + '/' + sub.name
    try {
      fs.mkdir(p, '/', { created: sub.created, modified: sub.modified })
      writeSalvaged(fs, sub, p)
    } catch {
      /* 名字冲突等：跳过 */
    }
  }
  for (const f of dir.files) {
    try {
      fs.writeFile(prefix + '/' + f.name, f.data, '/', { created: f.created, modified: f.modified })
    } catch {
      /* 空间不足等：跳过 */
    }
  }
}

export function fsckRepair(dev: BlockDevice): { before: FsckReport; after: FsckReport; fixed: string[] } {
  const before = fsckAnalyze(dev)
  if (before.fatal) return { before, after: before, fixed: [] }
  const sb = before.super!
  const salvaged = salvage(dev)
  formatDevice(dev, { label: sb.label, time: sb.installTime })
  if (salvaged) {
    const fs = DiskFs.mount(dev)
    writeSalvaged(fs, salvaged, '')
  }
  setDirtyBit(dev, false)
  const after = fsckAnalyze(dev)

  const fixed: string[] = []
  const count = (kind: string) => before.issues.filter((i) => i.kind === kind).length
  if (count('cross-link') > 0) fixed.push(`截断交叉链 ${count('cross-link')} 处`)
  if (before.stats.orphans > 0) fixed.push(`释放孤儿块 ${before.stats.orphans} 个`)
  if (count('fat-link') > 0) fixed.push(`修正越界 FAT 表项 ${count('fat-link')} 个`)
  if (count('fat-reserved') > 0) fixed.push(`恢复保留块 ${count('fat-reserved')} 个`)
  if (count('entry') > 0) fixed.push(`修正异常目录项 ${count('entry')} 个`)
  if (count('size') > 0) fixed.push(`截断超容量文件 ${count('size')} 个`)
  if (count('cycle') > 0) fixed.push(`解除 FAT 环 ${count('cycle')} 处`)
  if (count('chain') > 0) fixed.push(`修复断裂链 ${count('chain')} 处`)
  if (count('free-count') > 0) fixed.push('重建空闲块计数')
  if (count('checksum') > 0) fixed.push('重写超级块校验和')
  if (count('root') > 0) fixed.push('重建根目录')
  if (count('dirty') > 0) fixed.push('清除脏位')
  if (fixed.length === 0) fixed.push('磁盘无需修复')
  return { before, after, fixed }
}
