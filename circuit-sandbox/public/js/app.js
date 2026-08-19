'use strict';
// 电路沙盒 · 主应用
// 编排：UI + 引擎 + 仪器 + 关卡。播放循环驱动瞬态仿真，刷新示波器/万用表。

const { CT, Circuit } = (typeof window !== 'undefined' && window.CT) ? { CT: window.CT, Circuit: window.Circuit } : require('./circuit.js');
const { step, settle, DT } = (typeof window !== 'undefined' && window.Engine) ? window.Engine : require('./engine.js');
const { UI, PALETTE } = (typeof window !== 'undefined' && window.UI) ? { UI: window.UI, PALETTE: window.PALETTE } : require('./ui.js');
const { Oscilloscope, Multimeter } = (typeof window !== 'undefined' && window.Oscilloscope) ? { Oscilloscope: window.Oscilloscope, Multimeter: window.Multimeter } : require('./instruments.js');
const { LEVELS, runLevel } = (typeof window !== 'undefined' && window.LEVELS) ? { LEVELS: window.LEVELS, runLevel: window.runLevel } : require('./levels.js');

class App {
  constructor(opts) {
    opts = opts || {};
    this.circuit = new Circuit();
    this.ui = new UI(opts.canvas, this.circuit, {
      onStateChange: () => this.onCircuitChange(),
      onSelect: (id) => this.onSelect(id)
    });

    // 仪器
    this.oscope = new Oscilloscope(opts.oscopeCanvas);
    this.meter = new Multimeter(opts.meterCanvas);

    // 仿真状态
    this.running = false;
    this.t = 0;
    this.traces = [];          // {t, ch:[v1,v2]}
    this.maxTraces = 500;
    this.probeA = null;        // 节点 id
    this.probeB = null;

    // 关卡
    this.currentLevel = null;

    this._buildPalette();
    this._bindToolbar();
    this._bindProbe();
    this._loop();
  }

  _buildPalette() {
    const pal = document.getElementById('palette');
    if (!pal) return;
    pal.innerHTML = '';
    for (const g of PALETTE) {
      const group = document.createElement('div');
      group.style.cssText = 'margin-bottom:10px;';
      const gh = document.createElement('div');
      gh.style.cssText = 'font-size:11px;color:#ffd166;margin-bottom:4px;font-weight:bold;';
      gh.textContent = g.group;
      group.appendChild(gh);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
      for (const item of g.items) {
        const chip = document.createElement('div');
        chip.textContent = item.label;
        chip.style.cssText = 'background:#2a2a3a;border:1px solid #444;color:#e6e6e6;' +
          'padding:6px 10px;border-radius:4px;font-size:12px;cursor:grab;user-select:none;';
        chip.draggable = true;
        chip.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('application/json', JSON.stringify({ type: item.type, params: item.params }));
          e.dataTransfer.effectAllowed = 'copy';
        });
        row.appendChild(chip);
      }
      group.appendChild(row);
      pal.appendChild(group);
    }
  }

  _bindProbe() {
    const radios = document.querySelectorAll('input[name="probe"]');
    radios.forEach((r) => {
      r.addEventListener('change', () => {
        if (r.value === 'A') { this.probeB = null; }
        else if (r.value === 'B') { if (this.probeA === null) this.probeA = 0; }
        else { this.probeA = null; this.probeB = null; }
      });
    });
    // 点击节点设置探针
    this.ui.canvas.addEventListener('click', (e) => {
      // 仅在探针模式下且未拖动时生效
      if (this._probeMode) this._setProbeFromClick(e);
    });
  }

  _setProbeFromClick(e) {
    // 简化：点击位置最近的节点
    const rect = this.ui.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.ui.view.scale + this.ui.view.ox;
    const y = (e.clientY - rect.top) / this.ui.view.scale + this.ui.view.oy;
    let best = null, bestD = Infinity;
    for (const c of this.circuit.comps.values()) {
      if (!c.pos) continue;
      for (let i = 0; i < c.terminals.length; i++) {
        const t = c.terminals[i];
        if (t.nodeId == null) continue;
        const tp = (typeof window !== 'undefined' && window.Render)
          ? window.Render.terminalWorldPos(c, c.pos, c.rot || 0, i)
          : null;
        if (!tp) continue;
        const d = Math.hypot(x - tp.x, y - tp.y);
        if (d < bestD) { bestD = d; best = t.nodeId; }
      }
    }
    if (best !== null && bestD < 12) {
      if (this.probeA === null) this.probeA = best;
      else if (this.probeB === null && best !== this.probeA) this.probeB = best;
      else { this.probeA = best; this.probeB = null; }
      this._updateInstruments();
    }
  }

  onSelect(id) {
    const panel = document.getElementById('param-panel');
    if (panel) this.ui.renderPanel(panel);
  }

  _bindToolbar() {
    const btn = (id) => document.getElementById(id);
    const play = btn('btn-play');
    const stop = btn('btn-stop');
    const clear = btn('btn-clear');
    const save = btn('btn-save');
    const load = btn('btn-load');
    const levelSel = btn('level-select');

    if (play) play.onclick = () => { this.running = !this.running; play.textContent = this.running ? '⏸ 暂停' : '▶ 播放'; };
    if (stop) stop.onclick = () => { this.running = false; this.t = 0; this.traces = []; this._updateInstruments(); };
    if (clear) clear.onclick = () => { this.ui.clear(); this.traces = []; this._updateInstruments(); };
    if (save) save.onclick = () => this._save();
    if (load) load.onclick = () => this._load();
    if (levelSel) levelSel.onchange = (e) => {
      const id = parseInt(e.target.value, 10);
      if (id) this.loadLevel(id);
    };
  }

  // 仿真主循环
  _loop() {
    if (this.running) {
      this.t += DT;
      const r = step(this.circuit, this.t, DT);
      if (r.ok) {
        this._recordTrace(r.voltages);
        this.ui.update(r.voltages, r.currents);
        this._updateInstruments();
      } else {
        this.running = false;
        const play = document.getElementById('btn-play');
        if (play) play.textContent = '▶ 播放';
        console.warn('仿真失败:', r.errors);
      }
    }
    requestAnimationFrame(() => this._loop());
  }

  _recordTrace(voltages) {
    const ch = [];
    if (this.probeA !== null) ch.push(voltages.get(this.probeA) || 0);
    if (this.probeB !== null) ch.push(voltages.get(this.probeB) || 0);
    if (!ch.length) ch.push(0);
    this.traces.push({ t: this.t, ch });
    if (this.traces.length > this.maxTraces) this.traces.shift();
  }

  _updateInstruments() {
    this.oscope.render(this.traces);
    let v = null;
    if (this.probeA !== null && this.probeB !== null) {
      // 简化：电压 = 两点电压差（需当前电压；用 settle 近似）
      v = 0; // 由外部仿真结果更新
    }
    this.meter.render(v, { probeA: this.probeA, probeB: this.probeB });
  }

  // 从当前电路状态更新仪表（含电压读数）
  updateMeter(voltages) {
    if (this.probeA !== null && this.probeB !== null) {
      const va = voltages.get(this.probeA) || 0;
      const vb = voltages.get(this.probeB) || 0;
      this.meter.render(va - vb, { probeA: 'N' + this.probeA, probeB: 'N' + this.probeB });
    } else if (this.probeA !== null) {
      this.meter.render((voltages.get(this.probeA) || 0), { probeA: 'N' + this.probeA });
    }
  }

  // 电路变化（增删改元件）后重新稳定
  onCircuitChange() {
    this.t = 0;
    this.traces = [];
    const r = settle(this.circuit);
    if (r.ok) {
      this.ui.update(r.voltages, r.currents);
      this.updateMeter(r.voltages);
    }
    this._updateInstruments();
  }

  // 加载关卡
  loadLevel(id) {
    this.currentLevel = id;
    this.circuit.clear();
    const level = LEVELS.find((l) => l.id === id);
    if (level) level.build(this.circuit);
    this.t = 0;
    this.traces = [];
    const r = settle(this.circuit);
    if (r.ok) {
      this.ui.update(r.voltages, r.currents);
      this.updateMeter(r.voltages);
    }
    this._updateInstruments();
    this._checkLevel();
  }

  // 检查当前关卡是否通过
  _checkLevel() {
    if (!this.currentLevel) return;
    const r = runLevel(this.currentLevel);
    const el = document.getElementById('level-result');
    if (el) {
      el.textContent = r.ok ? '✓ 通过' : '✗ ' + (r.reason || '未通过');
      el.style.color = r.ok ? '#06d6a0' : '#ff6b6b';
    }
  }

  // 存档（localStorage，不入库）
  _save() {
    try {
      localStorage.setItem('circuit-sandbox', JSON.stringify(this.circuit.toJSON()));
      this._toast('已保存到本地存档');
    } catch (e) { this._toast('保存失败'); }
  }

  _load() {
    try {
      const raw = localStorage.getItem('circuit-sandbox');
      if (!raw) { this._toast('无存档'); return; }
      this.circuit.fromJSON(JSON.parse(raw));
      this.t = 0; this.traces = [];
      const r = settle(this.circuit);
      if (r.ok) { this.ui.update(r.voltages, r.currents); this.updateMeter(r.voltages); }
      this._updateInstruments();
      this._toast('已加载存档');
    } catch (e) { this._toast('加载失败'); }
  }

  _toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
        'background:#2a2a3a;border:1px solid #444;color:#e6e6e6;padding:8px 16px;' +
        'border-radius:4px;font-size:12px;z-index:100;opacity:0;transition:opacity 0.3s;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { el.style.opacity = '0'; }, 1500);
  }
}

module.exports = { App };