/* LASTBROADCAST · 最后的广播 —— 前端主逻辑 */
(function () {
  'use strict';
  var data = window.LB.data, engine = window.LB.engine, synth = window.LB.synth, storage = window.LB.storage;

  var REDUCED = false;
  try { REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var game = null;
  var history = [];   // [{hope, mood}] 每回合后快照
  var menu = 'main';  // main | songs | news | military | x
  var ui = {};

  var ACH = [
    { id: 'night1', name: '第一夜', desc: '完成一次完整的广播' },
    { id: 'nosilence', name: '从不沉默', desc: '一整夜没有沉默过' },
    { id: 'allhope', name: '全员振作', desc: '结束时有 10 位以上听众心情 ≥ 60' },
    { id: 'truth', name: '真相行者', desc: '说出过 3 次真相' },
    { id: 'request', name: '点歌大师', desc: '满足 3 次听众点播' },
    { id: 'endings', name: '结局收藏家', desc: '解锁全部 6 个结局' }
  ];

  function $(id) { return document.getElementById(id); }

  // ---------- 渲染 ----------
  function renderHeader() {
    var t = data.TURNS[game.turn];
    $('turnLabel').textContent = t.label;
    var hoursLeft = 24 - game.turn * 2;
    $('remaining').textContent = hoursLeft > 0 ? '还剩 ' + hoursLeft + ' 小时' : '终局时刻';
    $('onair').className = 'onair ' + (menuHasMusic() ? 'on' : 'off');
    $('onair').textContent = menuHasMusic() ? '● ON AIR' : '○ OFF AIR';
    renderStamina();
  }

  function menuHasMusic() {
    return game && game.turn < 11 && lastWasSong;
  }
  var lastWasSong = false;
  var lastAct = '— 静默 —';
  var vuStarted = false;

  function songById(id) {
    for (var i = 0; i < data.SONGS.length; i++) if (data.SONGS[i].id === id) return data.SONGS[i];
    return null;
  }

  var AVATAR = {
    susan: '☕', twins: '🧸', xiaoyu: '🎀', daye: '🪑', apopo: '🧣',
    doctor: '🩺', lily: '🎧', xiaoyang: '🏪', lin: '🚒', akai: '🚕',
    professor: '🔭', luolaoshi: '🎹', laozhou: '🌙', veteran: '🎖️', ayun: '🤰'
  };
  function ava(id) { return AVATAR[id] || '🎙️'; }

  function moodClass(hope) { return hope < 35 ? 'low' : hope < 60 ? 'mid' : ''; }

  function renderBeat() {
    var el = $('beat');
    var t = data.TURNS[game.turn];
    var obs = data.CITY_OBSERVATIONS[Math.min(game.turn, data.CITY_OBSERVATIONS.length - 1)];
    el.innerHTML = t.beat + '<div style="color:var(--dim);margin-top:6px;font-size:12px">👁 ' + obs + '</div>';
  }

  function renderStamina() {
    var el = $('stamVal');
    if (!el) return;
    el.textContent = game.djStamina;
    el.parentElement.className = 'stam' + (game.djStamina < 25 ? ' low' : '');
  }

  function renderActions() {
    var el = $('actions');
    if (game.done) { el.innerHTML = ''; return; }
    var html = '';
    var acts = engine.availableActions(game);

    if (game.turn === 11) {
      // 终局
      html += '<div class="btn primary" style="border-left-color:#ffd166">💬 这是你最后的发言——选择如何结束这一夜：</div>';
      acts.forEach(function (a) {
        html += '<button class="btn final" data-act="final:' + a.choice + '"><span class="ic">📻</span>' + a.label + '<span class="sub">' + a.hint + '</span></button>';
      });
      el.innerHTML = html;
      bindAct(el);
      return;
    }

    if (menu === 'songs') {
      html += '<button class="btn back" data-act="back">← 返回</button>';
      var memorialUnlocked = achDone().indexOf('endings') >= 0;
      data.SONGS.forEach(function (s) {
        if (s.hidden && !memorialUnlocked) return;
        var locked = s.unlockTurn != null && game.turn < s.unlockTurn;
        var fav = favs().indexOf(s.id) >= 0;
        var eff = (s.hope >= 0 ? '+' : '') + s.hope + '希望 ' + (s.mood >= 0 ? '+' : '') + s.mood + '氛围 · 精力-3';
        var tag = s.tags.join('·') + (s.unlockTurn != null ? ' · 第' + (s.unlockTurn + 1) + '回合开放' : '');
        html += '<div class="song-row">' +
          '<button class="btn song' + (locked ? ' locked' : '') + '" data-act="song:' + s.id + '"' + (locked ? ' disabled' : '') + '>' +
          '<span class="ic">🎵</span>' + s.title.replace(/《|》/g, '') +
          '<span class="sub">' + tag + '</span><span class="eff">' + eff + '</span></button>' +
          '<button class="btn fav-btn' + (fav ? ' on' : '') + '" data-act="fav" data-id="' + s.id + '" title="' + (fav ? '取消收藏' : '收藏（播放时 +1 希望）') + '">' + (fav ? '♥' : '♡') + '</button>' +
          '</div>';
      });
    } else if (menu === 'news') {
      html += '<button class="btn back" data-act="back">← 返回</button>';
      ['soothe', 'neutral', 'truth'].forEach(function (tone) {
        var n = data.NEWS[tone];
        html += '<button class="btn primary" data-act="news:' + tone + '"><span class="ic">📢</span>' + n.label + '<span class="sub">' +
          (n.hope > 0 ? '+' : '') + n.hope + ' 希望 / ' + (n.mood > 0 ? '+' : '') + n.mood + ' 氛围 · 精力-5</span></button>';
      });
    } else if (menu === 'military') {
      html += '<button class="btn back" data-act="back">← 返回</button>';
      data.SIGNAL_MILITARY.options.forEach(function (o) {
        html += '<button class="btn signal" data-act="signal:military:' + o.id + '"><span class="ic">🚨</span>' + o.label + '<span class="sub">' + (o.mood > 0 ? '+' : '') + o.mood + '氛围 / ' + (o.hope > 0 ? '+' : '') + o.hope + '希望 · 精力-6</span></button>';
      });
    } else if (menu === 'x') {
      html += '<button class="btn back" data-act="back">← 返回</button>';
      data.SIGNAL_X.options.forEach(function (o) {
        html += '<button class="btn signal" data-act="signal:x:' + o.id + '"><span class="ic">📡</span>' + o.label + '<span class="sub">' + (o.hope > 0 ? '+' : '') + o.hope + '希望 · 精力-6</span></button>';
      });
    } else {
      acts.forEach(function (a) {
        if (a.type === 'song') {
          html += '<button class="btn primary" data-act="menu:songs"><span class="ic">🎵</span>播放歌曲<span class="sub">' + data.SONGS.length + ' 首</span></button>';
        } else if (a.type === 'news') {
          html += '<button class="btn primary" data-act="menu:news"><span class="ic">📢</span>新闻播报<span class="sub">3 种口径</span></button>';
        } else if (a.type === 'call') {
          var c = data.charById(a.caller);
          var req = '';
          data.CALLS.forEach(function (cl) { if (cl.turn === game.turn && cl.caller === a.caller && cl.request) req = '点播《' + songById(cl.request).title.replace(/《|》/g, '') + '》'; });
          html += '<button class="btn call ring" data-act="call:' + a.caller + '"><span class="ic">📞</span><span class="ava">' + ava(a.caller) + '</span>接听来电 · ' + c.name + '<span class="sub">' + (req || c.role) + '</span></button>';
        } else if (a.type === 'signal') {
          html += '<button class="btn signal" data-act="menu:' + a.which + '"><span class="ic">📡</span>' + a.label + '<span class="sub">做出选择</span></button>';
        } else if (a.type === 'silence') {
          html += '<button class="btn" data-act="silence"><span class="ic">🤐</span>沉默<span class="sub">精力+10 · 希望-2</span></button>';
        }
      });
    }
    el.innerHTML = html;
    bindAct(el);
  }

  function favs() {
    try { return JSON.parse(storage.get('lb-favs') || '[]'); } catch (e) { return []; }
  }
  function saveFavs(list) { storage.set('lb-favs', JSON.stringify(list)); }

  function bindAct(el) {
    el.querySelectorAll('button[data-act]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        var act = b.getAttribute('data-act');
        if (act === 'back') { menu = 'main'; renderActions(); return; }
        if (act === 'fav') {
          var id = b.getAttribute('data-id');
          var list = favs();
          var i = list.indexOf(id);
          if (i >= 0) list.splice(i, 1); else list.push(id);
          saveFavs(list);
          if (game.flags.favs) { var j = game.flags.favs.indexOf(id); if (j >= 0) game.flags.favs.splice(j, 1); else game.flags.favs.push(id); }
          renderActions();
          return;
        }
        if (act.indexOf('menu:') === 0) { menu = act.slice(5); renderActions(); return; }
        if (act.indexOf('song:') === 0) return doAction({ type: 'song', songId: act.slice(5) });
        if (act.indexOf('news:') === 0) return doAction({ type: 'news', tone: act.slice(5) });
        if (act.indexOf('call:') === 0) return doAction({ type: 'call', caller: act.slice(5) });
        if (act.indexOf('signal:') === 0) {
          var parts = act.split(':');
          return doAction({ type: 'signal', which: parts[1], choice: parts[2] });
        }
        if (act.indexOf('final:') === 0) return doAction({ type: 'final', choice: act.slice(6) });
        if (act === 'silence') return doAction({ type: 'silence' });
      });
    });
  }

  function renderPhone() {
    var el = $('phone');
    var calls = data.CALLS.filter(function (c) { return c.turn === game.turn; });
    if (!calls.length) { el.innerHTML = '<div class="none">总机安静着。</div>'; return; }
    el.innerHTML = '';
    calls.forEach(function (c) {
      var ch = data.charById(c.caller);
      var req = c.request ? '点播《' + songById(c.request).title.replace(/《|》/g, '') + '》' : ch.role;
      var b = document.createElement('button');
      b.className = 'btn call ring';
      b.innerHTML = '<span class="ic">📞</span><span class="ava">' + ava(c.caller) + '</span>' + ch.name + '<span class="sub">' + req + '</span>';
      b.addEventListener('click', function () { doAction({ type: 'call', caller: c.caller }); });
      el.appendChild(b);
    });
  }

  function renderChars() {
    var el = $('chars');
    el.innerHTML = '';
    data.CHARACTERS.forEach(function (c) {
      var st = game.chars[c.id];
      var honored = (c.id === 'laozhou' && game.flags.laozhouHonored) || (c.id === 'veteran' && game.flags.veteranHonored);
      var div = document.createElement('div');
      div.className = 'char' + (honored ? ' honored' : '');
      div.innerHTML = '<span class="ava">' + ava(c.id) + '</span><span class="name">' + c.name + '</span><span class="role">' + c.role + '</span>' +
        '<span class="bar"><i class="' + moodClass(st.hope) + '" style="width:' + st.hope + '%"></i></span><span style="font-size:10px;color:var(--dim)">' + st.hope + '</span>';
      el.appendChild(div);
    });
  }

  function renderLog() {
    var el = $('log');
    el.innerHTML = '';
    game.log.forEach(function (l) {
      var div = document.createElement('div');
      div.className = 'entry ' + l.type;
      div.innerHTML = '<span class="tt">' + data.TURNS[l.turn].label.split(' · ')[0] + '</span>' + l.text.replace(/\n/g, '<br>');
      el.appendChild(div);
    });
    el.scrollTop = el.scrollHeight;
  }

  // ---------- 城市窗口 ----------
  var BUILDINGS = [];
  (function () {
    var x = 8, i = 0;
    var rnd = (function () { var s = 42; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();
    while (x < 540) {
      var w = 26 + Math.floor(rnd() * 34);
      var h = 50 + Math.floor(rnd() * 150);
      BUILDINGS.push({ x: x, w: w, h: h, seed: Math.floor(rnd() * 1e6) });
      x += w + 6 + Math.floor(rnd() * 10);
    }
  })();

  function drawSkyline() {
    var cv = $('skyline');
    var dpr = window.devicePixelRatio || 1;
    var W = cv.clientWidth || 560, H = cv.clientHeight || 240;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var phase = engine.cityPhase(game.hope);
    var turn = game.turn;
    var t = Date.now() / 1000;

    var sky = {
      bright: ['#16284f', '#0d1730'],
      dim: ['#101c38', '#0a1022'],
      dark: ['#0a0e1e', '#05070d'],
      ruin: ['#170b0b', '#05070d']
    }[phase] || sky.dark;

    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 星星（确定性伪随机）
    var sr = (function () { var s = 7; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (var i = 0; i < 60; i++) {
      var sx = sr() * W, sy = sr() * H * 0.55;
      ctx.globalAlpha = 0.2 + sr() * 0.6;
      ctx.fillRect(sx, sy, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;

    // 极光（随回合增强，随时间起伏）
    var aA = 0.05 + turn * 0.025;
    for (var band = 0; band < 3; band++) {
      var bx = W * 0.5 + Math.sin(t * 0.2 + band * 1.7) * 90;
      var bw2 = 120 + band * 40;
      var ag = ctx.createLinearGradient(bx - bw2, 0, bx + bw2, 0);
      var alpha = aA * (0.6 + 0.4 * Math.sin(t * 0.4 + band * 2));
      ag.addColorStop(0, 'rgba(126,224,138,0)');
      ag.addColorStop(0.5, 'rgba(126,224,138,' + Math.max(0, alpha) + ')');
      ag.addColorStop(1, 'rgba(126,224,138,0)');
      ctx.fillStyle = ag;
      ctx.beginPath();
      for (var px = 0; px <= W; px += 8) {
        var py = 30 + band * 26 + Math.sin(px * 0.012 + t * 0.5 + band) * 10;
        if (px === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath();
      ctx.fill();
    }

    // 闪电（第 7 回合后偶尔）
    if (turn >= 7 && ((t * 0.8) % 11) < 0.35) {
      ctx.strokeStyle = 'rgba(220,230,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      var lx = W * 0.3 + ((t * 13) % 1) * W * 0.4;
      ctx.moveTo(lx, 0);
      var yy = 0;
      while (yy < 140) { yy += 18 + ((t * 7 + yy) % 1) * 22; ctx.lineTo(lx + (((t * 31 + yy) % 1) - 0.5) * 46, yy); }
      ctx.stroke();
    }

    // 灰烬（第 6 回合后飘落）
    if (turn >= 6) {
      for (var i = 0; i < 26; i++) {
        var ax2 = ((i * 137.5) % W) + Math.sin(t * 0.5 + i * 1.3) * 10;
        var ay = ((i * 61 + t * (14 + (i % 5) * 5)) % (H + 40)) - 20;
        ctx.fillStyle = 'rgba(180,180,200,' + (0.12 + 0.1 * ((i % 3))) + ')';
        ctx.fillRect(ax2, ay, 1.6, 1.6);
      }
    }

    // 建筑
    var groundY = H - 30;
    var litRatio = game.hope / 100;
    BUILDINGS.forEach(function (b) {
      ctx.fillStyle = '#070b16';
      ctx.fillRect(b.x, groundY - b.h, b.w, b.h);
      // 窗户
      var cols = Math.floor(b.w / 8), rows = Math.floor(b.h / 12);
      var pr = (function () { var s = b.seed; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();
      for (var c = 0; c < cols; c++) {
        for (var r = 0; r < rows; r++) {
          var lit = pr() < litRatio;
          if (lit && pr() > 0.82) lit = Math.sin(t * 3 + b.seed + c * 7 + r) > -0.2; // 闪烁的窗
          ctx.fillStyle = lit ? 'rgba(255,179,71,' + (0.5 + 0.4 * pr()) + ')' : 'rgba(40,58,96,0.9)';
          ctx.fillRect(b.x + 3 + c * 8, groundY - b.h + 4 + r * 12, 3, 5);
        }
      }
    });
    // 地面
    ctx.fillStyle = '#04060c';
    ctx.fillRect(0, groundY, W, 30);
    // 广播天线（播报时红灯闪烁）
    var axx = 470, axy = groundY - 118;
    ctx.strokeStyle = '#1a2740';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(axx, groundY); ctx.lineTo(axx, axy); ctx.lineTo(axx + 14, axy - 22); ctx.stroke();
    if (lastWasSong && Math.sin(t * 6) > -0.3) {
      ctx.fillStyle = '#ff5f5f';
      ctx.shadowColor = '#ff5f5f'; ctx.shadowBlur = 12;
    } else {
      ctx.fillStyle = '#3a2a2a';
      ctx.shadowBlur = 0;
    }
    ctx.beginPath(); ctx.arc(axx + 14, axy - 22, 4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawChart() {
    var cv = $('chart');
    var dpr = window.devicePixelRatio || 1;
    var W = cv.clientWidth || 560, H = cv.clientHeight || 120;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
    var maxT = Math.max(history.length - 1, 1);
    function px(i) { return 20 + i / maxT * (W - 40); }
    function py(v) { return H - 14 - v / 100 * (H - 28); }
    // 网格
    ctx.strokeStyle = 'rgba(42,58,92,0.5)';
    for (var v = 0; v <= 100; v += 25) {
      ctx.beginPath(); ctx.moveTo(16, py(v)); ctx.lineTo(W - 16, py(v)); ctx.stroke();
    }
    function line(key, color) {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      history.forEach(function (p, i) { if (i === 0) ctx.moveTo(px(i), py(p[key])); else ctx.lineTo(px(i), py(p[key])); });
      ctx.stroke();
    }
    // 希望曲线下方渐变填充
    ctx.beginPath();
    history.forEach(function (p, i) { if (i === 0) ctx.moveTo(px(i), py(p.hope)); else ctx.lineTo(px(i), py(p.hope)); });
    ctx.lineTo(px(history.length - 1), H - 14); ctx.lineTo(px(0), H - 14); ctx.closePath();
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(126,224,138,0.28)');
    grad.addColorStop(1, 'rgba(126,224,138,0)');
    ctx.fillStyle = grad; ctx.fill();
    line('hope', '#7ee08a');
    line('mood', '#ffb347');
    // 当前点（脉冲）
    var cur = history[history.length - 1];
    if (cur) {
      var pulse = (Date.now() / 400) % 1;
      ctx.strokeStyle = 'rgba(126,224,138,0.4)';
      ctx.beginPath(); ctx.arc(px(history.length - 1), py(cur.hope), 4 + pulse * 8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#7ee08a'; ctx.beginPath();
      ctx.arc(px(history.length - 1), py(cur.hope), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // 刻度标签
    ctx.fillStyle = 'rgba(124,141,176,0.8)';
    ctx.font = '9px sans-serif';
    [0, 50, 100].forEach(function (v) { ctx.fillText(v, 2, py(v) + 3); });
  }

  // ---------- 动作 ----------
  function doAction(action) {
    if (game.done) return;
    var r = engine.applyAction(game, action);
    if (r.error) return;
    if (action.type === 'song') {
      var s = null;
      data.SONGS.forEach(function (x) { if (x.id === action.songId) s = x; });
      if (s) { synth.ensure(); synth.startMusic(s.tags); lastWasSong = true; lastAct = '♪ ' + s.title; }
    } else {
      synth.stopMusic(); lastWasSong = false;
      if (action.type === 'news') lastAct = '📢 ' + data.NEWS[action.tone].label;
      else if (action.type === 'call') lastAct = '📞 通话中';
      else if (action.type === 'signal') lastAct = '📡 信号处理中';
      else if (action.type === 'silence') lastAct = '🤐 沉默';
      else if (action.type === 'final') lastAct = '💬 最后发言';
    }
    history.push({ hope: game.hope, mood: game.mood });
    menu = 'main';
    render();
    autosave();
    checkAch();
    if (game.done) { storage.remove('lb-save'); showEnding(); }
  }

  // 自动存档（B6）
  function autosave() {
    try {
      storage.set('lb-save', JSON.stringify({ game: game, history: history }));
    } catch (e) {}
  }
  function loadSave() {
    try { return JSON.parse(storage.get('lb-save') || 'null'); } catch (e) { return null; }
  }
  function continueSave() {
    var s = loadSave();
    if (!s || !s.game) return false;
    game = s.game;
    history = s.history || [{ hope: game.hope, mood: game.mood }];
    menu = 'main';
    lastWasSong = false;
    lastAct = '💾 已恢复存档';
    $('ending').classList.add('hidden');
    $('intro').classList.add('hidden');
    $('btnContinue').classList.add('hidden');
    render();
    vuLoop();
    toast('已恢复上一夜的广播');
    return true;
  }

  // ---------- 结局 ----------
  function loadEndings() {
    try { return JSON.parse(localStorage.getItem('lb-endings') || '[]'); } catch (e) { return []; }
  }
  function saveEndings(list) { localStorage.setItem('lb-endings', JSON.stringify(list)); }

  function cityArchive(state) {
    var f = state.flags;
    var lines = [];
    if (f.lullaby) lines.push('整座城市学会了同一首摇篮曲。');
    if (f.signalDecoded) lines.push('有人记下了那个坐标——它后来被写进了历史。');
    if (f.truthCount >= 2) lines.push('电台是那晚唯一说了真话的地方。');
    if (f.silenceCount === 0) lines.push('整整一夜，电波没有断过。');
    if (state.djStamina < 20) lines.push('值班员的嗓子哑了，但没有人抱怨。');
    if (state.hope >= 70) lines.push('天亮时，城市的灯比想象中多。');
    if (state.hope < 30) lines.push('天亮时，城市比想象中安静。');
    if (state.pendingRequest) lines.push('有人在等一首没等到歌。');
    if (!lines.length) lines.push('这座城市记住了这个夜晚，以它自己的方式。');
    return lines;
  }

  function showEnding() {
    var res = engine.ending(game);
    if (!res) return;
    var e = res.ending;
    $('endTitle').textContent = e.title;
    $('endEpithet').textContent = e.epithet;
    $('endEpilogue').textContent = e.epilogue;
    $('endConditions').textContent = '达成条件：' + e.conditions;
    var oldFw = $('finalWords');
    if (oldFw) oldFw.remove();
    if (game.finalWords) {
      var fw = document.createElement('div');
      fw.id = 'finalWords';
      fw.className = 'end-epilogue';
      fw.style.cssText = 'color:var(--amber);border-left:3px solid var(--amber);padding-left:10px;margin-bottom:10px';
      fw.textContent = '你最后说的话：「' + game.finalWords + '」';
      $('endConditions').insertAdjacentElement('afterend', fw);
    }
    // 结局解锁统计
    var list = loadEndings();
    if (list.indexOf(e.id) < 0) { list.push(e.id); saveEndings(list); }
    var chips = Object.keys(data.ENDINGS).map(function (id) {
      var got = list.indexOf(id) >= 0;
      return '<span class="chip' + (got ? ' got' : '') + '">' + (got ? data.ENDINGS[id].title : '？？？') + '</span>';
    }).join('');
    $('endUnlock').innerHTML = '🎬 结局图鉴：已解锁 <b>' + list.length + ' / ' + Object.keys(data.ENDINGS).length + '</b><br>' + chips;
    // 结局路线图（D1）
    var roadmap = engine.endingConditions(game);
    var roadHtml = '<h4 style="margin:10px 0 6px;color:var(--amber)">🧭 各结局条件达成情况</h4>';
    Object.keys(roadmap).forEach(function (id) {
      var items = roadmap[id].map(function (c) {
        return '<span style="color:' + (c.met ? 'var(--green)' : 'var(--dim)') + '">' + (c.met ? '✓' : '○') + ' ' + c.label + '</span>';
      }).join(' · ');
      roadHtml += '<div class="road-row">' + data.ENDINGS[id].epithet + '：' + items + '</div>';
    });
    $('endUnlock').insertAdjacentHTML('beforeend', roadHtml);
    checkAch();
    // 城市档案
    var arch = cityArchive(game);
    $('endArchive').innerHTML = '📜 <b>城市档案</b><br>' + arch.map(function (l) { return '· ' + l; }).join('<br>');
    // 本局要点（D04）
    var songsPlayed = game.log.filter(function (l) { return l.type === 'song'; }).length;
    var callsAnswered = game.log.filter(function (l) { return l.type === 'call' && l.text.indexOf('你回答') >= 0; }).length;
    var signals = game.log.filter(function (l) { return l.type === 'signal'; }).length;
    var arcs = Object.keys(game.arcsShown || {}).length;
    var summary = '📞 接听 ' + callsAnswered + ' 通来电 · 🎵 播放 ' + songsPlayed + ' 首歌 · 🤐 沉默 ' + game.flags.silenceCount + ' 次 · 📡 信号处理 ' + signals + ' 次 · 💌 支线 ' + arcs + ' 条 · 点播达成 ' + (game.flags.requestsFulfilled || 0) + ' 次';
    $('endArchive').insertAdjacentHTML('beforeend', '<div style="margin-top:8px;color:var(--amber)">🕮 <b>本局要点</b><br>' + summary + '</div>');
    var fates = '';
    data.CHARACTERS.forEach(function (c) {
      fates += '<div class="fate"><b>' + c.name + '（' + c.role + '）</b><br>' + data.charFate(game, c) + '</div>';
    });
    $('endFates').innerHTML = fates;
    $('ending').classList.remove('hidden');
  }

  // ---------- VU 表 + 示波器 + 城市动画 ----------
  function vuLoop() {
    if (vuStarted) return;
    vuStarted = true;
    var cv = $('vu');
    var ctx = cv.getContext('2d');
    var sc = $('scope');
    var sctx = sc.getContext('2d');
    var frameN = 0;
    function frame() {
      frameN++;
      if (REDUCED && frameN % 3 !== 0) { requestAnimationFrame(frame); return; }
      var W = cv.width, H = cv.height;
      ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
      var lv = lastWasSong ? synth.vuLevel() : 0.02;
      var n = Math.round(lv * 40);
      for (var i = 0; i < 40; i++) {
        ctx.fillStyle = i < n ? (i > 30 ? '#ff6b6b' : i > 16 ? '#ffb347' : '#7ee08a') : '#14203c';
        ctx.fillRect(4 + i * 5.6, 4, 4, H - 8);
      }
      // 示波器
      var sw = sc.width, sh = sc.height;
      sctx.fillStyle = '#05070d'; sctx.fillRect(0, 0, sw, sh);
      var wave = synth.waveform();
      sctx.strokeStyle = '#7ee08a';
      sctx.lineWidth = 1.2;
      sctx.beginPath();
      if (wave) {
        var step = Math.floor(wave.length / sw);
        for (var x = 0; x < sw; x++) {
          var v = (wave[Math.min(wave.length - 1, x * step)] - 128) / 128;
          var y = sh / 2 + v * sh * 0.42;
          if (x === 0) sctx.moveTo(x, y); else sctx.lineTo(x, y);
        }
      } else {
        sctx.moveTo(0, sh / 2); sctx.lineTo(sw, sh / 2);
      }
      sctx.stroke();
      // 城市动画 + 情绪曲线（低帧率即可）
      if (game && !game.done) { drawSkyline(); drawChart(); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ---------- 启动 ----------
  function renderNowPlaying() {
    var el = $('nowPlaying');
    if (el) {
      el.textContent = lastWasSong ? '♪ 正在播放：' + lastAct.slice(2) : lastAct;
      el.classList.toggle('live', lastWasSong);
    }
    var rh = $('reqHint');
    if (rh) {
      if (game.pendingRequest) {
        rh.textContent = '🎵 ' + data.charById(game.pendingRequest.caller).name + ' 还在等一首歌……';
        rh.classList.remove('hidden');
      } else rh.classList.add('hidden');
    }
  }

  function applyAmbient() {
    if (!game || game.done) { synth.ambientOff(); return; }
    var t = game.turn;
    var p;
    if (t <= 2) p = { gain: 0.05, filterFreq: 800, lfoRate: 0.2 };
    else if (t <= 4) p = { gain: 0.09, filterFreq: 420, lfoRate: 0.3 };
    else if (t === 5) p = { gain: 0.11, filterFreq: 700, lfoRate: 0.9 };
    else if (t <= 7) p = { gain: 0.11, filterFreq: 2600, lfoRate: 0.25 };
    else if (t <= 9) p = { gain: 0.14, filterFreq: 160, lfoRate: 0.4 };
    else p = { gain: 0.06, filterFreq: 900, lfoRate: 0.18 };
    synth.setAmbient(p);
  }

  function render() {
    renderHeader(); renderBeat(); renderActions(); renderPhone(); renderChars(); renderLog();
    renderNowPlaying(); drawSkyline(); drawChart(); applyAmbient();
  }

  function boot() {
    synth.cleanup();
    game = engine.createGame();
    game.flags.favs = favs();
    history = [{ hope: 50, mood: 50 }];
    menu = 'main';
    lastWasSong = false;
    lastAct = '— 静默 —';
    // 重播统计
    var plays = 1;
    try { plays = (+storage.get('lb-plays') || 0) + 1; storage.set('lb-plays', String(plays)); } catch (e) {}
    $('ending').classList.add('hidden');
    $('endNight').textContent = '🌙 第 ' + plays + ' 夜 · 城市之声 FM 95.5';
    // 存档继续按钮
    $('btnContinue').classList.toggle('hidden', !loadSave());
    $('btnReplay').addEventListener('click', function () {
      synth.stopMusic();
      boot();
    });
    $('btnLog').addEventListener('click', downloadLog);
    $('btnLore').addEventListener('click', showLore);
    $('btnLoreClose').addEventListener('click', function () { $('lorePanel').classList.add('hidden'); });
    $('btnContinue').addEventListener('click', function () { if (!continueSave()) toast('没有找到存档'); });
    $('achChip').addEventListener('click', function () {
      var list = achDone();
      var names = ACH.filter(function (a) { return list.indexOf(a.id) >= 0; }).map(function (a) { return a.name; });
      toast(names.length ? '已解锁：' + names.join('、') : '还没有成就——去完成一个夜晚吧');
    });
    // 音量
    var vol = 90;
    try { vol = +localStorage.getItem('lb-vol') || 90; } catch (e) {}
    $('vol').value = vol; $('volVal').textContent = vol;
    synth.setVolume(vol / 100);
    $('vol').addEventListener('input', function () {
      var v = +this.value;
      $('volVal').textContent = v;
      synth.setVolume(v / 100);
      try { localStorage.setItem('lb-vol', String(v)); } catch (e) {}
    });
    $('btnIntroOk').addEventListener('click', function () {
      $('intro').classList.add('hidden');
      storage.set('lb-intro-seen', '1');
    });
    // 首次交互时解锁音频
    document.addEventListener('pointerdown', function once() {
      synth.ensure();
      document.removeEventListener('pointerdown', once);
    }, { once: true });
    // 标签页隐藏时挂起音频（C2/E6）
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { try { synth.cleanup(); } catch (e) {} } else { synth.ensure(); }
    });
    // 首访介绍
    var seen = false;
    try { seen = storage.get('lb-intro-seen') === '1'; } catch (e) {}
    if (!seen) $('intro').classList.remove('hidden');
    render();
    vuLoop();
  }

  // ---------- 成就（D5） ----------
  function achDone() {
    try { return JSON.parse(storage.get('lb-ach') || '[]'); } catch (e) { return []; }
  }
  function achSave(list) { storage.set('lb-ach', JSON.stringify(list)); }

  function achMet(id) {
    if (!game) return false;
    if (id === 'night1') return game.done;
    if (id === 'nosilence') return game.done && game.flags.silenceCount === 0;
    if (id === 'allhope') return game.done && Object.keys(game.chars).filter(function (k) { return game.chars[k].hope >= 60; }).length >= 10;
    if (id === 'truth') return game.flags.truthCount >= 3;
    if (id === 'request') return (game.flags.requestsFulfilled || 0) >= 3;
    if (id === 'endings') { try { return JSON.parse(storage.get('lb-endings') || '[]').length >= 6; } catch (e) { return false; } }
    return false;
  }

  function checkAch() {
    if (!game) return;
    var list = achDone();
    ACH.forEach(function (a) {
      if (list.indexOf(a.id) < 0 && achMet(a.id)) {
        list.push(a.id);
        toast('🏅 成就解锁：「' + a.name + '」——' + a.desc);
      }
    });
    achSave(list);
    var chip = $('achChip');
    if (chip) { chip.textContent = '🏅 ' + list.length; chip.classList.toggle('hidden', list.length === 0); }
  }

  // ---------- 世界观考据（A8） ----------
  function showLore() {
    var html = '';
    Object.keys(data.WORLD_NOTES).forEach(function (k) {
      var n = data.WORLD_NOTES[k];
      html += '<div class="grammar-card"><h4>📜 ' + n.title + '</h4><p class="cat" style="line-height:1.9">' + n.text + '</p></div>';
    });
    $('loreList').innerHTML = html;
    $('lorePanel').classList.remove('hidden');
  }

  // ---------- 下载广播日志 ----------
  function downloadLog() {
    var lines = [];
    lines.push('LASTBROADCAST · 广播日志');
    lines.push('电台：城市之声 FM 95.5');
    lines.push('时间：隔离第七天 22:00 → 次日 22:00');
    lines.push('结局：' + (game.done && engine.ending(game) ? engine.ending(game).ending.title : '进行中'));
    lines.push('最终发言：' + (game.finalWords || '—'));
    lines.push('城市希望 ' + game.hope + ' / 氛围 ' + game.mood + ' / 你的精力 ' + game.djStamina);
    lines.push('================================');
    game.log.forEach(function (l) {
      var t = data.TURNS[l.turn] ? data.TURNS[l.turn].label.split(' · ')[0] : '';
      lines.push('[' + t + '] ' + l.text.replace(/\n/g, ' '));
    });
    var blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lastbroadcast-log.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  boot();
})();
