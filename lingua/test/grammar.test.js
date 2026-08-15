const { test } = require('node:test');
const assert = require('node:assert');
const grammar = require('../js/shared/grammar.js');

test('默认语法正确（含新增字段）', () => {
  const g = grammar.freshGrammar();
  assert.strictEqual(g.wordOrder, 'SVO');
  assert.strictEqual(g.plural, null);
  assert.strictEqual(g.numerals, '一至三');
  assert.strictEqual(g.dual, null);
  assert.strictEqual(g.onom, false);
  assert.strictEqual(g.redup, false);
  assert.strictEqual(g.classifier, null);
  assert.strictEqual(g.perfect, null);
  assert.strictEqual(g.pronouns, false);
  assert.strictEqual(g.honorific, false);
  assert.strictEqual(g.compounding, false);
  assert.strictEqual(g.postpos, null);
});
test('22 种语法事件', () => {
  assert.strictEqual(grammar.EVENTS.length, 22);
});
test('事件只应用一次且能修改状态', () => {
  const g = grammar.freshGrammar();
  grammar.EVENTS.find(e => e.id === 'wo_sov').apply(g);
  assert.strictEqual(g.wordOrder, 'SOV');
  grammar.EVENTS.find(e => e.id === 'dual_n').apply(g);
  assert.strictEqual(g.dual, '-n');
  grammar.EVENTS.find(e => e.id === 'neg_na').apply(g);
  assert.strictEqual(g.negation, '-na');
  grammar.EVENTS.find(e => e.id === 'postpos').apply(g);
  assert.strictEqual(g.postpos, '-ni');
});
test('新事件带时代窗口', () => {
  grammar.EVENTS.forEach(e => {
    if (e.epochLo != null) assert.ok(e.epochLo >= 0 && e.epochLo <= 19);
    if (e.epochHi != null) assert.ok(e.epochHi >= 0 && e.epochHi <= 19);
  });
});
test('freshGrammar 每次都是干净副本', () => {
  const g1 = grammar.freshGrammar(); const g2 = grammar.freshGrammar();
  g1.wordOrder = 'VSO';
  assert.strictEqual(g2.wordOrder, 'SVO');
});
