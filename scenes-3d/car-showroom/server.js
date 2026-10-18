'use strict';
/*
 * 3D 跑车展厅 · 零依赖本地静态服务器
 *
 * 安全边界（README「安全说明」一节有对应描述）：
 *   1. 只绑定 127.0.0.1，不对外网暴露；
 *   2. 请求路径先解码、再用 path.relative 回推，越出项目目录一律 403；
 *   3. 不提供目录列举（目录请求按 404 处理）；
 *   4. 服务器自身文件（server.js / start.bat）与点文件（.git 等）不对外提供；
 *   5. 只接受 GET / HEAD，静态资源不接受请求体，错误响应不回显内部路径。
 *
 * 环境变量：PORT（默认 8080，设为 0 时由系统分配空闲端口）、DSH_NO_OPEN=1（不自动打开浏览器）。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const ROOT = __dirname;
const DEFAULT_PORT = 8080;
const MAX_PORT = 8089;        // 端口被占用时依次尝试 8081…8089
const MAX_URL_LENGTH = 2048;  // 超长 URL 直接 414，省掉无谓的解码开销
const MAX_BODY_BYTES = 1024;  // 静态资源不需要请求体，超过即 413
const DENY_NAMES = new Set(['server.js', 'start.bat']); // 不对外提供的服务器自身文件

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const STATUS_TEXT = {
  400: '400 Bad Request',
  403: '403 Forbidden',
  404: '404 Not Found',
  405: '405 Method Not Allowed',
  413: '413 Payload Too Large',
  414: '414 URI Too Long',
  500: '500 Internal Server Error'
};

// 只保留可见字符与常用中文，避免把控制字符/HTML 回显进响应体
function sanitize(text) {
  return String(text).replace(/[^\x20-\x7e\u4e00-\u9fff]/g, '').slice(0, 120);
}

function sendError(res, status, detail) {
  if (res.headersSent || res.writableEnded) {
    try { res.end(); } catch (e) { /* 客户端已断开 */ }
    return;
  }
  const body = STATUS_TEXT[status] + (detail ? ': ' + sanitize(detail) : '') + '\n';
  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  if (status === 405) headers.Allow = 'GET, HEAD';
  res.writeHead(status, headers);
  res.end(body);
}

/**
 * 把请求 URL 解析成项目目录内的绝对路径。
 * 成功返回 { file, rel }；失败返回 { error: <状态码> }。
 * 纯函数、不碰磁盘，便于单元测试。
 */
function resolveTarget(rawUrl) {
  let raw = typeof rawUrl === 'string' && rawUrl ? rawUrl : '/';
  const cut = raw.search(/[?#]/);
  if (cut !== -1) raw = raw.slice(0, cut);
  if (raw.length > MAX_URL_LENGTH) return { error: 414 };

  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch (e) {
    return { error: 400 }; // 非法百分号转义（如 /%zz）
  }
  if (decoded.indexOf('\0') !== -1) return { error: 400 }; // %00 截断
  if (decoded === '' || decoded === '/') decoded = '/index.html';

  // path.join + normalize 会折叠 . / .. / \ 以及绝对路径片段
  const file = path.normalize(path.join(ROOT, decoded));
  const rel = path.relative(ROOT, file);
  if (rel === '' || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
    return { error: 403 }; // 越出项目目录（含 ROOT 本身与兄弟目录 car-showroom-x 之类）
  }

  const segments = rel.split(path.sep);
  for (let i = 0; i < segments.length; i++) {
    // Windows 忽略结尾的点与空格（server.js. 等价 server.js），先归一化再判断
    const name = segments[i].replace(/[ .]+$/, '');
    if (name === '' || name.startsWith('.')) return { error: 403 }; // 点文件 / .git
    if (DENY_NAMES.has(name.toLowerCase())) return { error: 403 };  // 服务器自身文件
  }
  return { file: file, rel: rel };
}

function handleRequest(req, res) {
  res.on('error', function () { /* 客户端提前断开：忽略写入错误 */ });

  const method = req.method;
  if (method !== 'GET' && method !== 'HEAD') {
    req.resume(); // 丢弃请求体，避免连接悬挂
    sendError(res, 405);
    return;
  }

  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    // 不读请求体：响应结束后 Node 会自行丢弃剩余字节并关闭连接
    sendError(res, 413);
    return;
  }

  const target = resolveTarget(req.url);
  if (target.error) {
    sendError(res, target.error);
    return;
  }

  fs.readFile(target.file, function (err, data) {
    if (err) {
      if (err.code === 'EACCES' || err.code === 'EPERM') { sendError(res, 403); return; }
      if (err.code === 'ENOENT' || err.code === 'EISDIR' || err.code === 'ENOTDIR' || err.code === 'ENAMETOOLONG') {
        sendError(res, 404); // 目录也走这里：不提供目录列举
        return;
      }
      console.error('[car-showroom] 读取失败 ' + target.rel + ': ' + err.message);
      sendError(res, 500); // 不回显内部错误与绝对路径
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(target.file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(method === 'HEAD' ? undefined : data);
  });
}

let activeServer = null;

function start(port) {
  const server = http.createServer(function (req, res) {
    try {
      handleRequest(req, res);
    } catch (e) {
      console.error('[car-showroom] 请求处理异常: ' + (e && e.message ? e.message : e));
      sendError(res, 500);
    }
  });
  server.headersTimeout = 10000;   // 防御慢速请求头
  server.requestTimeout = 30000;   // 防御慢速请求体

  server.on('error', function (e) {
    if (e.code === 'EADDRINUSE' && port > 0 && port < MAX_PORT) { start(port + 1); return; }
    console.error('启动失败: ' + e.message);
    process.exit(1);
  });

  server.listen(port, '127.0.0.1', function () {
    activeServer = server;
    const actual = server.address().port;
    const url = 'http://127.0.0.1:' + actual;
    console.log('============================================');
    console.log('  3D 跑车已启动:  ' + url);
    console.log('  关闭本窗口即可停止服务');
    console.log('============================================');
    if (process.env.DSH_NO_OPEN !== '1') {
      const cmd = os.platform() === 'win32' ? 'start "" ' + url : 'xdg-open ' + url;
      exec(cmd, function () {});
    }
  });

  return server;
}

function shutdown() {
  if (!activeServer) { process.exit(0); return; }
  activeServer.close(function () { process.exit(0); });
  setTimeout(function () { process.exit(0); }, 500).unref();
}

if (require.main === module) {
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  const envPort = process.env.PORT;
  const parsed = (envPort === undefined || envPort === '') ? DEFAULT_PORT : Number(envPort);
  const port = (Number.isInteger(parsed) && parsed >= 0 && parsed <= 65535) ? parsed : DEFAULT_PORT;
  start(port);
}

module.exports = { start: start, resolveTarget: resolveTarget, TYPES: TYPES, ROOT: ROOT, DENY_NAMES: DENY_NAMES };
