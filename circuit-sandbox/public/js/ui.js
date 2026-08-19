'use strict';
// 电路沙盒 · 交互层
// 负责：拖放添加元件、拖动移动元件、点击连线、参数面板、缩放/平移。

const { CT, GATE_TYPES, Circuit } = require('./circuit.js');
const { draw, terminalWorldPos, GEOMETRY } = require('./render.js');

// 可拖入画布的元件清单（分组）
const PALETTE = [
  { group: '电源', items: [
    { type: CT.VOLTAGE, label: '直流电压源', params: { v: 5 } },
    { type: CT.CURRENT, label: '电流源', params: { i: 0.001 } },
    { type: CT.AC, label: '交流源', params: { amp: 1, freq: 1, waveform: 'sine' } }
  ]},
  { group: '基础元件', items: [
    { type: CT.RESISTOR, label: '电阻', params: { r: 1000 } },
    { type: CT.CAPACITOR, label: '电容', params: { c: 1e-3 } },
    { type: CT.INDUCTOR, label: '电感', params: { l: 1e-3 } },
    { type: CT.SWITCH, label: '开关', params: {} }
  ]},
  { group: '半导体', items: [
    { type: CT.DIODE, label: '二极管', params: {} },
    { type: CT.BJT_N, label: 'NPN 三极管', params: {} },
    { type: CT.BJT_P, label: 'PNP 三极管', params: {} },
    { type: CT.OPAMP, label: '运放', params: { gain: 1e5, supply: 5 } }
  ]},
  { group: '逻辑门', items: [
    { type: CT.GATE, label: 'NOT', params: { gate: GATE_TYPES.NOT } },
    { type: CT.GATE, label: 'AND', params: { gate: GATE_TYPES.AND } },
    { type: CT.GATE, label: 'OR', params: { gate: GATE_TYPES.OR } },
    { type: CT.GATE, label: 'NAND', params: { gate: GATE_TYPES.NAND } },
    { type: CT.GATE, label: 'NOR', params: { gate: GATE_TYPES.NOR } },
    { type: CT.GATE, label: 'XOR', params: { gate: GATE_TYPES.XOR } },
    { type: CT.GATE, label: 'XNOR', params: { gate: GATE_TYPES.XNOR } }
  ]}
];

class UI {
  constructor(canvas, circ, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.circ = circ;
    opts = opts || {};
    this.onStateChange = opts.onStateChange || (() => {});
    this.onSelect = opts.onSelect || (() => {});

    // 视图变换
    this.view = { scale: 1, ox: 0, oy: 0 };
    this.selectedId = null;
    this.hoverId = null;
    this.dragging = null;       // { mode:'move'|'wire', compId, termIdx, startX, startY }
    this.wireSrc = null;        // { compId, termIdx }
    this.paletteDrag = null;    // { type, params }

    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._bindEvents();
    this._render();
  }

  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = r.width * devicePixelRatio;
    this.canvas.height = r.height * devicePixelRatio;
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    this._render();
  }

  // 屏幕 → 画布坐标（已应用 view 变换）
  _canvasPos(e) {
    const r = this.canvas.getBoundingClientRect();
    const sx = (e.clientX - r.left) / this.view.scale + this.view.ox;
    const sy = (e.clientY - r.top) / this.view.scale + this.view.oy;
    return { x: sx, y: sy };
  }

  _bindEvents() {
    const c = this.canvas;

    c.addEventListener('mousedown', (e) => this._onDown(e));
    c.addEventListener('mousemove', (e) => this._onMove(e));
    window.addEventListener('mouseup', (e) => this._onUp(e));
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      this.view.scale = Math.max(0.2, Math.min(5, this.view.scale * factor));
      this.view.ox = mx / this.view.scale - (mx / this.view.scale - this.view.ox) * (this.view.scale / (this.view.scale / factor));
      this.view.oy = my / this.view.scale - (my / this.view.scale - this.view.oy) * (this.view.scale / (this.view.scale / factor));
      this._render();
    }, { passive: false });

    c.addEventListener('dblclick', (e) => {
      const p = this._canvasPos(e);
      const hit = this._hitTest(p);
      if (!hit) {
        // 双击空白：删除选中
        if (this.selectedId) { this.circ.removeComponent(this.selectedId); this.selectedId = null; this._render(); }
      }
    });

    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const p = this._canvasPos(e);
      const hit = this._hitTerm(p);
      if (hit) {
        // 右键点击端点：开始连线
        this.wireSrc = hit;
        this.dragging = { mode: 'wire', compId: hit.compId, termIdx: hit.termIdx, startX: p.x, startY: p.y };
        this._render();
      }
    });

    // 拖入
    c.addEventListener('dragover', (e) => { e.preventDefault(); });
    c.addEventListener('drop', (e) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      try {
        const item = JSON.parse(data);
        const p = this._canvasPos(e);
        this._addComponentAt(item.type, item.params, p);
      } catch (err) { /* ignore */ }
    });
  }

  _onDown(e) {
    const p = this._canvasPos(e);
    if (e.button === 2) return; // 右键由 contextmenu 处理
    if (e.button !== 0) return;

    const term = this._hitTerm(p);
    if (term) {
      // 点击端点：开始连线
      this.wireSrc = term;
      this.dragging = { mode: 'wire', compId: term.compId, termIdx: term.termIdx, startX: p.x, startY: p.y };
      this.selectedId = term.compId;
      if (this.onSelect) this.onSelect(term.compId);
      this._render();
      return;
    }

    const comp = this._hitComp(p);
    if (comp) {
      this.selectedId = comp.id;
      this.dragging = { mode: 'move', compId: comp.id, startX: p.x, startY: p.y,
        offX: p.x - comp.pos.x, offY: p.y - comp.pos.y };
      if (this.onSelect) this.onSelect(comp.id);
      this._render();
      return;
    }

    // 点击空白：取消选择
    this.selectedId = null;
    this.wireSrc = null;
    if (this.onSelect) this.onSelect(null);
    this._render();
  }

  _onMove(e) {
    const p = this._canvasPos(e);
    if (!this.dragging) {
      // hover 检测
      const comp = this._hitComp(p);
      this.hoverId = comp ? comp.id : null;
      this._render();
      return;
    }

    if (this.dragging.mode === 'move') {
      const c = this.circ.comps.get(this.dragging.compId);
      if (c) {
        c.pos = { x: p.x - this.dragging.offX, y: p.y - this.dragging.offY };
        this._render();
      }
    } else if (this.dragging.mode === 'wire') {
      this.dragging.curX = p.x;
      this.dragging.curY = p.y;
      this._render();
    }
  }

  _onUp(e) {
    if (!this.dragging) return;
    const p = this._canvasPos(e);

    if (this.dragging.mode === 'move') {
      this.dragging = null;
      this._render();
      return;
    }

    // 连线模式：检查是否落到另一个端点上
    const target = this._hitTerm(p);
    if (target && !(target.compId === this.wireSrc.compId && target.termIdx === this.wireSrc.termIdx)) {
      this._connect(this.wireSrc, target);
    }
    this.wireSrc = null;
    this.dragging = null;
    this._render();
  }

  // 连接两个端点（合并节点）
  _connect(src, dst) {
    const sc = this.circ.comps.get(src.compId);
    const dc = this.circ.comps.get(dst.compId);
    if (!sc || !dc) return;
    const sa = sc.terminals[src.termIdx];
    const da = dc.terminals[dst.termIdx];
    if (sa.nodeId == null && da.nodeId == null) {
      const nid = this.circ.addNode();
      sa.nodeId = nid; da.nodeId = nid;
    } else if (sa.nodeId == null) {
      sa.nodeId = da.nodeId;
    } else if (da.nodeId == null) {
      da.nodeId = sa.nodeId;
    } else if (sa.nodeId !== da.nodeId) {
      // 合并两个已有节点
      const keep = sa.nodeId, remove = da.nodeId;
      for (const c of this.circ.comps.values()) {
        for (const t of c.terminals) { if (t.nodeId === remove) t.nodeId = keep; }
      }
      this.circ.nodes.delete(remove);
    }
    this.onStateChange();
    this._render();
  }

  // 在指定位置添加元件
  _addComponentAt(type, params, pos) {
    const termCount = GEOMETRY[type] ? GEOMETRY[type].pts.length : 2;
    const ids = [];
    for (let i = 0; i < termCount; i++) ids.push(null);
    const id = this.circ.addComponent(type, Object.assign({}, params), ids);
    const c = this.circ.comps.get(id);
    c.pos = { x: pos.x, y: pos.y };
    c.rot = 0;
    this.selectedId = id;
    this.onStateChange();
    this._render();
    return id;
  }

  // 命中检测：元件
  _hitComp(p) {
    let best = null, bestD = Infinity;
    for (const c of this.circ.comps.values()) {
      if (!c.pos) continue;
      const g = GEOMETRY[c.type];
      if (!g) continue;
      const dx = p.x - c.pos.x, dy = p.y - c.pos.y;
      const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const w = (g.w || 60) / 2 + 8;
      const h = (g.h || 30) / 2 + 8;
      if (Math.abs(lx) <= w && Math.abs(ly) <= h) {
        const d = Math.abs(lx) + Math.abs(ly);
        if (d < bestD) { bestD = d; best = c; }
      }
    }
    return best;
  }

  // 命中检测：端点
  _hitTerm(p) {
    for (const c of this.circ.comps.values()) {
      if (!c.pos) continue;
      for (let i = 0; i < c.terminals.length; i++) {
        const tp = terminalWorldPos(c, c.pos, c.rot || 0, i);
        if (Math.hypot(p.x - tp.x, p.y - tp.y) <= 10) {
          return { compId: c.id, termIdx: i };
        }
      }
    }
    return null;
  }

  // 渲染（含连线预览）
  _render() {
    const opts = { time: performance.now() * 0.001, selectedId: this.selectedId, hoverId: this.hoverId };
    // 暂存预览线
    const preview = (this.dragging && this.dragging.mode === 'wire')
      ? { src: this.wireSrc, x: this.dragging.curX, y: this.dragging.curY } : null;
    draw(this.ctx, this.circ, this._voltages, this._currents, opts);
    if (preview) {
      const sc = this.circ.comps.get(preview.src.compId);
      if (sc && sc.pos) {
        const sp = terminalWorldPos(sc, sc.pos, sc.rot || 0, preview.src.termIdx);
        this.ctx.beginPath();
        this.ctx.moveTo(sp.x, sp.y);
        this.ctx.lineTo(preview.x, preview.y);
        this.ctx.strokeStyle = '#ffd166';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }
    }
  }

  // 由外部（app.js）更新仿真结果后重绘
  update(voltages, currents) {
    this._voltages = voltages;
    this._currents = currents;
    this._render();
  }

  // 参数面板渲染（写入指定容器）
  renderPanel(container) {
    container.innerHTML = '';
    if (!this.selectedId) {
      container.innerHTML = '<div style="color:#888;padding:8px;">点击元件以编辑参数</div>';
      return;
    }
    const c = this.circ.comps.get(this.selectedId);
    if (!c) return;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'font-size:12px;color:#e6e6e6;';

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:bold;margin-bottom:8px;color:#ffd166;';
    title.textContent = c.type + ' #' + c.id;
    wrap.appendChild(title);

    // 标签输入
    const lblRow = document.createElement('div');
    lblRow.style.cssText = 'margin-bottom:8px;';
    lblRow.innerHTML = '<span style="color:#9aa0a6;">标签</span> ' +
      '<input id="lbl" type="text" value="' + (c.params.label || '') + '" ' +
      'style="background:#2a2a3a;border:1px solid #444;color:#e6e6e6;padding:4px;width:120px;">';
    wrap.appendChild(lblRow);

    // 数值参数
    const numFields = this._numFields(c.type);
    for (const f of numFields) {
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:6px;';
      row.innerHTML = '<span style="color:#9aa0a6;width:60px;display:inline-block;">' + f.label + '</span> ' +
        '<input id="p_' + f.key + '" type="number" step="' + f.step + '" value="' + (c.params[f.key] || 0) + '" ' +
        'style="background:#2a2a3a;border:1px solid #444;color:#e6e6e6;padding:4px;width:100px;">';
      wrap.appendChild(row);
    }

    // 门类型选择
    if (c.type === CT.GATE) {
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:6px;';
      row.innerHTML = '<span style="color:#9aa0a6;">门类型</span> ' +
        '<select id="p_gate" style="background:#2a2a3a;border:1px solid #444;color:#e6e6e6;padding:4px;">' +
        Object.keys(GATE_TYPES).map((k) => '<option value="' + GATE_TYPES[k] + '"' +
          (c.params.gate === GATE_TYPES[k] ? ' selected' : '') + '>' + k + '</option>').join('') +
        '</select>';
      wrap.appendChild(row);
    }

    // 交换机状态
    if (c.type === CT.SWITCH) {
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:6px;';
      row.innerHTML = '<span style="color:#9aa0a6;">状态</span> ' +
        '<label><input type="checkbox" id="p_closed" ' + (c.state.closed ? 'checked' : '') + '> 闭合</label>';
      wrap.appendChild(row);
    }

    // AC 波形
    if (c.type === CT.AC) {
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:6px;';
      row.innerHTML = '<span style="color:#9aa0a6;">波形</span> ' +
        '<select id="p_wave" style="background:#2a2a3a;border:1px solid #444;color:#e6e6e6;padding:4px;">' +
        ['sine', 'square', 'triangle'].map((w) => '<option value="' + w + '"' +
          (c.params.waveform === w ? ' selected' : '') + '>' + w + '</option>').join('') +
        '</select>';
      wrap.appendChild(row);
    }

    // 删除按钮
    const del = document.createElement('button');
    del.textContent = '删除元件';
    del.style.cssText = 'margin-top:10px;background:#6b2232;border:none;color:#fff;padding:6px 12px;cursor:pointer;border-radius:4px;';
    del.onclick = () => { this.circ.removeComponent(this.selectedId); this.selectedId = null; this.onStateChange(); this.renderPanel(container); this._render(); };
    wrap.appendChild(del);

    // 应用参数
    const apply = () => {
      const lbl = wrap.querySelector('#lbl');
      if (lbl) c.params.label = lbl.value;
      for (const f of numFields) {
        const el = wrap.querySelector('#p_' + f.key);
        if (el) c.params[f.key] = parseFloat(el.value) || 0;
      }
      const gateSel = wrap.querySelector('#p_gate');
      if (gateSel) c.params.gate = gateSel.value;
      const waveSel = wrap.querySelector('#p_wave');
      if (waveSel) c.params.waveform = waveSel.value;
      const sw = wrap.querySelector('#p_closed');
      if (sw) c.state.closed = sw.checked;
      this.onStateChange();
      this._render();
    };
    wrap.querySelectorAll('input, select').forEach((el) => el.addEventListener('change', apply));

    container.appendChild(wrap);
  }

  _numFields(type) {
    switch (type) {
      case CT.VOLTAGE: return [{ key: 'v', label: '电压 V', step: '0.1' }];
      case CT.CURRENT: return [{ key: 'i', label: '电流 A', step: '0.001' }];
      case CT.RESISTOR: return [{ key: 'r', label: '电阻 Ω', step: '1' }];
      case CT.CAPACITOR: return [{ key: 'c', label: '电容 F', step: '1e-6' }];
      case CT.INDUCTOR: return [{ key: 'l', label: '电感 H', step: '1e-6' }];
      case CT.AC: return [
        { key: 'amp', label: '幅值 V', step: '0.1' },
        { key: 'freq', label: '频率 Hz', step: '1' },
        { key: 'offset', label: '偏置 V', step: '0.1' }
      ];
      case CT.OPAMP: return [
        { key: 'gain', label: '增益', step: '1000' },
        { key: 'supply', label: '供电 V', step: '0.5' }
      ];
      default: return [];
    }
  }

  // 清空画布
  clear() {
    this.circ.clear();
    this.selectedId = null;
    this.wireSrc = null;
    this.dragging = null;
    if (this.onSelect) this.onSelect(null);
    this._render();
  }

  // 加载网表
  loadJSON(json) {
    this.circ.fromJSON(json);
    this.selectedId = null;
    this._render();
  }

  // 导出网表
  toJSON() { return this.circ.toJSON(); }
}

module.exports = { UI, PALETTE };
if (typeof window !== 'undefined') { window.UI = UI; window.PALETTE = PALETTE; }