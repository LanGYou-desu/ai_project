// 装机服务：把发行版内容写进（刚格式化的）虚拟磁盘。
// 同一条 profile + 同一个时间戳 => 逐字节一致的镜像（金样测试依赖这个性质）。
import { DiskFs, joinPath } from '../kernel/disk/fs.ts'
import { DiskError } from '../kernel/disk/errors.ts'
import { profile } from '../data/profile.ts'

export const HOME = `/用户/${profile.owner}`
export const PATHS = {
  home: HOME,
  system: '/系统',
  syslog: '/系统/log/syslog.txt',
  theme: `${HOME}/配置/theme.json`,
  session: `${HOME}/配置/session.json`,
  about: `${HOME}/关于/about.md`,
  projects: `${HOME}/项目`,
  contact: `${HOME}/联系/contact.json`,
  music: `${HOME}/音乐`,
  playlist: `${HOME}/音乐/playlist.json`,
  desktop: `${HOME}/桌面`,
}

function mkdirp(fs: DiskFs, path: string, now: number): void {
  const segs = path.split('/').filter(Boolean)
  let cur = ''
  for (const s of segs) {
    cur += '/' + s
    try {
      fs.mkdir(cur, '/', { created: Math.floor(now / 1000), modified: Math.floor(now / 1000) })
    } catch (e) {
      if (!(e instanceof DiskError && (e.code === 'EEXIST' || e.code === 'EISDIR'))) throw e
    }
  }
}

export interface InstallReport {
  files: number
  dirs: number
}

/** 写入发行内容（不负责格式化，调用方先 DiskFs.format） */
export function installSeed(fs: DiskFs, now = Date.now()): InstallReport {
  const sec = Math.floor(now / 1000)
  const meta = { created: sec, modified: sec }
  const write = (path: string, data: string) => fs.writeFile(path, data, '/', meta)

  for (const dir of [
    '/系统',
    '/系统/log',
    '/系统/config',
    '/用户',
    PATHS.home,
    `${PATHS.home}/配置`,
    `${PATHS.home}/关于`,
    PATHS.projects,
    `${PATHS.home}/联系`,
    PATHS.music,
    PATHS.desktop,
  ]) {
    mkdirp(fs, dir, now)
  }

  write(
    '/系统/config/system.json',
    JSON.stringify({ hostname: profile.hostname, version: profile.version, owner: profile.owner }, null, 2) + '\n',
  )
  write(PATHS.syslog, `[装机] personal-os ${profile.version} 安装于 ${new Date(now).toISOString()}\n`)
  write(PATHS.about, profile.about + '\n')
  write(
    PATHS.contact,
    JSON.stringify(profile.contact, null, 2) + '\n',
  )
  write(
    PATHS.playlist,
    JSON.stringify(profile.playlist, null, 2) + '\n',
  )
  write(
    PATHS.theme,
    JSON.stringify({ theme: 'glass-dark', wallpaper: 'aurora' }, null, 2) + '\n',
  )

  for (const p of profile.projects) {
    const lines = [`# ${p.title}`, '', `> ${p.summary}`, '', `标签: ${p.tags.join(', ')}`]
    if (p.link) lines.push(`链接: ${p.link}`)
    lines.push('', p.body, '')
    write(joinPath([PATHS.projects, p.file]), lines.join('\n'))
  }

  for (const d of profile.desktop) {
    write(joinPath([PATHS.desktop, `${d.title}.app`]), JSON.stringify({ app: d.app, title: d.title }, null, 2) + '\n')
  }

  const usage = fs.usage()
  return { files: usage.files, dirs: usage.dirs }
}
