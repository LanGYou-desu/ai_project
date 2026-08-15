/* ECO-ARK · 培养皿画布渲染（地形 / 植被 / 动物 / 季节 / 事件特效） */
(function () {
  'use strict';
  var SPEC = window.ECOARK.species;
  var canvas, ctx, cw, ch;
  var tile = 8;
  var hover = null;

  var TERRAIN_PALETTE = [
    '#4e7c3f', // 草地
    '#2c5a31', // 林地
    '#2a6ea5', // 水域
    '#c2a86e', // 沙地
    '#6e7078', // 岩地
    '#3f6a4e'  // 湿地
  ];

  function init(c) {
    canvas = c;
    ctx = c.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    var parent = canvas.parentElement;
    if (!parent) return;
    cw = parent.clientWidth;
    ch = parent.clientHeight;
    canvas.width = cw;
    canvas.height = ch;
  }

  function fitScale(sim) {
    var sx = cw / sim.w, sy = ch / sim.h;
    return Math.max(4, Math.min(sx, sy, 14));
  }

  function tileX(sim, x) {
    var s = fitScale(sim);
    return (cw - sim.w * s) / 2 + x * s;
  }
  function tileY(sim, y) {
    var s = fitScale(sim);
    return (ch - sim.h * s) / 2 + y * s;
  }

  function hash2(x, y) {
    var h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >> 13)) * 1274126177 | 0;
    return ((h & 0x7fffffff) / 0x7fffffff);
  }

  function render(sim, opts) {
    if (!ctx) return;
    opts = opts || {};
    var s = fitScale(sim);
    var offX = (cw - sim.w * s) / 2, offY = (ch - sim.h * s) / 2;
    var NP = SPEC.PLANTS.length;
    var idx = function (x, y) { return y * sim.w + x; };

    ctx.fillStyle = '#0b1210';
    ctx.fillRect(0, 0, cw, ch);

    // 地形 + 植被
    var st = sim.getStats();
    var temp = st.temp;
    var tiles = sim.w * sim.h;
    for (var i = 0; i < tiles; i++) {
      var x = i % sim.w, y = (i / sim.w) | 0;
      var t = sim.terrain[i];
      var px = offX + x * s, py = offY + y * s;
      var base = TERRAIN_PALETTE[t];
      var n = hash2(x, y);
      // 纹理微差
      ctx.fillStyle = shade(base, (n - 0.5) * 14);
      ctx.fillRect(px, py, s + 0.5, s + 0.5);

      // 植被叠加
      var totalCov = 0, domColor = null, domCov = 0;
      for (var sp2 = 0; sp2 < NP; sp2++) {
        var cov = sim.coverage[i * NP + sp2];
        if (cov <= 0.005) continue;
        totalCov += cov;
        if (cov > domCov) { domCov = cov; domColor = SPEC.PLANTS[sp2].color; }
      }
      if (totalCov > 0.01 && domColor) {
        ctx.fillStyle = domColor;
        ctx.globalAlpha = Math.min(0.85, totalCov * 0.85);
        ctx.fillRect(px, py, s + 0.5, s + 0.5);
        ctx.globalAlpha = 1;
      }
      // 尸体
      var carc = sim.carcass[i];
      if (carc > 0.02) {
        ctx.fillStyle = '#5a4530';
        ctx.globalAlpha = Math.min(0.7, carc * 0.8);
        ctx.fillRect(px + s * 0.25, py + s * 0.3, s * 0.5, s * 0.45);
        ctx.globalAlpha = 1;
      }
      // 高养分暖光
      if (sim.nutrients[i] > 0.8) {
        ctx.fillStyle = '#e8c76a';
        ctx.globalAlpha = (sim.nutrients[i] - 0.8) * 0.25;
        ctx.fillRect(px, py, s, s);
        ctx.globalAlpha = 1;
      }
      // 水分低 → 干裂感
      if (t !== 2 && sim.moisture[i] < 0.22) {
        ctx.fillStyle = '#3a2c1c';
        ctx.globalAlpha = 0.25;
        ctx.fillRect(px + s * 0.15, py + s * 0.2, s * 0.2, s * 0.15);
        ctx.fillRect(px + s * 0.55, py + s * 0.55, s * 0.25, s * 0.2);
        ctx.globalAlpha = 1;
      }
    }

    // 冬季霜冻覆盖
    if (temp < 6) {
      ctx.fillStyle = '#cfe4ff';
      ctx.globalAlpha = Math.min(0.4, (6 - temp) * 0.05);
      ctx.fillRect(0, 0, cw, ch);
      ctx.globalAlpha = 1;
    }

    // 动物
    var anims = sim.animals;
    for (var a = 0; a < anims.length; a++) {
      var an = anims[a];
      if (an.dead) continue;
      var sp = SPEC.byId(an.sp);
      if (!sp) continue;
      var ax = offX + an.x * s, ay = offY + an.y * s;
      var r = Math.max(1.6, Math.sqrt(sp.M) * 1.5);
      ctx.beginPath();
      ctx.arc(ax, ay, r, 0, Math.PI * 2);
      ctx.fillStyle = sp.color;
      ctx.fill();
      if (sp.type === 'predator') {
        ctx.strokeStyle = '#101418';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 选中格高亮 / 画笔预览
    if (opts.hoverTile) {
      var hx = opts.hoverTile.x, hy = opts.hoverTile.y;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(tileX(sim, hx) - 0.5, tileY(sim, hy) - 0.5, s + 1, s + 1);
    }
    if (opts.brush && opts.brush.pos) {
      var bx = offX + opts.brush.pos.x * s, by = offY + opts.brush.pos.y * s;
      ctx.strokeStyle = opts.brush.color || '#ffffff';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(bx, by, s * (opts.brush.radius || 1.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    var b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function pick(sim, clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var mx = clientX - rect.left, my = clientY - rect.top;
    var s = fitScale(sim);
    var offX = (cw - sim.w * s) / 2, offY = (ch - sim.h * s) / 2;
    var tx = Math.floor((mx - offX) / s), ty = Math.floor((my - offY) / s);
    if (tx < 0 || ty < 0 || tx >= sim.w || ty >= sim.h) return null;
    return { x: tx, y: ty };
  }

  function tileInfo(sim, tx, ty) {
    var i = ty * sim.w + tx;
    var t = sim.terrain[i];
    var covs = [];
    for (var s2 = 0; s2 < SPEC.PLANTS.length; s2++) {
      var cv = sim.coverage[i * SPEC.PLANTS.length + s2];
      if (cv > 0.01) covs.push(SPEC.PLANTS[s2].name + ' ' + (cv * 100).toFixed(0) + '%');
    }
    var animals = [];
    for (var a = 0; a < sim.animals.length; a++) {
      var an = sim.animals[a];
      if (an.dead) continue;
      if (Math.floor(an.x) === tx && Math.floor(an.y) === ty) {
        var sp = SPEC.byId(an.sp);
        if (sp) animals.push(sp.emoji + sp.name);
      }
    }
    return {
      terrain: SPEC.TERRAIN_NAMES[t],
      moisture: sim.moisture[i], nutrients: sim.nutrients[i],
      carcass: sim.carcass[i], plants: covs, animals: animals
    };
  }

  window.ECOARK = window.ECOARK || {};
  window.ECOARK.view = { init: init, render: render, pick: pick, tileInfo: tileInfo };
})();
