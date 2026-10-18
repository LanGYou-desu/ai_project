/* UNLIT · 无光之城 — 主循环与输入
 * 键盘：W/↑ 前进 · S/↓ 后退 · ←→/A/D 转身 · Space 白杖 · E 触摸/对话/试音
 *       M 心灵地图 · H 提示 · N 语音导航 · F 知识卡 · Tab 沉浸/辅助
 * 谜题内：数字键 1…9 选择 · ←→ 移动焦点 · Enter 确认 · Esc 退出
 * 进度自动存档（localStorage），标题屏可「继续上次」。
 */
(function () {
  'use strict';
  const engine = UNLIT_ENGINE.create();
  const audio = UNLIT_AUDIO;
  const ui = UNLIT_UI;
  const render = UNLIT_RENDER;

  const SAVE_KEY = 'unlit.save.v1';

  let state = 'title';        // title | intro | play
  let assist = false;         // 默认沉浸：屏幕几乎全黑，一切靠听（Tab 或标题屏按钮切换）
  let lastChapter = null;
  let lastPuzzle = null;
  let mapOpen = false;
  let hintIndex = 0;
  let lastNavSpeak = 0;
  let lastSaveAt = 0;
  let audioWarned = false;
  let errorNotified = false;

  const keys = { w: false, s: false, a: false, d: false, left: false, right: false };
  let moveTimer = 0;

  // ---------- 存档 ----------
  function readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return (s && s.v === engine.SAVE_VERSION && s.chapterId) ? s : null;
    } catch (err) { return null; }
  }
  function writeSave() {
    try {
      if (!engine.chapterId || engine.gameOver || state === 'title') return;
      localStorage.setItem(SAVE_KEY, JSON.stringify(engine.snapshot()));
      lastSaveAt = performance.now();
    } catch (err) { /* 隐私模式 / 无 localStorage：忽略 */ }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* noop */ } }

  // ---------- 引擎回调 ----------
  engine.onSay = function (msg) {
    ui.say(msg.speaker, msg.text);
    const t = String(msg.text);
    if (t.length > 2 && t.charAt(0) !== '（') audio.speak(t, msg.speaker);
  };
  engine.onEvent = function (ev) {
    if (ev.type === 'gameover') {
      clearSave();
      setTimeout(function () {
        audio.ending();
        ui.showEnd(engine.factsUnlocked, function () { location.reload(); });
      }, 900);
    }
    if (ev.type === 'nearmiss') ui.toast('🚗 小心！过马路要等绿灯（H 看提示）', 3000);
    // 节拍器：试音谜题必须听得见"嗒"，否则纯听觉玩家无从下手
    if (ev.type === 'beat') audio.metronome(!!(ev.data && ev.data.accent));
    if (ev.type === 'chop') audio.chop();
    if (ev.type === 'flag' || ev.type === 'map' || ev.type === 'chapter' || ev.type === 'puzzle') writeSave();
  };

  // ---------- 输入 ----------
  function setKey(code, on) {
    switch (code) {
      case 'KeyW': case 'ArrowUp': keys.w = on; break;
      case 'KeyS': case 'ArrowDown': keys.s = on; break;
      case 'KeyA': keys.a = on; break;
      case 'KeyD': keys.d = on; break;
      case 'ArrowLeft': keys.left = on; break;
      case 'ArrowRight': keys.right = on; break;
    }
  }

  function toggleAssist() {
    assist = !assist;
    ui.toast(assist ? '辅助模式：微弱轮廓已开启' : '沉浸模式：屏幕几乎全黑', 1800);
    audio.speak(assist ? '辅助模式' : '沉浸模式');
  }

  document.addEventListener('keydown', function (ev) {
    audio.ensure();
    if (audio.unavailable && !audioWarned) {
      audioWarned = true;
      ui.toast('⚠ 此浏览器不支持 Web Audio，将以文字模式运行（游戏仍可通关）', 6000);
    }
    // 覆盖层打开时把 Tab 让给浏览器，键盘用户才能聚焦谜题按钮
    if (ev.code === 'Tab') {
      if (ui.overlayOpen && ui.overlayOpen()) return;
      ev.preventDefault();
      toggleAssist();
      return;
    }
    if (mapOpen) { handleMapKey(ev); return; }
    // 对话模式：E/Enter/Space 推进
    if (engine.mode === 'dialogue') {
      if (ev.code === 'KeyE' || ev.code === 'Enter' || ev.code === 'Space') { ev.preventDefault(); engine.dialogueNext(); }
      return;
    }
    // 谜题模式：键盘也能完成（数字键 / 方向键 / Enter / Esc）
    if (engine.mode === 'puzzle') {
      const inInput = ev.target && ev.target.tagName === 'INPUT';
      if (engine.puzzleId === 'audition' && !inInput && (ev.code === 'KeyE' || ev.code === 'Space')) {
        ev.preventDefault();
        const r = engine.auditionPress();
        audio.click(r && r.hit ? 0.3 : 0.18);
        return;
      }
      if (ev.code === 'Escape') {
        if (engine.cancelAudition) engine.cancelAudition();
        engine.mode = 'play'; engine.puzzleId = null;
        ui.hide('#puzzle');
        return;
      }
      if (inInput) {
        if (ev.code === 'Enter') { ev.preventDefault(); ui.submitLetter(); }
        return;                                    // 输入框里正常打字
      }
      if (ev.code === 'Enter' && engine.puzzleId === 'letter') { ev.preventDefault(); ui.submitLetter(); return; }
      if (/^Digit[1-9]$/.test(ev.code)) {
        ev.preventDefault();
        ui.pickOption(Number(ev.code.slice(5)) - 1);
        return;
      }
      if (ev.code === 'ArrowLeft' || ev.code === 'ArrowRight') {
        ev.preventDefault();
        ui.moveOptionFocus(ev.code === 'ArrowRight' ? 1 : -1);
        return;
      }
      return;
    }
    // 普通游玩
    if (ev.code === 'Escape') { ui.hide('#facts'); ui.hide('#puzzle'); }
    if (state !== 'play') return;
    switch (ev.code) {
      case 'Space':
        ev.preventDefault();
        if (engine.mode === 'play') {
          const res = engine.tap();
          audio.tapCane(res);
          audio.speak(echoText(res), null, { rate: 0.9 });
        }
        break;
      case 'KeyE': {
        if (engine.mode === 'play') {
          const r = engine.interact();
          if (!r.found && r.noop !== true) audio.speak('什么都没有。');
        }
        break;
      }
      case 'KeyM': toggleMap(); break;
      case 'KeyH':
        if (engine.curChapter && engine.curChapter().hints) {
          const hs = engine.curChapter().hints;
          const t = hs[hintIndex % hs.length];
          hintIndex++;
          ui.toast('💡 ' + t, 5000);
          audio.speak(t, null, { rate: 0.95 });
        }
        break;
      case 'KeyN': {
        const nav = engine.navTarget ? engine.navTarget() : null;
        if (nav) {
          const meters = Math.max(1, Math.round(nav.d));
          const txt = '目标：' + nav.name + '，' + nav.dirText + '，约 ' + meters + ' 米。';
          ui.toast('🧭 ' + txt, 3500);
          if (Date.now() - lastNavSpeak > 2000) { audio.speak(txt, null, { rate: 0.9 }); lastNavSpeak = Date.now(); }
        } else ui.toast('🧭 附近没有明确目标', 2000);
        break;
      }
      case 'KeyF': {
        const facts = document.querySelector('#facts');
        if (facts.classList.contains('hidden')) ui.showFacts(); else ui.hide('#facts');
        break;
      }
      default: setKey(ev.code, true);
    }
  });

  document.addEventListener('keyup', function (ev) { setKey(ev.code, false); });

  function echoText(res) {
    if (!res || !res.hit) return '空旷。';
    const d = res.dist.toFixed(1);
    const side = res.pan > 0.25 ? '偏右' : res.pan < -0.25 ? '偏左' : '正前';
    return res.by === 'object'
      ? '前方 ' + d + ' 米，' + side + '，有东西。'
      : '前方 ' + d + ' 米，' + side + '，是墙。';
  }

  // ---------- 心灵地图 ----------
  function toggleMap() {
    mapOpen = !mapOpen;
    if (mapOpen) { ui.mapCursor = { x: Math.floor(engine.px), y: Math.floor(engine.py) }; ui.showMap(); }
    else ui.hideMap();
  }
  function handleMapKey(ev) {
    const c = ui.mapCursor;
    const m = engine.map;
    const step = function (dx, dy) {
      const nx = Math.max(1, Math.min(m.w - 2, c.x + dx));
      const ny = Math.max(1, Math.min(m.h - 2, c.y + dy));
      ui.mapCursor = { x: nx, y: ny };
    };
    switch (ev.code) {
      case 'ArrowUp': step(0, -1); break;
      case 'ArrowDown': step(0, 1); break;
      case 'ArrowLeft': step(-1, 0); break;
      case 'ArrowRight': step(1, 0); break;
      case 'Enter': engine.addMarker(ui.mapSel, c.x, c.y); ui.drawMap(); audio.chime(); break;
      case 'Backspace': {
        const mk = engine.memory.filter(x => x.x === c.x && x.y === c.y).pop();
        if (mk) engine.removeMarker(mk.id);
        ui.drawMap();
        break;
      }
      case 'KeyM': case 'Escape': toggleMap(); break;
    }
  }

  // 地图画布点击放置标记
  document.addEventListener('DOMContentLoaded', function () {
    const mcv = document.querySelector('#mapCanvas');
    if (mcv) {
      mcv.addEventListener('click', function (ev) {
        if (!mapOpen || !engine.map) return;
        const rect = mcv.getBoundingClientRect();
        const m = engine.map;
        const scale = Math.min((mcv.width - 20) / m.w, (mcv.height - 20) / m.h);
        const ox = (mcv.width - m.w * scale) / 2, oy = (mcv.height - m.h * scale) / 2;
        const cx = (ev.clientX - rect.left) / rect.width * mcv.width;
        const cy = (ev.clientY - rect.top) / rect.height * mcv.height;
        const x = Math.floor((cx - ox) / scale), y = Math.floor((cy - oy) / scale);
        if (x >= 0 && y >= 0 && x < m.w && y < m.h && m.grid[y] && m.grid[y][x] === '.') {
          engine.addMarker(ui.mapSel, x, y);
          ui.drawMap();
          audio.chime();
        }
      });
    }
  });

  // ---------- 主循环 ----------
  let last = performance.now();
  function frame(now) {
    try {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      // 章节切换 → 引言
      if (engine.chapterId && engine.chapterId !== lastChapter) {
        lastChapter = engine.chapterId;
        state = 'intro';
        const ch = engine.curChapter();
        ui.showIntro(ch, function () { state = 'play'; });
      }

      if (state === 'play') {
        engine.update(dt);
        audio.update(engine);
        handleHeld(dt);
        if (now - lastSaveAt > 4000) writeSave();
      }

      // 谜题面板开合
      if (engine.mode === 'puzzle' && engine.puzzleId !== lastPuzzle) {
        lastPuzzle = engine.puzzleId;
        ui.openPuzzle();
      } else if (engine.mode !== 'puzzle' && lastPuzzle !== null) {
        lastPuzzle = null;
        ui.hide('#puzzle');
      }
      if (engine.audition) ui.updateAudition();

      // HUD 与渲染
      ui.updateHud(assist ? 'assist' : 'immerse');
      if (mapOpen) ui.drawMap();
      render.draw(engine, assist);
    } catch (err) {
      // 静默吞掉异常 = 玩家只看到黑屏却不知道发生了什么
      console.error('[UNLIT] frame error:', err);
      if (!errorNotified) {
        errorNotified = true;
        ui.toast('⚠ 游戏遇到异常，已跳过该帧（按 F12 可查看详情）', 6000);
      }
    }
    requestAnimationFrame(frame);
  }

  let lastMoveSound = 0;
  function handleHeld(dt) {
    if (engine.mode !== 'play') return;
    const cos = Math.cos(engine.facing), sin = Math.sin(engine.facing);
    let moved = false;
    if (keys.w) { moveTimer -= dt; if (moveTimer <= 0) { moveTimer = 0.09; engine.move(cos, sin); moved = true; } }
    if (keys.s) { moveTimer -= dt; if (moveTimer <= 0) { moveTimer = 0.09; engine.move(-cos, -sin); moved = true; } }
    if (keys.left || keys.a) engine.turn(-2.2 * dt);
    if (keys.right || keys.d) engine.turn(2.2 * dt);
    if (moved && performance.now() - lastMoveSound > 400) { audio.step(); lastMoveSound = performance.now(); }
  }

  // ---------- 启动 ----------
  window.__UNLIT_ENGINE = engine;   // 调试/冒烟用
  render.init(document.querySelector('#world'));
  ui.setEngine(engine);
  ui.bindMap();
  if (audio.bindAutoResume) audio.bindAutoResume();
  const saved = readSave();
  ui.showTitle(function () {
    clearSave();
    state = 'intro';
    lastChapter = null;
    engine.loadChapter('ch0');
  }, {
    hasSave: !!saved,
    chapterName: saved ? (UNLIT_CHAPTERS.get(saved.chapterId) || {}).name : null,
    mode: function () { return assist ? 'assist' : 'immerse'; },
    onModeChange: function () { assist = !assist; },
    onContinue: function () {
      if (engine.restore(saved)) {
        lastChapter = engine.chapterId;   // 跳过引言，直接接着玩
        state = 'play';
        engine.say('继续上次的进度。', '旁白');
        ui.toast('📖 已载入上次进度', 2500);
      } else {
        clearSave();
        state = 'intro';
        lastChapter = null;
        engine.loadChapter('ch0');
      }
    }
  });
  requestAnimationFrame(frame);
})();
