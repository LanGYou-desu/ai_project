/* ============================================================
 * NETIME · 主控制器（浏览器专用）
 * 浏览器外壳 / 年代切换 / 拨号动画 / 工具箱 / 线索档案 / 提示 / 存档
 * ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var E = window.NetEngine, P = window.NetPuzzle, S = window.Story;

  /* ==================== 工具函数 ==================== */
  function showToast(msg, type) {
    var wrap = $('toastWrap');
    var t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    t.innerHTML = msg;
    wrap.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 3800);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4300);
  }

  function currentEra() { return E.state.era; }

  /* ==================== 年代导航 ==================== */
  function renderEraNav() {
    var nav = $('eraNav');
    nav.innerHTML = '';
    S.ERAS.forEach(function (era) {
      var btn = document.createElement('button');
      btn.className = 'era-btn';
      btn.dataset.era = era.id;
      var locked = !P.isEraUnlocked(era.id);
      var solved = P.isEraSolved(era.id);
      var active = era.id === currentEra();
      btn.innerHTML = '<span class="era-year">' + era.id + '</span>' +
        '<span class="era-name">' + era.label + '</span>' +
        '<span class="era-mark">' + (solved ? '✓' : locked ? '🔒' : '') + '</span>';
      if (active) btn.classList.add('active');
      if (locked) btn.classList.add('locked');
      if (solved) btn.classList.add('solved');
      btn.title = era.year + ' · ' + era.tagline;
      btn.addEventListener('click', function () { switchEra(era.id); });
      nav.appendChild(btn);
    });
  }

  function switchEra(era) {
    if (!P.isEraUnlocked(era)) {
      showToast('🔒 ' + era + ' 年的网络还没有解锁，先找到对应年代的时间密钥。', 'warn');
      var lockedBtn = document.querySelector('.era-btn.locked[data-era="' + era + '"]');
      if (lockedBtn) { lockedBtn.classList.add('shake'); setTimeout(function () { lockedBtn.classList.remove('shake'); }, 600); }
      return;
    }
    if (era === currentEra()) return;
    var res = E.switchEra(era);
    renderEraNav();
    $('statusBar').textContent = '正在穿越时间…… ' + era + ' 年';
    loadPage(res.page, res.query, true);
  }

  /* ==================== 页面加载与渲染 ==================== */
  function loadPage(page, query, isEraSwitch) {
    if (!page) return;
    var era = page.era || currentEra();
    var eraDef = S.ERAS.filter(function (e) { return e.id === era; })[0];
    var steps = [];
    if (eraDef && eraDef.dialup) {
      steps = ['正在拨号连接……', '调制解调器握手……', '正在协商协议……', '已连接 52.8 Kbps，正在下载页面……'];
    } else {
      steps = ['正在连接 ' + (page.url || '') + ' ……'];
    }
    showLoading(steps, function () {
      renderPage(page, query);
    });
  }

  function renderPage(page, query) {
    var era = page.era || currentEra();
    E.state.era = era;

    // 浏览器外壳
    $('browser').className = 'browser era-' + era;
    $('pageTitle').textContent = page.title;
    $('urlBar').value = page.url + (query ? '?q=' + query : '');
    document.title = page.title + ' - NETIME';

    // 页面内容
    var pageEl = $('page');
    pageEl.className = 'page page-' + era;
    pageEl.innerHTML = page.html;
    pageEl.scrollTop = 0;

    // 搜索页注入结果
    if (page.isSearch) {
      var box = document.getElementById('search-results');
      if (box) box.innerHTML = E.resultsHtml(era, query);
    }

    // 状态栏
    $('statusBar').textContent = '完成 · ' + (page.url || '') + ' · ' + era + ' 年';

    // 首次访问
    var isNewVisit = P.visit(page.id);
    if (isNewVisit) {
      var clue = P.addClue(page);
      if (clue) {
        refreshClues();
        showToast('📌 新线索已收入案件档案：' + clue.title, 'clue');
      }
    }

    // 成就检查
    if (!P.hasAchievement('start')) { /* start 在开场白关闭时发放 */ }
    if (page.id === 'e2025_final' && !P.hasAchievement('final')) { /* final 由口令解锁发放 */ }

    // 更新各面板
    refreshNavButtons();
    refreshKeyHint();
    refreshKeyProgress();

    // 信号页聚焦
    if (page.id === 'e2025_signal') {
      var pw = document.getElementById('pw-input');
      if (pw) setTimeout(function () { pw.focus(); }, 300);
    }
  }

  function refreshNavButtons() {
    $('btnBack').disabled = !E.canBack();
    $('btnFwd').disabled = !E.canForward();
  }

  function showLoading(steps, done) {
    var ov = $('loadingOverlay');
    var txt = $('loadingText');
    ov.classList.remove('hidden');
    txt.innerHTML = '';
    var i = 0;
    (function next() {
      if (i >= steps.length) {
        setTimeout(function () { ov.classList.add('hidden'); done(); }, 350);
        return;
      }
      txt.innerHTML = '<div>' + steps[i] + '</div>' + txt.innerHTML;
      i++;
      setTimeout(next, 280 + Math.random() * 260);
    })();
  }

  /* ==================== 导航 ==================== */
  function go(input) {
    var res = E.navigate(input);
    if (res.notFound) {
      $('pageTitle').textContent = '404';
      $('urlBar').value = input;
      $('browser').className = 'browser era-' + currentEra();
      $('page').className = 'page page-' + currentEra();
      $('page').innerHTML = E.notFoundHtml(currentEra(), res.url);
      $('statusBar').textContent = '无法显示该网页';
      refreshNavButtons();
      return;
    }
    loadPage(res.page, res.query, false);
  }

  function doSearch() {
    var q = $('searchBox').value.trim();
    if (!q) { showToast('请输入要搜索的关键词。', 'warn'); return; }
    var sp = E.eraSearchPage(currentEra());
    if (!sp) { showToast(currentEra() + ' 年还没有搜索引擎。', 'warn'); return; }
    go(sp.url + '?q=' + encodeURIComponent(q));
  }

  /* ==================== 查看源代码 ==================== */
  function toggleSource() {
    var ov = $('viewSourceOverlay');
    if (ov.classList.contains('hidden')) {
      var page = E.current();
      if (!page) return;
      $('sourceTitle').textContent = 'view-source: ' + page.url;
      $('sourceCode').textContent = page.html;
      ov.classList.remove('hidden');
      if (P.award('source')) {
        refreshAch();
        showToast('📄 成就达成：源代码侦探', 'ach');
      }
    } else {
      ov.classList.add('hidden');
    }
  }

  /* ==================== 解码工具箱 ==================== */
  var TOOL_NAMES = {
    rot13: 'ROT13 解码/编码',
    b64enc: 'Base64 编码',
    b64dec: 'Base64 解码',
    morseEnc: '摩斯 编码',
    morseDec: '摩斯 解码',
    acrostic: '藏头检测',
    freq: '字符统计'
  };

  function applyTool(name, input) {
    var T = window.NETools;
    switch (name) {
      case 'rot13': return T.rot13(input);
      case 'b64enc': return T.b64encodeUtf8(input);
      case 'b64dec': return T.b64decodeUtf8(input);
      case 'morseEnc': return T.morseEncode(input);
      case 'morseDec': return T.morseDecode(input);
      case 'acrostic': {
        var firsts = T.firstCharsOfLines(input);
        return '每段首字连读：' + firsts + '\n\n（共 ' + firsts.length + ' 段）';
      }
      case 'freq': {
        var freq = T.charFreq(input);
        if (!freq.length) return '（没有可统计的字符）';
        return freq.slice(0, 20).map(function (f) { return f.char + ' : ' + f.count; }).join('\n');
      }
      default: return '';
    }
  }

  function bindTools() {
    var sel = $('toolSelect');
    Object.keys(TOOL_NAMES).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = TOOL_NAMES[k];
      sel.appendChild(o);
    });
    $('btnDecode').addEventListener('click', function () {
      var input = $('toolInput').value;
      if (!input.trim()) { showToast('先把要解码的内容粘贴进来。', 'warn'); return; }
      var out;
      try { out = applyTool(sel.value, input); }
      catch (e) { out = '（解码出错：' + e.message + '）'; }
      $('toolOutput').textContent = out;
    });
  }

  /* ==================== 密钥录入 ==================== */
  function refreshKeyHint() {
    var era = currentEra();
    var hint = $('keyHint');
    if (era === '2025') {
      hint.innerHTML = P.state.passwordUnlocked
        ? '<span class="ok">信号已解锁 ✓</span>'
        : '2025 年不需要单字密钥：请在档案馆「信号」页输入<b>四个字的完整口令</b>。';
    } else {
      var k = S.KEYS[era];
      if (!k) { hint.innerHTML = ''; return; }
      if (P.isEraSolved(era)) {
        hint.innerHTML = '<span class="ok">第 ' + k.index + ' 枚密钥「' + k.char + '」已找到 ✓</span>';
      } else {
        hint.innerHTML = '当前年代需要：第 <b>' + k.index + '</b> 枚密钥（单字）。' +
          '<br>根据线索与工具箱的解码结果，把它填进右侧输入框。';
      }
    }
  }

  function refreshKeyProgress() {
    var wrap = $('keyProgress');
    wrap.innerHTML = '';
    ['网', '络', '之', '声'].forEach(function (ch, i) {
      var era = ['1995', '2000', '2005', '2010'][i];
      var found = P.isEraSolved(era);
      var el = document.createElement('span');
      el.className = 'kp' + (found ? ' found' : '');
      el.textContent = found ? ch : '？';
      el.title = (found ? '已找到' : '未找到') + '第 ' + (i + 1) + ' 枚密钥（' + era + ' 年）';
      wrap.appendChild(el);
    });
    var pw = document.createElement('span');
    pw.className = 'kp pw' + (P.state.passwordUnlocked ? ' found' : '');
    pw.textContent = P.state.passwordUnlocked ? '✓' : '锁';
    pw.title = P.state.passwordUnlocked ? '信号已解锁' : '2025 年档案馆的锁';
    wrap.appendChild(pw);
  }

  function submitKey() {
    var era = currentEra();
    var input = $('keyInput').value;
    if (!input.trim()) { showToast('请先输入密钥。', 'warn'); return; }
    var res = P.submitKey(era, input);
    if (res.ok) {
      $('keyInput').value = '';
      showToast('🔑 ' + res.message, 'ok');
      refreshKeyHint();
      refreshKeyProgress();
      renderEraNav();
      if (P.hasAchievement('era5')) {
        // 已解锁全部
      }
      // 检查是否全部解锁
      var allUnlocked = S.ERAS.every(function (e) { return P.isEraUnlocked(e.id); });
      if (allUnlocked && !P.hasAchievement('era5')) {
        P.award('era5');
        refreshAch();
        showToast('🕰️ 成就达成：穿越五年', 'ach');
      }
      if (res.next) {
        setTimeout(function () { switchEra(res.next); }, 1200);
      }
    } else {
      showToast(res.message, 'warn');
    }
  }

  /* ==================== 提示 ==================== */
  function showHint() {
    var era = currentEra();
    var h = P.useHint(era);
    var box = $('hintText');
    if (h) {
      var used = P.state.hintsUsed[era] || 0;
      box.innerHTML = '<b>提示 ' + used + '/' + (S.HINTS[era] ? S.HINTS[era].length : 0) + '</b>　' + h;
    } else {
      box.innerHTML = '没有更多提示了。再仔细翻翻这个年代的网页吧。';
    }
  }

  /* ==================== 线索档案 ==================== */
  function refreshClues() {
    var list = $('clueList');
    list.innerHTML = '';
    var clues = P.state.clues.slice().reverse();
    if (!clues.length) {
      list.innerHTML = '<div class="empty">还没有线索。浏览网页时，重要发现会自动记录在这里。</div>';
      return;
    }
    clues.forEach(function (c) {
      var item = document.createElement('div');
      item.className = 'clue-item';
      item.innerHTML = '<div class="clue-head"><span class="era-badge">' + c.era + '</span> ' + c.title +
        ' <span class="clue-time">' + c.time + '</span></div>' +
        '<div class="clue-text">' + c.text + '</div>';
      list.appendChild(item);
    });
  }

  /* ==================== 笔记 ==================== */
  function refreshNotes() {
    var list = $('noteList');
    list.innerHTML = '';
    P.state.notes.slice().reverse().forEach(function (n, rev) {
      var idx = P.state.notes.length - 1 - rev;
      var item = document.createElement('div');
      item.className = 'note-item';
      item.innerHTML = '<div class="note-text">' + n.text.replace(/</g, '&lt;') + '</div>' +
        '<div class="note-foot"><span>' + n.time + '</span> <button data-idx="' + idx + '" class="note-del">删除</button></div>';
      list.appendChild(item);
    });
    list.querySelectorAll('.note-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        P.removeNote(parseInt(btn.dataset.idx, 10));
        refreshNotes();
      });
    });
  }

  /* ==================== 成就 ==================== */
  function refreshAch() {
    var list = $('achList');
    list.innerHTML = '';
    var earned = 0;
    S.ACHIEVEMENTS.forEach(function (a) {
      var has = P.hasAchievement(a.id);
      if (has) earned++;
      var el = document.createElement('div');
      el.className = 'ach-item' + (has ? ' earned' : '');
      el.innerHTML = '<span class="ach-icon">' + a.icon + '</span><span class="ach-name">' + a.name + '</span>' +
        '<span class="ach-desc">' + a.desc + '</span>';
      list.appendChild(el);
    });
    $('achCount').textContent = earned + '/' + S.ACHIEVEMENTS.length;
  }

  /* ==================== 弹窗 ==================== */
  function showModal(id) { $(id).classList.remove('hidden'); }
  function hideModal(id) { $(id).classList.add('hidden'); }

  function buildHelp() {
    return '<h3>🕰️ 怎么玩</h3>' +
      '<p><b>目标：</b>沿顾言在 5 个年代留下的足迹，收集 4 枚时间密钥（网·络·之·声），' +
      '最后在 2025 年的档案馆输入四字口令「网络之声」，接收信号。</p>' +
      '<p><b>每个年代：</b>先找到该年代的关键页面 → 解开一个小谜题（ROT13 / 摩斯 / 藏头 / Base64）→ ' +
      '把密钥填进右侧「时间密钥」输入框 → 下一个年代解锁。</p>' +
      '<ul>' +
      '<li>🖱️ 点击页面里的链接浏览（1995 年的网站链接真的会跳转）；</li>' +
      '<li>⌨️ 地址栏可以<b>手动输入网址</b>——隐藏页面只能靠猜/靠解码得到；</li>' +
      '<li>🔍 每个年代都有搜索引擎，线索里的关键词可以搜；</li>' +
      '<li>📄 <b>查看源代码</b>：老站长喜欢把话写进 HTML 注释里；</li>' +
      '<li>🧰 右侧「解码工具箱」：ROT13 / Base64 / 摩斯 / 藏头 / 字符统计；</li>' +
      '<li>📌 关键发现会自动记入「案件档案」；卡住了就点「提示」。</li>' +
      '</ul>' +
      '<p class="dim">进度自动保存在浏览器 localStorage 中，可随时「重置进度」重玩。</p>';
  }

  /* ==================== 初始化 ==================== */
  function init() {
    P.init();
    renderEraNav();
    bindTools();
    refreshClues();
    refreshNotes();
    refreshAch();
    refreshKeyProgress();

    // 导航按钮
    $('btnGo').addEventListener('click', function () { go($('urlBar').value); });
    $('urlBar').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') go($('urlBar').value);
    });
    $('btnBack').addEventListener('click', function () { var p = E.back(); if (p) loadPage(p, null, false); });
    $('btnFwd').addEventListener('click', function () { var p = E.forward(); if (p) loadPage(p, null, false); });
    $('btnHome').addEventListener('click', function () { var h = E.eraHome(currentEra()); if (h) go(h); });
    $('btnSource').addEventListener('click', toggleSource);
    $('btnSearch').addEventListener('click', doSearch);
    $('searchBox').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') doSearch(); });

    // 密钥 / 提示 / 笔记 / 存档
    $('btnKey').addEventListener('click', submitKey);
    $('keyInput').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') submitKey(); });
    $('btnHint').addEventListener('click', showHint);
    $('btnNote').addEventListener('click', function () {
      var n = P.addNote($('notesInput').value);
      if (n) { $('notesInput').value = ''; refreshNotes(); showToast('📝 笔记已保存', 'ok'); }
      else { showToast('写点什么再保存吧。', 'warn'); }
    });
    $('btnSave').addEventListener('click', function () { P.save(); showToast('💾 进度已保存', 'ok'); });
    $('btnReset').addEventListener('click', function () {
      if (window.confirm('确定要重置全部进度吗？线索、密钥、成就都会被清空。')) {
        P.reset();
        window.location.reload();
      }
    });
    $('btnHelp').addEventListener('click', function () {
      $('helpBody').innerHTML = buildHelp();
      showModal('helpModal');
    });
    $('helpClose').addEventListener('click', function () { hideModal('helpModal'); });
    $('introStart').addEventListener('click', function () {
      hideModal('introModal');
      if (P.award('start')) { refreshAch(); showToast('📻 信号接入', 'ach'); }
    });

    // 页面内事件委托（链接 / 表单）
    $('page').addEventListener('click', function (ev) {
      var a = ev.target.closest ? ev.target.closest('a') : null;
      if (a) {
        var href = a.getAttribute('href') || '';
        if (href === 'javascript:void(0)') {
          var act = a.getAttribute('data-netime');
          if (act === 'home') { var h = E.eraHome(currentEra()); if (h) go(h); }
          return;
        }
        ev.preventDefault();
        go(href);
      }
    });
    $('page').addEventListener('submit', function (ev) {
      var form = ev.target;
      var act = form.getAttribute('data-netime');
      if (!act) return;
      ev.preventDefault();
      if (act === 'unlock') {
        var val = form.querySelector('input') ? form.querySelector('input').value : '';
        var res = P.submitPassword(val);
        if (res.ok) {
          showToast('🔓 ' + res.message, 'ok');
          refreshKeyProgress();
          setTimeout(function () { go('e2025_final'); }, 900);
        } else {
          showToast('❌ ' + res.message, 'warn');
          var msg = document.getElementById('lock-msg');
          if (msg) msg.textContent = '口令错误，请重试。';
        }
      } else if (act === 'reply') {
        var txt = form.querySelector('textarea') ? form.querySelector('textarea').value : '';
        showToast('✉️ 留言已寄出（将在 1995 年送达）。' + (txt ? '「' + txt.slice(0, 24) + '…」' : ''), 'ok');
        if (form.querySelector('textarea')) form.querySelector('textarea').value = '';
      }
    });

    // 查看源代码关闭
    $('sourceClose').addEventListener('click', function () { $('viewSourceOverlay').classList.add('hidden'); });
    $('viewSourceOverlay').addEventListener('click', function (ev) {
      if (ev.target === this) this.classList.add('hidden');
    });

    // 开场白
    if (!P.hasAchievement('start')) {
      var introHtml = '<h3>📻 一封信，来自 1995 年</h3>';
      S.INTRO.forEach(function (line) {
        introHtml += '<p>' + line + '</p>';
      });
      $('introBody').innerHTML = introHtml;
      showModal('introModal');
    }

    // 起始页面
    var res = E.switchEra('1995');
    renderEraNav();
    refreshKeyHint();
    loadPage(res.page, res.query, false);

    // 自动保存
    window.addEventListener('beforeunload', function () { P.save(); });

    // 供测试/调试使用的钩子
    window.NETimeApp = { go: go, switchEra: switchEra };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
