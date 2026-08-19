'use strict';
/* SYNAPSE · 确定性随机数工具（mulberry32 + Box-Muller） */
(function (root) {
  'use strict';
  function createRng(seed) {
    let s = (seed === undefined || seed === null) ? 1 : seed >>> 0;
    if (s === 0) s = 0x9e3779b9;
    return function next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randn(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function randInt(rng, n) { return Math.floor(rng() * n); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  const api = { createRng: createRng, randn: randn, shuffle: shuffle, randInt: randInt, pick: pick };
  root.Synapse = root.Synapse || {};
  root.Synapse.rng = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
