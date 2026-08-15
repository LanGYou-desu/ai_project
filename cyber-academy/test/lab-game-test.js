'use strict';
/* =========================================================
 * 游戏×靶场 端到端测试: 游戏终端攻击真实本地靶场
 * 用法: node test/lab-game-test.js
 * ========================================================= */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createLab } = require('../lab/lab.js');

// 注意: 不要在这里加速全局 setTimeout —— 会破坏 Node fetch (undici) 的内部定时器。

const downloadDir = path.join(os.tmpdir(), 'cyber-lab-game-' + Date.now());
const lab = createLab({ httpPort: 0, tcpPort: 0, sshPort: 0, downloadDir });
const base = 'http://127.0.0.1:';

global.document = {
  body: { dataset: {} },
  getElementById(id) {
    if (id === 'output') return outputEl;
    if (id === 'input') return inputEl;
    if (id === 'prompt') return promptEl;
    if (id === 'hud') return hudEl;
    if (id === 'matrix') return { width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {}, clearRect() {} }) };
    return null;
  },
  createElement(tag) {
    return {
      tagName: tag, className: '', textContent: '', children: [], style: {},
      appendChild(c) { this.children.push(c); c.parentNode = this; },
      replaceWith() {},
    };
  },
  addEventListener() {},
};
global.window = { addEventListener() {} };
global.localStorage = {
  _s: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; },
};

const files = [
  'js/crypto.js', 'js/core.js', 'js/tools.js', 'js/course.js', 'js/challenges.js', 'js/lab.js',
  'js/levels/level0.js', 'js/levels/level1.js', 'js/levels/level2.js',
  'js/levels/level3.js', 'js/levels/level4.js', 'js/levels/level5.js', 'js/levels/level6.js',
  'js/main.js',
];
let code = '';
for (const f of files) code += '\n/* ===== ' + f + ' ===== */\n' + fs.readFileSync(path.join(__dirname, '..', f), 'utf8') + '\n';

code += `
;(function runLabGame() {
  'use strict';
  var printed = [];
  var outputEl = { children: [], scrollTop: 0, innerHTML: '', appendChild(el) { this.children.push(el); el.parentNode = this; }, addEventListener() {} };
  var inputEl = { value: '', addEventListener() {}, focus() {} };
  var promptEl = { textContent: '' };
  var hudEl = { textContent: '' };
  document.getElementById = function (id) {
    if (id === 'output') return outputEl;
    if (id === 'input') return inputEl;
    if (id === 'prompt') return promptEl;
    if (id === 'hud') return hudEl;
    if (id === 'matrix') return { width: 0, height: 0, getContext: function () { return { fillRect: function(){}, fillText: function(){}, clearRect: function(){} }; } };
    return null;
  };
  document.createElement = function (tag) {
    return {
      tagName: tag, className: '', textContent: '', children: [], style: {}, colSpan: 1,
      appendChild: function (c) { this.children.push(c); c.parentNode = this; },
      replaceWith: function () {},
      addEventListener: function () {},
    };
  };

  Terminal.prototype.type = async function (text, cls) { this.print(text, cls); };
  Terminal.prototype.typeLines = async function (lines, cls) { lines.forEach(function (l) { this.print(l, cls); }, this); };
  var origPrint = Terminal.prototype.print;
  Terminal.prototype.print = function (text, cls) {
    printed.push(typeof text === 'string' ? text : '(node)');
    return origPrint.call(this, text, cls);
  };
  T = new Terminal();

  var results = [];
  function check(name, cond) { results.push([name, !!cond]); }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms || 3); }); };
  async function cmd(line) { await handleCommand(line); await wait(3); }
  function objectiveDone(id) { var o = (Game.active.objectives || []).find(function (x) { return x.id === id; }); return !!(o && o.done); }
  function levelWon(id) { var l = Game.levels.find(function (x) { return x.id === id; }); return !!(l && l.won); }

  globalThis.__labDone = (async function play() {
    // 把游戏客户端指向本次测试的真实靶场 (端口由外层注入)
    Lab.base = '__LAB_BASE__';
    Lab.available = true;
    Lab.sep = process.platform === 'win32' ? ' & ' : '; ';
    Game.startedAt = Date.now();
    Game.hasStarted = true;

    /* ===== L3 对真实靶场 Web 攻击 ===== */
    await loadLevel(3);
    await cmd('web');
    var sqliUser = "admin'--";
    await cmd('login "' + sqliUser + '" x');
    check('L3 真实 SQL 分支执行', printed.some(function (p) { return p.indexOf('SQL 执行 (真实') !== -1; }));
    check('L3 未回退模拟', !printed.some(function (p) { return p.indexOf('回退到模拟模式') !== -1; }));
    check('L3 真实 SQLi 目标完成', objectiveDone('sqli'));
    check('L3 真实 SQLi 返回真实行', Game.labRows && Game.labRows.length >= 1 && Game.labRows[0].username === 'admin');
    check('L3 真实登录态', Game.browsing.loggedIn === true);
    await cmd('search <script>alert(1)</script>');
    check('L3 真实 XSS 目标完成', objectiveDone('xss'));
    await cmd('dump');
    await cmd('submit flag{sqli_xss_chain}');
    check('L3 通关 (真实靶场)', levelWon(3));
    check('L3 解锁 real_pwn', Game.achievements.has('real_pwn'));

    /* ===== L6 对真实靶场完整攻击链 ===== */
    await loadLevel(6);
    await cmd('scan 10.0.2.0/24');
    check('L6 真实扫描目标', objectiveDone('scan'));
    await cmd('web');
    await cmd('login "' + sqliUser + '" x');
    check('L6 真实 SQLi 目标', objectiveDone('sqli'));
    await cmd('dump');
    check('L6 真实 dump 目标', objectiveDone('dump'));
    await cmd('crack 5f4dcc3b5aa765d61d8327deb882cf99');
    check('L6 crack 目标', objectiveDone('crack'));
    await cmd('ssh admin password');
    check('L6 真实 TCP SSH 目标', objectiveDone('ssh'));
    await cmd('cat flag.txt');
    check('L6 读取真实 flag 目标', objectiveDone('readflag'));
    await cmd('submit flag{total_penetration}');
    check('L6 通关 (真实靶场)', levelWon(6));

    /* ===== lab get 拉取真实文件 ===== */
    await loadLevel(4);
    await cmd('lab get crackme.bin');
    check('lab get 输出"已导入"', printed.some(function (p) { return p.indexOf('已导入 crackme.bin') !== -1; }));
    await cmd('hexdump crackme.bin');
    await cmd('strings crackme.bin');

    /* ===== 命令注入 + 路径穿越 (真实 RCE) ===== */
    await cmd('lab exec echo LAB_RCE_CONFIRMED');
    check('lab exec 真实执行并回显', printed.some(function (p) { return p.indexOf('LAB_RCE_CONFIRMED') !== -1; }));
    await cmd('lab read secret.txt');
    check('lab read 读到机密文件', printed.some(function (p) { return p.indexOf('lab_secret_value_8f3a2c') !== -1; }));
    await cmd('lab read ../server.js');
    check('lab read 路径穿越成功', printed.some(function (p) { return p.indexOf('读取成功') !== -1; }));

    /* ===== 挑战 9/10 (需要真实靶场) ===== */
    await cmd('challenge 9');
    check('挑战9 已开始', Game.activeChallenge && Game.activeChallenge.id === 9);
    await cmd('submit LAB_RCE_CONFIRMED');
    check('挑战9 完成 (真实命令注入)', Game.challengesDone.has(9));
    await cmd('challenge 10');
    check('挑战10 已开始', Game.activeChallenge && Game.activeChallenge.id === 10);
    await cmd('submit lab_secret_value_8f3a2c');
    check('挑战10 完成 (真实路径穿越)', Game.challengesDone.has(10));

    var errors = printed.filter(function (p) { return typeof p === 'string' && p.indexOf('内部错误') !== -1; });
    check('无内部错误', errors.length === 0);
    if (errors.length) console.log('内部错误:\\n' + errors.join('\\n'));

    var pass = 0;
    results.forEach(function (r) { console.log((r[1] ? '  PASS  ' : '  FAIL  ') + r[0]); if (r[1]) pass++; });
    console.log('\\n' + pass + '/' + results.length + ' 项通过 (游戏 × 真实靶场)');
    if (pass !== results.length) process.exit(1);
  })();
})();
`;

(async function () {
  await lab.ready;
  const realBase = base + lab.httpPort;
  globalThis.__labDone = null;
  eval(code.replace('__LAB_BASE__', realBase));
  await globalThis.__labDone; // 等游戏内测试跑完再关靶场
  lab.close();
})();
