const { test } = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function makeGlobal() {
  const sandbox = {
    console: { warn: () => {}, log: () => {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  };
  vm.createContext(sandbox);
  vm.runInContext('self = globalThis; window = globalThis;', sandbox);
  return sandbox;
}

test('LINGUA 全部共享模块可在浏览器式全局环境加载（E1）', () => {
  const sandbox = makeGlobal();
  const dir = path.resolve(__dirname, '../js/shared');
  for (const f of ['rng.js','lexicon.js','sounds.js','grammar.js','worlddata.js','world.js','lyrics.js','storage.js']) {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox, { filename: f });
  }
  assert.ok(sandbox.LINGUA && sandbox.LINGUA.world, 'world 应挂载到全局');
  assert.ok(sandbox.LINGUA.lexicon && sandbox.LINGUA.sounds && sandbox.LINGUA.grammar);
  assert.ok(sandbox.LINGUA.lyrics && sandbox.LINGUA.storage);
  const h = sandbox.LINGUA.world.evolve({ name: '雾语', seed: 'umd' });
  assert.strictEqual(h.branches.length, 7);
});

test('glyphs 无字形兜底且不崩溃（E2）', () => {
  const sandbox = makeGlobal();
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../js/glyphs.js'), 'utf8'), sandbox, { filename: 'glyphs.js' });
  const lex = require('../js/shared/lexicon.js');
  lex.LEXICON.forEach(e => {
    const p = sandbox.LINGUA.glyphs.pictogram(e.gloss);
    assert.ok(p && Array.isArray(p.lines) && Array.isArray(p.circles) && Array.isArray(p.arcs), '字形结构完整: ' + e.gloss);
  });
  const fb = sandbox.LINGUA.glyphs.pictogram('不存在的词');
  assert.ok(fb.lines.length >= 1);
});
