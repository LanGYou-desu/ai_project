import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
// 零依赖的虚拟磁盘控制器（Node 侧），同时被 server.js 复用
import { createDiskHandler } from './server/disk-server.mjs'

export default defineConfig({
  base: './',
  plugins: [
    svelte(),
    {
      // 开发模式下的“硬盘控制器”：把 /api/* 接到项目目录里的 disk/disk.img
      name: 'personal-os-disk-api',
      configureServer(server) {
        const handler = createDiskHandler({ dir: 'disk' })
        server.middlewares.use((req: any, res: any, next: any) => {
          if (!req.url || !req.url.startsWith('/api/')) return next()
          handler(req, res)
        })
      },
    },
  ],
  server: { port: 5180, open: false },
})
