/* ============================================================
 * NETIME · 浏览器引擎（纯逻辑，浏览器 / Node 通用）
 * 页面注册 / URL 解析 / 历史栈 / 年代切换 / 站点搜索
 * ============================================================ */
(function (global) {
  'use strict';

  var NetSites = global.NetSites || {};
  var Story = global.Story || {};
  var SITES = NetSites.SITES || {};

  /* ---------- URL 规范化 ---------- */
  function normUrl(u) {
    var s = String(u || '').trim();
    var query = null;
    var qi = s.indexOf('?');
    if (qi >= 0) {
      var qs = s.slice(qi + 1);
      qs.split('&').forEach(function (pair) {
        var kv = pair.split('=');
        if (kv[0] === 'q') {
          try { query = decodeURIComponent((kv[1] || '').replace(/\+/g, ' ')); }
          catch (e) { query = kv[1] || ''; }
        }
      });
      s = s.slice(0, qi);
    }
    if (s.length > 1 && s.charAt(s.length - 1) === '/') s = s.slice(0, -1);
    return { url: s, query: query };
  }

  var Engine = {
    urlIndex: {},      // 规范化 URL -> page id
    searchIndex: {},   // era -> 可搜索页面数组
    state: {
      era: '1995',
      currentId: null,
      currentQuery: null,
      history: [],     // 已访问 page id（不含当前）
      forward: []      // 前进栈
    }
  };

  /* ---------- 构建索引 ---------- */
  function buildIndexes() {
    Object.keys(SITES).forEach(function (id) {
      var p = SITES[id];
      Engine.urlIndex[normUrl(p.url).url] = id;
      if (/^e[0-9]{4}_search$/.test(id)) p.isSearch = true;
      if (!p.isSearch) p.isSearch = /\/search$/.test(normUrl(p.url).url);
    });
    var eras = (Story.ERAS || []).map(function (e) { return e.id; });
    eras.forEach(function (era) {
      Engine.searchIndex[era] = Object.keys(SITES)
        .filter(function (id) {
          var p = SITES[id];
          return p.era === era && !p.hidden && !p.isSearch;
        })
        .map(function (id) { return SITES[id]; });
    });
  }
  if (Object.keys(SITES).length) buildIndexes();

  /* ---------- 解析导航目标 ---------- */
  // 输入：URL 字符串或 page id → { page, query?, notFound? }
  function resolve(input) {
    var s = String(input || '').trim();
    if (SITES[s]) return { page: SITES[s] };
    var n = normUrl(s);
    var id = Engine.urlIndex[n.url];
    if (id) return { page: SITES[id], query: n.query };
    return { notFound: true, url: n.url };
  }

  /* ---------- 导航 ---------- */
  function navigate(input) {
    var r = resolve(input);
    if (r.notFound) return { notFound: true, url: r.url };
    var prev = Engine.state.currentId;
    if (prev && prev !== r.page.id) {
      Engine.state.history.push(prev);
      Engine.state.forward = [];
    }
    Engine.state.currentId = r.page.id;
    Engine.state.currentQuery = r.query || null;
    return { page: r.page, query: r.query };
  }

  function back() {
    if (!Engine.state.history.length) return null;
    var id = Engine.state.history.pop();
    if (Engine.state.currentId) Engine.state.forward.push(Engine.state.currentId);
    Engine.state.currentId = id;
    Engine.state.currentQuery = null;
    return SITES[id];
  }

  function forward() {
    if (!Engine.state.forward.length) return null;
    var id = Engine.state.forward.pop();
    if (Engine.state.currentId) Engine.state.history.push(Engine.state.currentId);
    Engine.state.currentId = id;
    Engine.state.currentQuery = null;
    return SITES[id];
  }

  function canBack() { return Engine.state.history.length > 0; }
  function canForward() { return Engine.state.forward.length > 0; }

  function current() { return Engine.state.currentId ? SITES[Engine.state.currentId] : null; }

  /* ---------- 年代 ---------- */
  function eraHome(era) {
    var e = (Story.ERAS || []).filter(function (x) { return x.id === era; })[0];
    return e ? e.home : null;
  }

  function switchEra(era) {
    Engine.state.era = era;
    Engine.state.history = [];
    Engine.state.forward = [];
    Engine.state.currentId = null;
    Engine.state.currentQuery = null;
    var home = eraHome(era);
    if (home) return navigate(home);
    return { notFound: true, url: 'http://' + era };
  }

  /* ---------- 搜索 ---------- */
  function search(era, q) {
    var query = String(q || '').trim().toLowerCase();
    if (!query) return [];
    var terms = query.split(/\s+/).filter(Boolean);
    var pages = Engine.searchIndex[era] || [];
    var scored = pages.map(function (p) {
      var hay = (p.keywords || []).join(' ').toLowerCase() + ' ' + p.title.toLowerCase() + ' ' + p.snippet.toLowerCase();
      var score = 0;
      terms.forEach(function (t) {
        if (hay.indexOf(t) >= 0) score++;
        (p.keywords || []).forEach(function (k) {
          if (k.toLowerCase().indexOf(t) >= 0) score += 2;
        });
      });
      return { page: p, score: score };
    }).filter(function (x) { return x.score > 0; });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, 12).map(function (x) { return x.page; });
  }

  function eraSearchPage(era) {
    var id = 'e' + era + '_search';
    return SITES[id] || null;
  }

  /* ---------- 搜索结果 HTML（供注入 #search-results） ---------- */
  function resultsHtml(era, q) {
    var pages = search(era, q);
    if (!q || !q.trim()) {
      return '<p class="sr-hint">在地址栏或搜索框输入关键词，检索 ' + era + ' 年的网页。</p>';
    }
    if (!pages.length) {
      return '<p class="sr-empty">没有找到与「' + q + '」相关的网页。换个关键词试试——试试线索里出现过的词。</p>';
    }
    var html = '<p class="sr-count">找到 ' + pages.length + ' 个相关网页：</p><ol class="sr-list">';
    pages.forEach(function (p) {
      html += '<li><a href="' + p.url + '">' + p.title + '</a><br>' +
              '<span class="sr-url">' + p.url + '</span><br>' +
              '<span class="sr-snip">' + p.snippet + '</span></li>';
    });
    return html + '</ol>';
  }

  /* ---------- 404 页面 ---------- */
  function notFoundHtml(era, url) {
    return '<center><h2 class="nf">404 · 无法显示该网页</h2>' +
      '<p>您输入的地址：<b>' + url + '</b></p>' +
      '<p>该页面不存在，或已被 30 年的时间淹没。</p>' +
      '<p><a href="javascript:void(0)" data-netime="home">[返回' + era + '年首页]</a></p></center>';
  }

  Engine.buildIndexes = buildIndexes;
  Engine.resolve = resolve;
  Engine.navigate = navigate;
  Engine.back = back;
  Engine.forward = forward;
  Engine.canBack = canBack;
  Engine.canForward = canForward;
  Engine.current = current;
  Engine.eraHome = eraHome;
  Engine.switchEra = switchEra;
  Engine.search = search;
  Engine.eraSearchPage = eraSearchPage;
  Engine.resultsHtml = resultsHtml;
  Engine.notFoundHtml = notFoundHtml;
  Engine.normUrl = normUrl;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Engine;
  } else {
    global.NetEngine = Engine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
