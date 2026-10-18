// 虚拟磁盘的「硬盘控制器」：一个哑块存储服务。
// 只认识 256 KiB 二进制块流与 sha 乐观锁；文件系统逻辑全部在浏览器里的内核中。
// 被 vite 中间件（开发模式）与 server.js（生产模式）复用。
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const IMAGE_SIZE = 512 * 512 // 256 KiB
export const MAGIC = 'POSDISK1'
const BACKUP_KEEP = 8

function sha16(buf) {
  return createHash('sha256').update(buf).digest('hex').slice(0, 16)
}

function validImage(buf) {
  if (buf.length !== IMAGE_SIZE) {
    return `镜像尺寸不合法：${buf.length} 字节（应为 ${IMAGE_SIZE}）`
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (buf[i] !== MAGIC.charCodeAt(i)) {
      return 'magic 不匹配：这不是 personal-os 磁盘镜像'
    }
  }
  return null
}

function readBody(req, limit = IMAGE_SIZE + 4096) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('PAYLOAD_TOO_LARGE'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function json(res, code, data) {
  const body = JSON.stringify(data)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

/**
 * 创建一个 Node 请求处理器。
 * @param {{ dir?: string }} opts 磁盘目录（相对项目根目录，默认 'disk'）
 */
export function createDiskHandler({ dir = 'disk' } = {}) {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const root = path.resolve(here, '..')
  const diskDir = path.resolve(root, dir)
  const imgPath = path.join(diskDir, 'disk.img')
  const tmpPath = path.join(diskDir, 'disk.img.tmp')
  const backupDir = path.join(diskDir, 'backups')

  fs.mkdirSync(backupDir, { recursive: true })

  function currentSha() {
    try {
      return sha16(fs.readFileSync(imgPath))
    } catch {
      return null
    }
  }

  /** 写盘前把当前镜像轮转进备份目录（保留最近 BACKUP_KEEP 份） */
  function rotateBackup() {
    if (!fs.existsSync(imgPath)) return
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const name = `disk-${stamp}.img`
      fs.copyFileSync(imgPath, path.join(backupDir, name))
      const files = fs
        .readdirSync(backupDir)
        .filter((f) => f.endsWith('.img'))
        .sort()
      while (files.length > BACKUP_KEEP) {
        fs.unlinkSync(path.join(backupDir, files.shift()))
      }
    } catch {
      /* 备份失败不阻塞写盘 */
    }
  }

  function backupList() {
    try {
      return fs
        .readdirSync(backupDir)
        .filter((f) => f.endsWith('.img'))
        .sort()
        .map((name) => {
          const st = fs.statSync(path.join(backupDir, name))
          return { name, size: st.size, mtime: st.mtimeMs }
        })
    } catch {
      return []
    }
  }

  async function handlePut(req, res) {
    let body
    try {
      body = await readBody(req)
    } catch {
      return json(res, 413, { error: '请求体过大（磁盘镜像必须是 256 KiB）' })
    }
    const invalid = validImage(body)
    if (invalid) return json(res, 400, { error: invalid })

    const expect = req.headers['x-disk-sha']
    const actual = currentSha()
    if (expect && actual && String(expect) !== actual) {
      return json(res, 409, {
        error: 'sha 不匹配：磁盘已被另一个标签页修改',
        sha: actual,
      })
    }

    rotateBackup()
    const tmp = `${tmpPath}.${process.pid}.${Date.now()}`
    fs.writeFileSync(tmp, body)
    fs.renameSync(tmp, imgPath) // 原子替换：崩在中间也不会留下半块盘
    json(res, 200, { ok: true, size: body.length, sha: sha16(body) })
  }

  function handleStatus(_req, res) {
    try {
      const st = fs.statSync(imgPath)
      json(res, 200, {
        exists: true,
        size: st.size,
        sha: currentSha(),
        mtime: st.mtimeMs,
        backups: backupList().length,
      })
    } catch {
      json(res, 200, { exists: false, size: 0, sha: null, mtime: 0, backups: backupList().length })
    }
  }

  async function handleRestore(req, res) {
    let body
    try {
      body = await readBody(req, 1024)
    } catch {
      return json(res, 413, { error: '请求体过大' })
    }
    let name = ''
    try {
      name = String(JSON.parse(body.toString('utf8')).name ?? '')
    } catch {
      return json(res, 400, { error: '请求体必须是 JSON' })
    }
    if (!/^disk-[\w.-]+\.img$/.test(name) || name.includes('..') || name.includes('/') || name.includes('\\')) {
      return json(res, 400, { error: '备份文件名不合法' })
    }
    const src = path.join(backupDir, name)
    if (!fs.existsSync(src)) return json(res, 404, { error: '备份不存在' })
    const bytes = fs.readFileSync(src)
    const invalid = validImage(bytes)
    if (invalid) return json(res, 400, { error: `备份已损坏：${invalid}` })
    rotateBackup()
    fs.copyFileSync(src, imgPath)
    json(res, 200, { ok: true, sha: sha16(bytes) })
  }

  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
  return function handler(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const route = url.pathname
    try {
      if (route === '/api/hello' && req.method === 'GET') {
        return json(res, 200, {
          ok: true,
          name: 'personal-os disk controller',
          version: 1,
          size: IMAGE_SIZE,
        })
      }
      if (route === '/api/disk' && req.method === 'GET') {
        if (!fs.existsSync(imgPath)) return json(res, 404, { error: '还没有磁盘镜像' })
        const buf = fs.readFileSync(imgPath)
        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': String(buf.length),
          'x-disk-sha': sha16(buf),
          'cache-control': 'no-store',
        })
        return void res.end(buf)
      }
      if (route === '/api/disk' && req.method === 'PUT') {
        return void handlePut(req, res)
      }
      if (route === '/api/disk/status' && req.method === 'GET') {
        return handleStatus(req, res)
      }
      if (route === '/api/disk/backups' && req.method === 'GET') {
        return json(res, 200, backupList())
      }
      if (route === '/api/disk/restore' && req.method === 'POST') {
        return void handleRestore(req, res)
      }
      json(res, 404, { error: 'not found' })
    } catch (e) {
      json(res, 500, { error: e instanceof Error ? e.message : String(e) })
    }
  }
}
