'use strict';
/* LOOM · 打孔卡片链：把提升计划画成 1804 年织机上的卡片 */
(function (root) {
  'use strict';
  var Y = (typeof require !== 'undefined') ? require('./shared/yarn.js') : root.Loom.yarn;

  /* 画一条卡片链：每一纬一张卡，孔 = 该纬抬起的经线 */
  function draw(ctx, matrix, o) {
    o = o || {};
    var boxW = o.width, boxH = o.height;
    if (!matrix || !matrix.length) return;
    var H = matrix.length, W = matrix[0].length;

    ctx.clearRect(0, 0, boxW, boxH);
    ctx.fillStyle = o.background || '#14100c';
    ctx.fillRect(0, 0, boxW, boxH);

    var holesPerRow = 4;
    var holeRows = Math.max(1, Math.ceil(W / holesPerRow));
    var gap = 5, margin = 7;
    /* 先按可用宽度求卡片间距，再定孔距 */
    var pitch = 11;
    function cardW(p) { return holesPerRow * p + margin * 2; }
    function cardH(p) { return holeRows * p + margin * 2 + 6; }
    var totalW = H * (cardW(pitch) + gap);
    var avail = boxW - 28;
    if (totalW > avail) {
      pitch = Math.max(4, Math.floor(pitch * avail / totalW));
      totalW = H * (cardW(pitch) + gap);
    }
    var availH = boxH - 40;
    if (cardH(pitch) > availH) {
      pitch = Math.max(3, Math.floor(pitch * availH / cardH(pitch)));
      totalW = H * (cardW(pitch) + gap);
    }
    var cw = cardW(pitch), ch = cardH(pitch);
    var oy = (boxH - ch) / 2;
    var scroll = o.scroll || 0;
    var ox = 14 - scroll;

    /* 链条 */
    ctx.strokeStyle = 'rgba(200,162,74,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox, oy + ch / 2);
    ctx.lineTo(ox + totalW, oy + ch / 2);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, boxW, boxH);
    ctx.clip();

    for (var p = 0; p < H; p++) {
      var x = ox + p * (cw + gap);
      if (x > boxW || x + cw < 0) continue;
      var isCur = (o.current === p);

      /* 卡片本体 */
      ctx.fillStyle = isCur ? '#f3e6c4' : '#e2d4b2';
      ctx.strokeStyle = isCur ? '#d9a441' : 'rgba(90,72,44,0.55)';
      ctx.lineWidth = isCur ? 2 : 1;
      roundRect(ctx, x, oy, cw, ch, 3);
      ctx.fill();
      ctx.stroke();

      /* 顶部色带（第几纬） */
      ctx.fillStyle = isCur ? '#c8a24a' : 'rgba(90,72,44,0.35)';
      ctx.fillRect(x + 1, oy + 1, cw - 2, 3);

      /* 送卡齿轮孔 */
      ctx.fillStyle = 'rgba(60,48,30,0.55)';
      for (var s = 0; s < 3; s++) {
        var sy = oy + ch * (0.22 + s * 0.28);
        ctx.beginPath();
        ctx.arc(x + margin * 0.45, sy, Math.max(1, pitch * 0.14), 0, Math.PI * 2);
        ctx.fill();
      }

      /* 数据孔 */
      for (var e = 0; e < W; e++) {
        var col = e % holesPerRow, row = Math.floor(e / holesPerRow);
        var hx = x + margin + col * pitch + pitch / 2;
        var hy = oy + margin + 6 + row * pitch + pitch / 2;
        var punched = !!matrix[p][e];
        var r = pitch * 0.27;
        if (punched) {
          ctx.fillStyle = '#2b2116';
          ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.beginPath(); ctx.arc(hx - r * 0.25, hy - r * 0.25, r * 0.45, 0, Math.PI * 2); ctx.fill();
        } else if (pitch >= 7) {
          ctx.strokeStyle = 'rgba(90,72,44,0.28)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.stroke();
        }
      }

      /* 纬号 */
      if (pitch >= 6) {
        ctx.fillStyle = 'rgba(60,48,30,0.75)';
        ctx.font = Math.max(7, Math.min(10, pitch * 0.9)) + 'px ui-monospace, Menlo, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(p + 1), x + cw / 2, oy + ch - 3);
        ctx.textAlign = 'left';
      }
    }
    ctx.restore();

    /* 提示 */
    ctx.fillStyle = 'rgba(232,220,196,0.42)';
    ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillText('打孔卡片链 · ' + H + ' 张 · 每张 ' + W + ' 个孔位（实心 = 抬起的经线）', 14, boxH - 8);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  var api = { draw: draw, roundRect: roundRect };
  root.Loom = root.Loom || {};
  root.Loom.punchcards = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
