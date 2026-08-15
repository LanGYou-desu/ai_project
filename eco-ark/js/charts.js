/* ECO-ARK · 种群动态曲线图（洛特卡-沃尔泰拉可视化） */
(function () {
  'use strict';
  var canvas, ctx, cw, ch;
  var colorCache = {};
  var visible = {}; // 当前显示哪些物种

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

  function speciesColor(id) {
    var sp = window.ECOARK.species.byId(id);
    return sp ? sp.color : '#888';
  }

  function setVisible(map) { visible = map || {}; }

  function render(sim) {
    if (!ctx) return;
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
      Object.keys(row.counts || {}).forEach(function (id) {
        maxY = Math.max(maxY, (row.counts[id] || 0) * (window.ECOARK.species.byId(id) ? window.ECOARK.species.byId(id).M : 1) * 2);
      });
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

    // 各物种曲线（按可见开关）
    var speciesSeen = {};
    seg.forEach(function (r) { Object.keys(r.counts || {}).forEach(function (id) { speciesSeen[id] = true; }); });
    Object.keys(speciesSeen).forEach(function (id) {
      if (visible[id] === false) return;
      var sp = window.ECOARK.species.byId(id);
      var mul = sp ? sp.M : 1;
      var col = speciesColor(id);
      ctx.strokeStyle = col;
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
    });

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
  window.ECOARK.charts = { init: init, render: render, setVisible: setVisible };
})();
