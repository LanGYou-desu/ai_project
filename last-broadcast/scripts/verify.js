// LASTBROADCAST · 现状核对脚本（E7）：把 README/设计文档里写的数字和代码里的实际值对一遍
const data = require('../js/shared/data.js');
const scores = require('../js/shared/scores.js');
const engine = require('../js/shared/engine.js');
const g = engine.createGame('verify');
let fail = 0;

// 数值型：只打印，用于和文档核对
const nums = {
  '歌曲数': data.SONGS.length,
  '限定曲数': data.SONGS.filter(s => s.unlockTurn != null).length,
  '隐藏曲数': data.SONGS.filter(s => s.hidden).length,
  '听众数': data.CHARACTERS.length,
  '结局数': Object.keys(data.ENDINGS).length,
  '基础结局数': data.BASE_ENDINGS.length,
  '来电数': data.CALLS.length,
  '点播来电数': data.CALLS.filter(c => c.request).length,
  '双来电回合数': Object.keys(data.CALLS.reduce((m, c) => { m[c.turn] = (m[c.turn] || 0) + 1; return m; }, {}))
    .filter(t => data.CALLS.filter(c => c.turn === +t).length >= 2).length,
  '插曲回合数': data.TURN_INTERLUDES.filter(r => r.some(Boolean)).length,
  '支线数': data.ARCS.length,
  '考据条目数': Object.keys(data.WORLD_NOTES).length,
  '回合数': data.TURNS.length
};
for (const k in nums) console.log('ℹ️  ' + k + ': ' + nums[k]);

// 布尔型：不通过就退出码 1
const checks = {
  '歌名唯一': new Set(data.SONGS.map(s => s.id)).size === data.SONGS.length,
  '听众ID唯一': new Set(data.CHARACTERS.map(c => c.id)).size === data.CHARACTERS.length,
  '每回合 3 个插曲变体': data.TURN_INTERLUDES.every(r => Array.isArray(r) && r.length === 3),
  '点播引用有效': data.CALLS.every(c => !c.request || data.SONGS.some(s => s.id === c.request)),
  '支线角色存在': data.ARCS.every(a => data.CHARACTERS.some(c => c.id === a.char)),
  '全部歌曲有合法曲谱': data.SONGS.every(s => scores.SCORES[s.id] && scores.validScore(scores.SCORES[s.id])),
  '隐藏结局/曲与基础结局分离': !!data.ENDINGS.memorial && data.BASE_ENDINGS.indexOf('memorial') < 0 &&
    data.SONGS.some(s => s.hidden) && data.memorialUnlocked(data.BASE_ENDINGS),
  '初始精力 70': g.djStamina === 70,
  '存档校验可用': engine.isValidState(g) === true && engine.isValidState({}) === false,
  '终局回合只接受最后发言': !!engine.applyAction((() => {
    const s = engine.createGame(); for (let i = 0; i < engine.TURN_COUNT - 1; i++) engine.applyAction(s, { type: 'silence' }); return s;
  })(), { type: 'silence' }).error
};
for (const k in checks) { const v = checks[k]; console.log((v ? '✅' : '⚠️ ') + ' ' + k + ': ' + v); if (!v) fail++; }
console.log(fail === 0 ? '✅ 现状核对通过' : '❌ 存在 ' + fail + ' 项异常');
process.exit(fail ? 1 : 0);
