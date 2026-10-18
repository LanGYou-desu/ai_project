// 终端：命令行解析、命令执行（真文件系统）、Tab 补全
import { describe, it, expect } from 'vitest'
import { Kernel, type Sys } from '../src/kernel/kernel.ts'
import type { Persister } from '../src/kernel/disk/blockdev.ts'
import { parseCommandLine } from '../src/kernel/terminal/parser.ts'
import { COMMANDS, completeLine, setLogProvider, type TermCtx } from '../src/kernel/terminal/commands.ts'
import { installSeed, HOME, PATHS } from '../src/services/installer.ts'
import { profile } from '../src/data/profile.ts'

class NullPersister implements Persister {
  readonly kind = 'memory' as const
  async load(): Promise<Uint8Array | null> {
    return null
  }
  async save(): Promise<void> {
    /* noop */
  }
}

async function makeSys(): Promise<{ sys: Sys; kernel: Kernel }> {
  const kernel = await Kernel.boot(new NullPersister(), [])
  installSeed(kernel.fs, 1700000000000)
  const sys = kernel.sysFor('terminal', 1, { fs: 'sys', allowSudo: true })
  return { sys, kernel }
}

interface Harness {
  lines: string[]
  cwd: string
  sudo: boolean
  theme: string
  wallpaper: string
  opened: string[]
  exits: number
  run(line: string): Promise<string[]>
}

function makeHarness(sys: Sys): Harness {
  const h = {
    lines: [] as string[],
    cwd: HOME,
    sudo: false,
    theme: '',
    wallpaper: '',
    opened: [] as string[],
    exits: 0,
  }
  const ctx: TermCtx = {
    argv: [],
    cwd: HOME,
    home: HOME,
    sudo: false,
    sys,
    owner: profile.owner,
    out: (l) =>
      h.lines.push(
        typeof l === 'string' ? l : l.text + (l.segments?.map((s) => s.text).join('') ?? ''),
      ),
    setCwd: (p) => {
      h.cwd = p
      ctx.cwd = p
    },
    setSudo: (v) => {
      h.sudo = v
      ctx.sudo = v
    },
    setTheme: (t) => {
      h.theme = t
    },
    setWallpaper: (w) => {
      h.wallpaper = w
    },
    openApp: (id, arg) => h.opened.push(arg ? `${id}:${arg}` : id),
    shutdown: () => {},
    reboot: () => {},
    exit: () => {
      h.exits++
    },
    clearScreen: () => {
      h.lines = []
    },
    historySnapshot: () => [],
  }
  const run = async (line: string): Promise<string[]> => {
    const parsed = parseCommandLine(line)
    if (!parsed) return h.lines
    ctx.argv = parsed.argv
    const cmd = COMMANDS[parsed.argv[0]]
    if (!cmd) {
      h.lines.push(`未知命令：${parsed.argv[0]}`)
      return h.lines
    }
    await cmd.run(ctx)
    return h.lines
  }
  return Object.assign(h, { run })
}

describe('命令行解析器', () => {
  it('拆分参数、引号与转义', () => {
    expect(parseCommandLine('echo hello world')?.argv).toEqual(['echo', 'hello', 'world'])
    expect(parseCommandLine('cat "a b.txt"')?.argv).toEqual(['cat', 'a b.txt'])
    expect(parseCommandLine("cat 'x y'")?.argv).toEqual(['cat', 'x y'])
    expect(parseCommandLine('echo a\\ b')?.argv).toEqual(['echo', 'a b'])
    expect(parseCommandLine('echo "a > b"')?.argv).toEqual(['echo', 'a > b'])
  })

  it('重定向 > 与 >>', () => {
    const a = parseCommandLine('echo hi > /out.txt')
    expect(a?.argv).toEqual(['echo', 'hi'])
    expect(a?.redirect).toEqual({ mode: '>', target: '/out.txt' })
    const b = parseCommandLine('ls /系统 >> 记录.txt')
    expect(b?.argv).toEqual(['ls', '/系统'])
    expect(b?.redirect).toEqual({ mode: '>>', target: '记录.txt' })
  })

  it('空行返回 null；纯重定向返回 null', () => {
    expect(parseCommandLine('   ')).toBeNull()
    expect(parseCommandLine('> /out.txt')).toBeNull()
  })
})

describe('终端命令（真文件系统）', () => {
  it('ls：列主目录内容', async () => {
    const { sys } = await makeSys()
    const h = makeHarness(sys)
    await h.run('ls')
    const text = h.lines.join(' ')
    expect(text).toContain('关于')
    expect(text).toContain('配置')
    expect(text).toContain('桌面')
  })

  it('cd / pwd / ls 相对路径', async () => {
    const { sys } = await makeSys()
    const h = makeHarness(sys)
    await h.run('cd 项目')
    expect(h.cwd).toBe(PATHS.projects)
    await h.run('pwd')
    expect(h.lines.at(-1)).toBe(PATHS.projects)
    await h.run('ls')
    expect(h.lines.join(' ')).toContain('这个网站.md')
  })

  it('cat：读取磁盘文件', async () => {
    const { sys } = await makeSys()
    const h = makeHarness(sys)
    await h.run('cat 关于/about.md')
    expect(h.lines[0]).toBe('# 关于我')
  })

  it('mkdir / rm（目录需要 -r）', async () => {
    const { sys } = await makeSys()
    const h = makeHarness(sys)
    await h.run('mkdir 临时目录')
    expect(sys.fs.exists(`${HOME}/临时目录`)).toBe(true)
    await h.run('rm 临时目录')
    expect(h.lines.join(' ')).toContain('rm -r')
    expect(sys.fs.exists(`${HOME}/临时目录`)).toBe(true)
    await h.run('rm -r 临时目录')
    expect(sys.fs.exists(`${HOME}/临时目录`)).toBe(false)
  })

  it('touch / cp / mv', async () => {
    const { sys } = await makeSys()
    const h = makeHarness(sys)
    await h.run('touch 草稿.txt')
    expect(sys.fs.exists(`${HOME}/草稿.txt`)).toBe(true)
    await h.run('cp 关于/about.md 草稿.txt')
    expect(sys.fs.readText(`${HOME}/草稿.txt`)).toContain('关于我')
    await h.run('mv 草稿.txt 正式.txt')
    expect(sys.fs.exists(`${HOME}/草稿.txt`)).toBe(false)
    expect(sys.fs.exists(`${HOME}/正式.txt`)).toBe(true)
  })

  it('系统区写入需要 sudo', async () => {
    const { sys } = await makeSys()
    const h = makeHarness(sys)
    await h.run('mkdir /系统/禁止')
    expect(sys.fs.exists('/系统/禁止')).toBe(false)
    await h.run('sudo')
    expect(h.sudo).toBe(true)
    await h.run('mkdir /系统/允许')
    expect(sys.fs.exists('/系统/允许')).toBe(true)
  })

  it('df / fsck / du / tree 有输出且不抛错', async () => {
    const { sys } = await makeSys()
    const h = makeHarness(sys)
    await h.run('df')
    expect(h.lines.join(' ')).toContain('磁盘')
    h.lines = []
    await h.run('fsck')
    expect(h.lines.join(' ')).toContain('一致性检查通过')
    h.lines = []
    await h.run('du /用户')
    expect(h.lines.length).toBeGreaterThan(0)
    h.lines = []
    await h.run('tree /用户')
    expect(h.lines.join('\n')).toMatch(/[├└]─/)
  })

  it('whoami / uname / exit / open / theme / wallpaper', async () => {
    const { sys } = await makeSys()
    const h = makeHarness(sys)
    await h.run('whoami')
    expect(h.lines.at(-1)).toBe(profile.owner)
    await h.run('uname')
    expect(h.lines.at(-1)).toContain('personal-os')
    await h.run('exit')
    expect(h.exits).toBe(1)

    await h.run('open music')
    expect(h.opened).toContain('music')

    await h.run('theme light')
    expect(h.theme).toBe('glass-light')
    await h.run('wallpaper dusk')
    expect(h.wallpaper).toBe('dusk')
  })

  it('dmesg 读取注入的内核日志', async () => {
    const { sys, kernel } = await makeSys()
    kernel.log.info('test', '来自测试的日志')
    setLogProvider(() => kernel.log.tail(40))
    const h = makeHarness(sys)
    await h.run('dmesg')
    expect(h.lines.join('\n')).toContain('来自测试的日志')
  })
})

describe('Tab 补全', () => {
  it('补全命令名', async () => {
    const { sys } = await makeSys()
    expect(completeLine(sys, HOME, 'mk')).toContain('mkdir')
    expect(completeLine(sys, HOME, '')).toContain('fsck')
  })

  it('补全路径（目录带斜杠）', async () => {
    const { sys } = await makeSys()
    expect(completeLine(sys, HOME, 'cd 关')).toEqual(['关于/'])
    expect(completeLine(sys, HOME, 'cat /系统')).toEqual(['/系统/'])
    expect(completeLine(sys, HOME, 'cat 关于/a')).toEqual(['关于/about.md'])
  })
})
