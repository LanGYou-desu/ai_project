// LINGUA · 现状核对脚本（E7）：打印关键数值并校验不变量
// 用法：node scripts/verify.js   （等价于 npm run verify）
const lex = require('../js/shared/lexicon.js');
const sounds = require('../js/shared/sounds.js');
const grammar = require('../js/shared/grammar.js');
const glyphs = require('../js/glyphs.js');
const world = require('../js/shared/world.js');

const SEEDS = ['verify', 'test123', 'n4', 'n15', 'abc'];
const histories = SEEDS.map(seed => world.evolve({ name: '雾语', seed }));
const h = histories[0];

function allWordsValid(history) {
  for (let e = 0; e < history.totalEpochs; e++) {
    for (const b of history.branches) {
      const w = world.wordsAt(history, b.id, e);
      if (!w) continue;
      for (const g in w) if (!/^[a-z]+$/.test(w[g].word)) return false;
    }
  }
  return true;
}
function namesUnique(history) {
  const names = history.branches.map(b => b.name);
  const ids = history.branches.map(b => b.id);
  return new Set(names).size === names.length && new Set(ids).size === ids.length;
}
function loansNotPremature(history) {
  return history.loans.every(loan => loan.words.every(g => {
    const before = world.wordsAt(history, loan.branchId, loan.epoch - 1);
    return !before || before[g] === undefined;
  }));
}
function deterministic() {
  return JSON.stringify(world.evolve({ name: '雾语', seed: 'verify' })) === JSON.stringify(h);
}

// 数值型：只展示，不参与通过/失败判定
const numbers = {
  词汇数: Object.keys(lex.protoLexicon()).length,
  语义类别: Object.keys(lex.CATS).length,
  音变规则: sounds.RULES.length,
  语法事件: grammar.EVENTS.length,
  音变图元覆盖: lex.LEXICON.filter(e => glyphs.hasGlyph(e.gloss)).length + '/' + lex.LEXICON.length,
  分支数: h.branches.length,
  分裂次数: h.splits.length,
  借词波次: h.loans.length
};
// 布尔型：必须全部为 true
const checks = {
  词汇表唯一: new Set(lex.LEXICON.map(e => e.gloss)).size === lex.LEXICON.length,
  每个词都有专属字形: lex.LEXICON.every(e => glyphs.hasGlyph(e.gloss)),
  全部音变有现实参照: sounds.RULES.every(r => !!r.real),
  全分支词形合法: histories.every(allWordsValid),
  分支名与分支id唯一: histories.every(namesUnique),
  借词不在借入前出现: histories.every(loansNotPremature),
  同种子完全可复现: deterministic()
};

let fail = 0;
for (const k in numbers) console.log('ℹ️  ' + k + ': ' + numbers[k]);
for (const k in checks) {
  console.log((checks[k] ? '✅' : '❌') + ' ' + k + ': ' + checks[k]);
  if (!checks[k]) fail++;
}
console.log(fail === 0 ? '✅ 现状核对通过（' + SEEDS.length + ' 个种子）' : '❌ 存在 ' + fail + ' 项异常');
process.exit(fail ? 1 : 0);
