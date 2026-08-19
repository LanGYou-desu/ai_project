'use strict';
// 电路沙盒 测试套件（node:test 风格，零依赖）
const assert = require('assert');
const { CT, GATE_TYPES, Circuit } = require('../public/js/circuit');
const { step, settle, DT } = require('../public/js/engine');

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

console.log('电路沙盒 · 引擎（直流）');

test('单电压源节点电压等于源电压', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
  const r = step(c, 0, DT);
  assert.strictEqual(r.ok, true);
  assert.ok(Math.abs(r.voltages.get(1) - 5) < 1e-6, 'V=' + r.voltages.get(1));
});

test('分压器 Vout = Vin*R2/(R1+R2)', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 10 }, [0, 1]);
  c.addComponent(CT.RESISTOR, { r: 1000 }, [1, 2]);
  c.addComponent(CT.RESISTOR, { r: 1000 }, [2, 0]);
  const r = step(c, 0, DT);
  assert.ok(Math.abs(r.voltages.get(2) - 5) < 1e-3, 'V=' + r.voltages.get(2));
});

test('欧姆定律：电阻支路电流', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
  const id = c.addComponent(CT.RESISTOR, { r: 1000 }, [1, 2]);
  c.addComponent(CT.RESISTOR, { r: 1000 }, [2, 0]);
  const r = step(c, 0, DT);
  assert.ok(Math.abs(r.currents.get(id) - 0.0025) < 1e-4, 'I=' + r.currents.get(id));
});

test('并联电压源短路被检测', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
  c.addComponent(CT.VOLTAGE, { v: 6 }, [0, 1]);
  const r = step(c, 0, DT);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => /短路/.test(e)), JSON.stringify(r.errors));
});

test('settle 达到稳态', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
  c.addComponent(CT.RESISTOR, { r: 1000 }, [1, 2]);
  c.addComponent(CT.RESISTOR, { r: 1000 }, [2, 0]);
  const r = settle(c);
  assert.ok(r.ok);
  assert.ok(Math.abs(r.voltages.get(2) - 2.5) < 1e-3, 'V=' + r.voltages.get(2));
});

console.log('电路沙盒 · 引擎（瞬态 / 非线性 / 逻辑门）');

test('RC 充电：电容电压趋近源电压', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
  c.addComponent(CT.RESISTOR, { r: 1000 }, [1, 2]);
  c.addComponent(CT.CAPACITOR, { c: 1e-3 }, [2, 0]); // tau = 1s
  let v;
  for (let i = 0; i < 500; i++) v = step(c, i * DT, DT).voltages.get(2);
  // 5ms 后 Vc ≈ 5*(1-exp(-0.005)) ≈ 0.02494
  assert.ok(Math.abs(v - 0.02494) < 0.001, 'Vc=' + v);
});

test('NOT 门真值表', () => {
  const c = new Circuit();
  const inp = c.addComponent(CT.VOLTAGE, { v: 0 }, [0, 1]);
  c.addComponent(CT.GATE, { gate: GATE_TYPES.NOT }, [1, 2]);
  let r = step(c, 0, DT);
  assert.ok((r.voltages.get(2) || 0) > 4, 'NOT(0) 应为高');
  c.comps.get(inp).params.v = 5;
  for (let i = 0; i < 300; i++) r = step(c, i * DT, DT);
  assert.ok((r.voltages.get(2) || 0) < 1, 'NOT(5) 应为低');
});

test('AND 门真值表', () => {
  const c = new Circuit();
  const a = c.addComponent(CT.VOLTAGE, { v: 0 }, [0, 1]);
  const b = c.addComponent(CT.VOLTAGE, { v: 0 }, [0, 3]);
  c.addComponent(CT.GATE, { gate: GATE_TYPES.AND }, [1, 3, 2]);
  for (const [va, vb, exp] of [[0, 0, 0], [5, 0, 0], [0, 5, 0], [5, 5, 5]]) {
    c.comps.get(a).params.v = va;
    c.comps.get(b).params.v = vb;
    let r;
    for (let i = 0; i < 300; i++) r = step(c, i * DT, DT);
    const out = r.voltages.get(2) || 0;
    const ok = exp === 0 ? out < 1 : out > 4;
    assert.ok(ok, 'AND(' + va + ',' + vb + ')=' + out + ' 期望 ' + exp);
  }
});

test('XOR 门真值表', () => {
  const c = new Circuit();
  const a = c.addComponent(CT.VOLTAGE, { v: 0 }, [0, 1]);
  const b = c.addComponent(CT.VOLTAGE, { v: 0 }, [0, 3]);
  c.addComponent(CT.GATE, { gate: GATE_TYPES.XOR }, [1, 3, 2]);
  for (const [va, vb, exp] of [[0, 0, 0], [5, 0, 5], [0, 5, 5], [5, 5, 0]]) {
    c.comps.get(a).params.v = va;
    c.comps.get(b).params.v = vb;
    let r;
    for (let i = 0; i < 300; i++) r = step(c, i * DT, DT);
    const out = r.voltages.get(2) || 0;
    const ok = exp === 0 ? out < 1 : out > 4;
    assert.ok(ok, 'XOR(' + va + ',' + vb + ')=' + out + ' 期望 ' + exp);
  }
});

test('二极管正向导通', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
  c.addComponent(CT.DIODE, {}, [1, 2]);
  c.addComponent(CT.RESISTOR, { r: 1000 }, [2, 0]);
  const r = step(c, 0, DT);
  assert.ok((r.voltages.get(2) || 0) > 4, '正向二极管应导通');
});

test('二极管反向截止', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);     // 节点 1 = 5V（阴极侧）
  c.addComponent(CT.DIODE, {}, [2, 1]);             // 阳极 2，阴极 1 → 反向偏置
  c.addComponent(CT.RESISTOR, { r: 1000 }, [2, 0]); // 阳极经电阻接地
  const r = step(c, 0, DT);
  assert.ok((r.voltages.get(2) || 0) < 0.1, '反向截止，阳极节点2应接近0, V2=' + r.voltages.get(2));
});

test('NPN 三极管放大区 Ic ≈ β*Ib', () => {
  const c = new Circuit();
  c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);        // Vcc 节点 1
  c.addComponent(CT.RESISTOR, { r: 100000 }, [1, 2]);  // 基极电阻 → base(2)
  const bjtc = c.addComponent(CT.BJT_N, {}, [3, 0, 2]); // collector=3, emitter=0, base=2
  c.addComponent(CT.RESISTOR, { r: 1000 }, [3, 1]);    // 集电极电阻 → Vcc(1)
  const r = settle(c);
  assert.ok(r.ok, JSON.stringify(r.errors));
  const vbe = (r.voltages.get(2) || 0);
  const ibCalc = (5 - vbe) / 100000;
  const ic = r.currents.get(bjtc);
  assert.ok(ic > 0, '集电极电流应为正, ic=' + ic);
  assert.ok(Math.abs(ic / Math.max(ibCalc, 1e-9) - 100) < 30, 'β=' + (ic / Math.max(ibCalc, 1e-9)));
});

console.log('通过 ' + passed + '，失败 ' + failed);
if (failed) process.exit(1);