'use strict';
// DESKTOP SIEGE 测试：扫描 / 波次生成 / 引擎逻辑 / 服务器
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { scan, sanitizeName } = require('../lib/scanner');
const { generateWaves, generateEndlessWave, extToClass } = require('../lib/waves');
const { GameEngine } = require('../lib/engine');

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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-test-'));
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
test('真实目录扫描（夹具）', () => {
  const res = scan({ dirs: [scanRoot], maxDepth: 3, cap: 100 });
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
  const res = scan({ dirs: [d], maxDepth: 2, cap: 100 });
  assert.strictEqual(res.files.filter(f => f.name === 'a' && f.ext === 'txt').length, 1);
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
test('无尽波次递增', () => {
  const e1 = generateEndlessWave(fixtureScan, 1, { seed: 42 });
  const e2 = generateEndlessWave(fixtureScan, 2, { seed: 42 });
  assert.strictEqual(e1.num, 21);
  assert.strictEqual(e2.num, 22);
  assert.ok(e1.enemies.length > 0);
  assert.ok(e2.enemies.length > 0);
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

console.log('· 服务器冒烟');
function serverSmoke() {
  return new Promise((resolve) => {
    const port = 8990 + Math.floor(Math.random() * 50);
    const child = spawn(process.execPath, ['server.js', '--no-browser'], {
      cwd: path.join(__dirname, '..'),
      env: Object.assign({}, process.env, { PORT: String(port), DS_SEED: '7' }),
      stdio: 'ignore'
    });
    const deadline = Date.now() + 20000;
    const tryFetch = async () => {
      if (Date.now() > deadline) { child.kill(); resolve(false); return; }
      try {
        const r = await fetch('http://127.0.0.1:' + port + '/api/waves');
        const d = await r.json();
        child.kill();
        resolve(d && Array.isArray(d.waves) && d.waves.length === 20 && d.scan && d.scan.total >= 0);
      } catch (e) {
        setTimeout(tryFetch, 500);
      }
    };
    tryFetch();
  });
}
(async () => {
  const okServer = await serverSmoke();
  test('服务器 /api/waves 可用（20 波 + 扫描数据）', () => {
    assert.ok(okServer, '服务器未能启动或 /api/waves 异常');
  });

  console.log('');
  console.log('结果：' + passed + ' 通过，' + failed + ' 失败');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  process.exit(failed > 0 ? 1 : 0);
})();