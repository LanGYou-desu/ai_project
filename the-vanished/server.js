'use strict';
// THE VANISHED · 服务器：真实时间线运行 + 真实 Windows 通知 + 真实证据文件
const http = require('http');
const fs = require('fs');
const path = require('path');
const { VanishedEngine } = require('./lib/engine');
const { notify } = require('./lib/notify');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const EVIDENCE_DIR = path.join(ROOT, 'evidence');
const STATE_FILE = path.join(ROOT, 'state.json');
const PORT = Number(process.env.PORT || 8768);
const NO_BROWSER = process.env.NO_BROWSER === '1' || process.argv.indexOf('--no-browser') >= 0;
const SPEED = Number(process.env.VANISHED_SPEED || 1);

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

// 证据写入钩子：生成真实文件
function writeEvidence(ev) {
  try {
    const abs = path.join(EVIDENCE_DIR, ev.file);
    const content = Array.isArray(ev.content) ? ev.content.join('\r\n') + '\r\n' : String(ev.content);
    fs.writeFileSync(abs, content, 'utf8');
    return abs;
  } catch (e) {
    return null;
  }
}

const engine = new VanishedEngine({
  stateFile: STATE_FILE,
  hooks: {
    writeEvidence: writeEvidence,
    toast: function (ev) { notify(ev.title, ev.text); },
    onEnding: function (ending, score) { notify('THE VANISHED · ' + ending, '注意力 ' + score + ' 分。打开页面查看结局。'); }
  }
});

if (SPEED !== 1) engine.setSpeed(SPEED);

// 每秒推进时间线
setInterval(function () { engine.tick(); }, 1000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
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
    if (req.method === 'GET' && p === '/api/state') {
      engine.tick();
      sendJson(res, engine.getState());
      return;
    }
    if (req.method === 'POST' && p === '/api/answer') {
      let body = {};
      try { body = JSON.parse(await readBody(req) || '{}'); } catch (e) { body = {}; }
      sendJson(res, engine.answerCheckpoint(String(body.cid || ''), String(body.option || '')));
      return;
    }
    if (req.method === 'POST' && p === '/api/view') {
      let body = {};
      try { body = JSON.parse(await readBody(req) || '{}'); } catch (e) { body = {}; }
      const file = String(body.file || '');
      const result = engine.viewEvidence(file);
      // 返回证据内容
      const abs = safeJoin(EVIDENCE_DIR, file);
      let content = null;
      if (abs && fs.existsSync(abs)) content = fs.readFileSync(abs, 'utf8');
      sendJson(res, { ok: result.ok, already: result.already, score: result.score, content: content });
      return;
    }
    if (req.method === 'POST' && p === '/api/speed') {
      let body = {};
      try { body = JSON.parse(await readBody(req) || '{}'); } catch (e) { body = {}; }
      engine.setSpeed(Number(body.speed) || 1);
      sendJson(res, { ok: true, speed: engine.state.speed });
      return;
    }
    if (req.method === 'POST' && p === '/api/restart') {
      const fresh = url.searchParams.get('fresh') === '1';
      if (fresh) {
        try { fs.rmSync(EVIDENCE_DIR, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
        fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
      }
      sendJson(res, { ok: true, state: engine.restart() });
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
  console.log('THE VANISHED 已启动：http://127.0.0.1:' + PORT);
  console.log('真实证据文件目录：' + EVIDENCE_DIR);
  console.log('时间线约 ' + Math.round(engine.getState().totalSeconds / 60) + ' 分钟（倍速 ' + engine.state.speed + 'x）');
  if (!NO_BROWSER) {
    try {
      require('child_process').spawn('cmd', ['/c', 'start', '', 'http://127.0.0.1:' + PORT], { detached: true, stdio: 'ignore' }).unref();
    } catch (e) { /* 忽略 */ }
  }
});
