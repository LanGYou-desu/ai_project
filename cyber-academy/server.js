/* 赛博安全学院 — 本地服务器 (静态站 + 真实靶场)
 * 用法: node server.js
 *   → 游戏:      http://localhost:8080
 *   → 本地靶场:   http://127.0.0.1:8090  (SQLi/XSS), TCP 1337 后门, TCP 2222 SSH
 * 加 --no-lab 可只启动静态站 (游戏退回模拟模式)。
 * 也可以直接双击 index.html 运行 (纯前端，无靶场)。
 * ⚠ 安全: 本服务器(含静态站与靶场全部服务)仅绑定 127.0.0.1, 切勿改为 0.0.0.0 暴露公网。
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '127.0.0.1'; // 只绑本机
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

/* 静态文件处理器 (可被测试直接使用) */
function createStaticHandler(root) {
  return (req, res) => {
    let urlPath;
    try { urlPath = decodeURIComponent(req.url.split('?')[0]); } catch (e) { urlPath = '/'; }
    if (urlPath === '/') urlPath = '/index.html';
    const file = path.normalize(path.join(root, urlPath));
    // path.relative 回推防穿越：startsWith 前缀匹配会被 root 的兄弟目录骗过
    const rel = path.relative(root, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403); return res.end('403 Forbidden'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('404 Not Found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  };
}

if (require.main === module) {
  http.createServer(createStaticHandler(ROOT)).listen(PORT, HOST, () => {
    console.log('✔ 赛博安全学院已启动: http://localhost:' + PORT + ' (仅绑定 127.0.0.1)');
    console.log('   (也可直接双击 index.html 运行，纯前端)');
  });

  /* ---------- 启动本地真实靶场 ---------- */
  if (!process.argv.includes('--no-lab')) {
    try {
      const { createLab } = require('./lab/lab.js');
      const lab = createLab({
        httpPort: 8090,
        tcpPort: 1337,
        sshPort: 2222,
        downloadDir: path.join(__dirname, 'lab', 'downloads'),
      });
      lab.ready.then(() => {
        console.log('══════════════════════════════════════════');
        console.log('✔ 本地真实靶场已启动 (从原理到实践 · 训练场)');
        console.log('  Web 应用 (SQLi/XSS): http://127.0.0.1:' + lab.httpPort + '/');
        console.log('  后门服务 (TCP):      nc 127.0.0.1 ' + lab.tcpPort + '  (密码 root/toor)');
        console.log('  SSH 模拟 (TCP):      nc 127.0.0.1 ' + lab.sshPort + '  (LOGIN admin password)');
        console.log('  靶机文件:            ' + lab.downloadDir + '/');
        console.log('  命令注入 (RCE):      GET /api/ping?host=...');
        console.log('  IDOR 越权:           GET /api/profile?id=2');
        console.log('  路径穿越:            GET /api/read?file=../server.js');
        console.log('  SQL 引擎:            ' + lab.engine);
        console.log('⚠ 仅绑定 127.0.0.1，仅供本地学习，切勿暴露到公网');
        console.log('  游戏内输入 lab 查看靶场菜单，L1/L3/L6 自动切换真实模式');
      }).catch((e) => console.log('⚠ 靶场启动失败 (忽略): ' + e.message));
    } catch (e) {
      console.log('⚠ 靶场启动失败 (忽略，继续以模拟模式运行): ' + e.message);
    }
  }
}

module.exports = { createStaticHandler };
