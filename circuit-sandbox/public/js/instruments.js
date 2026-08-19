'use strict';
// 电路沙盒 · 测量仪器
// Oscilloscope：双通道波形显示。Multimeter：两点电压/电流/电阻测量。

// 简单 RC 低通滤波器状态（用于示波器输入耦合示意），实际直接采样节点电压。

class Oscilloscope {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    opts = opts || {};
    this.channels = opts.channels || 2;
    this.timebase = opts.timebase || 0.001; // 每格秒
    this.divs = opts.divs || 10;            // 水平格数
    this.trig = opts.trig || null;          // { node, level }
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = r.width * devicePixelRatio;
    this.canvas.height = r.height * devicePixelRatio;
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  // 采样数据：[{t, ch:[v1,v2]}]
  render(traces) {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, w, h);

    // 网格
    ctx.strokeStyle = '#1f1f2a';
    ctx.lineWidth = 1;
    const xStep = w / this.divs;
    const yStep = h / 8;
    for (let i = 0; i <= this.divs; i++) {
      ctx.beginPath(); ctx.moveTo(i * xStep, 0); ctx.lineTo(i * xStep, h); ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * yStep); ctx.lineTo(w, i * yStep); ctx.stroke();
    }

    if (!traces || !traces.length) {
      ctx.fillStyle = '#666';
      ctx.font = '12px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('无信号', w / 2, h / 2);
      return;
    }

    const colors = ['#06d6a0', '#ffd166'];
    const tMin = traces[0].t, tMax = traces[traces.length - 1].t;
    const tRange = Math.max(tMax - tMin, 1e-9);
    const xScale = w / (this.timebase * this.divs);

    for (let ch = 0; ch < this.channels; ch++) {
      ctx.strokeStyle = colors[ch] || '#ff6b6b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (const s of traces) {
        const v = s.ch[ch];
        if (v === undefined || v === null) continue;
        const x = (s.t - tMin) * xScale;
        if (x < 0 || x > w) continue;
        // 归一化电压到 y：假设 ±5V 占满 8 格
        const y = h / 2 - (v / 5) * (h / 2);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 触发线
    if (this.trig) {
      const y = h / 2 - (this.trig.level / 5) * (h / 2);
      ctx.strokeStyle = '#ff6b6b';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.setLineDash([]);
    }

    // 标注
    ctx.fillStyle = '#9aa0a6';
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('t=' + this.timebase.toExponential(1) + 's/div', 6, 12);
    for (let ch = 0; ch < this.channels; ch++) {
      ctx.fillStyle = colors[ch] || '#ff6b6b';
      ctx.fillText('CH' + (ch + 1), w - 60, 12 + ch * 14);
    }
  }
}

class Multimeter {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    opts = opts || {};
    this.mode = opts.mode || 'voltage'; // voltage | current | resistance
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = r.width * devicePixelRatio;
    this.canvas.height = r.height * devicePixelRatio;
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  render(value, opts) {
    opts = opts || {};
    const ctx = this.ctx;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, w, h);

    // 边框
    ctx.strokeStyle = '#444';
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // 模式指示
    ctx.fillStyle = '#9aa0a6';
    ctx.font = '11px Consolas, monospace';
    ctx.textAlign = 'left';
    const modeLabel = { voltage: 'V 电压', current: 'A 电流', resistance: 'Ω 电阻' }[this.mode] || 'V';
    ctx.fillText(modeLabel, 10, 16);

    // 数值
    ctx.fillStyle = '#06d6a0';
    ctx.font = '22px Consolas, monospace';
    ctx.textAlign = 'right';
    let disp;
    if (value === null || value === undefined || !isFinite(value)) disp = '--';
    else if (this.mode === 'resistance') disp = value >= 1e6 ? (value / 1e6).toFixed(2) + 'M' :
      value >= 1e3 ? (value / 1e3).toFixed(2) + 'k' : value.toFixed(2);
    else if (this.mode === 'current') disp = value.toExponential(2);
    else disp = value.toFixed(3);
    ctx.fillText(disp, w - 10, h / 2 + 8);

    // 探针点
    if (opts.probeA && opts.probeB) {
      ctx.fillStyle = '#ffd166';
      ctx.textAlign = 'left';
      ctx.fillText('A: ' + opts.probeA, 10, h - 18);
      ctx.fillStyle = '#06d6a0';
      ctx.fillText('B: ' + opts.probeB, 10, h - 4);
    } else if (opts.probeA) {
      ctx.fillStyle = '#ffd166';
      ctx.textAlign = 'left';
      ctx.fillText('探针: ' + opts.probeA, 10, h - 10);
    }
  }
}

module.exports = { Oscilloscope, Multimeter };
if (typeof window !== 'undefined') { window.Oscilloscope = Oscilloscope; window.Multimeter = Multimeter; }