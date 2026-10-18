<script lang="ts">
  // 文件：磁盘文件管理器（列表/网格、重命名、删除、新建文件夹）
  import { untrack } from 'svelte'
  import type { Sys } from '../kernel/kernel.ts'
  import type { Entry } from '../kernel/disk/fs.ts'
  import { joinPath, splitPath } from '../kernel/disk/fs.ts'
  import { PATHS } from '../services/installer.ts'
  import { openPath, openContextMenu, onKernelEvent, pushToast, system } from '../state.svelte.ts'
  import { getFileClip, setFileClip } from './fileClip.ts'
  import { fmtSize, fmtTime } from '../kernel/terminal/commands.ts'
  import Glyph from '../ui/Glyph.svelte'

  interface Props {
    sys: Sys | null
    arg?: string
    winId: number
  }
  let { sys, arg, winId }: Props = $props()

  // arg 只在窗口创建时决定初始目录（窗口不会被重新指派 arg）
  let cwd = $state(untrack(() => (arg && arg.startsWith('/') ? arg : PATHS.home)))
  let entries = $state<Entry[]>([])
  let error = $state('')
  let view = $state<'list' | 'grid'>('list')
  let selectedName = $state<string | null>(null)
  let renaming = $state<string | null>(null)
  let renameValue = $state('')
  let pendingDelete = $state<string | null>(null)
  let history = $state<string[]>([])
  let sortKey = $state<'name' | 'size' | 'time'>('name')

  const SORT_NAMES = { name: '名称', size: '大小', time: '时间' } as const

  function cycleSort(): void {
    sortKey = sortKey === 'name' ? 'size' : sortKey === 'size' ? 'time' : 'name'
  }

  const sortedEntries = $derived(
    [...entries].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      if (sortKey === 'size' && a.size !== b.size) return b.size - a.size
      if (sortKey === 'time' && a.modified !== b.modified) return b.modified - a.modified
      return a.name.localeCompare(b.name, 'zh')
    }),
  )

  const PLACES = [
    { label: '桌面', path: PATHS.desktop },
    { label: '关于', path: `${PATHS.home}/关于` },
    { label: '项目', path: PATHS.projects },
    { label: '联系', path: `${PATHS.home}/联系` },
    { label: '音乐', path: PATHS.music },
    { label: '配置', path: `${PATHS.home}/配置` },
    { label: '系统', path: '/系统' },
    { label: '系统日志', path: '/系统/log' },
  ]

  function load(): void {
    if (!sys) return
    try {
      entries = sys.fs.list(cwd)
      error = ''
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
      if (cwd !== PATHS.home) {
        cwd = PATHS.home
        try {
          entries = sys.fs.list(cwd)
          error = ''
        } catch {
          /* 忽略 */
        }
      }
    }
  }

  $effect(() => {
    load()
    return onKernelEvent('fs:changed', () => load())
  })

  function navigate(path: string, push = true): void {
    if (path === cwd) return
    if (push) history = [...history, cwd]
    cwd = path
    selectedName = null
    renaming = null
    pendingDelete = null
    load()
  }

  function goBack(): void {
    const hist = [...history]
    const prev = hist.pop()
    history = hist
    if (prev) navigate(prev, false)
  }

  function goUp(): void {
    const segs = splitPath(cwd)
    segs.pop()
    navigate(joinPath(segs))
  }

  function openEntry(e: Entry): void {
    if (e.type === 'dir') navigate(joinPath([...splitPath(cwd), e.name]))
    else openPath(cwd.replace(/\/+$/, '') + '/' + e.name)
  }

  function startRename(name: string): void {
    renaming = name
    renameValue = name
  }

  function commitRename(oldName: string): void {
    const v = renameValue.trim()
    renaming = null
    if (!sys || !v || v === oldName) return
    try {
      sys.fs.rename(cwd + '/' + oldName, cwd + '/' + v)
      selectedName = v
      load()
      sys.notify('已重命名', `${oldName} → ${v}`, 'ok')
    } catch (e) {
      pushToast({ title: '重命名失败', body: e instanceof Error ? e.message : String(e), kind: 'err' })
    }
  }

  function requestDelete(e: Entry): void {
    if (pendingDelete !== e.name) {
      pendingDelete = e.name
      setTimeout(() => {
        if (pendingDelete === e.name) pendingDelete = null
      }, 3000)
      return
    }
    pendingDelete = null
    if (!sys) return
    try {
      sys.fs.unlink(cwd + '/' + e.name, { recursive: e.type === 'dir' })
      sys.notify('已删除', `${e.name}${e.type === 'dir' ? '（含内容）' : ''}`, 'ok')
      load()
    } catch (err) {
      pushToast({ title: '删除失败', body: err instanceof Error ? err.message : String(err), kind: 'err' })
    }
  }

  function entryPath(name: string): string {
    return joinPath([...splitPath(cwd), name])
  }

  function clipEntry(e: Entry, mode: 'copy' | 'cut'): void {
    setFileClip({ mode, path: entryPath(e.name) })
    pushToast({ title: mode === 'copy' ? '已复制' : '已剪切', body: e.name, kind: 'ok' })
  }

  /** 重名时自动加「副本」后缀（仅复制模式用） */
  function uniqueDestName(name: string): string {
    const s = sys
    if (!s) return name
    const dot = name.lastIndexOf('.')
    const base = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''
    let cand = name
    let i = 1
    while (s.fs.exists(entryPath(cand))) {
      cand = `${base} - 副本${i > 1 ? ` ${i}` : ''}${ext}`
      i++
    }
    return cand
  }

  /** 粘贴剪贴板：复制自动避让重名，剪切要求目标不存在（同 Windows 资源管理器） */
  function paste(): void {
    const s = sys
    const clip = getFileClip()
    if (!s || !clip) return
    const srcName = clip.path.split('/').pop() ?? '未命名'
    const destName = clip.mode === 'cut' ? srcName : uniqueDestName(srcName)
    const dest = entryPath(destName)
    if (dest === clip.path) return // 剪切后粘贴回原处：不动
    try {
      if (clip.mode === 'cut') {
        if (s.fs.exists(dest)) throw new Error(`目标已存在同名项目：${destName}`)
        s.fs.rename(clip.path, dest)
        setFileClip(null)
        pushToast({ title: '已移动', body: `${srcName} → ${destName}`, kind: 'ok' })
      } else {
        s.fs.copy(clip.path, dest)
        pushToast({ title: '已粘贴', body: destName, kind: 'ok' })
      }
      load()
    } catch (err) {
      pushToast({ title: '粘贴失败', body: err instanceof Error ? err.message : String(err), kind: 'err' })
    }
  }

  // Windows 资源管理器风格快捷键：只在本窗口聚焦时生效，输入/按钮聚焦时让位
  function onKeydown(e: KeyboardEvent): void {
    if (system.wm.focusId !== winId) return
    const t = e.target as HTMLElement | null
    if (t && ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(t.tagName)) return
    if (t?.isContentEditable) return
    const sel = entries.find((x) => x.name === selectedName) ?? null
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase()
      if (k === 'c' && sel) {
        e.preventDefault()
        clipEntry(sel, 'copy')
        return
      }
      if (k === 'x' && sel) {
        e.preventDefault()
        clipEntry(sel, 'cut')
        return
      }
      if (k === 'v') {
        e.preventDefault()
        paste()
        return
      }
    }
    if (e.key === 'Delete') {
      if (sel) {
        e.preventDefault()
        requestDelete(sel)
      }
      return
    }
    if (renaming !== null || pendingDelete !== null) return
    if (e.key === 'F2') {
      if (sel) {
        e.preventDefault()
        startRename(sel.name)
      }
      return
    }
    if (e.key === 'F5') {
      e.preventDefault()
      load()
      return
    }
    if (e.key === 'Enter') {
      if (sel) {
        e.preventDefault()
        openEntry(sel)
      }
      return
    }
    if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowUp')) {
      // 同 Windows 的退格 / Alt+上：返回上一级
      e.preventDefault()
      goUp()
      return
    }
    if (e.key === 'Escape') {
      selectedName = null
    }
  }

  function newFolder(): void {
    if (!sys) return
    let name = '新建文件夹'
    let i = 2
    while (sys.fs.exists(cwd + '/' + name)) name = `新建文件夹 ${i++}`
    try {
      sys.fs.mkdir(cwd + '/' + name)
      load()
      startRename(name)
    } catch (e) {
      pushToast({ title: '新建失败', body: e instanceof Error ? e.message : String(e), kind: 'err' })
    }
  }

  function rowMenu(ev: MouseEvent, e: Entry): void {
    ev.preventDefault()
    ev.stopPropagation()
    selectedName = e.name
    const clip = getFileClip()
    openContextMenu(ev.clientX, ev.clientY, [
      { label: '打开', glyph: 'external', onClick: () => openEntry(e) },
      { separator: true },
      { label: '复制', glyph: 'copy', onClick: () => clipEntry(e, 'copy') },
      { label: '剪切', glyph: 'scissors', onClick: () => clipEntry(e, 'cut') },
      ...(clip ? [{ label: '粘贴', glyph: 'paste', onClick: () => paste() }] : []),
      { separator: true },
      { label: '重命名', glyph: 'pencil', onClick: () => startRename(e.name) },
      { label: '删除', glyph: 'trash', danger: true, onClick: () => requestDelete(e) },
    ])
  }

  const crumbs = $derived(splitPath(cwd))
  const usage = $derived(sys ? sys.disk.usage() : { used: 0, total: 1, free: 0, files: 0, dirs: 0 })
</script>

<svelte:window onkeydown={onKeydown} />

<div class="page">
  <aside class="side">
    <div class="side-title">位置</div>
    <button class="place" class:on={cwd === '/'} onclick={() => navigate('/')}>
      <Glyph name="database" size={14} />
      <span>此电脑</span>
    </button>
    {#each PLACES as p (p.path)}
      <button class="place" class:on={cwd === p.path} onclick={() => navigate(p.path)}>
        <Glyph name="folder" size={14} />
        <span>{p.label}</span>
      </button>
    {/each}
    <div class="side-foot">
      <div class="bar"><div class="bar-in" style="width: {Math.round((usage.used / usage.total) * 100)}%"></div></div>
      <div class="dim tiny">已用 {fmtSize(usage.used * 512)} / 256 KiB</div>
    </div>
  </aside>

  <main class="main">
    <div class="toolbar">
      <button class="btn-ico" onclick={goBack} disabled={history.length === 0} aria-label="后退">
        <Glyph name="chev-left" size={15} />
      </button>
      <button class="btn-ico" onclick={goUp} disabled={cwd === '/'} aria-label="上一级">
        <Glyph name="chev-up" size={15} />
      </button>
      <button class="btn-ico" onclick={() => navigate(PATHS.home)} aria-label="主目录">
        <Glyph name="home" size={15} />
      </button>
      <button class="btn-ico" onclick={load} aria-label="刷新">
        <Glyph name="refresh" size={15} />
      </button>

      <div class="crumbs mono">
        <button class="crumb" onclick={() => navigate('/')}>/</button>
        {#each crumbs as seg, i (i)}
          <button class="crumb" onclick={() => navigate('/' + crumbs.slice(0, i + 1).join('/'))}>{seg}</button>
          {#if i < crumbs.length - 1}<span class="sl dim">/</span>{/if}
        {/each}
      </div>

      <div class="spacer"></div>

      <button class="btn" onclick={cycleSort}><Glyph name="sort" size={13} />排序：{SORT_NAMES[sortKey]}</button>
      <button class="btn" onclick={newFolder}><Glyph name="plus" size={13} />新建文件夹</button>
      <button class="btn-ico" onclick={() => (view = view === 'list' ? 'grid' : 'list')} aria-label="切换视图">
        <Glyph name={view === 'list' ? 'grid' : 'list'} size={15} />
      </button>
    </div>

    <div class="content" class:grid-view={view === 'grid'}>
      {#if error}
        <div class="err mono">{error}</div>
      {:else if entries.length === 0}
        <div class="dim empty">这个目录是空的</div>
      {:else}
        {#each sortedEntries as e (e.name)}
          {@const deleting = pendingDelete === e.name}
          <div
            class="row"
            class:sel={selectedName === e.name}
            ondblclick={() => openEntry(e)}
            onpointerdown={() => (selectedName = e.name)}
            oncontextmenu={(ev) => rowMenu(ev, e)}
            role="button"
            tabindex="-1"
          >
            <span class="ic" class:dir={e.type === 'dir'}>
              <Glyph name={e.type === 'dir' ? 'folder' : 'file'} size={view === 'grid' ? 30 : 16} />
            </span>
            {#if renaming === e.name}
              <!-- svelte-ignore a11y_autofocus -->
              <input
                class="field rename"
                bind:value={renameValue}
                autofocus
                onkeydown={(ev) => {
                  if (ev.key === 'Enter') commitRename(e.name)
                  if (ev.key === 'Escape') renaming = null
                }}
                onblur={() => commitRename(e.name)}
              />
            {:else}
              <span class="name" class:dir={e.type === 'dir'}>{e.name}</span>
              {#if view === 'list'}
                <span class="size dim mono">{e.type === 'dir' ? '—' : fmtSize(e.size)}</span>
                <span class="mod dim">{fmtTime(e.modified)}</span>
              {/if}
            {/if}
            {#if deleting}
              <button class="btn danger del" onclick={() => requestDelete(e)}>确认删除</button>
            {:else}
              <button class="btn-ico del-ico" onclick={(ev) => { ev.stopPropagation(); requestDelete(e) }} aria-label="删除">
                <Glyph name="trash" size={13} />
              </button>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <div class="status dim">
      {entries.length} 项 · {cwd}
      {#if sys && sys.caps.fs === 'none'} · 只读模式{/if}
    </div>
  </main>
</div>

<style>
  .page {
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .side {
    flex: none;
    width: 172px;
    padding: 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    border-right: 1px solid var(--stroke);
    overflow: auto;
  }
  .side-title {
    font-size: 11.5px;
    color: var(--text-faint);
    padding: 4px 8px 6px;
    letter-spacing: 0.08em;
  }
  .place {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 9px;
    border: none;
    background: transparent;
    border-radius: 9px;
    color: var(--text-dim);
    font: inherit;
    font-size: 12.5px;
    cursor: pointer;
    text-align: left;
  }
  .place:hover {
    background: var(--glass-soft);
    color: var(--text);
  }
  .place.on {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .side-foot {
    margin-top: auto;
    padding: 10px 8px 4px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bar {
    height: 4px;
    border-radius: 2px;
    background: var(--stroke);
    overflow: hidden;
  }
  .bar-in {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    border-radius: 2px;
  }
  .tiny {
    font-size: 11px;
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .toolbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 9px 12px;
    border-bottom: 1px solid var(--stroke);
  }
  .crumbs {
    display: flex;
    align-items: center;
    margin-left: 6px;
    font-size: 12.5px;
    overflow: hidden;
    white-space: nowrap;
  }
  .crumb {
    border: none;
    background: transparent;
    color: var(--text-dim);
    font: inherit;
    cursor: pointer;
    padding: 3px 6px;
    border-radius: 6px;
  }
  .crumb:hover {
    background: var(--glass-soft);
    color: var(--text);
  }
  .sl {
    font-size: 11px;
  }
  .spacer {
    flex: 1;
  }
  .content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 8px;
  }
  .content.grid-view {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 6px;
    align-content: start;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border-radius: 10px;
    cursor: default;
  }
  .grid-view .row {
    flex-direction: column;
    gap: 7px;
    padding: 13px 6px 10px;
    text-align: center;
  }
  .row:hover {
    background: var(--glass-soft);
  }
  .row.sel {
    background: var(--accent-soft);
  }
  .ic {
    display: inline-flex;
    color: var(--text-dim);
    flex: none;
  }
  .ic.dir {
    color: var(--accent);
  }
  .name {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .grid-view .name {
    flex: none;
    width: 100%;
    font-size: 12px;
  }
  .name.dir {
    font-weight: 550;
  }
  .size {
    width: 74px;
    text-align: right;
    font-size: 11.5px;
    flex: none;
  }
  .mod {
    width: 118px;
    font-size: 11.5px;
    flex: none;
    text-align: right;
  }
  .rename {
    flex: 1;
    padding: 4px 8px;
    font-size: 13px;
  }
  .del-ico {
    opacity: 0;
    flex: none;
  }
  .row:hover .del-ico {
    opacity: 1;
  }
  .del {
    flex: none;
  }
  .status {
    flex: none;
    padding: 7px 14px;
    font-size: 11.5px;
    border-top: 1px solid var(--stroke);
  }
  .empty {
    padding: 40px 16px;
    text-align: center;
  }
  .err {
    color: var(--err);
    font-size: 12.5px;
    padding: 14px;
  }
</style>
