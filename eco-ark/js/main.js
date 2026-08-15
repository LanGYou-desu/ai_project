/* ECO-ARK · 主控制器：菜单 / 章节流程 / 沙盒 / 交互 / 存档 / 成就 / 渲染循环 */
(function () {
  'use strict';
  var SPEC = window.ECOARK.species;
  var RNG = window.ECOARK.rng;
  var WORLD = window.ECOARK.world;
  var SIM = window.ECOARK.sim;
  var CHAPTERS = window.ECOARK.chapters;
  var KNOW = window.ECOARK.knowledge;
  var View = window.ECOARK.view;
  var Charts = window.ECOARK.charts;
  var Audio = window.ECOARK.audio;

  var SAVE_KEY = 'ecoark_save_v1';
  var ACH_KEY = 'ecoark_achievements_v1';

  var G = {
    mode: 'menu',           // menu | campaign | sandbox
    chapter: 1,
    sim: null,
    chState: null,
    chResult: null,
    paused: true,
    speed: 4,               // 1 2 4 8 16
    tool: 'plant',
    selected: 'grass',
    eventChance: 0.014,
    actions: [],            // {m: month, a: 'place'|'remove'|'fertilize'|'event'|'paint', ...}
    stars: {},              // chapter -> stars
    achievements: {},
    seed: 'ark-' + Date.now().toString(36),
    scripted: [],           // {m: month, ev: id}
    yearAcc: 0,
    monthAcc: 0,
    lastFrame: 0,
    brushPos: null,
    achievementsUnlocked: {}
  };

  // ---------- DOM ----------
  var $ = function (id) { return document.getElementById(id); };
  var els = {};
  var speciesPanel, toolBar, objPanel, logPanel, metricPanel, chartCanvas, canvasWrap, hoverTip;

  // ---------- 工具函数 ----------
  function fmt(v, d) { return v == null ? '—' : Number(v).toFixed(d == null ? 1 : d); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function uid() { return Math.random().toString(36).slice(2, 8); }

  // ---------- 初始化 ----------
  function boot() {
    els.top = {};
    ['chapterPill', 'clock', 'btnPause', 'btnSpeed1', 'btnSpeed2', 'btnSpeed4', 'btnSpeed8', 'btnSpeed16',
      'btnBook', 'btnSave', 'btnSound', 'btnMenu'].forEach(function (id) { els[id] = $(id); });
    canvasWrap = $('canvasWrap');
    hoverTip = $('hoverTip');
    speciesPanel = $('speciesPanel');
    toolBar = $('toolbar');
    objPanel = $('objectives');
    logPanel = $('log');
    metricPanel = $('metrics');
    chartCanvas = $('chartCanvas');

    View.init($('canvas'));
    Charts.init(chartCanvas);
    loadPersist();
    bindUI();
    showMenu();
    requestAnimationFrame(loop);
  }

  // ---------- 持久化 ----------
  function loadPersist() {
    try {
      var s = localStorage.getItem(ACH_KEY);
      if (s) G.achievements = JSON.parse(s);
      var sv = localStorage.getItem(SAVE_KEY);
      if (sv) G.saveData = JSON.parse(sv);
    } catch (e) { G.saveData = null; }
  }
  function saveGame() {
    if (!G.sim) return;
    var data = {
      v: 1, mode: G.mode, chapter: G.chapter, seed: G.seed,
      eventChance: G.eventChance, actions: G.actions,
      stars: G.stars, chState: serializeChState(G.chState),
      scripted: G.scripted, vinePeak: G.vinePeak || 0,
      month: G.sim.month
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }
  function serializeChState(st) {
    if (!st) return null;
    var o = {};
    for (var k in st) {
      if (k === 'lastAlive') o[k] = Array.from(st[k]);
      else o[k] = st[k];
    }
    return o;
  }
  function deserializeChState(o) {
    if (!o) return null;
    var st = CHAPTERS.createState(o.no);
    for (var k in o) {
      if (k === 'lastAlive') st[k] = new Set(o[k]);
      else st[k] = o[k];
    }
    return st;
  }
  function persistAchievements() {
    try { localStorage.setItem(ACH_KEY, JSON.stringify(G.achievements)); } catch (e) { /* ignore */ }
  }

  // ---------- 菜单 ----------
  function showMenu() {
    G.mode = 'menu';
    G.paused = true;
    var starsTotal = Object.values(G.stars).reduce(function (a, b) { return a + b; }, 0);
    var achCount = Object.keys(G.achievements).length;
    var html = '<div class="menu-bg"></div><div class="menu-card">' +
      '<h1>🌱 ECO·ARK</h1>' +
      '<h2>生态方舟 · 星球重建模拟器</h2>' +
      '<p class="menu-sub">2097 年，苔原星生态崩溃。你作为方舟管理员，将亲手重建从苔藓到狼群的完整食物网，并让它挺过冰期、陨石与入侵物种——整整一百二十年。</p>' +
      '<div class="menu-stats">' +
      '<span>⭐ 累计星级 ' + starsTotal + '/18</span>' +
      '<span>🏆 成就 ' + achCount + '/12</span>' +
      '<span>🌍 21 种物种 · 6 章剧情</span>' +
      '</div>' +
      '<div class="menu-btns">' +
      '<button class="btn primary big" data-act="campaign">🚀 剧情模式（约 1 小时）</button>' +
      '<button class="btn big" data-act="sandbox">🔬 沙盒模式（自由演化）</button>' +
      (G.saveData ? '<button class="btn big" data-act="continue">💾 继续上次的方舟</button>' : '') +
      '<button class="btn big" data-act="book">📖 生态图鉴</button>' +
      '</div>' +
      '<p class="menu-tip">💡 玩法：左键在培养皿上涂抹物种 → 观察种群曲线 → 应对天灾 → 达成章节目标。<br>建议佩戴耳机，音量为程序合成环境音。</p>' +
      '</div>';
    var wrap = el('div', 'modal-overlay', html);
    wrap.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-act');
        wrap.remove();
        if (act === 'campaign') startCampaign();
        else if (act === 'sandbox') startSandbox();
        else if (act === 'continue') loadGame();
        else if (act === 'book') showBook();
      });
    });
    document.body.appendChild(wrap);
  }

  // ---------- 章节流程 ----------
  function startCampaign() {
    G.mode = 'campaign';
    G.chapter = 1;
    G.seed = 'campaign-' + Date.now().toString(36);
    G.stars = {};
    beginChapter();
  }

  function startSandbox() {
    G.mode = 'sandbox';
    G.chapter = 0;
    G.seed = 'sandbox-' + Date.now().toString(36);
    G.eventChance = 0.02;
    var wrap = el('div', 'modal-overlay', '<div class="menu-card small">' +
      '<h2>🔬 沙盒模式</h2>' +
      '<label>自然事件频率：</label><select id="sbEv"><option value="0.008">平静</option><option value="0.02" selected>正常</option><option value="0.045">激烈</option></select>' +
      '<div class="menu-btns"><button class="btn primary" id="sbGo">开始演化</button></div>' +
      '</div>');
    document.body.appendChild(wrap);
    wrap.querySelector('#sbGo').addEventListener('click', function () {
      G.eventChance = parseFloat(wrap.querySelector('#sbEv').value);
      wrap.remove();
      newSim(true);
    });
  }

  function beginChapter() {
    var ch = CHAPTERS.byNo(G.chapter);
    // 章节专属脚本事件
    G.scripted = [];
    if (G.chapter === 4) G.scripted.push({ m: 24, ev: 'iceage' });       // 第 2 年冰期
    if (G.chapter === 5) G.scripted.push({ m: 6, ev: 'vine' });          // 半年后藤蔓入侵
    newSim(false);
    showChapterIntro(ch);
  }

  function showChapterIntro(ch) {
    var objHtml = ch.objectives.map(function (o, i) {
      return '<div class="obj-item"><span class="obj-num">' + (i + 1) + '</span><span>' + o.desc + '</span></div>';
    }).join('');
    var wrap = el('div', 'modal-overlay', '<div class="menu-card chapter-card">' +
      '<div class="ch-badge">第 ' + ch.no + ' 章</div>' +
      '<h2>' + ch.title + '</h2>' +
      '<p class="ch-intro">' + ch.intro + '</p>' +
      '<div class="ch-brief">' + ch.briefing + '</div>' +
      '<div class="obj-list">' + objHtml + '</div>' +
      '<div class="ch-hint">💡 ' + ch.hint + '</div>' +
      '<div class="menu-btns"><button class="btn primary big" id="chGo">开始重建 →</button></div>' +
      '</div>');
    document.body.appendChild(wrap);
    wrap.querySelector('#chGo').addEventListener('click', function () {
      wrap.remove();
      G.paused = false;
    });
  }

  function showChapterComplete(ch, rating) {
    G.paused = true;
    G.stars[ch.no] = rating.stars;
    persistAchievements();
    var starsHtml = '★★★'.slice(0, rating.stars) + '☆☆☆'.slice(rating.stars);
    var knowledge = ch.unlockKnowledge.map(function (kid) {
      var k = KNOW.byId(kid);
      return k ? '<div class="know-card"><div class="know-title">' + k.icon + ' ' + k.title + '</div><div class="know-text">' + k.text + '</div><div class="know-see">🔍 ' + k.howToSee + '</div></div>' : '';
    }).join('');
    var isLast = ch.no >= CHAPTERS.total;
    var wrap = el('div', 'modal-overlay', '<div class="menu-card chapter-card complete">' +
      '<h2>✅ 章节完成 · ' + ch.name + '</h2>' +
      '<div class="stars">' + starsHtml + '</div>' +
      '<div class="ch-intro">' + (isLast ? '苔原星终于迎来了真正意义上的春天。你的方舟，通过了最终考验。' : '生态系统在「' + ch.name + '」中站稳了脚跟。新的物种与知识已经解锁。') + '</div>' +
      '<div class="know-list">' + knowledge + '</div>' +
      '<div class="menu-btns">' +
      (isLast
        ? '<button class="btn primary big" data-next="final">🏆 查看最终评级</button>'
        : '<button class="btn primary big" data-next="next">第 ' + (ch.no + 1) + ' 章 · ' + CHAPTERS.byNo(ch.no + 1).name + ' →</button>') +
      '<button class="btn" data-next="sandbox">进入沙盒继续玩</button>' +
      '</div>' +
      '</div>');
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-next]').forEach(function (b) {
      b.addEventListener('click', function () {
        wrap.remove();
        var nx = b.getAttribute('data-next');
        if (nx === 'next') { G.chapter++; beginChapter(); }
        else if (nx === 'final') showFinal();
        else if (nx === 'sandbox') startSandbox();
      });
    });
    if (isLast) unlock('ark_architect');
  }

  function showFinal() {
    var total = Object.values(G.stars).reduce(function (a, b) { return a + b; }, 0);
    var grade = total >= 16 ? 'S' : total >= 13 ? 'A' : total >= 9 ? 'B' : 'C';
    var gradeText = { S: '传奇方舟管理员', A: '资深方舟管理员', B: '合格方舟管理员', C: '见习方舟管理员' }[grade];
    var achCount = Object.keys(G.achievements).length;
    var wrap = el('div', 'modal-overlay', '<div class="menu-card chapter-card complete">' +
      '<h1 style="font-size:34px">🌍 千年方舟 · 终章</h1>' +
      '<div class="stars big">⭐ ' + total + ' / 18</div>' +
      '<div class="grade">评级：<b>' + grade + '</b> · ' + gradeText + '</div>' +
      '<div class="ch-intro">六章重建全部完成。苔原星从一片龟裂的荒原，重新拥有了草原、森林、湖泊与奔跑的生命。'
      + '生态学告诉我们：能量永远从阳光流向生命，而生命——总会找到自己的路。</div>' +
      '<div class="ch-intro">🏆 已解锁成就 ' + achCount + ' / 12。图鉴中还有 ' + KNOW.CONCEPTS.length + ' 条生态学知识等待你探索。</div>' +
      '<div class="menu-btns">' +
      '<button class="btn primary big" data-n="again">再来一轮剧情</button>' +
      '<button class="btn big" data-n="sandbox">沙盒自由演化</button>' +
      '<button class="btn big" data-n="book">📖 图鉴</button>' +
      '</div></div>');
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-n]').forEach(function (b) {
      b.addEventListener('click', function () {
        wrap.remove();
        var n = b.getAttribute('data-n');
        if (n === 'again') startCampaign();
        else if (n === 'sandbox') startSandbox();
        else if (n === 'book') showBook();
      });
    });
  }

  // ---------- 模拟初始化 ----------
  function newSim(sandbox) {
    G.actions = [];
    G.scripted = sandbox ? [] : G.scripted || [];
    var opts = {
      seed: G.seed + (G.mode === 'campaign' ? ':ch' + G.chapter : ''),
      w: 84, h: 54,
      eventChance: G.eventChance
    };
    G.sim = SIM.createSim(opts);
    G.chState = sandbox ? null : CHAPTERS.createState(G.chapter);
    G.chResult = null;
    G.monthAcc = 0;
    G.paused = true;
    els.btnPause.textContent = '▶';
    els.chapterPill.textContent = sandbox ? '🔬 沙盒模式' : CHAPTERS.byNo(G.chapter).title;
    updateClock();
    renderSpeciesList();
    renderObjectives();
    renderMetrics();
    renderLog();
    // 教程章节预置少量物种（第 1 章从零开始，让玩家亲手种）
    if (!sandbox && G.chapter === 1) {
      // 给予三块样板田，引导玩家
    }
  }

  // ---------- 主循环 ----------
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!G.sim) return;
    var dt = G.lastFrame ? (ts - G.lastFrame) : 16;
    G.lastFrame = ts;
    if (!G.paused) {
      var monthsPerSec = G.speed * 12;
      var months = Math.min(40, monthsPerSec * dt / 1000);
      for (var i = 0; i < months; i++) stepOnce();
    }
    renderFrame();
  }

  function stepOnce() {
    var sim = G.sim;
    // 脚本事件
    for (var i = G.scripted.length - 1; i >= 0; i--) {
      if (G.scripted[i].m <= sim.month) {
        sim.triggerEvent(G.scripted[i].ev);
        G.actions.push({ m: sim.month, a: 'event', ev: G.scripted[i].ev });
        G.scripted.splice(i, 1);
        renderLog();
      }
    }
    sim.step();
    if (sim.month % SIM.MONTHS_PER_YEAR === 0) {
      G.yearAcc = sim.year;
      // 章节目标推进
      if (G.mode === 'campaign' && G.chState) {
        G.chResult = CHAPTERS.update(G.chapter, sim, G.chState);
        renderObjectives();
        if (G.chResult.allDone) {
          G.paused = true;
          var rating = CHAPTERS.rate(G.chapter, sim, G.chState, G.chResult);
          renderMetrics();
          setTimeout(function () { showChapterComplete(CHAPTERS.byNo(G.chapter), rating); }, 400);
        }
      }
      // 沙盒年份成就
      if (G.mode === 'sandbox' && sim.year >= 100) unlock('centurion');
      var st = sim.getStats();
      if (st.aliveSpecies >= 8) unlock('biodiversity_8');
      if (st.stability >= 0.9) unlock('stable_90');
      // 冰期 / 藤蔓 / 级联成就
      if (st.activeEvents.some(function (e) { return e.name === '冰期'; })) unlock('ice_survivor');
      G.vinePeak = Math.max(G.vinePeak || 0, CHAPTERS.vineCoverage(sim));
      if (G.vinePeak > 0.15 && CHAPTERS.vineCoverage(sim) < 0.1) unlock('vine_defender');
      if (G.mode === 'campaign' && G.chapter === 3 && G.chState && G.chState.cascadeObserved) unlock('cascade');
    }
    renderMetrics();
    renderLog();
    updateClock();
  }

  function updateClock() {
    if (!G.sim) return;
    var st = G.sim.getStats();
    els.clock.textContent = '第 ' + st.year + ' 年 · ' + st.season + ' · ' + fmt(st.temp, 0) + '℃';
  }

  function renderFrame() {
    if (!G.sim) return;
    var st = G.sim.getStats();
    var hoverTile = null;
    if (G.brushPos) {
      var picked = View.pick(G.sim, G.brushPos.clientX, G.brushPos.clientY);
      if (picked) hoverTile = picked;
    }
    View.render(G.sim, {
      hoverTile: hoverTile,
      brush: G.tool === 'inspect' ? null : {
        pos: hoverTile,
        radius: 1.6,
        color: G.tool === 'remove' ? '#ff5a5a' : (G.tool === 'fertilize' ? '#e8c76a' : (SPEC.byId(G.selected) ? SPEC.byId(G.selected).color : '#fff'))
      }
    });
    Charts.render(G.sim);
    Audio.setEnv(st);
    if (hoverTile) updateHoverTip(hoverTile);
    else if (hoverTip) hoverTip.style.display = 'none';
  }

  function updateHoverTip(tile) {
    var info = View.tileInfo(G.sim, tile.x, tile.y);
    var rect = $('canvas').getBoundingClientRect();
    var lines = ['<b>' + info.terrain + '</b>',
      '💧 ' + fmt(info.moisture, 2) + ' · 养分 ' + fmt(info.nutrients, 2),
      info.carcass > 0.02 ? '🪦 尸体 ' + fmt(info.carcass, 2) : null,
      info.plants.length ? '🌿 ' + info.plants.join('，') : null,
      info.animals.length ? info.animals.join(' ') : null].filter(Boolean);
    hoverTip.innerHTML = lines.join('<br>');
    hoverTip.style.display = 'block';
    hoverTip.style.left = Math.min(tile.x, 1) * 0 + 'px';
    // 跟随鼠标
    var mx = G.brushPos ? G.brushPos.clientX - rect.left + 14 : 10;
    var my = G.brushPos ? G.brushPos.clientY - rect.top + 14 : 10;
    hoverTip.style.left = mx + 'px';
    hoverTip.style.top = my + 'px';
  }

  // ---------- 交互：画布 ----------
  function bindCanvas() {
    var canvas = $('canvas');
    var painting = false;
    canvas.addEventListener('mousedown', function (e) {
      Audio.resume();
      painting = true;
      paint(e);
    });
    window.addEventListener('mousemove', function (e) {
      G.brushPos = { clientX: e.clientX, clientY: e.clientY };
      if (painting) paint(e);
    });
    window.addEventListener('mouseup', function () { painting = false; });
    canvas.addEventListener('mouseleave', function () { G.brushPos = null; });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // 触屏
    canvas.addEventListener('touchstart', function (e) {
      Audio.resume();
      e.preventDefault();
      var t = e.touches[0];
      G.brushPos = { clientX: t.clientX, clientY: t.clientY };
      paint(t);
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      var t = e.touches[0];
      G.brushPos = { clientX: t.clientX, clientY: t.clientY };
      paint(t);
    }, { passive: false });
  }

  function paint(e) {
    if (!G.sim || G.mode === 'menu') return;
    var picked = View.pick(G.sim, e.clientX, e.clientY);
    if (!picked) return;
    var sim = G.sim;
    if (G.tool === 'inspect') return;
    if (G.tool === 'remove') {
      sim.removeAt(picked.x, picked.y, 1.6);
      G.actions.push({ m: sim.month, a: 'remove', x: picked.x, y: picked.y });
      return;
    }
    if (G.tool === 'fertilize') {
      sim.fertilizeAt(picked.x, picked.y, 2);
      G.actions.push({ m: sim.month, a: 'fertilize', x: picked.x, y: picked.y });
      return;
    }
    var sp = SPEC.byId(G.selected);
    if (!sp) return;
    var ok = sim.paintAt(G.selected, picked.x, picked.y, 0.4);
    if (ok) {
      G.actions.push({ m: sim.month, a: 'paint', id: G.selected, x: picked.x, y: picked.y });
      if (sp.type === 'plant') {
        G.chState && (G.chState.placedSet[sp.id] = true);
        unlock('first_plant');
        var st = sim.getStats();
        if (plantCoverage(sim) >= 0.5) unlock('green_50');
      } else {
        var hc = CHAPTERS.herbCount(sim);
        if (hc >= 100) unlock('herd');
        var pc = CHAPTERS.predCount(sim);
        if (pc >= 30) unlock('apex_boom');
        var three = plantCoverage(sim) > 0.01 && hc > 0 && pc > 0;
        if (three) unlock('web3');
        if (pc >= 30) unlock('apex_boom');
      }
    } else {
      flashTip('该物种不适合在这里生长（地形/水分不适）');
    }
  }

  function plantCoverage(sim) {
    return CHAPTERS.plantCoverage(sim);
  }

  function flashTip(msg) {
    var t = el('div', 'flash-tip', msg);
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1800);
  }

  // ---------- 物种面板 ----------
  function renderSpeciesList() {
    if (!speciesPanel) return;
    speciesPanel.innerHTML = '';
    // 分解者为系统物种（腐殖质循环内建），不参与直接放置
    var unlocked = (G.mode === 'sandbox' ? SPEC.ALL : SPEC.unlocked(G.chapter))
      .filter(function (s) { return s.type !== 'decomposer'; });
    var plants = unlocked.filter(function (s) { return s.type === 'plant'; });
    var animals = unlocked.filter(function (s) { return s.type !== 'plant'; });
    speciesPanel.appendChild(el('div', 'panel-title', '🌿 植物（' + plants.length + '）'));
    plants.forEach(function (sp) { speciesPanel.appendChild(speciesCard(sp)); });
    speciesPanel.appendChild(el('div', 'panel-title', '🐾 动物（' + animals.length + '）'));
    animals.forEach(function (sp) { speciesPanel.appendChild(speciesCard(sp)); });
    selectSpecies(G.selected);
  }

  function speciesCard(sp) {
    var d = document.createElement('div');
    d.className = 'species-card' + (sp.invasive ? ' invasive' : '');
    d.setAttribute('data-id', sp.id);
    var statLine = sp.type === 'plant'
      ? '生长 ' + fmt(sp.growth * 100, 0) + '%/月 · 能量 ' + sp.food
      : '体型 ' + fmt(sp.M, 1) + ' · 寿命 ' + sp.lifespan + ' 月';
    d.innerHTML = '<span class="sp-emoji">' + sp.emoji + '</span>' +
      '<span class="sp-name">' + sp.name + '</span>' +
      '<span class="sp-stat">' + statLine + '</span>';
    d.addEventListener('click', function () { selectSpecies(sp.id); });
    return d;
  }

  function selectSpecies(id) {
    G.selected = id;
    G.tool = SPEC.byId(id).type === 'plant' ? 'plant' : 'animal';
    speciesPanel.querySelectorAll('.species-card').forEach(function (c) {
      c.classList.toggle('selected', c.getAttribute('data-id') === id);
    });
    var sp = SPEC.byId(id);
    var detail = $('speciesDetail');
    if (detail && sp) {
      var terrainText = sp.type === 'plant'
        ? sp.terrain.map(function (v, t) { return v > 0.05 ? SPEC.TERRAIN_NAMES[t] : null; }).filter(Boolean).join('、')
        : sp.terrain.map(function (t) { return SPEC.TERRAIN_NAMES[t]; }).join('、');
      var diet = sp.type === 'herbivore' ? '食：' + sp.diet.map(function (x) { return SPEC.byId(x).name; }).join('、')
        : sp.type === 'predator' ? '猎：' + sp.prey.map(function (x) { return SPEC.byId(x).name; }).join('、')
        : '生产者';
      detail.innerHTML = '<div class="detail-name">' + sp.emoji + ' ' + sp.name + '</div>' +
        '<div class="detail-desc">' + sp.desc + '</div>' +
        '<div class="detail-stats">' +
        '<span>栖息地：' + terrainText + '</span>' +
        '<span>温度 ' + sp.tempMin + '~' + sp.tempMax + '℃ · 湿度 ' + sp.moistMin + '~' + sp.moistMax + '</span>' +
        '<span>' + diet + '</span>' +
        '</div>';
    }
  }

  // ---------- 工具栏 ----------
  function bindToolbar() {
    toolBar.querySelectorAll('[data-tool]').forEach(function (b) {
      b.addEventListener('click', function () {
        toolBar.querySelectorAll('[data-tool]').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        G.tool = b.getAttribute('data-tool');
        if (G.tool === 'remove') flashTip('拖动画笔清除植物与动物');
        if (G.tool === 'fertilize') flashTip('施肥提升土壤养分');
      });
    });
  }

  // ---------- 目标面板 ----------
  function renderObjectives() {
    if (!objPanel) return;
    if (G.mode !== 'campaign' || !G.chResult) {
      objPanel.innerHTML = G.mode === 'sandbox'
        ? '<div class="obj-none">🔬 沙盒模式：自由放置物种，观察演化。目标：让 8 种以上物种共存并保持稳定。</div>'
        : '<div class="obj-none">章节目标即将加载…</div>';
      return;
    }
    var ch = G.chResult.chapter;
    var html = '<div class="obj-head">📋 ' + ch.title + ' · 目标</div>';
    html += Object.keys(G.chResult.objectives).map(function (k) {
      var o = G.chResult.objectives[k];
      return '<div class="obj-item' + (o.done ? ' done' : '') + '">' +
        '<span class="obj-ck">' + (o.done ? '✅' : '⏳') + '</span>' +
        '<span class="obj-desc">' + o.desc + '</span>' +
        '<div class="obj-bar"><div class="obj-fill" style="width:' + Math.round(o.prog * 100) + '%"></div></div>' +
        '</div>';
    }).join('');
    html += '<div class="obj-foot">' + (G.chResult.allDone ? '🎉 全部完成！请前往结算。' : '继续演化，直到目标全部点亮…') + '</div>';
    objPanel.innerHTML = html;
  }

  // ---------- 指标面板 ----------
  function renderMetrics() {
    if (!metricPanel || !G.sim) return;
    var st = G.sim.getStats();
    var plantsPct = Math.round(plantCoverage(G.sim) * 100);
    var alive = st.aliveSpecies;
    metricPanel.innerHTML =
      '<div class="metric"><span class="m-label">总生物量</span><span class="m-val">' + fmt(st.totalBiomass, 0) + '</span></div>' +
      '<div class="metric"><span class="m-label">植物覆盖</span><span class="m-val">' + plantsPct + '%</span></div>' +
      '<div class="metric"><span class="m-label">动物个体</span><span class="m-val">' + st.animalsTotal + '</span></div>' +
      '<div class="metric"><span class="m-label">物种多样性</span><span class="m-val">' + alive + ' 种</span></div>' +
      '<div class="metric"><span class="m-label">稳定性</span><span class="m-val">' + fmt(st.stability, 2) + '</span>' +
      '<div class="mini-bar"><div style="width:' + Math.round(st.stability * 100) + '%"></div></div></div>' +
      '<div class="metric"><span class="m-label">气温 / 降水</span><span class="m-val">' + fmt(st.temp, 0) + '℃ / ' + fmt(st.rain, 2) + '</span></div>' +
      '<div class="metric"><span class="m-label">土壤养分</span><span class="m-val">' + fmt(st.nutrientsAvg, 2) + '</span></div>' +
      (st.activeEvents.length ? '<div class="event-alert">' + st.activeEvents.map(function (e) { return '⚠️ ' + e.name; }).join('<br>') + '</div>' : '');
  }

  // ---------- 日志 ----------
  function renderLog() {
    if (!logPanel || !G.sim) return;
    var logs = G.sim.log.slice(-6).reverse();
    logPanel.innerHTML = logs.map(function (l) {
      return '<div class="log-line ' + l.kind + '">' + l.text + '</div>';
    }).join('') || '<div class="log-line">等待事件…</div>';
  }

  // ---------- 成就 ----------
  var ACHIEVEMENTS = {
    first_plant: { icon: '🌱', name: '初次播种', desc: '亲手种下第一株植物' },
    green_50: { icon: '🌍', name: '绿意盎然', desc: '植物覆盖率一度达到 50%' },
    herd: { icon: '🐇', name: '牧群建立', desc: '食草动物总数超过 100' },
    web3: { icon: '🕸️', name: '三层食物网', desc: '植物 + 食草 + 捕食同时存在' },
    apex_boom: { icon: '🐺', name: '顶级繁衍', desc: '捕食者总数超过 30' },
    ice_survivor: { icon: '❄️', name: '冰期幸存者', desc: '在冰期事件中存活下来' },
    vine_defender: { icon: '🪢', name: '藤蔓克星', desc: '把入侵藤蔓压制到 10% 以下' },
    biodiversity_8: { icon: '🌈', name: '生物多样性', desc: '8 种物种同时存活' },
    stable_90: { icon: '🛡️', name: '稳固方舟', desc: '生态系统稳定性达到 0.9' },
    centurion: { icon: '⏳', name: '百年守望', desc: '生态运行满 100 年' },
    cascade: { icon: '🦅', name: '营养级联', desc: '见证捕食者压低谷食草动物（第 3 章）' },
    ark_architect: { icon: '🏆', name: '方舟建筑师', desc: '完成全部 6 章剧情' }
  };

  function unlock(id) {
    if (G.achievements[id]) return;
    G.achievements[id] = true;
    persistAchievements();
    var a = ACHIEVEMENTS[id];
    var t = el('div', 'ach-toast', a.icon + ' 成就解锁：' + a.name);
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  // ---------- 图鉴 ----------
  function showBook() {
    var wrap = el('div', 'modal-overlay', '<div class="menu-card book-card">' +
      '<div class="book-tabs"><button class="tab active" data-t="species">物种图鉴</button><button class="tab" data-t="concept">生态学知识</button></div>' +
      '<div id="bookBody" class="book-body"></div>' +
      '<div class="menu-btns"><button class="btn" data-close="1">关闭</button></div></div>');
    document.body.appendChild(wrap);
    var body = wrap.querySelector('#bookBody');
    function renderSpecies() {
      body.innerHTML = '<div class="book-grid">' + SPEC.ALL.map(function (sp) {
        return '<div class="book-species' + (sp.invasive ? ' invasive' : '') + '">' +
          '<div class="bs-head">' + sp.emoji + ' ' + sp.name + (sp.invasive ? ' ⚠️' : '') + '</div>' +
          '<div class="bs-desc">' + sp.desc + '</div>' +
          '<div class="bs-meta">' + (sp.type === 'plant' ? '生产者 · 能量 ' + sp.food + (sp.growth ? ' · 生长 ' + fmt(sp.growth * 100, 0) + '%' : '') : (sp.type === 'herbivore' ? '食草动物 · 体型 ' + sp.M : '捕食者 · 体型 ' + sp.M)) +
          (sp.unlock > 0 && sp.unlock <= 6 ? ' · 第 ' + sp.unlock + ' 章解锁' : '') + '</div></div>';
      }).join('') + '</div>';
    }
    function renderConcept() {
      body.innerHTML = '<div class="book-grid concepts">' + KNOW.CONCEPTS.map(function (k) {
        return '<div class="book-concept">' +
          '<div class="bs-head">' + k.icon + ' ' + k.title + ' <span class="unlock-tag">第 ' + k.unlock + ' 章</span></div>' +
          '<div class="bs-desc">' + k.text + '</div>' +
          '<div class="bs-see">🔍 ' + k.howToSee + '</div></div>';
      }).join('') + '</div>';
    }
    renderSpecies();
    wrap.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () {
        wrap.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        if (b.getAttribute('data-t') === 'species') renderSpecies(); else renderConcept();
      });
    });
    wrap.querySelector('[data-close]').addEventListener('click', function () { wrap.remove(); });
  }

  // ---------- 存档面板 ----------
  function showSavePanel() {
    var wrap = el('div', 'modal-overlay', '<div class="menu-card small">' +
      '<h2>💾 存档与种子</h2>' +
      '<div class="ch-intro">种子：<code>' + G.seed + '</code></div>' +
      '<div class="ch-intro">当前：' + (G.mode === 'campaign' ? '第 ' + G.chapter + ' 章' : '沙盒') + ' · 已记录 ' + G.actions.length + ' 个操作（可完整重放）</div>' +
      '<div class="menu-btns">' +
      '<button class="btn primary" data-a="save">保存</button>' +
      '<button class="btn" data-a="close">关闭</button>' +
      '</div></div>');
    document.body.appendChild(wrap);
    wrap.querySelector('[data-a="save"]').addEventListener('click', function () {
      var ok = saveGame();
      wrap.querySelector('.ch-intro').textContent = ok ? '✅ 已保存到浏览器' : '⚠️ 保存失败（存储已满或不可用）';
    });
    wrap.querySelector('[data-a="close"]').addEventListener('click', function () { wrap.remove(); });
  }

  // ---------- 读档 ----------
  function loadGame() {
    if (!G.saveData) { showMenu(); return; }
    var d = G.saveData;
    G.mode = d.mode; G.chapter = d.chapter; G.seed = d.seed;
    G.eventChance = d.eventChance || 0.014;
    G.stars = d.stars || {};
    G.actions = d.actions || [];
    newSimFromSave(d);
  }

  function newSimFromSave(d) {
    var opts = { seed: G.seed + (G.mode === 'campaign' ? ':ch' + G.chapter : ''), w: 84, h: 54, eventChance: G.eventChance };
    G.sim = SIM.createSim(opts);
    // 重放操作
    var acts = G.actions.slice().sort(function (a, b) { return a.m - b.m; });
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      while (G.sim.month < a.m && G.sim.month < (d.month || 999999)) G.sim.step();
      if (a.a === 'paint') G.sim.paintAt(a.id, a.x, a.y, 0.4);
      else if (a.a === 'remove') G.sim.removeAt(a.x, a.y, 1.6);
      else if (a.a === 'fertilize') G.sim.fertilizeAt(a.x, a.y, 2);
      else if (a.a === 'event') G.sim.triggerEvent(a.ev);
    }
    while (G.sim.month < (d.month || 0)) G.sim.step();
    G.chState = G.mode === 'campaign' ? deserializeChState(d.chState) : null;
    G.scripted = d.scripted || [];
    G.vinePeak = d.vinePeak || 0;
    G.paused = false;
    els.btnPause.textContent = '⏸';
    els.chapterPill.textContent = G.mode === 'campaign' ? CHAPTERS.byNo(G.chapter).title : '🔬 沙盒模式';
    if (G.mode === 'campaign' && G.chState) {
      G.chResult = CHAPTERS.update(G.chapter, G.sim, G.chState);
    }
    renderSpeciesList();
    renderObjectives();
    renderMetrics();
    renderLog();
    updateClock();
  }

  // ---------- 顶部按钮 ----------
  function bindUI() {
    bindCanvas();
    bindToolbar();
    els.btnPause.addEventListener('click', function () {
      G.paused = !G.paused;
      els.btnPause.textContent = G.paused ? '▶' : '⏸';
    });
    [['btnSpeed1', 1], ['btnSpeed2', 2], ['btnSpeed4', 4], ['btnSpeed8', 8], ['btnSpeed16', 16]].forEach(function (pair) {
      var b = $(pair[0]);
      b.addEventListener('click', function () {
        G.speed = pair[1];
        document.querySelectorAll('.speed-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
      });
    });
    els.btnBook.addEventListener('click', showBook);
    els.btnSave.addEventListener('click', showSavePanel);
    els.btnSound.addEventListener('click', function () {
      var m = !Audio.isMuted();
      Audio.setMuted(m);
      els.btnSound.textContent = m ? '🔇' : '🔊';
    });
    els.btnMenu.addEventListener('click', function () {
      if (confirm('返回主菜单？当前进度可在菜单中「继续上次的方舟」。')) {
        G.paused = true;
        showMenu();
      }
    });
    // 空格暂停
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' && G.sim) {
        e.preventDefault();
        G.paused = !G.paused;
        els.btnPause.textContent = G.paused ? '▶' : '⏸';
      }
    });
    Audio.setMuted(false);
    els.btnSound.textContent = '🔊';
  }

  // ---------- 启动 ----------
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
