import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    // 让组件测试拿到 svelte 的浏览器构建
    conditions: process.env.VITEST ? ['browser'] : undefined,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
