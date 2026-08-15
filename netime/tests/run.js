/* ============================================================
 * NETIME · 测试入口
 * 用法：node tests/run.js
 * ============================================================ */
'use strict';

// ---------- 在 Node 中模拟浏览器全局 ----------
global.Story = require('../js/story.js');
global.NetTools = require('../js/tools.js');
global.NetSites = require('../js/sites.js');
const Engine = require('../js/engine.js');
global.NetEngine = Engine;
const Puzzle = require('../js/puzzle.js');
global.NetPuzzle = Puzzle;

// localStorage 内存模拟（Node 无 localStorage）
const memStore = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(memStore, k) ? memStore[k] : null; },
  setItem: function (k, v) { memStore[k] = String(v); },
  removeItem: function (k) { delete memStore[k]; }
};

// ---------- 迷你测试框架（支持同步/异步） ----------
const tests = [];
global.test = function (name, fn) { tests.push({ name: name, fn: fn }); };

global.assert = function (cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
};
global.assertEq = function (a, b, msg) {
  if (a !== b) throw new Error((msg || 'assertEq') + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
};
global.assertContains = function (hay, needle, msg) {
  if (String(hay).indexOf(needle) < 0) throw new Error((msg || 'assertContains') + ': missing ' + JSON.stringify(needle));
};

// ---------- 注册测试模块 ----------
require('./tools.test.js');
require('./engine.test.js');
require('./puzzle.test.js');
require('./story.test.js');
require('./smoke.test.js');

// ---------- 顺序执行并汇总 ----------
(async function main() {
  let passCount = 0;
  let failCount = 0;
  for (const t of tests) {
    try {
      await t.fn();
      passCount++;
      console.log('  \u2713 ' + t.name);
    } catch (e) {
      failCount++;
      console.log('  \u2717 ' + t.name + '\n      ' + (e && e.message ? e.message : e));
    }
  }
  console.log('\n========================================');
  console.log('  通过: ' + passCount + '   失败: ' + failCount);
  console.log('========================================');
  process.exit(failCount ? 1 : 0);
})();
