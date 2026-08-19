// 墨战 · 天书纪 — 文房四宝装备系统（笔/墨/纸/砚，品质掉落与合成）
(function (g) {
  'use strict';

  const SLOTS = ['pen', 'ink', 'paper', 'stone'];
  const SLOT_CN = { pen: '笔', ink: '墨', paper: '纸', stone: '砚' };
  const SLOT_FLAVOR = {
    pen: ['狼毫笔', '羊毫笔', '紫毫笔', '铁笔', '神笔'],
    ink: ['松烟墨', '徽墨', '金墨', '玉墨', '龙墨'],
    paper: ['宣纸', '毛边纸', '澄心堂纸', '金笺', '天书纸'],
    stone: ['端砚', '歙砚', '洮砚', '红丝砚', '龙尾砚']
  };
  const RARITY = [
    { id: 'white', name: '凡品', mult: 1,   color: '#9aa0a8', w: 55 },
    { id: 'green', name: '良品', mult: 1.4, color: '#3e8e3a', w: 28 },
    { id: 'blue',  name: '珍品', mult: 2,   color: '#2f6fd0', w: 12 },
    { id: 'purple',name: '灵品', mult: 3,   color: '#6b4a8a', w: 4 },
    { id: 'gold',  name: '圣品', mult: 4.5, color: '#b8912e', w: 1 }
  ];
  const RARITY_MAP = Object.fromEntries(RARITY.map(r => [r.id, r]));
  // 每槽位的属性：笔=攻击 墨=暴击 纸=砚血 砚=文气
  const BASE = {
    pen:   { stat: 'power', base: 6 },
    ink:   { stat: 'crit',  base: 0.02 },
    paper: { stat: 'hp',    base: 15 },
    stone: { stat: 'qiMul', base: 0.06 }
  };

  let uid = 1;
  function rollRarity(rng) {
    const r = rng || Math.random;
    const total = RARITY.reduce((s, x) => s + x.w, 0);
    let roll = r() * total;
    for (const rr of RARITY) { roll -= rr.w; if (roll <= 0) return rr; }
    return RARITY[0];
  }

  function makeItem(slot, rarityId, rng) {
    const r = rarityId ? RARITY_MAP[rarityId] : rollRarity(rng);
    const b = BASE[slot];
    const mult = r.mult;
    const flavor = SLOT_FLAVOR[slot][Math.floor((rng || Math.random)() * SLOT_FLAVOR[slot].length)];
    const item = {
      uid: uid++,
      slot,
      rarity: r.id,
      name: r.name + '·' + flavor,
      desc: SLOT_CN[slot] + '类',
      power: slot === 'pen' ? Math.round(b.base * mult) : 0,
      crit: slot === 'ink' ? +(b.base * mult).toFixed(3) : 0,
      hp: slot === 'paper' ? Math.round(b.base * mult) : 0,
      qiMul: slot === 'stone' ? +(b.base * mult).toFixed(3) : 0
    };
    return item;
  }

  // 已装备的加成合计
  function statBonus(equipment) {
    const out = { power: 0, crit: 0, hp: 0, qiMul: 0 };
    for (const slot of SLOTS) {
      const it = equipment[slot];
      if (!it) continue;
      out.power += it.power || 0;
      out.crit += it.crit || 0;
      out.hp += it.hp || 0;
      out.qiMul += it.qiMul || 0;
    }
    return out;
  }

  // 合成：同槽位 3 件 → 高一阶（取最低品阶）
  function craftUpgrade(items, rng) {
    if (items.length < 3) return { ok: false, reason: '至少需要 3 件同槽位装备' };
    const r = rng || Math.random;
    // 按品阶升序排序，取前 3 件
    const sorted = [...items].sort((a, b) => rankOf(a.rarity) - rankOf(b.rarity));
    const three = sorted.slice(0, 3);
    const slot = three[0].slot;
    const next = rankOf(three[0].rarity) + 1;
    if (next >= RARITY.length) return { ok: false, reason: '已是圣品，无法再升' };
    const newItem = makeItem(slot, RARITY[next].id, r);
    return { ok: true, consumed: three.map(x => x.uid), item: newItem };
  }

  function rankOf(rarityId) {
    return RARITY.findIndex(x => x.id === rarityId);
  }

  function statText(it) {
    const parts = [];
    if (it.power) parts.push('笔力 +' + it.power);
    if (it.crit) parts.push('暴击 +' + Math.round(it.crit * 100) + '%');
    if (it.hp) parts.push('砚血 +' + it.hp);
    if (it.qiMul) parts.push('文气 ×' + (1 + it.qiMul).toFixed(2));
    return parts.join('　');
  }

  // 求购价（按品质）
  function priceOf(rarityId) {
    const base = { white: 80, green: 200, blue: 500, purple: 1200, gold: 3000 };
    return base[rarityId] || 80;
  }

  g.INK_EQUIP = { SLOTS, SLOT_CN, RARITY, RARITY_MAP, makeItem, statBonus, craftUpgrade, statText, priceOf, rollRarity };
})(typeof globalThis !== 'undefined' ? globalThis : this);
