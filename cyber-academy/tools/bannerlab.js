#!/usr/bin/env node
'use strict';
/* =========================================================
 * 赛博安全学院 — 真实 Banner 抓取器 (真实 TCP 连接)
 * 用法: node tools/bannerlab.js <host> <port> [--send <数据>]
 * 示例:
 *   node tools/bannerlab.js 127.0.0.1 1337
 *   node tools/bannerlab.js 127.0.0.1 1337 --send "toor\n"
 * ========================================================= */
const net = require('net');

function grab(host, port, send) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let data = '';
    let done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(to);
      sock.destroy();
      if (err && !data.trim()) resolve({ ok: false, error: err.message });
      else resolve({ ok: true, banner: data.trim() });
    };
    const to = setTimeout(() => finish(new Error('超时: 目标未返回 banner')), 3000);
    sock.setTimeout(3000);
    sock.once('connect', () => { if (send) sock.write(send); });
    sock.on('data', (d) => {
      data += d.toString('utf8');
      if (data.includes('\n')) finish(); // 拿到 banner 行即可返回
    });
    sock.once('end', () => finish());
    sock.once('error', (e) => finish(e));
    sock.once('timeout', () => finish(new Error('超时')));
    sock.connect(port, host);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const host = args[0];
  const port = parseInt(args[1], 10);
  const sendIdx = args.indexOf('--send');
  const send = sendIdx !== -1 ? args[sendIdx + 1] : null;
  if (!host || !port) {
    console.log('用法: node tools/bannerlab.js <host> <port> [--send <数据>]');
    console.log('示例: node tools/bannerlab.js 127.0.0.1 1337');
    console.log('      node tools/bannerlab.js 127.0.0.1 1337 --send "toor\\n"');
    process.exit(1);
  }
  console.log(`正在连接 ${host}:${port} 抓取 banner...`);
  const r = await grab(host, port, send);
  if (!r.ok) { console.log('✘ ' + r.error); process.exit(1); }
  console.log('banner: "' + r.banner + '"');
}

main();
