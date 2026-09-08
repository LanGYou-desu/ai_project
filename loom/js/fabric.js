'use strict';
/* LOOM · 织物渲染：把 0/1 矩阵画成有光泽的纱线
 *
 * 性能约定：纱线的抖动、颜色、渐变**只跟自己的索引有关**，
 * 所以每根经线/纬线在每一帧里只计算一次，然后被该列/行上所有交织点复用。
 * 早期版本对每个交织点都重新算一次 shade() 与 createLinearGradient()，
 * 400×400 的织物一帧要 350ms 以上；现在压到几十毫秒量级。
 */
(function (root) {
  'use strict';
  var Y = (typeof require !== 'undefined') ? require('./shared/yarn.js') : root.Loom.yarn;

  /* 确定性伪随机：让每根纱线有一点粗细 / 明暗差异 */
  function hash(n) {
    n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4);
    n = n * 0x27d4eb2d; n = n ^ (n >>> 15);
    return (n >>> 0) / 4294967295;
  }

  /* ---- 每根纱线的随机参数：按维度缓存，避免逐格重算 ---- */
  var cacheW = { n: -1, jit: null, wid: null };
  var cacheF = { n: -1, jit: null, wid: null };

  function yarnParams(n, isWarp) {
    var c = isWarp ? cacheW : cacheF;
    if (c.n === n) return c;
    var jit = new Float32Array(n), wid = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      jit[i] = (hash(i * 7919 + (isWarp ? 0 : 13)) - 0.5) * 0.10;
      wid[i] = 1 + (hash(i * 131 + (isWarp ? 7 : 11)) - 0.5) * 0.18;
    }
    c.n = n; c.jit = jit; c.wid = wid;
    return c;
  }

  function gradV(ctx, x, w, color) {
    var g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0.00, Y.shade(color, -0.34));
    g.addColorStop(0.20, Y.shade(color, 0.10));
    g.addColorStop(0.46, Y.shade(color, 0.28));
    g.addColorStop(0.72, Y.shade(color, 0.04));
    g.addColorStop(1.00, Y.shade(color, -0.40));
    return g;
  }
  function gradH(ctx, y, h, color) {
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0.00, Y.shade(color, -0.34));
    g.addColorStop(0.20, Y.shade(color, 0.10));
    g.addColorStop(0.46, Y.shade(color, 0.28));
    g.addColorStop(0.72, Y.shade(color, 0.04));
    g.addColorStop(1.00, Y.shade(color, -0.40));
    return g;
  }

  /* 计算正好放下的格边长 */
  function fitCellSize(w, h, boxW, boxH, max) {
    if (!w || !h) return 8;
    var cs = Math.min(boxW / w, boxH / h);
    if (max) cs = Math.min(cs, max);
    return Math.max(0.5, cs);
  }

  /* 主渲染入口
   * o = { matrix, warpColor, weftColor, cellSize, ox, oy, mode:'real'|'drawdown',
   *       grid, picks, highlight, background, crisp } */
  function draw(ctx, o) {
    var m = o.matrix;
    if (!m || !m.length || !m[0].length) return;
    var H = (o.picks == null) ? m.length : Math.min(o.picks, m.length);
    var W = m[0].length;
    var cs = o.cellSize;
    var warp = Y.normalizeColor(o.warpColor, '#c8623c');
    var weft = Y.normalizeColor(o.weftColor, '#2f4f63');
    var mode = o.mode || 'real';
    var detail = cs >= 5 && !o.crisp;
    /* 大面积织物关掉投影与噪点：一帧省下上万次绘制 */
    var cells = W * m.length;
    var shadows = detail && cells <= 60000;
    var noise = detail && cs >= 8 && cells <= 30000;

    ctx.save();
    ctx.translate(o.ox || 0, o.oy || 0);

    /* 底板 */
    ctx.fillStyle = o.background || '#14100c';
    ctx.fillRect(0, 0, W * cs, m.length * cs);

    if (mode === 'drawdown') {
      ctx.fillStyle = o.paper || '#f5f0e4';
      ctx.fillRect(0, 0, W * cs, m.length * cs);
      ctx.fillStyle = warp;
      for (var p0 = 0; p0 < m.length; p0++) {
        var row0 = m[p0], y0 = p0 * cs;
        for (var e0 = 0; e0 < W; e0++) {
          if (row0[e0]) ctx.fillRect(e0 * cs, y0, cs, cs);
        }
      }
      if (o.grid && cs >= 3) drawGrid(ctx, W, m.length, cs);
      ctx.restore();
      return;
    }

    /* ---- 写实织物 ---- */
    var pw = yarnParams(W, true), pf = yarnParams(m.length, false);
    var e, p, x, y;

    /* 每根纱线的填充样式（颜色或渐变）只算一次 */
    var warpFill = new Array(W), warpX = new Float32Array(W), warpW = new Float32Array(W);
    for (e = 0; e < W; e++) {
      var cw = cs * pw.wid[e];
      x = e * cs + (cs - cw) / 2;
      warpX[e] = x; warpW[e] = cw;
      warpFill[e] = detail ? gradV(ctx, x, cw, Y.shade(warp, pw.jit[e])) : Y.shade(warp, pw.jit[e]);
    }
    var weftFill = new Array(m.length), weftY = new Float32Array(m.length), weftH = new Float32Array(m.length);
    for (p = 0; p < m.length; p++) {
      var ch = cs * pf.wid[p];
      y = p * cs + (cs - ch) / 2;
      weftY[p] = y; weftH[p] = ch;
      weftFill[p] = detail ? gradH(ctx, y, ch, Y.shade(weft, pf.jit[p])) : Y.shade(weft, pf.jit[p]);
    }

    /* 1. 经线：整根竖纱 */
    for (e = 0; e < W; e++) {
      ctx.fillStyle = warpFill[e];
      ctx.fillRect(warpX[e], 0, warpW[e], m.length * cs);
    }
    /* 2. 纬线：整根横纱（只画已织入的部分） */
    for (p = 0; p < H; p++) {
      ctx.fillStyle = weftFill[p];
      ctx.fillRect(0, weftY[p], W * cs, weftH[p]);
    }
    /* 3. 经浮于表的交织点：把经纱重新盖上去，并投影 */
    if (shadows) {
      ctx.shadowColor = 'rgba(0,0,0,0.42)';
      ctx.shadowBlur = Math.max(1, cs * 0.30);
      ctx.shadowOffsetY = Math.max(0.5, cs * 0.10);
    }
    for (p = 0; p < H; p++) {
      var row = m[p], ry = p * cs;
      for (e = 0; e < W; e++) {
        if (!row[e]) continue;
        ctx.fillStyle = warpFill[e];
        ctx.fillRect(warpX[e], ry, warpW[e], cs);
      }
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    /* 4. 纤维噪点（只在放大到看得见、且织物不太大时画） */
    if (noise) {
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = '#000';
      var dot = Math.max(1, cs * 0.06);
      for (p = 0; p < H; p++) {
        for (e = 0; e < W; e++) {
          var r = hash(p * 7919 + e * 104729);
          if (r > 0.62) ctx.fillRect(e * cs + r * cs * 0.7, p * cs + hash(r * 1e6) * cs * 0.7, dot, dot);
        }
      }
      ctx.globalAlpha = 1;
    }

    /* 5. 网格（可选） */
    if (o.grid && cs >= 3) drawGrid(ctx, W, H, cs);

    /* 6. 高亮某一纬 */
    if (o.highlight != null && o.highlight >= 0 && o.highlight < m.length) {
      ctx.strokeStyle = 'rgba(255,206,110,0.95)';
      ctx.lineWidth = Math.max(1.5, cs * 0.14);
      ctx.strokeRect(0, o.highlight * cs, W * cs, cs);
    }

    ctx.restore();
  }

  function drawGrid(ctx, W, H, cs) {
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = 0; gx <= W; gx++) { ctx.moveTo(gx * cs + 0.5, 0); ctx.lineTo(gx * cs + 0.5, H * cs); }
    for (var gy = 0; gy <= H; gy++) { ctx.moveTo(0, gy * cs + 0.5); ctx.lineTo(W * cs, gy * cs + 0.5); }
    ctx.stroke();
  }

  /* 找到矩阵中鼠标所在格 */
  function cellAt(mx, my, o) {
    var cs = o.cellSize;
    var e = Math.floor((mx - (o.ox || 0)) / cs);
    var p = Math.floor((my - (o.oy || 0)) / cs);
    if (!o.matrix.length) return null;
    if (p < 0 || p >= o.matrix.length || e < 0 || e >= o.matrix[0].length) return null;
    return { e: e, p: p };
  }

  var api = { draw: draw, fitCellSize: fitCellSize, cellAt: cellAt, hash: hash };
  root.Loom = root.Loom || {};
  root.Loom.fabric = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
