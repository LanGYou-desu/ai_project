/* 测试用启动器：按 index.html 的顺序把 6 个脚本装进一个最小浏览器沙箱 */
'use strict';

const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { createDom } = require('./_dom.js');
const { makeFakeAudio } = require('./_audio.js');

const FILES = [
  'shared/data.js', 'shared/engine.js', 'shared/storage.js', 'shared/scores.js',
  'synth.js', 'main.js'
];

function bootGame(opts) {
  opts = opts || {};
  const dom = createDom(opts);
  const fake = makeFakeAudio();
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    Math, Date, JSON, Promise, Float32Array, Uint8Array, Object, Array, String, Number, Error,
    Blob: function Blob(parts, o) { this.parts = parts; this.type = o && o.type; },
    URL: { createObjectURL: function () { return 'blob:test'; }, revokeObjectURL: function () {} }
  };
  Object.assign(sandbox, dom.timers());
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.document = dom.document;
  sandbox.localStorage = dom.localStorage;
  sandbox.devicePixelRatio = 1;
  sandbox.matchMedia = function () { return { matches: !!opts.reducedMotion }; };
  sandbox.requestAnimationFrame = function (cb) { dom.rafQueue.push(cb); return dom.rafQueue.length; };
  if (!opts.noAudio) sandbox.AudioContext = fake.FakeAudioContext;
  vm.createContext(sandbox);

  const dir = path.resolve(__dirname, '../js');
  for (const f of FILES) {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox, { filename: f });
  }
  return { dom, fake, sandbox, LB: sandbox.LB };
}

/** 点击 #actions 里 data-act 对应的按钮（走 main.js 真实的事件绑定路径） */
function clickAct(dom, act) {
  const btns = dom.getEl('actions').querySelectorAll('button[data-act]');
  const b = btns.filter(function (x) { return x.getAttribute('data-act') === act; })[0];
  if (!b) {
    throw new Error('按钮不存在: ' + act + '；当前可用: ' +
      btns.map(function (x) { return x.getAttribute('data-act'); }).join(', '));
  }
  b.click();
  return b;
}

/** 点击电话总机里的第 i 个来电按钮 */
function clickPhone(dom, i) {
  const kids = dom.getEl('phone')._children.filter(function (c) { return c._handlers && c._handlers.click; });
  if (!kids[i]) throw new Error('没有第 ' + i + ' 个来电按钮');
  kids[i]._handlers.click[0]({});
  return kids[i];
}

module.exports = { bootGame: bootGame, clickAct: clickAct, clickPhone: clickPhone, FILES: FILES };
