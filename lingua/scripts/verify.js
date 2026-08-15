// LINGUA · 现状核对脚本（E7）：打印并校验关键数值
const lex = require('../js/shared/lexicon.js');
const sounds = require('../js/shared/sounds.js');
const grammar = require('../js/shared/grammar.js');
const world = require('../js/shared/world.js');
const h = world.evolve({ name: '雾语', seed: 'verify' });
const stats = {
  词汇数: Object.keys(lex.protoLexicon()).length,
  音变规则: sounds.RULES.length,
  语法事件: grammar.EVENTS.length,
  分支数: h.branches.length,
  分裂次数: h.splits.length,
  借词波次: h.loans.length,
  词汇表唯一: new Set(lex.LEXICON.map(e => e.gloss)).size === lex.LEXICON.length,
  全部音变有现实参照: sounds.RULES.every(r => !!r.real),
  全分支词形合法: (() => { for (let e = 0; e < 20; e++) for (const b of h.branches) { const w = world.wordsAt(h, b.id, e); if (w) for (const g in w) if (!/^[a-z]+$/.test(w[g].word)) return false; } return true; })()
};
let fail = 0;
for (const k in stats) {
  const v = stats[k];
  const ok = v === true;
  console.log((ok ? '✅' : '⚠️ ') + ' ' + k + ': ' + v);
  if (v === false) fail++;
}
console.log(fail === 0 ? '✅ 现状核对通过' : '❌ 存在 ' + fail + ' 项异常');
process.exit(fail ? 1 : 0);
