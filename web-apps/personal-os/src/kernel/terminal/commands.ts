// 终端命令注册表：每个命令都是纯逻辑（拿 Sys 门面干活），可单测
import type { Sys } from '../kernel.ts'
import { DiskError, errnoText } from '../disk/errors.ts'
import { joinPath, splitPath, type Entry } from '../disk/fs.ts'
import { formatUptime } from '../clock.ts'

export interface OutLine {
  text: string
  cls?: string
  segments?: { text: string; cls?: string }[]
}

export interface TermCtx {
  argv: string[]
  cwd: string
  home: string
  sudo: boolean
  sys: Sys
  owner: string
  out(line: OutLine | string): void
  setCwd(p: string): void
  setSudo(v: boolean): void
  setTheme(t: 'glass-dark' | 'glass-light'): void
  setWallpaper(w: string): void
  openApp(appId: string, arg?: string): void
  shutdown(): void
  reboot(): void
  exit(): void
  clearScreen(): void
  historySnapshot(): string[]
}

export interface Command {
  name: string
  help: string
  usage?: string
  run(ctx: TermCtx): void | Promise<void>
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`
}

export function fmtTime(unixSec: number): string {
  if (!unixSec) return '-'
  const d = new Date(unixSec * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function basename(p: string): string {
  const segs = splitPath(p)
  return segs[segs.length - 1] ?? p
}

function absPath(ctx: TermCtx, p: string): string {
  const resolved = p.startsWith('~') ? ctx.home + p.slice(1) : p
  if (resolved.startsWith('/')) return resolved
  return joinPath(splitPath(resolved, ctx.cwd))
}

function err(ctx: TermCtx, e: unknown): void {
  if (e instanceof DiskError) {
    const prefix = errnoText(e.code)
    const detail = e.message && !e.message.includes(prefix) ? `：${e.message}` : ''
    ctx.out({ text: `${prefix}${detail}`, cls: 'err' })
  } else {
    ctx.out({ text: `错误：${e instanceof Error ? e.message : String(e)}`, cls: 'err' })
  }
}

function ok(ctx: TermCtx, text: string): void {
  ctx.out({ text, cls: 'ok' })
}

async function guard(ctx: TermCtx, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (e) {
    err(ctx, e)
  }
}

/** cp/mv 的目标解析：目标若是目录，则视为“移动/复制到这里” */
function resolveDest(ctx: TermCtx, dest: string): string {
  try {
    const st = ctx.sys.fs.stat(absPath(ctx, dest), '/')
    if (st.type === 'dir') return absPath(ctx, dest).replace(/\/+$/, '') + '/' + basename(ctx.argv[1])
  } catch {
    /* 目标不存在：直接用 */
  }
  return dest
}

const CMDS: Command[] = [
  {
    name: 'help',
    help: '显示所有命令',
    run(ctx) {
      const rows = Object.values(COMMANDS).map((c) => ({
        name: c.name,
        text: `${c.name.padEnd(10)} ${(c.usage ?? '').padEnd(24)} ${c.help}`,
      }))
      ctx.out({ text: 'personal-os 终端命令一览', cls: 'accent' })
      for (const r of rows) ctx.out({ text: r.text, cls: 'dim' })
      ctx.out({ text: '提示：支持 Tab 补全、↑↓ 历史；sudo 解锁系统区写入。', cls: 'dim' })
    },
  },
  {
    name: 'clear',
    help: '清屏',
    run(ctx) {
      ctx.clearScreen()
    },
  },
  {
    name: 'echo',
    help: '输出文本，或用 > / >> 写入文件',
    usage: 'echo 文本 [> 文件]',
    run(ctx) {
      const text = ctx.argv.slice(1).join(' ')
      if (!text) return
      ctx.out(text)
    },
  },
  {
    name: 'pwd',
    help: '显示当前目录',
    run(ctx) {
      ctx.out(ctx.cwd)
    },
  },
  {
    name: 'cd',
    help: '切换目录',
    usage: 'cd <目录>',
    run(ctx) {
      const target = absPath(ctx, ctx.argv[1] ?? ctx.home)
      return guard(ctx, () => {
        const st = ctx.sys.fs.stat(target, '/')
        if (st.type !== 'dir') throw new DiskError('ENOTDIR', `${target} 不是目录`)
        ctx.setCwd(target)
      })
    },
  },
  {
    name: 'ls',
    help: '列出目录内容',
    usage: 'ls [目录]',
    run(ctx) {
      return guard(ctx, () => {
        const target = absPath(ctx, ctx.argv[1] ?? '.')
        const st = ctx.sys.fs.stat(target, '/')
        if (st.type === 'file') {
          ctx.out(st.name)
          return
        }
        const entries = ctx.sys.fs.list(target, '/')
        if (entries.length === 0) {
          ctx.out({ text: '（空目录）', cls: 'dim' })
          return
        }
        const names = entries.map((e) => e.name + (e.type === 'dir' ? '/' : ''))
        const colW = Math.max(...names.map((n) => [...n].length)) + 2
        const perRow = Math.max(1, Math.floor(78 / colW))
        for (let i = 0; i < entries.length; i += perRow) {
          const row = entries.slice(i, i + perRow)
          const segments = row.map((e, idx) => {
            const name = e.name + (e.type === 'dir' ? '/' : '')
            const pad = ' '.repeat(Math.max(1, colW - [...name].length))
            return { text: name + (idx === row.length - 1 ? '' : pad), cls: e.type === 'dir' ? 'accent' : '' }
          })
          ctx.out({ text: row.map((e) => e.name).join(' '), segments })
        }
      })
    },
  },
  {
    name: 'cat',
    help: '查看文件内容',
    usage: 'cat <文件>',
    run(ctx) {
      if (!ctx.argv[1]) {
        ctx.out({ text: '用法：cat <文件>', cls: 'err' })
        return
      }
      return guard(ctx, () => {
        const text = ctx.sys.fs.readText(absPath(ctx, ctx.argv[1]), '/')
        for (const line of text.replace(/\n$/, '').split('\n')) ctx.out(line)
      })
    },
  },
  {
    name: 'mkdir',
    help: '新建目录',
    usage: 'mkdir <目录>',
    run(ctx) {
      const targets = ctx.argv.slice(1)
      if (targets.length === 0) {
        ctx.out({ text: '用法：mkdir <目录>', cls: 'err' })
        return
      }
      return guard(ctx, () => {
        for (const t of targets) {
          ctx.sys.fs.mkdir(absPath(ctx, t), { sudo: ctx.sudo })
          ok(ctx, `已创建目录 ${absPath(ctx, t)}`)
        }
      })
    },
  },
  {
    name: 'touch',
    help: '新建空文件',
    usage: 'touch <文件>',
    run(ctx) {
      const target = ctx.argv[1]
      if (!target) {
        ctx.out({ text: '用法：touch <文件>', cls: 'err' })
        return
      }
      return guard(ctx, () => {
        const p = absPath(ctx, target)
        if (!ctx.sys.fs.exists(p, '/')) {
          ctx.sys.fs.write(p, '', { sudo: ctx.sudo })
          ok(ctx, `已创建 ${p}`)
        }
      })
    },
  },
  {
    name: 'rm',
    help: '删除文件或目录（目录需 -r）',
    usage: 'rm [-r] <路径>',
    run(ctx) {
      const recursive = ctx.argv.slice(1).some((a) => a === '-r' || a === '-rf' || a === '-fr')
      const targets = ctx.argv.slice(1).filter((a) => !a.startsWith('-'))
      if (targets.length === 0) {
        ctx.out({ text: '用法：rm [-r] <路径>', cls: 'err' })
        return
      }
      return guard(ctx, () => {
        for (const t of targets) {
          const p = absPath(ctx, t)
          const st = ctx.sys.fs.stat(p, '/')
          if (st.type === 'dir' && !recursive) {
            throw new DiskError('ENOTEMPTY', `${p} 是目录，需要 rm -r`)
          }
          ctx.sys.fs.unlink(p, { sudo: ctx.sudo, recursive })
          ok(ctx, `已删除 ${p}`)
        }
      })
    },
  },
  {
    name: 'mv',
    help: '移动或重命名',
    usage: 'mv <源> <目标>',
    run(ctx) {
      if (ctx.argv.length < 3) {
        ctx.out({ text: '用法：mv <源> <目标>', cls: 'err' })
        return
      }
      return guard(ctx, () => {
        const dest = resolveDest(ctx, ctx.argv[2])
        ctx.sys.fs.rename(absPath(ctx, ctx.argv[1]), absPath(ctx, dest), { sudo: ctx.sudo })
        ok(ctx, `已移动：${absPath(ctx, ctx.argv[1])} → ${absPath(ctx, dest)}`)
      })
    },
  },
  {
    name: 'cp',
    help: '复制文件',
    usage: 'cp <源> <目标>',
    run(ctx) {
      if (ctx.argv.length < 3) {
        ctx.out({ text: '用法：cp <源> <目标>', cls: 'err' })
        return
      }
      return guard(ctx, () => {
        const src = absPath(ctx, ctx.argv[1])
        const st = ctx.sys.fs.stat(src, '/')
        if (st.type === 'dir') throw new DiskError('EISDIR', '暂不支持复制目录')
        const dest = absPath(ctx, resolveDest(ctx, ctx.argv[2]))
        const data = ctx.sys.fs.readBytes(src, '/')
        ctx.sys.fs.write(dest, data, { sudo: ctx.sudo })
        ok(ctx, `已复制到 ${dest}（${fmtSize(data.length)}）`)
      })
    },
  },
  {
    name: 'tree',
    help: '树状显示目录（最多 3 层）',
    usage: 'tree [目录]',
    run(ctx) {
      return guard(ctx, () => {
        const start = absPath(ctx, ctx.argv[1] ?? '.')
        ctx.out({ text: start, cls: 'accent' })
        let count = 0
        const walk = (p: string, prefix: string, depth: number) => {
          if (depth > 3 || count > 200) return
          const entries = ctx.sys.fs.list(p, '/')
          entries.forEach((e, idx) => {
            if (count++ > 200) return
            const last = idx === entries.length - 1
            ctx.out({ text: `${prefix}${last ? '└─ ' : '├─ '}${e.name}${e.type === 'dir' ? '/' : ''}`, cls: e.type === 'dir' ? 'accent' : '' })
            if (e.type === 'dir') walk(joinPath([...splitPath(p), e.name]), prefix + (last ? '   ' : '│  '), depth + 1)
          })
        }
        walk(start, '', 1)
      })
    },
  },
  {
    name: 'du',
    help: '统计目录占用',
    usage: 'du [目录]',
    run(ctx) {
      return guard(ctx, () => {
        const target = absPath(ctx, ctx.argv[1] ?? '.')
        const entries = ctx.sys.fs.list(target, '/')
        let total = 0
        for (const e of entries) {
          if (e.type === 'file') {
            total += e.size
            ctx.out({ text: `${fmtSize(e.size).padStart(10)}  ${e.name}` })
          } else {
            const items = ctx.sys.fs.walk(joinPath([...splitPath(target), e.name]), '/')
            const size = items.reduce((n, i) => n + (i.entry.type === 'file' ? i.entry.size : 0), 0)
            total += size
            ctx.out({ text: `${fmtSize(size).padStart(10)}  ${e.name}/`, cls: 'accent' })
          }
        }
        ctx.out({ text: `${fmtSize(target === '.' ? total : total).padStart(10)}  合计`, cls: 'dim' })
      })
    },
  },
  {
    name: 'stat',
    help: '查看条目详情',
    usage: 'stat <路径>',
    run(ctx) {
      if (!ctx.argv[1]) {
        ctx.out({ text: '用法：stat <路径>', cls: 'err' })
        return
      }
      return guard(ctx, () => {
        const p = absPath(ctx, ctx.argv[1])
        const st = ctx.sys.fs.stat(p, '/')
        const blocks = Math.ceil(st.size / 512)
        const rows: [string, string][] = [
          ['路径', p],
          ['类型', st.type === 'dir' ? '目录' : '文件'],
          ['大小', st.type === 'dir' ? '-' : fmtSize(st.size)],
          ['占用块', st.type === 'dir' ? String(st.firstBlock || '0') : `${blocks} 块`],
          ['首块', String(st.firstBlock)],
          ['创建', fmtTime(st.created)],
          ['修改', fmtTime(st.modified)],
        ]
        for (const [k, v] of rows) ctx.out({ text: `${k.padEnd(4, '　')}  ${v}` })
      })
    },
  },
  {
    name: 'df',
    help: '磁盘用量与块图',
    run(ctx) {
      return guard(ctx, () => {
        const s = ctx.sys.disk.status()
        const pct = Math.round((s.used / s.total) * 100)
        ctx.out({ text: `磁盘 ${s.label}   ${fmtSize(s.used)} / ${fmtSize(s.total)}  已用 ${pct}%   写次数 ${s.writes}   模式 ${s.mode}`, cls: 'accent' })
        const map = ctx.sys.disk.blockMap()
        const chars = ['░', '█', '█', '█', '█', '█']
        const cls = ['seg-free', 'seg-super', 'seg-fat', 'seg-reserved', 'seg-dir', 'seg-file']
        for (let row = 0; row < 8; row++) {
          const segments: { text: string; cls?: string }[] = []
          for (let col = 0; col < 64; col++) {
            const idx = row * 64 + col
            if (idx >= map.length) break
            segments.push({ text: chars[map[idx]], cls: cls[map[idx]] })
          }
          ctx.out({ text: '', segments })
        }
        ctx.out({
          text: '图例：█ 超级块 █ FAT █ 引导区 █ 目录 █ 文件 ░ 空闲',
          cls: 'dim',
          segments: [
            { text: '图例：', cls: 'dim' },
            { text: '█', cls: 'seg-super' }, { text: '超级块  ', cls: 'dim' },
            { text: '█', cls: 'seg-fat' }, { text: 'FAT  ', cls: 'dim' },
            { text: '█', cls: 'seg-reserved' }, { text: '引导区  ', cls: 'dim' },
            { text: '█', cls: 'seg-dir' }, { text: '目录  ', cls: 'dim' },
            { text: '█', cls: 'seg-file' }, { text: '文件  ', cls: 'dim' },
            { text: '░', cls: 'seg-free' }, { text: '空闲', cls: 'dim' },
          ],
        })
      })
    },
  },
  {
    name: 'fsck',
    help: '磁盘一致性检查（-y 自动修复）',
    usage: 'fsck [-y]',
    run(ctx) {
      return guard(ctx, () => {
        const repair = ctx.argv.includes('-y')
        if (!repair) {
          const r = ctx.sys.disk.fsck(false)
          if ('issues' in r) {
            if (r.ok) {
              ok(ctx, `磁盘一致性检查通过（${r.stats.blocks} 块，${r.stats.files} 文件，${r.stats.dirs} 目录）`)
              for (const i of r.issues) ctx.out({ text: `  [${i.severity}] ${i.kind}: ${i.detail}`, cls: 'dim' })
            } else if (r.fatal) {
              ctx.out({ text: `发现致命问题：${r.fatal}`, cls: 'err' })
            } else {
              ctx.out({ text: `发现 ${r.issues.filter((i) => i.severity === 'error').length} 处问题：`, cls: 'warn' })
              for (const i of r.issues) {
                if (i.severity === 'error') ctx.out({ text: `  [${i.kind}] ${i.detail}`, cls: 'err' })
                else ctx.out({ text: `  [${i.kind}] ${i.detail}`, cls: 'dim' })
              }
              ctx.out({ text: '运行 fsck -y 可自动修复。', cls: 'dim' })
            }
          }
          return
        }
        const r = ctx.sys.disk.fsck(true)
        if ('before' in r) {
          for (const f of r.fixed) ctx.out({ text: `  fsck: ${f}`, cls: 'ok' })
          if (r.after.ok) ok(ctx, '修复完成，磁盘现在是一致的。')
          else ctx.out({ text: `修复后仍有问题：${r.after.fatal ?? '存在错误'}`, cls: 'err' })
        }
      })
    },
  },
  {
    name: 'mount',
    help: '显示挂载信息',
    run(ctx) {
      return guard(ctx, () => {
        const s = ctx.sys.disk.status()
        const rows: [string, string][] = [
          ['设备', 'disk.img（256 KiB，FAT-lite）'],
          ['卷标', s.label],
          ['版本', `v${s.version}`],
          ['模式', s.mode === 'http' ? '伙伴服务器（项目目录 disk/disk.img）' : s.mode === 'static' ? '静态镜像（只读基础 + 本地暂存）' : '内存盘'],
          ['已用', `${fmtSize(s.used)} / ${fmtSize(s.total)}`],
          ['条目', `${s.files} 文件 / ${s.dirs} 目录`],
          ['安装', fmtTime(Math.floor(s.installTime / 1000))],
        ]
        for (const [k, v] of rows) ctx.out({ text: `${k.padEnd(4, '　')}  ${v}` })
      })
    },
  },
  {
    name: 'sync',
    help: '把内存中的磁盘写回镜像文件',
    run(ctx) {
      return guard(ctx, async () => {
        await ctx.sys.disk.sync()
        ok(ctx, '已同步：内存盘 -> disk.img')
      })
    },
  },
  {
    name: 'dmesg',
    help: '查看内核日志',
    run(ctx) {
      const entries = ctx.sys.procs.list() // 触发一次真实调用
      void entries
      const lines = kernelLogTail()
      for (const l of lines) {
        const time = new Date(l.t)
        const p = (n: number) => String(n).padStart(2, '0')
        const cls = l.level === 'err' ? 'err' : l.level === 'warn' ? 'warn' : l.level === 'ok' ? 'ok' : 'dim'
        ctx.out({
          text: '',
          segments: [
            { text: `${p(time.getHours())}:${p(time.getMinutes())}:${p(time.getSeconds())} `, cls: 'dim' },
            { text: `[${l.tag}] `, cls: l.level === 'err' ? 'err' : l.level === 'ok' ? 'ok' : 'accent' },
            { text: l.msg, cls },
          ],
        })
      }
    },
  },
  {
    name: 'ps',
    help: '列出进程',
    run(ctx) {
      const procs = ctx.sys.procs.list()
      ctx.out({ text: `${'PID'.padEnd(5)} ${'应用'.padEnd(12)} ${'状态'.padEnd(6)} ${'调用'.padEnd(6)} 速率  标题`, cls: 'accent' })
      for (const p of procs) {
        ctx.out({
          text: `${String(p.pid).padEnd(5)} ${p.appId.padEnd(12)} ${(p.state === 'running' ? '运行' : '挂起').padEnd(6)} ${String(p.calls).padEnd(6)} ${p.rate.toFixed(1).padStart(5)}  ${p.title}`,
          cls: 'dim',
        })
      }
      ctx.out({ text: `共 ${procs.length} 个进程`, cls: 'dim' })
    },
  },
  {
    name: 'kill',
    help: '终止进程（关闭对应窗口）',
    usage: 'kill <pid>',
    run(ctx) {
      const pid = Number(ctx.argv[1])
      if (!Number.isInteger(pid) || pid <= 0) {
        ctx.out({ text: '用法：kill <pid>（用 ps 查看）', cls: 'err' })
        return
      }
      const exists = ctx.sys.procs.list().some((p) => p.pid === pid)
      if (!exists) {
        ctx.out({ text: `没有 PID 为 ${pid} 的进程`, cls: 'err' })
        return
      }
      ctx.sys.procs.exit(pid)
      ok(ctx, `已终止进程 ${pid}`)
    },
  },
  {
    name: 'open',
    help: '打开应用或目录',
    usage: 'open <应用|目录>',
    run(ctx) {
      const target = ctx.argv[1]
      if (!target) {
        ctx.out({ text: '用法：open <应用|目录>，例如 open about / open . / open music', cls: 'err' })
        return
      }
      if (target === '.' || target === '..' || target.startsWith('/') || target.startsWith('~')) {
        ctx.openApp('files', absPath(ctx, target))
        return
      }
      ctx.openApp(target)
    },
  },
  {
    name: 'edit',
    help: '用记事本打开文件',
    usage: 'edit <文件>',
    run(ctx) {
      const target = ctx.argv[1]
      if (!target) {
        ctx.out({ text: '用法：edit <文件>', cls: 'err' })
        return
      }
      ctx.openApp('notepad', absPath(ctx, target))
    },
  },
  {
    name: 'sudo',
    help: '切换管理员模式（-k 退出）',
    usage: 'sudo [-k]',
    run(ctx) {
      if (ctx.argv[1] === '-k') {
        ctx.setSudo(false)
        ok(ctx, '已退出 sudo 模式')
        return
      }
      ctx.setSudo(true)
      ok(ctx, '已进入 sudo 模式：系统区（/系统）现在可写。')
    },
  },
  {
    name: 'whoami',
    help: '显示当前用户',
    run(ctx) {
      ctx.out(`${ctx.owner}${ctx.sudo ? '（sudo）' : ''}`)
    },
  },
  {
    name: 'uname',
    help: '系统信息',
    run(ctx) {
      ctx.out('personal-os 0.1.0  kernel:svelte5/ts  fs:FAT-lite  disk:256KiB')
    },
  },
  {
    name: 'date',
    help: '当前时间',
    run(ctx) {
      ctx.out(new Date().toLocaleString('zh-CN', { hour12: false }))
    },
  },
  {
    name: 'history',
    help: '命令历史',
    run(ctx) {
      const history = ctx.historySnapshot()
      history.forEach((h, i) => ctx.out({ text: `${String(i + 1).padStart(4)}  ${h}`, cls: 'dim' }))
    },
  },
  {
    name: 'theme',
    help: '切换主题',
    usage: 'theme dark|light',
    run(ctx) {
      const t = ctx.argv[1]
      if (t !== 'dark' && t !== 'light') {
        ctx.out({ text: '用法：theme dark|light', cls: 'err' })
        return
      }
      ctx.setTheme(t === 'dark' ? 'glass-dark' : 'glass-light')
      ok(ctx, `主题已切换为 ${t === 'dark' ? '玻璃暗色' : '玻璃亮色'}`)
    },
  },
  {
    name: 'wallpaper',
    help: '切换壁纸',
    usage: 'wallpaper aurora|dusk|deep|mono',
    run(ctx) {
      const w = ctx.argv[1]
      const valid = ['aurora', 'dusk', 'deep', 'mono']
      if (!w || !valid.includes(w)) {
        ctx.out({ text: `用法：wallpaper ${valid.join('|')}`, cls: 'err' })
        return
      }
      ctx.setWallpaper(w)
      ok(ctx, `壁纸已切换为 ${w}`)
    },
  },
  {
    name: 'neofetch',
    help: '系统信息卡片',
    run(ctx) {
      const s = ctx.sys.disk.status()
      const pct = Math.round((s.used / s.total) * 100)
      const art = [
        '   ▄▄████▄▄',
        '  ██████████',
        '  ██  ██  ██',
        '  ██████████',
        '  ▀████████▀',
      ]
      const info = [
        `${ctx.owner}@${'personal-os'}`,
        '──────────────────────',
        `系统    personal-os 0.1.0`,
        `内核    svelte-5 + FAT-lite`,
        `磁盘    ${s.label} 256 KiB（已用 ${pct}%）`,
        `条目    ${s.files} 文件 / ${s.dirs} 目录`,
        `进程    ${ctx.sys.procs.list().length}`,
        `运行    ${formatUptime(Date.now() - s.installTime)}`,
      ]
      const rows = Math.max(art.length, info.length)
      for (let i = 0; i < rows; i++) {
        const a = (art[i] ?? '').padEnd(16)
        ctx.out({ text: '', segments: [{ text: a, cls: 'accent' }, { text: info[i] ?? '', cls: i <= 1 ? '' : 'dim' }] })
      }
    },
  },
  {
    name: 'exit',
    help: '关闭这个终端窗口',
    run(ctx) {
      ctx.exit()
    },
  },
  {
    name: 'shutdown',
    help: '关机（保存并卸载磁盘）',
    run(ctx) {
      ctx.shutdown()
    },
  },
  {
    name: 'reboot',
    help: '重启',
    run(ctx) {
      ctx.reboot()
    },
  },
]

export const COMMANDS: Record<string, Command> = Object.fromEntries(CMDS.map((c) => [c.name, c]))

// dmesg 需要通过内核日志读取：由 Terminal 组件在 ctx 创建时注入
export interface LogEntryLike {
  t: number
  level: string
  tag: string
  msg: string
}
let logProvider: () => LogEntryLike[] = () => []
export function setLogProvider(fn: () => LogEntryLike[]): void {
  logProvider = fn
}
function kernelLogTail(): LogEntryLike[] {
  return logProvider().slice(-40)
}

/** Tab 补全：首词补全命令，其余按路径补全 */
export function completeLine(sys: Sys, cwd: string, line: string): string[] {
  const tokens = line.split(/\s+/)
  if (tokens.length <= 1) {
    const partial = tokens[0] ?? ''
    return Object.keys(COMMANDS)
      .filter((c) => c.startsWith(partial))
      .sort()
  }
  const partial = tokens[tokens.length - 1]
  const slash = partial.lastIndexOf('/')
  const dirPart = slash >= 0 ? partial.slice(0, slash + 1) || '/' : '.'
  const namePart = slash >= 0 ? partial.slice(slash + 1) : partial
  try {
    const entries = sys.fs.list(dirPart, cwd)
    return entries
      .filter((e) => e.name.startsWith(namePart))
      .map((e) => (slash >= 0 ? dirPart : '') + e.name + (e.type === 'dir' ? '/' : ''))
  } catch {
    return []
  }
}
