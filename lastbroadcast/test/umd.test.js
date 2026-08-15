const { test } = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('LASTBROADCAST 全部共享模块可在浏览器式全局环境加载（E1）', () => {
  const sandbox = { console: { warn: () => {} }, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
  vm.createContext(sandbox);
  vm.runInContext('self = globalThis; window = globalThis;', sandbox);
  const dir = path.resolve(__dirname, '../js/shared');
  for (const f of ['data.js', 'engine.js', 'storage.js']) {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox, { filename: f });
  }
  assert.ok(sandbox.LB && sandbox.LB.engine && sandbox.LB.data && sandbox.LB.storage);
  const g = sandbox.LB.engine.createGame('umd');
  assert.strictEqual(g.turn, 0);
  const r = sandbox.LB.engine.applyAction(g, { type: 'silence' });
  assert.ok(!r.error);
});
