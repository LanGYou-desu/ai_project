const { test } = require('node:test');
const assert = require('node:assert');
const rng = require('../js/shared/rng.js');

test('同一种子产生相同序列', () => {
  const a = rng.makeRng('abc'); const b = rng.makeRng('abc');
  const sa = Array.from({length:10}, () => a.next());
  const sb = Array.from({length:10}, () => b.next());
  assert.deepStrictEqual(sa, sb);
});
test('不同种子产生不同序列', () => {
  const a = rng.makeRng('abc'); const b = rng.makeRng('abd');
  assert.notDeepStrictEqual([a.next(),a.next(),a.next()],[b.next(),b.next(),b.next()]);
});
test('int 在区间内', () => {
  const r = rng.makeRng('x');
  for (let i=0;i<100;i++){ const v = r.int(1,3); assert.ok(v>=1 && v<=3); }
});
test('chance 只返回 0/1', () => {
  const r = rng.makeRng('y');
  for (let i=0;i<100;i++){ const v = r.chance(0.5); assert.ok(v===true||v===false); }
});
