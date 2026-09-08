'use strict';
// THE VANISHED · 服务器：真实时间线运行 + 真实 Windows 通知 + 真实证据文件
const http = require('http');
const fs = require('fs');
const path = require('path');
const { VanishedEngine } = require('./lib/engine');
const { notify } = require('./lib/notify');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
// 数据目录：默认项目根目录（evidence/ 与 state.json），可用 VANISHED_DATA_DIR 重定向（测试 / 多开）
const DATA_DIR = path.resolve(process.env.VANISHED_DATA_DIR || ROOT);
const EVIDENCE_DIR = path.join(DATA_DIR, 'evidence');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const HOST = process.env.HOST || '127.0.0.1';   // 只监听本机，避免局域网内他人触发 /api/restart
const PORT = parsePort(process.env.PORT);
const NO_BROWSER = process.env.NO_BROWSER === '1' || process.argv.indexOf('--no-browser') >= 0;
const SPEED = Number(process.env.VANISHED_SPEED || 1);
const MAX_BODY = 64 * 1024;                     // 请求体上限 64 KB
const TICK_MS = 1000;

function parsePort(v) {
  if (v === undefined || v === null || v === '') return 8768;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    console.warn('[server] PORT 无效（' + v + '），回退到 8768');
    return 8768;
  }
  return n;
}

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

// 把相对路径限制在 base 目录内；越界返回 null
function safeJoin(base, rel) {
  const abs = path.resolve(base, '.' + path.sep + rel);
  const relCheck = path.relative(base, abs);
  if (relCheck === '' || relCheck.startsWith('..') || path.isAbsolute(relCheck)) return null;
  return abs;
}

// 证据写入钩子：生成真实文件（路径限制在 evidence/ 内，写入用临时文件 + 原子替换）
function writeEvidence(ev) {
  try {
    const abs = safeJoin(EVIDENCE_DIR, String(ev.file || ''));
    if (!abs) {
      console.warn('[evidence] 拒绝越界写入：' + ev.file);
      return null;
    }
    const content = Array.isArray(ev.content) ? ev.content.join('\r\n') + '\r\n' : String(ev.content);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const tmp = abs + '.tmp';
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, abs);
    return abs;
  } catch (e) {
    console.warn('[evidence] 写入失败：' + e.message);
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

// 每秒推进时间线（单个定时器；tick 异常不会杀掉服务器）
const tickTimer = setInterval(function () {
  try { engine.tick(); } catch (e) { console.warn('[engine] tick 失败：' + e.message); }
}, TICK_MS);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff' };

function sendJson(res, obj, status) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(status || 200, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }, SECURITY_HEADERS));
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SECURITY_HEADERS));
  res.end(text);
}

// 读取请求体：超过 limit 就不再缓存（但仍把数据读干净，以便回一个正常的 413，
// 而不是把连接重置掉或让请求永远挂着）；超过 HARD_CAP 直接断开。
function readBody(req, limit) {
  const hardCap = limit * 32;
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    let discarded = 0;
    let overflow = false;
    let done = false;
    function finish(fn, arg) {
      if (done) return;
      done = true;
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      req.removeListener('aborted', onAborted);
      fn(arg);
    }
    function tooLarge() {
      const err = new Error('请求体过大（上限 ' + limit + ' 字节）');
      err.statusCode = 413;
      return err;
    }
    function onData(c) {
      if (overflow) {
        discarded += c.length;
        if (discarded > hardCap) finish(reject, tooLarge());
        return;
      }
      size += c.length;
      if (size > limit) {
        overflow = true;
        chunks.length = 0;
        return;
      }
      chunks.push(c);
    }
    function onEnd() {
      if (overflow) { finish(reject, tooLarge()); return; }
      finish(resolve, Buffer.concat(chunks).toString('utf8'));
    }
    function onError(e) { finish(reject, e); }
    function onAborted() { finish(reject, new Error('连接已中断')); }
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('aborted', onAborted);
  });
}

async function readJson(req) {
  const text = await readBody(req, MAX_BODY);
  if (!text) return {};
  const data = JSON.parse(text);          // 非法 JSON → 抛出，由上层返回 400
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    const err = new Error('请求体必须是 JSON 对象');
    err.statusCode = 400;
    throw err;
  }
  return data;
}

// 只有能带自定义 Content-Type 的请求才允许改动状态：
// 跨站 <form> 无法发送 application/json，因此可挡住对 localhost 的 CSRF 式表单提交
function requireJson(req, res) {
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (ct.indexOf('application/json') < 0) {
    sendJson(res, { ok: false, message: 'Content-Type 必须是 application/json' }, 415);
    return false;
  }
  return true;
}

async function handle(req, res) {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch (e) {
    // 畸形请求行（例如绝对形式且端口非法）不能让进程崩溃
    sendText(res, 400, 'Bad Request');
    return;
  }
  const p = url.pathname;
  try {
    if (req.method === 'GET' && p === '/api/state') {
      engine.tick();
      sendJson(res, engine.getState());
      return;
    }
    if (req.method === 'POST' && p === '/api/answer') {
      if (!requireJson(req, res)) return;
      const body = await readJson(req);
      const result = engine.answerCheckpoint(String(body.cid || ''), String(body.option || ''));
      sendJson(res, result, result.ok ? 200 : 400);
      return;
    }
    if (req.method === 'POST' && p === '/api/view') {
      if (!requireJson(req, res)) return;
      const body = await readJson(req);
      const file = String(body.file || '');
      const result = engine.viewEvidence(file);
      let content = null;
      if (result.ok) {
        const abs = safeJoin(EVIDENCE_DIR, file);
        if (abs) {
          try { content = fs.readFileSync(abs, 'utf8'); } catch (e) { content = null; }
        }
      }
      sendJson(res, { ok: result.ok, already: result.already, score: result.score, content: content, message: result.message });
      return;
    }
    if (req.method === 'POST' && p === '/api/speed') {
      if (!requireJson(req, res)) return;
      const body = await readJson(req);
      const n = Number(body.speed);
      if (!isFinite(n)) { sendJson(res, { ok: false, message: 'speed 必须是数字' }, 400); return; }
      sendJson(res, { ok: true, speed: engine.setSpeed(n) });
      return;
    }
    if (req.method === 'POST' && p === '/api/restart') {
      if (!requireJson(req, res)) return;
      const fresh = url.searchParams.get('fresh') === '1';
      if (fresh) {
        // EVIDENCE_DIR 由 DATA_DIR 推导而来，只会删掉证据目录本身
        try { fs.rmSync(EVIDENCE_DIR, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
        fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
      }
      sendJson(res, { ok: true, state: engine.restart() });
      return;
    }
    if (p.startsWith('/api/')) { sendJson(res, { ok: false, message: '未知接口' }, 404); return; }

    // 静态文件
    const rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
    const filePath = safeJoin(PUBLIC_DIR, rel);
    if (filePath === null) { sendText(res, 403, 'Forbidden'); return; }
    let stat = null;
    try { stat = fs.statSync(filePath); } catch (e) { stat = null; }
    if (!stat || !stat.isFile()) { sendText(res, 404, 'Not Found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, Object.assign({
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size
    }, SECURITY_HEADERS));
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    const status = e && e.statusCode ? e.statusCode : 500;
    if (status === 413) {
      // 请求体已被读干净，可以正常回 413（保持连接可写，避免客户端只看到 ECONNRESET）
      res.writeHead(413, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SECURITY_HEADERS));
      res.end('Payload Too Large');
      return;
    }
    if (res.headersSent) { try { res.destroy(); } catch (err) { /* 忽略 */ } return; }
    sendJson(res, { ok: false, message: e && e.message ? e.message : 'Server error' }, status);
  }
}

const server = http.createServer(function (req, res) {
  // handle 自身已捕获所有异常；这里再兜一层，确保任何情况都不会产生未处理的 rejection
  handle(req, res).catch(function (e) {
    if (!res.headersSent) sendJson(res, { ok: false, message: e && e.message ? e.message : 'Server error' }, 500);
    else { try { res.destroy(); } catch (err) { /* 忽略 */ } }
  });
});

// 客户端发来的畸形报文：回 400 而不是抛异常
server.on('clientError', function (err, socket) {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  else socket.destroy();
});

function openBrowser(url) {
  try {
    const { spawn } = require('child_process');
    let cmd = 'cmd';
    let args = ['/c', 'start', '', url];
    if (process.platform === 'darwin') { cmd = 'open'; args = [url]; }
    else if (process.platform !== 'win32') { cmd = 'xdg-open'; args = [url]; }
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  } catch (e) { /* 打不开浏览器不影响服务器 */ }
}

function shutdown(signal) {
  console.log('\n[server] 收到 ' + signal + '，保存进度并退出…');
  clearInterval(tickTimer);
  try { engine.save(); } catch (e) { /* 忽略 */ }
  server.close(function () { process.exit(0); });
  // 兜底：连接没关干净也要退出
  setTimeout(function () { process.exit(0); }, 1000).unref();
}

process.on('SIGINT', function () { shutdown('SIGINT'); });
process.on('SIGTERM', function () { shutdown('SIGTERM'); });

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.error('[server] 端口 ' + PORT + ' 已被占用：可能已经有一个 THE VANISHED 在运行。');
    console.error('[server] 请关闭它，或用 PORT=其它端口 重新启动。');
  } else {
    console.error('[server] 启动失败：' + e.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, function () {
  const addr = server.address();
  const port = addr && typeof addr === 'object' ? addr.port : PORT;
  console.log('THE VANISHED 已启动：http://' + HOST + ':' + port);
  console.log('真实证据文件目录：' + EVIDENCE_DIR);
  let total = 0;
  try { total = engine.getState().totalSeconds; } catch (e) { total = 0; }
  console.log('时间线约 ' + Math.round(total / 60) + ' 分钟（倍速 ' + engine.state.speed + 'x）');
  if (!NO_BROWSER) openBrowser('http://' + HOST + ':' + port);
});
