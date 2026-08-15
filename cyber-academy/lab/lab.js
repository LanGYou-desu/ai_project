'use strict';
/* =========================================================
 * 赛博安全学院 — 本地真实靶场 (LAB)
 *
 * 仅绑定 127.0.0.1，仅供本地学习。
 * 内容:
 *   [HTTP 8090] 真实 Web 应用 —— 真实 SQL 注入 / XSS 反射
 *   [TCP 1337]  真实后门服务  —— banner + 口令 root/toor
 *   [TCP 2222]  模拟 SSH 服务  —— 协议级握手 (LOGIN admin password)
 *   [磁盘文件]  lab/downloads/ —— 真实 crackme.bin / usb.dd
 *
 * 运行: node lab/lab.js         (单独启动靶场)
 * 或:   node server.js          (静态站 + 靶场一起启动)
 * ========================================================= */
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const md5 = (s) => crypto.createHash('md5').update(String(s)).digest('hex');

/* ---------- 真实命令执行 (命令注入漏洞用, 输出截断防刷屏) ---------- */
const MAX_OUTPUT = 64 * 1024;
function execP(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 3000, windowsHide: true, encoding: 'utf8', maxBuffer: MAX_OUTPUT }, (err, stdout, stderr) => {
      let output = String(stdout || '') + String(stderr || '');
      let truncated = false;
      if (output.length > MAX_OUTPUT) { output = output.slice(0, MAX_OUTPUT); truncated = true; }
      resolve({ ok: !err, output, error: err ? String(err.message).slice(0, 200) : null, truncated });
    });
  });
}

/* ---------- 数据库: 优先真实 SQLite (Node 内置), 失败则降级 ---------- */
let DatabaseSync = null;
try { ({ DatabaseSync } = require('node:sqlite')); } catch (e) { DatabaseSync = null; }

const SEED_USERS = [
  { id: 1, username: 'admin', password: 'password', password_hash: md5('password'), email: 'admin@vuln-bank.local', secret: 'admin_secret_key_7x9q' },
  { id: 2, username: 'bob', password: '123456', password_hash: md5('123456'), email: 'bob@vuln-bank.local', secret: 'bob_private_message_42' },
  { id: 3, username: 'alice', password: 'letmein', password_hash: md5('letmein'), email: 'alice@vuln-bank.local', secret: 'alice_payroll_2024' },
];

function createDb(forceMiniSql) {
  if (!forceMiniSql && DatabaseSync) {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, password_hash TEXT, email TEXT)');
    const ins = db.prepare('INSERT INTO users (id, username, password, password_hash, email) VALUES (?,?,?,?,?)');
    SEED_USERS.forEach((u) => ins.run(u.id, u.username, u.password, u.password_hash, u.email));
    return {
      engine: 'SQLite (node:sqlite)',
      login(username, password) {
        // 故意使用字符串拼接 —— 这就是一个真实的 SQL 注入漏洞
        const sql = `SELECT id, username, password_hash, email FROM users WHERE username = '${username}' AND password = '${password}'`;
        const injected = /--|#|\/\*|'\s*OR\s*'?1?'?\s*=\s*'?1/i.test(username + ' ' + password);
        try {
          const rows = db.prepare(sql).all();
          return { sql, rows: rows.map((r) => ({ id: r.id, username: r.username, password_hash: r.password_hash, email: r.email })), injected };
        } catch (e) {
          return { sql, rows: [], injected: true, error: String(e.message) };
        }
      },
      all() {
        return db.prepare('SELECT id, username, password_hash, email FROM users').all();
      },
    };
  }
  // 降级引擎: 带引号感知的小型 SQL WHERE 求值器 (仅支持本靶场查询形态)
  const engine = 'MiniSQL (降级模式)';
  function evalWhere(cond, row) {
    cond = String(cond).replace(/\s*(--|#).*$/, '');
    const parts = cond.split(/\b(AND|OR)\b/i);
    let result = null; let op = null;
    for (const part of parts) {
      const t = part.trim();
      if (/^(AND|OR)$/i.test(t)) { op = t.toUpperCase(); continue; }
      const m = t.match(/^([\w.]+)\s*=\s*'((?:[^']|'')*)'$/);
      if (!m) return null;
      const match = String(row[m[1]]) === m[2];
      if (result === null) result = match;
      else if (op === 'AND') result = result && match;
      else if (op === 'OR') result = result || match;
      op = null;
    }
    return result;
  }
  return {
    engine,
    login(username, password) {
      const sql = `SELECT id, username, password_hash, email FROM users WHERE username = '${username}' AND password = '${password}'`;
      const injected = /--|#|\/\*|'\s*OR\s*'?1?'?\s*=\s*'?1/i.test(username + ' ' + password);
      const rows = SEED_USERS.filter((u) => evalWhere(`username = '${username}' AND password = '${password}'`, u));
      return { sql, rows: rows.map((r) => ({ id: r.id, username: r.username, password_hash: r.password_hash, email: r.email })), injected };
    },
    all() { return SEED_USERS.map((r) => ({ id: r.id, username: r.username, password_hash: r.password_hash, email: r.email })); },
  };
}

/* ---------- 真实靶机文件 ---------- */
function buildCrackmeBytes() {
  const bytes = [];
  bytes.push(0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00); // ELF
  for (let i = 0; i < 24; i++) bytes.push(0);
  for (const c of 'Enter password:\0ACCESS GRANTED\0ACCESS DENIED\0p4ssw0rd_is_weak\0') bytes.push(c.charCodeAt(0) & 0xff);
  while (bytes.length <= 0x40) bytes.push(0);
  bytes[0x18] = 0x75; // jne
  return Buffer.from(bytes);
}
function buildUsbImage() {
  const parts = [];
  parts.push(Buffer.from('DOS DISK IMAGE — v1.0 (从嫌疑人 U 盘复制)\n', 'utf8'));
  for (let i = 0; i < 260; i++) parts.push(Buffer.from([(i * 37 + 11) % 256]));
  parts.push(Buffer.from([0xff, 0xd8, 0xff, 0xe0])); // JPEG SOI
  for (let i = 0; i < 120; i++) parts.push(Buffer.from([(i * 53 + 7) % 256]));
  parts.push(Buffer.from([0xff, 0xd9])); // JPEG EOI
  parts.push(Buffer.from('\n[已删除文件 secret.png] 数据块残留\n', 'utf8'));
  parts.push(Buffer.from('wifi_password=BlueWhale42\n', 'utf8'));
  parts.push(Buffer.from('hidden_flag_data=' + Buffer.from('flag{usb_evidence_recovered}', 'utf8').toString('base64') + '\n', 'utf8'));
  parts.push(Buffer.alloc(96));
  return Buffer.concat(parts);
}

/* ---------- TCP 辅助 ---------- */
function tcpFetch(port, send, idleMs = 150) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ port, host: '127.0.0.1' });
    let data = '';
    let done = false;
    let idle = null;
    const finish = (err, val) => {
      if (done) return;
      done = true;
      clearTimeout(to);
      if (idle) clearTimeout(idle);
      sock.destroy();
      err ? reject(err) : resolve(val);
    };
    const to = setTimeout(() => finish(new Error('TCP 超时')), 2000);
    sock.on('connect', () => { if (send) sock.write(send); });
    sock.on('data', (d) => {
      data += d.toString('utf8');
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => finish(null, data), idleMs); // 等数据稳定后再返回
    });
    sock.on('end', () => finish(null, data));
    sock.on('error', (e) => finish(e));
  });
}
function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    const to = setTimeout(() => { s.destroy(); resolve(false); }, 500);
    s.on('connect', () => { clearTimeout(to); s.destroy(); resolve(true); });
    s.on('error', () => { clearTimeout(to); resolve(false); });
  });
}

/* ---------- 靶场主工厂 ---------- */
function createLab(opts) {
  const state = {
    httpPort: opts.httpPort ?? 8090,
    tcpPort: opts.tcpPort ?? 1337,
    sshPort: opts.sshPort ?? 2222,
    downloadDir: opts.downloadDir || path.join(__dirname, 'downloads'),
    labFilesDir: path.join(__dirname, 'lab-files'),
  };
  const db = createDb(opts.miniSql);
  const crackme = buildCrackmeBytes();
  const usb = buildUsbImage();

  // 真实文件落盘
  fs.mkdirSync(state.downloadDir, { recursive: true });
  fs.writeFileSync(path.join(state.downloadDir, 'crackme.bin'), crackme);
  fs.writeFileSync(path.join(state.downloadDir, 'usb.dd'), usb);
  // 靶机机密文件 (路径穿越漏洞的目标)
  fs.mkdirSync(state.labFilesDir, { recursive: true });
  const secretFile = path.join(state.labFilesDir, 'secret.txt');
  if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, 'lab_secret_value_8f3a2c\n');
  const CMD_SEP = process.platform === 'win32' ? ' & ' : '; ';

  /* ---- TCP 后门服务 (1337) ---- */
  const backdoor = net.createServer((sock) => {
    sock.write('TelnetBackdoor v0.9 — (c) by rootkit_1337\r\nPASSWORD: ');
    let buf = '';
    sock.on('data', (d) => {
      buf += d.toString('utf8');
      if (buf.includes('\n')) {
        const line = buf.trim(); buf = '';
        if (line === 'root' || line === 'toor') sock.write('WELCOME ROOT — backdoor access granted\r\n');
        else sock.write('ACCESS DENIED\r\n');
      }
    });
    sock.on('error', () => {});
  });

  /* ---- 模拟 SSH 服务 (2222, 协议级握手) ---- */
  const sshd = net.createServer((sock) => {
    sock.write('SSH-2.0-OpenSSH_7.2p2 Ubuntu (lab)\r\n');
    let buf = '';
    sock.on('data', (d) => {
      buf += d.toString('utf8');
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
        const m = line.match(/^LOGIN (\S+) (.+)$/);
        if (m) {
          if (m[1] === 'admin' && m[2] === 'password') sock.write('AUTH OK ' + m[1] + '\r\n');
          else sock.write('AUTH FAILED\r\n');
          sock.end();
          return;
        }
      }
    });
    sock.on('error', () => {});
  });

  /* ---- HTTP API ---- */
  const setCors = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  };
  const sendJson = (res, obj, status = 200) => {
    setCors(res);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  };
  const sendBytes = (res, buf) => {
    setCors(res);
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': buf.length });
    res.end(buf);
  };
  const readBody = (req, cb) => {
    let body = '';
    req.on('data', (d) => { body += d; if (body.length > 65536) req.destroy(); });
    req.on('end', () => cb(body));
  };
  const realHtml = () => `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>VulnBank 实验室 — 本地靶场</title>
<style>body{font-family:Consolas,monospace;background:#10231a;color:#b8f0c8;max-width:760px;margin:40px auto;padding:0 20px}
.box{border:1px solid #2f6;padding:16px 20px;margin:18px 0;background:#0a1810}input{width:60%;padding:6px;margin:4px 0;font:inherit;background:#06240f;color:#9ff;border:1px solid #2f6}
button{padding:6px 18px;font:inherit;background:#2f6;color:#032;border:none;cursor:pointer}
pre{background:#04120a;padding:10px;color:#ffb;white-space:pre-wrap;word-break:break-all}
.warn{color:#fa0}code{color:#5ff}</style></head><body>
<h1>🏦 VulnBank 本地靶场 <span class="warn">(仅供本地学习)</span></h1>
<p>这是一个<u>故意</u>存在漏洞的真实 Web 应用。所有服务绑定 127.0.0.1。</p>
<div class="box"><h3>1) SQL 注入 (登录)</h3>
用户名: <input id="u" value="admin"><br>密码: <input id="p" value="x"><br>
<button onclick="go()">登录</button>
<p>试试用户名 <code>admin'--</code> 加任意密码 —— 观察下方真实执行的 SQL。</p>
<pre id="r1"></pre></div>
<div class="box"><h3>2) XSS 反射 (搜索)</h3>
搜索词: <input id="q" value="&lt;script&gt;alert(1)&lt;/script&gt;"><br>
<button onclick="go2()">搜索</button>
<p>输入将被<u>原样反射</u>到页面 —— 这是反射型 XSS 的雏形。</p>
<pre id="r2"></pre></div>
<div class="box"><h3>3) 命令注入 (Ping)</h3>
目标: <input id="h" value="127.0.0.1"><br>
<button onclick="go3()">Ping</button>
<p>参数被直接拼进系统命令。试试 <code>127.0.0.1${' & echo '}LAB_PWN</code> (Windows) 或 <code>127.0.0.1; whoami</code> (Linux)。</p>
<pre id="r3"></pre></div>
<div class="box"><h3>4) IDOR 越权 (用户资料)</h3>
用户ID: <input id="uid" value="1"><br>
<button onclick="go4()">查看</button>
<p>没有鉴权。把 id 改成 2、3 看看别人的隐私。</p>
<pre id="r4"></pre></div>
<div class="box"><h3>5) 路径穿越 (文件读取)</h3>
文件: <input id="f" value="secret.txt"><br>
<button onclick="go5()">读取</button>
<p>路径没做校验。试试 <code>../server.js</code> 读取目录外的文件。</p>
<pre id="r5"></pre></div>
<script>
async function go(){const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('u').value,password:document.getElementById('p').value})});const j=await r.json();
document.getElementById('r1').textContent='SQL: '+j.sql+'\n结果行数: '+(j.rows?j.rows.length:0)+(j.ok?'\n→ 登录成功!':'')}
async function go2(){const q=document.getElementById('q').value;const r=await fetch('/api/search?q='+encodeURIComponent(q));const j=await r.json();
document.getElementById('r2').textContent='服务器反射: '+j.echoed+'\n含脚本: '+!j.safe+'\n→ '+(j.safe?'(安全)':'⚠ 若这是浏览器页面，脚本会被执行 (XSS)'))}
async function go3(){const h=document.getElementById('h').value;const r=await fetch('/api/ping?host='+encodeURIComponent(h));const j=await r.json();
document.getElementById('r3').textContent='命令: '+j.command+'\n输出:\n'+(j.output||j.error||'')}
async function go4(){const id=document.getElementById('uid').value;const r=await fetch('/api/profile?id='+encodeURIComponent(id));const j=await r.json();
document.getElementById('r4').textContent=j.ok?('用户: '+j.username+' ('+j.email+')\n隐私: '+j.secret):('错误: '+(j.error||''))}
async function go5(){const f=document.getElementById('f').value;const r=await fetch('/api/read?file='+encodeURIComponent(f));const j=await r.json();
document.getElementById('r5').textContent=j.ok?('解析到: '+j.resolved+'\n内容:\n'+j.content):('错误: '+(j.error||''))}
</script></body></html>`;

  const httpServer = http.createServer((req, res) => {
    const method = req.method;
    const url = new URL(req.url, 'http://127.0.0.1');
    const p = url.pathname;

    if (method === 'OPTIONS') { setCors(res); res.writeHead(204); return res.end(); }
    if (method === 'GET' && p === '/') { setCors(res); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(realHtml()); }
    if (method === 'GET' && p === '/lab/status') return sendJson(res, { lab: true, engine: db.engine, version: '1.1', sep: CMD_SEP, ports: { http: state.httpPort, backdoor: state.tcpPort, ssh: state.sshPort }, downloads: state.downloadDir });
    if (method === 'GET' && p === '/api/ping') {
      const host = url.searchParams.get('host') || '';
      const cmd = (process.platform === 'win32' ? 'ping -n 1 ' : 'ping -c 1 ') + host;
      // 故意把用户输入直接拼进系统命令 —— 这就是真实的命令注入漏洞
      return execP(cmd).then((r) => sendJson(res, Object.assign({ command: cmd }, r)));
    }
    if (method === 'GET' && p === '/api/profile') {
      const id = parseInt(url.searchParams.get('id') || '', 10);
      const u = SEED_USERS.find((x) => x.id === id);
      // 故意不做鉴权 —— IDOR: 换个 id 就能看到别人的隐私
      if (u) return sendJson(res, { ok: true, id: u.id, username: u.username, email: u.email, secret: u.secret });
      return sendJson(res, { ok: false, error: 'user not found' }, 404);
    }
    if (method === 'GET' && p === '/api/read') {
      const file = url.searchParams.get('file') || '';
      const full = path.join(state.labFilesDir, file);
      // 故意不做路径规范化 —— 这就是真实的路径穿越漏洞 (可用 ../ 逃逸)
      return fs.readFile(full, 'utf8', (err, content) => {
        if (err) return sendJson(res, { ok: false, requested: file, error: String(err.code || err.message) });
        let truncated = false;
        if (content.length > MAX_OUTPUT) { content = content.slice(0, MAX_OUTPUT); truncated = true; }
        sendJson(res, { ok: true, requested: file, resolved: full, content, truncated });
      });
    }
    if (method === 'POST' && p === '/api/login') {
      return readBody(req, (body) => {
        let o = {};
        try { o = JSON.parse(body || '{}'); } catch (e) { /* 忽略 */ }
        const r = db.login(String(o.username || ''), String(o.password || ''));
        return sendJson(res, Object.assign({ ok: r.rows.length > 0 }, r));
      });
    }
    if (method === 'GET' && p === '/api/search') {
      const q = url.searchParams.get('q') || '';
      return sendJson(res, { q, echoed: q, safe: !/<script|<img[^>]*onerror/i.test(q), reflected: true });
    }
    if (method === 'GET' && p === '/api/users') return sendJson(res, { rows: db.all(), engine: db.engine });
    if (method === 'POST' && p === '/api/banner') {
      return tcpFetch(state.tcpPort, '').then((txt) => {
        const banner = txt.split('\n')[0] || '';
        sendJson(res, { port: state.tcpPort, banner, real: true });
      }).catch((e) => sendJson(res, { port: state.tcpPort, banner: '', error: e.message }));
    }
    if (method === 'POST' && p === '/api/ssh') {
      return readBody(req, (body) => {
        let o = {};
        try { o = JSON.parse(body || '{}'); } catch (e) { /* 忽略 */ }
        const user = String(o.user || ''); const pass = String(o.pass || '');
        return tcpFetch(state.sshPort, `LOGIN ${user} ${pass}\n`).then((txt) => {
          const ok = /AUTH OK/i.test(txt);
          sendJson(res, { ok, user: ok ? user : null, reply: txt.trim(), real: true });
        }).catch((e) => sendJson(res, { ok: false, error: e.message }));
      });
    }
    if (method === 'POST' && p === '/api/scan') {
      return Promise.all([portOpen(state.httpPort), portOpen(state.tcpPort), portOpen(state.sshPort)]).then((o) => {
        const ports = [
          { service: 'http (web)', port: state.httpPort, open: o[0] },
          { service: 'backdoor', port: state.tcpPort, open: o[1] },
          { service: 'ssh (sim)', port: state.sshPort, open: o[2] },
        ];
        sendJson(res, { real: true, ports, open: ports.filter((x) => x.open).length });
      });
    }
    if (method === 'GET' && p === '/api/flag') return sendJson(res, { flag: 'flag{total_penetration}', source: 'target-server-flag.txt' });
    if (method === 'GET' && p.startsWith('/api/files/')) {
      const name = p.slice('/api/files/'.length);
      if (name === 'crackme.bin') return sendBytes(res, crackme);
      if (name === 'usb.dd') return sendBytes(res, usb);
      return sendJson(res, { error: 'not found' }, 404);
    }
    return sendJson(res, { error: 'not found' }, 404);
  });

  const labObj = {
    httpPort: state.httpPort,
    tcpPort: state.tcpPort,
    sshPort: state.sshPort,
    downloadDir: state.downloadDir,
    engine: db.engine,
    ready: null,
    close() {
      try { httpServer.close(); } catch (e) { /* 忽略 */ }
      try { backdoor.close(); } catch (e) { /* 忽略 */ }
      try { sshd.close(); } catch (e) { /* 忽略 */ }
    },
  };
  const listenP = (server, port) => new Promise((res, rej) => {
    server.once('error', rej);
    server.listen(port, '127.0.0.1', res);
  });
  labObj.ready = Promise.all([
    listenP(httpServer, state.httpPort),
    listenP(backdoor, state.tcpPort),
    listenP(sshd, state.sshPort),
  ]).then(() => {
    state.httpPort = httpServer.address().port;
    state.tcpPort = backdoor.address().port;
    state.sshPort = sshd.address().port;
    labObj.httpPort = state.httpPort;
    labObj.tcpPort = state.tcpPort;
    labObj.sshPort = state.sshPort;
  });
  return labObj;
}

/* ---------- 独立运行 ---------- */
if (require.main === module) {
  const lab = createLab({});
  lab.ready.then(() => {
    console.log('══════════════════════════════════════════');
    console.log('✔ 赛博安全学院 · 本地真实靶场已启动');
    console.log('══════════════════════════════════════════');
    console.log('  Web 应用 (SQLi/XSS): http://127.0.0.1:' + lab.httpPort + '/');
    console.log('  后门服务 (TCP):      nc 127.0.0.1 ' + lab.tcpPort + '  (密码 root/toor)');
    console.log('  SSH 模拟 (TCP):      nc 127.0.0.1 ' + lab.sshPort + '  (LOGIN admin password)');
    console.log('  靶机文件:            ' + lab.downloadDir + '/');
    console.log('  命令注入 (RCE):      GET /api/ping?host=127.0.0.1' + (process.platform === 'win32' ? ' & ' : '; ') + 'whoami');
    console.log('  IDOR 越权:           GET /api/profile?id=2');
    console.log('  路径穿越:            GET /api/read?file=../server.js');
    console.log('  SQL 引擎:            ' + lab.engine);
    console.log('⚠ 仅绑定 127.0.0.1，切勿暴露到公网，仅供本地学习。');
    console.log('  按 Ctrl+C 停止');
  });
  const stop = () => { lab.close(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

module.exports = { createLab, buildCrackmeBytes, buildUsbImage };
