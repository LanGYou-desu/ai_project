'use strict';
// 电路沙盒 测试套件（node:test 风格，零依赖）
const assert = require('assert');
const { CT, GATE_TYPES, Circuit } = require('../public/js/circuit');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name + '  ——  ' + e.message);
  }
}

console.log('电路沙盒 · 数据模型');

test('Circuit 从 GND 节点 0 开始', () => {
  const c = new Circuit();
  assert.strictEqual(c.nodes.get(0).id, 0);
  assert.strictEqual(c.comps.size, 0);
});

test('addComponent 存储端点与参数', () => {
  const c = new Circuit();
  const id = c.addComponent(CT.RESISTOR, { r: 100 }, [0, 1]);
  assert.strictEqual(id, 1);
  assert.strictEqual(c.comps.get(id).type, CT.RESISTOR);
  assert.strictEqual(c.comps.get(id).params.r, 100);
  assert.deepStrictEqual(c.comps.get(id).terminals.map((t) => t.nodeId), [0, 1]);
});

test('connect/disconnect 改变端点节点', () => {
  const c = new Circuit();
  const id = c.addComponent(CT.RESISTOR, { r: 10 }, [0, null]);
  c.connect(id, 1, 2);
  assert.strictEqual(c.comps.get(id).terminals[1].nodeId, 2);
  c.disconnect(id, 1);
  assert.strictEqual(c.comps.get(id).terminals[1].nodeId, null);
});

test('toJSON/fromJSON 往返', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
  c.addComponent(CT.RESISTOR, { r: 100 }, [1, 2]);
  const j = c.toJSON();
  const c2 = new Circuit().fromJSON(j);
  assert.strictEqual(c2.comps.size, 2);
  assert.strictEqual(c2.nodes.size, 3);
  assert.strictEqual(c2.comps.get(1).params.v, 5);
});

test('clear 重置为仅 GND', () => {
  const c = new Circuit();
  c.addComponent(CT.RESISTOR, { r: 10 }, [0, 1]);
  c.clear();
  assert.strictEqual(c.comps.size, 0);
  assert.strictEqual(c.nodes.size, 1);
});

console.log('通过 ' + passed + '，失败 ' + failed);
if (failed) process.exit(1);