// ============================================================
// 墨战 · 天书纪 INK-SAGA — 本地后端服务器（零第三方依赖）
// 职责：静态资源服务 / 存档读写 / 字帖与体检报告导出到真实磁盘
//       / 本地排行榜持久化
// 启动：node server.js  →  http://127.0.0.1:7337
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 7337;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const SAVE_DIR = path.join(ROOT, 'save');
const REPORT_DIR = path.join(SAVE_DIR, 'reports');
const EXPORT_DIR = path.join(SAVE_DIR, 'exports');
const SAVE_FILE = path.join(SAVE_DIR, 'game.json');
const LB_FILE = path.join(SAVE_DIR, 'leaderboard.json');
const MAX_BODY = 1e6;          // 1MB 请求体上限
const MAX_LEADERBOARD = 50;    // 排行榜最多保留 50 条

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml'
};

// 加载浏览器端数据文件（dictionary.js / words.js 内含 UMD 导出，供 Node 端复用生成字帖）。
// 结果缓存：/api/dict 与 /api/practice 不再每次请求都重新读盘 + 编译一遍。
let dataCache = null;
function loadData(force) {
  if (dataCache && !force) return dataCache;
  const d = {};
  for (const name of ['dictionary', 'words']) {
    const p = path.join(PUBLIC, 'js', 'data', name + '.js');
    if (fs.existsSync(p)) {
      const m = { exports: {} };
      try {
        const code = fs.readFileSync(p, 'utf-8');
        const fn = new Function('module', 'exports', 'require', code);
        fn(m, m.exports, require);
        d[name] = m.exports;
      } catch (e) { d[name] = null; }
    }
  }
  dataCache = d;
  return d;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return fallback; }
}

// 原子写：先写临时文件再 rename，避免进程/请求在写一半时留下半截 JSON。
function writeFileAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.' + process.pid + '.' + Date.now() + '.' + Math.random().toString(36).slice(2, 8) + '.tmp';
  fs.writeFileSync(tmp, content, 'utf-8');
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(file); } catch (e2) {}
    fs.renameSync(tmp, file);
  }
}
function writeJson(file, data) { writeFileAtomic(file, JSON.stringify(data, null, 2)); }

function clampCount(raw, def, min, max) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

// 文件名净化：去掉路径分隔符与危险字符，拒绝 '.' / '..' / Windows 保留名。
function safeFilename(name, fallback) {
  const fb = fallback || ('export-' + Date.now());
  let s = String(name == null ? '' : name).trim();
  if (!s) return fb;
  s = s.replace(/[\/]+/g, '_').replace(/[^\w\u4e00-\u9fa5.\-]/g, '_');
  s = s.replace(/^\.+/, '').replace(/\.+$/, '');
  if (!s) return fb;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(s)) s = '_' + s;
  return s.slice(0, 120);
}

// JSON 原型污染探测（存档来自浏览器，必须拒绝 __proto__ / constructor / prototype）
function hasDangerousKeys(value, depth) {
  if (depth > 8) return true;
  if (Array.isArray(value)) return value.some(v => hasDangerousKeys(v, depth + 1));
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return true;
      if (hasDangerousKeys(value[k], depth + 1)) return true;
    }
  }
  return false;
}

function sanitizeSavePayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (hasDangerousKeys(data, 0)) return null;
  return data;
}

function safeNumber(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

// 排行榜条目校验：白名单 mode、有限数值、截断名字、去掉 HTML/控制字符。
function sanitizeLeaderboardEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const bad = "<>&\"'`" + String.fromCharCode(92);
  const rawName = String(entry.name == null ? '' : entry.name).split('').filter(ch => ch.charCodeAt(0) >= 32 && bad.indexOf(ch) < 0).join('').trim();
  const name = rawName.slice(0, 12) || '无名书生';
  const mode = (entry.mode === 'daily' || entry.mode === 'endless') ? entry.mode : 'endless';
  const out = { name, mode, score: safeNumber(entry.score, 0, 0, 1e9), chars: safeNumber(entry.chars, 0, 0, 1e6), time: Date.now() };
  if (entry.date != null) {
    const date = String(entry.date).replace(/[^0-9-]/g, '').slice(0, 10);
    if (date) out.date = date;
  }
  return out;
}

// 生成一张练习字帖（真实文本，可另存/打印）
function buildPracticeSheet(dict, count) {
  const pool = Array.isArray(dict && dict.DICT)
    ? dict.DICT.filter(c => c && typeof c.ch === 'string' && c.ch.length === 1)
    : [];
  if (!pool.length) return '# 字帖生成失败：词库为空';
  const wanted = Math.max(1, Math.min(Number.isFinite(count) ? Math.floor(count) : 10, pool.length));
  const chars = [];
  const used = new Set();
  // 词库理论上无重复字；仍加尝试上限，避免数据异常时 while 死循环。
  for (let guard = 0; chars.length < wanted && guard < pool.length * 20; guard++) {
    const c = pool[Math.floor(Math.random() * pool.length)];
    if (!used.has(c.ch)) { used.add(c.ch); chars.push(c); }
  }
  const rows = [];
  rows.push('==========================================');
  rows.push('  墨战 · 天书纪 — 个人练习字帖');
  rows.push('  生成时间：' + new Date().toLocaleString('zh-CN'));
  rows.push('==========================================');
  rows.push('');
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    rows.push('  第 ' + String(i + 1).padStart(2, '0') + ' 字｜' + c.ch + '　拼音：' + (c.pinyin || '—') + '　释义：' + (c.meaning || '—') + '　分类：' + (c.cat || '—'));
    rows.push('  ┌──────────────────────────────┐');
    rows.push('  │                              │');
    rows.push('  │                              │');
    rows.push('  └──────────────────────────────┘');
    rows.push('');
  }
  rows.push('------------------------------------------');
  rows.push('  建议：先看字形，再在心中默写，最后对照。');
  rows.push('  去《墨战 · 天书纪》里实战检验你的记忆！');
  rows.push('==========================================');
  return rows.join('\n');
}

// 把 URL pathname 解析成 public 下的真实文件；拒绝路径穿越与 symlink 逃逸。
// 返回 { fp } | { forbidden:true } | { notFound:true }
function resolveStaticPath(pathname) {
  if (typeof pathname !== 'string' || pathname.indexOf('\0') >= 0) return { forbidden: true };
  let fp = path.join(PUBLIC, pathname);
  const rel = path.relative(PUBLIC, fp);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { forbidden: true };
  try {
    const realPublic = fs.realpathSync(PUBLIC);
    const real = fs.realpathSync(fp);
    const relReal = path.relative(realPublic, real);
    if (relReal.startsWith('..') || path.isAbsolute(relReal)) return { forbidden: true };
    fp = real;
  } catch (e) {
    // 文件不存在时 realpath 会抛错：保留原路径，走下面的 index.html 回退
  }
  try {
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(PUBLIC, 'index.html');
    if (!fs.existsSync(fp)) return { notFound: true };
  } catch (e) {
    return { notFound: true };
  }
  return { fp };
}

function sendJson(res, obj, cors, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
  res.end(JSON.stringify(obj));
}

// 读请求体：Content-Length 预检 + 流式 1MB 上限；超限返回 413 并继续 drain。
function readBody(req, res, cors, cb) {
  const declared = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY) {
    sendJson(res, { ok: false, error: '请求体过大（上限 1MB）' }, cors, 413);
    req.resume();
    return;
  }
  let body = '';
  let done = false;
  const finish = (err) => {
    if (done) return;
    done = true;
    if (err) { sendJson(res, { ok: false, error: err }, cors, 413); return; }
    cb(body);
  };
  req.on('data', c => {
    if (done) return;
    body += c;
    if (body.length > MAX_BODY) { body = ''; finish('请求体过大（上限 1MB）'); req.resume(); }
  });
  req.on('end', () => finish(null));
  req.on('aborted', () => { done = true; });
  req.on('error', () => { done = true; });
}

function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const cors = { 'Access-Control-Allow-Origin': '*' };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  // ---- API ----
  if (p === '/api/health') { return sendJson(res, { ok: true, name: 'INK-SAGA', time: Date.now() }, cors); }

  if (p === '/api/dict') {
    const d = loadData();
    return sendJson(res, {
      dict: d.dictionary ? d.dictionary.DICT : [],
      words: d.words ? d.words.WORDS : []
    }, cors);
  }

  // 生成并导出练习字帖 → 真实 .txt 文件
  if (p === '/api/practice' && req.method === 'GET') {
    const count = clampCount(url.searchParams.get('count'), 10, 1, 60);
    const d = loadData();
    const sheet = buildPracticeSheet(d.dictionary, count);
    const fn = 'practice-' + Date.now() + '.txt';
    const fp = path.join(EXPORT_DIR, fn);
    writeFileAtomic(fp, sheet);
    return sendJson(res, { ok: true, file: fn, path: fp, content: sheet }, cors);
  }

  // 保存玩家存档
  if (p === '/api/save' && req.method === 'POST') {
    readBody(req, res, cors, body => {
      try {
        const data = sanitizeSavePayload(JSON.parse(body || '{}'));
        if (!data) return sendJson(res, { ok: false, error: '存档格式无效' }, cors, 400);
        writeJson(SAVE_FILE, data);
        sendJson(res, { ok: true, savedAt: Date.now() }, cors);
      } catch (e) { sendJson(res, { ok: false, error: 'JSON 解析失败' }, cors, 400); }
    });
    return;
  }
  if (p === '/api/save' && req.method === 'GET') {
    return sendJson(res, { ok: true, save: readJson(SAVE_FILE, null) }, cors);
  }

  // 导出内容（报告/字帖/存档）到真实磁盘
  if (p === '/api/export' && req.method === 'POST') {
    readBody(req, res, cors, body => {
      try {
        const data = JSON.parse(body || '{}');
        if (!data || typeof data !== 'object' || Array.isArray(data)) return sendJson(res, { ok: false, error: '导出参数无效' }, cors, 400);
        const kind = data.kind === 'report' ? REPORT_DIR : EXPORT_DIR;
        const safe = safeFilename(data.filename, 'export-' + Date.now());
        const fp = path.join(kind, safe);
        const rel = path.relative(kind, fp);
        if (rel.startsWith('..') || path.isAbsolute(rel)) return sendJson(res, { ok: false, error: '文件名非法' }, cors, 400);
        writeFileAtomic(fp, String(data.content == null ? '' : data.content));
        sendJson(res, { ok: true, file: safe, path: fp }, cors);
      } catch (e) { sendJson(res, { ok: false, error: 'JSON 解析失败' }, cors, 400); }
    });
    return;
  }

  // 排行榜
  if (p === '/api/leaderboard' && req.method === 'GET') {
    let board = readJson(LB_FILE, []);
    if (!Array.isArray(board)) board = [];
    const mode = url.searchParams.get('mode');
    const date = url.searchParams.get('date');
    if (mode) board = board.filter(b => b && b.mode === mode);
    if (date) board = board.filter(b => b && String(b.date) === String(date));
    return sendJson(res, { ok: true, board: board.slice(0, MAX_LEADERBOARD) }, cors);
  }
  if (p === '/api/leaderboard' && req.method === 'POST') {
    readBody(req, res, cors, body => {
      try {
        const entry = sanitizeLeaderboardEntry(JSON.parse(body || '{}'));
        if (!entry) return sendJson(res, { ok: false, error: '排行榜条目无效' }, cors, 400);
        let board = readJson(LB_FILE, []);
        if (!Array.isArray(board)) board = [];
        board.push(entry);
        board.sort((a, b) => (b.score - a.score) || (a.time - b.time));
        board = board.slice(0, MAX_LEADERBOARD);
        writeJson(LB_FILE, board);
        sendJson(res, { ok: true, board }, cors);
      } catch (e) { sendJson(res, { ok: false, error: 'JSON 解析失败' }, cors, 400); }
    });
    return;
  }

  // 未知 API 返回 JSON 404，而不是回退到 index.html
  if (p.indexOf('/api/') === 0) return sendJson(res, { ok: false, error: '未知接口' }, cors, 404);

  // ---- 静态资源 ----
  const resolved = resolveStaticPath(p);
  if (resolved.forbidden) { res.writeHead(403); return res.end('Forbidden'); }
  if (resolved.notFound) { res.writeHead(404); return res.end('Not Found'); }
  const fp = resolved.fp;
  const ext = path.extname(fp).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
  });
  fs.createReadStream(fp).on('error', () => { try { res.destroy(); } catch (e) {} }).pipe(res);
}

let server = null;

function start() {
  fs.mkdirSync(SAVE_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  server = http.createServer(route);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log('');
      console.log('  [提示] 端口 ' + PORT + ' 已被占用。');
      console.log('  可能已有墨战服务器在运行，请直接访问 http://127.0.0.1:' + PORT);
      console.log('  或改用其他端口：set PORT=8000 && node server.js');
      console.log('');
      process.exit(1);
    }
    throw err;
  });
  server.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║  墨战 · 天书纪  INK-SAGA 服务器已启动    ║');
    console.log('  ║  请在浏览器打开：http://127.0.0.1:' + PORT + '  ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
  });
  process.on('SIGINT', () => shutdown('Ctrl+C'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  return server;
}

// 优雅关闭
function shutdown(sig) {
  console.log('');
  console.log('  [' + sig + '] 墨战服务器正在收笔……');
  if (!server) return process.exit(0);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

// 直接 `node server.js` 才监听端口；被 test/run.js require 时只导出纯函数，方便单测。
if (require.main === module) start();

module.exports = {
  PORT, PUBLIC, SAVE_DIR, REPORT_DIR, EXPORT_DIR, SAVE_FILE, LB_FILE, MIME, MAX_BODY, MAX_LEADERBOARD,
  loadData, buildPracticeSheet, readJson, writeJson, writeFileAtomic, clampCount, safeFilename,
  hasDangerousKeys, sanitizeSavePayload, sanitizeLeaderboardEntry, safeNumber, resolveStaticPath,
  sendJson, readBody, route, start, shutdown,
  getServer: () => server
};
