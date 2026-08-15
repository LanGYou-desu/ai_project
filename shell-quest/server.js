'use strict';
// 档案馆-7 · 服务器：静态页面 + 命令执行 API
const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateWorld, SEED } = require('./lib/worldgen');
const { createSession } = require('./lib/commands');
const { createGameState } = require('./lib/state');

const ROOT = __dirname;
const WORLD_DIR = path.join(ROOT, 'world');
const STATE_FILE = path.join(ROOT, 'state.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8767);
const NO_BROWSER = process.env.NO_BROWSER === '1' || process.argv.indexOf('--no-browser') >= 0;

if (process.argv.indexOf('--fresh') >= 0 || !fs.existsSync(WORLD_DIR)) {
  const res = generateWorld(WORLD_DIR, { seed: SEED });
  console.log('[world] 世界已生成：' + res.fileCount + ' 个真实文件');
}

const game = createGameState({ stateFile: STATE_FILE });
let session = createSession({
  root: WORLD_DIR,
  checkFlag: function (code) { return game.checkFlag(code); },
  getHint: function () { return game.getHint(); }
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve) {
    let d = '';
    req.on('data', function (c) { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', function () { resolve(d); });
    req.on('error', function () { resolve(''); });
  });
}

function safeJoin(base, rel) {
  const abs = path.resolve(base, '.' + path.sep + rel);
  const relCheck = path.relative(base, abs);
  if (relCheck === '' || relCheck.startsWith('..') || path.isAbsolute(relCheck)) return null;
  return abs;
}

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  try {
    if (req.method === 'POST' && p === '/api/exec') {
      let body = {};
      try { body = JSON.parse(await readBody(req) || '{}'); } catch (e) { body = {}; }
      const line = String(body.line || '');
      const result = session.exec(line);
      game.countCommand();
      sendJson(res, { output: result.output, code: result.code, cwd: result.cwd, state: game.getState() });
      return;
    }

    if (req.method === 'GET' && p === '/api/state') {
      sendJson(res, game.getState());
      return;
    }

    if (req.method === 'POST' && p === '/api/reset') {
      const fresh = url.searchParams.get('world') === '1';
      if (fresh) {
        generateWorld(WORLD_DIR, { seed: SEED });
        session = createSession({
          root: WORLD_DIR,
          checkFlag: function (code) { return game.checkFlag(code); },
          getHint: function () { return game.getHint(); }
        });
      }
      sendJson(res, { ok: true, state: game.reset() });
      return;
    }

    if (req.method === 'GET' && p === '/api/manifest') {
      const manifestPath = path.join(ROOT, '世界清单.json');
      if (fs.existsSync(manifestPath)) {
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        sendJson(res, { fileCount: m.fileCount, seed: m.seed });
      } else {
        sendJson(res, { fileCount: 0, seed: SEED });
      }
      return;
    }

    // 静态文件
    const rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
    const filePath = safeJoin(PUBLIC_DIR, rel);
    if (filePath === null) { res.writeHead(403); res.end('Forbidden'); return; }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404); res.end('Not Found'); return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.writeHead(500);
    res.end('Server error: ' + e.message);
  }
});

server.listen(PORT, function () {
  console.log('档案馆-7 已就绪：http://127.0.0.1:' + PORT);
  console.log('真实沙盒世界目录：' + WORLD_DIR);
  if (!NO_BROWSER) {
    try {
      require('child_process').spawn('cmd', ['/c', 'start', '', 'http://127.0.0.1:' + PORT], { detached: true, stdio: 'ignore' }).unref();
    } catch (e) { /* 忽略 */ }
  }
});
