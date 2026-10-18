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
 *
 * 安全边界 (漏洞是"故意"的, 但不允许越出靶场):
 *   1. 路径穿越 /api/read 依然存在 (可读 ../../server.js), 但被限制在项目目录内,
 *      读不到项目之外的系统文件;
 *   2. 命令注入 /api/ping 依然真实执行, 但有 3s 超时 + 输出上限 + 并发上限,
 *      超时会杀掉整棵进程树 (不留孤儿进程);
 *   3. 危险端点 (ping/read/ssh/banner/scan) 拒绝非本机 Origin 的跨站调用,
 *      避免任意网页借 127.0.0.1 的靶场打本机; curl/工具/靶场自身页面不受影响。
 * ========================================================= */
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec, execFile } = require('child_process');

const md5 = (s) => crypto.createHash('md5').update(String(s)).digest('hex');

/* ---------- 真实命令执行 (命令注入漏洞用, 输出截断防刷屏) ---------- */
const MAX_OUTPUT = 64 * 1024;
const EXEC_TIMEOUT = 3000;
const MAX_CONCURRENT_EXEC = 4;   // 并发上限: 靶场不该被当成主机上的 fork 炸弹
const EXEC_QUEUE_LIMIT = 16;     // 排队上限
const MAX_BODY = 64 * 1024;      // HTTP 请求体上限
const MAX_TCP_LINE = 8 * 1024;   // TCP 单行缓冲上限 (防内存膨胀)

const liveChildren = new Set();  // 追踪子进程, 关闭靶场时统一清理
let execRunning = 0;
const execQueue = [];

/* 杀掉整棵进程树: exec 的 timeout 只会杀 shell, ping 等子进程会变孤儿 */
function killTree(child) {
  if (!child || !child.pid) return;
  try {
    if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
    else { try { process.kill(-child.pid, 'SIGKILL'); } catch (e) { child.kill('SIGKILL'); } }
  } catch (e) { /* 忽略 */ }
}

function runExec(cmd) {
  return new Promise((resolve) => {
    let timedOut = false;
    // 自己管超时: 必须在 shell 还活着时杀整棵树, 否则子进程已被孤儿化, taskkill /T 找不到它
    const child = exec(cmd, { windowsHide: true, encoding: 'utf8', maxBuffer: MAX_OUTPUT, detached: process.platform !== 'win32' },
      (err, stdout, stderr) => {
        clearTimeout(timer);
        liveChildren.delete(child);
        let output = String(stdout || '') + String(stderr || '');
        let truncated = false;
        if (output.length > MAX_OUTPUT) { output = output.slice(0, MAX_OUTPUT); truncated = true; }
        if (!timedOut && err && err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') killTree(child); // 输出爆炸也要清树
        resolve({
          ok: !err && !timedOut,
          output,
          error: timedOut ? '命令执行超时 (' + (EXEC_TIMEOUT / 1000) + 's)，已终止整棵进程树'
            : (err ? String(err.message).slice(0, 200) : null),
          truncated,
          timedOut,
        });
      });
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, EXEC_TIMEOUT);
    liveChildren.add(child);
  });
}

function pumpExecQueue() {
  while (execRunning < MAX_CONCURRENT_EXEC && execQueue.length) {
    const job = execQueue.shift();
    execRunning++;
    runExec(job.cmd)
      .then(job.resolve, (e) => job.resolve({ ok: false, output: '', error: String(e && e.message), truncated: false }))
      .then(() => { execRunning--; pumpExecQueue(); });
  }
}

function execP(cmd) {
  if (execRunning >= MAX_CONCURRENT_EXEC && execQueue.length >= EXEC_QUEUE_LIMIT) {
    return Promise.resolve({ ok: false, output: '', error: '靶场命令执行队列已满，请稍后再试', truncated: false });
  }
  return new Promise((resolve) => { execQueue.push({ cmd, resolve }); pumpExecQueue(); });
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
  const sandboxRoot = path.resolve(__dirname, '..'); // 靶场沙箱边界: 项目目录
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

  const sockets = new Set(); // 所有 TCP 连接, 关闭时统一销毁

  /* ---- TCP 后门服务 (1337) ---- */
  const backdoor = net.createServer((sock) => {
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
    sock.setTimeout(30000, () => sock.destroy()); // 空闲连接不悬挂
    sock.write('TelnetBackdoor v0.9 — (c) by rootkit_1337\r\nPASSWORD: ');
    let buf = '';
    sock.on('data', (d) => {
      buf += d.toString('utf8');
      if (buf.length > MAX_TCP_LINE) { sock.destroy(); return; } // 防无换行刷内存
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
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
    sock.setTimeout(30000, () => sock.destroy());
    sock.write('SSH-2.0-OpenSSH_7.2p2 Ubuntu (lab)\r\n');
    let buf = '';
    sock.on('data', (d) => {
      buf += d.toString('utf8');
      if (buf.length > MAX_TCP_LINE) { sock.destroy(); return; }
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
  // 只允许本机来源的浏览器页面调用危险端点 (否则任意网站都能 fetch 127.0.0.1:8090 = 漏洞外溢)
  const ORIGIN_ALLOW = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;
  const GUARDED_PATHS = ['/api/ping', '/api/read', '/api/ssh', '/api/banner', '/api/scan'];

  const setCors = (req, res) => {
    const origin = req && req.headers ? req.headers.origin : null;
    if (origin) {
      // 浏览器请求: 只回显本机来源; 其他来源不给 CORS 许可
      if (ORIGIN_ALLOW.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*'); // 非浏览器客户端 (curl / 工具链)
    }
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  };
  const sendJson = (req, res, obj, status = 200) => {
    try {
      setCors(req, res);
      if (res.headersSent) return;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(obj));
    } catch (e) { /* 客户端提前断开, 忽略 */ }
  };
  const sendBytes = (req, res, buf) => {
    try {
      setCors(req, res);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': buf.length });
      res.end(buf);
    } catch (e) { /* 忽略 */ }
  };
  const readBody = (req, res, cb) => {
    let body = '';
    let done = false;
    let tooLarge = false;
    const finish = (fn) => { if (done) return; done = true; fn(); };
    req.on('data', (d) => {
      if (tooLarge) return;                     // 超限后丢弃剩余数据, 但让连接正常收尾
      body += d;
      if (body.length > MAX_BODY) {             // 超大请求体: 明确回 413, 而不是直接断链
        tooLarge = true; body = '';
        finish(() => sendJson(req, res, { error: 'request body too large (max 64KB)' }, 413));
      }
    });
    req.on('end', () => { if (!tooLarge) finish(() => cb(body)); else done = true; });
    req.on('aborted', () => { done = true; });   // 客户端中途断开, 不再回调
    req.on('error', () => { done = true; });
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
<p>路径没做校验。试试 <code>../../server.js</code> 读取目录外的文件。
(教学沙箱: 穿越漏洞真实存在, 但被限制在本项目目录内, 读不到系统文件)</p>
<pre id="r5"></pre></div>
<script>
async function go(){const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('u').value,password:document.getElementById('p').value})});const j=await r.json();
document.getElementById('r1').textContent='SQL: '+j.sql+'\n结果行数: '+(j.rows?j.rows.length:0)+(j.ok?'\n→ 登录成功!':'')}
async function go2(){const q=document.getElementById('q').value;const r=await fetch('/api/search?q='+encodeURIComponent(q));const j=await r.json();
document.getElementById('r2').textContent='服务器反射: '+j.echoed+'\n含脚本: '+!j.safe+'\n→ '+(j.safe?'(安全)':'⚠ 若这是浏览器页面，脚本会被执行 (XSS)')}
async function go3(){const h=document.getElementById('h').value;const r=await fetch('/api/ping?host='+encodeURIComponent(h));const j=await r.json();
document.getElementById('r3').textContent='命令: '+j.command+'\n输出:\n'+(j.output||j.error||'')}
async function go4(){const id=document.getElementById('uid').value;const r=await fetch('/api/profile?id='+encodeURIComponent(id));const j=await r.json();
document.getElementById('r4').textContent=j.ok?('用户: '+j.username+' ('+j.email+')\n隐私: '+j.secret):('错误: '+(j.error||''))}
async function go5(){const f=document.getElementById('f').value;const r=await fetch('/api/read?file='+encodeURIComponent(f));const j=await r.json();
document.getElementById('r5').textContent=j.ok?('解析到: '+j.resolved+'\n内容:\n'+j.content):('错误: '+(j.error||''))}
</script></body></html>`;

  const httpServer = http.createServer((req, res) => {
    // 任何异常都不允许拖垮进程 (node server.js 时游戏本体与靶场同进程)
    try {
      handleHttp(req, res);
    } catch (e) {
      sendJson(req, res, { error: 'internal lab error: ' + String(e && e.message) }, 500);
    }
  });

  function handleHttp(req, res) {
    const method = req.method;
    let url;
    try {
      // 畸形请求目标 (例如 "GET // HTTP/1.1") 会让 URL 构造抛异常 → 之前会直接杀掉整个进程
      url = new URL(req.url, 'http://127.0.0.1');
    } catch (e) {
      return sendJson(req, res, { error: 'bad request target' }, 400);
    }
    const p = url.pathname;
    const origin = req.headers.origin;
    const crossOrigin = !!origin && !ORIGIN_ALLOW.test(origin);

    if (method === 'OPTIONS') {
      if (crossOrigin) return sendJson(req, res, { error: 'cross-site request denied' }, 403);
      setCors(req, res); res.writeHead(204); return res.end();
    }
    // 危险端点只服务本机来源: 否则任意网页都能借 127.0.0.1 的靶场打本机
    if (crossOrigin && GUARDED_PATHS.includes(p)) {
      return sendJson(req, res, { ok: false, error: 'cross-site request denied: 只允许本机页面调用 ' + p }, 403);
    }

    if (method === 'GET' && p === '/') { setCors(req, res); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(realHtml()); }
    if (method === 'GET' && p === '/lab/status') return sendJson(req, res, {
      lab: true, engine: db.engine, version: '1.2', sep: CMD_SEP,
      ports: { http: state.httpPort, backdoor: state.tcpPort, ssh: state.sshPort },
      downloads: state.downloadDir, sandbox: sandboxRoot,
      limits: { execTimeoutMs: EXEC_TIMEOUT, maxConcurrentExec: MAX_CONCURRENT_EXEC, maxBody: MAX_BODY },
    });
    if (method === 'GET' && p === '/api/ping') {
      const host = url.searchParams.get('host') || '';
      const cmd = (process.platform === 'win32' ? 'ping -n 1 ' : 'ping -c 1 ') + host;
      // 故意把用户输入直接拼进系统命令 —— 这就是真实的命令注入漏洞
      return execP(cmd)
        .then((r) => sendJson(req, res, Object.assign({ command: cmd }, r)))
        .catch((e) => sendJson(req, res, { command: cmd, ok: false, error: String(e && e.message) }));
    }
    if (method === 'GET' && p === '/api/profile') {
      const id = parseInt(url.searchParams.get('id') || '', 10);
      const u = SEED_USERS.find((x) => x.id === id);
      // 故意不做鉴权 —— IDOR: 换个 id 就能看到别人的隐私
      if (u) return sendJson(req, res, { ok: true, id: u.id, username: u.username, email: u.email, secret: u.secret });
      return sendJson(req, res, { ok: false, error: 'user not found' }, 404);
    }
    if (method === 'GET' && p === '/api/read') {
      const file = url.searchParams.get('file') || '';
      const full = path.join(state.labFilesDir, file);
      // 故意不做路径规范化 —— 这就是真实的路径穿越漏洞 (可用 ../ 逃逸 lab-files)
      const rel = path.relative(sandboxRoot, path.resolve(full));
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        // 教学沙箱边界: 穿越漏洞保留在项目目录内, 但不允许读到宿主机任意文件
        return sendJson(req, res, {
          ok: false, requested: file, resolved: path.resolve(full),
          error: 'sandbox boundary: 靶场只允许访问项目目录内的文件 (' + sandboxRoot + ')',
        }, 403);
      }
      return fs.readFile(full, 'utf8', (err, content) => {
        if (err) return sendJson(req, res, { ok: false, requested: file, error: String(err.code || err.message) });
        let truncated = false;
        if (content.length > MAX_OUTPUT) { content = content.slice(0, MAX_OUTPUT); truncated = true; }
        sendJson(req, res, { ok: true, requested: file, resolved: full, content, truncated });
      });
    }
    if (method === 'POST' && p === '/api/login') {
      return readBody(req, res, (body) => {
        let o = {};
        try { o = JSON.parse(body || '{}'); } catch (e) { /* 忽略 */ }
        const r = db.login(String(o.username || ''), String(o.password || ''));
        return sendJson(req, res, Object.assign({ ok: r.rows.length > 0 }, r));
      });
    }
    if (method === 'GET' && p === '/api/search') {
      const q = url.searchParams.get('q') || '';
      return sendJson(req, res, { q, echoed: q, safe: !/<script|<img[^>]*onerror/i.test(q), reflected: true });
    }
    if (method === 'GET' && p === '/api/users') return sendJson(req, res, { rows: db.all(), engine: db.engine });
    if (method === 'POST' && p === '/api/banner') {
      return tcpFetch(state.tcpPort, '').then((txt) => {
        const banner = txt.split('\n')[0] || '';
        sendJson(req, res, { port: state.tcpPort, banner, real: true });
      }).catch((e) => sendJson(req, res, { port: state.tcpPort, banner: '', error: e.message }));
    }
    if (method === 'POST' && p === '/api/ssh') {
      return readBody(req, res, (body) => {
        let o = {};
        try { o = JSON.parse(body || '{}'); } catch (e) { /* 忽略 */ }
        const user = String(o.user || ''); const pass = String(o.pass || '');
        return tcpFetch(state.sshPort, `LOGIN ${user} ${pass}\n`).then((txt) => {
          const ok = /AUTH OK/i.test(txt);
          sendJson(req, res, { ok, user: ok ? user : null, reply: txt.trim(), real: true });
        }).catch((e) => sendJson(req, res, { ok: false, error: e.message }));
      });
    }
    if (method === 'POST' && p === '/api/scan') {
      return Promise.all([portOpen(state.httpPort), portOpen(state.tcpPort), portOpen(state.sshPort)]).then((o) => {
        const ports = [
          { service: 'http (web)', port: state.httpPort, open: o[0] },
          { service: 'backdoor', port: state.tcpPort, open: o[1] },
          { service: 'ssh (sim)', port: state.sshPort, open: o[2] },
        ];
        sendJson(req, res, { real: true, ports, open: ports.filter((x) => x.open).length });
      }).catch((e) => sendJson(req, res, { real: false, error: String(e && e.message) }));
    }
    if (method === 'GET' && p === '/api/flag') return sendJson(req, res, { flag: 'flag{total_penetration}', source: 'target-server-flag.txt' });
    if (method === 'GET' && p.startsWith('/api/files/')) {
      const name = p.slice('/api/files/'.length);
      if (name === 'crackme.bin') return sendBytes(req, res, crackme);
      if (name === 'usb.dd') return sendBytes(req, res, usb);
      return sendJson(req, res, { error: 'not found' }, 404);
    }
    return sendJson(req, res, { error: 'not found' }, 404);
  }

  // 畸形 HTTP 请求: 回 400, 不让 Node 抛异常
  httpServer.on('clientError', (err, sock) => {
    try { sock.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); } catch (e) { try { sock.destroy(); } catch (e2) { /* 忽略 */ } }
  });

  const labObj = {
    httpPort: state.httpPort,
    tcpPort: state.tcpPort,
    sshPort: state.sshPort,
    downloadDir: state.downloadDir,
    sandboxRoot,
    engine: db.engine,
    ready: null,
    close() {
      try { httpServer.close(); } catch (e) { /* 忽略 */ }
      try { backdoor.close(); } catch (e) { /* 忽略 */ }
      try { sshd.close(); } catch (e) { /* 忽略 */ }
      sockets.forEach((s) => { try { s.destroy(); } catch (e) { /* 忽略 */ } });
      sockets.clear();
      // 清理可能仍在运行的被注入命令 (靶场关掉后不在主机上残留进程)
      liveChildren.forEach((c) => killTree(c));
      liveChildren.clear();
      execQueue.splice(0).forEach((j) => j.resolve({ ok: false, output: '', error: '靶场已关闭', truncated: false }));
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
    console.log('  路径穿越:            GET /api/read?file=../../server.js');
    console.log('  SQL 引擎:            ' + lab.engine);
    console.log('⚠ 仅绑定 127.0.0.1，切勿暴露到公网，仅供本地学习。');
    console.log('  沙箱边界: ' + lab.sandboxRoot + ' (穿越漏洞保留, 但读不到项目外文件)');
    console.log('  按 Ctrl+C 停止');
  }).catch((e) => console.log('⚠ 靶场启动失败: ' + e.message));
  const stop = () => { lab.close(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

module.exports = { createLab, buildCrackmeBytes, buildUsbImage };
