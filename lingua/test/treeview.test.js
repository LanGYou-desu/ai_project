const { test } = require('node:test');
const assert = require('node:assert');
const treeview = require('../js/treeview.js');
const world = require('../js/shared/world.js');

// 记录所有写入的样式，并在写入 undefined 时立刻报错（这正是旧实现的取色 bug）
function makeCtx(record) {
  const state = {};
  return new Proxy(state, {
    get(t, k) {
      if (k in t) return t[k];
      return function () {};
    },
    set(t, k, v) {
      if (v === undefined) throw new Error('ctx.' + String(k) + ' 被设为 undefined');
      if (k === 'strokeStyle' || k === 'fillStyle') record.push(String(v));
      t[k] = v;
      return true;
    }
  });
}

test('轨道布局归一化到 0..1 且各分支互不相同', () => {
  const h = world.evolve({ name: '雾语', seed: 'tree1' });
  const lanes = treeview.layout(h);
  const ys = h.branches.map(b => lanes[b.id]);
  ys.forEach(y => assert.ok(y >= 0 && y <= 1, '轨道应在 0..1: ' + y));
  assert.strictEqual(new Set(ys).size, ys.length, '每个分支应占一条独立轨道');
});

test('分支取色下标为合法整数（旧实现取到 undefined 导致全树同色）', () => {
  for (const seed of ['tree1', 'tree2', 'n4', 'n15']) {
    const h = world.evolve({ name: '雾语', seed });
    const ci = treeview.colorIndex(h);
    h.branches.forEach(b => {
      const i = ci[b.id];
      assert.strictEqual(i, Math.floor(i), '取色下标必须是整数: ' + i);
      assert.ok(i >= 0 && i < treeview.BRANCH_COLORS.length, '取色下标越界: ' + i);
      assert.strictEqual(typeof treeview.BRANCH_COLORS[i], 'string');
    });
    assert.strictEqual(new Set(h.branches.map(b => ci[b.id])).size, h.branches.length, '7 条分支应拿到 7 种颜色');
  }
});

test('render 为每条分支画出各自颜色且不写入 undefined 样式', () => {
  const h = world.evolve({ name: '雾语', seed: 'tree1' });
  const record = [];
  const ctx = makeCtx(record);
  const canvas = { width: 900, height: 420, getContext: () => ctx };
  treeview.render(canvas, h, { selected: 'root', cursorEpoch: 10, hovered: null });
  const ci = treeview.colorIndex(h);
  const expected = new Set(h.branches.map(b => treeview.BRANCH_COLORS[ci[b.id]]));
  assert.strictEqual(expected.size, h.branches.length, '7 条分支应有 7 种颜色');
  expected.forEach(color => {
    assert.ok(record.indexOf(color) >= 0, '语系树应使用颜色 ' + color);
  });
  assert.ok(record.length > 0);
});

test('hitTest 命中分支与年代', () => {
  const h = world.evolve({ name: '雾语', seed: 'tree1' });
  const canvas = { width: 900, height: 420, getContext: () => makeCtx([]) };
  const lanes = treeview.layout(h);
  const padT = 24, padB = 30;
  const nLanes = new Set(h.branches.map(b => lanes[b.id])).size;
  const laneH = (420 - padT - padB) / nLanes;
  const rootY = padT + laneH * (lanes['root'] + 0.5);
  const hit = treeview.hitTest(canvas, h, {}, 400, rootY, 1);
  assert.strictEqual(hit.branchId, 'root');
  assert.ok(hit.epoch >= 0 && hit.epoch <= h.totalEpochs);
  // 画布左侧时间轴之外不产生年代
  assert.strictEqual(treeview.hitTest(canvas, h, {}, 10, rootY, 1).epoch, undefined);
});
