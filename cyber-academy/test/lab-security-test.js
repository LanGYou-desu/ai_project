'use strict';
/* =========================================================
 * 靶场安全边界测试 (漏洞保留, 但不允许外溢)
 * 覆盖: 畸形请求不杀进程 / 路径穿越沙箱边界 / 跨站 Origin 拦截 /
 *       请求体上限 / TCP 缓冲上限 / 命令注入超时与并发上限 / 孤儿进程清理
 * 用法: node test/lab-security-test.js
 * ========================================================= */
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { execFileSync } = require('child_process');
const { createLab } = require('../lab/lab.js');

const WIN = process.platform === 'win32';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pingCount = () => {
  if (!WIN) return 0;
  try {
    return execFileSync('tasklist', ['/FI', 'IMAGENAME eq PING.EXE', '/FO', 'CSV'], { encoding: 'utf8' })
      .split('\n').filter((l) => l.includes('PING.EXE')).length;
  } catch (e) { return 0; }
};

(async function () {
  const downloadDir = path.join(os.tmpdir(), 'cyber-lab-sec-' + Date.now());
  const lab = createLab({ httpPort: 0, tcpPort: 0, sshPort: 0, downloadDir });
  await lab.ready;
  const base = 'http://127.0.0.1:' + lab.httpPort;
  const R = [];
  const check = (n, c) => R.push([n, !!c]);

  // 原始请求 (fetch 会规范化 URL, 测不了畸形请求目标)
  const raw = (target, headers) => new Promise((res) => {
    const sock = net.connect(lab.httpPort, '127.0.0.1', () => {
      sock.write('GET ' + target + ' HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n' +
        (headers || '') + '\r\n');
    });
    let data = '';
    sock.on('data', (d) => { data += d; });
    sock.on('end', () => res(data));
    sock.on('error', () => res('ERR'));
    setTimeout(() => { try { sock.destroy(); } catch (e) { /* 忽略 */ } }, 3000);
  });
  const status = async () => {
    try { return (await fetch(base + '/lab/status', { cache: 'no-store' })).status; } catch (e) { return 0; }
  };

  try {
    /* ---- 1. 畸形请求目标不能让靶场(以及同进程的游戏)挂掉 ---- */
    const bad = await raw('//');
    check('畸形请求目标 // → 400 而不是崩进程', /^HTTP\/1\.1 400/.test(bad));
    check('畸形请求后靶场仍存活', (await status()) === 200);

    /* ---- 2. 路径穿越: 漏洞保留在项目目录内 ---- */
    const inside = await fetch(base + '/api/read?file=' + encodeURIComponent('../../server.js')).then((r) => r.json());
    check('穿越漏洞仍可用 (读 ../../server.js)', inside.ok === true && /赛博安全学院/.test(String(inside.content)));
    const outside = await fetch(base + '/api/read?file=' + encodeURIComponent('../../../README.md'));
    const outsideJson = await outside.json();
    check('越出项目目录 → 403 拦截', outside.status === 403 && outsideJson.ok === false);
    check('越界提示说明沙箱边界', /sandbox boundary/.test(String(outsideJson.error)));
    const abs = await fetch(base + '/api/read?file=' + encodeURIComponent('C:/Windows/win.ini')).then((r) => r.json());
    check('绝对路径不能直接读系统文件', abs.ok === false);

    /* ---- 3. 跨站 Origin 拦截 (任意网页不得借 127.0.0.1 打本机) ---- */
    const evil = await fetch(base + '/api/ping?host=' + encodeURIComponent('127.0.0.1'), { headers: { Origin: 'http://evil.example' } });
    check('恶意 Origin 调 /api/ping → 403', evil.status === 403);
    check('恶意 Origin 不授予 CORS 许可', evil.headers.get('access-control-allow-origin') === null);
    const evilRead = await fetch(base + '/api/read?file=secret.txt', { headers: { Origin: 'http://evil.example' } });
    check('恶意 Origin 调 /api/read → 403', evilRead.status === 403);
    const local = await fetch(base + '/api/ping?host=127.0.0.1', { headers: { Origin: 'http://localhost:8080' } });
    const localJson = await local.json();
    check('本机 Origin 调 /api/ping → 200', local.status === 200 && typeof localJson.command === 'string');
    check('本机 Origin 回显自身 CORS', local.headers.get('access-control-allow-origin') === 'http://localhost:8080');
    const noOrigin = await fetch(base + '/lab/status');
    check('无 Origin (curl/工具) 仍放行', noOrigin.status === 200 && noOrigin.headers.get('access-control-allow-origin') === '*');
    const evilData = await fetch(base + '/api/users', { headers: { Origin: 'http://evil.example' } });
    check('只读数据端点不受影响 (仅拦截危险端点)', evilData.status === 200);

    /* ---- 4. 超大请求体 → 413, 不是直接断链 ---- */
    const big = await fetch(base + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'x'.repeat(200000), password: 'x' }),
    }).then((r) => ({ status: r.status, json: r.json() })).catch(() => ({ status: 0 }));
    check('超大请求体 → 413', big.status === 413);

    /* ---- 5. 命令注入: 真实执行, 但有超时/并发上限, 不留孤儿进程 ---- */
    const sep = WIN ? ' & ' : '; ';
    const tag = 'LAB_SEC_' + Date.now();
    const inj = await fetch(base + '/api/ping?host=' + encodeURIComponent('127.0.0.1' + sep + 'echo ' + tag)).then((r) => r.json());
    check('命令注入仍真实执行', String(inj.output || '').includes(tag));

    const pingBefore = pingCount();
    const slow = await fetch(base + '/api/ping?host=' + encodeURIComponent('127.0.0.1' + sep + 'ping -n 20 127.0.0.1')).then((r) => r.json());
    check('长命令被 3 秒超时截断', slow.timedOut === true);
    await sleep(800); // 等 taskkill 生效
    check('超时后不残留孤儿进程', pingCount() <= pingBefore);

    // 并发上限: 一次性打 10 个请求, 全部要有结果 (排队而不是无限 fork)
    const many = await Promise.all(Array.from({ length: 10 }, (_, i) =>
      fetch(base + '/api/ping?host=' + encodeURIComponent('127.0.0.1' + sep + 'echo Q' + i)).then((r) => r.json())));
    check('并发请求全部返回 (有队列闸门)', many.length === 10 && many.every((m) => typeof m.command === 'string'));
    check('并发后靶场仍存活', (await status()) === 200);

    /* ---- 6. TCP 服务: 超长行不会把内存刷爆 ---- */
    const flood = await new Promise((resolve) => {
      const s = net.connect(lab.tcpPort, '127.0.0.1');
      let closed = false;
      s.on('connect', () => { s.write('A'.repeat(200 * 1024)); }); // 200KB 无换行
      s.on('close', () => { closed = true; resolve(true); });
      s.on('error', () => resolve(true));
      setTimeout(() => { if (!closed) { s.destroy(); resolve(false); } }, 3000);
    });
    check('后门服务丢弃超长输入连接', flood === true);
    check('TCP 洪水后靶场仍存活', (await status()) === 200);

    /* ---- 7. 状态端点暴露沙箱与限额 (供游戏端提示) ---- */
    const st = await fetch(base + '/lab/status').then((r) => r.json());
    check('status 暴露沙箱边界', typeof st.sandbox === 'string' && path.resolve(st.sandbox) === path.resolve(path.join(__dirname, '..')));
    check('status 暴露执行限额', st.limits && st.limits.execTimeoutMs === 3000 && st.limits.maxConcurrentExec > 0);

    /* ---- 8. 靶场关闭后端口释放 ---- */
    lab.close();
    await sleep(300);
    const afterClose = await status();
    check('close() 后 HTTP 端口已释放', afterClose === 0);
  } catch (e) {
    R.push(['测试执行异常: ' + e.message, false]);
    console.error(e);
  } finally {
    lab.close();
  }

  let pass = 0;
  R.forEach(([n, c]) => { console.log((c ? '  PASS  ' : '  FAIL  ') + n); if (c) pass++; });
  console.log('\n' + pass + '/' + R.length + ' 项通过 (靶场安全边界)');
  if (pass !== R.length) process.exit(1);
})();
