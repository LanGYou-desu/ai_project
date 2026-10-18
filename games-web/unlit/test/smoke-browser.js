/* UNLIT · 无光之城 — 浏览器冒烟测试（强化版）
 * 1) 按 index.html 顺序加载全部前端脚本（stub DOM，按 index.html 的初始 class 播种）
 * 2) 驱动 rAF 帧循环：标题 → 点开始 → 章节引言 → 进入游戏 → 按键
 * 3) 捕捉任何运行时异常（第一帧崩溃会直接让游戏"没声音/黑屏"）
 * 4) 回归检查：覆盖层打开时 Tab 不被吞掉、谜题可纯键盘完成、
 *    音频池按种类合成（振荡/噪声）、噪声缓冲复用、节点播完即断开
 *
 * 运行：node test/smoke-browser.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------- 从 index.html 读取元素的初始 class，让 show/hide 的可见性可被断言 ----------
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const initialClasses = new Map();
const tagRe = /<[a-zA-Z][^>]*>/g;
let tagMatch;
while ((tagMatch = tagRe.exec(html))) {
  const tag = tagMatch[0];
  const idM = /\bid="([^"]+)"/.exec(tag);
  const clsM = /\bclass="([^"]*)"/.exec(tag);
  if (idM) initialClasses.set(idM[1], clsM ? clsM[1].split(/\s+/).filter(Boolean) : []);
}

// ---------- 智能 stub：按选择器缓存、可存储属性、可调用 ----------
const elCache = new Map();
function makeStub(name) {
  const store = { __name: name || '?' };
  const fn = function () { return makeStub(name); };
  return new Proxy(fn, {
    get(t, prop) {
      if (prop === '__name') return store.__name;
      if (prop === Symbol.toPrimitive) return function () { return ''; };
      if (prop === 'classList') {
        if (!store.classList) {
          const set = new Set(initialClasses.get(String(name).replace(/^#/, '')) || []);
          store.classList = {
            add(c) { set.add(c); },
            remove(c) { set.delete(c); },
            toggle(c, on) { if (on === undefined) { set.has(c) ? set.delete(c) : set.add(c); } else if (on) set.add(c); else set.delete(c); },
            contains(c) { return set.has(c); }
          };
        }
        return store.classList;
      }
      if (prop === 'style') { store.style = store.style || {}; return store.style; }
      if (prop === 'dataset') { store.dataset = store.dataset || {}; return store.dataset; }
      if (prop === 'querySelector') return (sel) => el(sel);
      if (prop === 'querySelectorAll') return (sel) => [el(sel)];
      if (prop === 'focus') return () => { store.__focused = true; };
      if (prop === 'getBoundingClientRect') return () => ({ left: 0, top: 0, width: 720, height: 480 });
      if (prop === 'length' || prop === 'size') return 0;
      if (prop in store) return store[prop];
      return makeStub(name + '.' + String(prop));
    },
    set(t, prop, v) { store[prop] = v; return true; },
    apply() { return makeStub(name); },
    construct() { return makeStub(name); }
  });
}
function el(sel) {
  if (!elCache.has(sel)) elCache.set(sel, makeStub(sel));
  return elCache.get(sel);
}

// ---------- 记录型 AudioContext stub ----------
const audioLog = { filters: [], oscs: [], srcs: [], buffers: 0, started: 0, stopped: 0, disconnected: 0 };
function audioCtxStub() {
  const node = (kind) => {
    const o = {
      __kind: kind,
      gain: {
        value: 0,
        setTargetAtTime(v) { this.value = v; },
        setValueAtTime(v) { this.value = v; },
        exponentialRampToValueAtTime(v) { this.value = v; }
      },
      pan: { value: 0, setTargetAtTime(v) { this.value = v; } },
      frequency: {
        value: 0,
        setValueAtTime(v) { this.value = v; },
        setTargetAtTime(v) { this.value = v; },
        exponentialRampToValueAtTime(v) { this.value = v; }
      },
      Q: { value: 0, setTargetAtTime(v) { this.value = v; } },
      type: '', buffer: null, loop: false, onended: null,
      connect() { return this; },
      start() { audioLog.started++; },
      stop() { audioLog.stopped++; },
      disconnect() { audioLog.disconnected++; }
    };
    if (kind === 'filter') audioLog.filters.push(o);
    if (kind === 'osc') audioLog.oscs.push(o);
    if (kind === 'src') audioLog.srcs.push(o);
    return o;
  };
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    resume() {},
    createGain: () => node('gain'),
    createStereoPanner: () => node('pan'),
    createBiquadFilter: () => node('filter'),
    createOscillator: () => node('osc'),
    createBuffer: (ch, len) => { audioLog.buffers++; return { getChannelData: () => new Float32Array(Math.min(len, 44100)) }; },
    createBufferSource: () => node('src')
  };
}

const listeners = {};   // type → [cb, ...]（真实 DOM 允许多个监听器）
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
  speechSynthesis: { cancel() {}, speak() {}, getVoices: () => [], addEventListener() {} },
  SpeechSynthesisUtterance: function () {},
  document: {
    hidden: false,
    activeElement: null,
    querySelector: (sel) => el(sel),
    querySelectorAll: (sel) => [el(sel)],
    getElementById: (id) => el('#' + id),
    addEventListener: (type, cb) => { (listeners[type] = listeners[type] || []).push(cb); },
    removeEventListener: (type, cb) => { listeners[type] = (listeners[type] || []).filter(x => x !== cb); },
    createElement: () => makeStub('created')
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
function key(code, extra) {
  const cbs = listeners['keydown'] || [];
  if (!cbs.length) throw new Error('keydown 监听未注册');
  const ev = { code: code, preventDefault() { ev.__prevented = true; } };
  if (extra) Object.assign(ev, extra);
  for (const cb of cbs) cb(ev);
  return ev;
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

// 6) 键盘可达性：覆盖层打开时 Tab 必须让给浏览器
try {
  context.UNLIT_UI.hide('#puzzle');
  const t1 = key('Tab');
  ok(t1.__prevented === true, '无覆盖层时 Tab 用于切换沉浸/辅助');
  context.UNLIT_UI.show('#puzzle');
  const t2 = key('Tab');
  ok(!t2.__prevented, '谜题面板打开时 Tab 不被吞掉（可聚焦选项）');
  context.UNLIT_UI.hide('#puzzle');
} catch (e) { ok(false, 'Tab 处理异常: ' + e.message); }

// 7) 谜题可以纯键盘完成：数字键 1 选中▼
try {
  const eng = context.__UNLIT_ENGINE;
  eng.loadChapter('ch1');
  eng.loadMap('ch1', 'corridor', 2, 6, 0);
  const panel = eng.map.objects.find(o => o.id === 'callPanel');
  eng.px = panel.x + 1.5; eng.py = panel.y + 0.5; eng.facing = Math.PI;
  eng.interact();
  ok(eng.mode === 'puzzle' && eng.puzzleId === 'elevCall', '呼梯谜题已打开');
  runFrames(2);                                        // 主循环渲染面板并绑定选项
  const opt = context.document.querySelector('#puzzleInner .puzzle-opt');
  opt.dataset.id = 'down';
  key('Digit1');
  ok(eng.flags.elevOpen === true, '数字键 1 选中▼并成功呼梯');
} catch (e) { ok(false, '键盘谜题异常: ' + e.message); }

// 8) 音频：对象声源按种类合成（振荡器/滤波类型），不是所有东西一个音色
try {
  const eng = context.__UNLIT_ENGINE;
  const before = audioLog.oscs.length;
  eng.loadChapter('ch0');
  runFrames(2); click('#btnIntro'); runFrames(2);
  eng.px = 6.5; eng.py = 2.5;                           // 站到闹钟旁边
  runFrames(3);
  const alarmOsc = audioLog.oscs.slice(before).find(o => o.type === 'square' && Math.abs(o.frequency.value - 940) < 1);
  ok(!!alarmOsc, '闹钟是 940Hz 方波振荡池（旧版被当成低通噪声）');

  const filterBefore = audioLog.filters.length;
  eng.loadChapter('ch3');
  runFrames(2); click('#btnIntro');
  eng.px = 2.5; eng.py = 1.5;                           // 离米袋 2 格
  runFrames(3);
  const riceIdx = audioLog.filters.findIndex((f, i) => i >= filterBefore && f.type === 'bandpass' && Math.abs(f.frequency.value - 620) < 1);
  ok(riceIdx > 0, '米袋是 620Hz 带通噪声池（每种物品有自己的音色）');
  const lpNear = riceIdx > 0 ? audioLog.filters[riceIdx + 1] : null;
  ok(lpNear && lpNear.type === 'lowpass' && lpNear.frequency.value > 2000,
    '距离低通滤波已接入（近处 ' + (lpNear ? Math.round(lpNear.frequency.value) : '?') + 'Hz）');
  const nearLp = lpNear ? lpNear.frequency.value : 0;
  eng.px = 11.5; eng.py = 8.5;                          // 走远（最近的一格货架也 >6 格）
  runFrames(3);
  ok(lpNear && lpNear.frequency.value < nearLp,
    '走远后同一个声源被压得更闷（' + Math.round(nearLp) + 'Hz → ' + (lpNear ? Math.round(lpNear.frequency.value) : '?') + 'Hz）');
} catch (e) { ok(false, '音频音色检查异常: ' + e.message); }

// 9) 音频：噪声缓冲复用 + 节点播完/销毁后断开（不泄漏）
try {
  ok(audioLog.buffers === 1, '白噪声缓冲只生成一次并复用（实际 ' + audioLog.buffers + ' 次）');
  const oscWithCleanup = audioLog.oscs.filter(o => typeof o.onended === 'function');
  ok(oscWithCleanup.length > 0, '一次性振荡器注册了 onended 清理');
  const srcWithCleanup = audioLog.srcs.filter(o => typeof o.onended === 'function');
  ok(srcWithCleanup.length > 0, '一次性噪声源注册了 onended 清理');
  const eng = context.__UNLIT_ENGINE;
  const d0 = audioLog.disconnected, s0 = audioLog.stopped;
  eng.loadChapter('ch0');
  runFrames(2); click('#btnIntro');
  eng.px = 6.5; eng.py = 2.5; runFrames(2);             // 创建闹钟池
  eng.px = 2.5; eng.py = 10.5; runFrames(2);            // 走远 → 销毁池
  ok(audioLog.stopped > s0, '离开范围后声源被 stop()');
  ok(audioLog.disconnected > d0, '销毁的池会 disconnect() 节点');
} catch (e) { ok(false, '音频节点生命周期检查异常: ' + e.message); }

console.log('\n==== smoke: ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
