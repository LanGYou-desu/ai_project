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

  function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }
  function deep(o) { return JSON.parse(JSON.stringify(o)); }

  function pickWeighted(list, rng, scale) {
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
      id: id, name: name, parentId: parentId, bornEpoch: bornEpoch, endEpoch: null,
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
      var applied = [];
      for (var ri = 0; ri < rules.length; ri++) {
        var rule = rules[ri];
        var p = Math.min(1, rule.prob * ruleScale);
        if (rng.chance(p)) {
          var nf = soundsMod.applyRule(form, rule, rng);
          if (nf !== form) { form = nf; applied.push(rule.id); }
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

  function doSplit(parent, sp, rng, branches, events, extraFlavor) {
    var pool = rng.shuffle(NAME_WORDS);
    var gA = pool[0], gB = pool[1];
    var nameA = cap(parent.words[gA]) + '部';
    var nameB = cap(parent.words[gB]) + '部';
    var a = makeBranch(parent.id + '-a', nameA, parent.id, sp.epoch, parent.words, parent.wordLog, parent.grammar, parent.grammarApplied);
    var b = makeBranch(parent.id + '-b', nameB, parent.id, sp.epoch, parent.words, parent.wordLog, parent.grammar, parent.grammarApplied);
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
      branch.words[lw.gloss] = lw.word;
      branch.wordLog[lw.gloss] = [{ epoch: epoch, form: lw.word, rules: [], note: note }];
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
    opts = opts || {};
    var name = opts.name || generateName(rngMod.makeRng(String(opts.seed || 'lingua') + '::name'));
    var seed = opts.seed != null ? String(opts.seed) : 'lingua';
    var rng = rngMod.makeRng(seed + '::' + name);
    var ruleScale = opts.ruleScale != null ? opts.ruleScale : 1;
    var grammarScale = opts.grammarScale != null ? opts.grammarScale : 1;
    var proto = lexiconMod.protoLexicon();

    // 创作台：自定义词根
    (opts.extraWords || []).forEach(function (w) {
      if (w && w.gloss && w.word && !proto[w.gloss]) proto[w.gloss] = { word: w.word, cat: w.cat || 'object' };
    });

    var gram = grammarMod.freshGrammar();
    var plainProto = {};
    for (var pg in proto) plainProto[pg] = proto[pg].word;

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
      (opts.extraSplits || []).forEach(function (es) {
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
      branches: branches, events: events, splits: splits,
      loans: loans, loan: loans[0] || null, loan2: loans[1] || null,
      writing: writing
    };
  }

  // ---- 查询辅助 ----
  function aliveAt(b, epoch) { return b.bornEpoch <= epoch; }

  function wordsAt(history, branchId, epoch) {
    var b = null;
    for (var i = 0; i < history.branches.length; i++) if (history.branches[i].id === branchId) { b = history.branches[i]; break; }
    if (!b || !aliveAt(b, epoch)) return null;
    var out = {};
    for (var g in b.words) {
      var log = b.wordLog[g];
      var form = log[0].form;
      for (var j = log.length - 1; j >= 0; j--) {
        if (log[j].epoch <= epoch) { form = log[j].form; break; }
      }
      out[g] = { word: form, cat: lexiconMod.BY_GLOSS[g] ? lexiconMod.BY_GLOSS[g].cat : 'object' };
    }
    return out;
  }

  function epochWords(history, epoch) {
    var rows = [];
    history.branches.forEach(function (b) {
      if (!aliveAt(b, epoch)) return;
      var w = wordsAt(history, b.id, epoch);
      for (var g in w) rows.push({ branchId: b.id, branchName: b.name, gloss: g, word: w[g].word, cat: w[g].cat });
    });
    return rows;
  }

  function traceEtymology(history, branchId, gloss) {
    var b = null;
    for (var i = 0; i < history.branches.length; i++) if (history.branches[i].id === branchId) { b = history.branches[i]; break; }
    if (!b || !b.wordLog[gloss]) return [];
    var chain = [];
    b.wordLog[gloss].forEach(function (entry) {
      chain.push({
        epoch: entry.epoch,
        year: entry.epoch * history.yearsPerEpoch,
        form: entry.form,
        rules: (entry.rules || []).map(function (rid) { return soundsMod.BY_ID[rid] ? soundsMod.BY_ID[rid].name : rid; }),
        note: entry.note || null
      });
    });
    return chain;
  }

  function grammarAt(history, branchId, epoch) {
    var b = null;
    for (var i = 0; i < history.branches.length; i++) if (history.branches[i].id === branchId) { b = history.branches[i]; break; }
    if (!b) return null;
    var g = b.grammarLog[0].grammar;
    for (var j = b.grammarLog.length - 1; j >= 0; j--) {
      if (b.grammarLog[j].epoch <= epoch) { g = b.grammarLog[j].grammar; break; }
    }
    return deep(g);
  }

  function branchTimeline(history, branchId) {
    var b = null;
    for (var i = 0; i < history.branches.length; i++) if (history.branches[i].id === branchId) { b = history.branches[i]; break; }
    if (!b) return [];
    return b.events.slice().sort(function (x, y) { return x.epoch - y.epoch; });
  }

  function cognates(history, gloss, epoch) {
    var rows = [];
    var protoForm = lexiconMod.BY_GLOSS[gloss] ? lexiconMod.BY_GLOSS[gloss].word : null;
    history.branches.forEach(function (b) {
      if (!aliveAt(b, epoch)) return;
      var w = wordsAt(history, b.id, epoch);
      if (!w || !w[gloss]) return;
      rows.push({ branchId: b.id, branchName: b.name, word: w[gloss].word, bornEpoch: b.bornEpoch });
    });
    return { proto: protoForm, rows: rows };
  }

  function phonemeInventory(words) {
    var cons = new Set(), vowels = new Set();
    for (var g in words) {
      var w = words[g].word;
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
    evolve: evolve, generateName: generateName,
    wordsAt: wordsAt, epochWords: epochWords, traceEtymology: traceEtymology,
    grammarAt: grammarAt, branchTimeline: branchTimeline, aliveAt: aliveAt,
    cognates: cognates, phonemeInventory: phonemeInventory
  };
});
