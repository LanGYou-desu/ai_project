const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

function start(port) {
  const server = http.createServer((req, res) => {
    try {
      let p = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
      if (p === '/') p = '/index.html';
      const file = path.normalize(path.join(ROOT, p));
      // path.relative 回推防穿越：startsWith 前缀匹配会被 ROOT 的兄弟目录（如 3d-car-x）骗过
      const rel = path.relative(ROOT, file);
      if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403); res.end('Forbidden'); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 Not Found: ' + p); return; }
        res.writeHead(200, {
          'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store'
        });
        res.end(data);
      });
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && port < 8089) { start(port + 1); return; }
    console.error('启动失败: ' + e.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:' + port;
    console.log('============================================');
    console.log('  3D 跑车已启动:  ' + url);
    console.log('  关闭本窗口即可停止服务');
    console.log('============================================');
    if (process.env.DSH_NO_OPEN !== '1') {
      const cmd = os.platform() === 'win32' ? 'start "" ' + url : 'xdg-open ' + url;
      exec(cmd, () => {});
    }
  });
}
start(8080);
