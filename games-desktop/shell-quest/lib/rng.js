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
    pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  };
}

module.exports = { createRng, mulberry32 };
