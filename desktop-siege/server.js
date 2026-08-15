'use strict';
// DESKTOP SIEGE · 服务器：真实磁盘扫描 + 波次生成 + 静态资源
const http = require('http');
const fs = require('fs');
const path = require('path');
const { scan, defaultProfileDirs } = require('./lib/scanner');
const { generateWaves } = require('./lib/waves');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const CACHE_FILE = path.join(ROOT, 'scan-cache.json');
const PORT = Number(process.env.PORT || 8769);
const NO_BROWSER = process.env.NO_BROWSER === '1' || process.argv.indexOf('--no-browser') >= 0;
const SEED = Number(process.env.DS_SEED || 20810719);

let scanData = null;

function doScan() {
  try {
    scanData = scan({
      dirs: defaultProfileDirs(),
      maxDepth: 2,
      cap: 3000,
      cacheFile: CACHE_FILE
    });
    console.log('[scan] 扫描完成：' + scanData.files.length + ' 个文件，' + scanData.processes.length + ' 个进程');
    return scanData;
  } catch (e) {
    if (fs.existsSync(CACHE_FILE)) {
      try { scanData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (e2) { scanData = null; }
    }
    if (!scanData) {
      scanData = {
        files: [{ name: '桌面文件', ext: 'txt', size: 1024, dir: 'Desktop' }],
        processes: ['explorer', 'svchost', 'node'],
        largest: { name: '桌面文件', ext: 'txt', size: 1024, dir: 'Desktop' },
        largestDoc: null, largestMedia: null, largestArchive: null,
        counts: { total: 1, processes: 3, byExt: { txt: 1 } },
        scannedAt: Date.now()
      };
    }
    console.log('[scan] 扫描失败，使用缓存/默认数据');
    return scanData;
  }
}

doScan();

let waves = generateWaves(scanData, { seed: SEED, totalWaves: 20 });

function scanSummary() {
  const files = scanData.files || [];
  const byDir = {};
  for (const f of files) {
    if (!byDir[f.dir]) byDir[f.dir] = 0;
    byDir[f.dir]++;
  }
  const topDirs = Object.keys(byDir).sort((a, b) => byDir[b] - byDir[a]).slice(0, 5).map(d => ({ dir: d, count: byDir[d] }));
  const exts = Object.keys(scanData.counts.byExt || {}).slice(0, 12);
  const pool = files.map(f => f.name + '.' + f.ext);
  const procPool = (scanData.processes || []).slice(0, 50);
  return {
    total: files.length,
    processes: (scanData.processes || []).length,
    topDirs: topDirs,
    topExts: exts,
    largest: scanData.largest ? { name: scanData.largest.name + '.' + scanData.largest.ext, size: scanData.largest.size } : null,
    sampleNames: pool.slice(0, 12),
    sampleProcesses: procPool.slice(0, 12),
    waves: waves.length,
    seed: SEED,
    scannedAt: scanData.scannedAt
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(res, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function safeJoin(base, rel) {
  const abs = path.resolve(base, '.' + path.sep + rel);
  const relCheck = path.relative(base, abs);
  if (relCheck === '' || relCheck.startsWith('..') || path.isAbsolute(relCheck)) return null;
  return abs;
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  try {
    if (req.method === 'GET' && p === '/api/scan') {
      sendJson(res, scanSummary());
      return;
    }
    if (req.method === 'GET' && p === '/api/waves') {
      sendJson(res, {
        waves: waves,
        scan: scanSummary(),
        scanData: {
          files: (scanData.files || []).map(f => ({ name: f.name, ext: f.ext, dir: f.dir })),
          processes: (scanData.processes || []).slice(0, 150),
          largest: scanData.largest,
          largestDoc: scanData.largestDoc,
          largestMedia: scanData.largestMedia,
          largestArchive: scanData.largestArchive
        },
        seed: SEED,
        arena: { w: 1600, h: 1000 }
      });
      return;
    }
    if (req.method === 'POST' && p === '/api/rescan') {
      doScan();
      waves = generateWaves(scanData, { seed: SEED, totalWaves: 20 });
      sendJson(res, { ok: true, scan: scanSummary() });
      return;
    }
    // 静态文件（public 下）
    let rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
    let filePath = safeJoin(PUBLIC_DIR, rel);
    if (filePath !== null && fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    // lib 下的脚本（rng / engine / waves）允许浏览器直接加载
    if (p === '/lib/rng.js' || p === '/lib/engine.js' || p === '/lib/waves.js') {
      const libPath = path.join(ROOT, 'lib', path.basename(p));
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      fs.createReadStream(libPath).pipe(res);
      return;
    }
    res.writeHead(404);
    res.end('Not Found');
  } catch (e) {
    res.writeHead(500);
    res.end('Server error: ' + e.message);
  }
});

server.listen(PORT, function () {
  console.log('DESKTOP SIEGE 已启动：http://127.0.0.1:' + PORT);
  console.log('已扫描 ' + (scanData.files || []).length + ' 个真实文件，生成 ' + waves.length + ' 波敌人');
  if (!NO_BROWSER) {
    try {
      require('child_process').spawn('cmd', ['/c', 'start', '', 'http://127.0.0.1:' + PORT], { detached: true, stdio: 'ignore' }).unref();
    } catch (e) { /* 忽略 */ }
  }
});
