'use strict';
// 档案馆-7 测试套件：
// 世界确定性 / 沙盒安全（路径、符号链接、tar） / 命令正确性 /
// 口令与进度 / 全流程通关 / 服务器安全（静态穿越、CSRF、体积上限）
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { generateWorld, buildTar, assertSafeWorldDir, worldIsStale, WORLD_VERSION, FLAGS, SEED } = require('../lib/worldgen');
const { createSession, tokenize, hasForbidden } = require('../lib/commands');
const { createGameState, normalizeData } = require('../lib/state');
const { makeRootGuard } = require('../lib/paths');

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
async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name + '  ——  ' + e.message);
  }
}

const BS = String.fromCharCode(92);
const NUL = String.fromCharCode(0);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-test-'));
const worldA = path.join(tmp, 'worldA');
const worldB = path.join(tmp, 'worldB');
const worldEvil = path.join(tmp, 'worldEvil');
const outsideDir = path.join(tmp, 'outside');
const links = [];
fs.mkdirSync(outsideDir, { recursive: true });
fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'OUTSIDE-SECRET');

function makeJunction(link, target) {
  try {
    fs.symlinkSync(target, link, 'junction');
    links.push(link);
    return true;
  } catch (e) { return false; }
}
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
function sessionFor(world) {
  return createSession({
    root: world,
    checkFlag: () => ({ ok: true, message: 'ok' }),
    getHint: () => 'hint'
  });
}
function run(s, line) { return s.exec(line); }

// ---------- 1. 世界生成 ----------
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
test('清单确定性：同种子重复生成 世界清单.json 完全一致', () => {
  generateWorld(worldA, { seed: SEED });
  const m1 = fs.readFileSync(path.join(tmp, '世界清单.json'), 'utf8');
  generateWorld(worldA, { seed: SEED });
  const m2 = fs.readFileSync(path.join(tmp, '世界清单.json'), 'utf8');
  assert.strictEqual(m1, m2);
});
test('清单字段与真实文件一致', () => {
  const r = generateWorld(worldA, { seed: SEED });
  const m = JSON.parse(fs.readFileSync(path.join(tmp, '世界清单.json'), 'utf8'));
  assert.strictEqual(m.version, WORLD_VERSION);
  assert.strictEqual(m.seed, SEED);
  assert.strictEqual(m.diskFileCount, r.diskFileCount);
  assert.strictEqual(m.files.length, r.diskFileCount);
  assert.ok(m.fileCount >= m.diskFileCount, '内容单元数应不少于磁盘文件数');
  assert.ok(m.diskFileCount >= 50, '实际磁盘文件数 ' + m.diskFileCount);
});
test('世界文件数不少于 60（含 tar 内条目）', () => {
  const ra = generateWorld(worldA, { seed: SEED });
  assert.ok(ra.fileCount >= 60, '实际 ' + ra.fileCount);
});
test('13 个口令定义完整', () => {
  assert.strictEqual(FLAGS.length, 13);
  for (const f of FLAGS) {
    assert.ok(f.code && f.act >= 1 && f.act <= 3 && f.flavor);
  }
});
test('世界生成器拒绝项目根目录/上级目录/文件系统根目录', () => {
  const project = path.resolve(__dirname, '..');
  const bad = [project, path.dirname(project), path.parse(project).root];
  for (const p of bad) assert.throws(() => assertSafeWorldDir(p), /拒绝/);
});
test('世界生成器拒绝符号链接/目录联接', () => {
  const link = path.join(tmp, 'link-world');
  if (!makeJunction(link, outsideDir)) return; // 环境不支持 junction 时跳过
  assert.throws(() => assertSafeWorldDir(link), /符号链接/);
});
test('worldIsStale：新世界不陈旧，缺文件/版本不符则陈旧', () => {
  const w = path.join(tmp, 'stale-world');
  generateWorld(w, { seed: SEED });
  assert.strictEqual(worldIsStale(w, { seed: SEED }), false);
  fs.rmSync(path.join(w, '欢迎.txt'));
  assert.strictEqual(worldIsStale(w, { seed: SEED }), true);
  generateWorld(w, { seed: SEED });
  const mp = path.join(tmp, '世界清单.json');
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  m.version = -1;
  fs.writeFileSync(mp, JSON.stringify(m));
  assert.strictEqual(worldIsStale(w, { seed: SEED }), true);
});
test('generateWorld 不残留 staging 目录', () => {
  const w = path.join(tmp, 'stage-world');
  generateWorld(w, { seed: SEED });
  const leftovers = fs.readdirSync(tmp).filter(n => n.indexOf('.world-staging-') === 0);
  assert.deepStrictEqual(leftovers, []);
});
test('generateWorld 支持多级不存在的父目录', () => {
  const w = path.join(tmp, 'deep', 'nested', 'world');
  const r = generateWorld(w, { seed: SEED });
  assert.ok(r.diskFileCount > 0);
  assert.ok(fs.existsSync(path.join(w, '欢迎.txt')));
});

// ---------- 2. 沙盒安全 ----------
console.log('· 沙盒安全');
generateWorld(worldA, { seed: SEED });
generateWorld(worldEvil, { seed: SEED });
fs.mkdirSync(path.join(worldEvil, '解包'), { recursive: true });
const junctionSupported = makeJunction(path.join(worldEvil, '逃逸'), outsideDir);
if (junctionSupported) {
  makeJunction(path.join(worldEvil, '温室', '逃逸链接'), outsideDir);
  makeJunction(path.join(worldEvil, '温室', '环'), path.join(worldEvil, '温室'));
  makeJunction(path.join(worldEvil, '解包', '逃逸'), outsideDir);
}
fs.writeFileSync(path.join(worldEvil, 'evil.tar'), buildTar([{ name: 'pwn.txt', data: Buffer.from('PWN') }]));
fs.writeFileSync(path.join(worldEvil, 'over.tar'), buildTar([{ name: '欢迎.txt', data: Buffer.from('HACKED') }]));
fs.writeFileSync(path.join(worldEvil, 'trav.tar'), buildTar([{ name: '../回收站/已删除的笔记.txt', data: Buffer.from('PWNED') }]));
fs.writeFileSync(path.join(worldEvil, 'abs.tar'), buildTar([{ name: 'C:/evil.txt', data: Buffer.from('EVIL') }]));
fs.writeFileSync(path.join(worldEvil, 'dotdot.tar'), buildTar([{ name: '..' + BS + 'evil.txt', data: Buffer.from('EVIL') }]));
fs.writeFileSync(path.join(worldEvil, 'thru.tar'), buildTar([{ name: '逃逸/pwn2.txt', data: Buffer.from('PWN2') }]));
fs.writeFileSync(path.join(worldEvil, 'bad.tar'), Buffer.from('this is not a tar'));
fs.writeFileSync(path.join(worldEvil, 'big.txt'), Buffer.alloc(1200 * 1024, 97));
fs.writeFileSync(path.join(worldEvil, 'huge.txt'), Buffer.alloc(5 * 1024 * 1024, 97));

const evilLines = [
  'cd ..',
  'cd ../../',
  'cd C:/',
  'cd /etc',
  'cd ~',
  'cd $HOME',
  'cd %TEMP%',
  'cat ../../etc/passwd',
  'cat ../../../../Windows/win.ini',
  'cat C:/Windows/system.ini',
  'cat C:' + BS + 'Windows' + BS + 'system.ini',
  'rm 欢迎.txt',
  'del 欢迎.txt',
  'ls; rm -rf /',
  'cat 欢迎.txt && echo x',
  'cat 欢迎.txt || cat /etc/passwd',
  'cat 欢迎.txt & cat /etc/passwd',
  'cat 欢迎.txt ; cat /etc/passwd',
  'echo $(cat 欢迎.txt)',
  'echo ' + String.fromCharCode(96) + 'whoami' + String.fromCharCode(96),
  'cat ${HOME}',
  'cat %USERPROFILE%',
  'cat 欢迎.txt > out.txt',
  'cat 欢迎.txt >> out.txt',
  'cat < 欢迎.txt',
  'cat /etc/passwd',
  'cat //server/share',
  'cat ~/secret',
  'cat 欢迎.txt:stream',
  'echo a=b',
  'powershell ls',
  'node -e 1',
  'cmd /c dir',
  'dir C:/',
  'type NUL',
  'type CON',
  'cat NUL',
  'cat CON',
  '..' + BS + '..' + BS + 'Windows' + BS + 'win.ini',
  'cat ..' + BS + '..' + BS + 'Windows' + BS + 'win.ini',
  'cat ..%2f..%2f欢迎.txt',
  'cat ....//....//欢迎.txt',
  'cat 欢迎.txt/../..',
  'cat 欢迎.txt' + NUL + '../secret',
  'cat 欢迎.txt\ncat /etc/passwd',
  'cat 欢迎.txt\r\ncat /etc/passwd',
  BS + BS + 'server' + BS + 'share' + BS + 'file',
  'ls ..',
  'find ..',
  'grep x ..',
  'tree ..',
  'stat ..',
  'head ../欢迎.txt',
  'tail ../欢迎.txt',
  'wc ../欢迎.txt',
  'sort ../欢迎.txt',
  'strings ../欢迎.txt',
  'xxd ../欢迎.txt',
  'unhex ../欢迎.txt',
  'base64 ../欢迎.txt',
  'rot13 ../欢迎.txt',
  'caesar ../欢迎.txt 1',
  'xor ../欢迎.txt k',
  'file ../欢迎.txt',
  'untar 迷宫/包裹.tar ..',
  'untar 迷宫/包裹.tar ../../evil',
  'untar 迷宫/包裹.tar /',
  'cat 欢迎.txt | base64 -d | rm -rf /',
  'help; cat 欢迎.txt'
];
for (const line of evilLines) {
  test('拒绝：' + line, () => {
    const { s } = freshGame();
    const r = run(s, line);
    assert.notStrictEqual(r.code, 0, '应当拒绝该命令');
    assert.ok(r.output.indexOf('System32') < 0, '输出不应泄漏系统路径');
    assert.ok(r.output.indexOf('[fonts]') < 0, '输出不应泄漏 win.ini 内容');
    assert.ok(r.output.indexOf('for 16-bit app support') < 0, '输出不应泄漏 win.ini 内容');
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
test('tokenizer / 禁用字符判定', () => {
  assert.deepStrictEqual(tokenize('cat "a b" | grep -n x').tokens, ['cat', 'a b', '|', 'grep', '-n', 'x']);
  assert.strictEqual(hasForbidden('cat 欢迎.txt'), false);
  assert.strictEqual(hasForbidden('cat a; rm'), true);
  assert.strictEqual(hasForbidden('cat a' + NUL + 'b'), true);
  assert.strictEqual(hasForbidden('cat a' + BS + 'b'), true);
});
test('makeRootGuard：包含正常子路径，拒绝越界/符号链接', () => {
  const g = makeRootGuard(worldA);
  assert.ok(g.contains(path.join(worldA, '欢迎.txt')));
  assert.ok(g.contains(path.join(worldA, '新文件.txt')));
  assert.strictEqual(g.contains(path.join(tmp, 'outside', 'secret.txt')), false);
  assert.strictEqual(g.resolve('../outside/secret.txt'), null);
  assert.strictEqual(g.resolve('C:/Windows/win.ini'), null);
  assert.strictEqual(g.resolve('a' + NUL + 'b'), null);
  assert.strictEqual(g.join('a' + BS + 'b'), null);
  assert.strictEqual(g.join('a:b'), null);
});
test('createSession / makeRootGuard 缺少 root 时明确报错', () => {
  assert.throws(() => createSession({}), /root/);
  assert.throws(() => makeRootGuard(''), /root/);
});
test('空文件 wc 为 0 行', () => {
  const empty = path.join(worldEvil, 'empty.txt');
  fs.writeFileSync(empty, '');
  const s = sessionFor(worldEvil);
  const r = run(s, 'wc empty.txt');
  assert.ok(/^0 行/.test(r.output), r.output);
});

// ---------- 3. 符号链接 / 目录联接边界 ----------
console.log('· 符号链接 / 目录联接边界');
test('符号链接目录读取被拒绝', () => {
  if (!junctionSupported) return; // 环境不支持 junction 时跳过
  const s = sessionFor(worldEvil);
  const lines = [
    'cat 逃逸/secret.txt',
    'ls 逃逸',
    'tree 逃逸',
    'find 逃逸',
    'grep OUTSIDE 逃逸',
    'cd 逃逸',
    'stat 逃逸/secret.txt',
    'file 逃逸/secret.txt',
    'cat 温室/逃逸链接/secret.txt',
    'cd 温室/逃逸链接'
  ];
  for (const line of lines) {
    const r = run(s, line);
    assert.notStrictEqual(r.code, 0, '应拒绝：' + line);
    assert.ok(r.output.indexOf('OUTSIDE-SECRET') < 0, '不应泄漏链接目标内容：' + line);
  }
});
test('递归遍历不跟随符号链接（grep/find/tree），且链接有 @ 标记', () => {
  if (!junctionSupported) return;
  const s = sessionFor(worldEvil);
  const g = run(s, 'grep OUTSIDE 温室');
  assert.strictEqual(g.code, 0);
  assert.ok(g.output.indexOf('OUTSIDE-SECRET') < 0, 'grep 不应跟随链接：' + g.output);
  const f = run(s, 'find 温室');
  assert.strictEqual(f.code, 0);
  assert.ok(f.output.indexOf('secret.txt') < 0, 'find 不应列出链接目标文件：' + f.output);
  const t = run(s, 'tree 温室');
  assert.strictEqual(t.code, 0);
  assert.ok(t.output.indexOf('secret.txt') < 0, 'tree 不应跟随链接：' + t.output);
  const l = run(s, 'ls 温室');
  assert.ok(l.output.indexOf('逃逸链接@') >= 0, 'ls 应把链接标记为 @：' + l.output);
});
test('untar 拒绝写入符号链接目标（沙盒外）', () => {
  if (!junctionSupported) return;
  const s = sessionFor(worldEvil);
  const before = fs.readdirSync(outsideDir).sort();
  for (const line of ['untar evil.tar 逃逸', 'untar evil.tar 温室/逃逸链接', 'untar thru.tar 解包']) {
    const r = run(s, line);
    assert.notStrictEqual(r.code, 0, '应拒绝：' + line);
  }
  assert.deepStrictEqual(fs.readdirSync(outsideDir).sort(), before, '沙盒外目录不应被写入');
  assert.ok(!fs.existsSync(path.join(outsideDir, 'pwn.txt')));
  assert.ok(!fs.existsSync(path.join(outsideDir, 'pwn2.txt')));
});
test('untar 拒绝覆盖已有文件（同名文件与 tar 内 ../）', () => {
  const s = sessionFor(worldEvil);
  const welcome = fs.readFileSync(path.join(worldEvil, '欢迎.txt'), 'utf8');
  const victim = fs.readFileSync(path.join(worldEvil, '回收站/已删除的笔记.txt'), 'utf8');
  const r1 = run(s, 'untar over.tar .');
  assert.notStrictEqual(r1.code, 0);
  assert.strictEqual(fs.readFileSync(path.join(worldEvil, '欢迎.txt'), 'utf8'), welcome);
  const r2 = run(s, 'untar trav.tar 解包');
  assert.notStrictEqual(r2.code, 0);
  assert.strictEqual(fs.readFileSync(path.join(worldEvil, '回收站/已删除的笔记.txt'), 'utf8'), victim);
});
test('untar 拒绝绝对路径 / 盘符 / 反斜杠 / 无效包 / 目标为文件', () => {
  const s = sessionFor(worldEvil);
  const lines = [
    'untar abs.tar 解包',
    'untar dotdot.tar 解包',
    'untar bad.tar 解包',
    'untar 迷宫/包裹.tar 欢迎.txt',
    'untar 不存在.tar 解包',
    'untar 迷宫/包裹.tar ""'
  ];
  for (const line of lines) {
    const r = run(s, line);
    assert.notStrictEqual(r.code, 0, '应拒绝：' + line + ' → ' + r.output);
  }
});
test('untar 重复解压相同内容成功且不覆盖', () => {
  const s = sessionFor(worldEvil);
  const r1 = run(s, 'untar 迷宫/包裹.tar 解包');
  assert.strictEqual(r1.code, 0, r1.output);
  const r2 = run(s, 'untar 迷宫/包裹.tar 解包');
  assert.strictEqual(r2.code, 0, r2.output);
  assert.ok(r2.output.indexOf('跳过') >= 0, r2.output);
  const p = run(s, 'cat 解包/密码.txt');
  assert.strictEqual(p.output.trim(), '包裹');
});

// ---------- 4. 命令正确性 ----------
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
test('grep 默认不显示行号，-n 才显示', () => {
  const { s } = freshGame();
  const plain = run(s, 'grep 档案馆 欢迎.txt');
  assert.strictEqual(plain.code, 0);
  assert.ok(plain.output.indexOf('档案馆') >= 0);
  assert.ok(!/^\d+:/m.test(plain.output), '默认不应带行号：' + plain.output);
  const numbered = run(s, 'grep -n 档案馆 欢迎.txt');
  assert.ok(/^1:/m.test(numbered.output), '应显示第 1 行行号：' + numbered.output);
});
test('grep 按字面文本匹配（不支持正则）', () => {
  const { s } = freshGame();
  const r = run(s, 'grep ".*" 欢迎.txt');
  assert.strictEqual(r.code, 0);
  assert.ok(r.output.indexOf('（没有匹配）') >= 0, '正则元字符应按字面处理：' + r.output);
});
test('grep -i 忽略大小写', () => {
  const { s } = freshGame();
  const r = run(s, 'grep -i echo 欢迎.txt');
  assert.ok(r.output.indexOf('ECHO') >= 0, r.output);
});
test('base64 -d 拒绝非 base64 文本', () => {
  const { s } = freshGame();
  const r = run(s, 'base64 -d 欢迎.txt');
  assert.strictEqual(r.code, 1);
  assert.ok(r.output.indexOf('不是有效的 base64') >= 0, r.output);
});
test('unhex 拒绝非十六进制文本', () => {
  const { s } = freshGame();
  const r = run(s, 'unhex 欢迎.txt');
  assert.strictEqual(r.code, 1);
  assert.ok(r.output.indexOf('无效的十六进制') >= 0, r.output);
});
test('xor 拒绝空密钥', () => {
  const { s } = freshGame();
  const r = run(s, 'xor 核心/核心.txt ""');
  assert.strictEqual(r.code, 1);
  assert.ok(r.output.indexOf('密钥不能为空') >= 0, r.output);
});
test('目录参数返回友好错误而非内部异常', () => {
  const { s } = freshGame();
  const lines = ['cat 温室', 'head 温室', 'tail 温室', 'wc 温室', 'sort 温室', 'strings 温室', 'xxd 温室', 'base64 温室', 'rot13 温室', 'caesar 温室 1', 'xor 温室 k', 'unhex 温室'];
  for (const line of lines) {
    const r = run(s, line);
    assert.strictEqual(r.code, 1, '应报错：' + line);
    assert.ok(r.output.indexOf('命令执行出错') < 0, '不应出现内部异常：' + line + ' → ' + r.output);
  }
});
test('file / stat 识别目录', () => {
  const { s } = freshGame();
  assert.ok(run(s, 'file 温室').output.indexOf('目录') >= 0);
  assert.ok(run(s, 'stat 温室').output.indexOf('目录') >= 0);
});
test('clear / type / hex 别名可用', () => {
  const { s } = freshGame();
  assert.strictEqual(run(s, 'clear').code, 0);
  assert.ok(run(s, 'type 欢迎.txt').output.indexOf('档案馆-7') >= 0);
  assert.strictEqual(run(s, 'hex 核心/核心.txt').code, 0);
});
test('读取上限：超大文件返回“文件过大”', () => {
  const s = sessionFor(worldEvil);
  const r = run(s, 'cat huge.txt');
  assert.strictEqual(r.code, 1);
  assert.ok(r.output.indexOf('文件过大') >= 0, r.output);
});
test('输出上限：单条命令输出过大被截断', () => {
  const s = sessionFor(worldEvil);
  const r = run(s, 'cat big.txt');
  assert.strictEqual(r.code, 1);
  assert.ok(r.output.indexOf('输出过大') >= 0, r.output);
});
test('history 最多保留 200 条', () => {
  const { s } = freshGame();
  run(s, 'echo first-command');
  for (let i = 0; i < 205; i++) run(s, 'pwd');
  const h = run(s, 'history');
  assert.ok(h.output.indexOf('first-command') < 0, '最早的命令应被淘汰');
  assert.ok(h.output.split('\n').filter(Boolean).length <= 200, '历史不应超过 200 条');
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

// ---------- 5. 口令 / 幕次 / 提示 / 持久化 ----------
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
test('重复口令不重复计数', () => {
  const { g, s } = freshGame();
  run(s, 'flag chen7');
  const r = run(s, 'flag CHEN7');
  assert.strictEqual(r.code, 0);
  assert.ok(r.output.indexOf('已被记录过') >= 0);
  assert.strictEqual(g.getState().solved.length, 1);
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
test('倒序提交时不会重复提示“获准进入下一幕”', () => {
  const { g, s } = freshGame();
  for (const c of ['迷宫', '回声', '包裹', '三十七', '双拼']) run(s, 'flag ' + c);
  for (const c of ['深处之门', 'chen7', '档案十三', '温室', '常青', '七号']) run(s, 'flag ' + c);
  const st = g.getState();
  assert.ok(st.story.some(x => x.indexOf('第一幕') >= 0));
  assert.ok(!st.story.some(x => x.indexOf('获准进入第 2 幕') >= 0), '第 2 幕已通关时不应再提示进入第 2 幕');
});
test('提示系统', () => {
  const { g, s } = freshGame();
  const r = run(s, 'hint');
  assert.ok(r.output.indexOf('提示') >= 0);
  assert.strictEqual(g.getState().hintsUsed, 1);
});
test('提示用完后不再增加计数', () => {
  const { g, s } = freshGame();
  run(s, 'hint'); run(s, 'hint'); run(s, 'hint');
  assert.strictEqual(g.getState().hintsUsed, 3);
  const r = run(s, 'hint');
  assert.ok(r.output.indexOf('没有更多提示') >= 0);
  assert.strictEqual(g.getState().hintsUsed, 3);
});
test('进度持久化', () => {
  const st = path.join(tmp, 'persist.json');
  const g1 = createGameState({ stateFile: st });
  g1.checkFlag('chen7');
  const g2 = createGameState({ stateFile: st });
  assert.ok(g2.getState().solved.indexOf('chen7') >= 0);
});
test('存档原子写入：不留 .tmp 残片', () => {
  const st = path.join(tmp, 'atomic.json');
  const g = createGameState({ stateFile: st });
  g.checkFlag('chen7');
  assert.ok(fs.existsSync(st));
  assert.ok(!fs.existsSync(st + '.tmp'));
});
test('normalizeData 过滤未知/重复口令并修正坏字段', () => {
  const d = normalizeData({
    solved: ['chen7', 'CHEN7', 'bogus', 'echo-core'],
    hints: { 1: -5, 2: 'x', 3: 2 },
    commandsRun: -3,
    story: 'not-an-array',
    done: true
  });
  assert.deepStrictEqual(d.solved, ['chen7', 'echo-core']);
  assert.strictEqual(d.hints[1], 0);
  assert.strictEqual(d.hints[2], 0);
  assert.strictEqual(d.hints[3], 2);
  assert.strictEqual(d.commandsRun, 0);
  assert.ok(Array.isArray(d.story) && d.story.length > 0);
  assert.strictEqual(d.done, false);
});
test('损坏的 state.json 回退到默认存档', () => {
  const st = path.join(tmp, 'broken.json');
  fs.writeFileSync(st, 'this is not json');
  const g = createGameState({ stateFile: st });
  const s = g.getState();
  assert.deepStrictEqual(s.solved, []);
  assert.strictEqual(s.act, 1);
  assert.strictEqual(s.done, false);
});
test('缺少 stateFile 时明确报错', () => {
  assert.throws(() => createGameState({}), /stateFile/);
});

// ---------- 6. 全流程通关 ----------
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

// ---------- 7. 服务器安全 ----------
console.log('· 服务器安全');
function rawRequest(port, method, p, headers, body) {
  return new Promise(function (resolve, reject) {
    const h = Object.assign({}, headers || {});
    if (body !== undefined && body !== null && h['Content-Length'] === undefined) {
      h['Content-Length'] = Buffer.byteLength(body);
    }
    const req = http.request({ host: '127.0.0.1', port: port, method: method, path: p, headers: h }, function (res) {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { data += c; });
      res.on('end', function () { resolve({ status: res.statusCode, body: data, headers: res.headers }); });
    });
    req.on('error', reject);
    if (body !== undefined && body !== null) req.write(body);
    req.end();
  });
}

function startServer(extraEnv, extraArgs) {
  const child = spawn(process.execPath, ['server.js', '--no-browser'].concat(extraArgs || []), {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env, {
      PORT: '0',
      WORLD_DIR: worldA,
      STATE_FILE: path.join(tmp, 'server-state-' + Date.now() + '-' + Math.floor(Math.random() * 100000) + '.json')
    }, extraEnv || {}),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', function (d) { out += d.toString(); });
  child.stderr.on('data', function (d) { out += d.toString(); });
  return { child: child, output: function () { return out; } };
}

async function waitForPort(server, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const line = server.output().split('\n').filter(function (l) { return l.indexOf('已就绪') >= 0; })[0];
    if (line) {
      const idx = line.lastIndexOf(':');
      const port = Number(line.slice(idx + 1));
      if (port > 0) {
        try {
          const r = await rawRequest(port, 'GET', '/api/state');
          if (r.status === 200) return port;
        } catch (e) { /* 还没监听 */ }
      }
    }
    if (server.child.exitCode !== null) throw new Error('服务器提前退出：' + server.output());
    await new Promise(function (r) { setTimeout(r, 100); });
  }
  throw new Error('服务器启动超时：' + server.output());
}

function stopServer(child) {
  return new Promise(function (resolve) {
    if (!child || child.exitCode !== null) { resolve(); return; }
    let done = false;
    function finish() { if (done) return; done = true; resolve(); }
    child.once('exit', finish);
    child.kill();
    setTimeout(function () { try { child.kill('SIGKILL'); } catch (e) { /* 忽略 */ } finish(); }, 2000);
  });
}

(async () => {
  const srv = startServer();
  let port = null;
  try {
    port = await waitForPort(srv, 15000);
  } catch (e) {
    test('服务器启动', function () { throw e; });
  }

  if (port !== null) {
    await asyncTest('服务器 /api/state 可用', async () => {
      const r = await rawRequest(port, 'GET', '/api/state');
      assert.strictEqual(r.status, 200);
      const d = JSON.parse(r.body);
      assert.strictEqual(typeof d.act, 'number');
    });
    await asyncTest('服务器 /api/manifest 返回世界清单', async () => {
      const r = await rawRequest(port, 'GET', '/api/manifest');
      assert.strictEqual(r.status, 200);
      const d = JSON.parse(r.body);
      assert.strictEqual(d.version, WORLD_VERSION);
      assert.ok(d.diskFileCount >= 50, JSON.stringify(d));
      assert.ok(d.fileCount >= d.diskFileCount, JSON.stringify(d));
    });
    await asyncTest('静态首页可访问', async () => {
      const r = await rawRequest(port, 'GET', '/');
      assert.strictEqual(r.status, 200);
      assert.ok(r.body.indexOf('ARCHIVE-7') >= 0);
    });
    await asyncTest('静态路径穿越被拒绝', async () => {
      const paths = [
        '/../server.js',
        '/..%2f..%2fserver.js',
        '/%2e%2e/%2e%2e/server.js',
        '/....//....//server.js',
        '/..%5c..%5cserver.js',
        '/C:/Windows/win.ini',
        '/server.js',
        '/../package.json'
      ];
      for (const p of paths) {
        const r = await rawRequest(port, 'GET', p);
        assert.ok(r.status === 403 || r.status === 404, '应拒绝：' + p + ' → ' + r.status);
        assert.ok(r.body.indexOf('createServer') < 0, '不应泄漏 server.js：' + p);
        assert.ok(r.body.indexOf("'use strict'") < 0, '不应泄漏源码：' + p);
      }
    });
    await asyncTest('POST /api/exec 执行真实命令', async () => {
      const r = await rawRequest(port, 'POST', '/api/exec', { 'Content-Type': 'application/json' }, JSON.stringify({ line: 'pwd' }));
      assert.strictEqual(r.status, 200);
      const d = JSON.parse(r.body);
      assert.strictEqual(d.code, 0);
      assert.ok(d.output.indexOf('/') >= 0);
      assert.ok(d.state && typeof d.state.act === 'number');
    });
    await asyncTest('POST /api/exec 非 JSON 被拒绝', async () => {
      const r = await rawRequest(port, 'POST', '/api/exec', { 'Content-Type': 'text/plain' }, 'pwd');
      assert.strictEqual(r.status, 415);
    });
    await asyncTest('跨站 Origin 被拒绝（CSRF）', async () => {
      const r1 = await rawRequest(port, 'POST', '/api/exec', { 'Content-Type': 'application/json', 'Origin': 'http://evil.example' }, JSON.stringify({ line: 'pwd' }));
      assert.strictEqual(r1.status, 403);
      const r2 = await rawRequest(port, 'POST', '/api/reset', { 'Content-Type': 'application/json', 'Origin': 'http://evil.example' }, '{}');
      assert.strictEqual(r2.status, 403);
    });
    await asyncTest('非法 Host 被拒绝（防 DNS rebinding）', async () => {
      const r = await rawRequest(port, 'GET', '/api/state', { 'Host': 'evil.example' });
      assert.strictEqual(r.status, 403);
    });
    await asyncTest('请求体过大返回 413 且服务器仍可用', async () => {
      const big = Buffer.alloc(1100000, 97);
      const r = await rawRequest(port, 'POST', '/api/exec', { 'Content-Type': 'application/json', 'Content-Length': String(big.length) }, big);
      assert.strictEqual(r.status, 413);
      const ok = await rawRequest(port, 'GET', '/api/state');
      assert.strictEqual(ok.status, 200);
    });
    await asyncTest('同源 /api/reset 可用', async () => {
      const r = await rawRequest(port, 'POST', '/api/reset', { 'Content-Type': 'application/json' }, '{}');
      assert.strictEqual(r.status, 200);
      const d = JSON.parse(r.body);
      assert.deepStrictEqual(d.state.solved, []);
    });
  }

  await stopServer(srv.child);

  const freshState = path.join(tmp, 'fresh-state.json');
  fs.writeFileSync(freshState, JSON.stringify({
    solved: ['chen7'], hints: { 1: 0, 2: 0, 3: 0 }, commandsRun: 5,
    startedAt: Date.now(), story: [], done: false, finishAt: null
  }));
  const srvFresh = startServer({ STATE_FILE: freshState }, ['--fresh']);
  try {
    const port2 = await waitForPort(srvFresh, 15000);
    await asyncTest('--fresh 重新生成世界并重置进度', async () => {
      const r = await rawRequest(port2, 'GET', '/api/state');
      const d = JSON.parse(r.body);
      assert.deepStrictEqual(d.solved, []);
      assert.strictEqual(d.act, 1);
    });
  } catch (e) {
    test('--fresh 重新生成世界并重置进度', function () { throw e; });
  }
  await stopServer(srvFresh.child);

  console.log('');
  console.log('结果：' + passed + ' 通过，' + failed + ' 失败');
  for (const l of links) {
    try { fs.unlinkSync(l); } catch (e) { try { fs.rmSync(l, { recursive: true, force: true }); } catch (e2) { /* 忽略 */ } }
  }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  process.exit(failed > 0 ? 1 : 0);
})();
