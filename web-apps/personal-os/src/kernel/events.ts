// 内核事件总线的类型表
import { EventBus } from './eventbus.ts'
import type { LogEntry } from './log.ts'

// 注意：这里必须是 type 别名（interface 不满足 EventBus 的 Record 约束）
export type KernelEvents = {
  /** 内核日志新增一条 */
  log: LogEntry
  /** 文件系统发生变更 */
  'fs:changed': { path: string }
  /** 进程表变化（开/关进程、状态变化） */
  'proc:changed': Record<string, never>
  /** 磁盘发生写活动（驱动菜单栏指示灯） */
  'disk:activity': { writes: number }
  /** 请求弹出一条通知 */
  toast: { title: string; body?: string; kind?: 'info' | 'ok' | 'warn' | 'err'; action?: 'reload' | 'none' }
  /** 请求桌面环境打开某个应用（终端 open 命令 / 启动器 / Finder） */
  'ui:open-app': { appId: string; arg?: string }
  /** 请求桌面环境按 pid 关闭某个窗口（终端 kill 命令 / 任务管理器） */
  'ui:kill-pid': { pid: number }
  /** 电源事件 */
  'ui:shutdown': Record<string, never>
  'ui:reboot': Record<string, never>
}

export type KernelBus = EventBus<KernelEvents>
