// 内核日志：环形缓冲 + 订阅（dmesg / 任务管理器 / 系统日志文件都读这里）
export type LogLevel = 'info' | 'ok' | 'warn' | 'err'

export interface LogEntry {
  seq: number
  t: number
  level: LogLevel
  tag: string
  msg: string
}

export class LogRing {
  private buf: LogEntry[] = []
  private seq = 0
  private subs = new Set<(e: LogEntry) => void>()

  constructor(public cap = 800) {}

  push(level: LogLevel, tag: string, msg: string, t = Date.now()): LogEntry {
    const e: LogEntry = { seq: ++this.seq, t, level, tag, msg }
    this.buf.push(e)
    if (this.buf.length > this.cap) this.buf.splice(0, this.buf.length - this.cap)
    for (const fn of [...this.subs]) fn(e)
    return e
  }

  info(tag: string, msg: string, t?: number) {
    return this.push('info', tag, msg, t)
  }
  ok(tag: string, msg: string, t?: number) {
    return this.push('ok', tag, msg, t)
  }
  warn(tag: string, msg: string, t?: number) {
    return this.push('warn', tag, msg, t)
  }
  err(tag: string, msg: string, t?: number) {
    return this.push('err', tag, msg, t)
  }

  tail(n = 50): LogEntry[] {
    return this.buf.slice(-n)
  }

  get size(): number {
    return this.buf.length
  }

  clear(): void {
    this.buf = []
  }

  subscribe(fn: (e: LogEntry) => void): () => void {
    this.subs.add(fn)
    return () => this.subs.delete(fn)
  }
}
