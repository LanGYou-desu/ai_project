<script lang="ts">
  // 记事本：可多开，带磁盘路径。Ctrl+S 保存；另存为可写任意路径（/系统 需要勾选 sudo）。
  import type { Sys } from '../kernel/kernel.ts'
  import { PATHS } from '../services/installer.ts'
  import { pushToast, setWindowTitle } from '../state.svelte.ts'
  import { fmtSize } from '../kernel/terminal/commands.ts'
  import Glyph from '../ui/Glyph.svelte'

  interface Props {
    sys: Sys | null
    arg?: string
    winId: number
  }
  let { sys, arg, winId }: Props = $props()

  let path = $state<string | null>(null)
  let text = $state('')
  let dirty = $state(false)
  let saveAsOpen = $state(false)
  let savePath = $state('')
  let useSudo = $state(false)
  let missing = $state(false)
  let ta: HTMLTextAreaElement | null = $state(null)

  $effect(() => {
    if (!sys) return
    if (arg) {
      path = arg
      savePath = arg
      try {
        text = sys.fs.readText(arg)
        missing = false
      } catch {
        text = ''
        missing = true
      }
    } else {
      path = null
      text = ''
      savePath = `${PATHS.desktop}/未命名.txt`
    }
  })

  $effect(() => {
    const name = path ? path.split('/').pop() : '未命名'
    setWindowTitle(winId, `${dirty ? '• ' : ''}${name} — 记事本`)
  })

  const bytes = $derived(new TextEncoder().encode(text).length)
  const lines = $derived(text.split('\n').length)

  const target = $derived(path ?? savePath.trim())
  const needSudo = $derived(target.startsWith('/系统'))

  function save(): boolean {
    if (!sys) return false
    const t = target
    if (!t) {
      saveAsOpen = true
      return false
    }
    try {
      sys.fs.write(t, text, { sudo: needSudo && useSudo })
      path = t
      savePath = t
      dirty = false
      saveAsOpen = false
      missing = false
      sys.notify('已保存', `${t}（${fmtSize(bytes)}）`, 'ok')
      return true
    } catch (e) {
      pushToast({ title: '保存失败', body: e instanceof Error ? e.message : String(e), kind: 'err' })
      return false
    }
  }

  function newFile(): void {
    path = null
    text = ''
    dirty = false
    missing = false
    saveAsOpen = false
    savePath = `${PATHS.desktop}/未命名.txt`
    ta?.focus()
  }

  function onKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      if (e.shiftKey) {
        // 同 Windows：Ctrl+Shift+S 另存为
        saveAsOpen = true
        return
      }
      save()
    }
  }
</script>

<div class="page">
  <div class="toolbar">
    <button class="btn" onclick={newFile}><Glyph name="plus" size={13} />新建</button>
    <button class="btn primary" onclick={save}><Glyph name="save" size={13} />保存</button>
    <button class="btn" onclick={() => (saveAsOpen = !saveAsOpen)}><Glyph name="copy" size={13} />另存为</button>
    <div class="spacer"></div>
    <span class="path dim mono">{path ?? '未命名（尚未保存到磁盘）'}</span>
    {#if dirty}<span class="dirty" title="有未保存的修改"></span>{/if}
  </div>

  {#if saveAsOpen}
    <div class="savebar">
      <input
        class="field mono"
        bind:value={savePath}
        placeholder="/用户/主人/桌面/未命名.txt"
        onkeydown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') saveAsOpen = false
        }}
      />
      {#if needSudo}
        <label class="sudo">
          <input type="checkbox" bind:checked={useSudo} />
          <span>sudo 写入系统区</span>
        </label>
      {/if}
      <button class="btn primary" onclick={save}>保存</button>
      <button class="btn ghost" onclick={() => (saveAsOpen = false)}>取消</button>
    </div>
  {/if}

  {#if missing}
    <div class="missing dim">文件不存在，保存后会创建：{path}</div>
  {/if}

  <textarea
    class="editor mono"
    bind:this={ta}
    bind:value={text}
    oninput={() => (dirty = true)}
    onkeydown={onKeydown}
    spellcheck="false"
    placeholder="在这里写点什么…… Ctrl+S 保存 · Ctrl+Shift+S 另存为。"
    aria-label="文本编辑区"
  ></textarea>

  <div class="status dim">
    <span>{lines} 行</span>
    <span>{bytes} 字节</span>
    <span>{text.length} 字符</span>
    <span class="spacer"></span>
    <span>{dirty ? '有未保存的修改' : '已保存到磁盘'}</span>
  </div>
</div>

<style>
  .page {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .toolbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 12px;
    border-bottom: 1px solid var(--stroke);
  }
  .spacer {
    flex: 1;
  }
  .path {
    font-size: 11.5px;
    max-width: 46%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dirty {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--warn);
    box-shadow: 0 0 7px var(--warn);
    flex: none;
  }
  .savebar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-bottom: 1px solid var(--stroke);
    background: var(--glass-soft);
  }
  .savebar .field {
    flex: 1;
  }
  .sudo {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-dim);
    white-space: nowrap;
    cursor: pointer;
  }
  .sudo input {
    accent-color: var(--accent);
  }
  .missing {
    flex: none;
    padding: 6px 14px;
    font-size: 11.5px;
    border-bottom: 1px solid var(--stroke);
  }
  .editor {
    flex: 1;
    min-height: 0;
    width: 100%;
    border: none;
    outline: none;
    resize: none;
    background: transparent;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.7;
    padding: 14px 16px;
  }
  .editor::placeholder {
    color: var(--text-faint);
  }
  .status {
    flex: none;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 6px 14px;
    font-size: 11.5px;
    border-top: 1px solid var(--stroke);
  }
</style>
