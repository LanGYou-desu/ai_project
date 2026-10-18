// 哈希路由：URL 即桌面状态。'#/app/projects' 深链直达某个窗口。
export interface Route {
  kind: 'desktop' | 'app'
  appId?: string
  arg?: string
}

const APP_ID_RE = /^[a-z][a-z0-9-]{0,31}$/

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  if (!h || h === 'desktop') return { kind: 'desktop' }
  const parts = h.split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p)
    } catch {
      return p
    }
  })
  if (parts[0] === 'app' && parts[1] && APP_ID_RE.test(parts[1])) {
    return { kind: 'app', appId: parts[1], arg: parts.length > 2 ? parts.slice(2).join('/') : undefined }
  }
  return { kind: 'desktop' }
}

export function buildHash(r: Route): string {
  if (r.kind === 'desktop' || !r.appId) return '#/desktop'
  const segs = ['app', r.appId]
  if (r.arg) segs.push(...r.arg.split('/').map((s) => encodeURIComponent(s)))
  return '#/' + segs.join('/')
}
