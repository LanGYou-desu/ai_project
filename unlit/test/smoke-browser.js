/* UNLIT · 无光之城 — 浏览器冒烟测试（强化版）
 * 1) 按 index.html 顺序加载全部前端脚本（stub DOM）
 * 2) 驱动 rAF 帧循环：标题 → 点开始 → 章节引言 → 进入游戏 → 按键
 * 3) 捕捉任何运行时异常（第一帧崩溃会直接让游戏"没声音/黑屏"）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------- 智能 stub：按选择器缓存、可存储属性、可调用 ----------
function makeStub() {
  const store = {};
  const fn = function () { return makeStub(); };
  return new Proxy(fn, {
    get(t, prop) {
      if (prop === Symbol.toPrimitive) return function () { return ''; };
      if (prop in store) return store[prop];
      if (prop === 'classList') {
        store.classList = { add() {}, remove() {}, toggle() {} };
        return store.classList;
      }
      if (prop === 'style') { store.style = {}; return store.style; }
      if (prop === 'dataset') { store.dataset = {}; return store.dataset; }
      if (prop === 'length' || prop === 'size') return 0;
      return makeStub();
    },
    set(t, prop, v) { store[prop] = v; return true; },
    apply() { return makeStub(); },
    construct() { return makeStub(); }
  });
}
function audioCtxStub() {
  const node = () => ({
    gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    pan: { value: 0, setTargetAtTime() {} },
    frequency: { value: 0, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {} },
    Q: { value: 0 }, type: '', buffer: null, loop: false,
    connect() {}, start() {}, stop() {}, disconnect() {}
  });
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    resume() {},
    createGain: node, createStereoPanner: node, createBiquadFilter: node, createOscillator: node,
    createBuffer: () => ({ getChannelData: () => new Float32Array(44100) }),
    createBufferSource: node
  };
}

const qsCache = new Map();
const listeners = {};
const rafStack = [];
let rafCb = null;
const context = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => { rafCb = cb; rafStack.push(cb); return rafStack.length; },
  location: { reload() {} },
  innerWidth: 1280, innerHeight: 720,
  addEventListener() {}, removeEventListener() {},
  AudioContext: audioCtxStub,
  speechSynthesis: { cancel() {}, speak() {}, getVoices: () => [] },
  SpeechSynthesisUtterance: function () {},
  document: {
    querySelector: (sel) => { if (!qsCache.has(sel)) qsCache.set(sel, makeStub()); return qsCache.get(sel); },
    querySelectorAll: () => [makeStub()],
    getElementById: (id) => { if (!qsCache.has('#' + id)) qsCache.set('#' + id, makeStub()); return qsCache.get('#' + id); },
    addEventListener: (type, cb) => { listeners[type] = cb; },
    createElement: () => makeStub()
  },
  window: {}
};
context.window = context;
context.self = context;
context.globalThis = context;
vm.createContext(context);

// ---------- 加载脚本 ----------
const base = path.join(__dirname, '..');
const scripts = [
  'js/shared/rng.js', 'js/shared/braille.js', 'js/shared/audioscene.js', 'js/shared/cane.js',
  'js/shared/money.js', 'js/shared/world.js', 'js/shared/chapters.js', 'js/shared/engine.js',
  'js/audio-engine.js', 'js/render.js', 'js/ui.js', 'js/main.js'
];
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
for (const s of scripts) {
  try {
    vm.runInContext(fs.readFileSync(path.join(base, s), 'utf8'), context, { filename: s });
    pass++; console.log('  ✓ 加载 ' + s);
  } catch (err) { fail++; console.log('  ✗ 加载 ' + s + ' — ' + err.message); }
}
for (const g of ['UNLIT_RNG', 'UNLIT_BRAILLE', 'UNLIT_AUDIOSCENE', 'UNLIT_CANE', 'UNLIT_MONEY', 'UNLIT_WORLD', 'UNLIT_CHAPTERS', 'UNLIT_ENGINE', 'UNLIT_AUDIO', 'UNLIT_RENDER', 'UNLIT_UI']) {
  ok(context[g], '全局 ' + g);
}
ok(context.__UNLIT_ENGINE, '引擎已暴露 __UNLIT_ENGINE');

// ---------- 驱动帧循环 ----------
function runFrames(n) {
  const t0 = Date.now();
  for (let i = 1; i <= n; i++) {
    if (!rafCb) throw new Error('rAF 回调未注册');
    rafCb(t0 + i * 16);
  }
}
function click(sel) { context.document.querySelector(sel).onclick(); }
function key(code) {
  const cb = listeners['keydown'];
  if (!cb) throw new Error('keydown 监听未注册');
  cb({ code: code, preventDefault() {} });
}

// 1) 标题状态跑 5 帧（此前这里会崩溃 → 黑屏无声）
try { runFrames(5); ok(true, '标题态 5 帧无异常'); } catch (e) { ok(false, '标题态崩溃: ' + e.message); }

// 2) 点"开始"
try {
  click('#btnStart');
  runFrames(3);
  ok(context.__UNLIT_ENGINE.chapterId === 'ch0', '点击开始后加载 ch0（实际: ' + context.__UNLIT_ENGINE.chapterId + '）');
} catch (e) { ok(false, '开始流程异常: ' + e.message); }

// 3) 点"进入黑暗"
try {
  click('#btnIntro');
  runFrames(30);
  ok(true, '进入游戏 30 帧无异常');
} catch (e) { ok(false, '进入游戏异常: ' + e.message); }

// 4) 按键：白杖 + 触摸 + 转身
try {
  key('Space'); key('KeyE'); key('ArrowLeft'); key('KeyW');
  runFrames(10);
  ok(true, '按键无异常（Space/E/←/W）');
} catch (e) { ok(false, '按键异常: ' + e.message); }

// 5) 引擎状态可用
try {
  const eng = context.__UNLIT_ENGINE;
  ok(eng.chapterId === 'ch0' && eng.mapId === 'bedroom', '引擎状态正常 ch0/bedroom');
  ok(typeof eng.tap() === 'object' && 'hit' in eng.tap(), '白杖 tap 返回回声结果');
} catch (e) { ok(false, '引擎检查异常: ' + e.message); }

console.log('\n==== smoke: ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
