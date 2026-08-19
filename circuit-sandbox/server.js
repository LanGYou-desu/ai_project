'use strict';
// 电路沙盒 · Node http 静态服务器
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8848);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};
function safeJoin(base, rel) {
  const abs = path.resolve(base, '.' + path.sep + rel);
  const r = path.relative(base, abs);
  if (r === '' || r.startsWith('..') || path.isAbsolute(r)) return null;
  return abs;
}
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const fp = safeJoin(PUBLIC, rel);
    if (!fp) { res.writeHead(403); res.end('Forbidden'); return; }
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  } catch (e) { res.writeHead(500); res.end('Server error: ' + e.message); }
});
server.listen(PORT, () => {
  console.log('电路沙盒已启动：http://127.0.0.1:' + PORT);
  if (process.env.NO_BROWSER !== '1') {
    try {
      require('child_process').spawn('cmd', ['/c', 'start', '', 'http://127.0.0.1:' + PORT], { detached: true, stdio: 'ignore' }).unref();
    } catch (e) { /* 忽略 */ }
  }
});