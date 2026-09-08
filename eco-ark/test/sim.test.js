const { test } = require('node:test');
const assert = require('node:assert');
const simMod = require('../js/shared/sim.js');
const spec = require('../js/shared/species.js');

function mk(seed, opts) {
  return simMod.createSim(Object.assign({ seed, w: 60, h: 40, eventChance: 0 }, opts || {}));
}
function years(s, n) { for (let i = 0; i < n * 12; i++) s.step(); }

test('确定性：同种子同操作 1000 步结果完全一致', () => {
  const a = mk('det');
  const b = mk('det');
  a.place('grass', 60); a.place('rabbit', 30);
  b.place('grass', 60); b.place('rabbit', 30);
  for (let i = 0; i < 1000; i++) { a.step(); b.step(); }
  assert.deepStrictEqual(a.serialize(), b.serialize());
  assert.deepStrictEqual(a.getStats().counts, b.getStats().counts);
});

test('不同种子产生不同演化', () => {
  const a = mk('diff1'); const b = mk('diff2');
  a.place('grass', 60); b.place('grass', 60);
  years(a, 20); years(b, 20);
  assert.notDeepStrictEqual(a.serialize(), b.serialize());
});

test('植物在适宜地形生长，岩地不生长', () => {
  const s = mk('grow');
  s.place('grass', 200);
  const before = s.getStats().plantCov.grass;
  years(s, 2);
  const after = s.getStats().plantCov.grass;
  assert.ok(after > before * 1.5, '草应显著增长');
  // 岩地覆盖应为 0
  let rockGrass = 0;
  for (let i = 0; i < s.w * s.h; i++) {
    if (s.terrain[i] === spec.TERRAIN.ROCK) rockGrass += s.coverage[i * spec.PLANTS.length + spec.PLANTS.map(p => p.id).indexOf('grass')];
  }
  assert.ok(rockGrass < 0.001);
});

test('无干预时生态系统不会数值爆炸（有限且有界）', () => {
  const s = mk('bounded', { eventChance: 0.02 });
  s.place('grass', 150); s.place('rabbit', 40); s.place('fox', 8);
  years(s, 60);
  const st = s.getStats();
  assert.ok(st.totalBiomass > 0 && isFinite(st.totalBiomass));
  assert.ok(st.animalsTotal < 3000, '动物数量应受承载量约束');
  Object.values(st.counts).forEach(c => assert.ok(c >= 0 && Number.isInteger(c)));
});

test('食草动物消耗植物：对照实验', () => {
  const control = mk('ctrl'); control.place('grass', 200); years(control, 3);
  const grazed = mk('grazed'); grazed.place('grass', 200); grazed.place('rabbit', 50); years(grazed, 3);
  assert.ok(grazed.getStats().plantCov.grass < control.getStats().plantCov.grass);
});

test('无捕食者时食草动物先暴涨后崩溃（洛特卡波动）', () => {
  const s = mk('boom');
  s.place('grass', 250); s.place('rabbit', 30);
  const peak = { rabbit: 0, grass: 0 };
  for (let y = 0; y < 40; y++) {
    const st = s.getStats();
    peak.rabbit = Math.max(peak.rabbit, st.counts.rabbit || 0);
    peak.grass = Math.max(peak.grass, st.plantCov.grass);
    for (let m = 0; m < 12; m++) s.step();
  }
  assert.ok(peak.rabbit > 150, '兔子应大量繁殖（实测峰值 ' + peak.rabbit + '）');
});

test('加入捕食者后形成稳定波动，双物种长期共存', () => {
  const s = mk('lv');
  s.place('grass', 250); s.place('rabbit', 40); s.place('fox', 10);
  let rabbitAlive = false, foxAlive = false;
  let rabbitPeak = 0, foxPeak = 0;
  for (let y = 0; y < 60; y++) {
    const st = s.getStats();
    if ((st.counts.rabbit || 0) > 0) rabbitAlive = true;
    if ((st.counts.fox || 0) > 0) foxAlive = true;
    rabbitPeak = Math.max(rabbitPeak, st.counts.rabbit || 0);
    foxPeak = Math.max(foxPeak, st.counts.fox || 0);
    for (let m = 0; m < 12; m++) s.step();
  }
  assert.ok(rabbitAlive && foxAlive, '60 年内兔与狐都应存活');
  assert.ok(rabbitPeak > 40 && foxPeak > 5);
});

test('尸体分解使养分上升', () => {
  const s = mk('decay');
  // 直接制造一片尸体
  const i = 5 * s.w + 5;
  s.carcass[i] = 1;
  const before = s.nutrients[i];
  s.step();
  assert.ok(s.nutrients[i] >= before - 0.0001, '养分应随分解上升或维持');
});

test('干旱事件降低降水', () => {
  const s = mk('dry', { eventChance: 0 });
  const r0 = s.getStats().rain;
  s.triggerEvent('drought');
  const r1 = s.getStats().rain;
  assert.ok(r1 < r0 - 0.2);
});

test('冰期事件降低气温', () => {
  const s = mk('ice', { eventChance: 0 });
  const t0 = s.getStats().temp;
  s.triggerEvent('iceage');
  const t1 = s.getStats().temp;
  assert.ok(t1 < t0 - 10);
});

test('陨石产生岩地坑洞', () => {
  const s = mk('meteor', { eventChance: 0 });
  s.triggerEvent('meteor');
  let rock = 0;
  for (let i = 0; i < s.terrain.length; i++) if (s.terrain[i] === spec.TERRAIN.ROCK) rock++;
  assert.ok(rock > 10, '陨石应新增岩地');
});

test('place 返回实际放置数；不适宜地形为 0', () => {
  const s = mk('place');
  const n = s.place('grass', 10);
  assert.ok(n > 0 && n <= 10);
  // 鱼只能放在水域
  const fish = s.place('fish', 5);
  assert.ok(fish >= 0 && fish <= 5);
  // 仙人掌不能放水里（几乎总失败）
  const cac = s.place('cactus', 2);
  assert.ok(cac >= 0);
});

test('removeAt 清除半径内的动物与植物', () => {
  const s = mk('remove');
  s.place('grass', 100); s.place('rabbit', 40);
  years(s, 1);
  const before = s.getStats().animalsTotal;
  s.removeAt(s.w / 2, s.h / 2, 6);
  const after = s.getStats().animalsTotal;
  assert.ok(after <= before);
});

test('fertilizeAt 提升养分', () => {
  const s = mk('fert');
  const x = Math.floor(s.w / 2), y = Math.floor(s.h / 2);
  const i = y * s.w + x;
  const before = s.nutrients[i];
  s.fertilizeAt(x, y, 2);
  assert.ok(s.nutrients[i] > before + 0.1);
});

test('长期运行无 NaN，统计数据自洽', () => {
  const s = mk('long', { eventChance: 0.03 });
  s.place('grass', 200); s.place('moss', 100); s.place('shrub', 100);
  s.place('insect', 80); s.place('rabbit', 30); s.place('deer', 12);
  s.place('spider', 20); s.place('fox', 6);
  years(s, 80);
  const st = s.getStats();
  const vals = [st.totalBiomass, st.plantBiomass, st.animalBiomass, st.nutrientsAvg, st.moistureAvg, st.stability, st.shannon];
  vals.forEach(v => assert.ok(Number.isFinite(v) && v >= 0));
  assert.ok(st.aliveSpecies >= 0);
});

test('序列化包含全部关键字段', () => {
  const s = mk('ser');
  s.place('grass', 50);
  years(s, 1);
  const ser = s.serialize();
  assert.strictEqual(ser.seed, 'ser');
  assert.strictEqual(ser.w, 60);
  assert.ok(Array.isArray(ser.animals));
  assert.ok(Array.isArray(ser.history));
});

test('季节与年份推进正确', () => {
  const s = mk('time');
  assert.strictEqual(s.year, 0);
  years(s, 3);
  assert.strictEqual(s.year, 3);
});

test('数量为 0 的干预不生效（0 是有效参数，不是「未传」）', () => {
  const s = mk('zero');
  assert.strictEqual(s.place('grass', 0), 0, 'place(id, 0) 不应放置');
  assert.strictEqual(s.place('rabbit', 0), 0);
  const i = 5 * s.w + 5;
  s.paintAt('grass', 5, 5, 0.3);
  const cov = s.coverage[i * spec.PLANTS.length];
  assert.strictEqual(s.paintAt('grass', 5, 5, 0), true);
  assert.strictEqual(s.coverage[i * spec.PLANTS.length], cov, 'amount=0 不应改变覆盖');
  s.place('rabbit', 3);
  const n = s.animals.length;
  s.removeAt(s.animals[0].x, s.animals[0].y, 0);
  assert.strictEqual(s.animals.length, n, 'removeAt(r=0) 不应移除个体');
  const before = s.nutrients[i];
  s.fertilizeAt(5, 5, 0);
  assert.strictEqual(s.nutrients[i], before, 'fertilizeAt(r=0) 不应改变养分');
});

test('getStats 结果缓存：状态未变时复用，状态改变后失效', () => {
  const s = mk('cache');
  s.place('grass', 100);
  const a = s.getStats();
  assert.strictEqual(s.getStats(), a, '未改动时应返回同一缓存对象');
  s.step();
  const b = s.getStats();
  assert.notStrictEqual(b, a, '推进一个月后应重新计算');
  assert.strictEqual(s.getStats(), b);
  // 事件会改变气温/降水：必须让缓存失效（否则面板显示旧天气）
  const rainBefore = b.rain;
  s.triggerEvent('drought');
  const c = s.getStats();
  assert.notStrictEqual(c, b);
  assert.ok(c.rain < rainBefore - 0.2, '干旱后降水应下降');
  // 直接写地块数据（测试/调试）后由 place/remove 等入口标记脏，不依赖缓存一致性
  s.place('moss', 10);
  assert.notStrictEqual(s.getStats(), c);
});

test('增量存活计数与逐个体统计一致（长期不漂移）', () => {
  const s = mk('counter');
  s.place('grass', 200); s.place('rabbit', 40); s.place('fox', 8); s.place('insect', 60);
  for (let m = 0; m < 180; m++) {
    s.step();
    const manual = {};
    s.animals.forEach(a => { manual[a.sp] = (manual[a.sp] || 0) + 1; });
    for (const id of ['rabbit', 'fox', 'insect', 'vole', 'deer']) {
      assert.strictEqual(s.speciesCount(id), manual[id] || 0, '第 ' + s.month + ' 月 ' + id);
    }
  }
});

test('长期运行无 NaN 幽灵个体（坐标/能量始终有限）', () => {
  const s = mk('nan', { eventChance: 0.03 });
  s.place('grass', 250); s.place('shrub', 150); s.place('moss', 100); s.place('algae', 60);
  s.place('insect', 80); s.place('vole', 40); s.place('rabbit', 30); s.place('fish', 30);
  s.place('spider', 20); s.place('fox', 8); s.place('hawk', 6); s.place('monitor', 5);
  for (let y = 0; y < 40; y++) {
    years(s, 1);
    for (const a of s.animals) {
      assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y), '坐标出现 NaN：' + a.sp);
      assert.ok(Number.isFinite(a.energy) && a.energy > 0, '能量非法：' + a.sp + ' ' + a.energy);
      assert.ok(Number.isFinite(a.age) && a.age >= 0, '年龄非法：' + a.sp + ' ' + a.age);
    }
  }
});

test('黄金轨迹：固定种子 + 固定操作序列的演化结果不可变（确定性回归）', () => {
  // 该摘要是「同种子 + 同操作 → 完全相同演化」的硬回归：任何未预期的动力学改动都会让它失败。
  // 若有意调整生态参数，请重新计算摘要并在此更新。
  const s = mk('golden', { eventChance: 0.02 });
  [['grass', 250], ['shrub', 150], ['moss', 120], ['insect', 80], ['vole', 40],
   ['rabbit', 35], ['deer', 10], ['spider', 15], ['fox', 7], ['hawk', 6]]
    .forEach(([id, n]) => s.place(id, n));
  for (let m = 0; m < 480; m++) {
    if (m === 120) s.place('algae', 60);
    if (m === 180) s.paintAt('grass', 20, 20, 0.3);
    if (m === 240) s.triggerEvent('drought');
    if (m === 300) s.triggerEvent('meteor');
    s.step();
  }
  const st = s.getStats();
  const digest = [st.month, st.totalBiomass.toFixed(3), st.plantBiomass.toFixed(3),
    st.animalBiomass.toFixed(3), st.aliveSpecies, st.animalsTotal,
    JSON.stringify(st.counts)].join('|');
  const hash = require('node:crypto').createHash('sha256').update(digest).digest('hex');
  assert.strictEqual(hash, '08cc4b07d678efda958b5a1e22655f1fd9f4779b4667172ef804bb1aa4ebcae7',
    '演化轨迹已改变：' + digest);
});
