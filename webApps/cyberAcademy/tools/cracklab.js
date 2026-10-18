#!/usr/bin/env node
'use strict';
/* =========================================================
 * 赛博安全学院 — 真实字典爆破器 (MD5 / SHA-256)
 * 用法:
 *   node tools/cracklab.js <哈希>
 *   node tools/cracklab.js <哈希> --dict 字典文件.txt
 * 内置字典: tools/rockyou-mini.txt (真实弱密码表, 可自行扩充)
 * ========================================================= */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_DICT = path.join(__dirname, 'rockyou-mini.txt');

function crack(hash, dictPath) {
  const isSha = /^[0-9a-f]{64}$/.test(hash);
  const isMd5 = /^[0-9a-f]{32}$/.test(hash);
  if (!isMd5 && !isSha) {
    console.log('✘ 哈希格式无法识别 (需要 32 位 MD5 或 64 位 SHA-256)');
    process.exit(1);
  }
  const algo = isMd5 ? 'md5' : 'sha256';
  const words = fs.readFileSync(dictPath, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  console.log(`正在用 ${algo.toUpperCase()} 字典爆破 (${words.length} 条)...`);
  const start = Date.now();
  for (const w of words) {
    if (crypto.createHash(algo).update(w).digest('hex') === hash) {
      console.log(`✔ 破解成功 (${Date.now() - start}ms): "${hash}" → ${w}`);
      return true;
    }
  }
  console.log('✘ 字典中未命中。试试更大字典 (rockyou.txt) 或更强规则。');
  return false;
}

function main() {
  const args = process.argv.slice(2);
  const hash = (args[0] || '').toLowerCase();
  const dictIdx = args.indexOf('--dict');
  const dict = dictIdx !== -1 ? args[dictIdx + 1] : DEFAULT_DICT;
  if (!hash) {
    console.log('用法: node tools/cracklab.js <哈希> [--dict 字典.txt]');
    console.log('示例: node tools/cracklab.js 5f4dcc3b5aa765d61d8327deb882cf99');
    console.log('      node tools/cracklab.js <sha256哈希> --dict mydict.txt');
    process.exit(1);
  }
  if (!fs.existsSync(dict)) {
    console.log('✘ 字典不存在: ' + dict + ' (先用 node make-practice.js 生成?)');
    process.exit(1);
  }
  if (!crack(hash, dict)) process.exit(1);
}

main();
