// 前端主逻辑烟雾测试：用最小 DOM 桩把 js/main.js 真正跑起来（含 9 个展厅与分享链接容错）
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const TAB_IDS = ['words', 'cognates', 'grammar', 'events', 'writing', 'loan', 'lyrics', 'atlas', 'sandbox'];
const TAB_LABELS = ['📜 词表', '🧬 同源词', '📚 语法', '📖 大事记', '🖋️ 文字', '🐎 借词', '🎵 歌谣', '🏛️ 图鉴', '🧪 创作台'];

function makeCtx() {
  const store = {};
  return new Proxy(store, {
    get(t, k) { return k in t ? t[k] : function () {}; },
    set(t, k, v) {
      if (v === undefined) throw new Error('ctx.' + String(k) + ' 被设为 undefined');
      t[k] = v;
      return true;
    }
  });
}

function makeEl(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(), _attrs: {}, _cls: new Set(), _h: {}, style: {}, children: [],
    dataset: {}, value: '', textContent: '', innerHTML: '', width: 600, height: 400,
    clientWidth: 600, clientHeight: 400, max: 19, scrollTop: 0, _timer: null
  };
  el.classList = {
    add: c => el._cls.add(c), remove: c => el._cls.delete(c),
    toggle: (c, v) => { if (v === undefined) v = !el._cls.has(c); if (v) el._cls.add(c); else el._cls.delete(c); return v; },
    contains: c => el._cls.has(c)
  };
  el.addEventListener = (t, fn) => { (el._h[t] = el._h[t] || []).push(fn); };
  el.removeEventListener = () => {};
  el.setAttribute = (k, v) => { el._attrs[k] = String(v); if (k === 'value') el.value = String(v); };
  el.getAttribute = k => (k in el._attrs ? el._attrs[k] : null);
  el.querySelector = () => makeEl('div');
  el.querySelectorAll = () => [];
  el.appendChild = c => { el.children.push(c); return c; };
  el.insertAdjacentHTML = () => {};
  el.remove = () => {};
  el.scrollTo = () => {};
  el.focus = () => {};
  el.click = () => {};
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 400 });
  el.getContext = () => makeCtx();
  el.parentElement = { clientWidth: 600 };
  el.closest = () => null;
  return el;
}

// 启动一次前端：返回可检查的元素与按钮
function bootApp(search) {
  const els = {};
  const getEl = id => (els[id] || (els[id] = makeEl('div')));
  const tabButtons = TAB_IDS.map((t, i) => {
    const b = makeEl('button');
    b.setAttribute('data-tab', t);
    b.textContent = TAB_LABELS[i];
    return b;
  });
  const tabDivs = TAB_IDS.map(t => getEl('tab-' + t));
  const store = {};
  const sandbox = {
    console,
    document: {
      getElementById: getEl,
      createElement: tag => makeEl(tag),
      querySelectorAll: sel => (sel === '.tabs button' ? tabButtons : sel === '.tab' ? tabDivs : []),
      querySelector: sel => (sel === '.tabwrap' ? getEl('tabwrap') : makeEl('div')),
      addEventListener: () => {},
      body: { appendChild: () => {} }
    },
    location: { search: search || '', origin: 'http://127.0.0.1:8097', pathname: '/' },
    navigator: {},
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    URLSearchParams, URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
    Blob: function () {}, devicePixelRatio: 1, matchMedia: () => ({ matches: false }),
    prompt: () => null, alert: () => {}
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  ['js/shared/rng.js', 'js/shared/lexicon.js', 'js/shared/sounds.js', 'js/shared/grammar.js', 'js/shared/worlddata.js',
    'js/shared/world.js', 'js/shared/lyrics.js', 'js/shared/storage.js', 'js/glyphs.js', 'js/treeview.js',
    'js/tts.js', 'js/main.js'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  });
  return { els, getEl, tabButtons, tabDivs, sandbox };
}

test('main.js 能启动并渲染全部 9 个展厅', () => {
  const app = bootApp('?lang=雾语&seed=smoke');
  assert.match(app.getEl('langTitle').textContent, /雾语/);
  assert.ok(app.getEl('treeLegend').innerHTML.length > 0, '语系树图例应渲染');
  TAB_IDS.forEach((t, i) => {
    const handlers = app.tabButtons[i]._h.click;
    assert.ok(handlers && handlers.length, t + ' 展厅应有点击处理器');
    handlers[0]({ target: app.tabButtons[i] });
    assert.ok(app.tabDivs[i].innerHTML.length > 0, t + ' 展厅应渲染出内容');
  });
  assert.ok(app.tabDivs[0].innerHTML.indexOf('<table>') >= 0, '词表应包含表格');
});

test('图例与语系树取色不含 undefined（旧 bug 回归）', () => {
  const app = bootApp('?lang=雾语&seed=tree1');
  const legend = app.getEl('treeLegend').innerHTML;
  assert.ok(legend.indexOf('background:#') >= 0, '图例应带颜色');
  assert.strictEqual(legend.indexOf('undefined'), -1, '图例颜色不应是 undefined');
  assert.strictEqual(app.tabDivs[0].innerHTML.indexOf('undefined'), -1);
});

test('被改坏的分享链接参数不会让页面崩溃', () => {
  ['?w=null', '?w=[]', '?w=%7B%22extraWords%22%3A%22x%22%7D', '?w=%7B%22extraSplits%22%3A1%7D',
    '?w=not-json', '?w=%7B%22ruleScale%22%3A%22abc%22%7D', '?lang=%3Cscript%3E&seed=%3Cimg%3E'
  ].forEach(search => {
    const app = bootApp(search);
    assert.ok(app.getEl('langTitle').textContent.length > 0, '启动后应仍有标题: ' + search);
    assert.strictEqual(app.getEl('langTitle').textContent.indexOf('<script>'), -1, '标题不应残留脚本标签');
  });
});

test('创作台/成就/导出等按钮处理器齐全且不抛异常', () => {
  const app = bootApp('?lang=雾语&seed=smoke');
  ['btnReevolve', 'btnRename', 'btnShare', 'btnExport', 'btnWiki', 'btnCard', 'btnSave',
    'btnPlay', 'btnGuide', 'btnIntroOk', 'achCounter', 'btnAchClose'].forEach(id => {
    const handlers = app.getEl(id)._h.click;
    assert.ok(handlers && handlers.length, id + ' 应有点击处理器');
    handlers[0]({ target: app.getEl(id), preventDefault() {} });
  });
});

test('时间轴与语系树拖拽可用', () => {
  const app = bootApp('?lang=雾语&seed=smoke');
  const sliderEl = app.getEl('epochSlider');
  const slider = sliderEl._h.input;
  assert.ok(slider && slider.length);
  sliderEl.value = '7';
  slider[0].call(sliderEl, { target: sliderEl });
  assert.strictEqual(app.getEl('epochLabel').textContent, '公元 350 年');
  const down = app.getEl('treeCanvas')._h.pointerdown;
  const move = app.getEl('treeCanvas')._h.pointermove;
  assert.ok(down && move);
  down[0]({ target: app.getEl('treeCanvas'), clientX: 300, clientY: 200, pointerId: 1 });
  move[0]({ target: app.getEl('treeCanvas'), clientX: 800, clientY: 200, pointerId: 1 });
  assert.match(app.getEl('epochLabel').textContent, /^公元 \d+ 年$/);
});
