<script lang="ts">
  // 通知中心：右上角通知堆叠
  import { system, dismissToast, reloadPage } from '../state.svelte.ts'
  import Glyph from '../ui/Glyph.svelte'

  const iconOf = (kind: string) =>
    kind === 'ok' ? 'ok' : kind === 'warn' ? 'warn' : kind === 'err' ? 'warn' : 'info'
</script>

<div class="toasts">
  {#each system.toasts as t (t.id)}
    <div class="toast glass-strong {t.kind}">
      <div class="ico {t.kind}">
        {#if iconOf(t.kind) === 'info'}
          <Glyph name="info" size={16} />
        {:else if iconOf(t.kind) === 'ok'}
          <Glyph name="ok" size={16} />
        {:else}
          <Glyph name="warn" size={16} />
        {/if}
      </div>
      <div class="content">
        <div class="title">{t.title}</div>
        {#if t.body}<div class="body dim">{t.body}</div>{/if}
        {#if t.action === 'reload'}
          <div class="actions">
            <button class="btn" onclick={reloadPage}>刷新页面</button>
          </div>
        {/if}
      </div>
      <button class="close" onclick={() => dismissToast(t.id)} aria-label="关闭通知">
        <Glyph name="x" size={12} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    top: 46px;
    right: 14px;
    z-index: 1200;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 330px;
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    gap: 10px;
    padding: 12px 12px 12px 13px;
    border-radius: 16px;
    box-shadow: var(--shadow-pop);
    animation: po-fade-up 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .toast.err {
    border-color: rgba(248, 113, 113, 0.5);
  }
  .toast.warn {
    border-color: rgba(245, 185, 66, 0.45);
  }
  .toast.ok {
    border-color: rgba(69, 212, 131, 0.45);
  }
  .ico {
    flex: none;
    margin-top: 1px;
    color: var(--accent);
  }
  .ico.ok {
    color: var(--ok);
  }
  .ico.warn {
    color: var(--warn);
  }
  .ico.err {
    color: var(--err);
  }
  .content {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-size: 13.5px;
    font-weight: 600;
  }
  .body {
    font-size: 12.5px;
    margin-top: 2px;
    line-height: 1.55;
    word-break: break-word;
  }
  .actions {
    margin-top: 9px;
  }
  .close {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 7px;
    border: none;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .close:hover {
    background: var(--glass-soft);
    color: var(--text);
  }
</style>
