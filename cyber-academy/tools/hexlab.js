#!/usr/bin/env node
'use strict';
/* =========================================================
 * 赛博安全学院 — 真实 Hexdump 查看器
 * 用法: node tools/hexlab.js <文件> [起始偏移(16进制)]
 * 示例: node tools/hexlab.js practice/crackme.bin
 *      node tools/hexlab.js practice/usb.dd 0x100
 * ========================================================= */
const fs = require('fs');

function main() {
  const args = process.argv.slice(2);
  const file = args[0];
  if (!file) {
    console.log('用法: node tools/hexlab.js <文件> [起始偏移(16进制)]');
    process.exit(1);
  }
  const start = args[1] ? parseInt(args[1], 16) || 0 : 0;
  const buf = fs.readFileSync(file);
  if (start >= buf.length) { console.log('偏移超出文件长度。'); process.exit(1); }
  const maxLines = 40;
  let lines = 0;
  for (let off = start; off < buf.length && lines < maxLines; off += 16) {
    const chunk = buf.slice(off, off + 16);
    const hx = Array.from(chunk).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ').padEnd(47, ' ');
    const asc = Array.from(chunk).map((c) => (c >= 32 && c < 127 ? String.fromCharCode(c) : '.')).join('');
    console.log(`${off.toString(16).padStart(8, '0')}  ${hx}  |${asc}|`);
    lines++;
  }
  if (buf.length - start > maxLines * 16) {
    console.log(`  ... (文件共 ${buf.length} 字节, 仅显示前 ${lines * 16} 字节)`);
  }
}

main();
