// LASTBROADCAST · 现状核对脚本（E7）
const data = require('../js/shared/data.js');
const engine = require('../js/shared/engine.js');
const g = engine.createGame('verify');
let fail = 0;
const stats = {
  '歌曲数': data.SONGS.length,
  '听众数': data.CHARACTERS.length,
  '结局数': Object.keys(data.ENDINGS).length,
  '来电数': data.CALLS.length,
  '插曲变体': data.TURN_INTERLUDES.every(r => r.length === 3),
  '支线数': data.ARCS.length,
  '歌名唯一': new Set(data.SONGS.map(s => s.id)).size === data.SONGS.length,
  '听众ID唯一': new Set(data.CHARACTERS.map(c => c.id)).size === data.CHARACTERS.length,
  '点播引用有效': data.CALLS.every(c => !c.request || data.SONGS.some(s => s.id === c.request)),
  '精灵力初始': g.djStamina === 70
};
for (const k in stats) { const v = stats[k]; console.log((v === true ? '✅' : '⚠️ ') + ' ' + k + ': ' + v); if (v === false) fail++; }
console.log(fail === 0 ? '✅ 现状核对通过' : '❌ 存在 ' + fail + ' 项异常');
process.exit(fail ? 1 : 0);
