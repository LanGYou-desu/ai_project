/* UNLIT · 无光之城 — 主循环与输入
 * 键盘：W/↑ 前进 · S/↓ 后退 · ←→/A/D 转身 · Space 白杖 · E 触摸/对话/试音
 *       M 心灵地图 · H 提示 · N 语音导航 · F 知识卡 · Tab 沉浸/辅助
 */
(function () {
  'use strict';
  const engine = UNLIT_ENGINE.create();
  const audio = UNLIT_AUDIO;
  const ui = UNLIT_UI;
  const render = UNLIT_RENDER;

  let state = 'title';        // title | intro | play
  let assist = true;
  let lastChapter = null;
  let lastPuzzle = null;
  let mapOpen = false;
  let hintIndex = 0;
  let lastNavSpeak = 0;

  const keys = { w: false, s: false, a: false, d: false, left: false, right: false };
  let moveTimer = 0, turnTimer = 0;

  // ---------- 引擎回调 ----------
  engine.onSay = function (msg) {
    ui.say(msg.speaker, msg.text);
    const t = String(msg.text);
    if (t.length > 2 && t.charAt(0) !== '（') {
      audio.speak(t, msg.speaker);
    }
  };
  engine.onEvent = function (ev) {
    if (ev.type === 'gameover') {
      setTimeout(function () {
        audio.ending();
        ui.showEnd(engine.factsUnlocked, function () { location.reload(); });
      }, 900);
    }
    if (ev.type === 'nearmiss') ui.toast('🚗 小心！过马路要等绿灯（H 看提示）', 3000);
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

  document.addEventListener('keydown', function (ev) {
    audio.ensure();
    if (ev.code === 'Tab') {
      ev.preventDefault();
      assist = !assist;
      ui.toast(assist ? '辅助模式：微弱轮廓已开启' : '沉浸模式：屏幕几乎全黑', 1800);
      return;
    }
    // 心灵地图打开时
    if (mapOpen) {
      handleMapKey(ev);
      return;
    }
    // 对话模式：E/Enter 推进
    if (engine.mode === 'dialogue') {
      if (ev.code === 'KeyE' || ev.code === 'Enter' || ev.code === 'Space') { ev.preventDefault(); engine.dialogueNext(); }
      return;
    }
    // 谜题模式
    if (engine.mode === 'puzzle') {
      if (engine.puzzleId === 'audition' && (ev.code === 'KeyE' || ev.code === 'Space')) { ev.preventDefault(); engine.auditionPress(); audio.click(0.2); }
      if (ev.code === 'Escape') { engine.mode = 'play'; engine.puzzleId = null; ui.hide('#puzzle'); }
      return;
    }
    // 普通游玩
    if (ev.code === 'Escape') { ui.hide('#facts'); ui.hide('#puzzle'); }
    if (state !== 'play') return;
    switch (ev.code) {
      case 'Space':
        ev.preventDefault();
        if (engine.mode === 'play') { const res = engine.tap(); audio.tapCane(res); audio.speak(echoText(res), null, { rate: 0.9 }); }
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
        const vis = !document.querySelector('#facts').classList.contains('hidden');
        if (vis) ui.hide('#facts'); else ui.showFacts();
        break;
      }
      case 'Enter': if (engine.mode === 'dialogue') engine.dialogueNext(); break;
      default: setKey(ev.code, true);
    }
  });

  document.addEventListener('keyup', function (ev) { setKey(ev.code, false); });

  function echoText(res) {
    if (!res || !res.hit) return '空旷。';
    const d = res.dist.toFixed(1);
    return res.by === 'object' ? '前方 ' + d + ' 米，有东西。' : '前方 ' + d + ' 米，是墙。';
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
        const x = Math.floor((ev.clientX - rect.left) / rect.width * mcv.width - ox) / scale;
        const y = Math.floor((ev.clientY - rect.top) / rect.height * mcv.height - oy) / scale;
        if (x >= 0 && y >= 0 && x < m.w && y < m.h && m.grid[y][x] !== '#') {
          engine.addMarker(ui.mapSel, Math.floor(x), Math.floor(y));
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
      if (window.__UNLIT_DEBUG) console.error('[UNLIT] frame error:', err);
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
  ui.showTitle(function () {
    state = 'intro';
    lastChapter = null;
    engine.loadChapter('ch0');
  });
  requestAnimationFrame(frame);

  // 提示辅助模式
  setTimeout(function () {
    if (state === 'title') {
      // 标题屏展示时提示
    }
  }, 600);
})();
