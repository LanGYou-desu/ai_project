/* ECO-ARK · 平衡校准探针（开发用）：node scripts/calibrate.js
 * 打印若干标准场景的种群动态，用于验证洛特卡-沃尔泰拉波动与承载量。
 */
const simMod = require('../js/shared/sim.js');
const spec = require('../js/shared/species.js');

function mk(seed, opts) {
  return simMod.createSim(Object.assign({ seed, w: 60, h: 40, eventChance: 0 }, opts || {}));
}
function runYears(s, n, cb) {
  for (let y = 0; y < n; y++) {
    for (let m = 0; m < 12; m++) s.step();
    if (cb) cb(s.getStats());
  }
}

function scenario(name, seed, setup, yearsN) {
  const s = mk(seed);
  setup(s);
  const rows = [];
  runYears(s, yearsN, st => {
    rows.push('y' + String(st.year).padStart(2) + ' ' + Object.entries(st.counts)
      .map(([id, c]) => id + ':' + c).join(' '));
  });
  console.log('==== ' + name + ' ====');
  rows.forEach(r => console.log(r));
  const last = s.getStats();
  console.log('-> 植物总覆盖: ' + Object.entries(last.plantCov).map(([id, v]) => id + ':' + v.toFixed(0)).join(' '));
  console.log('-> 生物量 ' + last.totalBiomass.toFixed(0) + ' 动物 ' + last.animalsTotal + ' 多样性 ' + last.aliveSpecies);
  console.log('');
}

// 1) 纯草 + 兔：暴涨-崩溃循环
scenario('grass+rabbit (no predator)', 'cal1', s => {
  s.place('grass', 250); s.place('rabbit', 30);
}, 40);

// 2) 草 + 兔 + 狐：LV 波动
scenario('grass+rabbit+fox', 'cal2', s => {
  s.place('grass', 250); s.place('rabbit', 40); s.place('fox', 10);
}, 60);

// 3) 全食物网（昆虫/田鼠/兔 + 蛛/狐/鹰）
scenario('full web', 'cal3', s => {
  s.place('grass', 250); s.place('shrub', 150); s.place('moss', 100);
  s.place('insect', 80); s.place('vole', 40); s.place('rabbit', 35);
  s.place('spider', 15); s.place('fox', 7); s.place('hawk', 8);
}, 50);

// 4) 冰期冲击
scenario('ice age stress', 'cal4', s => {
  s.place('grass', 250); s.place('shrub', 120); s.place('moss', 150);
  s.place('rabbit', 40); s.place('vole', 40); s.place('mammoth', 12);
  s.place('fox', 8); s.place('wolf', 5);
  s.triggerEvent('iceage');
}, 40);
