'use strict';
// 电路沙盒 · 渲染引擎
// 在 HTML5 canvas 上绘制原理图：元件符号、连线、节点电压标签、电流动画。

// 元件几何：以元件中心为原点，返回 [端点0, 端点1, ...] 的相对坐标。
// 2 端口元件：端点0 在左，端点1 在右。3 端口 BJT：[collector, emitter, base]。
// 3 端口门：前 N-1 个为输入（上/左），最后一个为输出（右）。
const GEOMETRY = {
  resistor:    { w: 70, h: 30, pts: [[-35, 0], [35, 0]] },
  capacitor:   { w: 70, h: 30, pts: [[-35, 0], [35, 0]] },
  inductor:    { w: 70, h: 30, pts: [[-35, 0], [35, 0]] },
  diode:       { w: 60, h: 30, pts: [[-30, 0], [30, 0]] },
  bjt_n:       { w: 60, h: 50, pts: [[0, -22], [0, 22], [-30, 0]] }, // C, E, B
  bjt_p:       { w: 60, h: 50, pts: [[0, -22], [0, 22], [-30, 0]] },
  gate:        { w: 70, h: 44, pts: [[-28, -16], [-28, 16], [30, 0]] }, // in0, in1, out
  voltage:     { w: 56, h: 30, pts: [[-28, 0], [28, 0]] },
  current:     { w: 56, h: 30, pts: [[-28, 0], [28, 0]] },
  switch:      { w: 56, h: 30, pts: [[-28, 0], [28, 0]] },
  opamp:       { w: 60, h: 44, pts: [[-28, -16], [-28, 16], [28, 0]] }, // in-, in+, out
  ac:          { w: 60, h: 30, pts: [[-30, 0], [30, 0]] },
  gnd:         { w: 30, h: 20, pts: [[0, 0]] }
};

const NODE_RADIUS = 4;

// 元件端点世界坐标：pos 为元件中心，rot 为弧度旋转角。
function terminalWorldPos(comp, pos, rot, termIdx) {
  const g = GEOMETRY[comp.type];
  if (!g) return { x: pos.x, y: pos.y };
  const p = g.pts[termIdx] || [0, 0];
  const cos = Math.cos(rot), sin = Math.sin(rot);
  return { x: pos.x + p[0] * cos - p[1] * sin, y: pos.y + p[0] * sin + p[1] * cos };
}

// 绘制元件符号
function drawSymbol(ctx, comp, pos, rot, selected, voltages, currents, time) {
  const g = GEOMETRY[comp.type];
  if (!g) return;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(rot);

  ctx.strokeStyle = selected ? '#ffd166' : '#e6e6e6';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.fillStyle = '#2a2a3a';
  ctx.font = '11px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  switch (comp.type) {
    case 'resistor': {
      ctx.beginPath();
      ctx.moveTo(-28, 0); ctx.lineTo(-20, 0);
      ctx.lineTo(-16, -10); ctx.lineTo(-4, 10); ctx.lineTo(8, -10); ctx.lineTo(20, 10); ctx.lineTo(24, 0);
      ctx.lineTo(30, 0);
      ctx.stroke();
      break;
    }
    case 'capacitor': {
      ctx.beginPath();
      ctx.moveTo(-28, 0); ctx.lineTo(-8, 0);
      ctx.moveTo(-8, -12); ctx.lineTo(-8, 12);
      ctx.moveTo(8, -12); ctx.lineTo(8, 12);
      ctx.moveTo(8, 0); ctx.lineTo(28, 0);
      ctx.stroke();
      break;
    }
    case 'inductor': {
      ctx.beginPath();
      ctx.moveTo(-28, 0);
      for (let i = 0; i < 5; i++) {
        const x0 = -24 + i * 12;
        ctx.arc(x0 + 3, 0, 3, Math.PI, 0);
      }
      ctx.lineTo(28, 0);
      ctx.stroke();
      break;
    }
    case 'diode': {
      ctx.beginPath();
      ctx.moveTo(-26, 0); ctx.lineTo(-6, 0);
      ctx.lineTo(-6, -10); ctx.lineTo(6, 0); ctx.lineTo(-6, 10); ctx.closePath();
      ctx.moveTo(6, 0); ctx.lineTo(26, 0);
      ctx.stroke();
      // 正向箭头
      ctx.fillStyle = (voltages && currents && (currents.get(comp.id) || 0) > 0) ? '#06d6a0' : '#888';
      ctx.fillRect(2, -2, 4, 4);
      break;
    }
    case 'bjt_n': {
      // C(上) E(下) B(左)
      ctx.beginPath();
      ctx.moveTo(0, -22); ctx.lineTo(0, 22); // 垂直线
      ctx.moveTo(-30, 0); ctx.lineTo(-12, 0); // 基极引线
      ctx.moveTo(-12, -8); ctx.lineTo(-12, 8); // 基极竖条
      ctx.stroke();
      // 箭头：NPN 在发射极向下
      ctx.beginPath();
      ctx.moveTo(-4, 10); ctx.lineTo(4, 22); ctx.lineTo(-4, 22); ctx.closePath();
      ctx.fillStyle = '#e6e6e6'; ctx.fill();
      break;
    }
    case 'bjt_p': {
      ctx.beginPath();
      ctx.moveTo(0, -22); ctx.lineTo(0, 22);
      ctx.moveTo(-30, 0); ctx.lineTo(-12, 0);
      ctx.moveTo(-12, -8); ctx.lineTo(-12, 8);
      ctx.stroke();
      // PNP 箭头向上
      ctx.beginPath();
      ctx.moveTo(-4, -10); ctx.lineTo(4, -22); ctx.lineTo(-4, -22); ctx.closePath();
      ctx.fillStyle = '#e6e6e6'; ctx.fill();
      break;
    }
    case 'gate': {
      // 输入在左，输出在右
      ctx.beginPath();
      ctx.moveTo(-24, -16); ctx.lineTo(-24, 16);
      ctx.lineTo(26, 8); ctx.lineTo(26, -8); ctx.closePath();
      ctx.stroke();
      const gate = (comp.params.gate || '').toUpperCase();
      ctx.fillStyle = '#ffd166';
      ctx.fillText(gate, 0, 0);
      break;
    }
    case 'voltage': {
      // 圆圈 + 极性
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.stroke();
      const v = (voltages && voltages.get(comp.id) !== undefined) ? voltages.get(comp.id) : comp.params.v;
      ctx.fillStyle = '#06d6a0';
      ctx.fillText((v >= 0 ? '+' : '') + v.toFixed(1), 0, 0);
      break;
    }
    case 'current': {
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.fillText((comp.params.i >= 0 ? '+' : '') + comp.params.i, 0, 0);
      break;
    }
    case 'switch': {
      const closed = comp.state.closed;
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      if (closed) ctx.lineTo(26, 0);
      else { ctx.lineTo(-6, -6); ctx.lineTo(6, 6); }
      ctx.stroke();
      break;
    }
    case 'opamp': {
      // 三角形：in-在上，in+在下，out在右
      ctx.beginPath();
      ctx.moveTo(-22, -16); ctx.lineTo(-22, 16); ctx.lineTo(24, 0); ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = '#888';
      ctx.font = '10px Consolas, monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('-', -20, -10);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('+', -20, 12);
      break;
    }
    case 'ac': {
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.font = '9px Consolas, monospace';
      ctx.fillText('AC', -14, 4);
      break;
    }
  }

  // 标签
  if (comp.params.label) {
    ctx.fillStyle = '#9aa0a6';
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(comp.params.label, 0, g.h / 2 + 12);
  }

  // 端点标记
  for (let i = 0; i < g.pts.length; i++) {
    const p = g.pts[i];
    ctx.beginPath();
    ctx.arc(p[0], p[1], NODE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd166';
    ctx.fill();
  }

  ctx.restore();
}

// 绘制连线（含电流动画）
function drawWire(ctx, a, b, current, time, highlight) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = highlight ? '#ff6b6b' : '#5a5a6e';
  ctx.lineWidth = highlight ? 2.5 : 1.5;
  ctx.stroke();

  if (current !== null && current !== undefined && Math.abs(current) > 1e-9) {
    // 电流点动画
    const segs = 8;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const dotLen = Math.min(14, len / (segs + 1));
    const t = (time * 0.0005) % 1;
    const pos = t * len;
    let dx = (b.x - a.x) / len, dy = (b.y - a.y) / len;
    const px = a.x + dx * pos, py = a.y + dy * pos;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = current > 0 ? '#06d6a0' : '#ff6b6b';
    ctx.fill();
  }
}

// 收集某节点连接的所有端点世界坐标
function nodeTerminals(circ, nid) {
  const pts = [];
  for (const c of circ.comps.values()) {
    for (let i = 0; i < c.terminals.length; i++) {
      const t = c.terminals[i];
      if (t.nodeId === nid && c.pos) {
        pts.push(terminalWorldPos(c, c.pos, c.rot || 0, i));
      }
    }
  }
  return pts;
}

// 主绘制函数
function draw(ctx, circ, voltages, currents, opts) {
  opts = opts || {};
  const time = opts.time || 0;
  const selectedId = opts.selectedId || null;
  const hoverId = opts.hoverId || null;

  // 背景
  ctx.fillStyle = '#1a1a24';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // 网格
  ctx.strokeStyle = '#2a2a3a';
  ctx.lineWidth = 1;
  const grid = 40;
  for (let x = 0; x < ctx.canvas.width; x += grid) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ctx.canvas.height); ctx.stroke();
  }
  for (let y = 0; y < ctx.canvas.height; y += grid) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ctx.canvas.width, y); ctx.stroke();
  }

  // 先画所有连线（底层）—— 按节点收集端点，两两相连
  const drawnWires = new Set();
  for (const c of circ.comps.values()) {
    const a = c.terminals[0], b = c.terminals[1];
    if (!a || !b || a.nodeId == null || b.nodeId == null || !c.pos) continue;
    const key = [Math.min(a.nodeId, b.nodeId), Math.max(a.nodeId, b.nodeId)].join(',');
    if (drawnWires.has(key)) continue;
    drawnWires.add(key);
    const pa = terminalWorldPos(c, c.pos, c.rot || 0, 0);
    const pb = terminalWorldPos(c, c.pos, c.rot || 0, 1);
    const cur = currents ? currents.get(c.id) : null;
    drawWire(ctx, pa, pb, cur, time, c.id === selectedId);
  }

  // 画元件
  for (const c of circ.comps.values()) {
    if (!c.pos) continue;
    drawSymbol(ctx, c, c.pos, c.rot || 0, c.id === selectedId, voltages, currents, time);
  }

  // 画节点标签
  ctx.font = '10px Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  for (const [nid, node] of circ.nodes) {
    const pts = nodeTerminals(circ, nid);
    if (!pts.length) continue;
    const pos = pts[0];
    const v = voltages ? (voltages.get(nid) || 0) : 0;
    ctx.fillStyle = '#9aa0a6';
    ctx.fillText(nid === 0 ? 'GND' : ('N' + nid), pos.x + 6, pos.y - 6);
  }
}

// 节点世界坐标：取该节点所有端点的平均值（多元件交汇处）
function nodePos(circ, nid) {
  const pts = nodeTerminals(circ, nid);
  if (!pts.length) return null;
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

module.exports = {
  GEOMETRY,
  terminalWorldPos,
  drawSymbol,
  drawWire,
  draw,
  nodeTerminals,
  nodePos
};
if (typeof window !== 'undefined') { window.Render = { GEOMETRY, terminalWorldPos, drawSymbol, drawWire, draw, nodeTerminals, nodePos }; }