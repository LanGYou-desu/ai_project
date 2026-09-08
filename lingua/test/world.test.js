const { test } = require('node:test');
const assert = require('node:assert');
const world = require('../js/shared/world.js');
const lex = require('../js/shared/lexicon.js');

function evolve(name, seed, opts){ return world.evolve(Object.assign({ name, seed }, opts)); }

test('词汇表 124 词且词形唯一', () => {
  const proto = lex.protoLexicon();
  assert.strictEqual(Object.keys(proto).length, 124);
  const seen = new Set();
  Object.values(proto).forEach(v => { assert.ok(!seen.has(v.word)); seen.add(v.word); });
});

test('同名字+种子完全确定', () => {
  assert.deepStrictEqual(evolve('雾语','s1'), evolve('雾语','s1'));
});
test('不同种子产生不同演化', () => {
  assert.notDeepStrictEqual(evolve('雾语','s1'), evolve('雾语','s2'));
});

test('1000 年 = 20 纪元，三次分裂出 7 个分支', () => {
  const h = evolve('雾语','test123');
  assert.strictEqual(h.totalEpochs, 20);
  assert.strictEqual(h.yearsPerEpoch, 50);
  assert.strictEqual(h.branches.length, 7);
  assert.strictEqual(h.splits.length, 3);
  assert.strictEqual(h.splits[0].epoch, 6);
  assert.strictEqual(h.splits[1].epoch, 12);
  assert.strictEqual(h.splits[2].epoch, 16);
});

test('四波借词按时序发生，落点按种子确定', () => {
  const h = evolve('雾语','test123');
  assert.strictEqual(h.loans.length, 4);
  assert.strictEqual(h.loans.map(l => l.note).join(','), '借词,借词·传教士,借词·海商,借词·官府');
  assert.strictEqual(h.loans.map(l => l.epoch).join(','), '8,11,14,15');
  h.loans.forEach(loan => {
    const found = h.branches.some(b => b.wordLog[loan.words[0]] && b.wordLog[loan.words[0]][0].note === loan.note);
    assert.ok(found, loan.note + ' 的借词应出现在某个分支');
  });
  assert.strictEqual(h.loan.epoch, 8);
  assert.strictEqual(h.loan2.epoch, 11);
  // 同种子落点确定
  const h2 = evolve('雾语','test123');
  assert.deepStrictEqual(h.loans, h2.loans);
});

test('不同种子借词落点可能不同', () => {
  let diff = false;
  for (let i = 0; i < 12 && !diff; i++) {
    const a = evolve('雾语', 'loanA' + i).loans.map(l => l.branchId).join(',');
    const b = evolve('雾语', 'loanB' + i).loans.map(l => l.branchId).join(',');
    if (a !== b) diff = true;
  }
  assert.ok(diff, '12 组种子对比中应出现借词落点差异');
});

test('创作台：自定义词根/频率缩放/手动分裂', () => {
  const h = evolve('龙语','sb1', {
    extraWords: [{ gloss: '龙', word: 'draka', cat: 'animal' }],
    ruleScale: 2, grammarScale: 2,
    extraSplits: [{ epoch: 9, branchId: 'root' }]
  });
  assert.ok(world.wordsAt(h, 'root', 19)['龙']);
  assert.strictEqual(h.branches.length, 9); // 7 + 手动分裂 2
  assert.ok(h.splits.some(s => s.manual));
  // 同参数可复现
  assert.deepStrictEqual(h, evolve('龙语','sb1', { extraWords: [{ gloss: '龙', word: 'draka', cat: 'animal' }], ruleScale: 2, grammarScale: 2, extraSplits: [{ epoch: 9, branchId: 'root' }] }));
});

test('文字诞生于纪元 10 且后代继承', () => {
  const h = evolve('雾语','test123');
  assert.strictEqual(h.writing.epoch, 10);
  h.branches.forEach(b => assert.strictEqual(b.writing, 10));
});

test('词源追踪：从原始词一路到现代词，规则有标注', () => {
  const h = evolve('雾语','test123');
  const leaf = h.branches[h.branches.length - 1];
  const chain = world.traceEtymology(h, leaf.id, '水');
  assert.ok(chain.length >= 1);
  assert.strictEqual(chain[0].form, 'woda');
  assert.strictEqual(chain[0].epoch, 0);
  assert.strictEqual(chain[chain.length - 1].form, leaf.words['水']);
  chain.forEach(c => { assert.match(c.form, /^[a-z]+$/); });
});

test('wordsAt 尊重分支出生时间', () => {
  const h = evolve('雾语','test123');
  const leaf = h.branches.find(b => b.id === 'root-a-a');
  assert.strictEqual(world.wordsAt(h, leaf.id, 10), null);
  assert.ok(world.wordsAt(h, leaf.id, 15));
});

test('所有分支在所有存活纪元的词均为合法字母串', () => {
  for (let i = 0; i < 15; i++) {
    const h = evolve('雾语', 'stress' + i);
    for (let e = 0; e < 20; e++) {
      h.branches.forEach(b => {
        const w = world.wordsAt(h, b.id, e);
        if (!w) return;
        Object.values(w).forEach(v => assert.match(v.word, /^[a-z]+$/, b.id + '@' + e + ' ' + v.word));
      });
    }
  }
});

test('同源词对照：同一词义在各分支的分化形态', () => {
  const h = evolve('雾语','test123');
  const cog = world.cognates(h, '水', 19);
  assert.strictEqual(cog.proto, 'woda');
  assert.strictEqual(cog.rows.length, 7);
  assert.ok(cog.rows.every(r => /^[a-z]+$/.test(r.word)));
  const forms = new Set(cog.rows.map(r => r.word));
  assert.ok(forms.size >= 2, '同一词义应产生至少 2 种分化形态');
});

test('音系档案：能从词表推导出音位集合', () => {
  const h = evolve('雾语','test123');
  const w = world.wordsAt(h, 'root', 19);
  const ph = world.phonemeInventory(w);
  assert.ok(ph.consonants.length >= 5);
  assert.ok(ph.vowels.length >= 1 && ph.vowels.length <= 5);
});

test('语法会从默认状态演化出去', () => {
  const h = evolve('雾语','gram');
  const DEFAULT = JSON.stringify(require('../js/shared/grammar.js').DEFAULT);
  let evolved = false;
  h.branches.forEach(b => {
    if (JSON.stringify(world.grammarAt(h, b.id, 19)) !== DEFAULT) evolved = true;
  });
  assert.ok(evolved);
});

// ---------- 借词时序 ----------

test('借词在借入之前不存在于词表与同源词', () => {
  const h = evolve('雾语','test123');
  h.loans.forEach(loan => {
    const br = h.branches.find(b => b.id === loan.branchId);
    loan.words.forEach(g => {
      const before = world.wordsAt(h, br.id, loan.epoch - 1);
      if (before) assert.strictEqual(before[g], undefined, loan.note + ' 的「' + g + '」不应出现在借入之前');
      assert.ok(world.wordsAt(h, br.id, loan.epoch)[g], loan.note + ' 的「' + g + '」应出现在借入当年');
      if (loan.epoch > 0) {
        const cog = world.cognates(h, g, loan.epoch - 1);
        assert.strictEqual(cog.rows.length, 0, '同源词表不应提前收录「' + g + '」');
      }
    });
  });
});

test('借词词义自带类别，自定义词根类别同样生效', () => {
  const h = evolve('雾语','test123', { extraWords: [{ gloss: '龙', word: 'draka', cat: 'animal' }] });
  h.loans.forEach(loan => {
    const w = world.wordsAt(h, loan.branchId, 19);
    loan.words.forEach(g => {
      if (w[g]) assert.ok(require('../js/shared/lexicon.js').CATS[w[g].cat], g + ' 应有合法类别');
    });
  });
  const w = world.wordsAt(h, 'root', 19);
  assert.strictEqual(w['龙'].cat, 'animal');
});

test('借词与本族词同义冲突时保留原有词源链', () => {
  const h = evolve('雾语','test123', { extraWords: [{ gloss: '马', word: 'horsa', cat: 'animal' }] });
  const loan = h.loans.find(l => l.words.indexOf('马') >= 0);
  const br = h.branches.find(b => b.id === loan.branchId);
  const log = br.wordLog['马'];
  assert.strictEqual(log[0].form, 'horsa', '本族词应仍是词源链起点');
  assert.strictEqual(log[0].note, undefined);
  const loanEntry = log.find(e => e.note);
  assert.ok(loanEntry, '应记录借词条目');
  assert.strictEqual(loanEntry.replaced, log[log.indexOf(loanEntry) - 1].form, '应记录被替换掉的本族词形');
});

// ---------- 分支命名与 id ----------

test('分支名与分支 id 唯一（含多次手动分裂）', () => {
  for (let i = 0; i < 120; i++) {
    const h = evolve('雾语', 'uniq' + i);
    const names = h.branches.map(b => b.name);
    assert.strictEqual(new Set(names).size, names.length, '分支名重复: ' + names.join(','));
    const ids = h.branches.map(b => b.id);
    assert.strictEqual(new Set(ids).size, ids.length, '分支 id 重复: ' + ids.join(','));
  }
  const h2 = evolve('龙语','sb2', { extraSplits: [{ epoch: 9, branchId: 'root' }, { epoch: 9, branchId: 'root' }] });
  const ids = h2.branches.map(b => b.id);
  assert.strictEqual(new Set(ids).size, ids.length, '同一年代多次分裂不应产生重复 id');
  assert.strictEqual(h2.branches.length, 11);
});

// ---------- 输入校验 / 极端参数 ----------

test('非法创作台参数被安全裁剪且不抛异常', () => {
  const cases = [
    { extraWords: 'nope' },
    { extraWords: null },
    { extraSplits: 'x' },
    { extraWords: [{ gloss: '龙', word: 'DRAGON', cat: 'nope' }] },
    { ruleScale: 'abc', grammarScale: NaN },
    { ruleScale: -5, grammarScale: 99 },
    { extraWords: [{ gloss: '<img>', word: 'ok' }] },
    { extraWords: [{ gloss: '空', word: '' }] }
  ];
  cases.forEach(opts => {
    const h = evolve('雾语', 'sanitize', opts);
    assert.strictEqual(h.branches.length >= 7, true);
    for (let e = 0; e < 20; e++) {
      h.branches.forEach(b => {
        const w = world.wordsAt(h, b.id, e);
        if (!w) return;
        Object.keys(w).forEach(g => {
          assert.match(g, /^[^<>&"']+$/, '词义不应含危险字符: ' + g);
          assert.match(w[g].word, /^[a-z]+$/, '词形应合法: ' + w[g].word);
        });
      });
    }
  });
  const h = evolve('雾语', 'sanitize', { extraWords: [{ gloss: '龙', word: 'DRAGON' }], ruleScale: 99 });
  assert.ok(world.wordsAt(h, 'root', 19)['龙'], '大小写混写的词形应被规范化后保留');
  assert.strictEqual(h.sandbox.ruleScale, 2, '频率缩放应夹在 0~200%');
  assert.strictEqual(h.sandbox.extraWords.length, 1);
});

test('极端与非法种子不会崩溃且仍然可复现', () => {
  const seeds = [0, '', null, undefined, false, 1e12, 'x'.repeat(500), {}, [], '  ', '中文字符种子'];
  seeds.forEach(seed => {
    const a = world.evolve({ name: '雾语', seed: seed });
    const b = world.evolve({ name: '雾语', seed: seed });
    assert.deepStrictEqual(a, b, '种子 ' + String(seed) + ' 应可复现');
    assert.strictEqual(a.branches.length, 7);
    assert.match(a.seed, /^\S/, '种子应被规范化为非空字符串');
  });
  assert.strictEqual(world.evolve({ name: '雾语', seed: '' }).seed, 'lingua', '空种子应回落到默认种子');
});

test('超量自定义词根/分裂被限制在安全上限内', () => {
  const h = world.evolve({ name: '雾语', seed: 'cap', extraWords: Array.from({ length: 500 }, (_, i) => ({ gloss: 'w' + i, word: 'zala' })), extraSplits: Array.from({ length: 50 }, (_, i) => ({ epoch: 1 + (i % 18), branchId: 'root' })) });
  assert.strictEqual(h.sandbox.extraWords.length, world.MAX_EXTRA_WORDS);
  assert.strictEqual(h.sandbox.extraSplits.length, world.MAX_EXTRA_SPLITS);
  assert.ok(h.branches.length <= 7 + world.MAX_EXTRA_SPLITS * 2);
});

// ---------- 查询辅助 ----------

test('词源追踪可按年代截断，且与 wordsAt 一致', () => {
  const h = evolve('雾语','test123');
  const leaf = h.branches[h.branches.length - 1];
  const full = world.traceEtymology(h, leaf.id, '水');
  assert.strictEqual(full[0].initial, true);
  for (const e of [leaf.bornEpoch, 17, 19]) {
    const cut = world.traceEtymology(h, leaf.id, '水', e);
    assert.ok(cut.length <= full.length);
    assert.ok(cut.every(c => c.epoch <= e));
    assert.strictEqual(cut[cut.length - 1].form, world.wordsAt(h, leaf.id, e)['水'].word);
  }
});

test('phonemeInventory 兼容字符串词表与 {word} 词表', () => {
  const a = world.phonemeInventory({ 水: 'woda', 火: 'agni' });
  const b = world.phonemeInventory({ 水: { word: 'woda', cat: 'nature' }, 火: { word: 'agni', cat: 'nature' } });
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(a.consonants, ['d', 'g', 'n', 'w']);
  assert.deepStrictEqual(a.vowels, ['a', 'i', 'o']);
});

test('未知分支/词义查询安全返回', () => {
  const h = evolve('雾语','test123');
  assert.strictEqual(world.wordsAt(h, '不存在', 10), null);
  assert.strictEqual(world.grammarAt(h, '不存在', 10), null);
  assert.deepStrictEqual(world.branchTimeline(h, '不存在'), []);
  assert.deepStrictEqual(world.traceEtymology(h, 'root', '不存在的词'), []);
  assert.deepStrictEqual(world.cognates(h, '不存在的词', 19).rows, []);
});
