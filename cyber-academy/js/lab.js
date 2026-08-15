'use strict';
/* =========================================================
 * 赛博安全学院 — 本地靶场客户端
 * 当 node server.js (或 lab/lab.js) 启动时，游戏切换到真实靶场模式:
 * L1/L3/L6 的网络操作走真实 HTTP/TCP 请求。
 * ========================================================= */

const Lab = {
  base: 'http://127.0.0.1:8090',
  available: false,
  checked: false,
  sep: '; ', // 命令注入分隔符 (由靶场状态提供: Windows 为 " & ")

  async init() {
    try {
      const r = await fetch(this.base + '/lab/status', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        if (j && j.lab) {
          this.available = true;
          if (j.sep) this.sep = j.sep;
          unlockAchievement('lab_ranger');
        }
      }
    } catch (e) { /* 靶场未启动 */ }
    this.checked = true;
    updateHud();
  },

  async api(path, opts) {
    const r = await fetch(this.base + path, Object.assign({
      headers: { 'Content-Type': 'application/json' },
    }, opts));
    return r.json();
  },

  async file(name) {
    const r = await fetch(this.base + '/api/files/' + name, { cache: 'no-store' });
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  },
};

function openWebBrowser(url) {
  const wb = document.getElementById('webbrowser');
  const frame = document.getElementById('wbframe');
  const urlEl = document.getElementById('wb-url');
  if (!wb || !frame) return;
  frame.src = url;
  if (urlEl) urlEl.textContent = url;
  wb.classList.remove('hidden');
}
function closeWebBrowser() {
  const wb = document.getElementById('webbrowser');
  if (wb) wb.classList.add('hidden');
}
window.openWebBrowser = openWebBrowser;
window.closeWebBrowser = closeWebBrowser;

GLOBAL_COMMANDS['browser'] = async (toks) => {
  if ((toks[1] || '').toLowerCase() === 'close') { closeWebBrowser(); T.print('浏览器已关闭。', 'info'); return; }
  await Lab.init();
  if (!Lab.available) {
    T.print('靶场离线。运行 node server.js 启动本地靶场后，才能打开真实浏览器。', 'error');
    return;
  }
  openWebBrowser(Lab.base);
  T.print('✔ 已打开真实浏览器窗口 — 用鼠标操作!', 'success');
  T.print('  (靶场是真实 Web 应用: 点登录框、手工输入 SQL 注入、点搜索框触发 XSS)', 'info');
  T.print('  关闭: 点窗口右上角 ✕，或输入 browser close', 'dim');
};
GLOBAL_COMMANDS['browser'].usage = 'browser — 打开真实浏览器窗口 (需靶场)';

GLOBAL_COMMANDS['lab'] = async (toks) => {
  await Lab.init();
  const arg = (toks[1] || '').toLowerCase();

  if (arg === 'get') {
    const name = toks[2] || '';
    if (!name) { T.print('用法: lab get crackme.bin | usb.dd', 'info'); return; }
    if (!Lab.available) { T.print('靶场离线。运行 node server.js 启动本地靶场。', 'error'); return; }
    T.print(`正在从靶场拉取真实文件 ${name} ...`, 'info');
    let bytes = null;
    try { bytes = await Lab.file(name); } catch (e) { T.print('靶场文件拉取失败: ' + e.message, 'error'); return; }
    if (!bytes) { T.print('文件拉取失败。', 'error'); return; }
    if (!Game.active) { T.print('请先开始游戏 (start)。', 'info'); return; }
    Game.active.fs[name] = { bytes: Array.from(bytes) };
    T.print(`✔ 已导入 ${name} (${bytes.length} 字节) — 真实字节，可用 file / hexdump / strings 分析`, 'success');
    Sound.ok();
    Game.save();
    return;
  }

  if (arg === 'open') {
    if (!Lab.available) { T.print('靶场离线。运行 node server.js 启动本地靶场。', 'error'); return; }
    window.open(Lab.base, '_blank');
    return;
  }

  if (arg === 'exec') {
    const cmdStr = toks.slice(2).join(' ');
    if (!cmdStr) { T.print('用法: lab exec <命令> — 利用靶场命令注入在靶机上执行命令', 'info'); return; }
    if (!Lab.available) { T.print('靶场离线。运行 node server.js 启动本地靶场。', 'error'); return; }
    const host = '127.0.0.1' + Lab.sep + cmdStr;
    T.print('正在通过 /api/ping 注入命令...', 'info');
    const j = await Lab.api('/api/ping?host=' + encodeURIComponent(host));
    T.print('真实执行: ' + j.command, 'dim');
    T.print('命令输出:', 'info');
    (j.output || (j.error ? '执行失败: ' + j.error : '')).split('\n').forEach((l) => T.print('  ' + l, 'cmd'));
    if (j.error && !j.output) T.print('(命令注入失败: ' + j.error + ')', 'error');
    return;
  }

  if (arg === 'read') {
    const file = toks.slice(2).join(' ');
    if (!file) { T.print('用法: lab read <路径> — 利用靶场路径穿越读取靶机文件', 'info'); return; }
    if (!Lab.available) { T.print('靶场离线。运行 node server.js 启动本地靶场。', 'error'); return; }
    const j = await Lab.api('/api/read?file=' + encodeURIComponent(file));
    if (j.ok) {
      T.print(`✔ 读取成功 (解析到: ${j.resolved})`, 'success');
      String(j.content || '').split('\n').forEach((l) => T.print('  ' + l, 'cmd'));
    } else {
      T.print('读取失败: ' + (j.error || '文件不存在'), 'error');
    }
    return;
  }

  // 状态与说明
  T.print('═══ 本地靶场 ═══', 'header');
  if (Lab.available) {
    T.print(`状态: 在线 (${Lab.base}) — 全部服务仅绑定 127.0.0.1，仅供本地学习`, 'success');
    T.print('靶场清单 (可以全部用真实工具手工练习):', 'info');
    T.print('  [1] 真实 Web 应用 (SQL 注入 / XSS)', 'cmd');
    T.print('      浏览器打开 ' + Lab.base + '/  或用 curl/sqlmap 攻击', 'cmd');
    T.print('  [2] 真实后门服务  TCP 1337', 'cmd');
    T.print('      nc 127.0.0.1 1337 → 密码 root/toor', 'cmd');
    T.print('  [3] SSH 模拟服务  TCP 2222 (账户 admin / password)', 'cmd');
    T.print('      nc 127.0.0.1 2222 → 发送 LOGIN admin password', 'cmd');
    T.print('  [4] 靶机真实文件: lab/downloads/crackme.bin 与 usb.dd', 'cmd');
    T.print('      可用 strings / xxd / file 在本机真实分析', 'cmd');
    T.print('  [5] 命令注入漏洞  GET /api/ping?host=...   → lab exec <命令>', 'cmd');
    T.print('  [6] IDOR 越权漏洞  GET /api/profile?id=1   → 遍历 id 越权', 'cmd');
    T.print('  [7] 路径穿越漏洞  GET /api/read?file=...   → lab read <路径>', 'cmd');
    T.newline();
    T.print('游戏内接入:', 'info');
    T.print('  lab get <文件名>    拉取真实靶机文件到虚拟终端', 'cmd');
    T.print('  lab exec <命令>     通过命令注入在靶机执行命令 (RCE)', 'cmd');
    T.print('  lab read <路径>     通过路径穿越读取靶机文件', 'cmd');
    T.print('  L1 banner / L3 · L6 的 web/login/search/dump/ssh 走真实网络', 'cmd');
    T.newline();
    T.print('实战挑战: challenge 9 (命令注入) / challenge 10 (任意文件读取)', 'dim');
  } else {
    T.print('状态: 离线 (模拟模式)', 'error');
    T.print('启动靶场: 在项目目录运行  node server.js  或  node lab/lab.js', 'info');
    T.print('启动后本命令刷新状态，L1/L3/L6 将切换为真实网络攻击。', 'dim');
  }
};
GLOBAL_COMMANDS['lab'].usage = 'lab [get <文件>|exec <命令>|read <路径>] — 本地靶场操作';
