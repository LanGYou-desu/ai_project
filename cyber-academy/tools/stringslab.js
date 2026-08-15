#!/usr/bin/env node
'use strict';
/* =========================================================
 * 赛博安全学院 — 真实 Strings 提取器
 * 用法: node tools/stringslab.js <文件> [最小长度]
 * 示例: node tools/stringslab.js practice/usb.dd
 * ========================================================= */
const fs = require('fs');

function main() {
  const args = process.argv.slice(2);
  const file = args[0];
  if (!file) {
    console.log('用法: node tools/stringslab.js <文件> [最小长度]');
    process.exit(1);
  }
  const minLen = args[1] ? parseInt(args[1], 10) : 4;
  const buf = fs.readFileSync(file);
  const runs = [];
  let cur = '';
  const flush = () => { if (cur.length >= minLen) runs.push(cur); cur = ''; };
  for (const c of buf) {
    if ((c >= 32 && c <= 126) || c === 9) cur += String.fromCharCode(c);
    else flush();
  }
  flush();
  console.log(`共提取 ${runs.length} 个字符串 (${file}, ${buf.length} 字节, 最小长度 ${minLen}):`);
  runs.forEach((r) => console.log('  ' + r));
}

main();
