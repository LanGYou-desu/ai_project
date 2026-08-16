/* UNLIT · 无光之城 — 人民币触觉识别数据（教育向简化）
 * 硬币：大小/边缘锯齿/声音；纸币：尺寸 + 盲文面额标记（教学化呈现）。
 * 注：不同版本人民币细节不同，游戏数据为教学化抽象，知识卡中有说明。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UNLIT_MONEY = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // 金额单位：分
  const COINS = [
    { name: '1元', value: 100, size: '大', edge: '锯齿', sound: '低沉敦实', dots: [] },
    { name: '5角', value: 50, size: '中', edge: '光滑', sound: '清脆', dots: [] },
    { name: '1角', value: 10, size: '小', edge: '光滑', sound: '轻细', dots: [] }
  ];
  const BILLS = [
    { name: '10元', value: 1000, size: '最大', brailleDots: 2, hint: '左下角两粒凸点' },
    { name: '5元', value: 500, size: '中', brailleDots: 1, hint: '左下角一粒凸点' },
    { name: '1元', value: 100, size: '小', brailleDots: 1, hint: '最小的一张，角上一粒凸点' }
  ];
  function wallet() {
    const out = [];
    const add = (tpl, prefix, n) => { for (let i = 0; i < n; i++) out.push({ ...tpl, id: prefix + i }); };
    add(BILLS[0], 't', 2); // 2×10元
    add(BILLS[1], 'f', 1); // 1×5元
    add(COINS[0], 'o', 5); // 5×1元硬币
    add(COINS[1], 'h', 2); // 2×5角
    add(COINS[2], 'p', 5); // 5×1角
    return out; // 合计 31.5 元
  }
  function total(items) { return items.reduce((s, i) => s + i.value, 0); }
  function pay(items, price) {
    const given = total(items);
    if (given < price) return { ok: false, short: price - given, change: 0 };
    return { ok: true, change: given - price };
  }
  return { COINS, BILLS, wallet, total, pay };
});
