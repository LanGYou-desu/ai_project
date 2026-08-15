/* LINGUA · 语言演化博物馆 —— 前端主逻辑（全功能版） */
(function () {
  'use strict';
  var GW = window.LINGUA;
  var world = GW.world, lex = GW.lexicon, glyphs = GW.glyphs, treeview = GW.treeview;
  var lyricsMod = GW.lyrics, tts = GW.tts, storage = GW.storage;

  var REDUCED = false;
  try { REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var state = {
    history: null, selected: null, cursor: 19, tab: 'words',
    playing: false, timer: null, hovered: null, dragging: false,
    search: '', catFilter: 'all', speed: 1,
    opts: { extraWords: [], ruleScale: 1, grammarScale: 1, extraSplits: [] },
    memo: {}, visited: {}, etymCount: 0
  };

  var $ = function (id) { return document.getElementById(id); };

  var PRESETS = [
    { name: '雾语', seed: 'fog-lingua', intro: '海雾里的渔村语言：元音柔和，弱化与插音频繁。' },
    { name: '霜语', seed: 'frost-lingua', intro: '极北部落的语言：词尾清化与脱落盛行，词形利落。' },
    { name: '星河语', seed: 'star-lingua', intro: '高原观星部族的语言：颚化与双元音丰富。' },
    { name: '盐语', seed: 'salt-lingua', intro: '海岸商路的语言：借词多、语法简化得快。' },
    { name: '铁语', seed: 'iron-lingua', intro: '山间铁匠部族的语言：辅音硬朗、重叠与浊化常见。' },
    { name: '潮语', seed: 'tide-lingua', intro: '潮汐平原的语言：元音推移剧烈，词形漂移大。' }
  ];

  var CAT_COLOR = {
    nature: '#7a8a5a', body: '#a0552f', family: '#8b5a2b', people: '#5b6a8b',
    action: '#8a6d3b', object: '#4a6741', abstract: '#7a4a8b', number: '#a03a2a',
    time: '#3f6f8f', animal: '#2f6f55', color: '#b56576', emotion: '#c96f2e', direction: '#5b8a6b'
  };

  var ACH = [
    { id: 'first', name: '初入馆', desc: '第一次走进博物馆' },
    { id: 'split', name: '看见分裂', desc: '时间轴越过公元 300 年（第一次分裂）' },
    { id: 'loan', name: '遇见借词', desc: '时间轴越过第一波借词' },
    { id: 'writing', name: '见证文字', desc: '时间轴越过文字诞生（公元 500 年）' },
    { id: 'branches', name: '踏遍七脉', desc: '浏览过全部 7 个分支' },
    { id: 'collector', name: '馆藏家', desc: '收藏 3 门语言' },
    { id: 'creator', name: '造物者', desc: '在创作台添加了自定义词根' },
    { id: 'scholar', name: '语言学者', desc: '追踪过 5 个词的词源' }
  ];

  function urlParams() {
    var p = new URLSearchParams(location.search);
    return { lang: p.get('lang'), seed: p.get('seed') };
  }

  function pickDefaultBranch(h) {
    var best = h.branches[0], maxBorn = -1;
    h.branches.forEach(function (b) { if (b.bornEpoch > maxBorn) { maxBorn = b.bornEpoch; best = b; } });
    return best.id;
  }

  function evolveLang(name, seed) {
    state.memo = {};
    var h = world.evolve({ name: name, seed: seed, extraWords: state.opts.extraWords, ruleScale: state.opts.ruleScale, grammarScale: state.opts.grammarScale, extraSplits: state.opts.extraSplits });
    state.history = h;
    state.selected = pickDefaultBranch(h);
    state.cursor = h.totalEpochs - 1;
    $('epochSlider').max = h.totalEpochs - 1;
    $('epochSlider').value = state.cursor;
    checkAch();
    renderAll();
  }

  // ---------- memo（C5） ----------
  function wordsAtCached(branchId, epoch) {
    var key = branchId + '@' + epoch;
    if (!state.memo[key]) {
      var w = world.wordsAt(state.history, branchId, epoch);
      state.memo[key] = w;
    }
    return state.memo[key];
  }

  // ---------- 语系树 ----------
  function renderTree() {
    var cv = $('treeCanvas');
    var ctx = cv.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var w = cv.clientWidth, h = Math.max(cv.clientHeight, 300);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.height = h + 'px';
    ctx.scale(dpr, dpr);
    treeview.render(cv, state.history, { selected: state.selected, cursorEpoch: state.cursor, hovered: state.hovered });
  }

  function renderLegend() {
    var el = $('treeLegend');
    if (!el || !state.history) return;
    var lanes = treeview.layout(state.history);
    var html = '';
    state.history.branches.forEach(function (b) {
      var color = treeview.BRANCH_COLORS[lanes[b.id] % treeview.BRANCH_COLORS.length];
      html += '<span class="legend-chip" data-branch="' + b.id + '"><i style="background:' + color + '"></i>' + b.name + '</span>';
    });
    el.innerHTML = '图例：' + html;
    el.querySelectorAll('.legend-chip').forEach(function (c) {
      c.addEventListener('click', function () { state.selected = c.getAttribute('data-branch'); renderAll(); });
    });
  }

  function renderEraChips() {
    var el = $('eraChips');
    var h = state.history;
    var chips = [];
    h.splits.forEach(function (sp, i) {
      chips.push({ epoch: sp.epoch, label: (sp.manual ? '手动分裂' : i === 0 ? '洪水分裂' : i === 1 ? '翻山分裂' : '海升分裂'), y: sp.epoch * h.yearsPerEpoch });
    });
    h.loans.forEach(function (l, i) {
      chips.push({ epoch: l.epoch, label: l.note.replace('借词', '') + '借词', y: l.epoch * h.yearsPerEpoch });
    });
    if (h.writing) chips.push({ epoch: h.writing.epoch, label: '文字诞生', y: h.writing.epoch * h.yearsPerEpoch });
    var html = '';
    chips.sort(function (a, b) { return a.epoch - b.epoch; }).forEach(function (c) {
      html += '<span class="era-chip" data-epoch="' + c.epoch + '"><b>公元' + c.y + '年</b> · ' + c.label + '</span>';
    });
    el.innerHTML = html;
    el.querySelectorAll('.era-chip').forEach(function (chip) {
      chip.addEventListener('click', function () { setCursor(+chip.getAttribute('data-epoch')); });
    });
  }

  // ---------- 展厅 ----------
  function renderHeader() {
    $('langTitle').textContent = '「' + state.history.name + '」 · ' + state.history.seed;
    renderAchCounter();
  }

  function renderWords() {
    var el = $('tab-words');
    var h = state.history;
    var w = wordsAtCached(state.selected, state.cursor);
    if (!w) { el.innerHTML = emptyBranch(); return; }
    var branch = null;
    h.branches.forEach(function (b) { if (b.id === state.selected) branch = b; });
    var glosses = Object.keys(w);
    var q = state.search.trim();
    if (q) glosses = glosses.filter(function (g) { return g.indexOf(q) >= 0 || w[g].word.indexOf(q) >= 0; });
    if (state.catFilter !== 'all') glosses = glosses.filter(function (g) { return w[g].cat === state.catFilter; });
    glosses.sort(function (a, b2) {
      var ca = lex.CATS[w[a].cat] || '其他', cb = lex.CATS[w[b2].cat] || '其他';
      return ca.localeCompare(cb) || a.localeCompare(b2);
    });
    var ph = world.phonemeInventory(w);
    var html = '<div class="phoneme">🎼 音系档案：<b>' + ph.consonants.length + '</b> 辅音 <span class="cat">[' + ph.consonants.join(' ') + ']</span> · <b>' + ph.vowels.length + '</b> 元音 <span class="cat">[' + ph.vowels.join(' ') + ']</span></div>';
    var catChips = '<span class="cat-chip" data-cat="all" style="background:' + (state.catFilter === 'all' ? '#a03a2a' : '#b7a583') + '">全部 ' + Object.keys(w).length + '</span>';
    Object.keys(lex.CATS).forEach(function (c) {
      var n = Object.keys(w).filter(function (g) { return w[g].cat === c; }).length;
      if (!n) return;
      var on = state.catFilter === c;
      catChips += '<span class="cat-chip" data-cat="' + c + '" style="background:' + (on ? CAT_COLOR[c] : '#b7a583') + '">' + lex.CATS[c] + ' ' + n + '</span>';
    });
    html += '<div class="cat-filters">' + catChips + '</div>';
    html += '<div class="searchbar"><input id="wordSearch" type="text" placeholder="🔍 搜索词义或词形…" value="' + state.search + '" aria-label="搜索词表"></div>';
    html += '<div class="cat">共 ' + glosses.length + ' 个词 <button class="say-btn" id="btnRandom">🎲 随机邂逅一词</button></div>';
    html += '<canvas id="phCurve" width="0" height="0" class="ph-curve" role="img" aria-label="音位数量随时间演化曲线"></canvas>';
    html += '<table><thead><tr><th>词义</th><th>类别</th><th>原始词形</th><th>公元' + (state.cursor * h.yearsPerEpoch) + '年</th><th></th></tr></thead><tbody>';
    glosses.forEach(function (g) {
      var proto = lex.BY_GLOSS[g] ? lex.BY_GLOSS[g].word : '—';
      var note = branch.wordLog[g] && branch.wordLog[g][0].note;
      var loanBadge = '';
      if (note) loanBadge = ' <span class="badge loan">' + note.replace('借词', '借') + '</span>';
      var catColor = CAT_COLOR[w[g].cat] || '#999';
      html += '<tr class="wordrow" data-gloss="' + g + '">' +
        '<td>' + g + loanBadge + '</td>' +
        '<td><span class="cat-chip" style="background:' + catColor + '">' + (lex.CATS[w[g].cat] || '其他') + '</span></td>' +
        '<td class="proto">' + proto + '</td>' +
        '<td class="word">' + w[g].word + '</td>' +
        '<td><button class="say-btn" data-word="' + w[g].word + '" title="试听发音">🔊</button></td></tr>';
    });
    if (!glosses.length) html += '<tr><td colspan="5" class="cat">😶 没有匹配的词——换个关键词或清空类别筛选试试。</td></tr>';
    html += '</tbody></table>';
    el.innerHTML = html;
    var inp = $('wordSearch');
    if (inp) inp.addEventListener('input', function () { state.search = inp.value; renderWords(); });
    var rnd = $('btnRandom');
    if (rnd) rnd.addEventListener('click', function () {
      var keys = Object.keys(w);
      if (!keys.length) return;
      var g = keys[Math.floor(Math.random() * keys.length)];
      showEtymology(g);
      toast('🎲 今日邂逅：「' + g + '」');
    });
    drawPhonemeCurve();
    el.querySelectorAll('.cat-filters .cat-chip').forEach(function (chip) {
      chip.addEventListener('click', function () { state.catFilter = chip.getAttribute('data-cat'); renderWords(); });
    });
    el.querySelectorAll('.wordrow').forEach(function (tr) {
      tr.addEventListener('click', function () { showEtymology(tr.getAttribute('data-gloss')); });
    });
    el.querySelectorAll('.say-btn').forEach(function (b) {
      b.addEventListener('click', function (ev) { ev.stopPropagation(); tts.speak(b.getAttribute('data-word')); });
    });
  }

  // 音系演化曲线：0→1000 年音位数量
  function drawPhonemeCurve() {
    var cv = $('phCurve');
    if (!cv) return;
    var h = state.history;
    var dpr = window.devicePixelRatio || 1;
    var W = cv.parentElement ? cv.parentElement.clientWidth - 8 : 400, H = 76;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#faf3e2'; ctx.fillRect(0, 0, W, H);
    var counts = [];
    for (var e = 0; e < h.totalEpochs; e++) {
      var w = wordsAtCached(state.selected, e);
      if (!w) counts.push(null); else {
        var ph = world.phonemeInventory(w);
        counts.push(ph.consonants.length + ph.vowels.length);
      }
    }
    var max = 10, min = 99;
    counts.forEach(function (c) { if (c != null) { if (c > max) max = c; if (c < min) min = c; } });
    if (min === 99) return;
    max += 2;
    function px(i) { return 20 + i / (h.totalEpochs - 1) * (W - 40); }
    function py(v) { return H - 12 - (v - min + 1) / (max - min + 2) * (H - 24); }
    ctx.strokeStyle = '#c9b78a'; ctx.lineWidth = 1;
    for (var v = min; v <= max; v++) {
      ctx.beginPath(); ctx.moveTo(16, py(v)); ctx.lineTo(W - 16, py(v)); ctx.stroke();
    }
    ctx.strokeStyle = '#a03a2a'; ctx.lineWidth = 2; ctx.beginPath();
    var started = false;
    counts.forEach(function (c, i) {
      if (c == null) return;
      if (!started) { ctx.moveTo(px(i), py(c)); started = true; } else ctx.lineTo(px(i), py(c));
    });
    ctx.stroke();
    var last = counts.length - 1;
    while (last >= 0 && counts[last] == null) last--;
    if (last >= 0) {
      ctx.fillStyle = '#a03a2a';
      ctx.beginPath(); ctx.arc(px(last), py(counts[last]), 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#6b5638'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('音位数', 12, 10);
    ctx.fillText('0年', 20, H - 2);
    ctx.fillText('1000年', W - 34, H - 2);
  }

  // 音变图鉴
  function renderAtlas() {
    var el = $('tab-atlas');
    var h = state.history;
    var soundsMod = GW.sounds;
    var agg = {};
    soundsMod.RULES.forEach(function (r) { agg[r.id] = { rule: r, total: 0, branches: {} }; });
    h.branches.forEach(function (b) {
      for (var rid in b.soundCounts) {
        if (agg[rid]) { agg[rid].total += b.soundCounts[rid]; agg[rid].branches[b.name] = b.soundCounts[rid]; }
      }
    });
    var list = Object.keys(agg).map(function (id) { return agg[id]; });
    list.sort(function (a, b) { return b.total - a.total; });
    var discovered = list.filter(function (x) { return x.total > 0; }).length;
    var html = '<p class="cat" style="margin-bottom:8px">🏛️ 音变图鉴 · 已发现 <b style="color:#a03a2a">' + discovered + '</b> / ' + list.length + ' 条音变（按各分支使用统计）</p>';
    list.forEach(function (x) {
      var got = x.total > 0;
      var branchNames = Object.keys(x.branches);
      var branchesHtml = branchNames.map(function (n) { return n + '×' + x.branches[n]; }).join('、');
      html += '<div class="grammar-card" style="' + (got ? '' : 'opacity:.55') + '"><h4>' + (got ? '📖' : '🔒') + ' ' + x.rule.name + (got ? ' · 共 ' + x.total + ' 次' : ' · 待发现') + '</h4>' +
        '<p>' + x.rule.desc + '</p>' +
        (got ? '<div class="real">🔄 涉及分支：' + branchesHtml + '</div>' : '') +
        '<div class="real">📖 ' + x.rule.real + '</div></div>';
    });
    el.innerHTML = html;
  }

  // 语言名片
  function languageCard() {
    var h = state.history;
    var branch = null;
    h.branches.forEach(function (b) { if (b.id === state.selected) branch = b; });
    var g = world.grammarAt(h, state.selected, 19);
    var w = wordsAtCached(state.selected, 19);
    var ph = world.phonemeInventory(w);
    var feats = [];
    feats.push('语序 ' + g.wordOrder);
    if (g.plural) feats.push('复数' + g.plural);
    if (g.dual) feats.push('双数' + g.dual);
    if (g.articles) feats.push('有冠词');
    if (g.gender) feats.push('名词分阴阳');
    if (g.classifier) feats.push('量词' + g.classifier);
    if (g.evidential) feats.push('传闻标记');
    if (g.honorific) feats.push('敬语');
    if (g.onom) feats.push('拟声词');
    if (g.redup) feats.push('叠词');
    if (g.compounding) feats.push('复合词化');
    if (!feats.length) feats.push('语法质朴');
    var text = '《' + h.name + '》：' + (branch ? branch.name : '') + '，以 ' + (ph.consonants.length + ph.vowels.length) + ' 个音位呼吸的千年语言，' +
      feats.join('、') + '，' + (h.loans.length ? '历经 ' + h.loans.length + ' 波借词' : '几乎没有借词') +
      '，' + (h.writing ? '公元' + (h.writing.epoch * h.yearsPerEpoch) + '年诞生文字' : '没有文字') + '。种子：' + h.seed;
    return text;
  }

  function emptyBranch() {
    var b = null;
    state.history.branches.forEach(function (x) { if (x.id === state.selected) b = x; });
    return '<div class="empty"><div class="empty-ic">🕰️</div><p>「' + (b ? b.name : '') + '」在公元 ' + (state.cursor * state.history.yearsPerEpoch) + ' 年尚未诞生（诞生于公元 ' + (b ? b.bornEpoch * state.history.yearsPerEpoch : '—') + ' 年）。</p>' +
      '<button data-jump="' + (b ? b.bornEpoch : 0) + '" class="empty-btn">⏪ 跳到它的诞生年代</button></div>';
  }

  var G_LABEL = [
    ['wordOrder', '语序', function (v) { return v; }],
    ['plural', '复数标记', function (v) { return v || '无'; }],
    ['dual', '双数标记', function (v) { return v || '无'; }],
    ['past', '过去时标记', function (v) { return v || '无'; }],
    ['progressive', '进行体标记', function (v) { return v || '无'; }],
    ['perfect', '完成体标记', function (v) { return v || '无'; }],
    ['classifier', '量词', function (v) { return v || '无'; }],
    ['articles', '冠词', function (v) { return v ? '有（那个/一个）' : '无'; }],
    ['genitive', '属格标记', function (v) { return v || '无'; }],
    ['question', '疑问标记', function (v) { return v || '无'; }],
    ['negation', '否定标记', function (v) { return v || '无'; }],
    ['postpos', '后置词', function (v) { return v || '无'; }],
    ['passive', '被动语态', function (v) { return v ? '有' : '无'; }],
    ['evidential', '传闻标记', function (v) { return v || '无'; }],
    ['gender', '名词性类', function (v) { return v || '无'; }],
    ['pronouns', '代词系统', function (v) { return v ? '完善' : '未完善'; }],
    ['honorific', '敬语', function (v) { return v ? '有' : '无'; }],
    ['onom', '拟声词', function (v) { return v ? '有' : '无'; }],
    ['redup', '叠词', function (v) { return v ? '有' : '无'; }],
    ['compounding', '复合词化', function (v) { return v ? '有' : '无'; }],
    ['numerals', '数词系统', function (v) { return v; }]
  ];

  function renderGrammar() {
    var el = $('tab-grammar');
    var g = world.grammarAt(state.history, state.selected, state.cursor);
    var branch = null;
    state.history.branches.forEach(function (b) { if (b.id === state.selected) branch = b; });
    var html = '';
    G_LABEL.forEach(function (row) {
      html += '<div class="grammar-card"><h4>' + row[1] + '：' + row[2](g[row[0]]) + '</h4>';
      if (row[0] === 'wordOrder') html += '<p>例：' + (g.wordOrder === 'SVO' ? '猎人 杀死 狼' : g.wordOrder === 'SOV' ? '猎人 狼 杀死' : '杀死 猎人 狼') + '</p>';
      if (row[0] === 'plural') html += '<p>例：狼' + (g.plural || '') + '</p>';
      if (row[0] === 'dual') html += '<p>例：眼' + (g.dual || '') + '</p>';
      if (row[0] === 'past') html += '<p>例：唱' + (g.past || '') + '</p>';
      if (row[0] === 'negation') html += '<p>例：吃' + (g.negation || '') + '</p>';
      if (row[0] === 'classifier') html += '<p>例：鱼 三' + (g.classifier || '') + '</p>';
      if (row[0] === 'postpos') html += '<p>例：山' + (g.postpos || '') + '</p>';
      html += '</div>';
    });
    var ge = branch.events.filter(function (e) { return e.type === 'grammar' && e.epoch <= state.cursor; });
    if (ge.length) {
      html += '<h4 style="margin:10px 0 6px;color:#8b5a2b">语法演化史</h4>';
      ge.forEach(function (e) {
        html += '<div class="event-item grammar"><span class="year">公元' + (e.epoch * state.history.yearsPerEpoch) + '年</span>' +
          '<div class="en">' + e.name + '</div><div class="de">' + (e.flavor || e.detail) + '</div></div>';
      });
    }
    el.innerHTML = html;
  }

  function renderEvents() {
    var el = $('tab-events');
    var h = state.history;
    var branch = null;
    h.branches.forEach(function (b) { if (b.id === state.selected) branch = b; });
    var list = world.branchTimeline(h, state.selected);
    var soundsMod = GW.sounds;
    var html = '<h4 style="margin-bottom:8px">「' + branch.name + '」的编年史</h4>';
    if (!list.length) html += '<p class="cat">（尚无记录）</p>';
    list.forEach(function (e) {
      if (e.epoch > state.cursor) return;
      var realHtml = '';
      if (e.type === 'sound') {
        var reals = [];
        e.name.split('、').forEach(function (nm) {
          soundsMod.RULES.forEach(function (r) { if (r.name === nm && r.real) reals.push(r.real); });
        });
        if (reals.length) realHtml = '<div class="real">📖 ' + reals.join('<br>') + '</div>';
      }
      html += '<div class="event-item ' + e.type + '"><span class="year">公元' + (e.epoch * h.yearsPerEpoch) + '年</span>' +
        '<div class="en">' + e.name + '</div><div class="de">' + (e.detail || e.flavor) + '</div>' + realHtml + '</div>';
    });
    el.innerHTML = html;
  }

  function renderWriting() {
    var el = $('tab-writing');
    var h = state.history;
    var w = wordsAtCached(state.selected, state.cursor);
    if (!w) { el.innerHTML = emptyBranch(); return; }
    var glosses = Object.keys(w);
    var pick = el.getAttribute('data-pick') || '水';
    if (glosses.indexOf(pick) < 0) pick = glosses[0];
    el.setAttribute('data-pick', pick);
    var opts = glosses.map(function (g) {
      return '<option value="' + g + '"' + (g === pick ? ' selected' : '') + '>' + g + '（' + w[g].word + '）</option>';
    }).join('');
    var cat = el.getAttribute('data-cat') || 'nature';
    var html = '<div class="writing-pick"><select id="writingSel">' + opts + '</select></div>' +
      '<div>' +
      '<div class="writing-stage"><canvas id="ws-pic" width="120" height="120"></canvas><div class="cap">图画阶段 · 象形</div></div>' +
      '<div class="writing-stage"><canvas id="ws-sim" width="120" height="120"></canvas><div class="cap">简化阶段 · 笔画化</div></div>' +
      '<div class="writing-stage"><canvas id="ws-script" width="120" height="120"></canvas><div class="cap">文字阶段 · 字母化</div></div>' +
      '</div>' +
      '<p class="cat" style="margin-top:8px">' + (h.writing ? '公元' + (h.writing.epoch * h.yearsPerEpoch) + '年，' + h.writing.flavor : '') + '</p>' +
      '<h4 style="margin:14px 0 6px;color:#8b5a2b">🦴 甲骨展柜 · 整类字形</h4>' +
      '<div class="writing-pick"><select id="catSel">' +
      Object.keys(lex.CATS).map(function (c) { return '<option value="' + c + '">' + lex.CATS[c] + '</option>'; }).join('') +
      '</select></div><div id="glyphGrid" class="glyph-grid"></div>';
    el.innerHTML = html;
    var sel = $('writingSel');
    sel.addEventListener('change', function () { el.setAttribute('data-pick', sel.value); renderWriting(); });
    var word = w[pick].word;
    ['ws-pic', 'ws-sim', 'ws-script'].forEach(function (id, i) {
      var cv = $(id);
      var ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 120, 120);
      glyphs.drawStage(ctx, pick, word, ['picture', 'simple', 'script'][i], 60, 60, 95);
    });
    var catSel = $('catSel');
    catSel.value = cat;
    catSel.addEventListener('change', function () { el.setAttribute('data-cat', catSel.value); renderWriting(); });
    renderGlyphGrid(el, cat);
  }

  function renderGlyphGrid(el, cat) {
    var grid = $('glyphGrid');
    if (!grid) return;
    var w = wordsAtCached(state.selected, state.cursor);
    var words = Object.keys(w).filter(function (g) { return (lex.BY_GLOSS[g] ? lex.BY_GLOSS[g].cat : w[g].cat) === cat; });
    if (!words.length) { grid.innerHTML = '<span class="cat">该类别暂无词汇。</span>'; return; }
    var html = '';
    words.slice(0, 24).forEach(function (g) {
      html += '<div class="glyph-cell"><canvas data-g="' + g + '" width="64" height="64"></canvas><div class="gl">' + g + '</div></div>';
    });
    grid.innerHTML = html;
    grid.querySelectorAll('canvas').forEach(function (cv) {
      var ctx = cv.getContext('2d');
      glyphs.drawStage(ctx, cv.getAttribute('data-g'), w[cv.getAttribute('data-g')].word, 'picture', 32, 32, 52);
    });
  }

  function renderLoan() {
    var el = $('tab-loan');
    var h = state.history;
    var rows = [];
    h.branches.forEach(function (b) {
      var words = [];
      var note = null;
      for (var g in b.wordLog) {
        if (b.wordLog[g][0].note && b.wordLog[g][0].note.indexOf('借词') >= 0) {
          words.push(g + '（' + b.wordLog[g][b.wordLog[g].length - 1].form + '）');
          note = b.wordLog[g][0].note;
        }
      }
      if (words.length) rows.push({ name: b.name, words: words, note: note });
    });
    var html = '';
    h.loans.forEach(function (l) {
      html += '<div class="grammar-card"><h4>' + l.note + ' · 公元' + (l.epoch * h.yearsPerEpoch) + '年</h4><p class="cat">' + l.flavor + '</p><p>' + l.words.join('、') + '</p></div>';
    });
    if (!rows.length) { html += '<div class="empty"><div class="empty-ic">🐎</div><p>这次演化中没有发生借词事件——试试别的种子？</p></div>'; }
    rows.forEach(function (r) {
      html += '<div class="grammar-card"><h4>' + r.name + '</h4><p>' + (r.note || '借词') + '：' + r.words.join('、') + '</p></div>';
    });
    el.innerHTML = html;
  }

  // ---------- 歌谣（A4） ----------
  function renderLyrics() {
    var el = $('tab-lyrics');
    var w = wordsAtCached(state.selected, state.cursor);
    if (!w) { el.innerHTML = emptyBranch(); return; }
    var g = world.grammarAt(state.history, state.selected, state.cursor);
    var songs = lyricsMod.lyricsFor(w, g);
    if (!songs.length) { el.innerHTML = '<div class="empty"><div class="empty-ic">🎵</div><p>这个分支缺少拼歌谣所需的词（战士/狼/月亮/渔夫/火…）——试试其他分支或种子。</p></div>'; return; }
    var html = '<p class="cat" style="margin-bottom:8px">用「' + state.history.name + '」公元 ' + (state.cursor * state.history.yearsPerEpoch) + ' 年的词形拼成的歌谣：</p>';
    songs.forEach(function (s, i) {
      html += '<div class="song-card"><h4>' + s.title + '</h4>' +
        '<div class="song-line">' + s.line + '</div>' +
        '<div class="song-gloss">' + s.gloss + '</div>' +
        '<div class="song-zh">「' + s.zh + '」</div>' +
        '<button class="say-btn" data-word="' + s.line.split(' ').join('') + '">🔊 试听</button></div>';
    });
    el.innerHTML = html;
    el.querySelectorAll('.say-btn').forEach(function (b) {
      b.addEventListener('click', function () { tts.speak(b.getAttribute('data-word')); });
    });
  }

  // ---------- 创作台（D3） ----------
  function renderSandbox() {
    var el = $('tab-sandbox');
    var b = null;
    state.history.branches.forEach(function (x) { if (x.id === state.selected) b = x; });
    var html = '<p class="cat" style="margin-bottom:8px">在这里把"参观"变成"创作"：一切修改都会用同一颗种子重新演化，结果可复现。</p>' +
      '<div class="grammar-card"><h4>✍️ 自定义词根</h4><p class="cat">每行一条：<code>词义:词形</code> 或 <code>词义:词形:类别</code>，如 <code>龙:draka:animal</code></p>' +
      '<textarea id="sbWords" rows="4" placeholder="龙:draka:animal&#10;冰:gelwa:nature">' + (state.opts.extraWords.map(function (w) { return w.gloss + ':' + w.word + (w.cat ? ':' + w.cat : ''); }).join('\n')) + '</textarea></div>' +
      '<div class="grammar-card"><h4>⚙️ 演化频率</h4>' +
      '<div class="sb-row"><span>音变频率</span><input type="range" id="sbRule" min="50" max="200" value="' + Math.round(state.opts.ruleScale * 100) + '"><b id="sbRuleV">' + Math.round(state.opts.ruleScale * 100) + '%</b></div>' +
      '<div class="sb-row"><span>语法频率</span><input type="range" id="sbGram" min="50" max="200" value="' + Math.round(state.opts.grammarScale * 100) + '"><b id="sbGramV">' + Math.round(state.opts.grammarScale * 100) + '%</b></div></div>' +
      '<div class="grammar-card"><h4>🗡️ 手动分裂</h4><p class="cat">在公元 ' + (state.cursor * state.history.yearsPerEpoch) + ' 年分裂「' + (b ? b.name : '') + '」。已分裂 ' + state.opts.extraSplits.length + ' 次。</p>' +
      '<button id="sbSplit" class="empty-btn">＋ 在这里分裂</button></div>' +
      '<button id="sbApply" class="btn sb-apply">🔁 应用创作台并重新演化</button>' +
      '<div id="sbHint" class="cat" style="margin-top:6px"></div>';
    el.innerHTML = html;
    $('sbRule').addEventListener('input', function () { $('sbRuleV').textContent = this.value + '%'; });
    $('sbGram').addEventListener('input', function () { $('sbGramV').textContent = this.value + '%'; });
    $('sbSplit').addEventListener('click', function () {
      state.opts.extraSplits.push({ epoch: state.cursor, branchId: state.selected });
      evolveLang(state.history.name, state.history.seed);
      renderSandbox();
      toast('已记录一次手动分裂，正在重新演化');
    });
    $('sbApply').addEventListener('click', function () {
      var text = $('sbWords').value;
      var words = [];
      text.split(/\n/).forEach(function (line) {
        line = line.trim();
        if (!line) return;
        var parts = line.split(':');
        if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
          words.push({ gloss: parts[0].trim(), word: parts[1].trim(), cat: parts[2] ? parts[2].trim() : 'object' });
        }
      });
      state.opts.extraWords = words;
      state.opts.ruleScale = (+$('sbRule').value) / 100;
      state.opts.grammarScale = (+$('sbGram').value) / 100;
      if (state.opts.extraWords.length) state.opts.extraWords.forEach(function () { }); // ensure array
      evolveLang(state.history.name, state.history.seed);
      $('sbHint').textContent = state.opts.extraWords.length + ' 个自定义词根 · 音变频率 ' + Math.round(state.opts.ruleScale * 100) + '% · 语法频率 ' + Math.round(state.opts.grammarScale * 100) + '%';
      toast('创作台已应用');
    });
  }

  // ---------- 同源词 ----------
  function renderCognates() {
    var el = $('tab-cognates');
    var h = state.history;
    var w = wordsAtCached(state.selected, state.cursor);
    if (!w) { el.innerHTML = emptyBranch(); return; }
    var glosses = Object.keys(w);
    var pick = el.getAttribute('data-pick') || '水';
    if (glosses.indexOf(pick) < 0) pick = glosses[0];
    el.setAttribute('data-pick', pick);
    var opts = glosses.map(function (g) {
      return '<option value="' + g + '"' + (g === pick ? ' selected' : '') + '>' + g + '</option>';
    }).join('');
    var cog = world.cognates(h, pick, state.cursor);
    var html = '<div class="writing-pick"><select id="cogSel">' + opts + '</select>' +
      '　<span class="cat">原始词形：<b>' + (cog.proto || '—') + '</b> · 点击行可跳到对应分支</span></div>';
    html += '<table><thead><tr><th>分支</th><th>词形</th><th>分化自</th></tr></thead><tbody>';
    cog.rows.forEach(function (r) {
      var branch = null;
      h.branches.forEach(function (b) { if (b.id === r.branchId) branch = b; });
      var note = '';
      if (branch && branch.parentId) {
        var p = null;
        h.branches.forEach(function (b) { if (b.id === branch.parentId) p = b; });
        note = '「' + (p ? p.name : '') + '」→ ' + (branch.bornEpoch * h.yearsPerEpoch) + '年';
      } else note = '原语';
      html += '<tr class="wordrow" data-branch="' + r.branchId + '"><td>' + r.branchName + '</td><td class="word">' + r.word + '</td><td class="cat">' + note + '</td></tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
    var sel = $('cogSel');
    sel.addEventListener('change', function () { el.setAttribute('data-pick', sel.value); renderCognates(); });
    el.querySelectorAll('.wordrow').forEach(function (tr) {
      tr.addEventListener('click', function () { state.selected = tr.getAttribute('data-branch'); renderAll(); });
    });
    // 双分支对比
    var ba = el.getAttribute('data-ba') || state.selected;
    var bb = el.getAttribute('data-bb') || 'root';
    var branchOpts = h.branches.map(function (b) {
      return '<option value="' + b.id + '"' + (b.id === ba ? ' selected' : '') + '>' + b.name + '</option>';
    }).join('');
    var branchOpts2 = h.branches.map(function (b) {
      return '<option value="' + b.id + '"' + (b.id === bb ? ' selected' : '') + '>' + b.name + '</option>';
    }).join('');
    var cmp = '<h4 style="margin:16px 0 6px;color:#8b5a2b">⚖️ 方言对比 · ' + (state.cursor * h.yearsPerEpoch) + ' 年</h4>' +
      '<div class="writing-pick"><select id="cmpA">' + branchOpts + '</select> ⇄ <select id="cmpB">' + branchOpts2 + '</select></div>';
    var wa = wordsAtCached(ba, state.cursor), wb = wordsAtCached(bb, state.cursor);
    if (wa && wb) {
      var keys = Object.keys(wa);
      var diff = 0;
      var rows = keys.map(function (g) {
        var a = wa[g] ? wa[g].word : '—', b2 = wb[g] ? wb[g].word : '—';
        var isDiff = a !== b2;
        if (isDiff) diff++;
        return '<tr' + (isDiff ? ' class="diff"' : '') + '><td>' + g + '</td><td class="word">' + a + '</td><td class="word">' + b2 + '</td></tr>';
      }).join('');
      cmp += '<div class="cat">同源词差异：<b style="color:#a03a2a">' + diff + '</b> / ' + keys.length + ' 词</div>';
      cmp += '<table><thead><tr><th>词义</th><th>' + (h.branches.find(function (x) { return x.id === ba; }) || { name: '' }).name + '</th><th>' + (h.branches.find(function (x) { return x.id === bb; }) || { name: '' }).name + '</th></tr></thead><tbody>' + rows + '</tbody></table>';
    } else {
      cmp += '<p class="cat">所选分支在公元' + (state.cursor * h.yearsPerEpoch) + '年尚未诞生。</p>';
    }
    el.insertAdjacentHTML('beforeend', cmp);
    var cmpA = $('cmpA'), cmpB = $('cmpB');
    if (cmpA) cmpA.addEventListener('change', function () { el.setAttribute('data-ba', cmpA.value); renderCognates(); });
    if (cmpB) cmpB.addEventListener('change', function () { el.setAttribute('data-bb', cmpB.value); renderCognates(); });
  }

  // ---------- 词源追踪 ----------
  function showEtymology(gloss) {
    var h = state.history;
    var chain = world.traceEtymology(h, state.selected, gloss);
    if (!chain.length) return;
    state.etymCount++;
    checkAch();
    var branch = null;
    h.branches.forEach(function (b) { if (b.id === state.selected) branch = b; });
    var html = '<span class="close" data-close="1" role="button" aria-label="关闭">✕</span>';
    html += '<b>词源追踪 · ' + gloss + '</b>　「' + branch.name + '」<br><br>';
    var steps = [];
    chain.forEach(function (c) {
      var rules = c.rules.length ? '<span class="rules">' + c.rules.join('·') + '</span>' : '';
      steps.push('<div class="etym-step"><span class="yr">公元' + c.year + '年' + (c.note ? '·' + c.note : '') + '</span><span class="form">' + c.form + '</span>' + rules + '<button class="say-btn" data-word="' + c.form + '">🔊</button></div>');
    });
    html += steps.join('<div class="etym-arrow">↓</div>');
    var e = $('etymology');
    e.innerHTML = html;
    e.classList.remove('hidden');
    e.querySelector('[data-close]').addEventListener('click', function () { e.classList.add('hidden'); });
    e.querySelectorAll('.say-btn').forEach(function (b) {
      b.addEventListener('click', function (ev) { ev.stopPropagation(); tts.speak(b.getAttribute('data-word')); });
    });
  }

  // ---------- 时间轴 ----------
  function setCursor(e) {
    state.cursor = Math.max(0, Math.min(state.history.totalEpochs - 1, e));
    $('epochSlider').value = state.cursor;
    $('epochLabel').textContent = '公元 ' + (state.cursor * state.history.yearsPerEpoch) + ' 年';
    renderDynamic();
    savePos();
    checkAch();
  }

  function togglePlay() {
    if (state.playing) {
      clearInterval(state.timer); state.playing = false;
      $('btnPlay').textContent = '▶ 播放';
      return;
    }
    state.playing = true;
    $('btnPlay').textContent = '⏸ 暂停';
    if (state.cursor >= state.history.totalEpochs - 1) setCursor(0);
    state.timer = setInterval(function () {
      if (state.cursor >= state.history.totalEpochs - 1) { togglePlay(); return; }
      setCursor(state.cursor + (REDUCED ? 1 : 1));
    }, Math.round(220 / state.speed));
  }

  // ---------- 成就（D5） ----------
  function achDone() {
    try { return JSON.parse(storage.get('lingua-ach') || '[]'); } catch (e) { return []; }
  }
  function achSave(list) { storage.set('lingua-ach', JSON.stringify(list)); }

  function achMet(id) {
    var h = state.history;
    if (id === 'first') return true;
    if (id === 'split') return state.cursor >= 6;
    if (id === 'loan') return h.loans.length > 0 && state.cursor >= h.loans[0].epoch;
    if (id === 'writing') return state.cursor >= (h.writing ? h.writing.epoch : 99);
    if (id === 'branches') return Object.keys(state.visited).length >= h.branches.length;
    if (id === 'collector') return loadGallery().length >= 3;
    if (id === 'creator') return state.opts.extraWords.length > 0;
    if (id === 'scholar') return state.etymCount >= 5;
    return false;
  }

  function checkAch() {
    if (!state.history) return;
    var list = achDone();
    ACH.forEach(function (a) {
      if (list.indexOf(a.id) < 0 && achMet(a.id)) {
        list.push(a.id);
        toast('🏅 成就解锁：「' + a.name + '」——' + a.desc);
      }
    });
    achSave(list);
    renderAchCounter();
    renderAchRow();
  }

  function renderAchCounter() {
    var c = $('achCounter');
    if (!c) return;
    c.textContent = '🏅 ' + achDone().length + '/' + ACH.length;
  }
  function renderAchRow() {
    var row = $('achRow');
    if (!row) return;
    var list = achDone();
    if (!list.length) { row.innerHTML = '<span class="cat">成就：去探索吧——分裂、借词、文字、收藏、创作都在等你。</span>'; return; }
    row.innerHTML = '成就：' + list.map(function (id) {
      var a = ACH.find(function (x) { return x.id === id; });
      return '<span class="g-item" title="' + (a ? a.desc : '') + '">🏅 ' + (a ? a.name : id) + '</span>';
    }).join('');
  }

  // ---------- 馆藏 ----------
  function loadGallery() {
    try { return JSON.parse(storage.get('lingua-gallery') || '[]'); } catch (e) { return []; }
  }
  function saveGallery(list) { storage.set('lingua-gallery', JSON.stringify(list.slice(0, 30))); }

  function renderGallery() {
    var list = loadGallery();
    var el = $('gallery');
    if (!list.length) { el.innerHTML = '<span class="cat">（空）——点击右上角「收藏」保存你的语言</span>'; return; }
    el.innerHTML = '';
    list.forEach(function (item, i) {
      var s = document.createElement('span');
      s.className = 'g-item';
      s.textContent = '「' + item.name + '」·' + item.seed;
      s.title = '点击重新打开';
      s.addEventListener('click', function () { evolveLang(item.name, item.seed); });
      var del = document.createElement('span');
      del.textContent = ' ×';
      del.style.color = '#a03a2a';
      del.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var l = loadGallery(); l.splice(i, 1); saveGallery(l); renderGallery();
      });
      s.appendChild(del);
      el.appendChild(s);
    });
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.add('hidden'); }, 2400);
  }

  // ---------- 交互 ----------
  function renderPresets() {
    var sel = $('presetSel');
    PRESETS.forEach(function (p, i) {
      var o = document.createElement('option');
      o.value = i;
      o.textContent = p.name + ' · ' + p.intro.slice(0, 12) + '…';
      sel.appendChild(o);
    });
  }

  function bind() {
    $('presetSel').addEventListener('change', function () {
      var i = +this.value;
      if (isNaN(i) || !PRESETS[i]) return;
      state.opts = { extraWords: [], ruleScale: 1, grammarScale: 1, extraSplits: [] };
      evolveLang(PRESETS[i].name, PRESETS[i].seed);
      toast('已进入「' + PRESETS[i].name + '」：' + PRESETS[i].intro);
      this.value = '';
    });
    $('btnReevolve').addEventListener('click', function () {
      var seed = Math.floor(Math.random() * 1e9).toString(36) + Date.now().toString(36);
      evolveLang(world.generateName(GW.rng.makeRng(seed)), seed);
      toast('新的种子，新的平行世界');
    });
    $('btnRename').addEventListener('click', function () {
      var n = prompt('给这门语言起个新名字：', state.history.name);
      if (n && n.trim()) evolveLang(n.trim(), state.history.seed);
    });
    $('btnShare').addEventListener('click', function () {
      var url = location.origin + location.pathname + '?lang=' + encodeURIComponent(state.history.name) + '&seed=' + encodeURIComponent(state.history.seed);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { toast('种子链接已复制'); });
      } else { prompt('复制这个种子链接：', url); }
    });
    $('btnExport').addEventListener('click', exportLanguage);
    $('btnWiki').addEventListener('click', exportWiki);
    $('btnCard').addEventListener('click', function () {
      var text = languageCard();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast('🎴 语言名片已复制：' + text.slice(0, 40) + '…'); });
      } else { prompt('复制这份语言名片：', text); }
    });
    $('btnGuide').addEventListener('click', function () { $('intro').classList.remove('hidden'); });
    $('btnIntroOk').addEventListener('click', function () {
      $('intro').classList.add('hidden');
      storage.set('lingua-intro-seen', '1');
    });
    $('achCounter').addEventListener('click', function () { showAchPanel(); });
    $('btnAchClose').addEventListener('click', function () { $('achPanel').classList.add('hidden'); });
    $('btnSave').addEventListener('click', function () {
      var list = loadGallery();
      var dup = list.some(function (x) { return x.name === state.history.name && x.seed === state.history.seed; });
      if (!dup) { list.unshift({ name: state.history.name, seed: state.history.seed, at: Date.now() }); saveGallery(list); }
      renderGallery(); toast('已收藏「' + state.history.name + '」'); checkAch();
    });
    $('btnPlay').addEventListener('click', togglePlay);
    $('epochSlider').addEventListener('input', function () { setCursor(+this.value); });
    $('speedGroup').querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.speed = +b.getAttribute('data-s');
        $('speedGroup').querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
        if (state.playing) { clearInterval(state.timer); togglePlay(); togglePlay(); }
      });
    });
    document.addEventListener('keydown', function (ev) {
      if (/INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)) return;
      if (ev.code === 'Space') { ev.preventDefault(); togglePlay(); }
      else if (ev.code === 'ArrowLeft') { ev.preventDefault(); setCursor(state.cursor - (ev.shiftKey ? 10 : 1)); }
      else if (ev.code === 'ArrowRight') { ev.preventDefault(); setCursor(state.cursor + (ev.shiftKey ? 10 : 1)); }
      else if (ev.key === 'Escape') { $('intro').classList.add('hidden'); $('achPanel').classList.add('hidden'); }
    });
    // 语系树：点选 + 拖拽刮擦
    $('treeCanvas').addEventListener('pointerdown', function (ev) {
      var cv = ev.target;
      var dpr = window.devicePixelRatio || 1;
      var rect = cv.getBoundingClientRect();
      var hit = treeview.hitTest(cv, state.history, state, ev.clientX - rect.left, ev.clientY - rect.top, dpr);
      if (hit.branchId) selectBranch(hit.branchId);
      if (hit.epoch != null) setCursor(hit.epoch);
      state.dragging = true;
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    $('treeCanvas').addEventListener('pointermove', function (ev) {
      var cv = ev.target;
      var dpr = window.devicePixelRatio || 1;
      var rect = cv.getBoundingClientRect();
      var hit = treeview.hitTest(cv, state.history, state, ev.clientX - rect.left, ev.clientY - rect.top, dpr);
      if (!state.dragging && hit.branchId !== state.hovered) { state.hovered = hit.branchId || null; renderTree(); }
      if (state.dragging && hit.epoch != null) setCursor(hit.epoch);
    });
    $('treeCanvas').addEventListener('pointerup', function () { state.dragging = false; });
    $('treeCanvas').addEventListener('pointerleave', function () {
      if (state.hovered) { state.hovered = null; renderTree(); }
    });
    // 空态跳转按钮
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-jump]');
      if (t) setCursor(+t.getAttribute('data-jump'));
    });
    document.querySelectorAll('.tabs button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.tab = btn.getAttribute('data-tab');
        document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('active', b === btn); });
        document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.id === 'tab-' + state.tab); });
        renderTab();
      });
    });
    // 回到顶部
    var tabwrap = document.querySelector('.tabwrap');
    if (tabwrap) {
      tabwrap.addEventListener('scroll', function () {
        $('btnTop').classList.toggle('hidden', tabwrap.scrollTop < 120);
      });
      $('btnTop').addEventListener('click', function () { tabwrap.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); });
    }
    window.addEventListener('resize', function () { if (state.history) { renderTree(); renderLegend(); } });
  }

  function selectBranch(id) {
    if (state.selected !== id) { state.selected = id; state.visited[id] = true; renderAll(); checkAch(); }
  }

  function showAchPanel() {
    var list = achDone();
    var html = '';
    ACH.forEach(function (a) {
      var got = list.indexOf(a.id) >= 0;
      html += '<div class="grammar-card" style="' + (got ? '' : 'opacity:.55') + '"><h4>' + (got ? '🏅' : '🔒') + ' ' + a.name + '</h4><p>' + a.desc + '</p></div>';
    });
    $('achList').innerHTML = html;
    $('achPanel').classList.remove('hidden');
  }

  // ---------- 导出（D4） ----------
  function exportLanguage() {
    var h = state.history;
    var data = {
      name: h.name, seed: h.seed, totalYears: h.totalEpochs * h.yearsPerEpoch,
      sandbox: { extraWords: state.opts.extraWords, ruleScale: state.opts.ruleScale, grammarScale: state.opts.grammarScale, extraSplits: state.opts.extraSplits },
      branches: h.branches.map(function (b) {
        return {
          id: b.id, name: b.name, parentId: b.parentId, bornYear: b.bornEpoch * h.yearsPerEpoch,
          grammar: world.grammarAt(h, b.id, h.totalEpochs - 1),
          words: world.wordsAt(h, b.id, h.totalEpochs - 1)
        };
      }),
      events: h.events.map(function (e) { return { year: e.epoch * h.yearsPerEpoch, type: e.type, name: e.name, detail: e.detail }; }),
      loans: h.loans, writing: h.writing ? h.writing.epoch * h.yearsPerEpoch : null
    };
    download('lingua-' + h.name + '-' + h.seed + '.json', JSON.stringify(data, null, 2), 'application/json');
    toast('已导出《' + h.name + '》的语言档案');
  }

  function exportWiki() {
    var h = state.history;
    var cv = $('treeCanvas');
    var img = '';
    try { img = cv.toDataURL('image/png'); } catch (e) {}
    var year = h.totalEpochs - 1;
    var branchSections = h.branches.map(function (b) {
      var w = world.wordsAt(h, b.id, year);
      var rows = Object.keys(w).sort().map(function (g) {
        return '<tr><td>' + g + '</td><td>' + w[g].word + '</td></tr>';
      }).join('');
      var g = world.grammarAt(h, b.id, year);
      return '<h3>' + b.name + '（公元' + (b.bornEpoch * h.yearsPerEpoch) + '年诞生）</h3>' +
        '<p>语法：' + JSON.stringify(g) + '</p><table><tr><th>词义</th><th>词形</th></tr>' + rows + '</table>';
    }).join('');
    var chrono = h.events.slice().sort(function (a, b) { return a.epoch - b.epoch; }).slice(0, 40).map(function (e) {
      return '<li>公元' + (e.epoch * h.yearsPerEpoch) + '年 · ' + e.name + ' — ' + (e.detail || '') + '</li>';
    }).join('');
    var loans = h.loans.map(function (l) {
      return '<li>公元' + (l.epoch * h.yearsPerEpoch) + '年 · ' + l.note + '：' + l.words.join('、') + '</li>';
    }).join('');
    var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>' + h.name + ' · 语言维基</title>' +
      '<style>body{font-family:serif;max-width:820px;margin:0 auto;padding:24px;color:#3a2c1a;background:#f3ead8}table{border-collapse:collapse;width:100%}td,th{border:1px solid #c9b78a;padding:4px 8px}img{max-width:100%}h1{color:#a03a2a}</style></head><body>' +
      '<h1>' + h.name + '</h1><p>种子：<code>' + h.seed + '</code> · 一千年 · ' + h.branches.length + ' 个分支</p>' +
      (img ? '<img alt="语系树" src="' + img + '">' : '') +
      '<h2>编年史</h2><ul>' + chrono + '</ul>' +
      '<h2>借词史</h2><ul>' + (loans || '<li>无</li>') + '</ul>' +
      '<h2>分支</h2>' + branchSections +
      '</body></html>';
    download('lingua-' + h.name + '-wiki.html', html, 'text/html;charset=utf-8');
    toast('已导出《' + h.name + '》维基页');
  }

  function download(name, content, type) {
    var blob = new Blob([content], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---------- 渲染 ----------
  function renderTab() {
    if (state.tab === 'words') renderWords();
    else if (state.tab === 'cognates') renderCognates();
    else if (state.tab === 'grammar') renderGrammar();
    else if (state.tab === 'events') renderEvents();
    else if (state.tab === 'writing') renderWriting();
    else if (state.tab === 'loan') renderLoan();
    else if (state.tab === 'lyrics') renderLyrics();
    else if (state.tab === 'atlas') renderAtlas();
    else renderSandbox();
  }

  // 增量渲染（C3）：时间轴移动时只更新受影响区域
  function renderDynamic() {
    if (!state.history) return;
    renderTree();
    renderEraChips();
    renderTab();
  }

  function renderAll() {
    if (!state.history) return;
    renderHeader();
    renderTree();
    renderLegend();
    renderEraChips();
    renderTab();
  }

  // ---------- 启动 ----------
  function savePos() {
    try {
      storage.set('lingua-pos', JSON.stringify({
        name: state.history.name, seed: state.history.seed,
        cursor: state.cursor, branch: state.selected
      }));
    } catch (e) {}
  }
  function loadPos() {
    try { return JSON.parse(storage.get('lingua-pos') || 'null'); } catch (e) { return null; }
  }

  function boot() {
    bind();
    renderPresets();
    var p = urlParams();
    var saved = (!p.lang && !p.seed) ? loadPos() : null;
    var name = p.lang || (saved ? saved.name : PRESETS[0].name);
    var seed = p.seed || (saved ? saved.seed : PRESETS[0].seed);
    evolveLang(name, seed);
    if (saved) {
      if (saved.cursor != null) state.cursor = Math.max(0, Math.min(19, saved.cursor));
      if (saved.branch && state.history.branches.some(function (b) { return b.id === saved.branch; })) state.selected = saved.branch;
      state.visited[state.selected] = true;
      $('epochSlider').value = state.cursor;
      renderAll();
    }
    renderGallery();
    checkAch();
    var seen = false;
    try { seen = storage.get('lingua-intro-seen') === '1'; } catch (e) {}
    if (!seen && !p.lang) $('intro').classList.remove('hidden');
  }

  boot();
})();
