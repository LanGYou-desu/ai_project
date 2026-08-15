'use strict';
// ============================================================
// 声音考古学 · 示波器视图（v3 重写）
// 波形图（时间域）+ 频谱图（FFT 对数频率轴，磷光绿配色）
//
// 数据来源：ScriptProcessorNode 直接抓取主输出音频流到环形缓冲，
// 频谱由内置 1024 点 FFT 计算。不使用 AnalyserNode —— 长复用/预创建
// 的分析器节点在部分环境下会退化收不到信号（实测确认），
// 本方案从物理上杜绝该问题：抓到的就是真实采样。
// ============================================================

const LabViews = (() => {
  // ---------- 内置 FFT（1024 点，radix-2，预计算位反转与旋转因子） ----------

  const FFT_N = 1024;
  const FFT_LOG = 10;
  const BITREV = new Int16Array(FFT_N);
  const TW_RE = new Float64Array(FFT_N / 2);
  const TW_IM = new Float64Array(FFT_N / 2);
  (function initFFT() {
    for (let i = 0; i < FFT_N; i++) {
      let r = 0;
      for (let b = 0; b < FFT_LOG; b++) r |= ((i >> b) & 1) << (FFT_LOG - 1 - b);
      BITREV[i] = r;
    }
    for (let k = 0; k < FFT_N / 2; k++) {
      const ang = -2 * Math.PI * k / FFT_N;
      TW_RE[k] = Math.cos(ang);
      TW_IM[k] = Math.sin(ang);
    }
  })();
  const HANN = new Float32Array(FFT_N);
  for (let i = 0; i < FFT_N; i++) HANN[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FFT_N - 1));

  // 输入 1024 采样（已加窗）→ 输出 512 个幅度（bin → dBFS）
  function fftDb(frame, out) {
    const re = new Float64Array(FFT_N);
    const im = new Float64Array(FFT_N);
    for (let i = 0; i < FFT_N; i++) re[BITREV[i]] = frame[i];
    for (let len = 2; len <= FFT_N; len <<= 1) {
      const half = len >> 1;
      const step = FFT_N / len;
      for (let i = 0; i < FFT_N; i += len) {
        for (let k = 0; k < half; k++) {
          const t = k * step;
          const wr = TW_RE[t], wi = TW_IM[t];
          const ar = re[i + k], ai = im[i + k];
          const br = re[i + k + half] * wr - im[i + k + half] * wi;
          const bi = re[i + k + half] * wi + im[i + k + half] * wr;
          re[i + k] = ar + br;
          im[i + k] = ai + bi;
          re[i + k + half] = ar - br;
          im[i + k + half] = ai - bi;
        }
      }
    }
    const bins = FFT_N >> 1;
    for (let k = 0; k < bins; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      const db = 20 * Math.log10((4 * mag) / FFT_N + 1e-12);
      // 映射 -65..-35dB → 0..255（按各素材实测电平校准）：
      // 纯音线索(-5..-15) → 全亮；雨声宽带底噪(-39) → 亮墙；
      // 空气声(-62) → 近乎不可见；房间底噪(< -90) → 暗底
      out[k] = db < -65 ? 0 : Math.min(255, (db + 65) / 30 * 255);
    }
  }

  // ---------- 磷光绿调色板 ----------

  function buildPalette() {
    const pal = [];
    const stops = [
      [0.00, 3, 14, 8],
      [0.35, 8, 52, 28],
      [0.60, 20, 130, 66],
      [0.82, 90, 230, 150],
      [1.00, 240, 255, 245],
    ];
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let a = stops[0], b = stops[stops.length - 1];
      for (let s = 0; s < stops.length - 1; s++) {
        if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
      }
      const f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
      pal.push([
        Math.round(a[1] + (b[1] - a[1]) * f),
        Math.round(a[2] + (b[2] - a[2]) * f),
        Math.round(a[3] + (b[3] - a[3]) * f),
      ]);
    }
    return pal;
  }
  const PALETTE = buildPalette();

  // ---------- 频谱视图 ----------

  class SpectroView {
    constructor(canvas, ctx, opts) {
      this.cv = canvas;
      this.g = canvas.getContext('2d');
      this.audioCtx = ctx;
      this.fMin = (opts && opts.fMin) || 50;
      this.fMax = (opts && opts.fMax) || null;
      this.pxPerSec = (opts && opts.pxPerSec) || 120;
      this._acc = 0;
      this.hist = [];
      this.img = null;
      this.yBin = null;
      this.frame = new Float32Array(FFT_N);
      this.db = new Float64Array(FFT_N >> 1);
      this.col = new Uint8Array(FFT_N >> 1);
      this._resize();
    }

    setFMax(f) {
      this.fMax = f || null;
      this._resize();
    }

    _topFreq() {
      return this.fMax || this.audioCtx.sampleRate / 2;
    }

    _resize() {
      this.cv.width = Math.max(2, this.cv.clientWidth);
      this.cv.height = Math.max(2, this.cv.clientHeight);
      this.g.setTransform(1, 0, 0, 1, 0, 0);
      this.w = this.cv.width;
      this.h = this.cv.height;
      this.img = this.g.createImageData(this.w, this.h);
      this.hist = [];
      const top = this._topFreq();
      const bins = FFT_N >> 1;
      const l0 = Math.log(this.fMin), l1 = Math.log(top);
      this.yBin = new Int32Array(this.h);
      for (let y = 0; y < this.h; y++) {
        const f = Math.exp(l0 + (l1 - l0) * (this.h - 5 - y) / (this.h - 8));
        this.yBin[y] = Math.min(bins - 1, Math.max(0, Math.floor(f / top * bins)));
      }
      this._paint();
      this._drawGrid();
    }

    _paint() {
      const W = this.w, H = this.h;
      const img = this.img.data;
      for (let i = 0; i < img.length; i += 4) {
        img[i] = 4; img[i + 1] = 18; img[i + 2] = 10; img[i + 3] = 255;
      }
      const n = this.hist.length;
      for (let x = 0; x < W && x < n; x++) {
        const col = this.hist[n - 1 - x];
        for (let y = 0; y < H; y++) {
          const v = col[this.yBin[y]];
          if (v < 8) continue;
          const p = PALETTE[v];
          const i = (y * W + x) * 4;
          img[i] = p[0]; img[i + 1] = p[1]; img[i + 2] = p[2];
        }
      }
      this.g.putImageData(this.img, 0, 0);
    }

    _drawGrid() {
      const g = this.g;
      const W = this.w, H = this.h;
      const top = this._topFreq();
      g.strokeStyle = 'rgba(61,255,138,0.25)';
      g.lineWidth = 1;
      g.font = '9px Consolas, monospace';
      g.fillStyle = 'rgba(61,255,138,0.8)';
      for (const k of [1, 2, 4, 8, 16, 20]) {
        const f = k * 1000;
        if (f >= top) continue;
        const lf = Math.log(f), l0 = Math.log(this.fMin), l1 = Math.log(top);
        const y = H - 1 - ((lf - l0) / (l1 - l0)) * (H - 8) - 4;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
        g.fillText(k >= 20 ? '20k' : k + 'k', 2, y - 2);
      }
      if (this.pxPerSec > 0) {
        const stepPx = this.pxPerSec * 2;
        for (let x = W - 1; x > 0; x -= stepPx) {
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x, H);
          g.stroke();
        }
      }
    }

    // 从环形缓冲取最近 FFT_N 个采样 → FFT → 新列
    _column(ring) {
      const rLen = ring.length;
      let pos = ring.pos;
      for (let i = 0; i < FFT_N; i++) {
        pos = (pos - 1 + rLen) % rLen;
        this.frame[i] = ring.buf[pos] * HANN[i];
      }
      fftDb(this.frame, this.db);
      const bins = FFT_N >> 1;
      for (let i = 0; i < bins; i++) {
        this.col[i] = this.db[i] < 0 ? 0 : (this.db[i] > 255 ? 255 : this.db[i]);
      }
      return this.col;
    }

    _frame(dt, ring) {
      this._acc += dt;
      if (this._acc < 1 / this.pxPerSec) return;
      this._acc -= 1 / this.pxPerSec;
      this.hist.push(this._column(ring).slice());
      if (this.hist.length > this.w) this.hist.shift();
      this._paint();
      this._drawGrid();
    }
  }

  // ---------- 波形视图 ----------

  class WaveView {
    constructor(canvas, ctx, opts) {
      this.cv = canvas;
      this.g = canvas.getContext('2d');
      this.audioCtx = ctx;
      this.pxPerSec = (opts && opts.pxPerSec) || 120;
      this.fracFn = null;
      this._acc = 0;
      this.hist = [];
      this.img = null;
      this._resize();
    }

    _resize() {
      this.cv.width = Math.max(2, this.cv.clientWidth);
      this.cv.height = Math.max(2, this.cv.clientHeight);
      this.g.setTransform(1, 0, 0, 1, 0, 0);
      this.w = this.cv.width;
      this.h = this.cv.height;
      this.img = this.g.createImageData(this.w, this.h);
      this.hist = [];
      this._paint();
    }

    _paint() {
      const W = this.w, H = this.h;
      const img = this.img.data;
      for (let i = 0; i < img.length; i += 4) {
        img[i] = 4; img[i + 1] = 18; img[i + 2] = 10; img[i + 3] = 255;
      }
      const n = this.hist.length;
      const half = H / 2 - 2;
      for (let x = 0; x < W && x < n; x++) {
        const [lo, hi] = this.hist[n - 1 - x];
        const y0 = Math.max(0, Math.floor(half - ((hi - 128) / 128) * half));
        const y1 = Math.min(H - 1, Math.ceil(half - ((lo - 128) / 128) * half));
        for (let y = y0; y <= y1; y++) {
          const i = (y * W + x) * 4;
          img[i] = 61; img[i + 1] = 255; img[i + 2] = 138;
        }
      }
      this.g.putImageData(this.img, 0, 0);
      this.g.strokeStyle = 'rgba(61,255,138,0.12)';
      this.g.beginPath();
      this.g.moveTo(0, H / 2);
      this.g.lineTo(W, H / 2);
      this.g.stroke();
      if (this.fracFn) {
        const fx = this.fracFn() * W;
        this.g.strokeStyle = 'rgba(255,209,102,0.8)';
        this.g.beginPath();
        this.g.moveTo(fx, 0);
        this.g.lineTo(fx, H);
        this.g.stroke();
      }
    }

    _frame(dt, ring) {
      this._acc += dt;
      if (this._acc < 1 / this.pxPerSec) return;
      this._acc -= 1 / this.pxPerSec;
      // 取最近 1024 个采样的峰值
      const rLen = ring.length;
      let pos = ring.pos;
      let lo = 255, hi = 0;
      for (let i = 0; i < 1024; i++) {
        pos = (pos - 1 + rLen) % rLen;
        const v = ring.buf[pos];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      this.hist.push([lo, hi]);
      if (this.hist.length > this.w) this.hist.shift();
      this._paint();
    }
  }

  // ---------- 视图集合（含音频流抓取） ----------

  class LabViews {
    constructor(waveCanvas, specCanvas, masterNode, ctx) {
      this.ctx = ctx;
      this.masterNode = masterNode;
      // ScriptProcessor 抓取主输出 → 环形缓冲（1 秒）
      this.ring = { buf: new Float32Array(ctx.sampleRate), pos: 0, length: ctx.sampleRate };
      this.tap = ctx.createScriptProcessor(4096, 1, 1);
      this.tap.onaudioprocess = (e) => {
        const ch = e.inputBuffer.getChannelData(0);
        const ring = this.ring;
        for (let i = 0; i < ch.length; i++) {
          ring.buf[ring.pos] = ch[i];
          ring.pos = (ring.pos + 1) % ring.length;
        }
        // 输出必须置零，否则会与原声音叠加
        e.outputBuffer.getChannelData(0).fill(0);
      };
      masterNode.connect(this.tap);
      this.tap.connect(ctx.destination);
      this.wave = new WaveView(waveCanvas, ctx, { pxPerSec: 90 });
      this.spec = new SpectroView(specCanvas, ctx, { pxPerSec: 90 });
      this._raf = 0;
      this._last = 0;
      this.onTick = null;
      this.running = false;
    }

    // 自检用：最近 0.5s 的 RMS
    tapRms() {
      const ring = this.ring;
      let e = 0, n = 0;
      const half = Math.floor(ring.length / 2);
      let pos = ring.pos;
      for (let i = 0; i < half; i++) {
        pos = (pos - 1 + ring.length) % ring.length;
        e += ring.buf[pos] * ring.buf[pos];
        n++;
      }
      return Math.sqrt(e / n);
    }

    setFracFn(fn) {
      this.wave.fracFn = fn;
    }

    start() {
      if (this.running) return;
      this.running = true;
      this._last = performance.now();
      const loop = (now) => {
        if (!this.running) return;
        const dt = Math.min(0.1, (now - this._last) / 1000);
        this._last = now;
        this.wave._frame(dt, this.ring);
        this.spec._frame(dt, this.ring);
        if (this.onTick) this.onTick(dt);
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this._raf);
    }
  }

  return LabViews;
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LabViews };
}
