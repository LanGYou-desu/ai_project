/* UNLIT · 无光之城 — 界面（DOM 覆盖层、谜题面板、心灵地图交互）
 * 依赖：UNLIT_BRAILLE / UNLIT_AUDIO / UNLIT_RENDER
 */
(function (root) {
  'use strict';
  const $ = s => document.querySelector(s);
  const Braille = (typeof UNLIT_BRAILLE !== 'undefined') ? UNLIT_BRAILLE : null;
  let engineRef = null;
  let mapCursor = { x: 2, y: 2 }, mapSel = 'self';

  function setEngine(e) { engineRef = e; }

  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); }

  function say(speaker, text) {
    const sb = $('#saybox');
    $('#saySpeaker').textContent = speaker;
    $('#sayText').textContent = text;
    sb.style.borderLeftColor = '#e8b96a';
  }

  let toastTimer = 0;
  function toast(html, ms) {
    const t = $('#toast');
    t.innerHTML = html;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 3600);
  }

  function setHud(chap, goal, mode) {
    $('#hudChap').textContent = chap || '';
    $('#hudGoal').textContent = goal || '';
    $('#hudMode').textContent = mode === 'assist' ? '辅助' : '沉浸';
  }

  // ---------- 盲文单元格 ----------
  function cellDots(mask) {
    const grid = Braille.cellGrid(mask);
    let h = '';
    for (const row of grid) {
      for (const on of row) {
        h += '<span class="dot ' + (on ? '' : 'off') + '"></span>';
      }
    }
    return h;
  }
  function cellHTML(mask) {
    return '<span class="cell">' + cellDots(mask) + '</span>';
  }
  function cellsHTML(word) {
    return Braille.textToCells(word).map(c => cellHTML(c.mask)).join('');
  }

  // ---------- 章节引言 ----------
  function showIntro(chapter, onDone) {
    const lines = chapter.intro || [];
    $('#introChap').textContent = chapter.name;
    $('#introLines').innerHTML = lines.map(l => '<p>' + l + '</p>').join('');
    $('#btnIntro').onclick = function () {
      hide('#intro');
      UNLIT_AUDIO.stinger(chapter.id);
      if (onDone) onDone();
    };
    show('#intro');
    // 引言第一句朗读
    if (lines.length) {
      setTimeout(function () {
        UNLIT_AUDIO.ensure();
        UNLIT_AUDIO.speak(lines.join('。'), null, { rate: 0.9 });
      }, 400);
    }
  }

  function showTitle(onStart) {
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
    };
    show('#title');
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
    $('#puzzleInner').innerHTML = html;
    show('#puzzle');
    // 绑定事件
    if (e.puzzleId === 'elevCall' || e.puzzleId === 'elevFloor') bindChoices(p);
    else if (e.puzzleId === 'pay') bindPay(p);
    else if (e.puzzleId === 'letter') bindLetter(p);
    else if (e.puzzleId === 'books') bindBooks(p);
  }

  function renderChoices(p) {
    let h = '<div class="puzzle-options">';
    for (const opt of p.options) {
      h += '<button class="puzzle-opt" data-id="' + opt.id + '">' + cellHTML(opt.mask) + '<span class="opt-label">' + opt.label + '</span></button>';
    }
    h += '</div><div class="puzzle-feedback" id="pzFb"></div>';
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
    let h = '<div class="puzzle-feedback">店员说："一共 <b>27 元 5 角</b>。"（已选 <span id="paySel">0</span> 元）</div>';
    h += '<div class="puzzle-feedback" id="pzFb"></div>';
    h += '<div class="pay-wallet">';
    for (const item of w) {
      const desc = item.brailleDots ? (item.name + '纸币 · ' + item.size + ' · ' + item.hint) : (item.name + '硬币 · ' + item.size + ' · ' + item.edge + '边缘 · 声音' + item.sound);
      h += '<button class="pay-item" data-id="' + item.id + '" data-val="' + item.value + '">' + item.name + '<small>' + desc + '</small></button>';
    }
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
        if (sel.has(id)) { sel.delete(id); btn.classList.remove('sel'); }
        else { sel.add(id); btn.classList.add('sel'); }
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
    let h = '<div class="puzzle-feedback">信上的盲文有些磨损。点击任意一格"摸"它，会读出那个字母。</div>';
    const lines = p.lines;
    for (const line of lines) {
      h += '<div class="braille-line"><div class="lbl">' + (line.reveal ? '你已经读出的部分' : '——') + '</div><div class="braille-row">';
      const cells = Braille.textToCells(line.text);
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        h += '<span class="cell" data-char="' + (c.ch || ' ') + '" data-ans="' + (line.answer || '') + '">' + cellDots(c.mask) + '</span>';
      }
      h += '</div></div>';
    }
    h += '<div class="puzzle-feedback" id="pzFb">请把读出的两处答案填进来：</div>';
    h += '<div class="puzzle-options"><input class="braille-input" id="ans1" placeholder="第一处（2 个字母）" maxlength="6"><input class="braille-input" id="ans2" placeholder="第二处（6 个字母）" maxlength="8"></div>';
    h += '<div class="puzzle-options"><button class="btn-main" id="letterOk">我读完了</button></div>';
    h += '<div class="puzzle-tip">💡 第一处是"那本书的名字缩写"，第二处是"明天下午的安排"（拼音）。</div>';
    h += brailleChart();
    return h;
  }
  function bindLetter(p) {
    document.querySelectorAll('#puzzleInner .cell').forEach(function (c) {
      c.onclick = function () {
        const ch = this.dataset.char;
        UNLIT_AUDIO.ensure();
        UNLIT_AUDIO.speak(ch === ' ' ? '空格' : (ch === '⠼' ? '数字符' : ch), null, { rate: 0.8 });
        toast('这一格是：<b>' + (ch === ' ' ? '空格' : ch) + '</b>', 1600);
      };
    });
    $('#letterOk').onclick = function () {
      const a1 = ($('#ans1').value || '').trim().toLowerCase();
      const a2 = ($('#ans2').value || '').trim().toLowerCase();
      let r = null;
      if (a1) r = engineRef.solvePuzzle('letter', a1);
      if (a2) r = engineRef.solvePuzzle('letter', a2);
      $('#pzFb').textContent = engineRef.currentMessage ? engineRef.currentMessage.text : '';
      if (engineRef.mode !== 'puzzle') openPuzzle();
    };
  }

  function renderBooks(p) {
    let h = '<div class="puzzle-feedback">指尖滑过一排排书脊……每本书的书脊都有盲文缩写。</div>';
    h += '<div class="puzzle-feedback" id="pzFb"></div><div class="book-grid">';
    for (const b of p.books) {
      h += '<button class="book" data-id="' + b.id + '">' + cellsHTML(b.code) + '<div class="bname">' + (engineRef.flags.bookFound && b.id === p.correct ? b.title : '一本盲文书') + '</div></button>';
    }
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
    let h = '<div class="puzzle-feedback" id="pzFb">听节拍：每一声"嗒"之后，按 <b>E</b>（或点击圆点）。</div>';
    h += '<div class="beat-dots">';
    for (let i = 0; i < p.beats; i++) h += '<div class="beat" id="beat' + i + '"></div>';
    h += '</div><div class="puzzle-tip">💡 老板在用手杖敲桌面打拍子。</div>';
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
      const bt = i * a.interval;
      const active = now >= bt && now < bt + 0.35;
      el.classList.toggle('on', active && !a.beats[i]);
      el.classList.toggle('hit', !!(a.beats[i] && a.beats[i].hit));
    }
  }

  function brailleChart() {
    const rows = [
      ['a ⠁', 'b ⠃', 'c ⠉', 'd ⠙', 'e ⠑', 'f ⠋', 'g ⠛', 'h ⠓', 'i ⠊', 'j ⠚'],
      ['k ⠅', 'l ⠇', 'm ⠍', 'n ⠝', 'o ⠕', 'p ⠏', 'q ⠟', 'r ⠗', 's ⠎', 't ⠞'],
      ['u ⠥', 'v ⠧', 'w ⠺', 'x ⠭', 'y ⠽', 'z ⠵', '1 ⠼⠁', '2 ⠼⠃', '3 ⠼⠉', '0 ⠼⠚']
    ];
    return '<div class="braille-chart">盲文对照表：<br>' + rows.map(r => r.join(' · ')).join('<br>') + '</div>';
  }

  // ---------- 知识卡 ----------
  function showFacts() {
    const e = engineRef;
    if (!e) return;
    const all = e.curChapter ? Object.keys(UNLIT_CHAPTERS.FACTS) : [];
    const unlocked = e.factsUnlocked;
    const list = all.map(function (id) {
      const f = UNLIT_CHAPTERS.FACTS[id];
      const got = unlocked.indexOf(id) >= 0;
      return '<div class="fact-card" style="opacity:' + (got ? 1 : 0.28) + '"><div class="fc-title">' + (got ? f.icon + ' ' + f.title : '？ 尚未解锁') + '</div><div class="fc-body">' + (got ? f.body : '继续体验，你会遇见它。') + '</div></div>';
    }).join('');
    $('#factsList').innerHTML = list;
    show('#facts');
  }

  function showEnd(facts, restartCb) {
    const list = Object.keys(UNLIT_CHAPTERS.FACTS).map(function (id) {
      const f = UNLIT_CHAPTERS.FACTS[id];
      return '<div class="fact-card"><div class="fc-title">' + f.icon + ' ' + f.title + '</div><div class="fc-body">' + f.body + '</div></div>';
    }).join('');
    $('#endFacts').innerHTML = list;
    $('#btnRestart').onclick = function () { if (restartCb) restartCb(); };
    show('#end');
  }

  // ---------- 心灵地图 ----------
  function showMap() { show('#mapOverlay'); drawMap(); }
  function hideMap() { hide('#mapOverlay'); }
  function drawMap() {
    UNLIT_RENDER.drawMapCanvas($('#mapCanvas'), engineRef, mapCursor, mapSel);
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

  // ---------- HUD 与结束 ----------
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
    updateHud, get mapSel() { return mapSel; }, set mapSel(v) { mapSel = v; },
    get mapCursor() { return mapCursor; }, set mapCursor(v) { mapCursor = v; }
  };
})(typeof self !== 'undefined' ? self : this);
