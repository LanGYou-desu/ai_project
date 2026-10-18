'use strict';
// 档案馆-7 · 服务器：静态页面 + 命令执行 API
const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateWorld, worldIsStale, SEED, WORLD_VERSION } = require('./lib/worldgen');
const { createSession } = require('./lib/commands');
const { createGameState } = require('./lib/state');
const { makeRootGuard } = require('./lib/paths');

const ROOT = __dirname;
const WORLD_DIR = path.resolve(process.env.WORLD_DIR || path.join(ROOT, 'world'));
const STATE_FILE = path.resolve(process.env.STATE_FILE || path.join(ROOT, 'state.json'));
const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR || path.join(ROOT, 'public'));
const MANIFEST_FILE = path.join(path.dirname(WORLD_DIR), '世界清单.json');
const PORT = Number(process.env.PORT || 8767);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  console.error('[server] PORT 不合法：' + process.env.PORT);
  process.exit(1);
}
const HOST = process.env.HOST || '127.0.0.1';
const LOOPBACK_ONLY = HOST === '127.0.0.1' || HOST === 'localhost' || HOST === '::1';
const FRESH = process.argv.indexOf('--fresh') >= 0;
const NO_BROWSER = process.env.NO_BROWSER === '1' || process.argv.indexOf('--no-browser') >= 0;
const MAX_BODY = 1024 * 1024;
const MAX_LINE = 10000;

const publicGuard = makeRootGuard(PUBLIC_DIR);

function ensureWorld(force) {
  if (!force && !worldIsStale(WORLD_DIR, { seed: SEED })) return false;
  try {
    const res = generateWorld(WORLD_DIR, { seed: SEED });
    console.log('[world] 世界已生成：' + res.diskFileCount + ' 个磁盘文件（含 tar 内条目共 ' + res.fileCount + ' 个内容单元）');
    return true;
  } catch (e) {
    console.error('[world] 生成失败：' + e.message);
    process.exit(1);
  }
}

ensureWorld(FRESH);

const game = createGameState({ stateFile: STATE_FILE });
if (FRESH) game.reset();

function newSession() {
  return createSession({
    root: WORLD_DIR,
    checkFlag: function (code) { return game.checkFlag(code); },
    getHint: function () { return game.getHint(); }
  });
}
let session = newSession();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, obj, status) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(status || 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, { error: message }, status);
}

function readBody(req) {
  return new Promise(function (resolve) {
    let chunks = [];
    let size = 0;
    let tooLarge = false;
    let done = false;
    function finish() {
      if (done) return;
      done = true;
      resolve({ text: tooLarge ? '' : Buffer.concat(chunks).toString('utf8'), tooLarge: tooLarge });
    }
    req.on('data', function (c) {
      if (done) return;
      size += c.length;
      if (size > MAX_BODY) { tooLarge = true; chunks = []; return; }
      chunks.push(c);
    });
    req.on('end', finish);
    req.on('error', finish);
    req.on('close', finish);
  });
}

function isTrustedHost(req) {
  if (!LOOPBACK_ONLY) return true;
  const host = String(req.headers.host || '');
  return /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host);
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; }
  catch (e) { return false; }
}

function isJson(req) {
  return String(req.headers['content-type'] || '').toLowerCase().indexOf('application/json') >= 0;
}

const server = http.createServer(async function (req, res) {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }
  const p = url.pathname;

  try {
    if (p.indexOf('/api/') === 0) {
      if (!isTrustedHost(req)) { sendError(res, 403, '拒绝访问：Host 不合法'); return; }
      if (!isSameOrigin(req)) { sendError(res, 403, '拒绝跨站请求'); return; }
      if (req.method === 'POST' && !isJson(req)) { sendError(res, 415, '需要 application/json'); return; }
    }

    if (req.method === 'POST' && p === '/api/exec') {
      const body = await readBody(req);
      if (body.tooLarge) { sendError(res, 413, '请求体过大（上限 ' + MAX_BODY + ' 字节）'); return; }
      let parsed = {};
      try { parsed = JSON.parse(body.text || '{}'); } catch (e) { parsed = {}; }
      const line = typeof parsed.line === 'string' ? parsed.line : String(parsed.line || '');
      if (line.length > MAX_LINE) { sendError(res, 413, '命令过长（上限 ' + MAX_LINE + ' 字符）'); return; }
      const result = session.exec(line);
      if (line.trim() !== '') game.countCommand();
      sendJson(res, { output: result.output, code: result.code, cwd: result.cwd, state: game.getState() });
      return;
    }

    if (req.method === 'GET' && p === '/api/state') {
      sendJson(res, game.getState());
      return;
    }

    if (req.method === 'POST' && p === '/api/reset') {
      const fresh = url.searchParams.get('world') === '1';
      if (fresh) ensureWorld(true);
      session = newSession();
      sendJson(res, { ok: true, state: game.reset() });
      return;
    }

    if (req.method === 'GET' && p === '/api/manifest') {
      try {
        const m = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
        sendJson(res, { version: m.version, seed: m.seed, fileCount: m.fileCount, diskFileCount: m.diskFileCount });
      } catch (e) {
        sendJson(res, { version: WORLD_VERSION, seed: SEED, fileCount: 0, diskFileCount: 0 });
      }
      return;
    }

    // 静态文件：限定在 public/ 内，并做 realpath 边界检查
    const rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
    const filePath = publicGuard.join(rel);
    if (filePath === null) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    let st = null;
    try { st = fs.statSync(filePath); } catch (e) { st = null; }
    if (!st || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    const stream = fs.createReadStream(filePath);
    stream.on('error', function () { try { res.destroy(); } catch (e) { /* 忽略 */ } });
    stream.pipe(res);
  } catch (e) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Server error: ' + e.message);
  }
});

if ('requestTimeout' in server) server.requestTimeout = 30000;
if ('headersTimeout' in server) server.headersTimeout = 20000;
if ('keepAliveTimeout' in server) server.keepAliveTimeout = 5000;

server.on('error', function (e) {
  console.error('[server] 启动失败：' + e.message);
  process.exit(1);
});

server.listen(PORT, HOST, function () {
  const addr = server.address();
  const actualPort = addr && typeof addr === 'object' ? addr.port : PORT;
  const openHost = (HOST === '0.0.0.0' || HOST === '::') ? '127.0.0.1' : (HOST === '::1' ? '[::1]' : HOST);
  const url = 'http://' + openHost + ':' + actualPort;
  console.log('档案馆-7 已就绪：' + url);
  console.log('真实沙盒世界目录：' + WORLD_DIR);
  if (!NO_BROWSER) {
    try {
      require('child_process').spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } catch (e) { /* 忽略 */ }
  }
});
