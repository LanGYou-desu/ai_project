const { test } = require('node:test');
const assert = require('node:assert');
const lyrics = require('../js/shared/lyrics.js');
const world = require('../js/shared/world.js');
const grammar = require('../js/shared/grammar.js');

test('歌谣生成：用演化词形拼出短句', () => {
  const h = world.evolve({ name: '雾语', seed: 'lyr' });
  const w = world.wordsAt(h, 'root', 19);
  const g = world.grammarAt(h, 'root', 19);
  const songs = lyrics.lyricsFor(w, g);
  assert.ok(songs.length >= 1);
  songs.forEach(s => {
    assert.ok(s.title && s.zh && s.line && s.gloss);
    assert.ok(/^[a-z ]+$/.test(s.line), '词形句应全部来自演化词形: ' + s.line);
  });
});
test('歌谣引用词表齐全', () => {
  const w = {};
  ['战士','狼','看','月亮','孩子','睡','渔夫','拿','鱼','三','火','说','水','敌人','母亲','给'].forEach(g => { w[g] = { word: 'x' }; });
  const words = {};
  Object.keys(w).forEach(g => { words[g] = 'aaa'; });
  const songs = lyrics.lyricsFor(words, grammar.freshGrammar());
  assert.strictEqual(songs.length, 5);
});
