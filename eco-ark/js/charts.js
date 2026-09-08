/* ECO-ARK · 种群动态曲线图（洛特卡-沃尔泰拉可视化） */
(function () {
  'use strict';
  var canvas, ctx, cw, ch;
  var colorCache = {};
  var visible = {}; // 当前显示哪些物种

  var SPEC = window.ECOARK.species;
  var canvas, ctx, cw, ch;

  // 返回 false 表示 Canvas 2D 不可用，主控制器据此降级
  function init(c) {
    if (!c) return false;
    var context = c.getContext ? c.getContext('2d') : null;
    if (!context) return false;
    canvas = c;
    ctx = context;
    resize();
    window.addEventListener('resize', resize);
    return true;
  }

  function resize() {
    if (!canvas) return;
    var parent = canvas.parentElement;
    cw = (parent && parent.clientWidth) || canvas.width || 800;
    ch = (parent && parent.clientHeight) || canvas.height || 600;
    canvas.width = cw;
    canvas.height = ch;
  }

  function speciesColor(id) {
    var sp = SPEC.byId(id);
    return sp ? sp.color : '#888';
  }

  function render(sim) {
    if (!ctx || !sim) return;
    var hist = sim.getHistory();
    var W = cw, H = ch;
    ctx.clearRect(0, 0, W, H);
    // 背景网格
    ctx.fillStyle = 'rgba(10,22,18,0.85)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,180,140,0.12)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (var gy = 0; gy <= H; gy += 25) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    // 植物生物量（浅绿区域）
    var N = hist.length;
    if (N < 2) return;
    var windowYears = 60; // 显示最近 60 年
    var start = Math.max(0, N - windowYears);
    var seg = hist.slice(start);

    var maxY = 1;
    for (var i = 0; i < seg.length; i++) {
      var row = seg[i];
      maxY = Math.max(maxY, row.biomass || 0, (row.plant || 0) * 1.2);
      var counts = row.counts || {};
      for (var cid in counts) {
        var csp = SPEC.byId(cid);
        maxY = Math.max(maxY, (counts[cid] || 0) * (csp ? csp.M : 1) * 2);
      }
    }

    var X = function (idx) { return 8 + (idx / Math.max(1, seg.length - 1)) * (W - 16); };
    var Y = function (v) { return H - 10 - (v / maxY) * (H - 30); };

    // 植物生物量面积
    ctx.beginPath();
    ctx.moveTo(X(0), Y(seg[0].plant || 0));
    for (var p = 1; p < seg.length; p++) ctx.lineTo(X(p), Y(seg[p].plant || 0));
    ctx.lineTo(X(seg.length - 1), H - 10);
    ctx.lineTo(X(0), H - 10);
    ctx.closePath();
    ctx.fillStyle = 'rgba(110,180,90,0.16)';
    ctx.fill();

    // 各物种曲线
    var speciesSeen = {};
    for (var q = 0; q < seg.length; q++) {
      var cs = seg[q].counts || {};
      for (var sid in cs) speciesSeen[sid] = true;
    }
    for (var id in speciesSeen) {
      var sp = SPEC.byId(id);
      var mul = sp ? sp.M : 1;
      ctx.strokeStyle = speciesColor(id);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      var started = false;
      for (var k = 0; k < seg.length; k++) {
        var v = (seg[k].counts[id] || 0) * mul;
        if (!started && v === 0) continue;
        if (!started) { ctx.moveTo(X(k), Y(v)); started = true; }
        else ctx.lineTo(X(k), Y(v));
      }
      ctx.stroke();
    }

    // 坐标文字
    ctx.fillStyle = 'rgba(190,220,200,0.7)';
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillText('近 ' + Math.min(windowYears, N) + ' 年种群曲线（纵轴按体型加权生物量）', 10, 14);
    ctx.fillText('← 早', 10, H - 4);
    ctx.fillText('现在 →', W - 46, H - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('生物量 ' + Math.round(seg[seg.length - 1].biomass || 0), W - 120, 14);
  }

  window.ECOARK = window.ECOARK || {};
  window.ECOARK.charts = { init: init, render: render };
})();
