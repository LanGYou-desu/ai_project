<script lang="ts">
  // 全局右键菜单 / 菜单栏下拉
  import { system, closeMenus } from '../state.svelte.ts'
  import Glyph from '../ui/Glyph.svelte'

  let menuEl: HTMLDivElement | null = $state(null)

  $effect(() => {
    const menu = system.ctxMenu
    if (!menu) return
    const onDown = (e: PointerEvent) => {
      if (menuEl && e.target instanceof Node && menuEl.contains(e.target)) return
      closeMenus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenus()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  })
</script>

{#if system.ctxMenu}
  <div class="ctx glass-strong" bind:this={menuEl} style="left: {system.ctxMenu.x}px; top: {system.ctxMenu.y}px">
    {#each system.ctxMenu.items as item, i (i)}
      {#if item.separator}
        <div class="sep"></div>
      {:else}
        <button
          class="row"
          class:danger={item.danger}
          disabled={item.disabled}
          onclick={() => {
            const fn = item.onClick
            closeMenus()
            fn?.()
          }}
        >
          <span class="g">{#if item.glyph}<Glyph name={item.glyph} size={14} />{/if}</span>
          <span class="label">{item.label}</span>
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .ctx {
    position: fixed;
    z-index: 1500;
    min-width: 190px;
    padding: 6px;
    border-radius: 14px;
    box-shadow: var(--shadow-pop);
    animation: po-pop 0.14s ease;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    padding: 7px 10px;
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    border-radius: 9px;
    cursor: pointer;
    text-align: left;
  }
  .row:hover {
    background: var(--accent);
    color: #fff;
  }
  .row:hover .g {
    color: #fff;
  }
  .row.danger {
    color: var(--err);
  }
  .row.danger:hover {
    background: var(--err);
    color: #fff;
  }
  .row:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .row:disabled:hover {
    background: transparent;
    color: var(--text);
  }
  .g {
    width: 16px;
    display: inline-flex;
    justify-content: center;
    color: var(--text-dim);
  }
  .sep {
    height: 1px;
    margin: 5px 8px;
    background: var(--stroke);
  }
</style>
