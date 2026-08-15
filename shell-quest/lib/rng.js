'use strict';
// mulberry32 —— 轻量、确定性的种子随机数生成器
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed) {
  const rnd = mulberry32(seed);
  return {
    rnd,
    int(min, max) { return min + Math.floor(rnd() * (max - min + 1)); },
    pick(arr) { return arr[Math.floor(rnd() * arr.length)]; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },
    chance(p) { return rnd() < p; }
  };
}

module.exports = { createRng, mulberry32 };
