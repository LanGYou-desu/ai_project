/* ECO-ARK · 培养皿画布渲染（地形 / 植被 / 动物 / 季节 / 事件特效） */
(function () {
  'use strict';
  var SPEC = window.ECOARK.species;
  var canvas, ctx, cw, ch, dpr = 1;

  var TERRAIN_PALETTE = [
    '#4e7c3f', // 草地
    '#2c5a31', // 林地
    '#2a6ea5', // 水域
    '#c2a86e', // 沙地
    '#6e7078', // 岩地
    '#3f6a4e'  // 湿地
  ];
  // 地形微差配色查表（每帧逐格构造 'rgb(...)' 字符串是纯浪费）
  var SHADE_LEVELS = 17;
  var shadeTable = null;
  var benchDots = null;
  var lastSize = '';

  function buildShadeTable() {
    shadeTable = [];
    for (var t = 0; t < TERRAIN_PALETTE.length; t++) {
      var row = [];
      for (var i = 0; i < SHADE_LEVELS; i++) {
        row.push(shade(TERRAIN_PALETTE[t], (i / (SHADE_LEVELS - 1) - 0.5) * 14));
      }
      shadeTable.push(row);
    }
  }

  // 返回 false 表示 Canvas 2D 不可用，主控制器据此降级
  function init(c) {
    if (!c) return false;
    var context = c.getContext ? c.getContext('2d') : null;
    if (!context) return false;
    canvas = c;
    ctx = context;
    if (!shadeTable) buildShadeTable();
    resize();
    window.addEventListener('resize', resize);
    return true;
  }

  function resize() {
    if (!canvas) return;
    var parent = canvas.parentElement;
    var rect = parent ? parent.getBoundingClientRect() : null;
    cw = Math.max(1, Math.round((rect && rect.width) || canvas.width || 800));
    ch = Math.max(1, Math.round((rect && rect.height) || canvas.height || 600));
    dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    if (ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!benchDots || lastSize !== cw + 'x' + ch) {
      benchDots = [];
      var n = Math.min(160, Math.round(cw * ch / 9000));
      for (var i = 0; i < n; i++) {
        benchDots.push({
          x: (i * 97.31 + 13) % cw,
          y: (i * 43.77 + 29) % ch,
          r: 0.5 + ((i * 17) % 10) / 10,
          a: 0.03 + ((i * 31) % 10) / 100
        });
      }
      lastSize = cw + 'x' + ch;
    }
  }

  function fitScale(sim) {
    var sx = cw / sim.w, sy = ch / sim.h;
    return Math.max(4, Math.min(sx, sy, 14));
  }

  function dishRect(sim) {
    var s = fitScale(sim);
    var w = sim.w * s, h = sim.h * s;
    return { x: (cw - w) / 2, y: (ch - h) / 2, w: w, h: h, s: s };
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

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 实验室台面：深色噪点 + 柔和光晕，避免画布两侧出现死黑边
  function drawBench(now) {
    var g = ctx.createRadialGradient(cw * 0.5, ch * 0.42, 20, cw * 0.5, ch * 0.5, Math.max(cw, ch) * 0.72);
    g.addColorStop(0, '#12231b');
    g.addColorStop(0.55, '#0a1511');
    g.addColorStop(1, '#050a08');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
    if (benchDots) {
      for (var i = 0; i < benchDots.length; i++) {
        var d = benchDots[i];
        ctx.fillStyle = 'rgba(140, 200, 150, ' + d.a + ')';
        ctx.fillRect(d.x, d.y, d.r, d.r);
      }
    }
    // 台面细网格
    ctx.strokeStyle = 'rgba(90, 160, 110, 0.055)';
    ctx.lineWidth = 1;
    var step = 44;
    for (var x = (cw % step) / 2; x < cw; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
    }
    for (var y = (ch % step) / 2; y < ch; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
    }
  }

  function render(sim, opts) {
    if (!ctx || !canvas) return;
    opts = opts || {};
    var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    var s = fitScale(sim);
    var box = dishRect(sim);
    var offX = box.x, offY = box.y;
    var NP = SPEC.PLANTS.length;

    drawBench(now);

    // 培养皿外阴影
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#08120e';
    roundRect(offX - 7, offY - 7, box.w + 14, box.h + 14, 16);
    ctx.fill();
    ctx.restore();

    // 皿内底
    ctx.save();
    roundRect(offX - 3, offY - 3, box.w + 6, box.h + 6, 13);
    ctx.clip();
    ctx.fillStyle = '#0a1510';
    ctx.fillRect(offX - 3, offY - 3, box.w + 6, box.h + 6);

    // 地形 + 植被
    var st = sim.getStats();
    var temp = st.temp;
    var tiles = sim.w * sim.h;
    for (var i = 0; i < tiles; i++) {
      var x = i % sim.w, y = (i / sim.w) | 0;
      var t = sim.terrain[i];
      var px = offX + x * s, py = offY + y * s;
      // 纹理微差：量化到 17 级后查表，避免每格每帧拼接颜色字符串
      var n = hash2(x, y);
      var lvl = (n * (SHADE_LEVELS - 1)) | 0;
      ctx.fillStyle = shadeTable[t] ? shadeTable[t][lvl] : '#000000';
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
        // 高密度植被加一点手绘叶簇，让培养皿不只是一块色斑
        if (s >= 6 && totalCov > 0.35) {
          var seed = hash2(x * 7 + 3, y * 11 + 5);
          ctx.fillStyle = 'rgba(10, 30, 18, 0.28)';
          ctx.fillRect(px + s * (0.18 + seed * 0.5), py + s * (0.25 + seed * 0.4), Math.max(1, s * 0.18), Math.max(1, s * 0.18));
        }
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

    // 水面波光：缓慢移动的高光带
    var shimmer = Math.sin(now * 0.0012) * 0.5 + 0.5;
    ctx.globalAlpha = 0.06 + shimmer * 0.05;
    ctx.fillStyle = '#9fe9ff';
    for (var wi = 0; wi < tiles; wi++) {
      if (sim.terrain[wi] !== SPEC.TERRAIN.WATER) continue;
      var wx = wi % sim.w, wy = (wi / sim.w) | 0;
      if (hash2(wx + ((now / 900) | 0), wy) > 0.7) {
        ctx.fillRect(offX + wx * s + s * 0.15, offY + wy * s + s * 0.4, s * 0.7, Math.max(1, s * 0.12));
      }
    }
    ctx.globalAlpha = 1;

    // 冬季霜冻覆盖
    if (temp < 6) {
      ctx.fillStyle = '#cfe4ff';
      ctx.globalAlpha = Math.min(0.4, (6 - temp) * 0.05);
      ctx.fillRect(offX, offY, box.w, box.h);
      ctx.globalAlpha = 1;
    }

    // 动物：小体型用圆点，大体型用 emoji 剪影
    var anims = sim.animals;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var a = 0; a < anims.length; a++) {
      var an = anims[a];
      if (an.dead) continue;
      var sp = SPEC.byId(an.sp);
      if (!sp) continue;
      var ax = offX + an.x * s, ay = offY + an.y * s;
      var size = Math.max(1.6, Math.sqrt(sp.M) * 1.5);
      if (sp.M >= 0.8 && s >= 4) {
        var fs = Math.max(10, Math.min(24, s * 1.7 + Math.sqrt(sp.M) * 1.2));
        ctx.font = fs + 'px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#06100a';
        ctx.fillText(sp.emoji, ax + 1, ay + 1.5);
        ctx.globalAlpha = 1;
        ctx.fillText(sp.emoji, ax, ay);
      } else {
        ctx.beginPath();
        ctx.arc(ax, ay, size, 0, Math.PI * 2);
        ctx.fillStyle = sp.color;
        ctx.fill();
        if (sp.type === 'predator') {
          ctx.strokeStyle = '#101418';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // 天气粒子
    if (st.rain > 0.55) {
      ctx.strokeStyle = 'rgba(150, 200, 235, 0.32)';
      ctx.lineWidth = 1;
      for (var r = 0; r < 34; r++) {
        var rx = offX + ((r * 137 + now * 0.13) % box.w);
        var ry = offY + ((r * 71 + now * 0.38) % box.h);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 2, ry + 7);
        ctx.stroke();
      }
    } else if (temp < 2) {
      ctx.fillStyle = 'rgba(220, 240, 255, 0.55)';
      for (var sn = 0; sn < 28; sn++) {
        var sx = offX + ((sn * 113 + now * 0.03) % box.w);
        var sy = offY + ((sn * 61 + now * 0.07) % box.h);
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
    } else if (temp > 35 && st.rain < 0.2) {
      ctx.fillStyle = 'rgba(210, 180, 120, 0.12)';
      for (var du = 0; du < 16; du++) {
        var dx = offX + ((du * 151 + now * 0.06) % box.w);
        var dy = offY + ((du * 89 + now * 0.14) % box.h);
        ctx.fillRect(dx, dy, 2, 2);
      }
    }

    // 培养皿玻璃边与高光
    ctx.restore();
    roundRect(offX - 3, offY - 3, box.w + 6, box.h + 6, 13);
    ctx.strokeStyle = 'rgba(140, 210, 160, 0.38)';
    ctx.lineWidth = 2;
    ctx.stroke();
    roundRect(offX - 1, offY - 1, box.w + 2, box.h + 2, 11);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 四角刻度
    ctx.strokeStyle = 'rgba(170, 230, 180, 0.35)';
    ctx.lineWidth = 1.5;
    var cm = 9;
    [[offX - 3, offY - 3, 1, 1], [offX + box.w + 3, offY - 3, -1, 1], [offX - 3, offY + box.h + 3, 1, -1], [offX + box.w + 3, offY + box.h + 3, -1, -1]].forEach(function (c) {
      ctx.beginPath();
      ctx.moveTo(c[0] + c[2] * cm, c[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.lineTo(c[0], c[1] + c[3] * cm);
      ctx.stroke();
    });

    // 选中格高亮 / 画笔预览
    if (opts.hoverTile) {
      var hx = opts.hoverTile.x, hy = opts.hoverTile.y;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(tileX(sim, hx) - 0.5, tileY(sim, hy) - 0.5, s + 1, s + 1);
    }
    if (opts.brush && opts.brush.pos) {
      var bx = offX + opts.brush.pos.x * s + s / 2;
      var by = offY + opts.brush.pos.y * s + s / 2;
      var brad = s * (opts.brush.radius || 1.5);
      ctx.strokeStyle = opts.brush.color || '#ffffff';
      ctx.fillStyle = opts.brush.color || '#ffffff';
      ctx.globalAlpha = 0.10;
      ctx.beginPath();
      ctx.arc(bx, by, brad, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(bx, by, brad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 皿内暗角，聚焦中心
    var vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(box.w, box.h) * 0.28, cw / 2, ch / 2, Math.max(box.w, box.h) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = vg;
    ctx.fillRect(offX - 3, offY - 3, box.w + 6, box.h + 6);

    // 角落标签
    ctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(160, 210, 170, 0.55)';
    ctx.fillText('ARK BIO-DOME · ' + sim.w + '×' + sim.h + ' 生态格', 14, 22);
    ctx.textAlign = 'right';
    ctx.fillText('第 ' + sim.year + ' 年 · ' + st.season + ' · ' + Math.round(st.temp) + '℃', cw - 14, 22);
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    var b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function pick(sim, clientX, clientY) {
    if (!canvas || !sim) return null;
    var rect = canvas.getBoundingClientRect();
    var mx = clientX - rect.left, my = clientY - rect.top;
    var s = fitScale(sim);
    var offX = (cw - sim.w * s) / 2, offY = (ch - sim.h * s) / 2;
    var tx = Math.floor((mx - offX) / s), ty = Math.floor((my - offY) / s);
    if (!isFinite(tx) || !isFinite(ty)) return null;
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
