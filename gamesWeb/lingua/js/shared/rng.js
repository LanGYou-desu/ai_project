/* LINGUA · 可复现的种子随机数（浏览器 + Node 双端） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LINGUA = root.LINGUA || {}; root.LINGUA.rng = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function hashString(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // mulberry32 PRNG
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seedStr) {
    var base = hashString(String(seedStr));
    var rnd = mulberry32(base);
    return {
      seed: seedStr,
      hash: base,
      next: function () { return rnd(); },
      int: function (lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); },
      chance: function (p) { return rnd() < p; },
      pick: function (arr) { return arr[Math.floor(rnd() * arr.length)]; },
      shuffle: function (arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
          var j = Math.floor(rnd() * (i + 1));
          var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
        return a;
      }
    };
  }

  return { hashString: hashString, mulberry32: mulberry32, makeRng: makeRng };
});
