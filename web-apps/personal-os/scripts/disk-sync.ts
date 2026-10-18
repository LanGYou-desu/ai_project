// 构建前置（npm run build 前自动执行）：
//  1. 确保 disk/disk.img 存在 —— 不存在才生成种子镜像，绝不覆盖已有数据（--force 可强制重建）
//  2. 把镜像复制到 public/disk.img —— 静态托管时前端会以「只读基础盘 + 本地叠层」降级运行
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BlockDevice, IMAGE_SIZE } from '../src/kernel/disk/blockdev.ts'
import { DiskFs } from '../src/kernel/disk/fs.ts'
import { installSeed } from '../src/services/installer.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const diskDir = path.join(root, 'disk')
const imgPath = path.join(diskDir, 'disk.img')
const publicPath = path.join(root, 'public', 'disk.img')

fs.mkdirSync(diskDir, { recursive: true })

const force = process.argv.includes('--force')

if (!fs.existsSync(imgPath) || force) {
  const dev = new BlockDevice()
  const fsys = DiskFs.format(dev, { label: 'PERSONAL-OS', time: Date.now() })
  const report = installSeed(fsys, Date.now())
  fs.writeFileSync(imgPath, dev.snapshot())
  console.log(
    `已生成种子磁盘镜像：disk/disk.img（${report.files} 文件 / ${report.dirs} 目录，${IMAGE_SIZE} 字节）`,
  )
} else {
  console.log('disk/disk.img 已存在，保持不动（要重建请加 --force）。')
}

fs.copyFileSync(imgPath, publicPath)
console.log('已复制基础镜像到 public/disk.img（静态托管只读兜底）')
