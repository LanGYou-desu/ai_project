// FAT 表：每块一个 u16 表项。0 = 空闲，0xFFFF = 链尾，其余 = 下一块。
import { BlockDevice, BLOCK_COUNT, BLOCK_SIZE } from './blockdev.ts'
import { FAT_BLOCKS, FAT_START, FIRST_DATA_BLOCK } from './superblock.ts'
import { DiskError } from './errors.ts'

export const EOC = 0xffff
export const FREE = 0

export class Fat {
  readonly entries: Uint16Array

  private constructor(entries: Uint16Array) {
    this.entries = entries
  }

  static load(dev: BlockDevice): Fat {
    const entries = new Uint16Array(BLOCK_COUNT)
    for (let b = 0; b < FAT_BLOCKS; b++) {
      const block = dev.readBlock(FAT_START + b)
      const view = new DataView(block.buffer, block.byteOffset, block.byteLength)
      for (let i = 0; i < BLOCK_SIZE / 2; i++) {
        const idx = b * (BLOCK_SIZE / 2) + i
        if (idx >= BLOCK_COUNT) break
        entries[idx] = view.getUint16(i * 2, true)
      }
    }
    return new Fat(entries)
  }

  save(dev: BlockDevice): void {
    for (let b = 0; b < FAT_BLOCKS; b++) {
      const block = new Uint8Array(BLOCK_SIZE)
      const view = new DataView(block.buffer)
      for (let i = 0; i < BLOCK_SIZE / 2; i++) {
        const idx = b * (BLOCK_SIZE / 2) + i
        if (idx >= BLOCK_COUNT) break
        view.setUint16(i * 2, this.entries[idx], true)
      }
      dev.writeBlock(FAT_START + b, block)
    }
  }

  isFree(b: number): boolean {
    return this.entries[b] === FREE
  }

  isEoc(b: number): boolean {
    return this.entries[b] === EOC
  }

  setEoc(b: number): void {
    this.entries[b] = EOC
  }

  setFree(b: number): void {
    this.entries[b] = FREE
  }

  get freeCount(): number {
    let n = 0
    for (let b = FIRST_DATA_BLOCK; b < BLOCK_COUNT; b++) if (this.entries[b] === FREE) n++
    return n
  }

  get usedCount(): number {
    let n = 0
    for (let b = FIRST_DATA_BLOCK; b < BLOCK_COUNT; b++) if (this.entries[b] !== FREE) n++
    return n
  }

  /** 从 start 沿链收集块号（含防环保护） */
  chain(start: number): number[] {
    if (start === 0) return []
    if (start >= BLOCK_COUNT) throw new DiskError('ECORRUPT', `链首块越界：${start}`)
    const out: number[] = []
    const seen = new Set<number>()
    let cur = start
    while (true) {
      if (cur >= BLOCK_COUNT) throw new DiskError('ECORRUPT', `FAT 链越界：块 ${cur}`)
      if (seen.has(cur)) throw new DiskError('ECORRUPT', `FAT 链出现环：块 ${cur}`)
      seen.add(cur)
      out.push(cur)
      const next = this.entries[cur]
      if (next === EOC) break
      if (next === FREE) throw new DiskError('ECORRUPT', `FAT 链断裂：块 ${cur} 指向空闲块`)
      cur = next
      if (out.length > BLOCK_COUNT) throw new DiskError('ECORRUPT', 'FAT 链长度异常')
    }
    return out
  }

  /** 申请 count 块（首次适应），把它们串成一条链，返回链首块号 */
  allocate(count: number): number {
    if (count <= 0) throw new DiskError('EINVAL', 'allocate 数量必须为正')
    const picked: number[] = []
    for (let b = FIRST_DATA_BLOCK; b < BLOCK_COUNT && picked.length < count; b++) {
      if (this.entries[b] === FREE) picked.push(b)
    }
    if (picked.length < count) {
      throw new DiskError('ENOSPC', `磁盘空间不足：需要 ${count} 块，仅剩 ${picked.length} 块`)
    }
    for (let i = 0; i < picked.length; i++) {
      this.entries[picked[i]] = i === picked.length - 1 ? EOC : picked[i + 1]
    }
    return picked[0]
  }

  /** 释放整条链，返回释放块数 */
  freeChain(start: number): number {
    if (start === 0) return 0
    const blocks = this.chain(start)
    for (const b of blocks) this.entries[b] = FREE
    return blocks.length
  }
}
