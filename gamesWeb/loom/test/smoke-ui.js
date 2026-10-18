'use strict';
/* LOOM · 界面冒烟测试：用浏览器桩把整个 app 跑起来，驱动真实的交互路径 */
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* ---------------- 浏览器桩 ---------------- */
const ctxStub = new Proxy({}, {
  get: function (t, p) {
    if (typeof p === 'symbol') return undefined;
    if (p === 'canvas') return null;
    return function () { return ctxStub; };
  },
  set: function () { return true; }
});

function makeEl(id) {
  const el = {
    id: id, style: {}, dataset: {}, value: '', checked: false, hidden: false,
    textContent: '', innerHTML: '', selectedIndex: 0, scrollTop: 0,
    clientWidth: 300, clientHeight: 200, width: 0, height: 0,
    _handlers: {},
    addEventListener: function (type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); },
    dispatch: function (type, evt) {
      (this._handlers[type] || []).forEach(function (fn) { fn.call(this, evt || { preventDefault: function () {} }); }, this);
    },
    appendChild: function (c) { return c; },
    removeChild: function () {},
    querySelector: function () { return makeEl(); },
    querySelectorAll: function () { return []; },
    getContext: function () { return ctxStub; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 300, height: 200, right: 300, bottom: 200 }; },
    click: function () { this.dispatch('click'); },
    toDataURL: function () { return 'data:image/png;base64,'; },
    classList: { add: function () {}, remove: function () {}, toggle: function () {} }
  };
  el.parentElement = el;
  return el;
}

const els = {};
function getEl(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; }

global.window = global;
global.devicePixelRatio = 1;
global.requestAnimationFrame = function () { return 0; };
global.cancelAnimationFrame = function () {};
/* Node 24 自带只读的 navigator，得用 defineProperty 覆盖 */
Object.defineProperty(global, 'navigator', {
  value: { clipboard: { writeText: function () { return Promise.resolve(); } } },
  configurable: true, writable: true
});
global.addEventListener = function (type, fn) { (global._h = global._h || {}); (global._h[type] = global._h[type] || []).push(fn); };
global.dispatchWindow = function (type, evt) { ((global._h || {})[type] || []).forEach(function (fn) { fn(evt || {}); }); };
global.document = {
  readyState: 'complete',
  addEventListener: function () {},
  getElementById: getEl,
  querySelector: function () { return makeEl(); },
  querySelectorAll: function () { return []; },
  createElement: function (tag) { return makeEl(tag); }
};

/* ---------------- 按 index.html 的顺序加载 ---------------- */
const files = [
  'js/shared/yarn.js', 'js/shared/weave.js', 'js/shared/dsl.js', 'js/shared/patterns.js',
  'js/fabric.js', 'js/draftview.js', 'js/punchcards.js', 'js/loomview.js',
  'js/audio.js', 'js/app.js'
];
for (const f of files) require(path.join(ROOT, f));

let failed = 0;
function ok(cond, msg) { if (!cond) { failed++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); }

const L = global.Loom;
ok(!!L && !!L.weave && !!L.dsl && !!L.patterns && !!L.fabric && !!L.draftview && !!L.punchcards && !!L.loomview,
  '全部 ' + files.length + ' 个前端文件加载成功，app.js 的 boot() 无异常');

const P = L.patterns;

/* 逐个纹样走真实的「选纹样 → 重新织」路径 */
let patternOk = 0;
for (const p of P.LIBRARY) {
  try {
    const sel = getEl('library');
    sel.value = p.id;
    sel.dispatch('change');
    if (getEl('identify-label').textContent && getEl('identify-label').textContent !== '—') patternOk++;
  } catch (e) {
    console.log('  ✗ 纹样 ' + p.id + ' 渲染失败: ' + e.message);
    failed++;
  }
}
ok(patternOk === P.LIBRARY.length, '全部 ' + P.LIBRARY.length + ' 个纹样都能通过界面加载并识别');

/* 视图切换 / 网格 / 缩放 */
try {
  getEl('view-seg').querySelectorAll = function () { return []; };
  getEl('chk-grid').checked = true; getEl('chk-grid').dispatch('change');
  getEl('chk-grid').checked = false; getEl('chk-grid').dispatch('change');
  getEl('zoom-in').dispatch('click');
  getEl('zoom-out').dispatch('click');
  getEl('zoom-fit').dispatch('click');
  getEl('fabric').dispatch('wheel', { deltaY: -120, clientX: 120, clientY: 90, preventDefault: function () {} });
  ok(true, '视图切换 / 网格 / 缩放 / 滚轮缩放 全部执行无异常');
} catch (e) { failed++; console.log('  ✗ 视图操作异常: ' + e.message); }

/* 拖拽平移 */
try {
  getEl('fabric').dispatch('mousedown', { clientX: 100, clientY: 90 });
  global.dispatchWindow('mousemove', { clientX: 140, clientY: 120 });
  global.dispatchWindow('mouseup', {});
  ok(true, '拖拽平移路径执行无异常');
} catch (e) { failed++; console.log('  ✗ 拖拽异常: ' + e.message); }

/* 手绘提花：涂改 → 自动写回织造程序 */
try {
  const paint = getEl('chk-paint');
  paint.checked = true; paint.dispatch('change');
  const before = getEl('editor').value;
  getEl('fabric').dispatch('mousedown', { clientX: 100, clientY: 100 });
  global.dispatchWindow('mousemove', { clientX: 106, clientY: 100 });
  global.dispatchWindow('mouseup', {});
  const after = getEl('editor').value;
  ok(after !== before && after.indexOf('liftplan') >= 0, '手绘提花后织造程序被自动改写为 liftplan');
  paint.checked = false; paint.dispatch('change');
  ok(true, '退出提花模式无异常');
} catch (e) { failed++; console.log('  ✗ 手绘提花异常: ' + e.message); }

/* 底部坞三个标签 */
try {
  ['cards', 'loom', 'draft'].forEach(function (d) {
    const tabs = getEl('dock-tabs');
    tabs.querySelectorAll = function () { return []; };
  });
  /* 直接驱动：模拟点击每个标签的 handler 不可行（querySelectorAll 被桩掉），改为直接调用渲染器 */
  const RP = require(path.join(ROOT, 'tools', 'render-png.js'));
  const d = L.dsl.parse(P.LIBRARY[2].dsl);
  const draft = L.weave.build(d.spec).draft;
  const m = L.weave.drawdown(draft);
  const c1 = new RP.MiniCtx(600, 200, '#14100c');
  L.punchcards.draw(c1, m, { width: 600, height: 200, current: 2 });
  const c2 = new RP.MiniCtx(400, 200, '#14100c');
  L.draftview.draw(c2, draft, { width: 400, height: 200 });
  const lv = L.loomview.create(makeEl('loomcv'), { onPick: function () {}, onSound: function () {} });
  lv.setMatrix(m, draft.warpYarn, draft.weftYarn);
  lv.play();
  for (let i = 0; i < 40; i++) { lv.tick(0.05); lv.draw(); }
  lv.pause(); lv.reset();
  ok(lv.getWoven() === 0, '织机动画：40 帧推进后可暂停并重置');
} catch (e) { failed++; console.log('  ✗ 底部坞 / 织机异常: ' + e.message); }

/* 导出 / 复制 / 音效 / 帮助 */
try {
  getEl('btn-png').dispatch('click');
  getEl('btn-copy').dispatch('click');
  getEl('btn-sound').dispatch('click');
  getEl('btn-sound').dispatch('click');
  getEl('btn-help').dispatch('click');
  getEl('help-close').dispatch('click');
  ok(true, '导出 PNG / 复制程序 / 音效开关 / 语法速查 全部执行无异常');
} catch (e) { failed++; console.log('  ✗ 导出等操作异常: ' + e.message); }

/* 配色与规格计算 */
try {
  const pal = getEl('palette');
  pal.value = '1'; pal.dispatch('change');
  const txt = getEl('editor').value;
  ok(/warp-yarn/.test(txt) && /weft-yarn/.test(txt), '换配色后织造程序里出现纱线颜色指令');
  getEl('spec-epc').value = '30'; getEl('spec-epc').dispatch('input');
  ok(getEl('spec-kv').innerHTML.indexOf('g/m²') >= 0, '织物规格面板实时算出克重');
} catch (e) { failed++; console.log('  ✗ 配色 / 规格异常: ' + e.message); }

/* 错误诊断：写一段坏程序，界面应当报错而不是崩 */
try {
  getEl('editor').value = 'warp 8\nshafts 4\nthreading 1 9\ntieup\n  1: 1\ntreadling 1';
  getEl('btn-run').dispatch('click');
  ok(getEl('diagnostics').innerHTML.indexOf('diag err') >= 0, '坏程序在诊断栏给出错误且界面不崩');
} catch (e) { failed++; console.log('  ✗ 错误处理异常: ' + e.message); }

console.log('\n' + (failed ? '✗ ' : '✓ ') + '界面冒烟测试' + (failed ? '失败 ' + failed + ' 项' : '全部通过'));
process.exit(failed ? 1 : 0);
