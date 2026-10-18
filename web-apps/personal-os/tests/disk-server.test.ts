// 伙伴服务器（磁盘控制器）：用真实 HTTP 走一遍握手 / 读写 / 乐观锁 / 备份回滚
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createDiskHandler, IMAGE_SIZE } from '../server/disk-server.mjs'
import { BlockDevice } from '../src/kernel/disk/blockdev.ts'
import { formatDevice } from '../src/kernel/disk/superblock.ts'

let dir = ''
let server: http.Server
let base = ''

function imgWith(label: string): Uint8Array {
  const dev = new BlockDevice()
  formatDevice(dev, { label, time: 1000 })
  return dev.snapshot()
}

/** fetch 的 BodyInit 在 TS 5.7 下不接受 ArrayBufferLike 视图；拷贝成 ArrayBuffer 传递 */
function bodyOf(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer
}

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'posdisk-'))
  const handler = createDiskHandler({ dir })
  server = http.createServer((req, res) => handler(req, res))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  base = `http://127.0.0.1:${port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('伙伴服务器（磁盘控制器）', () => {
  it('GET /api/hello：握手返回容量', async () => {
    const res = await fetch(`${base}/api/hello`)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { ok: boolean; size: number }
    expect(data.ok).toBe(true)
    expect(data.size).toBe(IMAGE_SIZE)
  })

  it('还没装盘时 GET /api/disk → 404', async () => {
    const res = await fetch(`${base}/api/disk`)
    expect(res.status).toBe(404)
  })

  it('PUT 非法镜像被拒（尺寸 / magic）', async () => {
    const badSize = await fetch(`${base}/api/disk`, { method: 'PUT', body: bodyOf(new Uint8Array(100)) })
    expect(badSize.status).toBe(400)
    const badMagic = await fetch(`${base}/api/disk`, {
      method: 'PUT',
      body: bodyOf(new Uint8Array(IMAGE_SIZE)),
    })
    expect(badMagic.status).toBe(400)
  })

  it('PUT 合法镜像 → 200；GET 读回一致并带 sha 头', async () => {
    const img = imgWith('SRV')
    const put = await fetch(`${base}/api/disk`, { method: 'PUT', body: bodyOf(img) })
    expect(put.status).toBe(200)

    const res = await fetch(`${base}/api/disk`)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-disk-sha')).toBeTruthy()
    const got = new Uint8Array(await res.arrayBuffer())
    expect(got).toEqual(img)
  })

  it('sha 乐观锁：过期 sha → 409，未过期 → 200', async () => {
    const stale = await fetch(`${base}/api/disk`, {
      method: 'PUT',
      headers: { 'x-disk-sha': 'deadbeefdeadbeef' },
      body: bodyOf(imgWith('STALE')),
    })
    expect(stale.status).toBe(409)

    const cur = await fetch(`${base}/api/disk`)
    const sha = cur.headers.get('x-disk-sha') ?? ''
    const good = await fetch(`${base}/api/disk`, {
      method: 'PUT',
      headers: { 'x-disk-sha': sha },
      body: bodyOf(imgWith('GOOD')),
    })
    expect(good.status).toBe(200)
  })

  it('写盘前自动轮转备份；备份列表可读且可回滚', async () => {
    const list = await fetch(`${base}/api/disk/backups`)
    expect(list.status).toBe(200)
    const backups = (await list.json()) as { name: string; size: number; mtime: number }[]
    expect(backups.length).toBeGreaterThan(0)
    expect(backups[0].name).toMatch(/^disk-.*\.img$/)
    expect(backups[0].size).toBe(IMAGE_SIZE)

    const bad = await fetch(`${base}/api/disk/restore`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '../disk.img' }),
    })
    expect(bad.status).toBe(400)

    const ok = await fetch(`${base}/api/disk/restore`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: backups[0].name }),
    })
    expect(ok.status).toBe(200)
  })

  it('status：存在性 / 尺寸 / 备份数', async () => {
    const res = await fetch(`${base}/api/disk/status`)
    const st = (await res.json()) as {
      exists: boolean
      size: number
      backups: number
      sha: string | null
    }
    expect(st.exists).toBe(true)
    expect(st.size).toBe(IMAGE_SIZE)
    expect(st.backups).toBeGreaterThan(0)
    expect(st.sha).toBeTruthy()
  })

  it('未知 API → 404', async () => {
    const res = await fetch(`${base}/api/nope`)
    expect(res.status).toBe(404)
  })
})
