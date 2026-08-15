'use strict';
// 档案馆-7 测试套件：世界确定性 / 沙盒安全 / 命令正确性 / 全流程通关
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { generateWorld, FLAGS, SEED } = require('../lib/worldgen');
const { createSession } = require('../lib/commands');
const { createGameState } = require('../lib/state');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name + '  ——  ' + e.message);
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-test-'));
const worldA = path.join(tmp, 'worldA');
const worldB = path.join(tmp, 'worldB');

// ---------- 1. 世界生成确定性 ----------
console.log('· 世界生成');
test('确定性：两次生成完全一致（文件树 + 内容）', () => {
  const ra = generateWorld(worldA, { seed: SEED });
  const rb = generateWorld(worldB, { seed: SEED });
  assert.deepStrictEqual(ra.files, rb.files);
  for (const f of ra.files) {
    const a = fs.readFileSync(path.join(worldA, f));
    const b = fs.readFileSync(path.join(worldB, f));
    assert.deepStrictEqual(a, b, '文件内容不一致：' + f);
  }
});
test('世界文件数不少于 60', () => {
  const ra = generateWorld(worldA, { seed: SEED });
  assert.ok(ra.fileCount >= 60, '实际 ' + ra.fileCount);
});
test('13 个口令定义完整', () => {
  assert.strictEqual(FLAGS.length, 13);
  for (const f of FLAGS) {
    assert.ok(f.code && f.act >= 1 && f.act <= 3 && f.flavor);
  }
});

// ---------- 辅助 ----------
let gameN = 0;
function freshGame() {
  const st = path.join(tmp, 'state-' + (++gameN) + '.json');
  const g = createGameState({ stateFile: st });
  const s = createSession({
    root: worldA,
    checkFlag: (c) => g.checkFlag(c),
    getHint: () => g.getHint()
  });
  return { g, s, st };
}
function run(s, line) { return s.exec(line); }

// ---------- 2. 沙盒安全 ----------
console.log('· 沙盒安全');
const evilLines = [
  'cd ..',
  'cat ../../etc/passwd',
  'cat C:/Windows/system.ini',
  'cat C:\\Windows\\system.ini',
  'rm 欢迎.txt',
  'del 欢迎.txt',
  'ls; rm -rf /',
  'cat 欢迎.txt && echo x',
  'echo $(cat 欢迎.txt)',
  'cat 欢迎.txt > out.txt',
  'cat 欢迎.txt >> out.txt',
  'cat /etc/passwd',
  'powershell ls',
  'node -e 1',
  'cmd /c dir',
  '..\\..\\Windows\\win.ini',
  'cat ..\\..\\Windows\\win.ini',
  'dir C:\\',
  'type NUL',
  '\\server\\share\\file',
  'cat 欢迎.txt | base64 -d | rm -rf /',
  'help; cat 欢迎.txt'
];
for (const line of evilLines) {
  test('拒绝：' + line, () => {
    const { s } = freshGame();
    const r = run(s, line);
    assert.notStrictEqual(r.code, 0, '应当拒绝该命令');
    assert.ok(r.output.indexOf('System32') < 0, '输出不应泄漏系统路径');
    assert.ok(r.output.indexOf('win.ini') < 0);
  });
}
test('拒绝后沙盒未被写入（无 out.txt）', () => {
  const { s } = freshGame();
  run(s, 'cat 欢迎.txt > out.txt');
  assert.ok(!fs.existsSync(path.join(worldA, 'out.txt')));
});
test('未知命令被拒', () => {
  const { s } = freshGame();
  const r = run(s, 'sudo ls');
  assert.strictEqual(r.code, 1);
  assert.ok(r.output.indexOf('未知命令') >= 0);
});
test('管道级数上限', () => {
  const { s } = freshGame();
  const r = run(s, 'cat 欢迎.txt | cat | cat | cat | cat | cat | cat | cat | cat');
  assert.strictEqual(r.code, 1);
});

// ---------- 3. 命令正确性 ----------
console.log('· 命令正确性');
test('cat 中文文件', () => {
  const { s } = freshGame();
  const r = run(s, 'cat 欢迎.txt');
  assert.strictEqual(r.code, 0);
  assert.ok(r.output.indexOf('档案馆-7') >= 0);
});
test('cat 多文件拼接', () => {
  const { s } = freshGame();
  const r = run(s, 'cat 档案区/记录01.txt 档案区/记录02.txt');
  assert.strictEqual(r.code, 0);
  assert.ok(r.output.indexOf('日志损坏') >= 0 && r.output.indexOf('2080-11-02') >= 0);
});
test('管道 base64 解码', () => {
  const { s } = freshGame();
  const r = run(s, 'cat 档案区/记录13.txt | base64 -d');
  assert.strictEqual(r.code, 0);
  assert.ok(r.output.indexOf('档案十三') >= 0);
  assert.ok(r.output.indexOf('回收站') >= 0);
});
test('base64 编码', () => {
  const { s } = freshGame();
  const r = run(s, 'base64 -e 温室/北翼/种子.txt');
  assert.ok(r.output.trim().length > 0);
});
test('grep 单文件', () => {
  const { s } = freshGame();
  const r = run(s, 'grep 恢复 回收站/修复日志.txt');
  assert.ok(r.output.indexOf('温室') >= 0);
});
test('grep 递归目录', () => {
  const { s } = freshGame();
  const r = run(s, 'grep 供水 温室');
  assert.ok(r.output.indexOf('常青') >= 0);
});
test('grep -n 定位行号', () => {
  const { s } = freshGame();
  const r = run(s, 'grep -n signal 迷宫/序列.txt');
  assert.ok(r.output.indexOf('37:signal') >= 0, '输出：' + r.output);
});
test('rot13 导航条', () => {
  const { s } = freshGame();
  const r = run(s, 'cat 迷宫/导航.txt | rot13');
  assert.ok(r.output.indexOf('迷宫') >= 0);
});
test('unhex 还原', () => {
  const { s } = freshGame();
  const r = run(s, 'unhex 迷宫/线索.hex');
  assert.strictEqual(r.output.trim(), '回声');
});
test('untar 解压', () => {
  const { s } = freshGame();
  const r = run(s, 'untar 迷宫/包裹.tar 解包');
  assert.strictEqual(r.code, 0);
  const p = run(s, 'cat 解包/密码.txt');
  assert.strictEqual(p.output.trim(), '包裹');
});
test('caesar 凯撒解密', () => {
  const { s } = freshGame();
  run(s, 'untar 迷宫/包裹.tar 解包');
  const r = run(s, 'caesar 解包/密信.txt 7');
  assert.strictEqual(r.output.trim(), 'access-07.log');
});
test('xor 解密核心', () => {
  const { s } = freshGame();
  const r = run(s, 'xor 核心/核心.txt echo');
  assert.ok(r.output.indexOf('echo-core') >= 0);
});
test('碎片拼接 + base64', () => {
  const { s } = freshGame();
  const r = run(s, 'cat 核心/碎片1.txt 核心/碎片2.txt 核心/碎片3.txt 核心/碎片4.txt | base64 -d');
  assert.strictEqual(r.output.trim(), '回声协议');
});
test('find 通配查找', () => {
  const { s } = freshGame();
  const r = run(s, 'find 档案区 -name "记录1*.txt"');
  assert.ok(r.output.indexOf('记录10.txt') >= 0);
  assert.ok(r.output.indexOf('记录13.txt') >= 0);
});
test('strings 提取二进制字符串', () => {
  const { s } = freshGame();
  const r = run(s, 'strings 核心/核心.txt');
  assert.strictEqual(r.code, 0);
});
test('wc 统计', () => {
  const { s } = freshGame();
  const r = run(s, 'wc 迷宫/序列.txt');
  assert.ok(r.output.indexOf('40') >= 0);
});
test('head / tail', () => {
  const { s } = freshGame();
  const h = run(s, 'head 回收站/修复日志.txt 3');
  assert.ok(h.output.indexOf('2081-06-01') >= 0);
  const t = run(s, 'tail 回收站/修复日志.txt 2');
  assert.ok(t.output.indexOf('七号种子') >= 0);
});
test('cd / pwd / ls', () => {
  const { s } = freshGame();
  run(s, 'cd 温室');
  const p = run(s, 'pwd');
  assert.ok(p.output.indexOf('/温室') >= 0);
  const l = run(s, 'ls');
  assert.ok(l.output.indexOf('北翼/') >= 0);
});
test('tree / stat / file / sort / echo', () => {
  const { s } = freshGame();
  const t = run(s, 'tree 温室');
  assert.ok(t.output.indexOf('北翼/') >= 0);
  const stt = run(s, 'stat 欢迎.txt');
  assert.ok(stt.output.indexOf('文件') >= 0);
  const f = run(s, 'file 迷宫/包裹.tar');
  assert.ok(f.output.indexOf('tar') >= 0);
  const so = run(s, 'sort 迷宫/序列.txt | head 3');
  assert.strictEqual(so.code, 0);
  const e = run(s, 'echo 你好');
  assert.ok(e.output.indexOf('你好') >= 0);
});
test('history 记录', () => {
  const { s } = freshGame();
  run(s, 'pwd');
  run(s, 'ls');
  const r = run(s, 'history');
  assert.ok(r.output.indexOf('pwd') >= 0 && r.output.indexOf('ls') >= 0);
});

// ---------- 4. 口令 / 幕次 / 提示 / 持久化 ----------
console.log('· 口令与进度');
test('错误口令被拒', () => {
  const { s } = freshGame();
  const r = run(s, 'flag 错误答案');
  assert.strictEqual(r.code, 1);
});
test('口令大小写不敏感', () => {
  const { g, s } = freshGame();
  const r = run(s, 'flag ECHO-CORE');
  assert.strictEqual(r.code, 0);
  assert.ok(g.getState().solved.indexOf('echo-core') >= 0);
});
test('幕次推进：集齐第一幕 → 第 2 幕', () => {
  const { g, s } = freshGame();
  for (const c of ['深处之门', 'chen7', '档案十三', '温室', '常青', '七号']) {
    const r = run(s, 'flag ' + c);
    assert.ok(r.output.indexOf('✓') >= 0, 'flag 失败：' + c);
  }
  assert.strictEqual(g.getState().act, 2);
  assert.ok(g.getState().story.some(x => x.indexOf('第一幕') >= 0));
});
test('提示系统', () => {
  const { g, s } = freshGame();
  const r = run(s, 'hint');
  assert.ok(r.output.indexOf('提示') >= 0);
  assert.strictEqual(g.getState().hintsUsed, 1);
});
test('进度持久化', () => {
  const st = path.join(tmp, 'persist.json');
  const g1 = createGameState({ stateFile: st });
  g1.checkFlag('chen7');
  const g2 = createGameState({ stateFile: st });
  assert.ok(g2.getState().solved.indexOf('chen7') >= 0);
});

// ---------- 5. 全流程通关 ----------
console.log('· 全流程通关');
test('按谜题设计解法，13 个口令全部解开，游戏完成', () => {
  const { g, s } = freshGame();
  const solve = [
    'cat 诗.txt',
    'flag 深处之门',
    'cat 深处之门/门锁.txt',
    'cat 访客登记表.txt',
    'flag chen7',
    'cat 档案区/记录13.txt | base64 -d',
    'flag 档案十三',
    'grep 恢复 回收站/修复日志.txt',
    'flag 温室',
    'grep 水源 温室/温室日志.log',
    'flag 常青',
    'cat 温室/北翼/种子.txt',
    'flag 七号',
    'cat 迷宫/导航.txt | rot13',
    'flag 迷宫',
    'unhex 迷宫/线索.hex',
    'flag 回声',
    'untar 迷宫/包裹.tar 解包',
    'cat 解包/密码.txt',
    'flag 包裹',
    'caesar 解包/密信.txt 7',
    'grep 回声 迷宫/logs/access-07.log',
    'grep -n signal 迷宫/序列.txt',
    'flag 三十七',
    'cat 迷宫/碎片A.txt 迷宫/碎片B.txt | base64 -d',
    'flag 双拼',
    'cat 核心/碎片1.txt 核心/碎片2.txt 核心/碎片3.txt 核心/碎片4.txt | base64 -d',
    'flag 回声协议',
    'cat 核心/密钥日志.txt',
    'xor 核心/核心.txt echo',
    'flag echo-core'
  ];
  for (const line of solve) {
    const r = run(s, line);
    if (line.indexOf('flag ') === 0) {
      assert.ok(r.output.indexOf('✓') >= 0, '口令未通过：' + line + ' → ' + r.output);
    } else {
      assert.strictEqual(r.code, 0, '命令失败：' + line + ' → ' + r.output);
    }
  }
  const st = g.getState();
  assert.strictEqual(st.solved.length, 13);
  assert.strictEqual(st.done, true);
  assert.strictEqual(st.act, 4);
  assert.ok(st.story.some(x => x.indexOf('激活完成') >= 0));
});

// ---------- 6. 服务器冒烟 ----------
console.log('· 服务器冒烟');
function serverSmoke() {
  return new Promise((resolve) => {
    const port = 8790 + Math.floor(Math.random() * 50);
    const child = spawn(process.execPath, ['server.js', '--no-browser'], {
      cwd: path.join(__dirname, '..'),
      env: Object.assign({}, process.env, { PORT: String(port) }),
      stdio: 'ignore'
    });
    const deadline = Date.now() + 12000;
    const tryFetch = async () => {
      if (Date.now() > deadline) { child.kill(); resolve(false); return; }
      try {
        const r = await fetch('http://127.0.0.1:' + port + '/api/state');
        const d = await r.json();
        child.kill();
        resolve(d && typeof d.act === 'number');
      } catch (e) {
        setTimeout(tryFetch, 300);
      }
    };
    tryFetch();
  });
}
(async () => {
  const okServer = await serverSmoke();
  test('服务器 /api/state 可用', () => {
    assert.ok(okServer, '服务器未能启动或 /api/state 异常');
  });

  console.log('');
  console.log('结果：' + passed + ' 通过，' + failed + ' 失败');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  process.exit(failed > 0 ? 1 : 0);
})();
