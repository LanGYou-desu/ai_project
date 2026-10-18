// 超级块：磁盘的“身份证”。magic + 校验和 + 元信息 + 脏位。
import { BlockDevice, BLOCK_COUNT, BLOCK_SIZE } from './blockdev.ts'
import { DiskError } from './errors.ts'

export const MAGIC = 'POSDISK1'
export const VERSION = 1
export const FAT_START = 1
export const FAT_BLOCKS = 2
/** 块 3 是保留的“引导区”，根目录从数据区首块开始（可随内容增长搬迁） */
export const RESERVED_END = 3
export const ROOT_DIR_BLOCK = 4
export const FIRST_DATA_BLOCK = 4
export const SB_FLAG_DIRTY = 1
const CHECKSUM_OFF = 88

export interface Superblock {
  version: number
  blockSize: number
  blockCount: number
  fatStart: number
  fatBlocks: number
  rootDirBlock: number
  rootDirSize: number
  freeBlocks: number
  flags: number
  installTime: number
  lastMount: number
  label: string
}

export function fnv1a(buf: Uint8Array, start = 0, end = buf.length): number {
  let h = 0x811c9dc5
  for (let i = start; i < end; i++) {
    h ^= buf[i]
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const enc = new TextEncoder()
const dec = new TextDecoder()

export function isDirty(sb: Superblock): boolean {
  return (sb.flags & SB_FLAG_DIRTY) !== 0
}

export function writeSuperblock(dev: BlockDevice, sb: Superblock): void {
  const block = new Uint8Array(BLOCK_SIZE)
  const view = new DataView(block.buffer)
  for (let i = 0; i < MAGIC.length; i++) block[i] = MAGIC.charCodeAt(i)
  view.setUint16(8, sb.version, true)
  view.setUint16(10, sb.blockSize, true)
  view.setUint32(12, sb.blockCount, true)
  view.setUint32(16, sb.fatStart, true)
  view.setUint16(20, sb.fatBlocks, true)
  view.setUint32(24, sb.rootDirBlock, true)
  view.setUint32(28, sb.rootDirSize, true)
  view.setUint32(32, sb.freeBlocks, true)
  block[36] = sb.flags & 0xff
  view.setFloat64(40, sb.installTime, true)
  view.setFloat64(48, sb.lastMount, true)
  const labelBytes = enc.encode(sb.label).subarray(0, 32)
  block.set(labelBytes, 56)
  const checksum = fnv1a(block, 0, CHECKSUM_OFF)
  view.setUint32(CHECKSUM_OFF, checksum, true)
  dev.writeBlock(0, block)
}

export interface LooseRead {
  sb: Superblock
  magicOk: boolean
  checksumOk: boolean
}

/** 宽容读取：校验和坏了也能解析（fsck 用） */
export function readSuperblockLoose(dev: BlockDevice): LooseRead {
  const block = dev.readBlock(0)
  let magicOk = true
  for (let i = 0; i < MAGIC.length; i++) {
    if (block[i] !== MAGIC.charCodeAt(i)) {
      magicOk = false
      break
    }
  }
  const view = new DataView(block.buffer, block.byteOffset, block.byteLength)
  const sb: Superblock = {
    version: view.getUint16(8, true),
    blockSize: view.getUint16(10, true),
    blockCount: view.getUint32(12, true),
    fatStart: view.getUint32(16, true),
    fatBlocks: view.getUint16(20, true),
    rootDirBlock: view.getUint32(24, true),
    rootDirSize: view.getUint32(28, true),
    freeBlocks: view.getUint32(32, true),
    flags: block[36],
    installTime: view.getFloat64(40, true),
    lastMount: view.getFloat64(48, true),
    label: dec.decode(block.subarray(56, 88)).replace(/\0+$/, ''),
  }
  const stored = view.getUint32(CHECKSUM_OFF, true)
  const actual = fnv1a(block, 0, CHECKSUM_OFF)
  return { sb, magicOk, checksumOk: stored === actual }
}

/** 严格读取：magic / 几何参数 / 校验和，任何一项不合法都抛 ECORRUPT */
export function readSuperblock(dev: BlockDevice): Superblock {
  const { sb, magicOk, checksumOk } = readSuperblockLoose(dev)
  if (!magicOk) throw new DiskError('ECORRUPT', '磁盘 magic 不匹配（不是 POSDISK1 镜像）')
  if (!checksumOk) throw new DiskError('ECORRUPT', '超级块校验和不匹配')
  if (sb.version !== VERSION) throw new DiskError('ECORRUPT', `不支持的磁盘版本：${sb.version}`)
  if (sb.blockSize !== BLOCK_SIZE || sb.blockCount !== BLOCK_COUNT) {
    throw new DiskError('ECORRUPT', '磁盘几何参数不匹配')
  }
  return sb
}

export function updateSuperblock(
  dev: BlockDevice,
  patch: Partial<Superblock>,
): Superblock {
  const sb = readSuperblock(dev)
  const next = { ...sb, ...patch }
  writeSuperblock(dev, next)
  return next
}

export function setDirtyBit(dev: BlockDevice, dirty: boolean): Superblock {
  const sb = readSuperblock(dev)
  const flags = dirty ? sb.flags | SB_FLAG_DIRTY : sb.flags & ~SB_FLAG_DIRTY
  const next = { ...sb, flags }
  writeSuperblock(dev, next)
  return next
}

export interface FormatOptions {
  label?: string
  time?: number
}

/** 格式化：制造一块干净的空盘（同参数必然逐字节一致） */
export function formatDevice(dev: BlockDevice, opts: FormatOptions = {}): Superblock {
  const { label = 'PERSONAL-OS', time = Date.now() } = opts
  dev.bytes.fill(0)
  // 保留块 0..3（超级块 / FAT / 引导区）与根目录首块全部标记为链尾
  const fatBytes = new Uint8Array(2 * BLOCK_SIZE)
  const fatView = new DataView(fatBytes.buffer)
  for (let i = 0; i <= FIRST_DATA_BLOCK; i++) fatView.setUint16(i * 2, 0xffff, true)
  dev.writeBlock(FAT_START, fatBytes.subarray(0, BLOCK_SIZE))
  dev.writeBlock(FAT_START + 1, fatBytes.subarray(BLOCK_SIZE))
  // 根目录块（空）
  dev.writeBlock(ROOT_DIR_BLOCK, new Uint8Array(BLOCK_SIZE))

  const sb: Superblock = {
    version: VERSION,
    blockSize: BLOCK_SIZE,
    blockCount: BLOCK_COUNT,
    fatStart: FAT_START,
    fatBlocks: FAT_BLOCKS,
    rootDirBlock: ROOT_DIR_BLOCK,
    rootDirSize: 0,
    freeBlocks: BLOCK_COUNT - FIRST_DATA_BLOCK - 1,
    flags: 0,
    installTime: time,
    lastMount: time,
    label,
  }
  writeSuperblock(dev, sb)
  dev.clearMemoryDirty()
  return sb
}
