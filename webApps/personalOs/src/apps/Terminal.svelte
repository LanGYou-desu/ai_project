<script lang="ts">
  // 终端：真命令、真文件系统。重定向由这里统一执行（命令层只拿 argv）。
  import type { Sys } from '../kernel/kernel.ts'
  import { parseCommandLine } from '../kernel/terminal/parser.ts'
  import {
    COMMANDS,
    completeLine,
    setLogProvider,
    type OutLine,
    type TermCtx,
  } from '../kernel/terminal/commands.ts'
  import { DiskError, errnoText } from '../kernel/disk/errors.ts'
  import { PATHS } from '../services/installer.ts'
  import { profile } from '../data/profile.ts'
  import {
    getKernelOrNull,
    openApp,
    closeWindow,
    setTheme,
    setWallpaper,
    shutdownSystem,
    rebootSystem,
  } from '../state.svelte.ts'

  interface Props {
    sys: Sys | null
    arg?: string
    winId: number
  }
  let { sys, winId }: Props = $props()

  interface Line {
    segments: { text: string; cls?: string }[]
  }

  let lines = $state<Line[]>([])
  let input = $state('')
  let cwd = $state(PATHS.home)
  let sudo = $state(false)
  let history = $state<string[]>([])
  let histIdx = $state(-1)
  let busy = $state(false)
  let scrollEl: HTMLDivElement | null = $state(null)
  let inputEl: HTMLInputElement | null = $state(null)
  let bannerShown = false

  const HISTORY_PATH = `${PATHS.home}/配置/终端历史`
  const HISTORY_MAX = 200
  const LINE_MAX = 2000

  // dmesg 需要读内核环形日志：注入给命令层
  setLogProvider(() => getKernelOrNull()?.log.tail(60) ?? [])

  function toLine(line: string | OutLine): Line {
    if (typeof line === 'string') return { segments: [{ text: line }] }
    if (line.segments) return { segments: line.segments }
    return { segments: [{ text: line.text, cls: line.cls }] }
  }

  function clsOf(cls?: string): string {
    if (!cls) return ''
    return cls.startsWith('seg-') ? cls : 'tl-' + cls
  }

  function push(line: string | OutLine): void {
    lines.push(toLine(line))
    if (lines.length > LINE_MAX) lines.splice(0, lines.length - LINE_MAX)
  }

  function promptSegments(): { text: string; cls?: string }[] {
    return [
      { text: `${profile.owner}@personal-os`, cls: 'ok' },
      { text: ':', cls: 'dim' },
      { text: cwd, cls: 'accent' },
      { text: sudo ? ' # ' : ' $ ', cls: 'dim' },
    ]
  }

  function diskErrLine(e: unknown): OutLine {
    if (e instanceof DiskError) {
      const prefix = errnoText(e.code)
      return { text: `disk: ${prefix}${e.message ? '：' + e.message : ''}`, cls: 'err' }
    }
    return { text: `错误：${e instanceof Error ? e.message : String(e)}`, cls: 'err' }
  }

  $effect(() => {
    if (sys && !bannerShown) {
      bannerShown = true
      push({ text: `personal-os 终端 v0.1.0 —— ${profile.owner}@personal-os`, cls: 'accent' })
      push({ text: '输入 help 查看全部命令；sudo 解锁 /系统 写入；试试 df、tree、neofetch、fsck。', cls: 'dim' })
    }
  })

  // 历史跨会话持久化：从磁盘读回来（首次没有文件就忽略）
  $effect(() => {
    const s = sys
    if (!s) return
    try {
      const raw = s.fs.readText(HISTORY_PATH)
      const items = raw.split('\n').filter((x) => x.length > 0)
      if (items.length > 0) history = items.slice(-HISTORY_MAX)
    } catch {
      /* 还没有历史文件 */
    }
  })

  $effect(() => {
    lines.length
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight
  })

  /** 命令历史写盘：文件增长到上限时整体重写，否则追加一行 */
  function persistHistory(): void {
    const s = sys
    if (!s || history.length === 0) return
    try {
      if (history.length >= HISTORY_MAX) {
        s.fs.write(HISTORY_PATH, history.join('\n') + '\n')
      } else {
        s.fs.append(HISTORY_PATH, history[history.length - 1] + '\n')
      }
    } catch {
      /* 写历史失败不影响终端使用 */
    }
  }

  async function run(raw: string): Promise<void> {
    if (!sys) return
    push({ text: '', segments: [...promptSegments(), { text: raw }] })
    const parsed = parseCommandLine(raw)
    if (!parsed) return
    const { argv, redirect } = parsed
    const name = argv[0]
    history = [...history, raw].slice(-HISTORY_MAX)
    histIdx = -1
    persistHistory()
    const cmd = COMMANDS[name]
    if (!cmd) {
      push({ text: `未找到命令：${name}。输入 help 查看全部命令。`, cls: 'err' })
      return
    }

    busy = true
    try {
      const buf: string[] = []
      const out = (line: string | OutLine) => {
        if (redirect) {
          buf.push(
            toLine(line)
              .segments.map((s) => s.text)
              .join(''),
          )
        } else {
          push(line)
        }
      }
      const ctx: TermCtx = {
        argv,
        cwd,
        home: PATHS.home,
        sudo,
        sys,
        owner: profile.owner,
        out,
        setCwd: (p) => (cwd = p),
        setSudo: (v) => (sudo = v),
        setTheme,
        setWallpaper,
        openApp: (appId, arg) => openApp(appId, arg),
        shutdown: () => void shutdownSystem(),
        reboot: rebootSystem,
        exit: () => closeWindow(winId),
        clearScreen: () => (lines = []),
        historySnapshot: () => [...history],
      }
      await cmd.run(ctx)
      if (redirect) {
        const text = buf.join('\n') + (buf.length > 0 ? '\n' : '')
        try {
          if (redirect.mode === '>>') sys.fs.append(redirect.target, text, { cwd, sudo })
          else sys.fs.write(redirect.target, text, { cwd, sudo })
          push({ text: `已写入 ${redirect.target}（${text.length} 字符）`, cls: 'dim' })
        } catch (e) {
          push(diskErrLine(e))
        }
      }
    } catch (e) {
      push(diskErrLine(e))
    } finally {
      busy = false
    }
  }

  function nav(dir: number): void {
    if (history.length === 0) return
    let idx = histIdx === -1 ? history.length : histIdx
    idx += dir
    if (idx < 0) idx = 0
    if (idx >= history.length) {
      histIdx = -1
      input = ''
      return
    }
    histIdx = idx
    input = history[idx]
  }

  function doComplete(): void {
    if (!sys) return
    const results = completeLine(sys, cwd, input)
    if (results.length === 1) {
      const tokens = input.split(/\s+/)
      tokens[tokens.length - 1] = results[0]
      input = tokens.join(' ')
      return
    }
    if (results.length > 1) {
      push({ text: '', segments: [...promptSegments(), { text: input }] })
      push({ text: results.join('   '), cls: 'dim' })
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      const v = input
      input = ''
      void run(v)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      nav(-1)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      nav(1)
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      doComplete()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault()
      lines = []
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      // Windows Terminal 习惯：有选中文本就复制，没有选中才是中断
      const sel = window.getSelection?.()?.toString() ?? ''
      if (sel.trim()) {
        e.preventDefault()
        void navigator.clipboard?.writeText(sel).catch(() => undefined)
        return
      }
      if (e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        push({ text: '', segments: [...promptSegments(), { text: input + '^C', cls: 'dim' }] })
        input = ''
      }
    }
  }
</script>

<div class="term" onpointerdown={() => inputEl?.focus()} role="presentation">
  <div class="screen mono" bind:this={scrollEl}>
    {#each lines as line, i (i)}
      <div class="line">
        {#each line.segments as seg, j (j)}<span class={clsOf(seg.cls)}>{seg.text}</span>{/each}
      </div>
    {/each}
    <div class="line prompt-line">
      {#each promptSegments() as seg, i (i)}<span class={clsOf(seg.cls)}>{seg.text}</span>{/each}
      <input
        class="input"
        bind:this={inputEl}
        bind:value={input}
        onkeydown={onKeydown}
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        aria-label="终端输入"
      />
      {#if busy}<span class="busy dim">…</span>{/if}
    </div>
  </div>
</div>

<style>
  .term {
    flex: 1;
    min-height: 0;
    background: var(--term-bg);
    cursor: text;
  }
  .screen {
    height: 100%;
    overflow: auto;
    padding: 12px 15px 16px;
    font-family: var(--font-mono);
    font-size: 12.5px;
    line-height: 1.68;
    color: var(--term-text);
  }
  .line {
    white-space: pre-wrap;
    word-break: break-word;
    display: flex;
    align-items: baseline;
  }
  .prompt-line {
    flex-wrap: wrap;
  }
  .prompt-line > span {
    white-space: pre;
  }
  .input {
    flex: 1;
    min-width: 60px;
    border: none;
    background: transparent;
    color: var(--term-text);
    font: inherit;
    outline: none;
    padding: 0;
    caret-color: var(--accent);
  }
  .busy {
    animation: po-pulse 1s ease infinite;
  }
</style>
