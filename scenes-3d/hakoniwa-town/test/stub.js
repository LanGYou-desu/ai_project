'use strict';
/* ============================================================
 * 箱庭小镇 · test/stub.js
 * 零依赖浏览器桩：让 js/ 下的前端脚本（含真实 vendor/three.min.js）
 * 能在 Node 里加载并跑完整帧循环。
 * 参考 synapse/test/smoke-ui.js 的 Proxy 上下文桩 + makeEl DOM 桩写法。
 * ============================================================ */
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* ---------- canvas 2D 上下文桩（Proxy 吞掉所有绘图调用） ---------- */
function makeCtxStub() {
  return new Proxy({}, {
    get: function (t, p) {
      if (p === 'canvas') return null;
      if (typeof p === 'symbol') return undefined;
      return function () { return ctxStubSingleton; };
    },
    set: function () { return true; }
  });
}
var ctxStubSingleton = makeCtxStub();

/* ---------- DOM 元素桩 ---------- */
function makeEl(tag) {
  const listeners = {};
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    style: {}, dataset: {}, value: '', textContent: '', innerHTML: '',
    hidden: false, disabled: false, className: '',
    clientWidth: 300, clientHeight: 200, width: 0, height: 0,
    _listeners: listeners,
    addEventListener: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener: function (type, fn) {
      const a = listeners[type]; if (!a) return;
      const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
    },
    appendChild: function (c) { return c; },
    removeChild: function () {},
    remove: function () { el.removed = true; },
    querySelector: function () { return makeEl(); },
    querySelectorAll: function () { return []; },
    getContext: function () { return ctxStubSingleton; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 300, height: 200 }; },
    setPointerCapture: function () {},
    releasePointerCapture: function () {},
    requestFullscreen: function () { return Promise.resolve(); },
    toDataURL: function () { return 'data:image/png;base64,'; },
    click: function () {},
    classList: {
      _set: {},
      add: function (c) { this._set[c] = true; },
      remove: function (c) { delete this._set[c]; },
      contains: function (c) { return !!this._set[c]; },
      toggle: function (c, force) {
        const on = force === undefined ? !this._set[c] : !!force;
        if (on) this._set[c] = true; else delete this._set[c];
        return on;
      }
    }
  };
  el.parentElement = el;
  return el;
}

/**
 * 创建一个隔离的浏览器环境并加载全部前端脚本。
 * opts: { renderer: 'ok' | 'no-webgl' | 'throw', width, height, testMode }
 * 返回 { H, THREE, document, window, els, renders(), rafQueue(), emit(target,type,ev) }
 */
function createWorld(opts) {
  opts = opts || {};
  const els = {};
  const winListeners = {};
  const docListeners = {};
  const rafQueue = [];
  let renders = 0;

  const documentElement = makeEl('html');
  const doc = {
    readyState: 'complete',
    documentElement: documentElement,
    body: makeEl('body'),
    fullscreenElement: null,
    addEventListener: function (t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
    removeEventListener: function () {},
    querySelectorAll: function () { return []; },
    querySelector: function () { return makeEl(); },
    getElementById: function (id) { if (!els[id]) els[id] = makeEl(); return els[id]; },
    createElement: function (tag) { return makeEl(tag); },
    createElementNS: function (ns, tag) { return makeEl(tag); }
  };

  const win = {
    innerWidth: opts.width === undefined ? 1280 : opts.width,
    innerHeight: opts.height === undefined ? 720 : opts.height,
    devicePixelRatio: 1,
    document: doc,
    addEventListener: function (t, fn) { (winListeners[t] = winListeners[t] || []).push(fn); },
    removeEventListener: function () {},
    requestAnimationFrame: function (fn) { rafQueue.push(fn); return rafQueue.length; },
    cancelAnimationFrame: function () {},
    setTimeout: function (fn) { return setTimeout(fn, 0); },
    clearTimeout: function (id) { clearTimeout(id); },
    performance: global.performance,
    console: console
  };
  win.window = win;
  win.self = win;
  win.global = win;
  if (opts.testMode !== false) win.__HAKONIWA_TEST__ = true;

  // 以全局身份安装（前端脚本直接引用 window/document/requestAnimationFrame/THREE）
  const prevGlobals = {};
  ['window', 'self', 'document', 'requestAnimationFrame', 'cancelAnimationFrame',
    'devicePixelRatio', 'innerWidth', 'innerHeight', 'THREE', 'performance'].forEach(function (k) {
    prevGlobals[k] = global[k];
  });
  global.window = win;
  global.self = win;
  global.document = doc;
  global.requestAnimationFrame = win.requestAnimationFrame;
  global.cancelAnimationFrame = win.cancelAnimationFrame;
  global.devicePixelRatio = 1;
  global.innerWidth = win.innerWidth;
  global.innerHeight = win.innerHeight;

  // 必须重新加载：前端脚本都是 IIFE，只会在首次 require 时执行；
  // 且它们从 window.H 取全局命名空间，第二次调用要拿到新的 window。
  Object.keys(require.cache).forEach(function (k) {
    if (k.indexOf(path.join(ROOT, 'js')) === 0 || k === path.join(ROOT, 'vendor', 'three.min.js')) {
      delete require.cache[k];
    }
  });
  const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
  win.THREE = THREE;
  global.THREE = THREE;

  const mode = opts.renderer || 'ok';
  if (mode === 'throw') {
    THREE.WebGLRenderer = function () { throw new Error('WebGL context creation failed (stub)'); };
  } else if (mode === 'no-webgl') {
    THREE.WebGLRenderer = function () {
      this.domElement = makeEl('canvas');
      this.shadowMap = { enabled: false, type: 0 };
      this.setPixelRatio = function () {};
      this.setSize = function () {};
      this.getContext = function () { return null; };
      this.render = function () {};
    };
  } else {
    THREE.WebGLRenderer = function (params) {
      this.domElement = (params && params.canvas) || makeEl('canvas');
      this.shadowMap = { enabled: false, type: 0 };
      this.outputColorSpace = '';
      this.toneMapping = 0;
      this.toneMappingExposure = 1;
      this.pixelRatio = 1;
      this.size = { width: 0, height: 0 };
      this.setPixelRatio = function (v) { this.pixelRatio = v; };
      this.setSize = function (w, h) { this.size = { width: w, height: h }; };
      this.getContext = function () { return {}; };
      this.render = function () { renders++; };
    };
  }

  const files = ['js/util.js', 'js/terrain.js', 'js/town.js', 'js/vehicles.js', 'js/dynamics.js', 'js/main.js'];
  files.forEach(function (f) { require(path.join(ROOT, f)); });

  return {
    H: win.H,
    THREE: THREE,
    document: doc,
    window: win,
    els: els,
    files: files,
    renders: function () { return renders; },
    rafQueue: rafQueue,
    /** 手动驱动 requestAnimationFrame 队列（测试模式下 main.js 不会自转） */
    flushRaf: function () {
      const q = rafQueue.splice(0, rafQueue.length);
      q.forEach(function (fn) { fn(0); });
      return q.length;
    },
    emit: function (target, type, ev) {
      const map = target === 'window' ? winListeners : target === 'document' ? docListeners : null;
      const list = map && map[type] ? map[type].slice() : [];
      list.forEach(function (fn) { fn(ev || {}); });
      return list.length;
    }
  };
}

module.exports = { createWorld: createWorld, makeEl: makeEl, ROOT: ROOT };
