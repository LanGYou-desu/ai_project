// 块设备：一块 256 KiB 的裸内存盘（读写以 512B 块为单位）
// 持久化交给 Persister（HTTP 伙伴服务器 / localStorage 兜底），设备本身不碰网络。
export const BLOCK_SIZE = 512
export const BLOCK_COUNT = 512 // 总计 256 KiB
export const IMAGE_SIZE = BLOCK_SIZE * BLOCK_COUNT

export interface Persister {
  readonly kind: 'http' | 'static' | 'local' | 'memory'
  load(): Promise<Uint8Array | null>
  save(bytes: Uint8Array): Promise<void>
}

export class BlockDevice {
  readonly bytes: Uint8Array
  readonly blockSize = BLOCK_SIZE
  readonly blockCount = BLOCK_COUNT
  /** 累计写块次数（磁盘活动指示灯的数据源） */
  writes = 0
  private memoryDirty = false

  constructor(bytes?: Uint8Array) {
    if (bytes) {
      if (bytes.length !== IMAGE_SIZE) {
        throw new Error(`镜像尺寸不合法：${bytes.length} 字节（应为 ${IMAGE_SIZE}）`)
      }
      this.bytes = new Uint8Array(bytes)
    } else {
      this.bytes = new Uint8Array(IMAGE_SIZE)
    }
  }

  readBlock(n: number): Uint8Array {
    if (n < 0 || n >= this.blockCount) throw new RangeError(`块号越界：${n}`)
    return this.bytes.subarray(n * BLOCK_SIZE, (n + 1) * BLOCK_SIZE)
  }

  writeBlock(n: number, data: Uint8Array): void {
    if (n < 0 || n >= this.blockCount) throw new RangeError(`块号越界：${n}`)
    if (data.length !== BLOCK_SIZE) throw new Error(`块写入长度必须是 ${BLOCK_SIZE}`)
    this.bytes.set(data, n * BLOCK_SIZE)
    this.writes++
    this.memoryDirty = true
  }

  view(): DataView {
    return new DataView(this.bytes.buffer)
  }

  snapshot(): Uint8Array {
    return this.bytes.slice()
  }

  get dirtyMemory(): boolean {
    return this.memoryDirty
  }

  clearMemoryDirty(): void {
    this.memoryDirty = false
  }
}
