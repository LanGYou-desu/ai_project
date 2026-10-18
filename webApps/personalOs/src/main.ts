import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'

const app = mount(App, { target: document.getElementById('app')! })

export default app

// 生产构建注册离线外壳；开发模式不注册（热更新优先）
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined)
  })
}
