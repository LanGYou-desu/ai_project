// 全局搜索：启动器里同时搜"应用"与"磁盘文件"
import type { Sys } from '../kernel/kernel.ts'

export interface SearchHit {
  kind: 'app' | 'file' | 'dir'
  id: string
  title: string
  sub?: string
  path?: string
}

export interface AppEntryLike {
  id: string
  title: string
}

export function searchApps(apps: AppEntryLike[], query: string): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return apps.map((a) => ({ kind: 'app' as const, id: a.id, title: a.title }))
  return apps
    .filter((a) => a.title.toLowerCase().includes(q) || a.id.includes(q))
    .map((a) => ({ kind: 'app' as const, id: a.id, title: a.title }))
}

export function searchFiles(sys: Sys, query: string, limit = 12): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (q.length < 1) return []
  const hits: SearchHit[] = []
  for (const root of ['/用户', '/系统/config']) {
    try {
      for (const { path, entry } of sys.fs.walk(root)) {
        if (hits.length >= limit) break
        if (entry.name.toLowerCase().includes(q)) {
          hits.push({
            kind: entry.type === 'dir' ? 'dir' : 'file',
            id: path,
            title: entry.name,
            path,
            sub: path,
          })
        }
      }
    } catch {
      /* 目录不存在：跳过 */
    }
  }
  return hits
}
