const { test } = require('node:test');
const assert = require('node:assert');
const simMod = require('../js/shared/sim.js');
const chapters = require('../js/shared/chapters.js');
const knowledge = require('../js/shared/knowledge.js');
const spec = require('../js/shared/species.js');

function mk(seed, opts) {
  return simMod.createSim(Object.assign({ seed, w: 60, h: 40, eventChance: 0 }, opts || {}));
}
function years(s, n) { for (let i = 0; i < n * 12; i++) s.step(); }

test('共 6 章，编号连续', () => {
  assert.strictEqual(chapters.total, 6);
  for (let i = 1; i <= 6; i++) assert.ok(chapters.byNo(i), '缺少第 ' + i + ' 章');
});

test('章节目标初始均未完成', () => {
  const s = mk('c1');
  const r = chapters.update(1, s, chapters.createState(1));
  assert.strictEqual(r.allDone, false);
  assert.ok(Object.keys(r.objectives).length >= 2);
});

test('第一章：放置 3 种植物后目标 1 达成', () => {
  const s = mk('c1b');
  const st = chapters.createState(1);
  st.placedSet['grass'] = true; st.placedSet['moss'] = true; st.placedSet['shrub'] = true;
  const r = chapters.update(1, s, st);
  assert.strictEqual(r.objectives.o1.done, true);
});

test('第一章：覆盖率达到并保持 3 年后目标 2 达成', () => {
  const s = mk('c1c');
  const st = chapters.createState(1);
  st.placedSet['grass'] = true; st.placedSet['moss'] = true; st.placedSet['shrub'] = true;
  s.place('grass', 300); s.place('moss', 200); s.place('shrub', 200);
  let r;
  for (let y = 0; y < 6; y++) {
    for (let m = 0; m < 12; m++) s.step();
    r = chapters.update(1, s, st);
  }
  assert.ok(chapters.plantCoverage(s) >= 0.2, '覆盖率应达标（实测 ' + chapters.plantCoverage(s).toFixed(2) + '）');
  assert.strictEqual(r.objectives.o2.done, true);
});

test('第二章：食草动物 ≥60 且持续 8 年', () => {
  const s = mk('c2');
  const st = chapters.createState(2);
  s.place('grass', 250); s.place('rabbit', 40); s.place('insect', 60);
  let r;
  for (let y = 0; y < 14; y++) {
    for (let m = 0; m < 12; m++) s.step();
    r = chapters.update(2, s, st);
    if (r.allDone) break;
  }
  assert.ok(r.allDone, '第 2 章应能达成：herb=' + chapters.herbCount(s));
});

test('第三章：三营养级共存 + 捕食者达标 + 级联', () => {
  const s = mk('c3');
  const st = chapters.createState(3);
  s.place('grass', 250); s.place('shrub', 150);
  s.place('rabbit', 45); s.place('vole', 40); s.place('insect', 80);
  s.place('fox', 8); s.place('spider', 15);
  let r;
  for (let y = 0; y < 30; y++) {
    for (let m = 0; m < 12; m++) s.step();
    r = chapters.update(3, s, st);
    if (r.allDone) break;
  }
  assert.ok(r.allDone, '第 3 章应能达成，目标状态：' + JSON.stringify(Object.keys(r.objectives).map(k => [k, r.objectives[k].done])));
});

test('第四/五章 update 不抛异常且可运行', () => {
  const s = mk('c45');
  s.place('grass', 250); s.place('rabbit', 40); s.place('fox', 8);
  const st4 = chapters.createState(4);
  let r4;
  for (let y = 0; y < 20; y++) {
    for (let m = 0; m < 12; m++) s.step();
    r4 = chapters.update(4, s, st4);
  }
  assert.ok(r4);
  const st5 = chapters.createState(5);
  s.triggerEvent('vine');
  let r5;
  for (let y = 0; y < 10; y++) {
    for (let m = 0; m < 12; m++) s.step();
    r5 = chapters.update(5, s, st5);
  }
  assert.ok(r5);
});

test('评分返回 1~3 星', () => {
  const s = mk('rate');
  s.place('grass', 300); s.place('rabbit', 40); s.place('fox', 8);
  years(s, 15);
  const st = chapters.createState(3);
  const r = chapters.update(3, s, st);
  const rating = chapters.rate(3, s, st, r);
  assert.ok(rating.stars >= 1 && rating.stars <= 3);
  assert.ok(rating.score >= 0 && rating.score <= 1);
});

test('知识图鉴 13 条，按章节解锁', () => {
  assert.strictEqual(knowledge.CONCEPTS.length, 13);
  assert.strictEqual(knowledge.unlocked(1).length, 2);
  assert.strictEqual(knowledge.unlocked(6).length, 13);
  assert.ok(knowledge.byId('lotka').title.includes('洛特卡'));
});

test('物种按章节解锁数量递增', () => {
  const n1 = spec.unlocked(1).length;
  const n3 = spec.unlocked(3).length;
  const n6 = spec.unlocked(6).length;
  assert.ok(n1 < n3 && n3 < n6);
});
