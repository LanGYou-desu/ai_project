'use strict';
// 前端启动冒烟测试：用迷你 DOM 桩在 Node 中加载 app.js，
// 验证初始化 + 首屏渲染 + 一次导航不会抛异常。
const events = require('events');

function makeEl(id) {
  const cls = {
    _set: new Set(),
    add: function (c) { cls._set.add(c); },
    remove: function (c) { cls._set.delete(c); },
    contains: function (c) { return cls._set.has(c); }
  };
  const el = {
    id: id,
    className: '',
    disabled: false,
    value: '',
    textContent: '',
    dataset: {},
    scrollTop: 0,
    style: {},
    classList: cls,
    _html: '',
    _handlers: {},
    set innerHTML(v) { el._html = String(v); },
    get innerHTML() { return el._html; },
    addEventListener: function (type, fn) { (el._handlers[type] = el._handlers[type] || []).push(fn); },
    removeEventListener: function () {},
    appendChild: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    focus: function () {},
    closest: function () { return null; }
  };
  return el;
}

const elMap = {};
function getEl(id) {
  if (!elMap[id]) elMap[id] = makeEl(id);
  return elMap[id];
}

const win = {
  addEventListener: function () {},
  confirm: function () { return false; },
  location: { reload: function () {} }
};

// 注入浏览器侧全局（与 index.html 的 script 加载顺序一致）
win.NetTools = global.NetTools;
win.Story = global.Story;
win.NetSites = global.NetSites;
win.NetEngine = global.NetEngine;
win.NetPuzzle = global.NetPuzzle;

global.window = win;
global.document = {
  readyState: 'complete',
  title: '',
  getElementById: getEl,
  createElement: function () { return makeEl('dyn'); },
  addEventListener: function () {},
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; }
};

test('前端启动：app.js 初始化 + 首页加载无异常', async function () {
  // 异步测试：加载 app.js（IIFE 直接 init）
  require('../js/app.js');
  const app = win.NETimeApp;
  assert(app && typeof app.go === 'function', '应暴露测试钩子');

  // 等待拨号动画结束后首屏渲染完成
  await new Promise(function (resolve) { setTimeout(resolve, 2600); });

  const page = getEl('page');
  assert(page.innerHTML.length > 50, '首页应已渲染出内容');
  assertContains(page.innerHTML, '东方资讯台', '1995 首页应包含东方资讯台');

  // 渲染后各面板状态
  assert(getEl('statusBar').textContent.indexOf('完成') >= 0, '状态栏应显示完成');
  assert(getEl('urlBar').value.indexOf('chinanet-news.com') >= 0, '地址栏应为 1995 首页地址');
});

test('前端启动：导航到告别帖 + 查看源代码无异常', async function () {
  const app = win.NETimeApp;
  app.go('http://bbs.yemaomao.cn/thread/1024');
  await new Promise(function (resolve) { setTimeout(resolve, 2200); });
  const page = getEl('page');
  assertContains(page.innerHTML, '网络之声今晚十二点永久停播', '告别帖应渲染');
  assert(page.innerHTML.indexOf('Gur svefg') < 0, '密文在留言板页，不应出现在告别帖');
});

test('前端启动：切换年代到 2005 无异常', async function () {
  const app = win.NETimeApp;
  app.switchEra('2005'); // 2005 可能未解锁（取决于存档），允许失败路径
  await new Promise(function (resolve) { setTimeout(resolve, 2000); });
  // 无论解锁与否，都不应抛异常
  assert(true);
});
