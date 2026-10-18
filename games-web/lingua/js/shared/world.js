/* LINGUA · 语言演化引擎：在 1000 年里演化一门虚构语言
   模型：一个原始部落 → 音变/语法演化 → 方言分裂 → 借词 → 文字诞生
   所有随机都由种子驱动，同一名字+种子 100% 可复现。
   创作台支持：自定义词根 extraWords、音变/语法频率缩放、手动分裂 extraSplits。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(
    require('./rng.js'), require('./lexicon.js'), require('./sounds.js'), require('./grammar.js'), require('./worlddata.js'));
  else { root.LINGUA = root.LINGUA || {}; root.LINGUA.world = factory(
    root.LINGUA.rng, root.LINGUA.lexicon, root.LINGUA.sounds, root.LINGUA.grammar, root.LINGUA.worlddata); }
})(typeof self !== 'undefined' ? self : this, function (rngMod, lexiconMod, soundsMod, grammarMod, worlddata) {
  'use strict';

  var TOTAL_EPOCHS = 20;
  var YEARS_PER = 50;
  var SPLITS = worlddata.SPLITS;
  var LOANS = worlddata.LOANS;
  var WRITING_EPOCH = worlddata.WRITING_EPOCH;
  var WRITING_FLAVOR = worlddata.WRITING_FLAVOR;
  var FLAVORS = worlddata.FLAVORS;
  var NAME_WORDS = worlddata.NAME_WORDS;
  var MAX_EXTRA_WORDS = 200;   // 创作台 / 分享链接导入的上限，防止极端参数拖垮演化
  var MAX_EXTRA_SPLITS = 12;

  function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }
  function deep(o) { return JSON.parse(JSON.stringify(o)); }

  // ---- 输入校验（健壮性）：非法种子 / 极端参数 / 被篡改的分享链接一律降级为安全值 ----
  var UNSAFE = /[<>&"'\u0000-\u001f\u007f]/g;
  function safeText(v, max) {
    if (v == null) return '';
    var s;
    try { s = String(v); } catch (e) { return ''; }
    return s.replace(UNSAFE, '').trim().slice(0, max);
  }
  function safeWord(v) {
    if (v == null) return '';
    var s;
    try { s = String(v); } catch (e) { return ''; }
    return s.toLowerCase().replace(/[^a-z]/g, '');
  }
  // 频率缩放：非数值 / NaN / Infinity 回落到默认值，并夹在 0~200%
  function scaleOf(v, def) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    if (!isFinite(n)) return def;
    return Math.max(0, Math.min(2, n));
  }
  function sanitizeWords(list) {
    var out = [];
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length && out.length < MAX_EXTRA_WORDS; i++) {
      var w = list[i];
      if (!w || typeof w !== 'object') continue;
      var gloss = safeText(w.gloss, 24);
      var word = safeWord(w.word);
      if (!gloss || !word) continue;
      var cat = (typeof w.cat === 'string' && lexiconMod.CATS[w.cat]) ? w.cat : 'object';
      out.push({ gloss: gloss, word: word, cat: cat });
    }
    return out;
  }
  function sanitizeSplits(list) {
    var out = [];
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length && out.length < MAX_EXTRA_SPLITS; i++) {
      var s = list[i];
      if (!s || typeof s !== 'object') continue;
      var epoch = Math.round(Number(s.epoch));
      if (!isFinite(epoch)) continue;
      var branchId = safeText(s.branchId, 40);
      if (!branchId) continue;
      out.push({ epoch: Math.max(0, Math.min(TOTAL_EPOCHS - 1, epoch)), branchId: branchId });
    }
    return out;
  }

  function pickWeighted(list, rng) {
    if (!list.length) return null;
    var total = 0;
    list.forEach(function (x) { total += (x.weight != null ? x.weight : 1); });
    var roll = rng.next() * total;
    for (var i = 0; i < list.length; i++) {
      roll -= (list[i].weight != null ? list[i].weight : 1);
      if (roll <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  function makeBranch(id, name, parentId, bornEpoch, words, wordLog, grammar, grammarApplied) {
    return {
      id: id, name: name, parentId: parentId, bornEpoch: bornEpoch,
      grammar: deep(grammar),
      grammarApplied: deep(grammarApplied || {}),
      words: deep(words),
      wordLog: deep(wordLog || {}),
      grammarLog: [{ epoch: bornEpoch, grammar: deep(grammar) }],
      events: [], soundCounts: {}, writing: null
    };
  }

  function initialWordLog(words) {
    var log = {};
    for (var g in words) log[g] = [{ epoch: 0, form: words[g], rules: [] }];
    return log;
  }

  function evolveBranch(b, e, rng, events, ruleScale, grammarScale) {
    var changed = [];
    var n = rng.int(1, 3);
    var rules = soundsMod.pickRules(rng, n, e);
    for (var gi in b.words) {
      var cur = b.words[gi];
      var form = cur;
      var applied = null;
      for (var ri = 0; ri < rules.length; ri++) {
        var rule = rules[ri];
        var p = Math.min(1, rule.prob * ruleScale);
        if (rng.chance(p)) {
          var nf = soundsMod.applyRule(form, rule, rng);
          if (nf !== form) { form = nf; if (!applied) applied = []; applied.push(rule.id); }
        }
      }
      if (form !== cur) {
        b.words[gi] = form;
        b.wordLog[gi].push({ epoch: e, form: form, rules: applied.slice() });
        applied.forEach(function (rid) { b.soundCounts[rid] = (b.soundCounts[rid] || 0) + 1; });
        if (changed.length < 3) changed.push({ gloss: gi, from: cur, to: form, rules: applied });
      }
    }
    if (changed.length) {
      var ex = changed[0];
      var names = ex.rules.map(function (rid) { return soundsMod.BY_ID[rid] ? soundsMod.BY_ID[rid].name : rid; });
      var title = names.join('、');
      b.events.push({ epoch: e, type: 'sound', name: title, flavor: title + '正在发生。',
        detail: '例：' + ex.gloss + ' ' + ex.from + ' → ' + ex.to });
      events.push({ epoch: e, branchId: b.id, type: 'sound', name: title, branchName: b.name,
        detail: '例：' + ex.gloss + ' ' + ex.from + ' → ' + ex.to });
    }
    if (rng.chance(Math.min(1, 0.32 * grammarScale))) {
      var cands = grammarMod.EVENTS.filter(function (ev) {
        return !b.grammarApplied[ev.id] && (ev.epochLo == null || e >= ev.epochLo) && (ev.epochHi == null || e <= ev.epochHi);
      });
      var ev = pickWeighted(cands, rng);
      if (ev) {
        b.grammarApplied[ev.id] = true;
        var desc = ev.apply(b.grammar);
        b.grammarLog.push({ epoch: e, grammar: deep(b.grammar) });
        b.events.push({ epoch: e, type: 'grammar', name: ev.name, flavor: ev.flavor, detail: desc });
        events.push({ epoch: e, branchId: b.id, type: 'grammar', name: ev.name, branchName: b.name, detail: desc });
      }
    }
    if (rng.chance(0.45)) {
      var f = rng.pick(FLAVORS);
      b.events.push({ epoch: e, type: 'flavor', name: '部落轶事', flavor: f, detail: f });
    }
  }

  // 分支 id 必须唯一：创作台里同一分支同一年代可能被分裂多次
  function uniqueId(base, branches) {
    var id = base, k = 1;
    while (branches.some(function (b) { return b.id === id; })) { k++; id = base + '-' + k; }
    return id;
  }

  function doSplit(parent, sp, rng, branches, events, extraFlavor) {
    var used = {};
    branches.forEach(function (b) { used[b.name] = true; });
    var pool = rng.shuffle(NAME_WORDS);
    var cands = [];
    pool.forEach(function (g) {
      if (parent.words[g] != null) cands.push({ gloss: g, base: cap(parent.words[g]) + '部' });
    });
    // 词形趋同会让两个候选重名（甚至与既有分支重名），必须挑出两个不同的名字
    var chosen = [];
    cands.forEach(function (c) {
      if (chosen.length >= 2 || used[c.base]) return;
      used[c.base] = true;
      chosen.push({ gloss: c.gloss, name: c.base });
    });
    if (chosen.length < 2) {  // 候选全部重名时加稳定后缀，保证名字唯一且可复现
      cands.forEach(function (c) {
        if (chosen.length >= 2 || chosen.some(function (x) { return x.gloss === c.gloss; })) return;
        var nm = c.base, k = 1;
        while (used[nm]) nm = c.base + '·' + (k++);
        used[nm] = true;
        chosen.push({ gloss: c.gloss, name: nm });
      });
    }
    while (chosen.length < 2) {  // 极端兜底：候选池为空
      var fb = '新支·' + (branches.length + chosen.length + 1);
      chosen.push({ gloss: pool[chosen.length] || NAME_WORDS[0], name: fb });
    }
    var gA = chosen[0].gloss, nameA = chosen[0].name;
    var gB = chosen[1].gloss, nameB = chosen[1].name;
    var idA = uniqueId(parent.id + '-a', branches);
    var idB = uniqueId(parent.id + '-b', branches);
    var a = makeBranch(idA, nameA, parent.id, sp.epoch, parent.words, parent.wordLog, parent.grammar, parent.grammarApplied);
    var b = makeBranch(idB, nameB, parent.id, sp.epoch, parent.words, parent.wordLog, parent.grammar, parent.grammarApplied);
    a.writing = parent.writing;
    b.writing = parent.writing;
    branches.push(a, b);
    var flavor = extraFlavor || sp.flavor;
    events.push({ epoch: sp.epoch, type: 'split', name: '方言分裂',
      detail: flavor + '「' + parent.name + '」分化为「' + nameA + '」（以"' + gA + '"为名）与「' + nameB + '」（以"' + gB + '"为名）。' });
    return [a, b];
  }

  function doLoan(branch, epoch, words, flavor, note, events) {
    var added = [];
    words.forEach(function (lw) {
      var prev = branch.words[lw.gloss];
      branch.words[lw.gloss] = lw.word;
      var entry = { epoch: epoch, form: lw.word, rules: [], note: note };
      if (prev != null && branch.wordLog[lw.gloss]) {
        // 该词义已被本族词占据：保留原有词源链，再追加借词（而不是抹掉历史）
        entry.replaced = prev;
        branch.wordLog[lw.gloss].push(entry);
      } else {
        branch.wordLog[lw.gloss] = [entry];
      }
      added.push(lw.gloss + '(' + lw.word + ')');
    });
    branch.events.push({ epoch: epoch, type: 'loan', name: '借词涌入',
      flavor: flavor, detail: '「' + branch.name + '」借入：' + added.join('、') });
    events.push({ epoch: epoch, branchId: branch.id, type: 'loan', name: '借词涌入', branchName: branch.name,
      detail: added.join('、') });
  }

  function generateName(rng) {
    var a = rng.pick(['雾', '石', '河', '星', '风', '月', '盐', '铁', '苔', '霜', '鲸', '桦', '潮', '云']);
    var b = rng.pick(['语', '言', '话', '音']);
    return a + b;
  }

  // 主入口
  function evolve(opts) {
    opts = (opts && typeof opts === 'object') ? opts : {};
    var seed = safeText(opts.seed != null ? opts.seed : 'lingua', 48) || 'lingua';
    var name = safeText(opts.name, 32) || generateName(rngMod.makeRng(seed + '::name'));
    var rng = rngMod.makeRng(seed + '::' + name);
    var ruleScale = scaleOf(opts.ruleScale, 1);
    var grammarScale = scaleOf(opts.grammarScale, 1);
    var extraWords = sanitizeWords(opts.extraWords);
    var extraSplits = sanitizeSplits(opts.extraSplits);
    var proto = lexiconMod.protoLexicon();

    // 创作台：自定义词根（同名不覆盖原始词）
    extraWords.forEach(function (w) {
      if (!proto[w.gloss]) proto[w.gloss] = { word: w.word, cat: w.cat };
    });

    var gram = grammarMod.freshGrammar();
    var plainProto = {};
    var cats = {};
    for (var pg in proto) { plainProto[pg] = proto[pg].word; cats[pg] = proto[pg].cat; }
    // 借词的语义类别由词义本身决定，与落点分支无关
    LOANS.forEach(function (l) {
      l.words.forEach(function (lw) { if (!cats[lw.gloss]) cats[lw.gloss] = lw.cat || 'object'; });
    });

    var branches = [];
    var root = makeBranch('root', '原语部（Proto）', null, 0, plainProto, initialWordLog(plainProto), gram, {});
    branches.push(root);

    var events = [];
    var splits = [];
    var loans = [];
    var writing = null;
    var splitKids = [];

    for (var e = 0; e < TOTAL_EPOCHS; e++) {
      // 计划内分裂
      for (var si = 0; si < SPLITS.length; si++) {
        if (SPLITS[si].epoch !== e) continue;
        var target = si === 0 ? root : (si === 1 ? splitKids[0][0] : splitKids[0][1]);
        var kids = doSplit(target, SPLITS[si], rng, branches, events);
        splits.push({ epoch: e, parentId: target.id, children: kids.map(function (k) { return k.id; }), flavor: SPLITS[si].flavor });
        splitKids.push(kids);
      }
      // 创作台：手动分裂
      extraSplits.forEach(function (es) {
        if (es.epoch !== e) return;
        var t = null;
        for (var bi2 = 0; bi2 < branches.length; bi2++) if (branches[bi2].id === es.branchId) t = branches[bi2];
        if (!t) return;
        var flavor = '你在创作台上亲手促成了这次分裂——';
        var k2 = doSplit(t, { epoch: e }, rng, branches, events, flavor);
        splits.push({ epoch: e, parentId: t.id, children: k2.map(function (k) { return k.id; }), flavor: flavor, manual: true });
      });
      // 借词波次（目标分支按种子随机，可复现）
      LOANS.forEach(function (loan) {
        if (loan.epoch !== e) return;
        var cands = [];
        for (var ci = 0; ci < splitKids.length; ci++) {
          for (var cj = 0; cj < splitKids[ci].length; cj++) {
            if (splitKids[ci][cj].bornEpoch <= e) cands.push(splitKids[ci][cj]);
          }
        }
        if (!cands.length) return;
        var target = rng.pick(cands);
        doLoan(target, loan.epoch, loan.words, loan.flavor, loan.note, events);
        loans.push({ epoch: e, branchId: target.id, note: loan.note, flavor: loan.flavor,
          words: loan.words.map(function (w2) { return w2.gloss; }) });
      });
      // 文字
      if (e === WRITING_EPOCH) {
        branches.forEach(function (b) { if (b.bornEpoch <= e) b.writing = e; });
        writing = { epoch: e, flavor: WRITING_FLAVOR };
        events.push({ epoch: e, type: 'writing', name: '文字诞生', detail: WRITING_FLAVOR });
      }
      // 逐分支演化
      var alive = branches.filter(function (b) { return b.bornEpoch <= e; });
      for (var bi = 0; bi < alive.length; bi++) evolveBranch(alive[bi], e, rng, events, ruleScale, grammarScale);
    }

    return {
      name: name, seed: seed,
      totalEpochs: TOTAL_EPOCHS, yearsPerEpoch: YEARS_PER,
      branches: branches, events: events, splits: splits, cats: cats,
      loans: loans, loan: loans[0] || null, loan2: loans[1] || null,
      writing: writing,
      // 实际生效的创作台参数（已校验/裁剪），UI 可据此回显
      sandbox: { extraWords: extraWords, ruleScale: ruleScale, grammarScale: grammarScale, extraSplits: extraSplits }
    };
  }

  // ---- 查询辅助 ----
  function aliveAt(b, epoch) { return b.bornEpoch <= epoch; }

  // 分支 id → 分支对象：history 不变时可复用索引，避免每次查询都线性扫描
  var INDEX_CACHE = typeof WeakMap === 'function' ? new WeakMap() : null;
  function branchById(history, id) {
    if (!history || !history.branches) return null;
    var map = null;
    if (INDEX_CACHE) {
      map = INDEX_CACHE.get(history);
      if (!map) { map = {}; history.branches.forEach(function (b) { map[b.id] = b; }); INDEX_CACHE.set(history, map); }
    } else {
      map = {};
      history.branches.forEach(function (b) { map[b.id] = b; });
    }
    return map[id] || null;
  }

  // 单个词在某一纪元的形式；借词在借入之前不存在 → 返回 null
  function formAt(b, gloss, epoch) {
    var log = b.wordLog ? b.wordLog[gloss] : null;
    if (log && log.length) {
      for (var j = log.length - 1; j >= 0; j--) if (log[j].epoch <= epoch) return log[j].form;
      return null;
    }
    return (b.words && b.words[gloss] != null) ? b.words[gloss] : null;
  }

  function catOf(history, gloss) {
    if (history && history.cats && history.cats[gloss]) return history.cats[gloss];
    return lexiconMod.BY_GLOSS[gloss] ? lexiconMod.BY_GLOSS[gloss].cat : 'object';
  }

  function wordsAt(history, branchId, epoch) {
    var b = branchById(history, branchId);
    if (!b || !aliveAt(b, epoch)) return null;
    var out = {};
    for (var g in b.words) {
      var form = formAt(b, g, epoch);
      if (form == null) continue;   // 该词尚未进入本分支（如借词）
      out[g] = { word: form, cat: catOf(history, g) };
    }
    return out;
  }

  function traceEtymology(history, branchId, gloss, epoch) {
    var b = branchById(history, branchId);
    if (!b || !b.wordLog[gloss]) return [];
    var chain = [];
    b.wordLog[gloss].forEach(function (entry, i) {
      if (epoch != null && entry.epoch > epoch) return;   // 只回溯到游标年代
      chain.push({
        epoch: entry.epoch,
        year: entry.epoch * history.yearsPerEpoch,
        form: entry.form,
        rules: (entry.rules || []).map(function (rid) { return soundsMod.BY_ID[rid] ? soundsMod.BY_ID[rid].name : rid; }),
        note: entry.note || null,
        initial: i === 0,
        replaced: entry.replaced || null
      });
    });
    return chain;
  }

  function grammarAt(history, branchId, epoch) {
    var b = branchById(history, branchId);
    if (!b) return null;
    var g = b.grammarLog[0].grammar;
    for (var j = b.grammarLog.length - 1; j >= 0; j--) {
      if (b.grammarLog[j].epoch <= epoch) { g = b.grammarLog[j].grammar; break; }
    }
    return deep(g);
  }

  function branchTimeline(history, branchId) {
    var b = branchById(history, branchId);
    if (!b) return [];
    return b.events.slice().sort(function (x, y) { return x.epoch - y.epoch; });
  }

  function cognates(history, gloss, epoch) {
    var rows = [];
    var protoForm = lexiconMod.BY_GLOSS[gloss] ? lexiconMod.BY_GLOSS[gloss].word : null;
    history.branches.forEach(function (b) {
      if (!aliveAt(b, epoch)) return;
      var form = formAt(b, gloss, epoch);   // 只查这一个词，不再为每个分支重建整张词表
      if (form == null) return;
      rows.push({ branchId: b.id, branchName: b.name, word: form, bornEpoch: b.bornEpoch });
    });
    return { proto: protoForm, rows: rows };
  }

  // 兼容 {gloss: 'woda'} 与 {gloss: {word, cat}} 两种词表形态
  function phonemeInventory(words) {
    var cons = new Set(), vowels = new Set();
    for (var g in words) {
      var entry = words[g];
      var w = typeof entry === 'string' ? entry : ((entry && entry.word) || '');
      var i = 0;
      while (i < w.length) {
        var two = w.slice(i, i + 2);
        if (two === 'ng' || two === 'ch' || two === 'sh') { cons.add(two); i += 2; continue; }
        var c = w[i];
        if ('aeiou'.indexOf(c) >= 0) vowels.add(c); else cons.add(c);
        i++;
      }
    }
    return { consonants: Array.from(cons).sort(), vowels: Array.from(vowels).sort() };
  }

  return {
    TOTAL_EPOCHS: TOTAL_EPOCHS, YEARS_PER: YEARS_PER,
    MAX_EXTRA_WORDS: MAX_EXTRA_WORDS, MAX_EXTRA_SPLITS: MAX_EXTRA_SPLITS,
    evolve: evolve, generateName: generateName,
    wordsAt: wordsAt, traceEtymology: traceEtymology,
    grammarAt: grammarAt, branchTimeline: branchTimeline, aliveAt: aliveAt,
    cognates: cognates, phonemeInventory: phonemeInventory
  };
});
