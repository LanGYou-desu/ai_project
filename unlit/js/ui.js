/* UNLIT · 无光之城 — 界面（DOM 覆盖层、谜题面板、心灵地图交互）
 * 依赖：UNLIT_BRAILLE / UNLIT_RNG / UNLIT_AUDIO / UNLIT_RENDER
 *
 * 无障碍要点：
 *  - 所有谜题都能纯键盘完成：数字键 1..9 直接选第 N 个选项，←→ 移动焦点，
 *    Enter 确认；盲文信的输入框按 Enter 提交；盲文单元格可 Tab 聚焦并用 Enter"摸"。
 *  - 覆盖层带 role="dialog"/aria-modal，播报区 aria-live，打开面板时自动聚焦。
 */
(function (root) {
  'use strict';
  const $ = s => document.querySelector(s);
  const Braille = (typeof UNLIT_BRAILLE !== 'undefined') ? UNLIT_BRAILLE : null;
  const RNG = (typeof UNLIT_RNG !== 'undefined') ? UNLIT_RNG : null;
  let engineRef = null;
  let mapCursor = { x: 2, y: 2 }, mapSel = 'self';

  function setEngine(e) { engineRef = e; }

  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); }
  function isOpen(id) { const el = $(id); return !!el && !el.classList.contains('hidden'); }

  // 有交互覆盖层打开时，把 Tab 还给浏览器（否则键盘用户永远进不了谜题按钮）
  function overlayOpen() {
    return isOpen('#title') || isOpen('#puzzle') || isOpen('#mapOverlay') || isOpen('#facts') || isOpen('#intro') || isOpen('#end');
  }

  function say(speaker, text) {
    $('#saySpeaker').textContent = speaker;
    $('#sayText').textContent = text;
  }

  let toastTimer = 0;
  function toast(html, ms) {
    const t = $('#toast');
    t.innerHTML = html;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 3600);
  }

  let hudCache = { chap: null, goal: null, mode: null };
  function setHud(chap, goal, mode) {
    // 每帧都写 DOM 会持续触发布局：只在真的变了才写
    if (hudCache.chap !== chap) { $('#hudChap').textContent = chap || ''; hudCache.chap = chap; }
    if (hudCache.goal !== goal) { $('#hudGoal').textContent = goal || ''; hudCache.goal = goal; }
    if (hudCache.mode !== mode) {
      $('#hudMode').textContent = mode === 'assist' ? '辅助' : '沉浸';
      hudCache.mode = mode;
    }
  }

  // ---------- 盲文单元格 ----------
  function cellDots(mask, wornDots) {
    const grid = Braille.cellGrid(mask);
    const worn = wornDots || [];
    let h = '';
    let d = 1;
    for (const row of grid) {
      for (const on of row) {
        const cls = on ? '' : (worn.indexOf(d) >= 0 ? 'worn' : 'off');
        h += '<span class="dot ' + cls + '"></span>';
        d++;
      }
    }
    return h;
  }
  function cellHTML(mask, wornDots) {
    return '<span class="cell' + ((wornDots && wornDots.length) ? ' damaged' : '') + '">' + cellDots(mask, wornDots) + '</span>';
  }
  function cellsHTML(word) {
    return Braille.textToCells(word).map(c => cellHTML(c.mask)).join('');
  }

  // ---------- 章节引言 ----------
  function showIntro(chapter, onDone) {
    const lines = chapter.intro || [];
    $('#introChap').textContent = chapter.name;
    $('#introLines').innerHTML = lines.map(l => '<p>' + l + '</p>').join('');
    let done = false;
    const go = function () {
      if (done) return;                 // Enter 在按钮上会同时触发 click 与 keydown
      done = true;
      hide('#intro');
      UNLIT_AUDIO.stinger(chapter.id);
      if (onDone) onDone();
    };
    $('#btnIntro').onclick = go;
    $('#intro').onkeydown = function (ev) {
      if (ev.code === 'Enter' || ev.code === 'Space' || ev.code === 'KeyE') { ev.preventDefault(); go(); }
    };
    show('#intro');
    focusFirst('#intro');
    if (lines.length) {
      setTimeout(function () {
        UNLIT_AUDIO.ensure();
        UNLIT_AUDIO.speak(lines.join('。'), null, { rate: 0.9 });
      }, 400);
    }
  }

  function focusFirst(sel) {
    const el = $(sel) && $(sel).querySelector ? $(sel).querySelector('button, input, [tabindex]') : null;
    if (el && el.focus) el.focus();
  }

  // opts: { hasSave, onContinue, chapterName, mode() → 'assist'|'immerse', onModeChange }
  function showTitle(onStart, opts) {
    const o = opts || {};
    const btnMode = $('#btnModeToggle');
    const btnCont = $('#btnContinue');
    const curMode = function () { return typeof o.mode === 'function' ? o.mode() : o.mode; };
    const syncMode = function () {
      if (!btnMode) return;
      const assistOn = curMode() === 'assist';
      btnMode.textContent = '模式：' + (assistOn ? '辅助轮廓（点击切换为沉浸）' : '沉浸（点击切换为辅助轮廓）');
      btnMode.setAttribute('aria-pressed', String(assistOn));
    };
    syncMode();
    if (btnMode) {
      btnMode.onclick = function () {
        UNLIT_AUDIO.ensure();
        if (o.onModeChange) o.onModeChange();
        syncMode();
      };
    }
    if (btnCont) {
      if (o.hasSave) {
        btnCont.textContent = '继续上次：' + (o.chapterName || '未完成的旅程');
        btnCont.onclick = function () { UNLIT_AUDIO.ensure(); hide('#title'); if (o.onContinue) o.onContinue(); };
      } else {
        hide('#btnContinue');
      }
    }
    $('#btnStart').onclick = function () {
      UNLIT_AUDIO.ensure();
      hide('#title');
      if (onStart) onStart();
    };
    $('#btnVoiceToggle').onclick = function () {
      UNLIT_AUDIO.ensure();
      const on = !UNLIT_AUDIO.voiceOn;
      UNLIT_AUDIO.setVoice(on);
      this.textContent = '语音：' + (on ? '开' : '关') + '（点击切换）';
      this.setAttribute('aria-pressed', String(on));
    };
    show('#title');
    focusFirst('#title');
  }

  // ---------- 谜题面板 ----------
  function openPuzzle() {
    const e = engineRef;
    if (!e || e.mode !== 'puzzle' || !e.puzzleId) { hide('#puzzle'); return; }
    const p = e.curChapter().puzzles[e.puzzleId];
    if (!p) { hide('#puzzle'); return; }
    let html = '<div class="puzzle-title">' + (p.title || '谜题') + '</div>';
    html += '<div class="puzzle-desc">' + (p.desc || '') + '</div>';
    if (e.puzzleId === 'elevCall' || e.puzzleId === 'elevFloor') html += renderChoices(p);
    else if (e.puzzleId === 'pay') html += renderPay(p);
    else if (e.puzzleId === 'letter') html += renderLetter(p);
    else if (e.puzzleId === 'books') html += renderBooks(p);
    else if (e.puzzleId === 'audition') html += renderAudition(p);
    html += '<div class="puzzle-tip">⌨ 数字键 1…9 选择 · ←→ 移动焦点 · Enter 确认 · Esc 退出</div>';
    $('#puzzleInner').innerHTML = html;
    show('#puzzle');
    if (e.puzzleId === 'elevCall' || e.puzzleId === 'elevFloor') bindChoices(p);
    else if (e.puzzleId === 'pay') bindPay(p);
    else if (e.puzzleId === 'letter') bindLetter(p);
    else if (e.puzzleId === 'books') bindBooks(p);
    focusFirst('#puzzleInner');
  }

  // 可聚焦/可点的选项（供键盘选择）——选择器与各 bind* 保持一致
  const OPTION_SELECTOR = {
    elevCall: '.puzzle-opt', elevFloor: '.puzzle-opt',
    pay: '.pay-item', books: '.book', letter: '.cell[data-char]'
  };
  function puzzleOptions() {
    const inner = $('#puzzleInner');
    if (!inner || !inner.querySelectorAll) return [];
    const id = engineRef && engineRef.puzzleId;
    const sel = '#puzzleInner ' + (OPTION_SELECTOR[id] || '.puzzle-opt');
    return Array.prototype.slice.call(inner.querySelectorAll(sel));
  }
  function pickOption(index) {
    const list = puzzleOptions();
    if (index < 0 || index >= list.length) return false;
    const el = list[index];
    if (el.onclick) el.onclick();
    else if (el.click) el.click();
    return true;
  }
  function moveOptionFocus(dir) {
    const list = puzzleOptions();
    if (!list.length) return false;
    let i = list.indexOf(document.activeElement);
    if (i < 0) i = dir > 0 ? -1 : 0;
    const next = list[(i + dir + list.length) % list.length];
    if (next && next.focus) next.focus();
    return true;
  }

  function renderChoices(p) {
    let h = '<div class="puzzle-options">';
    p.options.forEach(function (opt, i) {
      h += '<button class="puzzle-opt" data-id="' + opt.id + '" aria-label="' + (i + 1) + '. ' + opt.label + '">' +
        cellHTML(opt.mask) + '<span class="opt-label">' + opt.label + '</span></button>';
    });
    h += '</div><div class="puzzle-feedback" id="pzFb" role="status" aria-live="polite"></div>';
    h += '<div class="puzzle-tip">💡 盲文靠"摸"：凸点在 2×3 的格子里。你可以对比下方的盲文表，或直接按选项。</div>';
    h += brailleChart();
    return h;
  }
  function bindChoices(p) {
    document.querySelectorAll('#puzzleInner .puzzle-opt').forEach(function (btn) {
      btn.onclick = function () {
        const r = engineRef.solvePuzzle(engineRef.puzzleId, btn.dataset.id);
        $('#pzFb').textContent = engineRef.currentMessage ? engineRef.currentMessage.text : '';
        if (r.ok || engineRef.mode !== 'puzzle') openPuzzle();
      };
    });
  }

  function renderPay(p) {
    const w = engineRef.wallet();
    let h = '<div class="puzzle-feedback">店员说："一共 <b>27 元 5 角</b>。"（已选 <span id="paySel" aria-live="polite">0</span> 元）</div>';
    h += '<div class="puzzle-feedback" id="pzFb" role="status" aria-live="polite"></div>';
    h += '<div class="pay-wallet">';
    w.forEach(function (item, i) {
      const desc = item.brailleDots
        ? (item.name + '纸币 · ' + item.size + ' · ' + item.hint)
        : (item.name + '硬币 · ' + item.size + ' · ' + item.edge + '边缘 · 声音' + item.sound);
      const kind = item.brailleDots ? 'bill' : 'coin';
      h += '<button class="pay-item" data-id="' + item.id + '" data-val="' + item.value + '" data-kind="' + kind + '" aria-pressed="false" aria-label="' + (i + 1) + '. ' + desc + '">' + item.name + '<small>' + desc + '</small></button>';
    });
    h += '</div>';
    h += '<div class="puzzle-options"><button class="btn-main" id="payOk">把钱递过去</button></div>';
    h += '<div class="puzzle-tip">💡 纸币摸左下角凸点认面额；硬币比大小、摸边缘：大的锯齿边是一元。</div>';
    return h;
  }
  function bindPay(p) {
    const sel = new Set();
    document.querySelectorAll('#puzzleInner .pay-item').forEach(function (btn) {
      btn.onclick = function () {
        const id = btn.dataset.id;
        if (sel.has(id)) { sel.delete(id); btn.classList.remove('sel'); btn.setAttribute('aria-pressed', 'false'); }
        else {
          sel.add(id); btn.classList.add('sel'); btn.setAttribute('aria-pressed', 'true');
          // 摸到的是硬币还是纸币，声音不一样——这正是盲人认钱的方式
          if (btn.dataset.kind === 'bill') UNLIT_AUDIO.bill();
          else UNLIT_AUDIO.coin(parseInt(btn.dataset.val, 10));
        }
        let total = 0;
        sel.forEach(function (sid) {
          const b = document.querySelector('#puzzleInner .pay-item[data-id="' + sid + '"]');
          total += parseInt(b.dataset.val, 10);
        });
        $('#paySel').textContent = (total / 100).toFixed(1);
      };
    });
    $('#payOk').onclick = function () {
      const r = engineRef.solvePuzzle('pay', Array.from(sel));
      $('#pzFb').textContent = engineRef.currentMessage ? engineRef.currentMessage.text : '';
      if (r.ok || engineRef.mode !== 'puzzle') openPuzzle();
    };
  }

  function renderLetter(p) {
    let h = '<div class="puzzle-feedback">信上的盲文有些磨损（虚线点是磨平了的）。点按或聚焦任意一格"摸"它，会读出那个字母。</div>';
    const lines = p.lines;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      h += '<div class="braille-line"><div class="lbl">' +
        (line.reveal ? '你已经读出的部分' : (line.clue || '——')) + '</div><div class="braille-row">';
      let cells = Braille.textToCells(line.text);
      // 磨损效果按行做种子，保证每次打开都一样（可复现）
      if (line.wear && RNG) cells = Braille.wearCells(cells, RNG.create(1000 + li * 7), line.wear);
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        const ch = c.ch || ' ';
        const label = ch === ' ' ? '空格' : (ch === '⠼' ? '数字符' : ch);
        h += '<span class="cell' + (c.worn ? ' damaged' : '') + '" role="button" tabindex="0" data-char="' + ch + '"' +
          ' aria-label="盲文点：' + label + '">' + cellDots(c.mask, c.wornDots) + '</span>';
      }
      h += '</div></div>';
    }
    h += '<div class="puzzle-feedback" id="pzFb" role="status" aria-live="polite">请把读出的两处答案填进来：</div>';
    h += '<div class="puzzle-options"><input class="braille-input" id="ans1" placeholder="第一处（2 个字母）" maxlength="6" aria-label="第一处答案"><input class="braille-input" id="ans2" placeholder="第二处（6 个字母）" maxlength="8" aria-label="第二处答案"></div>';
    h += '<div class="puzzle-options"><button class="btn-main" id="letterOk">我读完了（Enter）</button></div>';
    h += '<div class="puzzle-tip">💡 第一处是"那本书的名字缩写"，第二处是"明天下午的安排"（拼音）。</div>';
    h += brailleChart();
    return h;
  }
  function bindLetter(p) {
    document.querySelectorAll('#puzzleInner .cell[data-char]').forEach(function (c) {
      const read = function () {
        const ch = c.dataset.char;
        UNLIT_AUDIO.ensure();
        UNLIT_AUDIO.speak(ch === ' ' ? '空格' : (ch === '⠼' ? '数字符' : ch), null, { rate: 0.8 });
        toast('这一格是：<b>' + (ch === ' ' ? '空格' : ch) + '</b>', 1600);
      };
      c.onclick = read;
      c.onkeydown = function (ev) {
        if (ev.code === 'Enter' || ev.code === 'Space') { ev.preventDefault(); read(); }
      };
    });
    $('#letterOk').onclick = submitLetter;
  }
  function submitLetter() {
    if (!engineRef || engineRef.puzzleId !== 'letter') return false;
    const a1 = ($('#ans1').value || '').trim().toLowerCase();
    const a2 = ($('#ans2').value || '').trim().toLowerCase();
    if (a1) engineRef.solvePuzzle('letter', a1);
    if (a2) engineRef.solvePuzzle('letter', a2);
    $('#pzFb').textContent = engineRef.currentMessage ? engineRef.currentMessage.text : '';
    if (engineRef.mode !== 'puzzle') openPuzzle();
    return true;
  }

  function renderBooks(p) {
    let h = '<div class="puzzle-feedback">指尖滑过一排排书脊……每本书的书脊都有盲文缩写。</div>';
    h += '<div class="puzzle-feedback" id="pzFb" role="status" aria-live="polite"></div><div class="book-grid">';
    p.books.forEach(function (b, i) {
      h += '<button class="book" data-id="' + b.id + '" aria-label="' + (i + 1) + '. 一本盲文书，书脊是 ' + b.code + '">' +
        cellsHTML(b.code) + '<div class="bname">' + (engineRef.flags.bookFound && b.id === p.correct ? b.title : '一本盲文书') + '</div></button>';
    });
    h += '</div><div class="puzzle-tip">💡 信里说"那本书的名字缩写是 <b>xx</b>"——找书脊上是两个 x 的那本。</div>';
    return h;
  }
  function bindBooks(p) {
    document.querySelectorAll('#puzzleInner .book').forEach(function (btn) {
      btn.onclick = function () {
        const r = engineRef.solvePuzzle('books', btn.dataset.id);
        $('#pzFb').textContent = engineRef.currentMessage ? engineRef.currentMessage.text : '';
        if (r.ok || engineRef.mode !== 'puzzle') openPuzzle();
      };
    });
  }

  function renderAudition(p) {
    let h = '<div class="puzzle-feedback" id="pzFb" role="status" aria-live="polite">听节拍：每一声"嗒"之后，按 <b>E</b>（或空格）。</div>';
    h += '<div class="beat-dots" aria-hidden="true">';
    for (let i = 0; i < p.beats; i++) h += '<div class="beat" id="beat' + i + '"></div>';
    h += '</div><div class="puzzle-tip">💡 老板在用手杖敲桌面打拍子。第一声之前有一段准备时间。</div>';
    return h;
  }
  function updateAudition() {
    const a = engineRef && engineRef.audition;
    if (!a) return;
    const now = a.t;
    const total = a.total;
    for (let i = 0; i < total; i++) {
      const el = document.querySelector('#beat' + i);
      if (!el) continue;
      const bt = (a.lead || 0) + i * a.interval;
      const active = now >= bt && now < bt + (a.window || 0.35);
      el.classList.toggle('on', active && !a.beats[i]);
      el.classList.toggle('hit', !!(a.beats[i] && a.beats[i].hit));
    }
  }

  function brailleChart() {
    const rows = [
      ['a ⠁', 'b ⠃', 'c ⠉', 'd ⠙', 'e ⠑', 'f ⠋', 'g ⠛', 'h ⠓', 'i ⠊', 'j ⠚'],
      ['k ⠅', 'l ⠇', 'm ⠍', 'n ⠝', 'o ⠕', 'p ⠏', 'q ⠟', 'r ⠗', 's ⠎', 't ⠞'],
      ['u ⠥', 'v ⠧', 'w ⠺', 'x ⠭', 'y ⠽', 'z ⠵', '⠼ 数字符'],
      ['1 ⠼⠁', '2 ⠼⠃', '3 ⠼⠉', '4 ⠼⠙', '5 ⠼⠑', '6 ⠼⠋', '7 ⠼⠛', '8 ⠼⠓', '9 ⠼⠊', '0 ⠼⠚']
    ];
    return '<div class="braille-chart">盲文对照表：<br>' + rows.map(r => r.join(' · ')).join('<br>') + '</div>';
  }

  // ---------- 知识卡 ----------
  function showFacts() {
    const e = engineRef;
    if (!e) return;
    const unlocked = e.factsUnlocked;
    const list = Object.keys(UNLIT_CHAPTERS.FACTS).map(function (id) {
      const f = UNLIT_CHAPTERS.FACTS[id];
      const got = unlocked.indexOf(id) >= 0;
      return '<div class="fact-card" style="opacity:' + (got ? 1 : 0.28) + '"><div class="fc-title">' + (got ? f.icon + ' ' + f.title : '？ 尚未解锁') + '</div><div class="fc-body">' + (got ? f.body : '继续体验，你会遇见它。') + '</div></div>';
    }).join('');
    $('#factsList').innerHTML = list;
    show('#facts');
    focusFirst('#facts');
  }

  function showEnd(facts, restartCb) {
    const list = Object.keys(UNLIT_CHAPTERS.FACTS).map(function (id) {
      const f = UNLIT_CHAPTERS.FACTS[id];
      return '<div class="fact-card"><div class="fc-title">' + f.icon + ' ' + f.title + '</div><div class="fc-body">' + f.body + '</div></div>';
    }).join('');
    $('#endFacts').innerHTML = list;
    $('#btnRestart').onclick = function () { if (restartCb) restartCb(); };
    show('#end');
    focusFirst('#end');
  }

  // ---------- 心灵地图 ----------
  let mapSig = null;
  function showMap() { show('#mapOverlay'); drawMap(true); focusFirst('#mapOverlay'); }
  function hideMap() { hide('#mapOverlay'); }
  function drawMap(force) {
    const e = engineRef;
    if (!e || !e.map) return;
    // 主循环每帧都会调这里：内容没变就别重绘画布
    const sig = e.mapId + '|' + mapCursor.x + ',' + mapCursor.y + '|' + mapSel + '|' + e.memory.length + '|' + e.memory.map(m => m.id + m.type + m.x + m.y).join(',');
    if (!force && sig === mapSig) return;
    mapSig = sig;
    UNLIT_RENDER.drawMapCanvas($('#mapCanvas'), e, mapCursor, mapSel);
  }
  function bindMap() {
    $('#btnMapClose').onclick = function () { hideMap(); };
    document.querySelectorAll('.mark').forEach(function (btn) {
      btn.onclick = function () {
        mapSel = this.dataset.type;
        document.querySelectorAll('.mark').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
      };
    });
  }

  // ---------- HUD ----------
  function updateHud(mode) {
    const e = engineRef;
    if (!e || !e.chapterId) return;
    const ch = e.curChapter();
    if (!ch) return;
    setHud(ch.name, ch.goal, mode);
  }

  root.UNLIT_UI = {
    setEngine, show, hide, say, toast, setHud,
    showIntro, showTitle, openPuzzle, updateAudition,
    showFacts, showEnd, showMap, hideMap, drawMap, bindMap,
    updateHud, overlayOpen, pickOption, moveOptionFocus, submitLetter, focusFirst,
    get mapSel() { return mapSel; }, set mapSel(v) { mapSel = v; },
    get mapCursor() { return mapCursor; }, set mapCursor(v) { mapCursor = v; }
  };
})(typeof self !== 'undefined' ? self : this);
