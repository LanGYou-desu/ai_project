/* 星海邮局 · STELLAR POST — 本地服务器
 * 静态站 + 星信接口，零第三方依赖（只用 Node 内置模块）。
 *
 * 用法:
 *   node server.js                启动并自动打开浏览器
 *   node server.js --no-open      只启动服务
 *   node server.js --port 8080    指定端口（默认 5177）
 *
 * 服务只监听 127.0.0.1；星信保存在 data/wishes.json。
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const WISH_FILE = path.join(DATA_DIR, 'wishes.json');

const MAX_TEXT = 80;
const MAX_WISHES = 400;
const RATE_MS = 12000;
const BODY_LIMIT = 16 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

/* ---------------- 参数 ---------------- */

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  const v = process.argv[i + 1];
  return v && v[0] !== '-' ? v : null;
}

const PORT = Number(process.env.PORT || argValue('--port') || 5177);
const HOST = process.env.HOST || '127.0.0.1';

/* ---------------- 数据 ---------------- */

function readWishes() {
  try {
    const raw = fs.readFileSync(WISH_FILE, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((w) => w && typeof w.t === 'string' && w.t.trim())
      .map((w) => ({ id: String(w.id || ''), t: String(w.t), ts: Number(w.ts) || 0 }));
  } catch (err) {
    return [];
  }
}

function writeWishes(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = WISH_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 4), 'utf8');
  fs.renameSync(tmp, WISH_FILE);
}

/* ---------------- 星图坐标（与浏览器端同一算法） ---------------- */

function hash31(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33 + str.charCodeAt(i)) % 2147483647;
  return h;
}

function wishPos(id) {
  return {
    x: 5 + (hash31(id + '|x') % 900) / 10,
    y: 10 + (hash31(id + '|y') % 760) / 10
  };
}

function wishDelay(id) {
  return (hash31(id + '|d') % 300) / 100;
}

function esc(s) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(s).replace(/[&<>"']/g, (c) => map[c]);
}

function fmtDate(ts) {
  const d = new Date(ts * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
}

function renderStars(list) {
  return list.slice().reverse().map((w) => {
    const pos = wishPos(w.id);
    const delay = wishDelay(w.id);
    return [
      '      <button class="wish" type="button"',
      '              style="--x:' + pos.x.toFixed(2) + '%;--y:' + pos.y.toFixed(2) + '%;--delay:' + delay.toFixed(2) + 's"',
      '              aria-label="星信：' + esc(w.t) + '">',
      '        <span class="wish-dot"></span>',
      '        <span class="wish-card" aria-hidden="true">',
      '          <span class="wish-text">' + esc(w.t) + '</span>',
      '          <span class="wish-meta">' + esc(w.ts ? fmtDate(w.ts) : '') + '</span>',
      '        </span>',
      '      </button>'
    ].join('\n');
  }).join('\n');
}

function renderIndex() {
  const template = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const list = readWishes();
  const stars = renderStars(list);
  const empty = list.length
    ? '      <div class="empty-state" hidden>还没有人投递，<a href="#post">成为第一颗星</a>。</div>'
    : '      <div class="empty-state">还没有人投递，<a href="#post">成为第一颗星</a>。</div>';

  return template
    .replace('<!--WISH_STARS-->', () => stars)
    .replace('<!--WISH_EMPTY-->', () => empty)
    .replace(/<!--WISH_COUNT-->/g, String(list.length));
}

/* ---------------- HTTP 工具 ---------------- */

function send(res, status, body, headers) {
  const base = { 'X-Content-Type-Options': 'nosniff' };
  res.writeHead(status, Object.assign(base, headers || {}));
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
}

function notFound(res) {
  send(res, 404, '<!doctype html><meta charset="utf-8"><title>404</title>' +
    '<body style="background:#05060c;color:#98a0c0;font:16px/1.8 system-ui;padding:12vh 10vw">' +
    '<h1 style="color:#e9ecff">404 · 这里没有星星</h1><p><a href="/" style="color:#63e8ff">回到星海邮局</a></p></body>',
    { 'Content-Type': 'text/html; charset=utf-8' });
}

/* 只对外暴露页面与 assets/，源码、数据、脚本一律不可直接访问 */
function isPublicPath(rel) {
  if (rel === 'index.html') return true;
  return rel.indexOf('assets/') === 0 && rel.indexOf('..') === -1;
}

function serveStatic(res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch (err) {
    return notFound(res);
  }
  if (!isPublicPath(rel)) return notFound(res);

  const file = path.resolve(ROOT, rel);
  if (file.indexOf(path.resolve(ROOT) + path.sep) !== 0) return notFound(res);

  fs.readFile(file, (err, buf) => {
    if (err) return notFound(res);
    const ext = path.extname(file).toLowerCase();
    send(res, 200, buf, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
  });
}

/* ---------------- 投递接口 ---------------- */

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const lastPost = new Map();

function rateOk(ip) {
  const now = Date.now();
  const prev = lastPost.get(ip) || 0;
  if (now - prev < RATE_MS) return false;
  lastPost.set(ip, now);
  if (lastPost.size > 5000) lastPost.clear();
  return true;
}

function fail(res, isJson, status, message) {
  if (isJson) return sendJson(res, status, { ok: false, error: message });
  res.writeHead(302, { Location: '/?err=1#post', 'Cache-Control': 'no-store' });
  res.end();
}

async function handleWishPost(req, res) {
  const ctype = String(req.headers['content-type'] || '');
  const isJson = ctype.indexOf('application/json') !== -1;

  let text = '';
  try {
    const body = await readBody(req);
    if (isJson) {
      const parsed = JSON.parse(body.toString('utf8') || '{}');
      text = parsed && typeof parsed.text === 'string' ? parsed.text : '';
    } else {
      text = new URLSearchParams(body.toString('utf8')).get('text') || '';
    }
  } catch (err) {
    return fail(res, isJson, 400, '请求内容解析失败');
  }

  text = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return fail(res, isJson, 400, '总得写点什么吧');
  if (Array.from(text).length > MAX_TEXT) return fail(res, isJson, 400, '最多 80 个字');

  const ip = req.socket.remoteAddress || '0.0.0.0';
  if (!rateOk(ip)) return fail(res, isJson, 429, '刚投递过，歇 12 秒再来');

  const wish = {
    id: 'w' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'),
    t: text,
    ts: Math.floor(Date.now() / 1000)
  };

  const list = readWishes();
  list.push(wish);
  const trimmed = list.slice(-MAX_WISHES);
  writeWishes(trimmed);

  if (!isJson) {
    res.writeHead(302, { Location: '/?sent=1#constellation', 'Cache-Control': 'no-store' });
    return res.end();
  }

  sendJson(res, 201, { ok: true, wish: wish, count: trimmed.length });
}

/* ---------------- 路由 ---------------- */

function handleRequest(req, res) {
  let pathname = '/';
  try {
    pathname = new URL(req.url, 'http://' + HOST).pathname;
  } catch (err) {
    return notFound(res);
  }

  if (pathname === '/api/wishes' || pathname === '/api/wishes/') {
    if (req.method === 'GET') {
      const list = readWishes();
      return sendJson(res, 200, { ok: true, count: list.length, wishes: list.slice(-120) });
    }
    if (req.method === 'POST') return handleWishPost(req, res);
    res.writeHead(405, { Allow: 'GET, POST' });
    return res.end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (pathname === '/' || pathname === '/index.html') {
    return send(res, 200, renderIndex(), {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    });
  }

  return serveStatic(res, pathname);
}

/* ---------------- 启动 ---------------- */

function openBrowser(port) {
  if (process.env.NO_OPEN === '1' || process.argv.indexOf('--no-open') !== -1) return;
  const url = 'http://127.0.0.1:' + port + '/';
  try {
    if (process.platform === 'win32') {
      spawn('explorer.exe', [url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (err) {
    /* 打不开浏览器不影响服务 */
  }
}

function banner(port) {
  console.log('');
  console.log('  ==========================================');
  console.log('   星海邮局 · STELLAR POST');
  console.log('  ==========================================');
  console.log('   地址   http://127.0.0.1:' + port + '/');
  console.log('   数据   data/wishes.json');
  console.log('   停止   Ctrl + C');
  console.log('');
}

let tries = 0;

function start(port) {
  const srv = http.createServer(handleRequest);

  srv.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && tries < 10) {
      tries += 1;
      console.log('端口 ' + port + ' 被占用，尝试 ' + (port + 1) + ' ...');
      return start(port + 1);
    }
    console.error('启动失败：' + err.message);
    process.exit(1);
  });

  srv.listen(port, HOST, () => {
    banner(port);
    openBrowser(port);
  });
}

process.on('SIGINT', () => {
  console.log('\n  星海邮局已关闭，愿你的愿望都能抵达。\n');
  process.exit(0);
});

start(PORT);
