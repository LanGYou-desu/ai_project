<script lang="ts">
  // 开机自检屏：自绘 Logo + 内核日志滚动 + 可跳过
  import { system, skipBoot } from '../state.svelte.ts'

  let listEl: HTMLDivElement | null = $state(null)

  $effect(() => {
    system.bootLines.length
    if (listEl) listEl.scrollTop = listEl.scrollHeight
  })
</script>

<svelte:window onkeydown={skipBoot} />

<div class="boot" onclick={skipBoot} role="presentation">
  <div class="center">
    <svg width="86" height="86" viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <linearGradient id="boot-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#6ea8ff" />
          <stop offset="1" stop-color="#7c5cd6" />
        </linearGradient>
        <linearGradient id="boot-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(255,255,255,.35)" />
          <stop offset="45%" stop-color="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="84" height="84" rx="22" fill="url(#boot-logo)" />
      <rect x="6" y="6" width="84" height="84" rx="22" fill="url(#boot-sheen)" />
      <rect x="23" y="27" width="50" height="42" rx="9" fill="rgba(9,13,24,.58)" />
      <path d="M31 41l7 6-7 6" stroke="#fff" stroke-width="4.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M44 55h13" stroke="#fff" stroke-width="4.2" stroke-linecap="round" />
    </svg>
    <div class="word">personal-os</div>
    <div class="bar"><div class="bar-inner"></div></div>
  </div>

  <div class="lines mono" bind:this={listEl}>
    {#each system.bootLines as line, i (i)}
      <div class="line {line.cls ?? ''}">{line.text}</div>
    {/each}
  </div>

  <div class="hint">按任意键跳过自检</div>
</div>

<style>
  .boot {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(900px 640px at 50% 0%, rgba(90, 130, 255, 0.16), transparent 65%),
      radial-gradient(720px 520px at 84% 94%, rgba(167, 139, 250, 0.12), transparent 62%),
      linear-gradient(180deg, #070a12, #0a0f1c);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 1000;
  }
  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    margin-bottom: 34px;
    animation: po-fade-up 0.5s ease;
  }
  .center svg {
    filter: drop-shadow(0 12px 34px rgba(110, 168, 255, 0.35));
  }
  .word {
    font-size: 19px;
    letter-spacing: 0.28em;
    color: #e8ecf8;
    font-weight: 300;
  }
  .bar {
    width: 220px;
    height: 3px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
  }
  .bar-inner {
    height: 100%;
    width: 42%;
    border-radius: 2px;
    background: linear-gradient(90deg, #6ea8ff, #a78bfa);
    box-shadow: 0 0 12px rgba(110, 168, 255, 0.65);
    animation: slide 1.4s ease-in-out infinite;
  }
  @keyframes slide {
    0% {
      transform: translateX(-110%);
    }
    100% {
      transform: translateX(360%);
    }
  }
  .lines {
    width: min(760px, 86vw);
    height: 168px;
    overflow: hidden;
    font-size: 12px;
    line-height: 1.85;
    color: rgba(210, 220, 240, 0.66);
    padding: 0 6px;
  }
  .line.err {
    color: var(--err);
  }
  .line.ok {
    color: var(--ok);
  }
  .line.warn {
    color: var(--warn);
  }
  .line.accent {
    color: var(--accent);
  }
  .line.dim {
    color: rgba(210, 220, 240, 0.42);
  }
  .hint {
    position: absolute;
    bottom: 26px;
    font-size: 12px;
    color: rgba(210, 220, 240, 0.4);
    animation: po-pulse 2.6s ease-in-out infinite;
  }
</style>
