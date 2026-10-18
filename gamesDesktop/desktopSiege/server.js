'use strict';
// DESKTOP SIEGE · 服务器：真实磁盘扫描 + 波次生成 + 静态资源
const http = require('http');
const fs = require('fs');
const path = require('path');
const { scan, defaultProfileDirs, readCache, normalizeResult } = require('./lib/scanner');
const { generateWaves } = require('./lib/waves');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const CACHE_FILE = path.join(ROOT, 'scan-cache.json');
const PORT = Number(process.env.PORT || 8769);
const NO_BROWSER = process.env.NO_BROWSER === '1' || process.argv.indexOf('--no-browser') >= 0;
const FORCE_FRESH = process.argv.indexOf('--fresh') >= 0 || process.env.DS_FRESH === '1';
const SEED = Number(process.env.DS_SEED || 20810719);
// 缓存有效期：超过就重新扫描磁盘。DS_CACHE_TTL_MS=0 表示缓存永不过期；负数表示禁用缓存。
const CACHE_TTL_MS = process.env.DS_CACHE_TTL_MS !== undefined
  ? Number(process.env.DS_CACHE_TTL_MS)
  : 6 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 64 * 1024;
const TOTAL_WAVES = 20;

const FALLBACK_SCAN = {
  files: [{ name: '桌面文件', ext: 'txt', size: 1024, dir: 'Desktop' }],
  processes: ['explorer', 'svchost', 'node'],
  largest: { name: '桌面文件', ext: 'txt', size: 1024, dir: 'Desktop' },
  largestDoc: null, largestMedia: null, largestArchive: null,
  counts: { total: 1, processes: 3, byExt: { txt: 1 } },
  scannedAt: 0
};

let scanData = null;
let waves = [];

function loadCache(allowStale) {
  // 先试「未过期缓存」，再试「任何缓存」（磁盘扫描失败时的兜底）
  const fresh = readCache(CACHE_FILE, CACHE_TTL_MS);
  if (fresh) return fresh;
  if (allowStale === false) return null;
  return readCache(CACHE_FILE, 0); // 0 = 忽略时效
}

function doScan(opts) {
  opts = opts || {};
  const force = opts.force === true;
  if (!force && CACHE_TTL_MS >= 0) {
    const cached = loadCache(true);
    if (cached) {
      scanData = cached;
      console.log('[scan] 使用缓存：' + cached.files.length + ' 个文件，' + cached.processes.length + ' 个进程');
      return scanData;
    }
  }
  try {
    scanData = scan({
      dirs: defaultProfileDirs(),
      maxDepth: 2,
      cap: 3000,
      cacheFile: CACHE_FILE
    });
    console.log('[scan] 扫描完成：' + scanData.files.length + ' 个文件，' + scanData.processes.length + ' 个进程');
  } catch (e) {
    console.log('[scan] 扫描失败（' + e.message + '），尝试使用缓存/默认数据');
    scanData = loadCache(true) || normalizeResult(FALLBACK_SCAN);
  }
  return scanData;
}

function rebuildWaves() {
  try {
    waves = generateWaves(scanData, { seed: SEED, totalWaves: TOTAL_WAVES });
  } catch (e) {
    console.log('[waves] 波次生成失败（' + e.message + '），改用默认扫描数据');
    scanData = normalizeResult(FALLBACK_SCAN);
    waves = generateWaves(scanData, { seed: SEED, totalWaves: TOTAL_WAVES });
  }
}

doScan({ force: FORCE_FRESH });
rebuildWaves();

function scanSummary() {
  const data = normalizeResult(scanData);
  const files = data.files;
  const byDir = Object.create(null);
  for (const f of files) {
    const d = f.dir || '未知';
    byDir[d] = (byDir[d] || 0) + 1;
  }
  const topDirs = Object.keys(byDir).sort((a, b) => byDir[b] - byDir[a]).slice(0, 5)
    .map(d => ({ dir: d, count: byDir[d] }));
  const exts = Object.keys(data.counts.byExt || {}).slice(0, 12);
  const pool = files.map(f => f.name + '.' + f.ext);
  return {
    total: files.length,
    processes: data.processes.length,
    topDirs: topDirs,
    topExts: exts,
    largest: data.largest ? { name: data.largest.name + '.' + data.largest.ext, size: data.largest.size } : null,
    sampleNames: pool.slice(0, 12),
    sampleProcesses: data.processes.slice(0, 12),
    waves: waves.length,
    seed: SEED,
    scannedAt: data.scannedAt
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// 可被浏览器直接加载的 lib 脚本白名单（不要放开成任意路径）
const LIB_SCRIPTS = new Set(['rng.js', 'engine.js', 'waves.js']);

function sendJson(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': body.length,
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function sendText(res, status, text) {
  const body = Buffer.from(String(text), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function safeJoin(base, rel) {
  const abs = path.resolve(base, '.' + path.sep + rel);
  const relCheck = path.relative(base, abs);
  if (relCheck === '' || relCheck.startsWith('..') || path.isAbsolute(relCheck)) return null;
  return abs;
}

// 解析真实路径，拒绝符号链接把静态目录「引出」public/ 之外
function resolveStatic(base, rel) {
  const abs = safeJoin(base, rel);
  if (!abs) return null;
  let real;
  try { real = fs.realpathSync(abs); } catch (e) { return null; }
  const relCheck = path.relative(base, real);
  if (relCheck === '' || relCheck.startsWith('..') || path.isAbsolute(relCheck)) return null;
  let st;
  try { st = fs.statSync(real); } catch (e) { return null; }
  if (!st.isFile()) return null;
  return real;
}

// 读请求体：超过上限就回 413 并断开，不再把大包读进内存
function readBody(req, limit, res) {
  return new Promise(function (resolve) {
    const declared = Number(req.headers['content-length'] || 0);
    let done = false;
    let size = 0;
    const reject = function () {
      if (done) return;
      done = true;
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      // 丢弃后续数据，尽快释放连接
      req.on('data', function () { /* discard */ });
      sendJson(res, 413, { error: 'request body too large (limit ' + limit + ' bytes)' });
      if (req.socket && req.socket.writable) req.socket.end();
      resolve(false);
    };
    const accept = function () {
      if (done) return;
      done = true;
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      resolve(true);
    };
    if (declared > limit) { reject(); return; }
    function onData(chunk) {
      size += chunk.length;
      if (size > limit) reject();
    }
    function onEnd() { accept(); }
    function onError() { accept(); }
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('aborted', onError);
  });
}

function serveStatic(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const head = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  };
  if (req.method === 'HEAD') {
    let size = 0;
    try { size = fs.statSync(filePath).size; } catch (e) { size = 0; }
    head['Content-Length'] = size;
    res.writeHead(200, head);
    res.end();
    return;
  }
  res.writeHead(200, head);
  const stream = fs.createReadStream(filePath);
  stream.on('error', function () {
    if (!res.headersSent) sendText(res, 500, 'Server error');
    else res.destroy();
  });
  stream.pipe(res);
}

const server = http.createServer(function (req, res) {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch (e) {
    sendText(res, 400, 'Bad Request');
    return;
  }
  const p = url.pathname;
  const isApi = p.indexOf('/api/') === 0;

  // 所有请求先消费请求体（含上限），保证连接可复用
  readBody(req, MAX_BODY_BYTES, res).then(function (bodyOk) {
    if (!bodyOk) return; // 413 已由 readBody 发出
    try {
      if (isApi) {
        if (p === '/api/scan' && req.method === 'GET') { sendJson(res, 200, scanSummary()); return; }
        if (p === '/api/waves' && req.method === 'GET') {
          const data = normalizeResult(scanData);
          sendJson(res, 200, {
            waves: waves,
            scan: scanSummary(),
            scanData: {
              files: data.files.map(f => ({ name: f.name, ext: f.ext, dir: f.dir })),
              processes: data.processes.slice(0, 150),
              largest: data.largest,
              largestDoc: data.largestDoc,
              largestMedia: data.largestMedia,
              largestArchive: data.largestArchive
            },
            seed: SEED,
            arena: { w: 1600, h: 1000 }
          });
          return;
        }
        if (p === '/api/rescan') {
          if (req.method !== 'POST') { sendJson(res, 405, { error: 'method not allowed' }); return; }
          doScan({ force: true });
          rebuildWaves();
          sendJson(res, 200, { ok: true, scan: scanSummary() });
          return;
        }
        sendJson(res, 404, { error: 'not found' });
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendText(res, 405, 'Method Not Allowed');
        return;
      }
      // 静态文件（public 下）
      const rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
      const filePath = resolveStatic(PUBLIC_DIR, rel);
      if (filePath) { serveStatic(req, res, filePath); return; }
      // lib 下的脚本（白名单）
      const libName = p.indexOf('/lib/') === 0 ? path.basename(p) : '';
      if (libName && LIB_SCRIPTS.has(libName)) {
        const libPath = path.join(ROOT, 'lib', libName);
        if (fs.existsSync(libPath)) { serveStatic(req, res, libPath); return; }
      }
      sendText(res, 404, 'Not Found');
    } catch (e) {
      if (!res.headersSent) sendText(res, 500, 'Server error: ' + e.message);
      else res.destroy();
    }
  });
});

server.on('clientError', function (err, socket) {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', function () {
    console.log('DESKTOP SIEGE 已启动：http://127.0.0.1:' + PORT);
    console.log('已扫描 ' + scanData.files.length + ' 个真实文件，生成 ' + waves.length + ' 波敌人');
    if (!NO_BROWSER) {
      try {
        require('child_process').spawn('cmd', ['/c', 'start', '', 'http://127.0.0.1:' + PORT], { detached: true, stdio: 'ignore' }).unref();
      } catch (e) { /* 忽略 */ }
    }
  });
}

module.exports = { server, scanSummary, doScan, rebuildWaves, safeJoin, resolveStatic, readBody, MAX_BODY_BYTES };
