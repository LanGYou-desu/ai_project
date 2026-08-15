#!/usr/bin/env node
'use strict';
/* =========================================================
 * 赛博安全学院 — 真实 TCP 端口扫描器
 * 真实 socket 连接, 不依赖任何第三方库
 * 用法:
 *   node tools/scanlab.js <host>                  # 扫描常用端口
 *   node tools/scanlab.js <host> --ports 1-1000   # 指定范围
 *   node tools/scanlab.js <host> --ports 22,80,443
 * ========================================================= */
const net = require('net');

const COMMON = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995, 1080, 1433, 1521, 2049, 2222, 2375, 3000, 3306, 3389, 5432, 5900, 6379, 8000, 8080, 8443, 8888, 9000, 9090, 9200, 1337];
const SERVICES = {
  21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'dns', 80: 'http', 110: 'pop3',
  135: 'msrpc', 139: 'netbios', 143: 'imap', 443: 'https', 445: 'smb', 993: 'imaps',
  995: 'pop3s', 1080: 'socks', 1433: 'mssql', 1521: 'oracle', 2049: 'nfs', 2222: 'ssh',
  2375: 'docker', 3000: 'web', 3306: 'mysql', 3389: 'rdp', 5432: 'postgresql', 5900: 'vnc',
  6379: 'redis', 8000: 'web', 8080: 'http-proxy', 8443: 'https-alt', 8888: 'web',
  9000: 'web', 9090: 'web', 9200: 'elasticsearch', 1337: 'backdoor?',
};

function parsePorts(arg) {
  if (!arg) return COMMON.slice();
  if (arg.includes('-')) {
    const [a, b] = arg.split('-').map((x) => parseInt(x, 10));
    const out = [];
    for (let i = Math.max(1, a); i <= Math.min(65535, b); i++) out.push(i);
    return out;
  }
  return arg.split(',').map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= 65535);
}

function checkPort(host, port, timeout = 700) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (ok) => { clearTimeout(to); sock.destroy(); resolve(ok); };
    const to = setTimeout(() => done(false), timeout);
    sock.setTimeout(timeout);
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
    sock.once('timeout', () => done(false));
    sock.connect(port, host);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const host = args[0];
  if (!host) {
    console.log('用法: node tools/scanlab.js <host> [--ports <范围|列表>]');
    console.log('示例: node tools/scanlab.js 127.0.0.1');
    console.log('      node tools/scanlab.js 127.0.0.1 --ports 1-1000');
    console.log('      node tools/scanlab.js 10.0.0.5 --ports 22,80,443,1337');
    process.exit(1);
  }
  const portsIdx = args.indexOf('--ports');
  const ports = parsePorts(portsIdx !== -1 ? args[portsIdx + 1] : null);

  console.log(`正在对 ${host} 进行 TCP 连接扫描 (${ports.length} 个端口)...`);
  const start = Date.now();
  const open = [];
  const CONC = 100;
  for (let i = 0; i < ports.length; i += CONC) {
    const chunk = ports.slice(i, i + CONC);
    const results = await Promise.all(chunk.map((p) => checkPort(host, p)));
    results.forEach((ok, j) => { if (ok) open.push(chunk[j]); });
  }
  const ms = Date.now() - start;
  console.log(`\n扫描完成: ${open.length}/${ports.length} 个端口开放 (耗时 ${ms}ms)`);
  open.sort((a, b) => a - b).forEach((p) => {
    console.log(`  ${String(p).padStart(6)}/tcp   open   ${SERVICES[p] || 'unknown'}`);
  });
  if (!open.length) console.log('  (没有发现开放端口)');
}

main();
