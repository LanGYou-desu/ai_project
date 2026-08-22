'use strict';

// ── The History Reader · 历史朗读者 ──
// 服务器：读取 Chrome 历史 → 生成叙事 → 提供给前端

const http = require('http');
const fs = require('fs');
const path = require('path');
const { readHistory, parseUpload } = require('./lib/reader');
const { generateNarrative } = require('./lib/narrator');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8769);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function(resolve) {
    let d = '';
    req.on('data', function(c) { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', function() { resolve(d); });
    req.on('error', function() { resolve(''); });
  });
}

function serveStatic(req, res, urlPath) {
  const filePath = path.join(PUBLIC_DIR, urlPath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, function(err, data) {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const server = http.createServer(async function(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  try {
    // API: 读取浏览器历史并生成叙事
    if (req.method === 'GET' && p === '/api/history') {
      const opts = {};
      const daysParam = url.searchParams.get('days');
      const startDate = url.searchParams.get('start');
      const endDate = url.searchParams.get('end');
      if (startDate && endDate) {
        opts.startDate = startDate;
        opts.endDate = endDate;
      } else if (daysParam) {
        opts.days = parseInt(daysParam, 10) || 7;
      }
      const result = await readHistory(opts);
      const narrative = generateNarrative(result.visits, result.timeRange);
      sendJson(res, narrative);
      return;
    }

    // API: 上传 JSON 数据
    if (req.method === 'POST' && p === '/api/upload') {
      const body = await readBody(req);
      const bodyData = JSON.parse(body);
      const timeRange = bodyData.timeRange || null;
      const result = parseUpload(body, timeRange);
      const narrative = generateNarrative(result.visits, result.timeRange);
      sendJson(res, narrative);
      return;
    }

    // 静态文件
    if (req.method === 'GET') {
      const urlPath = p === '/' ? '/index.html' : p;
      serveStatic(req, res, urlPath);
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  } catch (err) {
    console.error('Error:', err.message);
    sendJson(res, { error: err.message });
  }
});

const { exec } = require('child_process');

server.listen(PORT, function() {
  console.log('');
  console.log('  The History Reader · 历史朗读者');
  console.log('  http://localhost:' + PORT);
  console.log('  把你的浏览器历史变成一首关于今天的小说');
  console.log('');

  // 自动打开浏览器（失败不影响服务器运行）
  try {
    const url = 'http://localhost:' + PORT;
    const startCmd = process.platform === 'win32'
      ? 'cmd /c start "" "' + url + '"'
      : process.platform === 'darwin'
        ? 'open ' + url
        : 'xdg-open ' + url;

    exec(startCmd, function() {
      // 成功或失败都不影响服务器
    });
  } catch (e) {
    // 沙箱环境可能阻止 exec，忽略
  }
});