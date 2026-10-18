/* UNLIT · 无光之城 — 种子随机数（mulberry32）
 * 用于可复现的布局与事件。纯函数，Node 与浏览器通用。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UNLIT_RNG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function create(seed) {
    const rnd = mulberry32(seed);
    return {
      next: rnd,
      range(min, max) { return min + rnd() * (max - min); },
      int(min, max) { return Math.floor(this.range(min, max + 1)); },
      pick(arr) { return arr[Math.floor(rnd() * arr.length)]; },
      shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(rnd() * (i + 1));
          const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      }
    };
  }
  return { create };
});
