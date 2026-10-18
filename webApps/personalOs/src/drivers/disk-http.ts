// 磁盘驱动：把「块设备」接到四种”硬盘控制器”上
//  http   —— 伙伴服务器（Vite 中间件 / server.js），读写项目目录里的 disk/disk.img
//  static —— 静态托管降级：只读基础镜像 + localStorage 叠层暂存
//  local  —— 纯浏览器暂存
//  memory —— 内存盘（什么都不保存）
import { IMAGE_SIZE, type Persister } from '../kernel/disk/blockdev.ts'

export class DiskConflictError extends Error {
  name = 'DiskConflict'
}

function url(rel: string): string {
  return new URL(rel, document.baseURI).toString()
}

export async function probeCompanion(): Promise<boolean> {
  try {
    const res = await fetch(url('api/hello'), { cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

export class HttpPersister implements Persister {
  readonly kind = 'http' as const
  private sha: string | null = null

  async load(): Promise<Uint8Array | null> {
    const res = await fetch(url('api/disk'), { cache: 'no-store' })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`读取磁盘失败：HTTP ${res.status}`)
    this.sha = res.headers.get('x-disk-sha')
    return new Uint8Array(await res.arrayBuffer())
  }

  async save(bytes: Uint8Array): Promise<void> {
    const headers: Record<string, string> = { 'content-type': 'application/octet-stream' }
    if (this.sha) headers['x-disk-sha'] = this.sha
    const res = await fetch(url('api/disk'), {
      method: 'PUT',
      headers,
      body: bytes as unknown as BodyInit,
      keepalive: true,
    })
    if (res.status === 409) throw new DiskConflictError('磁盘已被另一个标签页修改')
    if (!res.ok) throw new Error(`写盘失败：HTTP ${res.status}`)
    const info = (await res.json()) as { sha?: string }
    if (info.sha) this.sha = info.sha
  }
}

function bytesToB64(bytes: Uint8Array): string {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export class LocalPersister implements Persister {
  readonly kind = 'local' as const
  constructor(private key = 'personalos.disk.v1') {}

  async load(): Promise<Uint8Array | null> {
    try {
      const raw = localStorage.getItem(this.key)
      if (!raw) return null
      const bytes = b64ToBytes(raw)
      return bytes.length === IMAGE_SIZE ? bytes : null
    } catch {
      return null
    }
  }

  async save(bytes: Uint8Array): Promise<void> {
    try {
      localStorage.setItem(this.key, bytesToB64(bytes))
    } catch {
      /* 配额不足等：忽略 */
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key)
    } catch {
      /* 忽略 */
    }
  }
}

export class StaticPersister implements Persister {
  readonly kind = 'static' as const
  private overlay = new LocalPersister('personalos.disk.overlay.v1')

  async load(): Promise<Uint8Array | null> {
    const mine = await this.overlay.load()
    if (mine) return mine
    try {
      const res = await fetch(url('disk.img'), { cache: 'no-store' })
      if (!res.ok) return null
      const bytes = new Uint8Array(await res.arrayBuffer())
      return bytes.length === IMAGE_SIZE ? bytes : null
    } catch {
      return null
    }
  }

  async save(bytes: Uint8Array): Promise<void> {
    await this.overlay.save(bytes)
  }
}

export class MemoryPersister implements Persister {
  readonly kind = 'memory' as const
  async load(): Promise<Uint8Array | null> {
    return null
  }
  async save(): Promise<void> {
    /* 什么都不做 */
  }
}

export async function resolvePersister(): Promise<Persister> {
  if (await probeCompanion()) return new HttpPersister()
  return new StaticPersister()
}

// —— 镜像导入导出 ——

export function downloadImage(image: Uint8Array, filename = 'disk.img'): void {
  const blob = new Blob([image as unknown as BlobPart], { type: 'application/octet-stream' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

export function pickImageFile(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.img,application/octet-stream'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const bytes = new Uint8Array(await file.arrayBuffer())
      resolve(bytes)
    }
    input.click()
  })
}

/** 备份列表 / 回滚（仅伙伴服务器模式可用） */
export async function listBackups(): Promise<{ name: string; size: number; mtime: number }[]> {
  try {
    const res = await fetch(url('api/disk/backups'), { cache: 'no-store' })
    if (!res.ok) return []
    return (await res.json()) as { name: string; size: number; mtime: number }[]
  } catch {
    return []
  }
}

export async function restoreBackup(name: string): Promise<boolean> {
  try {
    const res = await fetch(url('api/disk/restore'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    return res.ok
  } catch {
    return false
  }
}
