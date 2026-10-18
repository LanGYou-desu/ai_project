<script lang="ts">
  // 已关机屏
  import { getKernelOrNull } from '../state.svelte.ts'
</script>

<div class="off">
  <svg width="56" height="56" viewBox="0 0 96 96" aria-hidden="true">
    <defs>
      <linearGradient id="off-logo" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#48546e" />
        <stop offset="1" stop-color="#2a3244" />
      </linearGradient>
    </defs>
    <rect x="6" y="6" width="84" height="84" rx="22" fill="url(#off-logo)" />
    <path d="M48 26v22" stroke="#aeb8cc" stroke-width="6" stroke-linecap="round" />
    <path d="M34 34a20 20 0 1 0 28 0" stroke="#aeb8cc" stroke-width="6" stroke-linecap="round" fill="none" />
  </svg>
  <div class="title">已安全关机</div>
  <div class="sub dim">磁盘已同步并卸载（脏位已清除），可以放心关闭这个标签页。</div>
  {#if getKernelOrNull()?.persister.kind === 'static'}
    <div class="sub dim">静态降级模式下，改动保存在浏览器本地暂存中。</div>
  {/if}
  <button class="btn" onclick={() => location.reload()}>重新开机</button>
</div>

<style>
  .off {
    position: fixed;
    inset: 0;
    background: #05070c;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    z-index: 1000;
  }
  svg {
    opacity: 0.9;
    margin-bottom: 6px;
  }
  .title {
    font-size: 17px;
    letter-spacing: 0.12em;
    color: #c8d0e2;
  }
  .sub {
    font-size: 12.5px;
    max-width: 420px;
    text-align: center;
  }
  button {
    margin-top: 16px;
    color: #c8d0e2;
  }
</style>
