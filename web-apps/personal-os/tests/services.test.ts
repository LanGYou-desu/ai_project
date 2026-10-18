// 纯逻辑服务：路由、会话、Markdown、项目解析、音序器、格式化
import { describe, it, expect } from 'vitest'
import { parseHash, buildHash } from '../src/kernel/router.ts'
import { loadSession, defaultSession, SESSION_PATH } from '../src/services/session.ts'
import { renderMarkdown } from '../src/kernel/markdown.ts'
import { parseProject } from '../src/kernel/projects.ts'
import { noteToFreq, compileTrack } from '../src/kernel/sequencer.ts'
import { BUILTIN_TRACKS } from '../src/data/tracks.ts'
import { fmtSize, fmtTime } from '../src/kernel/terminal/commands.ts'
import { mulberry32, seededColors } from '../src/kernel/rng.ts'

describe('哈希路由', () => {
  it('解析桌面与深链', () => {
    expect(parseHash('')).toEqual({ kind: 'desktop' })
    expect(parseHash('#/')).toEqual({ kind: 'desktop' })
    expect(parseHash('#/desktop')).toEqual({ kind: 'desktop' })
    expect(parseHash('#/app/projects')).toEqual({ kind: 'app', appId: 'projects', arg: undefined })
    expect(parseHash('#/app/notepad/笔记.txt')).toEqual({
      kind: 'app',
      appId: 'notepad',
      arg: '笔记.txt',
    })
  })

  it('非法输入回退桌面', () => {
    expect(parseHash('#/app/')).toEqual({ kind: 'desktop' })
    expect(parseHash('#/app/BAD CASE')).toEqual({ kind: 'desktop' })
    expect(parseHash('#/未知')).toEqual({ kind: 'desktop' })
  })

  it('buildHash 与 parseHash 往返一致', () => {
    for (const route of [
      { kind: 'desktop' as const },
      { kind: 'app' as const, appId: 'music' },
      { kind: 'app' as const, appId: 'notepad', arg: 'a b.txt' },
    ]) {
      expect(parseHash(buildHash(route))).toEqual(route)
    }
  })
})

describe('会话服务', () => {
  const io = (store: Record<string, string>) => ({
    readText: (p: string): string => {
      if (!(p in store)) throw new Error(`ENOENT: ${p}`)
      return store[p]
    },
    write: (p: string, d: string): void => {
      store[p] = d
    },
  })

  it('没有会话文件 → 默认值', () => {
    expect(loadSession(io({}))).toEqual(defaultSession)
  })

  it('损坏的 JSON → 默认值', () => {
    expect(loadSession(io({ [SESSION_PATH]: '{{{不是 JSON' }))).toEqual(defaultSession)
  })

  it('部分字段 → 合并默认值，windows 净化', () => {
    const s = loadSession(
      io({
        [SESSION_PATH]: JSON.stringify({ theme: 'glass-light', windows: '坏数据' }),
      }),
    )
    expect(s.theme).toBe('glass-light')
    expect(s.wallpaper).toBe('aurora')
    expect(s.windows).toEqual([])
  })

  it('正常会话数据完整保留', () => {
    const data = {
      theme: 'glass-dark',
      wallpaper: 'dusk',
      autoLogin: true,
      onboarded: true,
      windows: [
        { appId: 'about', x: 10, y: 20, w: 600, h: 500, minimized: false, maximized: false },
      ],
      focusApp: 'about',
    }
    const s = loadSession(io({ [SESSION_PATH]: JSON.stringify(data) }))
    expect(s.autoLogin).toBe(true)
    expect(s.windows).toHaveLength(1)
    expect(s.focusApp).toBe('about')
  })
})

describe('Markdown 渲染', () => {
  it('标题 / 粗斜体 / 代码 / 列表 / 链接', () => {
    const html = renderMarkdown(
      '# 标题\n\n**粗体** 与 *斜体* 和 `行内代码`\n\n- 列表项\n\n[官网](https://example.com)',
    )
    expect(html).toContain('<h1>标题</h1>')
    expect(html).toContain('<strong>粗体</strong>')
    expect(html).toContain('<em>斜体</em>')
    expect(html).toContain('<code>行内代码</code>')
    expect(html).toContain('<li>列表项</li>')
    expect(html).toContain('href="https://example.com"')
  })

  it('先转义再解析：HTML 注入无效', () => {
    const html = renderMarkdown('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('链接白名单：javascript: 被拒绝', () => {
    const html = renderMarkdown('[点我](javascript:alert(1))')
    expect(html).not.toContain('href')
    expect(html).toContain('点我')
  })

  it('代码块内容被转义', () => {
    const html = renderMarkdown('```\nconst a = 1 < 2\n```')
    expect(html).toContain('&lt;')
    expect(html).toMatch(/<pre/)
  })

  it('引用与分割线', () => {
    const html = renderMarkdown('> 引用一句\n\n---')
    expect(html).toContain('<blockquote')
    expect(html).toContain('<hr')
  })
})

describe('项目文件解析', () => {
  it('约定格式：标题 / 简介 / 标签 / 链接 / 正文', () => {
    const src = [
      '# 我的项目',
      '',
      '> 一句话简介。',
      '',
      '标签: Svelte, TS、磁盘',
      '链接: https://example.com/x',
      '',
      '正文第一段。',
    ].join('\n')
    const p = parseProject('文件.md', src)
    expect(p.title).toBe('我的项目')
    expect(p.summary).toBe('一句话简介。')
    expect(p.tags).toEqual(['Svelte', 'TS', '磁盘'])
    expect(p.link).toBe('https://example.com/x')
    expect(p.body).toContain('正文第一段')
  })

  it('缺省标题回退文件名', () => {
    const p = parseProject('无标题.md', '正文……')
    expect(p.title).toBe('无标题')
  })
})

describe('音序器', () => {
  it('音名换算频率', () => {
    expect(noteToFreq('A4')).toBeCloseTo(440, 5)
    expect(noteToFreq('A#4')).toBeCloseTo(466.16, 1)
    expect(noteToFreq('Bb4')).toBeCloseTo(466.16, 1)
    expect(noteToFreq('C3')).toBeCloseTo(130.81, 1)
    expect(noteToFreq('x')).toBeNull()
    expect(noteToFreq('H4')).toBeNull()
  })

  it('编译乐谱：延长音与停顿', () => {
    const { events } = compileTrack({
      id: 't',
      name: '测试',
      bpm: 120,
      channels: [{ wave: 'square', notes: 'C4 - - . C4' }],
    })
    // step = 60/120/2 = 0.25s；第一个音延长 3 拍，停一拍后再来一个音
    expect(events).toHaveLength(2)
    expect(events[0].time).toBeCloseTo(0)
    expect(events[0].dur).toBeCloseTo(0.75)
    expect(events[1].time).toBeCloseTo(1.0)
    expect(events[1].freq).toBeCloseTo(261.63, 1)
  })

  it('噪声通道产生鼓点事件', () => {
    const { events } = compileTrack({
      id: 'd',
      name: '鼓',
      bpm: 120,
      channels: [{ wave: 'noise', notes: 'x . x . x' }],
    })
    expect(events).toHaveLength(3)
    expect(events.every((e) => e.freq === null)).toBe(true)
  })

  it('内置曲目编译确定且时长合理', () => {
    const a = compileTrack(BUILTIN_TRACKS[0])
    const b = compileTrack(BUILTIN_TRACKS[0])
    expect(a.events.length).toBeGreaterThan(10)
    expect(a.duration).toBeGreaterThan(1)
    expect(a).toEqual(b)
  })
})

describe('格式化与随机', () => {
  it('fmtSize / fmtTime', () => {
    expect(fmtSize(0)).toBe('0 B')
    expect(fmtSize(512)).toBe('512 B')
    expect(fmtSize(1536)).toBe('1.5 KiB')
    expect(fmtTime(0)).toBe('-')
    expect(fmtTime(1700000000)).toMatch(/^2023-11-1[45] /)
  })

  it('同种子随机数一致，颜色稳定', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect(a()).toBe(b())
    expect(seededColors('about')).toEqual(seededColors('about'))
    expect(seededColors('about')[0]).toMatch(/^hsl\(/)
  })
})
