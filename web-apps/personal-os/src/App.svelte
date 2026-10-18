<script lang="ts">
  // 根组件：按电源状态切换 开机自检 / 登录 / 桌面 / 关机中 / 已关机
  import { onMount } from 'svelte'
  import {
    system,
    bootSystem,
    installLifecycleHooks,
    installHashListener,
  } from './state.svelte.ts'
  import BootScreen from './shell/BootScreen.svelte'
  import LoginScreen from './shell/LoginScreen.svelte'
  import OffScreen from './shell/OffScreen.svelte'
  import Desktop from './shell/Desktop.svelte'
  import Toasts from './shell/Toasts.svelte'

  onMount(() => {
    installLifecycleHooks()
    installHashListener()
    void bootSystem()
  })
</script>

{#if system.phase === 'boot'}
  <BootScreen />
{:else if system.phase === 'login'}
  <LoginScreen />
{:else if system.phase === 'desktop'}
  <Desktop />
{:else if system.phase === 'shutting-down'}
  <div class="shutdown">
    <div class="box glass-strong fade-up">
      <div class="spinner"></div>
      <div>正在同步磁盘并卸载…</div>
      <div class="dim">请稍候，不要关闭标签页</div>
    </div>
  </div>
  <Toasts />
{:else if system.phase === 'off'}
  <OffScreen />
{/if}

<style>
  .shutdown {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(4, 6, 12, 0.72);
    backdrop-filter: blur(10px);
    z-index: 900;
  }
  .box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 34px 46px;
    font-size: 14px;
  }
  .spinner {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2.5px solid var(--stroke);
    border-top-color: var(--accent);
    animation: po-spin 0.9s linear infinite;
  }
</style>
