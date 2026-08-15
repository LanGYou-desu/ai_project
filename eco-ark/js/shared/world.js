/* ECO-ARK · 世界生成：地形 / 水分 / 养分（浏览器 + Node 双端 UMD） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else { root.ECOARK = root.ECOARK || {}; root.ECOARK.world = factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var SPEC = (typeof module === 'object' && module.exports)
    ? require('./species.js') : root.ECOARK.species;
  var RNG = (typeof module === 'object' && module.exports)
    ? require('./rng.js') : root.ECOARK.rng;

  var T = SPEC.TERRAIN;

  function create(seed, w, h) {
    w = w || 84; h = h || 54;
    var rng = RNG.makeRng(String(seed) + ':world');
    var terrain = new Uint8Array(w * h);
    terrain.fill(T.GRASS);

    var idx = function (x, y) { return y * w + x; };
    var inB = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h; };

    // 圆形团块涂色
    function blob(cx, cy, r, code) {
      var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
      var y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
      for (var y = y0; y <= y1; y++) {
        for (var x = x0; x <= x1; x++) {
          var dx = x - cx, dy = y - cy;
          var rr = r + rng.range(-0.4, 0.4);
          if (dx * dx + dy * dy <= rr * rr) terrain[idx(x, y)] = code;
        }
      }
    }

    // 1) 水域：若干湖泊 + 一条蜿蜒河流
    var lakes = rng.int(4, 7);
    for (var i = 0; i < lakes; i++) {
      blob(rng.range(0, w - 1), rng.range(0, h - 1), rng.range(2.5, 6), T.WATER);
    }
    // 河流：随机游走
    var rx = rng.int(0, w - 1), ry = rng.int(0, h - 1);
    var steps = rng.int(30, 60);
    for (var s = 0; s < steps; s++) {
      if (inB(rx, ry)) terrain[idx(rx, ry)] = T.WATER;
      rx += rng.int(-1, 1); ry += rng.int(-1, 1);
      rx = Math.max(0, Math.min(w - 1, rx)); ry = Math.max(0, Math.min(h - 1, ry));
    }

    // 2) 岩地与沙丘
    var rocks = rng.int(5, 9);
    for (var r2 = 0; r2 < rocks; r2++) {
      blob(rng.range(0, w - 1), rng.range(0, h - 1), rng.range(1.5, 4), T.ROCK);
    }
    var deserts = rng.int(2, 4);
    for (var d = 0; d < deserts; d++) {
      blob(rng.range(0, w - 1), rng.range(0, h - 1), rng.range(2, 5), T.SAND);
    }

    // 3) 林地：草地上的森林团块
    var forests = rng.int(7, 12);
    for (var f = 0; f < forests; f++) {
      var fx = rng.range(0, w - 1), fy = rng.range(0, h - 1);
      blob(fx, fy, rng.range(2.5, 6), T.FOREST);
    }

    // 4) 湿地：紧邻水域的草地/沙地变为湿地
    var marshSet = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (terrain[idx(x, y)] !== T.WATER) continue;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            var nx = x + dx, ny = y + dy;
            if (!inB(nx, ny)) continue;
            var t = terrain[idx(nx, ny)];
            if ((t === T.GRASS || t === T.SAND) && rng.chance(0.55)) {
              terrain[idx(nx, ny)] = T.MARSH; marshSet[idx(nx, ny)] = 1;
            }
          }
        }
      }
    }

    // 5) 水岸沙滩：紧邻水的非湿地边缘
    for (var y2 = 0; y2 < h; y2++) {
      for (var x2 = 0; x2 < w; x2++) {
        if (terrain[idx(x2, y2)] !== T.WATER) continue;
        for (var dy2 = -1; dy2 <= 1; dy2++) {
          for (var dx2 = -1; dx2 <= 1; dx2++) {
            if (dx2 === 0 && dy2 === 0) continue;
            var nx2 = x2 + dx2, ny2 = y2 + dy2;
            if (!inB(nx2, ny2)) continue;
            if (terrain[idx(nx2, ny2)] === T.GRASS && rng.chance(0.25)) {
              terrain[idx(nx2, ny2)] = T.SAND;
            }
          }
        }
      }
    }

    // 6) 到水域的距离（BFS），用于水分
    var waterDist = new Float32Array(w * h);
    waterDist.fill(99);
    var queue = [];
    for (var q = 0; q < w * h; q++) {
      if (terrain[q] === T.WATER) { waterDist[q] = 0; queue.push(q); }
    }
    var head = 0;
    while (head < queue.length) {
      var cur = queue[head++];
      var cx2 = cur % w, cy2 = (cur / w) | 0;
      var nd = waterDist[cur] + 1;
      for (var i = -1; i <= 1; i++) {
        for (var j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue;
          var ax = cx2 + i, ay = cy2 + j;
          if (!inB(ax, ay)) continue;
          var ai = idx(ax, ay);
          if (nd < waterDist[ai]) { waterDist[ai] = nd; queue.push(ai); }
        }
      }
    }

    // 7) 初始水分与养分
    var moisture = new Float32Array(w * h);
    var nutrients = new Float32Array(w * h);
    for (var m = 0; m < w * h; m++) {
      var dist = Math.min(waterDist[m], 12);
      var base = 0.52 + 0.30 * Math.max(0, 1 - dist / 6);
      var nv = 0.5 + rng.range(-0.15, 0.15);
      if (terrain[m] === T.WATER) { base = 1; nv = 0.35; }
      if (terrain[m] === T.SAND) { base *= 0.45; nv *= 0.6; }
      if (terrain[m] === T.ROCK) { base *= 0.5; nv *= 0.4; }
      if (terrain[m] === T.MARSH) { base = Math.max(base, 0.75); nv *= 1.2; }
      moisture[m] = Math.max(0, Math.min(1, base + (terrain[m] === T.WATER ? 0 : rng.range(-0.06, 0.06))));
      nutrients[m] = Math.max(0.05, Math.min(1, nv));
    }

    return {
      w: w, h: h, seed: seed,
      terrain: terrain, waterDist: waterDist, moisture: moisture, nutrients: nutrients,
      idx: function (x, y) { return y * w + x; },
      inB: function (x, y) { return x >= 0 && y >= 0 && x < w && y < h; }
    };
  }

  function terrainStats(world) {
    var counts = {};
    var n = world.w * world.h;
    for (var i = 0; i < n; i++) {
      var t = world.terrain[i];
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }

  return { create: create, terrainStats: terrainStats };
});
