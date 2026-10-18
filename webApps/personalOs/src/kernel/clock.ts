// 系统时钟服务：一秒一跳，供菜单栏、壁纸时段色、通知等订阅
export class Clock {
  private subs = new Set<(d: Date) => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  readonly startedAt: number

  constructor(
    private nowFn: () => number = Date.now,
    readonly label = 'system',
  ) {
    this.startedAt = this.nowFn()
  }

  now(): Date {
    return new Date(this.nowFn())
  }

  nowMs(): number {
    return this.nowFn()
  }

  uptimeMs(): number {
    return this.nowFn() - this.startedAt
  }

  subscribe(fn: (d: Date) => void): () => void {
    this.subs.add(fn)
    fn(this.now())
    return () => this.subs.delete(fn)
  }

  tick(): void {
    const d = this.now()
    for (const fn of [...this.subs]) fn(d)
  }

  start(intervalMs = 1000): void {
    this.stop()
    this.timer = setInterval(() => this.tick(), intervalMs)
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}

/** 把毫秒运行时长格式化成 “3天 04:12:33” 风格 */
export function formatUptime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  const hms = `${pad(h)}:${pad(m)}:${pad(sec)}`
  return d > 0 ? `${d}天 ${hms}` : hms
}
