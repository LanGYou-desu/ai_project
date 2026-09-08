/* 测试用最小浏览器环境桩（零依赖）：够让 js/main.js 完整跑起来并驱动点击 */
'use strict';

function createDom(opts) {
  opts = opts || {};
  var byId = {};
  var docHandlers = {};        // 事件名 -> [fn]
  var rafQueue = [];
  var lsData = {};
  var lsReads = {};            // key -> 读取次数
  var lsWrites = {};
  var storageThrows = !!opts.storageThrows;
  if (opts.seed) Object.keys(opts.seed).forEach(function (k) { lsData[k] = String(opts.seed[k]); });

  function classList() {
    var set = [];
    return {
      _set: set,
      add: function (c) { if (set.indexOf(c) < 0) set.push(c); },
      remove: function (c) { var i = set.indexOf(c); if (i >= 0) set.splice(i, 1); },
      toggle: function (c, force) {
        var has = set.indexOf(c) >= 0;
        var want = force === undefined ? !has : !!force;
        if (want) this.add(c); else this.remove(c);
        return want;
      },
      contains: function (c) { return set.indexOf(c) >= 0; }
    };
  }

  var ctx2d = {};
  ['setTransform', 'fillRect', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill',
    'stroke', 'arc', 'fillText', 'save', 'restore', 'translate', 'rotate', 'scale'].forEach(function (m) {
      ctx2d[m] = function () {};
    });
  ctx2d.createLinearGradient = function () { return { addColorStop: function () {} }; };
  ctx2d.measureText = function () { return { width: 10 }; };

  function makeEl(id) {
    var el = {
      id: id || '', tagName: 'DIV',
      className: '', innerHTML: '', title: '', value: '90',
      scrollTop: 0, scrollHeight: 0,
      width: 240, height: 26, clientWidth: 560, clientHeight: 240,
      style: { cssText: '' },
      _attrs: {}, _handlers: {}, _children: [],
      classList: classList(),
      _text: '',
      getAttribute: function (n) { return Object.prototype.hasOwnProperty.call(this._attrs, n) ? this._attrs[n] : null; },
      setAttribute: function (n, v) { this._attrs[n] = String(v); },
      removeAttribute: function (n) { delete this._attrs[n]; },
      addEventListener: function (t, fn) { (this._handlers[t] = this._handlers[t] || []).push(fn); },
      removeEventListener: function (t, fn) {
        var a = this._handlers[t] || []; var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
      },
      dispatch: function (t, ev) { (this._handlers[t] || []).slice().forEach(function (f) { f(ev || {}); }); },
      handlerCount: function (t) { return (this._handlers[t] || []).length; },
      appendChild: function (c) { this._children.push(c); return c; },
      removeChild: function (c) { var i = this._children.indexOf(c); if (i >= 0) this._children.splice(i, 1); return c; },
      remove: function () { if (this.parentElement) this.parentElement.removeChild(this); },
      insertAdjacentHTML: function () {},
      insertAdjacentElement: function () {},
      getContext: function () { return ctx2d; },
      focus: function () {},
      querySelectorAll: function (sel) {
        // 只支持 main.js 用到的选择器：从 innerHTML 解析按钮，并按 innerHTML 缓存（贴近真实 DOM 的同一批节点）
        var html = String(this.innerHTML || '');
        if (this._btnCache && this._btnCache.html === html) return this._btnCache.list;
        var re = /data-act="([^"]+)"/g;
        var out = [], m;
        while ((m = re.exec(html)) !== null) {
          (function (act) {
            var b = makeEl('');
            b.tagName = 'BUTTON';
            b._attrs['data-act'] = act;
            var idm = /data-id="([^"]+)"/.exec(html.slice(m.index, m.index + 400));
            if (idm) b._attrs['data-id'] = idm[1];
            b.addEventListener = function (t, fn) { b._handlers[t] = fn; };
            b.click = function () { if (b._handlers.click) b._handlers.click({}); };
            out.push(b);
          })(m[1]);
        }
        this._btnCache = { html: html, list: out };
        return out;
      }
    };
    // 真实 DOM 会把 textContent 强制转成字符串
    Object.defineProperty(el, 'textContent', {
      get: function () { return el._text; },
      set: function (v) { el._text = v == null ? '' : String(v); }
    });
    Object.defineProperty(el, 'parentElement', {
      get: function () { if (!el._parent) el._parent = makeEl('parent'); return el._parent; },
      set: function (v) { el._parent = v; }
    });
    return el;
  }

  function getEl(id) {
    if (!byId[id]) { byId[id] = makeEl(id); }
    return byId[id];
  }

  var body = makeEl('body');
  var document = {
    body: body,
    getElementById: getEl,
    createElement: function (tag) { var e = makeEl(''); e.tagName = String(tag).toUpperCase(); return e; },
    querySelectorAll: function () { return []; },
    addEventListener: function (t, fn) { (docHandlers[t] = docHandlers[t] || []).push(fn); },
    removeEventListener: function (t, fn) {
      var a = docHandlers[t] || []; var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
    },
    dispatch: function (t, ev) { (docHandlers[t] || []).slice().forEach(function (f) { f(ev || {}); }); },
    handlerCount: function (t) { return (docHandlers[t] || []).length; },
    hidden: false
  };

  var localStorage = {
    getItem: function (k) {
      lsReads[k] = (lsReads[k] || 0) + 1;
      if (storageThrows) throw new Error('localStorage 不可用');
      return Object.prototype.hasOwnProperty.call(lsData, k) ? lsData[k] : null;
    },
    setItem: function (k, v) {
      lsWrites[k] = (lsWrites[k] || 0) + 1;
      if (storageThrows) throw new Error('localStorage 不可用');
      lsData[k] = String(v);
    },
    removeItem: function (k) { if (storageThrows) throw new Error('localStorage 不可用'); delete lsData[k]; },
    _data: lsData
  };

  function timers() {
    return {
      setTimeout: function (fn, ms) { var t = setTimeout(fn, ms); if (t.unref) t.unref(); return t; },
      clearTimeout: function (t) { clearTimeout(t); },
      setInterval: function (fn, ms) { var t = setInterval(fn, ms); if (t.unref) t.unref(); return t; },
      clearInterval: function (t) { clearInterval(t); }
    };
  }

  return {
    byId: byId, getEl: getEl, document: document, localStorage: localStorage,
    lsReads: lsReads, lsWrites: lsWrites, docHandlers: docHandlers,
    rafQueue: rafQueue, timers: timers,
    /** 运行 n 帧动画（默认 1 帧），用于覆盖 drawSkyline / drawChart / VU 路径 */
    flushFrames: function (n) {
      n = n || 1;
      for (var i = 0; i < n; i++) {
        var q = rafQueue.splice(0, rafQueue.length);
        q.forEach(function (cb) { cb(); });
      }
    }
  };
}

module.exports = { createDom: createDom };
