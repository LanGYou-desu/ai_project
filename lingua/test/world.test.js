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
