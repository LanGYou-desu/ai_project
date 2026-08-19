'use strict';
/* SYNAPSE · Canvas 渲染：网络图 / 损失曲线 / 决策边界 / 数字预测 / 井字棋 */
(function (root) {
  'use strict';
  const L = root.Synapse.losses;
  const TT = root.Synapse.tictactoe;
  const DS = root.Synapse.datasets;

  const C = {
    cyan: '#4dd0e1', violet: '#b388ff', amber: '#ffd54f', magenta: '#ff7eb6',
    green: '#69f0ae', red: '#ff6b6b', muted: '#7d8ab8', text: '#dbe4ff',
    bg: '#0c1122', grid: '#1a2340'
  };

  /* ---------- 布局：按层列给节点赋坐标 ---------- */
  function layout(editor, W, H) {
    const cols = editor.layers.length;
    const padX = 56, padY = 34;
    for (let l = 0; l < cols; l++) {
      const col = editor.layers[l];
      const x = cols === 1 ? W / 2 : padX + l * ((W - 2 * padX) / (cols - 1));
      const spacing = col.length > 1 ? (H - 2 * padY) / (col.length - 1) : 0;
      for (let i = 0; i < col.length; i++) {
        const n = col[i];
        n.pos.x = x;
        n.pos.y = col.length === 1 ? H / 2 : padY + i * spacing;
      }
    }
  }

  /* ---------- 网络图 ---------- */
  function drawGraph(ctx, editor, net, sel, wireSel, W, H) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    // 网格
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // 连线（按权重着色：正青 / 负品红，线宽随 |w|）
    for (const e of editor.edges) {
      const from = editor.node(e.from), to = editor.node(e.to);
      if (!from || !to) continue;
      const w = editor.getWeight(net, e);
      const isSel = sel && sel.type === 'edge' && sel.edgeId === e.id;
      const alpha = Math.min(0.95, 0.12 + Math.min(Math.abs(w), 2.5) * 0.22);
      ctx.strokeStyle = w >= 0 ? C.cyan : C.magenta;
      ctx.globalAlpha = isSel ? 1 : alpha;
      ctx.lineWidth = isSel ? 3 : Math.max(0.6, Math.min(3.5, Math.abs(w) * 0.9));
      ctx.beginPath();
      ctx.moveTo(from.pos.x, from.pos.y);
      ctx.lineTo(to.pos.x, to.pos.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 节点
    for (const col of editor.layers) {
      for (const n of col) {
        const r = n.kind === 'input' ? 15 : n.kind === 'output' ? 17 : 14;
        const isSel = sel && sel.type === 'node' && sel.nodeId === n.id;
        const isWire = wireSel === n.id;
        // 底色按类型
        let fill = C.violet;
        if (n.kind === 'input') fill = '#24455e';
        else if (n.kind === 'output') fill = '#5c4422';
        ctx.beginPath();
        ctx.arc(n.pos.x, n.pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = isSel || isWire ? 3 : 1.5;
        ctx.strokeStyle = isSel ? '#ffffff' : (isWire ? C.cyan : C.borderColor || '#3a4a7a');
        ctx.stroke();
        if (isWire) {
          ctx.strokeStyle = C.cyan; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(n.pos.x, n.pos.y, r + 5, 0, Math.PI * 2); ctx.stroke();
        }
        // 标签
        ctx.fillStyle = C.text;
        ctx.font = '11px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.pos.x, n.pos.y + 3.5);
        // 偏置 / 激活小字
        ctx.font = '9px Consolas, monospace';
        ctx.fillStyle = C.muted;
        if (n.kind === 'hidden') {
          ctx.fillText(n.activation, n.pos.x, n.pos.y - r - 6);
          ctx.fillStyle = C.amber;
          ctx.fillText('b=' + (n.bias >= 0 ? '' : '') + n.bias.toFixed(2), n.pos.x, n.pos.y + r + 12);
        } else if (n.kind === 'output') {
          ctx.fillText(n.activation, n.pos.x, n.pos.y - r - 6);
        }
      }
    }
    // 空提示
    if (editor.edgeCount() === 0 && editor.hiddenLayerCount() === 0) {
      ctx.fillStyle = C.muted;
      ctx.font = '13px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('点击「＋ 加一层」开始织造，或「自动连线」', W / 2, H / 2);
    }
  }

  /* ---------- 命中检测 ---------- */
  function hitNode(editor, x, y) {
    for (const col of editor.layers) {
      for (const n of col) {
        const r = (n.kind === 'input' ? 15 : n.kind === 'output' ? 17 : 14) + 4;
        const dx = n.pos.x - x, dy = n.pos.y - y;
        if (dx * dx + dy * dy <= r * r) return n;
      }
    }
    return null;
  }
  function hitEdge(editor, x, y) {
    let best = null, bestD = 6;
    for (const e of editor.edges) {
      const from = editor.node(e.from), to = editor.node(e.to);
      if (!from || !to) continue;
      const d = pointSegDist(x, y, from.pos.x, from.pos.y, to.pos.x, to.pos.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }
  function pointSegDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  /* ---------- 损失曲线 ---------- */
  function drawLoss(ctx, history, W, H) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    const padL = 40, padR = 46, padT = 14, padB = 22;
    const iw = W - padL - padR, ih = H - padT - padB;
    // 网格
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (ih / 4) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      const x = padL + (iw / 5) * i;
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, H - padB); ctx.stroke();
    }
    if (!history || history.length === 0) {
      ctx.fillStyle = C.muted;
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('点「开始训练」后这里会出现损失曲线', W / 2, H / 2);
      return;
    }
    let maxLoss = 0;
    for (const h of history) if (h.loss > maxLoss) maxLoss = h.loss;
    if (maxLoss <= 0) maxLoss = 1;
    maxLoss *= 1.1;
    const n = history.length;
    const xAt = function (i) { return padL + (i / Math.max(1, n - 1)) * iw; };
    const yAt = function (v) { return padT + ih - (Math.min(v, maxLoss) / maxLoss) * ih; };
    // loss 线
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = xAt(i), y = yAt(history[i].loss);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // acc 线（右侧 0-100 轴）
    const hasAcc = history.some(function (h) { return h.acc != null; });
    if (hasAcc) {
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = xAt(i);
        const acc = history[i].acc == null ? 0 : history[i].acc;
        const y = padT + ih - acc * ih;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = C.amber;
      ctx.font = '10px Consolas, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('acc', W - padR + 8, padT + 10);
      ctx.fillText((Math.round(history[n - 1].acc * 100)) + '%', W - padR + 8, padT + 24);
    }
    ctx.fillStyle = C.cyan;
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('loss ' + history[n - 1].loss.toFixed(4), W - padR + 8, padT + 38);
    // 轴标签
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'right';
    ctx.fillText(maxLoss.toFixed(1), padL - 6, padT + 10);
    ctx.fillText('0', padL - 6, H - padB);
    ctx.textAlign = 'left';
    ctx.fillText('epoch ' + n, padL, H - 6);
  }

  /* ---------- 决策边界（2D 数据集） ---------- */
  function drawBoundary(ctx, net, dataset, W, H, range) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    const padL = 46, padR = 14, padT = 12, padB = 28;
    const iw = W - padL - padR, ih = H - padT - padB;
    const x0 = range[0], x1 = range[1], y0 = range[2], y1 = range[3];
    const grid = 56;
    for (let gy = 0; gy < grid; gy++) {
      for (let gx = 0; gx < grid; gx++) {
        const px = x0 + ((gx + 0.5) / grid) * (x1 - x0);
        const py = y0 + ((gy + 0.5) / grid) * (y1 - y0);
        const p = net.predict([px, py]);
        let v;
        if (p.length === 1) v = p[0];
        else v = p[L.argmax(p)] * 0.9 + 0.05;
        const sx = padL + (gx / grid) * iw, sy = padT + (gy / grid) * ih;
        const cw = iw / grid + 0.6, ch = ih / grid + 0.6;
        ctx.fillStyle = mixColor(C.cyan, C.magenta, v);
        ctx.fillRect(sx, sy, cw, ch);
      }
    }
    // 数据点
    for (let i = 0; i < dataset.inputs.length; i++) {
      const inp = dataset.inputs[i];
      const cls = L.argmax(dataset.targets[i]);
      const sx = padL + ((inp[0] - x0) / (x1 - x0)) * iw;
      const sy = padT + ((inp[1] - y0) / (y1 - y0)) * ih;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = cls === 0 ? '#0e2b33' : '#3a1f2e';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = cls === 0 ? C.cyan : C.magenta;
      ctx.stroke();
    }
    // 轴
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();
    ctx.fillStyle = C.muted;
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('x ' + x0 + ' ~ ' + x1, padL, H - 6);
    ctx.fillText('y ' + y0 + ' ~ ' + y1, padL, padT - 4);
  }

  function mixColor(c1, c2, t) {
    const a = hex(c1), b = hex(c2);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }
  function hex(c) {
    if (c[0] === '#') {
      return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    }
    return [100, 100, 100];
  }

  /* ---------- 数字预测 ---------- */
  function drawDigitsViz(ctx, net, W, H) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    const cell = 11, gap = 16;
    const perRow = 5;
    const startX = 16;
    const startY = 18;
    for (let d = 0; d < 10; d++) {
      const col = d % perRow, row = Math.floor(d / perRow);
      const x = startX + col * ((W - startX * 2) / perRow);
      const y = startY + row * 92;
      const glyph = DS.glyphArray(d);
      // 画字模
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 5; c++) {
          ctx.fillStyle = glyph[r * 5 + c] ? C.text : '#1a2340';
          ctx.fillRect(x + c * cell, y + r * cell, cell - 1.5, cell - 1.5);
        }
      }
      // 预测
      let p = null, cls = -1;
      if (net) {
        p = net.predict(glyph);
        cls = L.argmax(p);
      }
      const bx = x + 5 * cell + 14;
      ctx.fillStyle = C.muted;
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('标签 ' + d, x, y + 7 * cell + 16);
      if (p) {
        const correct = cls === d;
        ctx.fillStyle = correct ? C.green : C.red;
        ctx.fillText('预测 ' + cls, bx, y + 7 * cell + 16);
        // 概率条
        const bw = W - bx - 12;
        ctx.fillStyle = '#1a2340';
        ctx.fillRect(bx, y + 7 * cell + 22, bw, 6);
        ctx.fillStyle = correct ? C.green : C.red;
        ctx.fillRect(bx, y + 7 * cell + 22, Math.max(2, bw * p[cls]), 6);
      }
    }
    ctx.fillStyle = C.muted;
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('训练后：看它能否认出每个数字（用未加噪的字模测试）', startX, H - 8);
  }

  /* ---------- 井字棋 ---------- */
  function drawTTT(ctx, ttt, W, H) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    const size = Math.min(W - 40, H - 64);
    const ox = (W - size) / 2, oy = (H - size) / 2 + 14;
    // 棋盘线
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 2;
    const cw = size / 3;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(ox + i * cw, oy); ctx.lineTo(ox + i * cw, oy + size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, oy + i * cw); ctx.lineTo(ox + size, oy + i * cw); ctx.stroke();
    }
    // 落子
    ctx.font = (cw * 0.62) + 'px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(i / 3), c = i % 3;
      const cx = ox + c * cw + cw / 2, cy = oy + r * cw + cw / 2;
      if (ttt.board[i] === 1) {
        ctx.fillStyle = C.cyan;
        ctx.fillText('✕', cx, cy + 2);
      } else if (ttt.board[i] === -1) {
        ctx.fillStyle = C.magenta;
        ctx.fillText('◯', cx, cy + 2);
      }
    }
    // 高亮胜线
    const w = TT.winner(ttt.board);
    if (w !== 0 && ttt.winLine) {
      const [a, b, c] = ttt.winLine;
      ctx.strokeStyle = w === 1 ? C.cyan : C.magenta;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ox + (a % 3) * cw + cw / 2, oy + Math.floor(a / 3) * cw + cw / 2);
      ctx.lineTo(ox + (c % 3) * cw + cw / 2, oy + Math.floor(c / 3) * cw + cw / 2);
      ctx.stroke();
    }
    // 状态
    ctx.fillStyle = C.text;
    ctx.font = '14px "Microsoft YaHei", sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(ttt.msg, W / 2, H - 10);
    // 提示
    ctx.fillStyle = C.muted;
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.fillText('点击棋盘落子（你 ' + (ttt.userSide === 1 ? '✕ 先手' : '◯ 后手') + '）· 右边「重新开局」换边', W / 2, oy - 8);
  }

  root.Synapse = root.Synapse || {};
  root.Synapse.render = {
    layout: layout, drawGraph: drawGraph, hitNode: hitNode, hitEdge: hitEdge,
    drawLoss: drawLoss, drawBoundary: drawBoundary, drawDigitsViz: drawDigitsViz, drawTTT: drawTTT
  };
})(window);
