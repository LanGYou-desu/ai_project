const { test } = require('node:test');
const assert = require('node:assert');
const sounds = require('../js/shared/sounds.js');
const rng = require('../js/shared/rng.js');

test('规则池包含 24 条音变，且都有现实参照', () => {
  assert.strictEqual(sounds.RULES.length, 24);
  sounds.RULES.forEach(r => assert.ok(r.real && r.real.length > 0, r.id + ' 应有现实参照'));
});
test('词首/词尾/中间音变行为正确', () => {
  const r = rng.makeRng('t');
  assert.strictEqual(sounds.BY_ID.vshift_front.fn('kalma'), 'kelme');
  assert.strictEqual(sounds.BY_ID.vdrop_final.fn('kalma'), 'kalm');
  assert.strictEqual(sounds.BY_ID.final_dev.fn('wod'), 'wot');
  assert.strictEqual(sounds.BY_ID.palatal.fn('kira'), 'chira');
  assert.strictEqual(sounds.BY_ID.epenthesis.fn('gwa'), 'gawa');
  assert.strictEqual(sounds.BY_ID.cluster_simplify.fn('brata'), 'rata');
  assert.strictEqual(sounds.BY_ID.initial_h.fn('agni'), 'hagni');
});
test('新增规则行为正确', () => {
  const r = rng.makeRng('t');
  assert.strictEqual(sounds.BY_ID.metathesis.fn('brata'), 'rbata');
  assert.strictEqual(sounds.BY_ID.diphthong.fn('woda'), 'woudai');
  assert.strictEqual(sounds.BY_ID.initial_drop.fn('woda'), 'oda');
  assert.strictEqual(sounds.BY_ID.voicing_assim.fn('wolka'), 'wolga');
  assert.strictEqual(sounds.BY_ID.glide.fn('sawru'), 'sauru');
  assert.strictEqual(sounds.BY_ID.final_vowel_raising.fn('woda'), 'wode');
});
test('pickRules 遵守时代窗口与数量上限', () => {
  const r = rng.makeRng('p');
  for (let e=0;e<20;e++){
    const rules = sounds.pickRules(r, 3, e);
    assert.ok(rules.length >= 0 && rules.length <= 3);
    rules.forEach(rl => { assert.ok(rl.epochLo <= e && e <= rl.epochHi); });
  }
});
test('音变后的词仍是合法字母串', () => {
  const r = rng.makeRng('w');
  ['kalma','woda','gwa','sneha','tekwa','wumba','brata','wolka','kraya','fliga'].forEach(w => {
    sounds.RULES.forEach(rl => {
      const out = sounds.applyRule(w, rl, r);
      assert.match(out, /^[a-z]*$/);
    });
  });
});
