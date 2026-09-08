'use strict';
/* LOOM · 织造图（穿综 / 提综 / 踏综 / 织物 四象限） */
(function (root) {
  'use strict';
  var W = (typeof require !== 'undefined') ? require('./shared/weave.js') : root.Loom.weave;
  var Y = (typeof require !== 'undefined') ? require('./shared/yarn.js') : root.Loom.yarn;

  function draw(ctx, draft, o) {
    o = o || {};
    var boxW = o.width, boxH = o.height;
    var matrix = W.drawdown(draft);
    var Wc = draft.warpCount, Hc = draft.weftCount;
    var S = Math.max(1, draft.shaftCount), T = Math.max(1, draft.treadleCount);
    var pad = 6;
    var gridW = Wc + T, gridH = S + Hc;
    var cs = Math.min((boxW - pad * 2) / gridW, (boxH - pad * 2) / gridH);
    cs = Math.max(2, Math.min(cs, 22));

    var totalW = gridW * cs, totalH = gridH * cs;
    var ox = (boxW - totalW) / 2, oy = (boxH - totalH) / 2;

    ctx.clearRect(0, 0, boxW, boxH);
    ctx.fillStyle = o.background || '#17120d';
    ctx.fillRect(0, 0, boxW, boxH);
    ctx.save();
    ctx.translate(ox, oy);

    var ink = '#e8dcc4', faint = 'rgba(232,220,196,0.16)', grid = 'rgba(232,220,196,0.10)';

    /* 网格线 */
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i <= gridW; i++) { ctx.moveTo(i * cs + 0.5, 0); ctx.lineTo(i * cs + 0.5, totalH); }
    for (var j = 0; j <= gridH; j++) { ctx.moveTo(0, j * cs + 0.5); ctx.lineTo(totalW, j * cs + 0.5); }
    ctx.stroke();

    /* 象限分界 */
    ctx.strokeStyle = 'rgba(200,162,74,0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(T * cs, 0); ctx.lineTo(T * cs, totalH);
    ctx.moveTo(0, S * cs); ctx.lineTo(totalW, S * cs);
    ctx.stroke();

    function mark(x, y) { ctx.fillRect(x * cs + 1, y * cs + 1, Math.max(1, cs - 2), Math.max(1, cs - 2)); }

    /* 穿综图：x = 踏杆区之后（第 T 列起），y = 综框 */
    ctx.fillStyle = ink;
    if (draft.threading) {
      for (var e = 0; e < Wc; e++) mark(T + e, draft.threading[e]);
    }
    /* 提综图：x = 踏杆，y = 综框 */
    if (draft.tieup) {
      for (var t = 0; t < T; t++) {
        var list = draft.tieup[t] || [];
        for (var k = 0; k < list.length; k++) mark(t, list[k]);
      }
    }
    /* 踏综图：x = 踏杆，y = 纬线（在 S 之下） */
    if (draft.treadling) {
      for (var p = 0; p < Hc; p++) mark(draft.treadling[p], S + p);
    }
    /* 织物图 */
    for (var p2 = 0; p2 < Hc; p2++) {
      for (var e2 = 0; e2 < Wc; e2++) {
        if (matrix[p2][e2]) mark(T + e2, S + p2);
      }
    }

    /* 坐标提示 */
    ctx.fillStyle = 'rgba(232,220,196,0.45)';
    ctx.font = Math.max(8, Math.min(11, cs * 0.8)) + 'px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillText('提综', 2, S * cs - 4);
    ctx.fillText('踏综', 2, S * cs + 11);
    ctx.fillText('穿综', T * cs + 4, S * cs - 4);

    ctx.restore();
  }

  var api = { draw: draw };
  root.Loom = root.Loom || {};
  root.Loom.draftview = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
