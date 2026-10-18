// 会话服务：窗口布局、主题、壁纸、自动登录等保存在磁盘 /用户/主人/配置/session.json
import { PATHS } from './installer.ts'

export interface SessionWindow {
  appId: string
  arg?: string
  x: number
  y: number
  w: number
  h: number
  minimized: boolean
  maximized: boolean
}

export interface SessionData {
  theme: 'glass-dark' | 'glass-light'
  wallpaper: string
  autoLogin: boolean
  onboarded: boolean
  windows: SessionWindow[]
  focusApp?: string
}

export const SESSION_PATH = PATHS.session

export const defaultSession: SessionData = {
  theme: 'glass-dark',
  wallpaper: 'aurora',
  autoLogin: false,
  onboarded: false,
  windows: [],
}

export interface SessionIo {
  readText(path: string): string
  write(path: string, data: string): void
}

export function loadSession(io: SessionIo): SessionData {
  try {
    const raw = JSON.parse(io.readText(SESSION_PATH)) as Partial<SessionData>
    return {
      ...defaultSession,
      ...raw,
      windows: Array.isArray(raw.windows) ? raw.windows : [],
    }
  } catch {
    return { ...defaultSession }
  }
}

export function saveSession(io: SessionIo, data: SessionData): void {
  io.write(SESSION_PATH, JSON.stringify(data, null, 2) + '\n')
}

/** 兜底：没有磁盘可用时把会话存在浏览器里 */
export function loadSessionLocal(): SessionData {
  try {
    const raw = localStorage.getItem('personalos.session')
    if (!raw) return { ...defaultSession }
    return { ...defaultSession, ...(JSON.parse(raw) as Partial<SessionData>) }
  } catch {
    return { ...defaultSession }
  }
}

export function saveSessionLocal(data: SessionData): void {
  try {
    localStorage.setItem('personalos.session', JSON.stringify(data))
  } catch {
    /* 忽略 */
  }
}
