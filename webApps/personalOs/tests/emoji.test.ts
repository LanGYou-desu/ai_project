// 视觉规范：全部图标必须是用 SVG 画出来的 —— 源码里不允许出现 emoji
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const EMOJI_RANGES =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/u

const SCAN_DIRS = ['src', 'server', 'scripts', 'tools', 'tests', 'public']
const SCAN_ROOT_FILES = ['index.html', 'start.bat', 'server.js', 'README.md', 'DISK.md']
const EXTS = new Set(['.ts', '.svelte', '.css', '.mjs', '.js', '.html', '.bat', '.md', '.webmanifest'])

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (EXTS.has(path.extname(name).toLowerCase())) out.push(p)
  }
  return out
}

describe('源码无 emoji（图标全部自绘 SVG）', () => {
  it('扫描所有源文件，不出现 emoji 码点', () => {
    const files = [
      ...SCAN_DIRS.flatMap((d) => walk(path.join(root, d))),
      ...SCAN_ROOT_FILES.map((f) => path.join(root, f)).filter((p) => fs.existsSync(p)),
    ]
    expect(files.length).toBeGreaterThan(30)

    const violations: string[] = []
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      const lines = text.split(/\r?\n/)
      lines.forEach((line, idx) => {
        if (EMOJI_RANGES.test(line)) {
          violations.push(`${path.relative(root, file)}:${idx + 1} ${line.trim().slice(0, 80)}`)
        }
      })
    }
    expect(violations).toEqual([])
  })
})
