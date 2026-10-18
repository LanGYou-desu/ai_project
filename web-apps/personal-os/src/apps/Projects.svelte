<script lang="ts">
  // 项目：/用户/主人/项目/*.md 的卡片墙 + 详情
  import type { Sys } from '../kernel/kernel.ts'
  import { parseProject, type Project } from '../kernel/projects.ts'
  import { renderMarkdown } from '../kernel/markdown.ts'
  import { PATHS } from '../services/installer.ts'
  import { onKernelEvent } from '../state.svelte.ts'
  import Glyph from '../ui/Glyph.svelte'

  interface Props {
    sys: Sys | null
    arg?: string
    winId: number
  }
  let { sys }: Props = $props()

  let items = $state<Project[]>([])
  let selected = $state<Project | null>(null)
  let error = $state('')

  function load(): void {
    if (!sys) return
    try {
      const entries = sys.fs.list(PATHS.projects)
      const list: Project[] = []
      for (const e of entries) {
        if (e.type !== 'file' || !e.name.endsWith('.md')) continue
        try {
          list.push(parseProject(e.name, sys.fs.readText(PATHS.projects + '/' + e.name)))
        } catch {
          /* 跳过坏文件 */
        }
      }
      items = list
      error = ''
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }

  $effect(() => {
    load()
    return onKernelEvent('fs:changed', (p) => {
      if (p.path.includes('项目')) load()
    })
  })

  const detailHtml = $derived(selected ? renderMarkdown(selected.body) : '')
</script>

<div class="page">
  {#if selected}
    <div class="detail-head">
      <button class="btn ghost" onclick={() => (selected = null)}>
        <Glyph name="chev-left" size={14} />全部项目
      </button>
      <div class="spacer"></div>
      {#if selected.link}
        <a class="btn" href={selected.link} target="_blank" rel="noopener noreferrer">
          <Glyph name="external" size={14} />打开链接
        </a>
      {/if}
    </div>
    <div class="scroll">
      <h1 class="dtitle">{selected.title}</h1>
      {#if selected.summary}<p class="dsum">{selected.summary}</p>{/if}
      <div class="tags">
        {#each selected.tags as tag (tag)}<span class="chip">{tag}</span>{/each}
      </div>
      <hr />
      <div class="md">{@html detailHtml}</div>
    </div>
  {:else}
    <div class="scroll">
      <div class="title-row">
        <h1>项目</h1>
        <span class="dim">{items.length} 个 · 来自磁盘 /用户/主人/项目</span>
      </div>
      {#if error}
        <div class="err mono">{error}</div>
      {:else}
        <div class="grid">
          {#each items as p (p.file)}
            <button class="card" onclick={() => (selected = p)}>
              <div class="ctitle">{p.title}</div>
              <div class="csum dim">{p.summary}</div>
              <div class="tags">
                {#each p.tags.slice(0, 3) as tag (tag)}<span class="chip">{tag}</span>{/each}
              </div>
            </button>
          {/each}
        </div>
        {#if items.length === 0}
          <div class="dim empty">项目目录还是空的。用记事本或终端往里写点东西吧。</div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .page {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .detail-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    border-bottom: 1px solid var(--stroke);
  }
  .spacer {
    flex: 1;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 18px 22px 24px;
  }
  .title-row {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 14px;
  }
  h1 {
    font-size: 19px;
    margin: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(215px, 1fr));
    gap: 12px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 15px 16px;
    border-radius: 16px;
    border: 1px solid var(--stroke);
    background: var(--glass-soft);
    color: var(--text);
    text-align: left;
    cursor: pointer;
    font: inherit;
    transition: transform var(--dur-fast) ease, border-color var(--dur-fast) ease, background var(--dur-fast) ease;
  }
  .card:hover {
    transform: translateY(-2px);
    border-color: var(--stroke-strong);
    background: var(--glass-hover);
  }
  .ctitle {
    font-size: 14.5px;
    font-weight: 600;
  }
  .csum {
    font-size: 12.5px;
    line-height: 1.6;
    flex: 1;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .dtitle {
    margin: 6px 0 8px;
  }
  .dsum {
    color: var(--text-dim);
    margin: 0 0 10px;
  }
  .empty {
    padding: 30px 4px;
  }
  .err {
    color: var(--err);
    font-size: 12.5px;
  }
</style>
