'use strict';
/* SYNAPSE · UI 冒烟测试：浏览器桩加载全部前端文件 + 渲染路径执行检查 */
const path = require('path');
const ROOT = path.join(__dirname, '..');

// ---- 浏览器桩 ----
const ctxStub = new Proxy({}, {
  get: function (t, p) {
    if (p === 'canvas') return null;
    if (typeof p === 'symbol') return undefined;
    return function () { return ctxStub; };
  },
  set: function () { return true; }
});
function makeEl() {
  const el = {
    style: {},
    dataset: {},
    value: '',
    textContent: '',
    innerHTML: '',
    hidden: false,
    disabled: false,
    clientWidth: 300,
    clientHeight: 200,
    addEventListener: function () {},
    appendChild: function (c) { return c; },
    removeChild: function () {},
    querySelector: function () { return makeEl(); },
    querySelectorAll: function () { return []; },
    getContext: function () { return ctxStub; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 300, height: 200 }; },
    click: function () {},
    classList: { add: function () {}, remove: function () {}, toggle: function () {} }
  };
  el.parentElement = el;
  return el;
}
const els = {};
global.window = global;
global.addEventListener = function () {};
global.devicePixelRatio = 1;
global.document = {
  readyState: 'complete',
  addEventListener: function () {},
  querySelectorAll: function () { return []; },
  querySelector: function () { return makeEl(); },
  getElementById: function (id) { if (!els[id]) els[id] = makeEl(); return els[id]; },
  createElement: function () { return makeEl(); }
};
global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
global.requestAnimationFrame = function () { return 0; };
global.cancelAnimationFrame = function () {};
global.alert = function () {};
global.Blob = function () {};
global.URL = { createObjectURL: function () { return 'blob:x'; }, revokeObjectURL: function () {} };
global.FileReader = function () { this.readAsText = function () {}; };

// ---- 依次加载（与 index.html 顺序一致）----
const files = [
  'js/shared/rng.js', 'js/shared/activations.js', 'js/shared/losses.js',
  'js/shared/network.js', 'js/shared/trainer.js', 'js/shared/tictactoe.js',
  'js/shared/datasets.js', 'js/shared/editor.js',
  'js/audio.js', 'js/render.js', 'js/main.js'
];
for (const f of files) {
  require(path.join(ROOT, f));
}
if (!global.Synapse || !global.Synapse.network || !global.Synapse.editor) {
  console.error('FAIL: Synapse 全局命名空间缺失');
  process.exit(1);
}
console.log('OK: 全部 ' + files.length + ' 个前端文件加载成功，init() 无异常');

// ---- 渲染函数冒烟：真实编辑器/网络 + 桩 ctx ----
const RN = global.Synapse.render;
const ED = global.Synapse.editor.SynapseEditor;
const DST = global.Synapse.datasets.DATASETS;
const TT = global.Synapse.tictactoe;
const ctx = ctxStub;

for (const id of ['xor', 'moons', 'spiral', 'digits', 'tictactoe']) {
  const d = DST[id];
  const ed = new ED({ inputCount: d.in, outputCount: d.out, outAct: d.outAct });
  const hidden = d.preset.layers.slice(1, -1);
  for (let i = 0; i < hidden.length; i++) ed.addHiddenLayer(i + 1, hidden[i], d.preset.hiddenAct);
  ed.autoWire();
  const net = ed.toNetwork(7);
  RN.layout(ed, 600, 500);
  RN.drawGraph(ctx, ed, net, null, null, 600, 500);
  RN.drawGraph(ctx, ed, net, { type: 'node', nodeId: ed.layers[1][0].id }, null, 600, 500);
  RN.drawGraph(ctx, ed, net, null, ed.layers[1][0].id, 600, 500);
  if (ed.edges.length) {
    RN.drawGraph(ctx, ed, net, { type: 'edge', edgeId: ed.edges[0].id, fromId: ed.edges[0].from, toId: ed.edges[0].to }, null, 600, 500);
  }
  RN.hitNode(ed, 100, 100);
  RN.hitEdge(ed, 100, 100);
  const hist = [{ epoch: 1, loss: 0.8, acc: 0.5 }, { epoch: 2, loss: 0.3, acc: 0.9 }, { epoch: 3, loss: 0.1, acc: 1.0 }];
  RN.drawLoss(ctx, hist, 320, 150);
  RN.drawLoss(ctx, [], 320, 150);
  const ds = d.make(7);
  if (d.viz === 'boundary') {
    RN.drawBoundary(ctx, net, ds, 320, 300, [-1, 2, -1, 2]);
  } else if (d.viz === 'digits') {
    RN.drawDigitsViz(ctx, net, 320, 300);
  } else {
    const ttt = { board: new Array(9).fill(0), userSide: 1, turn: 1, over: false, msg: '你执 ✕ 先手', winLine: null };
    RN.drawTTT(ctx, ttt, 320, 300);
    ttt.board = [1, -1, 0, 0, 1, 0, 0, 0, -1];
    RN.drawTTT(ctx, ttt, 320, 300);
  }
}
const ed0 = new ED({ inputCount: 2, outputCount: 1, outAct: 'sigmoid' });
ed0.autoWire();
const net0 = ed0.toNetwork(7);
RN.layout(ed0, 600, 500);
RN.drawGraph(ctx, ed0, net0, null, null, 600, 500);
ed0.clearEdges();
RN.drawGraph(ctx, ed0, net0, null, null, 600, 500);
const b = new Array(9).fill(0);
TT.bestMove(b, 1);
const dtt = DST.tictactoe;
const edt = new ED({ inputCount: dtt.in, outputCount: dtt.out, outAct: dtt.outAct });
const ht = dtt.preset.layers.slice(1, -1);
for (let i = 0; i < ht.length; i++) edt.addHiddenLayer(i + 1, ht[i], dtt.preset.hiddenAct);
edt.autoWire();
const nett = edt.toNetwork(7);
TT.predictMove(nett, b);
console.log('OK: 全部渲染路径执行无异常（5 数据集 × 网络图/损失/可视化 + 命中检测 + 掩码/空网络）');
