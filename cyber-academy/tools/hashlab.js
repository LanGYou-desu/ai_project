#!/usr/bin/env node
'use strict';
/* =========================================================
 * 赛博安全学院 — 真实哈希计算器
 * 用法:
 *   node tools/hashlab.js md5 password
 *   node tools/hashlab.js sha256 abc
 *   node tools/hashlab.js md5 --file 文件路径
 * 支持: md5 / sha1 / sha256 / sha512
 * ========================================================= */
const crypto = require('crypto');
const fs = require('fs');

function main() {
  const args = process.argv.slice(2);
  const algo = (args[0] || '').toLowerCase();
  const ALGOS = { md5: 'md5', sha1: 'sha1', sha256: 'sha256', sha512: 'sha512' };
  if (!ALGOS[algo] || !args[1]) {
    console.log('用法: node tools/hashlab.js <md5|sha1|sha256|sha512> <文本|--file 路径>');
    console.log('示例: node tools/hashlab.js md5 password');
    console.log('      node tools/hashlab.js sha256 --file note.txt');
    process.exit(1);
  }
  let input;
  if (args[1] === '--file') {
    input = fs.readFileSync(args[2]);
    console.log(`输入: 文件 ${args[2]} (${input.length} 字节)`);
  } else {
    input = Buffer.from(args.slice(1).join(' '), 'utf8');
    console.log(`输入: "${args.slice(1).join(' ')}"`);
  }
  console.log(`${algo.toUpperCase()}(${input.length} 字节) = ${crypto.createHash(ALGOS[algo]).update(input).digest('hex')}`);
}

main();
