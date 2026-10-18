<script lang="ts">
  // 启动器：Ctrl/Cmd+K 或 Dock 左侧按钮呼出，可搜应用与磁盘文件
  import { system, openApp, openPath, toggleLauncher, getKernelOrNull } from '../state.svelte.ts'
  import { APPS } from '../apps/registry.ts'
  import { searchApps, searchFiles, type SearchHit } from '../services/search.ts'
  import AppIcon from '../ui/AppIcon.svelte'
  import Glyph from '../ui/Glyph.svelte'
  import type { Sys } from '../kernel/kernel.ts'

  let sys = $state<Sys | null>(null)
  let inputEl: HTMLInputElement | null = $state(null)

  const query = $derived(system.launcherQuery)
  const appHits = $derived(searchApps(APPS, query))
  const fileHits = $derived(sys && query.trim() ? searchFiles(sys, query, 8) : [])

  $effect(() => {
    if (system.launcher) {
      if (!sys) {
        const k = getKernelOrNull()
        if (k) sys = k.sysFor('launcher', 0, { fs: 'ro' })
      }
      inputEl?.focus()
    }
  })

  function run(hit: SearchHit): void {
    toggleLauncher(false)
    if (hit.kind === 'app') openApp(hit.id)
    else if (hit.path) openPath(hit.path)
  }

  function onKeydown(e: KeyboardEvent): void {
    if (!system.launcher) return
    if (e.key === 'Escape') {
      e.preventDefault()
      toggleLauncher(false)
      return
    }
    if (e.key === 'Enter') {
      const first = appHits[0] ?? fileHits[0]
      if (first) run(first)
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if system.launcher}
  <div
    class="backdrop"
    onclick={(e) => {
      if (e.target === e.currentTarget) toggleLauncher(false)
    }}
    role="presentation"
  >
    <div class="panel glass-strong" role="dialog" aria-label="启动器" tabindex="-1">
      <div class="search-row">
        <span class="g"><Glyph name="search" size={17} /></span>
        <input
          class="search"
          bind:this={inputEl}
          bind:value={system.launcherQuery}
          placeholder="搜索应用和磁盘文件…"
        />
        <kbd>Esc</kbd>
      </div>

      <div class="scroll">
        <div class="sec-title">{query.trim() ? '应用' : '全部应用'}</div>
        <div class="grid">
          {#each appHits as hit (hit.id)}
            <button class="app" onclick={() => run(hit)}>
              <AppIcon id={hit.id} size={52} />
              <span class="name">{hit.title}</span>
            </button>
          {:else}
            <div class="empty dim">没有匹配的应用</div>
          {/each}
        </div>

        {#if query.trim()}
          <div class="sec-title">磁盘文件</div>
          {#if fileHits.length === 0}
            <div class="empty dim">没有匹配的文件</div>
          {:else}
            <div class="files">
              {#each fileHits as hit (hit.id)}
                <button class="file" onclick={() => run(hit)}>
                  <span class="g">
                    <Glyph name={hit.kind === 'dir' ? 'folder' : 'file'} size={15} />
                  </span>
                  <span class="fname">{hit.title}</span>
                  <span class="fpath dim">{hit.sub}</span>
                </button>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 500;
    display: flex;
    justify-content: center;
    padding-top: 12vh;
    background: rgba(5, 8, 14, 0.28);
    backdrop-filter: blur(8px);
    animation: po-pop 0.16s ease;
  }
  .panel {
    width: min(680px, 92vw);
    max-height: 68vh;
    display: flex;
    flex-direction: column;
    border-radius: 22px;
    box-shadow: var(--shadow-pop);
    overflow: hidden;
    animation: po-fade-up 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .search-row {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--stroke);
  }
  .search-row .g {
    color: var(--text-dim);
    display: inline-flex;
  }
  .search {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 15px;
    outline: none;
  }
  .search::placeholder {
    color: var(--text-faint);
  }
  .scroll {
    overflow: auto;
    padding: 12px;
  }
  .sec-title {
    font-size: 11.5px;
    color: var(--text-faint);
    letter-spacing: 0.08em;
    padding: 4px 8px 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: 4px;
  }
  .app {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    padding: 12px 6px 10px;
    border: none;
    background: transparent;
    border-radius: 16px;
    cursor: pointer;
    transition: background var(--dur-fast) ease, transform var(--dur-fast) ease;
  }
  .app:hover {
    background: var(--glass-soft);
    transform: translateY(-2px);
  }
  .app .name {
    font-size: 12px;
    color: var(--text);
  }
  .files {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 6px;
  }
  .file {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: none;
    background: transparent;
    border-radius: 10px;
    cursor: pointer;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
  }
  .file:hover {
    background: var(--glass-soft);
  }
  .file .g {
    color: var(--text-dim);
    display: inline-flex;
  }
  .fname {
    flex: none;
  }
  .fpath {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11.5px;
    text-align: right;
  }
  .empty {
    font-size: 12.5px;
    padding: 8px;
  }
</style>
