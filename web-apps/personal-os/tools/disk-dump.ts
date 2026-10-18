// 离线检查 disk.img：超级块 / 目录树 / 块图 / fsck
// 用法：npm run disk:dump   （或 npm run disk:dump -- 其他路径.img）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BlockDevice } from '../src/kernel/disk/blockdev.ts'
import { readSuperblockLoose, isDirty } from '../src/kernel/disk/superblock.ts'
import { DiskFs, joinPath, splitPath, type Entry } from '../src/kernel/disk/fs.ts'
import { fsckAnalyze } from '../src/kernel/disk/fsck.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const arg = process.argv[2]
const imgPath = arg ? path.resolve(arg) : path.join(root, 'disk', 'disk.img')

if (!fs.existsSync(imgPath)) {
  console.error(`找不到镜像：${imgPath}`)
  console.error('提示：先 npm run dev 装一次盘，或 npm run disk:sync 生成种子镜像。')
  process.exit(1)
}

const bytes = fs.readFileSync(imgPath)
console.log(`镜像：${imgPath}（${bytes.length} 字节）`)

let dev: BlockDevice
try {
  dev = new BlockDevice(new Uint8Array(bytes))
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
}

const { sb, magicOk, checksumOk } = readSuperblockLoose(dev)
const fmtTime = (sec: number): string =>
  sec > 0 ? new Date(sec * 1000).toISOString().replace('T', ' ').slice(0, 19) : '-'

console.log('\n== 超级块 ==')
console.log(`卷标      ${sb.label}`)
console.log(`版本      v${sb.version} · 块 ${sb.blockSize} B × ${sb.blockCount}`)
console.log(`magic     ${magicOk ? 'ok' : '损坏'} · 校验和 ${checksumOk ? 'ok' : '损坏'} · 脏位 ${isDirty(sb) ? '脏（上次未正常关机）' : '干净'}`)
console.log(`根目录    块 ${sb.rootDirBlock}（${sb.rootDirSize} 字节） · 空闲 ${sb.freeBlocks} 块`)
console.log(`装机      ${fmtTime(Math.floor(sb.installTime / 1000))} · 最后挂载 ${fmtTime(Math.floor(sb.lastMount / 1000))}`)

let fsys: DiskFs | null = null
try {
  fsys = DiskFs.mount(dev)
} catch (e) {
  console.log(`\n挂载失败：${e instanceof Error ? e.message : String(e)}（可运行 fsck 修复）`)
}

if (fsys) {
  const usage = fsys.usage()
  console.log('\n== 目录树 ==')
  const walk = (dirPath: string, prefix: string, depth: number): void => {
    if (depth > 4) return
    let entries: Entry[]
    try {
      entries = fsys!.readdir(dirPath)
    } catch {
      return
    }
    entries.forEach((e, i) => {
      const last = i === entries.length - 1
      console.log(`${prefix}${last ? '└─ ' : '├─ '}${e.name}${e.type === 'dir' ? '/' : `  ${e.size} B`}`)
      if (e.type === 'dir') walk(joinPath([...splitPath(dirPath), e.name]), prefix + (last ? '   ' : '│  '), depth + 1)
    })
  }
  walk('/', '', 1)
  console.log(`\n共 ${usage.files} 文件 / ${usage.dirs} 目录 · 已用 ${usage.used}/${usage.total} 块`)

  console.log('\n== 块图（每字符 1 块，512 块 = 8 行 × 64 列）==')
  const map = fsys.blockMap()
  const chars = ['░', '■', '▓', '·', 'D', 'F'] // free/super/fat/reserved/dir/file
  for (let row = 0; row < 8; row++) {
    let line = ''
    for (let col = 0; col < 64; col++) {
      const v = map[row * 64 + col]
      line += v === undefined ? ' ' : chars[v]
    }
    console.log(`  ${line}`)
  }
  console.log('  ■超级 ■引导 ·保留 ▓FAT D目录 F文件 ░空闲')
}

const report = fsckAnalyze(dev)
console.log('\n== fsck ==')
if (report.ok) {
  console.log(`一致性检查通过（${report.stats.files} 文件 / ${report.stats.dirs} 目录，无问题）`)
} else if (report.fatal) {
  console.log(`致命问题：${report.fatal}`)
} else {
  console.log(`发现 ${report.issues.filter((i) => i.severity === 'error').length} 处问题：`)
}
for (const i of report.issues.slice(0, 24)) {
  console.log(`  [${i.severity}] ${i.kind}: ${i.detail}`)
}
