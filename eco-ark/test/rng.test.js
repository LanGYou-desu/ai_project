const { test } = require('node:test');
const assert = require('node:assert');
const rng = require('../js/shared/rng.js');

test('同种子产生完全相同的序列', () => {
  const a = rng.makeRng('ark-1'), b = rng.makeRng('ark-1');
  for (let i = 0; i < 100; i++) assert.strictEqual(a.next(), b.next());
});

test('不同种子产生不同序列', () => {
  const a = rng.makeRng('ark-1'), b = rng.makeRng('ark-2');
  let same = true;
  for (let i = 0; i < 50; i++) if (a.next() !== b.next()) { same = false; break; }
  assert.strictEqual(same, false);
});

test('next 在 [0,1) 区间', () => {
  const r = rng.makeRng('x');
  for (let i = 0; i < 500; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1);
  }
});

test('int / range / chance / pick 行为正确', () => {
  const r = rng.makeRng('y');
  for (let i = 0; i < 200; i++) {
    const n = r.int(3, 7);
    assert.ok(n >= 3 && n <= 7 && Number.isInteger(n));
    const f = r.range(0, 10);
    assert.ok(f >= 0 && f <= 10);
  }
  assert.ok(r.chance(1) === true && r.chance(0) === false);
  const arr = [1, 2, 3, 4, 5];
  const sh = r.shuffle(arr);
  assert.deepStrictEqual(sh.slice().sort(), arr.slice().sort());
});

test('gauss 近似均值 0', () => {
  const r = rng.makeRng('z');
  let sum = 0;
  for (let i = 0; i < 2000; i++) sum += r.gauss();
  assert.ok(Math.abs(sum / 2000) < 0.2);
});
