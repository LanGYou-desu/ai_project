'use strict';
// DESKTOP SIEGE 测试：扫描 / 波次生成 / 引擎逻辑 / 服务器
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const {
  scan, sanitizeName, readCache, defaultProfileDirs, isAllowedRoot, normalizeResult, homeDir
} = require('../lib/scanner');
const {
  generateWaves, generateEndlessWave, extToClass, waveSpec, CLASS_POOLS, EXT_CLASS, namePool
} = require('../lib/waves');
const { GameEngine, CLASS_STATS, POWERUP_KINDS } = require('../lib/engine');
const serverModule = require('../server');

let passed = 0;
let failed = 0;
// 同步/异步（返回 Promise）测试都支持
function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(
        () => { passed++; console.log('  ✓ ' + name); },
        (e) => { failed++; console.log('  ✗ ' + name + '  ——  ' + e.message); }
      );
    }
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name + '  ——  ' + e.message);
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-test-'));
// scanRoot 放在 tmp 内，tmp 作为「home」，这样边界检查（只允许 home 之内的目录）也被覆盖
const scanRoot = path.join(tmp, 'scan');
fs.mkdirSync(path.join(scanRoot, 'Downloads'), { recursive: true });
fs.mkdirSync(path.join(scanRoot, 'Documents'), { recursive: true });
fs.mkdirSync(path.join(scanRoot, 'Pictures'), { recursive: true });
fs.writeFileSync(path.join(scanRoot, 'Downloads', 'crackme.exe'), Buffer.alloc(100));
fs.writeFileSync(path.join(scanRoot, 'Downloads', '资料.zip'), Buffer.alloc(500));
fs.writeFileSync(path.join(scanRoot, 'Downloads', 'readme.txt'), Buffer.alloc(50));
fs.writeFileSync(path.join(scanRoot, 'Documents', '毕业论文终版.docx'), Buffer.alloc(1000));
fs.writeFileSync(path.join(scanRoot, 'Documents', '表格.xlsx'), Buffer.alloc(200));
fs.writeFileSync(path.join(scanRoot, 'Pictures', '风景照.jpg'), Buffer.alloc(800));
fs.writeFileSync(path.join(scanRoot, 'Pictures', '头像.png'), Buffer.alloc(300));
fs.mkdirSync(path.join(scanRoot, 'Documents', 'node_modules'), { recursive: true });
fs.writeFileSync(path.join(scanRoot, 'Documents', 'node_modules', '跳过我.js'), Buffer.alloc(10));

const fixtureScan = {
  files: [
    { name: 'crackme', ext: 'exe', size: 100, dir: 'Downloads' },
    { name: '资料', ext: 'zip', size: 500, dir: 'Downloads' },
    { name: 'readme', ext: 'txt', size: 50, dir: 'Downloads' },
    { name: '毕业论文终版', ext: 'docx', size: 1000, dir: 'Documents' },
    { name: '表格', ext: 'xlsx', size: 200, dir: 'Documents' },
    { name: '风景照', ext: 'jpg', size: 800, dir: 'Pictures' },
    { name: '头像', ext: 'png', size: 300, dir: 'Pictures' }
  ],
  processes: ['explorer', 'svchost', 'node', 'powershell', 'winlogon'],
  largest: { name: '毕业论文终版', ext: 'docx', size: 1000, dir: 'Documents' },
  largestDoc: { name: '毕业论文终版', ext: 'docx', size: 1000, dir: 'Documents' },
  largestMedia: { name: '风景照', ext: 'jpg', size: 800, dir: 'Pictures' },
  largestArchive: { name: '资料', ext: 'zip', size: 500, dir: 'Downloads' },
  counts: { total: 7, processes: 5, byExt: { exe: 1, zip: 1, txt: 1, docx: 1, xlsx: 1, jpg: 1, png: 1 } },
  scannedAt: Date.now()
};

const KNOWN_NAMES = ['crackme.exe', '资料.zip', 'readme.txt', '毕业论文终版.docx', '表格.xlsx', '风景照.jpg', '头像.png', 'explorer', 'svchost', 'node', 'powershell', 'winlogon'];

console.log('· 扫描器');
test('sanitizeName 清理非法字符', () => {
  assert.strictEqual(sanitizeName('a<b>:c?"d"'), 'abcd');
  assert.strictEqual(sanitizeName('非常长的名字'.repeat(10)).length, 26);
});
test('sanitizeName 清理零宽字符 / 前导点 / 空白名', () => {
  assert.strictEqual(sanitizeName('a\u200Bb\ufeffc'), 'abc', '零宽字符应被剔除');
  assert.strictEqual(sanitizeName('..hidden..'), 'hidden', '前导点会伪装成上级目录，必须剔除');
  assert.strictEqual(sanitizeName('   '), '未知文件');
  assert.strictEqual(sanitizeName(''), '未知文件');
});
test('真实目录扫描（夹具）', () => {
  const res = scan({ dirs: [scanRoot], maxDepth: 3, cap: 100, home: tmp });
  assert.ok(res.files.length >= 7, '应收集到夹具文件，实际 ' + res.files.length);
  const names = res.files.map(f => f.name + '.' + f.ext).join(',');
  assert.ok(names.indexOf('毕业论文终版.docx') >= 0);
  assert.ok(names.indexOf('跳过我.js') < 0, 'node_modules 应被跳过');
});
test('去重：同名同后缀只保留一个', () => {
  const d = path.join(tmp, 'dup');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'a.txt'), '1');
  fs.mkdirSync(path.join(d, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(d, 'sub', 'a.txt'), '2');
  const res = scan({ dirs: [d], maxDepth: 2, cap: 100, home: tmp });
  assert.strictEqual(res.files.filter(f => f.name === 'a' && f.ext === 'txt').length, 1);
});
test('边界：拒绝 home 之外的目录', () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-outside-'));
  fs.writeFileSync(path.join(outside, 'SECRET.txt'), 'x');
  try {
    const res = scan({ dirs: [outside], maxDepth: 2, cap: 100, home: tmp });
    assert.strictEqual(res.files.length, 0, 'home 之外的目录不应被扫描');
    assert.strictEqual(isAllowedRoot(outside, tmp), false);
    assert.strictEqual(isAllowedRoot(scanRoot, tmp), true);
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
test('边界：相对路径 / 文件 / 不存在路径都拒绝', () => {
  assert.strictEqual(isAllowedRoot('scan', tmp), false, '相对路径必须拒绝');
  assert.strictEqual(isAllowedRoot(path.join(scanRoot, 'Downloads', 'crackme.exe'), tmp), false, '普通文件不是扫描根');
  assert.strictEqual(isAllowedRoot(path.join(tmp, 'nope'), tmp), false);
});
test('边界：不跟随符号链接', () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-link-'));
  fs.writeFileSync(path.join(outside, 'ESCAPED.txt'), 'x');
  const link = path.join(scanRoot, 'linkdir');
  let linked = false;
  try {
    fs.symlinkSync(outside, link, 'junction');
    linked = true;
  } catch (e) { /* Windows 无权限时跳过 */ }
  try {
    if (!linked) { console.log('     (跳过：本机不允许创建符号链接)'); return; }
    const res = scan({ dirs: [scanRoot], maxDepth: 3, cap: 100, home: tmp });
    const names = res.files.map(f => f.name + '.' + f.ext);
    assert.ok(names.indexOf('ESCAPED.txt') < 0, '不应跟随符号链接读到外部文件');
  } finally {
    try { fs.rmSync(link, { force: true }); } catch (e) { /* 忽略 */ }
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
test('缓存：结构损坏 / 过期 / 禁用都不采用', () => {
  const cacheFile = path.join(tmp, 'cache.json');
  const good = { files: [{ name: 'a', ext: 'txt', size: 1, dir: 'Desktop' }], processes: ['node'], counts: {}, scannedAt: Date.now() };
  fs.writeFileSync(cacheFile, JSON.stringify(good));
  assert.ok(readCache(cacheFile, 3600000), '合法缓存应被采用');
  assert.strictEqual(readCache(cacheFile, -1), null, '负数 TTL 表示禁用缓存');
  fs.writeFileSync(cacheFile, '{"files":');
  assert.strictEqual(readCache(cacheFile, 3600000), null, '损坏 JSON 应被拒绝');
  fs.writeFileSync(cacheFile, JSON.stringify({ files: null, processes: [], counts: {} }));
  assert.strictEqual(readCache(cacheFile, 3600000), null, 'files 非数组应被拒绝');
  fs.writeFileSync(cacheFile, JSON.stringify(Object.assign({}, good, { scannedAt: Date.now() - 10 * 3600000 })));
  assert.strictEqual(readCache(cacheFile, 3600000), null, '过期缓存应被拒绝');
  assert.ok(readCache(cacheFile, 0), 'TTL=0 表示忽略时效');
});
test('扫描结果结构永远完整（含空目录）', () => {
  const empty = path.join(tmp, 'empty');
  fs.mkdirSync(empty, { recursive: true });
  const res = scan({ dirs: [empty], maxDepth: 1, cap: 10, home: tmp });
  assert.deepStrictEqual(res.files, []);
  assert.ok(Array.isArray(res.processes));
  assert.ok(res.counts && typeof res.counts.byExt === 'object');
  const normalized = normalizeResult({});
  assert.deepStrictEqual(normalized.files, []);
  assert.deepStrictEqual(normalized.counts.byExt, {});
});
test('defaultProfileDirs 只返回绝对路径（拿不到主目录就拒绝扫描）', () => {
  const dirs = defaultProfileDirs();
  assert.ok(Array.isArray(dirs));
  for (const d of dirs) assert.ok(path.isAbsolute(d), '目录必须是绝对路径：' + d);
  // 边界拒绝时返回空数组，绝不能返回 'Desktop' 这种相对路径（会被解析到当前工作目录）
  const savedU = process.env.USERPROFILE;
  const savedH = process.env.HOME;
  try {
    process.env.USERPROFILE = 'relative-home';
    process.env.HOME = 'relative-home';
    // 若 os.homedir() 可用则仍返回绝对路径；否则必须是空数组
    for (const d of defaultProfileDirs()) assert.ok(path.isAbsolute(d));
  } finally {
    if (savedU === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = savedU;
    if (savedH === undefined) delete process.env.HOME; else process.env.HOME = savedH;
  }
});

console.log('· 波次生成');
test('20 波 + 4 Boss，确定性', () => {
  const w1 = generateWaves(fixtureScan, { seed: 42, totalWaves: 20 });
  const w2 = generateWaves(fixtureScan, { seed: 42, totalWaves: 20 });
  assert.strictEqual(w1.length, 20);
  assert.strictEqual(w2.length, 20);
  for (let i = 0; i < 20; i++) {
    assert.deepStrictEqual(w1[i].enemies.map(e => e.name), w2[i].enemies.map(e => e.name), '第' + (i + 1) + '波不一致');
  }
  const bossWaves = w1.filter(w => w.boss).map(w => w.num);
  assert.deepStrictEqual(bossWaves, [5, 10, 15, 20]);
});
test('不同种子 → 不同敌人名单', () => {
  const w1 = generateWaves(fixtureScan, { seed: 1, totalWaves: 5 });
  const w2 = generateWaves(fixtureScan, { seed: 2, totalWaves: 5 });
  const names1 = JSON.stringify(w1.map(w => w.enemies.map(e => e.name)));
  const names2 = JSON.stringify(w2.map(w => w.enemies.map(e => e.name)));
  assert.notStrictEqual(names1, names2);
});
test('敌人名字来自真实扫描数据', () => {
  const w = generateWaves(fixtureScan, { seed: 42, totalWaves: 3 });
  const allNames = w.map(x => x.enemies.map(e => e.name)).flat();
  const ok = allNames.every(n => KNOWN_NAMES.indexOf(n) >= 0);
  assert.ok(ok, '所有名字应来自扫描池：' + allNames.join(','));
});
test('extToClass 映射', () => {
  assert.strictEqual(extToClass('exe'), 'rusher');
  assert.strictEqual(extToClass('pdf'), 'tank');
  assert.strictEqual(extToClass('jpg'), 'healer');
  assert.strictEqual(extToClass('txt'), 'fodder');
  assert.strictEqual(extToClass('dll'), 'swarm');
});
test('extToClass 映射唯一：同一扩展名不会同时属于两个类别', () => {
  const owner = {};
  for (const cls of Object.keys(CLASS_POOLS)) {
    for (const ext of CLASS_POOLS[cls]) {
      assert.ok(!owner[ext], ext + ' 同时属于 ' + owner[ext] + ' 与 ' + cls);
      owner[ext] = cls;
    }
  }
  for (const ext of Object.keys(EXT_CLASS)) {
    assert.strictEqual(extToClass(ext), EXT_CLASS[ext]);
    assert.strictEqual(extToClass(ext.toUpperCase()), EXT_CLASS[ext], '大小写不敏感');
  }
  assert.strictEqual(extToClass('zip'), 'tank');
  assert.strictEqual(extToClass('tar'), 'splitter');
  assert.strictEqual(extToClass('unknown'), null);
  assert.strictEqual(extToClass(null), null);
});
test('波次构成与 spec 完全一致（不再被扩展名改写类别）', () => {
  const waves = generateWaves(fixtureScan, { seed: 42, totalWaves: 20 });
  for (let i = 0; i < waves.length; i++) {
    const spec = waveSpec(i);
    const actual = {};
    for (const e of waves[i].enemies) actual[e.cls] = (actual[e.cls] || 0) + 1;
    for (const cls of Object.keys(spec.composition)) {
      assert.strictEqual(actual[cls] || 0, spec.composition[cls],
        '第 ' + (i + 1) + ' 波 ' + cls + ' 数量不符');
    }
    assert.strictEqual(waves[i].enemies.length, spec.count, '第 ' + (i + 1) + ' 波总数不符');
  }
});
test('Boss 波只有一个 boss，且 bossName 与实际 boss 一致', () => {
  const waves = generateWaves(fixtureScan, { seed: 42, totalWaves: 20 });
  for (const w of waves) {
    const bosses = w.enemies.filter(e => e.cls === 'boss');
    if (w.boss) {
      assert.strictEqual(bosses.length, 1, '第 ' + w.num + ' 波应恰好 1 个 boss');
      assert.strictEqual(w.bossName, bosses[0].name, '第 ' + w.num + ' 波 bossName 必须等于真实 boss 名');
      assert.ok(w.bossName, 'bossName 不能为空');
    } else {
      assert.strictEqual(bosses.length, 0, '第 ' + w.num + ' 波不应有 boss');
      assert.strictEqual(w.bossName, null);
    }
  }
});
test('Boss 以该主题最大的真实文件命名', () => {
  const waves = generateWaves(fixtureScan, { seed: 42, totalWaves: 20 });
  const byNum = {};
  for (const w of waves) byNum[w.num] = w.bossName;
  assert.strictEqual(byNum[5], '资料.zip', '下载主题 Boss = 最大压缩包');
  assert.strictEqual(byNum[10], '毕业论文终版.docx', '文档主题 Boss = 最大文档');
  assert.strictEqual(byNum[15], '风景照.jpg', '图片主题 Boss = 最大媒体');
  assert.strictEqual(byNum[20], '毕业论文终版.docx', '系统主题 Boss = 全局最大文件');
  // 没有扫描数据时退化为兜底名，不能是 undefined
  const bare = generateWaves({ files: [], processes: [] }, { seed: 1, totalWaves: 5 });
  assert.strictEqual(bare[4].bossName, '桌面之核');
});
test('无尽波次递增', () => {
  const e1 = generateEndlessWave(fixtureScan, 1, { seed: 42 });
  const e2 = generateEndlessWave(fixtureScan, 2, { seed: 42 });
  assert.strictEqual(e1.num, 21);
  assert.strictEqual(e2.num, 22);
  assert.ok(e1.enemies.length > 0);
  assert.ok(e2.enemies.length > 0);
});
test('无尽波次：每 3 轮一个 Boss，且带 bossName', () => {
  for (const round of [1, 2, 3, 5, 8]) {
    const w = generateEndlessWave(fixtureScan, round, { seed: 42 });
    const bosses = w.enemies.filter(e => e.cls === 'boss');
    assert.strictEqual(w.boss, round % 3 === 2, '第 ' + round + ' 轮 boss 标记');
    assert.strictEqual(bosses.length, w.boss ? 1 : 0);
    if (w.boss) assert.strictEqual(w.bossName, bosses[0].name, '无尽 Boss 也要有名字');
  }
});
test('namePool 对缺失字段的扫描数据不崩溃', () => {
  assert.ok(namePool(null, 'mixed').length > 0);
  assert.ok(namePool({}, 'processes').length > 0);
  assert.ok(namePool({ files: null, processes: null }, 'system').length > 0);
});

// ---------- 引擎辅助：tick 有 0.05s 钳制，用循环模拟真实时间 ----------
const fixtureWaves = [
  { num: 1, theme: 'mixed', boss: false, enemies: [
    { id: 'e1', cls: 'fodder', name: '测试文件.txt' },
    { id: 'e2', cls: 'rusher', name: '恶意.exe' }
  ] },
  { num: 2, theme: 'documents', boss: true, bossName: '巨型档案.pdf', enemies: [
    { id: 'e3', cls: 'boss', name: '巨型档案.pdf' }
  ] }
];

function makeEngine(extra) {
  return new GameEngine(Object.assign({ seed: 7, waves: fixtureWaves }, extra || {}));
}

function advance(g, seconds, input) {
  const steps = Math.max(1, Math.ceil(seconds / 0.05));
  const step = seconds / steps;
  for (let i = 0; i < steps; i++) g.tick(step, input || {});
}

console.log('· 引擎');
test('reset 后处于第 1 波横幅', () => {
  const g = makeEngine();
  const st = g.getState();
  assert.strictEqual(st.wave, 1);
  assert.strictEqual(st.waveState, 'banner');
  assert.strictEqual(g.player.hp, 100);
  assert.strictEqual(g.player.alive, true);
});
test('横幅结束后开始生成敌人', () => {
  const g = makeEngine();
  advance(g, 3.0);
  assert.ok(g.enemies.length > 0, '应有敌人生成');
  assert.strictEqual(g.getState().waveState, 'active');
});
test('敌人会向玩家移动', () => {
  const g = makeEngine();
  advance(g, 3.0);
  const e = g.enemies[0];
  const before = { x: e.x, y: e.y };
  advance(g, 0.5);
  const d1 = Math.abs(before.x - g.player.x) + Math.abs(before.y - g.player.y);
  const d2 = Math.abs(e.x - g.player.x) + Math.abs(e.y - g.player.y);
  assert.ok(d2 < d1, '敌人应靠近玩家');
});
test('子弹伤害敌人并击杀计分', () => {
  const g = makeEngine();
  advance(g, 3.0);
  const e = g.enemies[0];
  const hp0 = e.hp;
  g.damageEnemy(e, 5);
  assert.strictEqual(e.hp, hp0 - 5);
  const score0 = g.score;
  g.damageEnemy(e, 99999);
  assert.ok(g.score > score0, '击杀应加分');
  assert.strictEqual(g.kills, 1);
  assert.strictEqual(g.combo, 1);
});
test('分裂者死后分裂成 3 个碎片', () => {
  const g = makeEngine();
  g.spawnEnemy({ id: 'split1', cls: 'splitter', name: '资料.zip' });
  const sp = g.enemies.find(e => e.id === 'split1');
  g.damageEnemy(sp, 99999);
  const shards = g.enemies.filter(e => e.cls === 'shard');
  assert.strictEqual(shards.length, 3);
});
test('连击衰减', () => {
  const g = makeEngine();
  advance(g, 3.0);
  g.damageEnemy(g.enemies[0], 99999);
  assert.ok(g.combo >= 1);
  advance(g, 4.0);
  assert.strictEqual(g.combo, 0, '3 秒后连击应归零');
});
test('道具效果：护盾 / 治疗 / 冻结 / 穿透', () => {
  const g = makeEngine();
  g.applyPowerup('shield');
  assert.ok(g.player.shield > 0);
  g.player.hp = 10;
  g.applyPowerup('heal');
  assert.ok(g.player.hp > 10);
  g.applyPowerup('freeze');
  assert.ok(g.freeze > 0);
  g.applyPowerup('pierce');
  assert.strictEqual(g.power.pierce, 5);
  g.applyPowerup('rapid');
  assert.ok(g.power.rapid > 0);
});
test('Boss 生成并发射弹幕', () => {
  const g = makeEngine();
  advance(g, 3.0);
  g.forceClearWave();
  assert.ok(g.getState().wave >= 2, '第 1 波应已清除，当前第 ' + g.getState().wave);
  advance(g, 5.5);
  assert.ok(g.boss, 'Boss 应已生成');
  assert.ok(g.bossProjectiles.length > 0, 'Boss 应发射弹幕，实际 ' + g.bossProjectiles.length);
});
test('Boss 被击败后清除标记', () => {
  const g = makeEngine();
  advance(g, 3.0);
  g.forceClearWave();
  advance(g, 4.0);
  assert.ok(g.boss);
  g.damageEnemy(g.boss, 99999999);
  assert.strictEqual(g.boss, null);
  assert.ok(g.score > 0);
});
test('波次清除 → 进入下一波', () => {
  const g = makeEngine();
  advance(g, 3.0);
  g.forceClearWave();
  assert.strictEqual(g.stats.wavesCleared, 1);
  assert.ok(g.getState().wave >= 2);
});
test('超出波次后进入无尽模式', () => {
  const g = makeEngine();
  advance(g, 3.0);
  g.forceClearWave();
  advance(g, 4.0);
  g.forceClearWave();
  advance(g, 0.2);
  const st = g.getState();
  assert.strictEqual(st.endless, true);
  assert.ok(st.wave >= 3);
});
test('玩家被击杀 → gameOver', () => {
  const g = makeEngine();
  advance(g, 3.0);
  g.player.hp = 1;
  for (const e of g.enemies) { e.x = g.player.x + 10; e.y = g.player.y; }
  advance(g, 0.05);
  assert.strictEqual(g.gameOver, true);
  assert.strictEqual(g.player.alive, false);
});
test('玩家移动受边界约束', () => {
  const g = makeEngine();
  g.player.x = 0;
  g.player.y = 0;
  advance(g, 0.1, { left: true, up: true });
  assert.ok(g.player.x >= g.player.radius);
  assert.ok(g.player.y >= g.player.radius);
});
test('确定性：同种子同输入 → 同生成顺序', () => {
  const a = makeEngine();
  const b = makeEngine();
  advance(a, 3.2);
  advance(b, 3.2);
  const idsA = a.enemies.map(e => e.id);
  const idsB = b.enemies.map(e => e.id);
  assert.deepStrictEqual(idsA, idsB);
});
test('射击方向由瞄准输入决定', () => {
  const g = makeEngine();
  advance(g, 3.0, { firing: true, aimX: 800, aimY: 0 });
  const st = g.getState();
  assert.ok(st.bulletCount > 0 || g.bullets.length > 0, '开火应产生子弹');
});
test('穿透弹：同一颗子弹不会对同一敌人重复结算', () => {
  const g = makeEngine();
  g.waveState = 'active';
  const e = g.spawnEnemy({ id: 'pierce-target', cls: 'tank', name: 'big.pdf' });
  e.x = g.player.x + 70; e.y = g.player.y;
  e.hp = e.maxHp = 100000;
  g.power.pierce = 5;
  g.tick(0.02, { firing: true, aimX: e.x, aimY: e.y }); // 只开一枪
  assert.strictEqual(g.bullets.length, 1, '应恰好产生一颗子弹');
  const hp1 = e.hp;
  for (let i = 0; i < 10; i++) g.tick(0.02, { aimX: e.x, aimY: e.y }); // 子弹继续飞过敌人
  const perBullet = hp1 - e.hp;
  assert.strictEqual(perBullet, 12, '一颗穿透弹对同一敌人只应造成一次伤害，实际 ' + perBullet);
});
test('穿透弹可以依次命中不同敌人', () => {
  const g = makeEngine();
  g.waveState = 'active';
  const a = g.spawnEnemy({ id: 'a', cls: 'tank', name: 'a.pdf' });
  const b = g.spawnEnemy({ id: 'b', cls: 'tank', name: 'b.pdf' });
  a.x = g.player.x + 60; a.y = g.player.y; a.hp = a.maxHp = 1e6;
  b.x = g.player.x + 74; b.y = g.player.y; b.hp = b.maxHp = 1e6;
  g.power.pierce = 5;
  const ha = a.hp, hb = b.hp;
  g.tick(0.05, { firing: true, aimX: b.x, aimY: b.y });
  for (let i = 0; i < 10; i++) g.tick(0.02, { aimX: b.x, aimY: b.y });
  assert.strictEqual(ha - a.hp, 12, '第一个敌人应被命中一次');
  assert.strictEqual(hb - b.hp, 12, '穿透后应命中第二个敌人');
});
test('治疗者按固定冷却治疗，不受帧长抖动影响', () => {
  function healOver(step) {
    const g = makeEngine();
    g.waveState = 'active';
    const healer = g.spawnEnemy({ id: 'h', cls: 'healer', name: 'pic.jpg' });
    const ally = g.spawnEnemy({ id: 'a', cls: 'tank', name: 'big.pdf' });
    ally.x = healer.x + 40; ally.y = healer.y;
    ally.hp = 1; ally.maxHp = 1e6;
    const t0 = ally.hp;
    for (let i = 0; i < Math.round(5 / step); i++) g.tick(step, {});
    return ally.hp - t0;
  }
  const smooth = healOver(0.02);
  const coarse = healOver(0.05);
  assert.ok(smooth > 0, '治疗者应该治疗同伴');
  assert.ok(Math.abs(smooth - coarse) <= 20, '不同帧长下治疗量应接近，实际 ' + smooth + ' vs ' + coarse);
});
test('击杀事件带坐标（渲染层不再需要覆盖 damageEnemy）', () => {
  const g = makeEngine();
  const events = [];
  g.onEvent = function (ev) { events.push(ev); };
  const e = g.spawnEnemy({ id: 'evt', cls: 'fodder', name: 'a.txt' });
  e.x = 123; e.y = 456;
  g.damageEnemy(e, 1e9);
  const kill = events.filter(ev => ev.type === 'kill')[0];
  assert.ok(kill, '应发出 kill 事件');
  assert.strictEqual(kill.x, 123);
  assert.strictEqual(kill.y, 456);
  assert.strictEqual(kill.cls, 'fodder');
});
test('开火会发出 shoot 事件（用于音效）', () => {
  const g = makeEngine();
  const events = [];
  g.onEvent = function (ev) { events.push(ev); };
  g.waveState = 'active';
  g.tick(0.05, { firing: true, aimX: 1000, aimY: 500 });
  assert.ok(events.some(ev => ev.type === 'shoot'), '开火应发 shoot 事件');
});
test('碎片名字各不相同且血量随波次成长', () => {
  const g = makeEngine();
  g.waveState = 'active';
  const sp = g.spawnEnemy({ id: 'split', cls: 'splitter', name: 'a.zip' });
  g.damageEnemy(sp, 1e9);
  const shards = g.enemies.filter(e => e.cls === 'shard');
  assert.strictEqual(shards.length, 3);
  const names = shards.map(s => s.name);
  assert.strictEqual(new Set(names).size, 3, '碎片名应互不相同：' + names.join(','));
  assert.ok(shards.every(s => s.hp > 0 && s.hp === s.maxHp));
  assert.ok(CLASS_STATS.shard.hp > 0);
});
test('道具种类与实现一致（6 种，全部有效果）', () => {
  assert.strictEqual(POWERUP_KINDS.length, 6);
  const g = makeEngine();
  const snapshot = function () {
    return JSON.stringify([g.power, g.player.hp, g.player.shield, g.freeze]);
  };
  for (const kind of POWERUP_KINDS) {
    g.player.hp = 10;   // 让治疗类道具也能观察到效果
    g.player.shield = 0;
    const before = snapshot();
    g.applyPowerup(kind);
    assert.notStrictEqual(snapshot(), before, kind + ' 应该产生效果');
  }
});

console.log('· 服务器');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

// 直接发原始 HTTP 报文，绕过 fetch/客户端对 ".." 的规范化
function rawRequest(port, raw, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    let data = '';
    let settled = false;
    let timer = null;
    const done = function (result) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };
    const statusOf = function (data) {
      const m = data.match(/^HTTP\/1\.\d (\d+)/);
      return m ? Number(m[1]) : 0;
    };
    socket.on('connect', () => socket.write(raw));
    socket.on('data', chunk => { data += chunk; });
    socket.on('end', () => done({ text: data, status: statusOf(data) }));
    socket.on('error', () => done({ text: data, status: statusOf(data) }));
    timer = setTimeout(() => done({ text: data, status: statusOf(data) }), timeoutMs || 4000);
    if (timer.unref) timer.unref();
  });
}

function startServer(port) {
  return spawn(process.execPath, ['server.js', '--no-browser'], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env, { PORT: String(port), DS_SEED: '7', NO_BROWSER: '1' }),
    stdio: 'ignore'
  });
}

// 等子进程真正退出，避免测试进程带着未关闭的句柄退出
function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) { resolve(); return; }
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (e) { /* 忽略 */ } resolve(); }, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    try { child.kill(); } catch (e) { clearTimeout(timer); resolve(); }
  });
}

async function waitForServer(port, deadlineMs) {
  const deadline = Date.now() + (deadlineMs || 20000);
  while (Date.now() < deadline) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/api/waves');
      if (r.ok) return true;
    } catch (e) { /* 还没起来 */ }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

(async () => {
  test('静态路径解析：拒绝穿越与目录', () => {
    const PUBLIC_DIR = path.join(__dirname, '..', 'public');
    assert.strictEqual(serverModule.safeJoin(PUBLIC_DIR, '../server.js'), null);
    assert.strictEqual(serverModule.safeJoin(PUBLIC_DIR, '..\\server.js'), null);
    assert.strictEqual(serverModule.safeJoin(PUBLIC_DIR, 'sub/../../server.js'), null);
    assert.strictEqual(serverModule.resolveStatic(PUBLIC_DIR, '../server.js'), null);
    assert.strictEqual(serverModule.resolveStatic(PUBLIC_DIR, '../scan-cache.json'), null);
    assert.ok(serverModule.resolveStatic(PUBLIC_DIR, 'index.html'), '正常文件应可解析');
    assert.strictEqual(serverModule.resolveStatic(PUBLIC_DIR, '.'), null, '目录不应被当作文件');
  });
  test('静态路径解析：符号链接指向 public 之外时拒绝', () => {
    const PUBLIC_DIR = path.join(__dirname, '..', 'public');
    const link = path.join(PUBLIC_DIR, '__ds_link_test__.txt');
    const target = path.join(__dirname, '..', 'package.json');
    let linked = false;
    try { fs.symlinkSync(target, link, 'file'); linked = true; } catch (e) { /* 跳过 */ }
    try {
      if (!linked) { console.log('     (跳过：本机不允许创建符号链接)'); return; }
      assert.strictEqual(serverModule.resolveStatic(PUBLIC_DIR, '__ds_link_test__.txt'), null,
        '符号链接不得把静态目录引出 public/');
    } finally {
      try { fs.rmSync(link, { force: true }); } catch (e) { /* 忽略 */ }
    }
  });

  const port = await freePort();
  const child = startServer(port);
  const up = await waitForServer(port);
  await test('服务器 /api/waves 可用（20 波 + 扫描数据）', async () => {
    assert.ok(up, '服务器未能启动');
  });
  if (!up) await stopServer(child);
  if (up) {
    const waves = await (await fetch('http://127.0.0.1:' + port + '/api/waves')).json();
    await test('/api/waves 结构与种子一致', () => {
      assert.strictEqual(waves.waves.length, 20);
      assert.strictEqual(waves.seed, 7);
      assert.ok(waves.scan && typeof waves.scan.total === 'number');
      assert.ok(Array.isArray(waves.scanData.files));
      const bosses = waves.waves.filter(w => w.boss);
      assert.deepStrictEqual(bosses.map(w => w.num), [5, 10, 15, 20]);
      assert.ok(bosses.every(w => w.bossName), '每个 Boss 波都要有名字');
      for (const w of waves.waves) {
        assert.strictEqual(w.enemies.filter(e => e.cls === 'boss').length, w.boss ? 1 : 0,
          '第 ' + w.num + ' 波 boss 数量');
      }
    });
    await test('路径穿越（原始报文）一律 404，不泄漏服务器文件', async () => {
      const attempts = [
        'GET /../server.js HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n',
        'GET /..%2fserver.js HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n',
        'GET /%2e%2e/server.js HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n',
        'GET /lib/../server.js HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n',
        'GET /..%5cserver.js HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'
      ];
      for (const raw of attempts) {
        const res = await rawRequest(port, raw);
        assert.strictEqual(res.status, 404, '应 404：' + raw.split('\r\n')[0] + ' 实际 ' + res.status);
        assert.ok(res.text.indexOf('createServer') < 0, '不应泄漏 server.js 内容');
      }
    });
    await test('只允许白名单内的 lib 脚本', async () => {
      const ok = await fetch('http://127.0.0.1:' + port + '/lib/rng.js');
      assert.strictEqual(ok.status, 200);
      const bad = await fetch('http://127.0.0.1:' + port + '/lib/scanner.js');
      assert.strictEqual(bad.status, 404, 'scanner.js 不在白名单内');
    });
    await test('超大请求体被拒绝（413），不再读进内存', async () => {
      const over = await rawRequest(port,
        'POST /api/rescan HTTP/1.1\r\nHost: x\r\nContent-Length: 200000\r\nConnection: close\r\n\r\n' + 'A'.repeat(200000));
      assert.strictEqual(over.status, 413, '超限请求体应 413，实际 ' + over.status);
      const declared = await rawRequest(port,
        'POST /api/rescan HTTP/1.1\r\nHost: x\r\nContent-Length: 100000\r\nConnection: close\r\n\r\n');
      assert.strictEqual(declared.status, 413, '仅声明超限也应 413');
    });
    await test('API 方法与未知路径返回 405 / 404 JSON', async () => {
      const wrongMethod = await fetch('http://127.0.0.1:' + port + '/api/rescan', { method: 'GET' });
      assert.strictEqual(wrongMethod.status, 405);
      const unknownApi = await fetch('http://127.0.0.1:' + port + '/api/nope');
      assert.strictEqual(unknownApi.status, 404);
      const badStatic = await fetch('http://127.0.0.1:' + port + '/nope.txt');
      assert.strictEqual(badStatic.status, 404);
      const postStatic = await fetch('http://127.0.0.1:' + port + '/index.html', { method: 'POST', body: 'x' });
      assert.strictEqual(postStatic.status, 405, '静态资源不接受 POST');
    });
    await test('HEAD 请求有头无体', async () => {
      const r = await fetch('http://127.0.0.1:' + port + '/index.html', { method: 'HEAD' });
      assert.strictEqual(r.status, 200);
      assert.ok(Number(r.headers.get('content-length')) > 0, 'HEAD 应带 Content-Length');
      const body = await r.text();
      assert.strictEqual(body, '', 'HEAD 不应有响应体');
    });
    await stopServer(child);
  }

  console.log('');
  console.log('结果：' + passed + ' 通过，' + failed + ' 失败');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  /* 用 exitCode 让事件循环自然排空：直接 process.exit() 会在子进程句柄仍在关闭时
   * 触发 Windows libuv 断言（!(handle->flags & UV_HANDLE_CLOSING)）。
   * 兜底定时器不 unref，保证万一有残留句柄也不会挂死。 */
  process.exitCode = failed > 0 ? 1 : 0;
  var hardExit = setTimeout(function () { process.exit(process.exitCode); }, 1500);
  if (hardExit.unref) hardExit.unref();
})();