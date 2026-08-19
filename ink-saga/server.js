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

// 加载浏览器端数据文件（dictionary.js 内含 UMD 导出，供 Node 端复用生成字帖）
function loadData() {
  const d = {};
  for (const name of ['dictionary', 'words']) {
    const p = path.join(PUBLIC, 'js', 'data', name + '.js');
    if (fs.existsSync(p)) {
      const m = { exports: {} };
      try {
        const code = fs.readFileSync(p, 'utf-8');
        // 数据文件把自身挂到 globalThis 并通过 module.exports 导出
        const fn = new Function('module', 'exports', 'require', code);
        fn(m, m.exports, require);
        d[name] = m.exports;
      } catch (e) { d[name] = null; }
    }
  }
  return d;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return fallback; }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// 生成一张练习字帖（真实文本，可另存/打印）
function buildPracticeSheet(dict, count) {
  const pool = (dict && dict.DICT) ? dict.DICT : [];
  if (!pool.length) return '# 字帖生成失败：词库为空';
  const chars = [];
  const used = new Set();
  while (chars.length < Math.min(count, pool.length)) {
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

function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }
  const cors = { 'Access-Control-Allow-Origin': '*' };

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
    const count = Math.min(parseInt(url.searchParams.get('count') || '10', 10) || 10, 60);
    const d = loadData();
    const sheet = buildPracticeSheet(d.dictionary, count);
    const fn = 'practice-' + Date.now() + '.txt';
    const fp = path.join(EXPORT_DIR, fn);
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    fs.writeFileSync(fp, sheet, 'utf-8');
    return sendJson(res, { ok: true, file: fn, path: fp, content: sheet }, cors);
  }

  // 保存玩家存档
  if (p === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        writeJson(SAVE_FILE, data);
        sendJson(res, { ok: true, savedAt: Date.now() }, cors);
      } catch (e) { sendJson(res, { ok: false, error: e.message }, cors, 400); }
    });
    return;
  }
  if (p === '/api/save' && req.method === 'GET') {
    return sendJson(res, { ok: true, save: readJson(SAVE_FILE, null) }, cors);
  }

  // 导出内容（报告/字帖/星图）到真实磁盘
  if (p === '/api/export' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const kind = data.kind === 'report' ? REPORT_DIR : EXPORT_DIR;
        fs.mkdirSync(kind, { recursive: true });
        const safe = String(data.filename || 'export-' + Date.now()).replace(/[^\w\u4e00-\u9fa5\-.]/g, '_');
        const fp = path.join(kind, safe);
        fs.writeFileSync(fp, String(data.content ?? ''), 'utf-8');
        sendJson(res, { ok: true, file: safe, path: fp }, cors);
      } catch (e) { sendJson(res, { ok: false, error: e.message }, cors, 400); }
    });
    return;
  }

  // 排行榜
  if (p === '/api/leaderboard' && req.method === 'GET') {
    let board = readJson(LB_FILE, []);
    const mode = url.searchParams.get('mode');
    const date = url.searchParams.get('date');
    if (mode) board = board.filter(b => b.mode === mode);
    if (date) board = board.filter(b => String(b.date) === String(date));
    return sendJson(res, { ok: true, board }, cors);
  }
  if (p === '/api/leaderboard' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const entry = JSON.parse(body || '{}');
        const board = readJson(LB_FILE, []);
        board.push({ name: String(entry.name || '无名书生').slice(0, 12), mode: entry.mode || 'endless', date: entry.date ? String(entry.date) : undefined, score: Number(entry.score) || 0, chars: Number(entry.chars) || 0, time: Date.now() });
        board.sort((a, b) => b.score - a.score);
        writeJson(LB_FILE, board.slice(0, 50));
        sendJson(res, { ok: true, board }, cors);
      } catch (e) { sendJson(res, { ok: false, error: e.message }, cors, 400); }
    });
    return;
  }

  // ---- 静态资源 ----
  const safePath = path.normalize(p).replace(/^(\\..\/|\/)+/g, '');
  let fp = path.join(PUBLIC, safePath);
  if (!fp.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(PUBLIC, 'index.html');
  if (!fs.existsSync(fp)) { res.writeHead(404); return res.end('Not Found'); }
  const ext = path.extname(fp).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
}

function sendJson(res, obj, cors, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
  res.end(JSON.stringify(obj));
}

fs.mkdirSync(SAVE_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.mkdirSync(EXPORT_DIR, { recursive: true });

const server = http.createServer(route);
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

// 优雅关闭
function shutdown(sig) {
  console.log('');
  console.log('  [' + sig + '] 墨战服务器正在收笔……');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', () => shutdown('Ctrl+C'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
