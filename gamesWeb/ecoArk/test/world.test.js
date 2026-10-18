const { test } = require('node:test');
const assert = require('node:assert');
const world = require('../js/shared/world.js');
const spec = require('../js/shared/species.js');

test('地形生成：含水、以草地为主、无空白', () => {
  const w = world.create('t1', 84, 54);
  const st = world.terrainStats(w);
  assert.ok(st[spec.TERRAIN.WATER] > 50, '应存在水域');
  assert.ok(st[spec.TERRAIN.GRASS] > st[spec.TERRAIN.FOREST], '草地应多于林地');
  assert.strictEqual(Object.values(st).reduce((a, b) => a + b, 0), 84 * 54);
});

test('同种子地形完全一致', () => {
  const a = world.create('same', 60, 40);
  const b = world.create('same', 60, 40);
  assert.deepStrictEqual(Array.from(a.terrain), Array.from(b.terrain));
  assert.deepStrictEqual(Array.from(a.moisture.map(v => +v.toFixed(4))), Array.from(b.moisture.map(v => +v.toFixed(4))));
});

test('不同种子地形不同', () => {
  const a = world.create('w-a', 60, 40);
  const b = world.create('w-b', 60, 40);
  let diff = 0;
  for (let i = 0; i < a.terrain.length; i++) if (a.terrain[i] !== b.terrain[i]) diff++;
  assert.ok(diff > 100, '两种子的地形应有明显差异');
});

test('水域水分 1，岩石水分低', () => {
  const w = world.create('t2', 60, 40);
  let waterOk = true, rockLow = true, waterFound = false;
  for (let i = 0; i < w.terrain.length; i++) {
    if (w.terrain[i] === spec.TERRAIN.WATER) { waterFound = true; if (w.moisture[i] !== 1) waterOk = false; }
    if (w.terrain[i] === spec.TERRAIN.ROCK && w.moisture[i] > 0.6) rockLow = false;
  }
  assert.ok(waterFound && waterOk && rockLow);
});

test('物种数据完整性：21 种，id 唯一', () => {
  assert.strictEqual(spec.ALL.length, 21);
  const ids = new Set(spec.ALL.map(s => s.id));
  assert.strictEqual(ids.size, 21);
  spec.ALL.forEach(s => {
    assert.ok(s.name && s.emoji && s.color && s.desc);
    assert.ok(typeof s.unlock === 'number');
  });
});

test('unlocked(chapter) 按章节筛选', () => {
  const early = spec.unlocked(1);
  assert.ok(early.some(s => s.id === 'grass'));
  assert.ok(!early.some(s => s.id === 'mammoth'));
  assert.ok(spec.unlocked(4).some(s => s.id === 'mammoth'));
});
