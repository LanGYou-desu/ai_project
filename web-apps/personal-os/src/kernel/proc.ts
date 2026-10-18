// 进程表：每个窗口/应用实例 = 一个“进程”，任务管理器与系统调用审计都靠它
export type ProcState = 'running' | 'suspended'

export interface ProcInfo {
  pid: number
  appId: string
  title: string
  startedAt: number
  state: ProcState
  calls: number
  lastCallAt: number
  /** 调用速率的指数衰减值（calls/s），读取时再按时间衰减 */
  rate: number
  rateAt: number
}

export class ProcTable {
  private procs = new Map<number, ProcInfo>()
  private nextPid = 1

  constructor(private now: () => number = Date.now) {}

  spawn(appId: string, title: string): ProcInfo {
    const t = this.now()
    const p: ProcInfo = {
      pid: this.nextPid++,
      appId,
      title,
      startedAt: t,
      state: 'running',
      calls: 0,
      lastCallAt: t,
      rate: 0,
      rateAt: t,
    }
    this.procs.set(p.pid, p)
    return { ...p }
  }

  get(pid: number): ProcInfo | undefined {
    const p = this.procs.get(pid)
    return p ? { ...p } : undefined
  }

  setState(pid: number, state: ProcState): void {
    const p = this.procs.get(pid)
    if (p) p.state = state
  }

  exit(pid: number): void {
    this.procs.delete(pid)
  }

  list(): ProcInfo[] {
    return [...this.procs.values()]
      .map((p) => ({ ...p }))
      .sort((a, b) => a.pid - b.pid)
  }

  bump(pid: number, n = 1): void {
    const p = this.procs.get(pid)
    if (!p) return
    const t = this.now()
    const elapsed = Math.max(0, t - p.rateAt) / 1000
    // 半衰期 1.5 秒的指数衰减，n 次调用叠加
    p.rate = p.rate * Math.exp(-elapsed / 1.5) + n
    p.rateAt = t
    p.calls += n
    p.lastCallAt = t
  }

  /** 按当前时间衰减后的实时速率 */
  rateOf(p: ProcInfo): number {
    const elapsed = Math.max(0, this.now() - p.rateAt) / 1000
    return p.rate * Math.exp(-elapsed / 1.5)
  }
}
