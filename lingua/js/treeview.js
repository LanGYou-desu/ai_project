/* LINGUA · 语系树画布：横向时间轴，纵列分支 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LINGUA = root.LINGUA || {}; root.LINGUA.treeview = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BRANCH_COLORS = ['#8b5a2b', '#4a6741', '#7a4a8b', '#a0552f', '#3f6f8f', '#8a6d3b', '#5b4a6a', '#2f6f55'];

  // lanes: 为分支分配纵向轨道（根在中间，子代向两侧展开）
  function layout(history) {
    var byId = {};
    history.branches.forEach(function (b) { byId[b.id] = b; });
    var lanes = {};
    var used = {};
    function assign(id, pref) {
      var b = byId[id];
      if (lanes[id] != null) return lanes[id];
      if (!b.parentId) { lanes[id] = 0; used[0] = true; return 0; }
      var parentLane = assign(b.parentId);
      var side = 1;
      var lane = parentLane + side;
      var guard = 0;
      while (used[lane] && guard < 200) { side = -side; lane = parentLane + side; if (used[lane]) lane = parentLane + (side > 0 ? 1 : -1) * (Math.abs(lane - parentLane) + 1); guard++; }
      lanes[id] = lane; used[lane] = true;
      return lane;
    }
    history.branches.forEach(function (b) { assign(b.id); });
    // normalize lanes to 0..n-1
    var vals = Object.keys(lanes).map(function (k) { return lanes[k]; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var out = {};
    history.branches.forEach(function (b) { out[b.id] = (lanes[b.id] - min) / Math.max(max - min, 1); });
    return out;
  }

  function render(canvas, history, state) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var padL = 90, padR = 20, padT = 24, padB = 30;
    var x0 = padL, x1 = W - padR;
    var t0 = 0, t1 = history.totalEpochs;
    var lanes = layout(history);
    var byId = {};
    history.branches.forEach(function (b) { byId[b.id] = b; });
    var laneYs = {};
    var laneSet = {};
    history.branches.forEach(function (b) { laneSet[lanes[b.id]] = true; });
    var nLanes = Object.keys(laneSet).length;
    var laneH = (H - padT - padB) / Math.max(nLanes, 1);

    function X(epoch) { return x0 + (epoch - t0) / (t1 - t0) * (x1 - x0); }
    function Y(lane) { return padT + laneH * (lane + 0.5); }

    ctx.clearRect(0, 0, W, H);

    // 背景网格 + 年代刻度
    ctx.strokeStyle = 'rgba(90,70,40,0.18)';
    ctx.lineWidth = 1;
    for (var e = 0; e <= history.totalEpochs; e += 5) {
      var gx = X(e);
      ctx.beginPath(); ctx.moveTo(gx, padT); ctx.lineTo(gx, H - padB); ctx.stroke();
      ctx.fillStyle = '#6b5638';
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((e * history.yearsPerEpoch) + '年', gx, H - padB + 14);
    }
    // 时间轴箭头
    ctx.fillStyle = '#6b5638';
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.fillText('公元 0 → 1000 年', x0, 14);

    // 分裂垂直连接线
    history.splits.forEach(function (sp) {
      var p = byId[sp.parentId];
      if (!p) return;
      var cx = X(sp.epoch);
      var lanesHere = sp.children.map(function (cid) { return lanes[cid]; });
      var yTop = Y(lanes[sp.parentId]);
      var yBot = Math.min.apply(null, lanesHere);
      ctx.strokeStyle = 'rgba(120,90,50,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, yTop);
      ctx.lineTo(cx, Y(yBot) - laneH * 0.35);
      ctx.stroke();
    });

    // 事件刻度（分裂/借词/文字）
    var marks = [];
    history.splits.forEach(function (sp) { marks.push({ epoch: sp.epoch, label: '分裂', color: 'rgba(160,58,42,0.5)' }); });
    if (history.loan) marks.push({ epoch: history.loan.epoch, label: '借词', color: 'rgba(47,111,143,0.5)' });
    if (history.loan2) marks.push({ epoch: history.loan2.epoch, label: '借词', color: 'rgba(47,111,143,0.5)' });
    if (history.writing) marks.push({ epoch: history.writing.epoch, label: '文字', color: 'rgba(122,74,139,0.5)' });
    marks.forEach(function (m) {
      var mx = X(m.epoch);
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, H - padB); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = m.color;
      ctx.font = '10px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, mx, padT - 5);
    });

    // 各分支轨道
    history.branches.forEach(function (b) {
      var lane = lanes[b.id];
      var y = Y(lane);
      var bx0 = X(Math.max(b.bornEpoch, 0));
      var bx1 = X(history.totalEpochs);
      var color = BRANCH_COLORS[lane % BRANCH_COLORS.length];
      var isSel = state.selected === b.id;
      var isHov = state.hovered === b.id;
      ctx.strokeStyle = color;
      ctx.lineWidth = isSel ? 5 : (isHov ? 4 : 2.5);
      ctx.globalAlpha = isHov && !isSel ? 1 : (isSel ? 1 : 0.7);
      ctx.beginPath(); ctx.moveTo(bx0, y); ctx.lineTo(bx1, y); ctx.stroke();
      ctx.globalAlpha = 1;
      // 出生节点
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(bx0, y, isSel ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
      if (b.writing != null) {
        ctx.strokeStyle = '#a03a2a';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X(b.writing), y, 6, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#a03a2a';
        ctx.font = '10px sans-serif';
        ctx.fillText('文', X(b.writing) - 3.5, y + 3.5);
      }
      // 名称
      ctx.fillStyle = '#3a2c1a';
      ctx.font = (isSel || isHov ? 'bold ' : '') + '13px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(b.name + (isHov && !isSel ? ' · 公元' + (b.bornEpoch * history.yearsPerEpoch) + '年' : ''), bx0 - 8, y + 4);
      ctx.textAlign = 'left';
      // 时间游标
      if (state.cursorEpoch != null) {
        var cxx = X(state.cursorEpoch);
        ctx.strokeStyle = isSel ? 'rgba(160,60,40,0.9)' : 'rgba(160,60,40,0.4)';
        ctx.lineWidth = isSel ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(cxx, y - 7); ctx.lineTo(cxx, y + 7); ctx.stroke();
      }
    });
  }

  // 命中检测：返回 { branchId?, epoch? }（逻辑坐标，dpr 需与渲染一致）
  function hitTest(canvas, history, state, px, py, dpr) {
    var W = canvas.width / (dpr || 1), H = canvas.height / (dpr || 1);
    var padL = 90, padR = 20, padT = 24, padB = 30;
    var x0 = padL, x1 = W - padR;
    var t0 = 0, t1 = history.totalEpochs;
    var lanes = layout(history);
    var laneSet = {};
    history.branches.forEach(function (b) { laneSet[lanes[b.id]] = true; });
    var nLanes = Object.keys(laneSet).length;
    var laneH = (H - padT - padB) / Math.max(nLanes, 1);
    var out = {};
    if (px >= x0 && px <= x1) {
      var e = Math.round(t0 + (px - x0) / (x1 - x0) * (t1 - t0));
      out.epoch = Math.max(0, Math.min(t1, e));
    }
    var best = null, bd = laneH * 0.5;
    history.branches.forEach(function (b) {
      var y = padT + laneH * (lanes[b.id] + 0.5);
      if (Math.abs(py - y) < bd && py >= padT && py <= H - padB) { bd = Math.abs(py - y); best = b.id; }
    });
    if (best) out.branchId = best;
    return out;
  }

  return { layout: layout, render: render, hitTest: hitTest, BRANCH_COLORS: BRANCH_COLORS };
});
