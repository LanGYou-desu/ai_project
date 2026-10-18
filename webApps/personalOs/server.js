// 生产模式：同一个端口提供 —— 静态构建产物（dist/）+ 磁盘 API + 只读基础镜像。
// 用法：npm run build && npm start（PORT 环境变量可改端口，默认 5180）
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDiskHandler } from './server/disk-server.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(here, 'dist')
const port = Number(process.env.PORT || 5180)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.img': 'application/octet-stream',
}

const diskHandler = createDiskHandler({ dir: 'disk' })

const server = http.createServer((req, res) => {
  const rawUrl = req.url ?? '/'
  if (rawUrl.startsWith('/api/')) {
    diskHandler(req, res)
    return
  }

  let route
  try {
    route = decodeURIComponent(new URL(rawUrl, 'http://localhost').pathname)
  } catch {
    res.writeHead(400)
    res.end('bad request')
    return
  }

  // 静态托管的只读基础镜像（前端 StaticPersister 会来取）
  if (route === '/disk.img') {
    const p = path.join(here, 'disk', 'disk.img')
    if (fs.existsSync(p)) {
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' })
      fs.createReadStream(p).pipe(res)
    } else {
      res.writeHead(404)
      res.end('no disk image')
    }
    return
  }

  if (!fs.existsSync(dist)) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('还没有构建产物：先运行 npm run build，再 npm start。')
    return
  }

  let filePath = path.join(dist, route)
  if (!filePath.startsWith(dist)) {
    res.writeHead(403)
    res.end('forbidden')
    return
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(dist, 'index.html') // SPA 回退（路由都在 hash 里）
  }
  const ext = path.extname(filePath).toLowerCase()
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': ext === '.html' || route === '/sw.js' ? 'no-store' : 'public, max-age=3600',
  })
  fs.createReadStream(filePath).pipe(res)
})

server.listen(port, () => {
  console.log(`personal-os 已启动：http://localhost:${port}`)
  console.log(`磁盘镜像：${path.join(here, 'disk', 'disk.img')}`)
  console.log(`备份目录：${path.join(here, 'disk', 'backups')}`)
})
