// 墨战 · 天书纪 — 修炼成长（用文气升级四项能力）
(function (g) {
  'use strict';

  const UPGRADES = [
    { id: 'power', name: '笔力', desc: '字诀基础伤害 +6/级', max: 8, baseCost: 50, costMul: 1.6 },
    { id: 'crit', name: '笔锋', desc: '暴击率 +4%/级（初始 5%）', max: 8, baseCost: 60, costMul: 1.7 },
    { id: 'pool', name: '砚池', desc: '最大砚血 +12/级（初始 100）', max: 8, baseCost: 40, costMul: 1.5 },
    { id: 'qi', name: '文心', desc: '文气获取 +10%/级', max: 5, baseCost: 80, costMul: 2.0 },
    { id: 'combo', name: '连墨', desc: '连击窗口 +0.35 秒/级（基础 3.5 秒）', max: 5, baseCost: 70, costMul: 1.8 },
    { id: 'boss', name: '破锐', desc: '对 Boss 伤害 +12%/级', max: 5, baseCost: 90, costMul: 2.2 }
  ];

  function costOf(up, level) {
    return Math.round(up.baseCost * Math.pow(up.costMul, level - 1));
  }

  // state.growth = { qi, levels: {power:1, crit:1, pool:1, qi:1}, spendTotal }
  function canBuy(state, id) {
    const up = UPGRADES.find(u => u.id === id);
    const lv = (state.growth.levels && state.growth.levels[id]) || 1;
    if (lv >= up.max) return false;
    return state.growth.qi >= costOf(up, lv);
  }

  function buy(state, id) {
    const up = UPGRADES.find(u => u.id === id);
    const lv = (state.growth.levels && state.growth.levels[id]) || 1;
    if (lv >= up.max) return { ok: false, reason: '已满级' };
    const c = costOf(up, lv);
    if (state.growth.qi < c) return { ok: false, reason: '文气不足' };
    state.growth.qi -= c;
    state.growth.levels[id] = lv + 1;
    state.growth.spendTotal = (state.growth.spendTotal || 0) + c;
    return { ok: true, cost: c, level: lv + 1 };
  }

  // 当前属性预览
  function statsOf(state) {
    const lv = (id) => (state.growth.levels && state.growth.levels[id]) || 1;
    return {
      power: 16 + (lv('power') - 1) * 6,
      critChance: 0.05 + (lv('crit') - 1) * 0.04,
      maxHp: 100 + (lv('pool') - 1) * 12,
      qiMul: 1 + (lv('qi') - 1) * 0.1,
      comboWindow: 3.5 + (lv('combo') - 1) * 0.35,
      bossMul: 1 + (lv('boss') - 1) * 0.12
    };
  }

  g.INK_GROWTH = { UPGRADES, costOf, canBuy, buy, statsOf };
})(typeof globalThis !== 'undefined' ? globalThis : this);
