// personal-os 离线外壳：只在生产构建里注册（开发模式不注册，避免干扰热更新）。
// 策略：网络优先，成功后写入缓存；断网时回退缓存。
// 边界：只处理同源 GET；/api/* 一律放行不缓存（虚拟磁盘永远走真实网络）。
const CACHE = 'personal-os-v1'
const SHELL = ['./', './index.html', './favicon.svg', './manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.includes('/api/')) return

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(async () => {
        const hit = await caches.match(req)
        if (hit) return hit
        if (req.mode === 'navigate') {
          const shell = await caches.match('./index.html')
          if (shell) return shell
        }
        return Response.error()
      }),
  )
})
