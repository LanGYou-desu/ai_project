'use strict';

// ── The History Reader · 历史朗读者 ──
// 服务器：读取 Chrome / Edge 历史 → 生成叙事 → 提供给前端
//
// 隐私前提：浏览历史是本机最私密的数据之一，因此默认只监听 127.0.0.1，
// 并校验 Host 头（防 DNS rebinding）。确实需要局域网访问时再显式放开。

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const {
  readHistory, parseUpload, parseLocalDate, endOfDayMs, MAX_DAYS, MAX_LIMIT,
} = require('./lib/reader');
const { generateNarrative } = require('./lib/narrator');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const HOST = process.env.HOST || '127.0.0.1';
const DEFAULT_PORT = 8769;
const MAX_BODY_BYTES = 1024 * 1024; // 上传 JSON 上限 1 MB

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// ── 响应helper ──

function sendJson(res, obj, status) {
  if (res.headersSent) return;
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(status || 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': body.length,
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, { error: message }, status);
}

function sendText(res, status, text) {
  if (res.headersSent) return;
  const body = Buffer.from(text, 'utf8');
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': body.length });
  res.end(body);
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// ── 请求体读取（带字节上限，超限立刻回 413 并断开） ──

function readBody(req, maxBytes) {
  return new Promise(function(resolve) {
    const chunks = [];
    let size = 0;
    let settled = false;

    function done(result) {
      if (settled) return;
      settled = true;
      resolve(result);
    }

    req.on('data', function(chunk) {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        req.pause(); // 不再继续读，等响应发完就断开
        done({ tooLarge: true });
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function() {
      done({ text: Buffer.concat(chunks).toString('utf8') });
    });
    req.on('aborted', function() { done({ aborted: true }); });
    req.on('error', function() { done({ aborted: true }); });
  });
}

function contentLengthTooLarge(req, maxBytes) {
  const raw = req.headers['content-length'];
  if (!raw) return false;
  const n = Number(raw);
  return Number.isFinite(n) && n > maxBytes;
}

function rejectTooLarge(req, res) {
  // 不设 Connection: close：连接一关，客户端还没写完的请求体就会变成 ECONNRESET，
  // 反而看不到 413。这里把响应发出去，再把剩余请求体读掉丢弃。
  res.writeHead(413, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify({ error: '请求体过大（上限 ' + Math.floor(MAX_BODY_BYTES / 1024) + ' KB）' }));

  let drained = 0;
  req.on('data', function(chunk) {
    drained += chunk.length;
    if (drained > 4 * MAX_BODY_BYTES) req.destroy(); // 远超上限才强行断开
  });
  req.resume();
}

// ── 静态资源路径解析 ──
// 先解码（挡住 %2e%2e%2f 这类编码绕过），再归一化，最后用 path.relative 回推判断
// 是否越出 PUBLIC_DIR：前缀 startsWith 会被 public-evil 这类兄弟目录骗过。
function resolveStaticPath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch (e) {
    return { error: 400 }; // 非法百分号编码
  }
  if (decoded.indexOf('\0') !== -1) return { error: 400 };

  const filePath = path.normalize(path.join(PUBLIC_DIR, decoded));
  const rel = path.relative(PUBLIC_DIR, filePath);

  if (rel === '') return { error: 404 }; // 目录本身
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { error: 403 };
  return { filePath: filePath };
}

function serveStatic(req, res, urlPath) {
  const resolved = resolveStaticPath(urlPath);
  if (resolved.error) {
    return sendText(res, resolved.error, resolved.error === 403 ? 'Forbidden' : 'Not Found');
  }

  fs.readFile(resolved.filePath, function(err, data) {
    if (err) {
      const code = err.code === 'ENOENT' || err.code === 'EISDIR' || err.code === 'ENOTDIR' ? 404 : 500;
      return sendText(res, code, code === 404 ? 'Not Found' : 'Internal Server Error');
    }
    if (res.headersSent) return;
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(resolved.filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Length': data.length,
    });
    res.end(data);
  });
}

// ── 请求校验 ──

// 只接受本机 Host。HR_ALLOW_REMOTE=1 可显式放开（配合 HOST=0.0.0.0 使用）。
function hostAllowed(req) {
  if (process.env.HR_ALLOW_REMOTE === '1') return true;
  const raw = String(req.headers.host || '');
  const name = raw.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  return name === 'localhost' || name === '127.0.0.1' || name === '::1';
}

function parseIntParam(sp, name, min, max) {
  if (!sp.has(name)) return undefined;
  const raw = String(sp.get(name));
  if (!/^\d+$/.test(raw)) {
    throw badRequest('参数 ' + name + ' 需要是 ' + min + '~' + max + ' 之间的整数');
  }
  const n = Number(raw);
  if (n < min || n > max) {
    throw badRequest('参数 ' + name + ' 超出范围（' + min + '~' + max + '）');
  }
  return n;
}

function parseHistoryQuery(sp) {
  const start = sp.get('start');
  const end = sp.get('end');
  const opts = {};

  if (start || end) {
    if (!start || !end) throw badRequest('start 与 end 必须同时提供（YYYY-MM-DD）');
    let startMs, endMs;
    try {
      startMs = parseLocalDate(start);
      endMs = endOfDayMs(end);
    } catch (e) {
      throw badRequest(e.message);
    }
    if (endMs <= startMs) throw badRequest('结束日期不能早于开始日期');
    opts.startDate = start;
    opts.endDate = end;
  } else {
    const days = parseIntParam(sp, 'days', 1, MAX_DAYS);
    if (days !== undefined) opts.days = days;
  }

  const limit = parseIntParam(sp, 'limit', 1, MAX_LIMIT);
  if (limit !== undefined) opts.limit = limit;

  return opts;
}

// ── 路由 ──

async function handleRequest(req, res) {
  if (!hostAllowed(req)) {
    return sendError(res, 403, '仅允许从本机访问（如确需局域网访问，请设置 HR_ALLOW_REMOTE=1）');
  }

  // new URL 对畸形请求行会抛异常，必须包在 try 里，否则一个请求就能拖垮进程
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch (e) {
    return sendError(res, 400, '请求地址无法解析');
  }
  const p = url.pathname;

  // API: 读取浏览器历史并生成叙事
  if (req.method === 'GET' && p === '/api/history') {
    const opts = parseHistoryQuery(url.searchParams);
    const result = await readHistory(opts);
    const narrative = generateNarrative(result.visits, result.timeRange);
    return sendJson(res, Object.assign({}, narrative, { source: result.source }));
  }

  // API: 上传 JSON 数据
  if (req.method === 'POST' && p === '/api/upload') {
    if (contentLengthTooLarge(req, MAX_BODY_BYTES)) {
      return rejectTooLarge(req, res);
    }

    const body = await readBody(req, MAX_BODY_BYTES);
    if (body.aborted) return; // 客户端已断开，无法再回应
    if (body.tooLarge) return rejectTooLarge(req, res);

    let parsed;
    try {
      parsed = JSON.parse(body.text);
    } catch (e) {
      return sendError(res, 400, 'JSON 解析失败：' + e.message);
    }

    let result;
    try {
      result = parseUpload(parsed);
    } catch (e) {
      return sendError(res, 400, e.message);
    }

    const narrative = generateNarrative(result.visits, result.timeRange);
    return sendJson(res, Object.assign({}, narrative, {
      source: '上传的 JSON',
      skipped: result.skipped,
    }));
  }

  // 静态文件
  if (req.method === 'GET' || req.method === 'HEAD') {
    const urlPath = p === '/' ? '/index.html' : p;
    return serveStatic(req, res, urlPath);
  }

  return sendText(res, 404, 'Not Found');
}

function createServer() {
  const server = http.createServer(function(req, res) {
    handleRequest(req, res).catch(function(err) {
      const status = err && err.status ? err.status
        : err && err.code === 'NO_HISTORY_FILE' ? 404
        : 500;
      if (status >= 500) console.error('Error:', err && err.stack ? err.stack : err);
      sendError(res, status, (err && err.message) || '服务器内部错误');
    });
  });

  // 畸形请求（超长头、非法请求行等）不应让进程退出
  server.on('clientError', function(err, socket) {
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    } else {
      socket.destroy();
    }
  });

  return server;
}

function openBrowser(url) {
  if (process.env.HR_NO_OPEN === '1' || process.env.DSH_NO_OPEN === '1') return;

  const startCmd = process.platform === 'win32'
    ? 'cmd /c start "" "' + url + '"'
    : process.platform === 'darwin'
      ? 'open ' + url
      : 'xdg-open ' + url;

  try {
    const child = exec(startCmd, function(err) {
      if (err) console.error('  （自动打开浏览器失败，请手动访问 ' + url + '）');
    });
    if (child && typeof child.unref === 'function') child.unref();
  } catch (e) {
    // 沙箱环境可能阻止 exec，忽略
    console.error('  （自动打开浏览器失败，请手动访问 ' + url + '）');
  }
}

function startServer(port) {
  const listenPort = Number(port || process.env.PORT || DEFAULT_PORT);
  if (!Number.isInteger(listenPort) || listenPort < 0 || listenPort > 65535) {
    console.error('端口无效：' + (port || process.env.PORT) + '（需要 0~65535 的整数）');
    process.exit(1);
  }

  const server = createServer();

  server.on('error', function(err) {
    if (err.code === 'EADDRINUSE') {
      console.error('');
      console.error('  端口 ' + listenPort + ' 已被占用。');
      console.error('  可能已有一个历史朗读者在运行，请直接访问 http://127.0.0.1:' + listenPort);
      console.error('  或换个端口：set PORT=8899 && node server.js');
      console.error('');
      process.exit(1);
    }
    console.error('服务器错误：' + err.message);
    process.exit(1);
  });

  server.listen(listenPort, HOST, function() {
    const actualPort = server.address().port;
    const hostForUrl = HOST === '0.0.0.0' ? 'localhost' : (HOST.indexOf(':') !== -1 ? '[' + HOST + ']' : HOST);
    const url = 'http://' + hostForUrl + ':' + actualPort;
    console.log('');
    console.log('  The History Reader · 历史朗读者');
    console.log('  ' + url);
    console.log('  把你的浏览器历史变成一首关于今天的小说');
    if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
      console.log('  注意：当前监听 ' + HOST + '，历史数据可能被其他设备读取');
    }
    console.log('');
    openBrowser(url);
  });

  // 优雅关闭：不留悬挂的监听句柄
  function shutdown(sig) {
    console.log('');
    console.log('  [' + sig + '] 历史朗读者正在合上书……');
    server.close(function() { process.exit(0); });
    setTimeout(function() { process.exit(0); }, 1500).unref();
  }
  process.on('SIGINT', function() { shutdown('Ctrl+C'); });
  process.on('SIGTERM', function() { shutdown('SIGTERM'); });

  return server;
}

module.exports = {
  createServer,
  startServer,
  handleRequest,
  resolveStaticPath,
  parseHistoryQuery,
  hostAllowed,
  PUBLIC_DIR,
  MAX_BODY_BYTES,
};

if (require.main === module) {
  startServer();
}
