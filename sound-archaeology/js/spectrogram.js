'use strict';
// ============================================================
// 声音考古学 · 示波器视图（v4）
// 波形图（时间域）+ 频谱图（FFT 对数频率轴，磷光绿配色）
//
// 数据来源：ScriptProcessorNode 直接抓取主输出音频流到环形缓冲，
// 频谱由内置 1024 点 FFT 计算。不使用 AnalyserNode —— 长复用/预创建
// 的分析器节点在部分环境下会退化收不到信号（实测确认），
// 本方案从物理上杜绝该问题：抓到的就是真实采样。
//
// v4 修正/优化：
//   1) 频率→bin 映射改用 Nyquist 而非"显示上限"，修复 0–8k/0–3k 放大视图频率标错；
//   2) 波形列的采样值先映射到 0..255 字节域再画，修复波形被压成底部一条直线；
//   3) 列率由采样时钟驱动（每秒 pxPerSec 列），与 rAF 帧率解耦，时间轴才准；
//   4) 新列只滚动 + 重画一列（copyWithin + 单列写入），不再逐像素重画整幅历史；
//   5) 背景用预置 Uint8ClampedArray 一次性 set()，FFT 暂存数组复用（零逐列分配）。
// ============================================================

const LabViews = (() => {
  // ---------- 内置 FFT（1024 点，radix-2，预计算位反转与旋转因子） ----------

  const FFT_N = 1024;
  const FFT_LOG = 10;
  const BINS = FFT_N >> 1;
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

  // FFT 暂存（复用，避免每列分配 2×8KB 垃圾）
  const FFT_RE = new Float64Array(FFT_N);
  const FFT_IM = new Float64Array(FFT_N);

  // 输入 1024 采样（已加窗）→ 输出 512 个幅度（bin → dBFS）
  function fftDb(frame, out) {
    const re = FFT_RE, im = FFT_IM;
    for (let i = 0; i < FFT_N; i++) {
      re[BITREV[i]] = frame[i];
      im[i] = 0;
    }
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
    const bins = BINS;
    for (let k = 0; k < bins; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      const db = 20 * Math.log10((4 * mag) / FFT_N + 1e-12);
      // 映射 -65..-35dB → 0..255（按各素材实测电平校准）：
      // 纯音线索(-5..-15) → 全亮；雨声宽带底噪(-39) → 亮墙；
      // 空气声(-62) → 近乎不可见；房间底噪(< -90) → 暗底
      out[k] = db < -65 ? 0 : Math.min(255, (db + 65) / 30 * 255);
    }
  }

  // ---------- 频率 ↔ FFT bin ----------
  // bin k 的中心频率是 k * sr / FFT_N，即 k * (sr/2) / BINS。
  // 必须用 Nyquist(sr/2)，不能用频谱图的"显示上限"——否则选 0–8kHz / 0–3kHz
  // 放大视图时，画出来的频率会被整体放大（0–3kHz 视图里放大 3.675 倍）。

  function freqToBin(f, sr, bins) {
    const n = bins || BINS;
    const k = Math.round(f / (sr / 2) * n);
    return Math.min(n - 1, Math.max(0, k));
  }

  function binToFreq(k, sr, bins) {
    return k * (sr / 2) / (bins || BINS);
  }

  // ---------- 磷光绿调色板 ----------

  const BG_R = 4, BG_G = 18, BG_B = 10;

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

  function fillBg(arr) {
    for (let i = 0; i < arr.length; i += 4) {
      arr[i] = BG_R; arr[i + 1] = BG_G; arr[i + 2] = BG_B; arr[i + 3] = 255;
    }
    return arr;
  }

  // 在环形缓冲里定位"以 endSample 结尾的 FFT_N 个采样"的起点
  function windowStart(ring, endSample) {
    const rLen = ring.length;
    const back = ring.total - endSample;   // 距最新样本多少个采样
    let p = ring.pos - back - FFT_N;
    return ((p % rLen) + rLen) % rLen;
  }

  // ---------- 频谱视图 ----------

  class SpectroView {
    constructor(canvas, ctx, opts) {
      this.cv = canvas;
      this.g = canvas.getContext('2d');
      this.audioCtx = ctx;
      this.fMin = (opts && opts.fMin) || 50;
      this.fMax = (opts && opts.fMax) || null;
      this.pxPerSec = (opts && opts.pxPerSec) || 120;
      this.hist = [];
      this.img = null;
      this.bg = null;
      this.yBin = null;
      this.frame = new Float32Array(FFT_N);
      this.db = new Float64Array(BINS);
      this.col = new Uint8Array(BINS);
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
      this.bg = fillBg(new Uint8ClampedArray(this.w * this.h * 4));
      this.hist = [];
      const top = this._topFreq();
      const l0 = Math.log(this.fMin), l1 = Math.log(top);
      this.yBin = new Int32Array(this.h);
      for (let y = 0; y < this.h; y++) {
        const f = Math.exp(l0 + (l1 - l0) * (this.h - 5 - y) / (this.h - 8));
        this.yBin[y] = freqToBin(f, this.audioCtx.sampleRate, BINS);
      }
      this._paint();
      this._drawGrid();
    }

    // 把一列亮度（0..255）写进 img 的第 x 列
    _blitColumn(x, col) {
      const data = this.img.data, W = this.w, H = this.h;
      for (let y = 0; y < H; y++) {
        const v = col[this.yBin[y]];
        const i = (y * W + x) * 4;
        if (v < 8) {
          data[i] = BG_R; data[i + 1] = BG_G; data[i + 2] = BG_B; data[i + 3] = 255;
        } else {
          const p = PALETTE[v];
          data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = 255;
        }
      }
    }

    // 整幅重画（尺寸变化/清屏时用；最新列在 x=0）
    _paint() {
      const W = this.w;
      this.img.data.set(this.bg);
      const n = this.hist.length;
      for (let x = 0; x < W && x < n; x++) this._blitColumn(x, this.hist[n - 1 - x]);
      this.g.putImageData(this.img, 0, 0);
    }

    // 所有列右移一列，为 x=0 腾位（比逐像素重画整幅历史便宜一个数量级）
    _scrollRight() {
      const data = this.img.data, W = this.w, H = this.h;
      if (W < 2) return;
      const rowBytes = W * 4;
      for (let y = 0; y < H; y++) {
        const r = y * rowBytes;
        data.copyWithin(r + 4, r, r + rowBytes - 4);
      }
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
        const stepPx = this.pxPerSec * 2; // 每 2 秒一条竖线
        for (let x = W - 1; x > 0; x -= stepPx) {
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x, H);
          g.stroke();
        }
      }
    }

    // 从环形缓冲取以 endSample 结尾的 FFT_N 个采样 → FFT → 一列亮度
    _column(ring, endSample) {
      const rLen = ring.length;
      let p = windowStart(ring, endSample);
      const frame = this.frame;
      for (let i = 0; i < FFT_N; i++) {
        frame[i] = ring.buf[p] * HANN[i];
        p++;
        if (p === rLen) p = 0;
      }
      fftDb(frame, this.db);
      const col = this.col;
      for (let i = 0; i < BINS; i++) {
        const v = this.db[i];
        col[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
      }
      return col;
    }

    // 推入一列（由 LabViews 的采样时钟调用）
    pushColumn(ring, endSample) {
      const col = this._column(ring, endSample).slice();
      this.hist.push(col);
      if (this.hist.length > this.w) this.hist.shift();
      this._scrollRight();
      this._blitColumn(0, col);
      this.g.putImageData(this.img, 0, 0);
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
      this.hist = [];
      this.img = null;
      this.bg = null;
      this._resize();
    }

    _resize() {
      this.cv.width = Math.max(2, this.cv.clientWidth);
      this.cv.height = Math.max(2, this.cv.clientHeight);
      this.g.setTransform(1, 0, 0, 1, 0, 0);
      this.w = this.cv.width;
      this.h = this.cv.height;
      this.img = this.g.createImageData(this.w, this.h);
      this.bg = fillBg(new Uint8ClampedArray(this.w * this.h * 4));
      this.hist = [];
      this._paint();
    }

    // col = [lo, hi]，采样值已映射到 0..255 字节域（128 = 中点）
    _blitColumn(x, col) {
      const data = this.img.data, W = this.w, H = this.h;
      const half = H / 2 - 2;
      const lo = col[0], hi = col[1];
      const y0 = Math.max(0, Math.floor(half - ((hi - 128) / 128) * half));
      const y1 = Math.min(H - 1, Math.ceil(half - ((lo - 128) / 128) * half));
      for (let y = y0; y <= y1; y++) {
        const i = (y * W + x) * 4;
        data[i] = 61; data[i + 1] = 255; data[i + 2] = 138; data[i + 3] = 255;
      }
    }

    _paint() {
      const W = this.w;
      this.img.data.set(this.bg);
      const n = this.hist.length;
      for (let x = 0; x < W && x < n; x++) this._blitColumn(x, this.hist[n - 1 - x]);
      this.g.putImageData(this.img, 0, 0);
      this._drawOverlay();
    }

    _scrollRight() {
      const data = this.img.data, W = this.w, H = this.h;
      if (W < 2) return;
      const rowBytes = W * 4;
      for (let y = 0; y < H; y++) {
        const r = y * rowBytes;
        data.copyWithin(r + 4, r, r + rowBytes - 4);
      }
    }

    _drawOverlay() {
      const g = this.g, W = this.w, H = this.h;
      g.strokeStyle = 'rgba(61,255,138,0.12)';
      g.beginPath();
      g.moveTo(0, H / 2);
      g.lineTo(W, H / 2);
      g.stroke();
      if (this.fracFn) {
        const fx = this.fracFn() * W;
        g.strokeStyle = 'rgba(255,209,102,0.8)';
        g.beginPath();
        g.moveTo(fx, 0);
        g.lineTo(fx, H);
        g.stroke();
      }
    }

    // 推入一列（取以 endSample 结尾的 1024 个采样的峰峰值）
    pushColumn(ring, endSample) {
      const rLen = ring.length;
      let p = windowStart(ring, endSample);
      let lo = 1, hi = -1;
      for (let i = 0; i < FFT_N; i++) {
        const v = ring.buf[p];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
        p++;
        if (p === rLen) p = 0;
      }
      // -1..1 → 0..255 字节域，与 _blitColumn 的映射一致
      const col = [lo * 128 + 128, hi * 128 + 128];
      this.hist.push(col);
      if (this.hist.length > this.w) this.hist.shift();
      this._scrollRight();
      this._blitColumn(0, col);
      this.g.putImageData(this.img, 0, 0);
      this._drawOverlay();
    }
  }

  // ---------- 视图集合（含音频流抓取） ----------

  class LabViews {
    constructor(waveCanvas, specCanvas, masterNode, ctx) {
      this.ctx = ctx;
      this.masterNode = masterNode;
      this.pxPerSec = 90;
      // ScriptProcessor 抓取主输出 → 环形缓冲（1 秒）
      const rLen = Math.ceil(ctx.sampleRate);
      this.ring = { buf: new Float32Array(rLen), pos: 0, length: rLen, total: 0 };
      this.wave = new WaveView(waveCanvas, ctx, { pxPerSec: this.pxPerSec });
      this.spec = new SpectroView(specCanvas, ctx, { pxPerSec: this.pxPerSec });
      this._raf = 0;
      this._last = 0;
      this._cursor = -1;   // 已产出列的末尾采样位置（采样时钟）
      this.onTick = null;
      this.running = false;
      this.tap = null;

      // ScriptProcessorNode 虽已标记废弃，但无需额外文件/AudioWorklet 模块即可
      // 抓流（file:// 双击即玩的前提）。不可用时降级：没有示波器，音频照常播放。
      if (typeof ctx.createScriptProcessor === 'function') {
        try {
          const tap = ctx.createScriptProcessor(4096, 1, 1);
          const ring = this.ring;
          tap.onaudioprocess = (e) => {
            const ch = e.inputBuffer.getChannelData(0);
            for (let i = 0; i < ch.length; i++) {
              ring.buf[ring.pos] = ch[i];
              ring.pos = (ring.pos + 1) % ring.length;
            }
            ring.total += ch.length;
            // 输出必须置零，否则会与原声音叠加
            e.outputBuffer.getChannelData(0).fill(0);
          };
          masterNode.connect(tap);
          tap.connect(ctx.destination);
          this.tap = tap;
        } catch (err) {
          this.tap = null;
        }
      }
    }

    // 示波器是否可用（ScriptProcessorNode 缺失/创建失败时为 false）
    get scopeAvailable() {
      return !!this.tap;
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

    // 采样时钟：每 hop 个采样产出一列（= 每秒 pxPerSec 列）。
    // 用采样计数而不是 rAF 帧计数，时间轴才不受刷新率/卡顿影响。
    _tick() {
      const ring = this.ring;
      if (!this.tap || ring.total < FFT_N) return;
      const hop = Math.max(1, Math.round(this.ctx.sampleRate / this.pxPerSec));
      if (this._cursor < 0) this._cursor = ring.total;
      const maxBack = ring.length - FFT_N;
      // 卡顿/后台标签页后重新对齐，避免读到已被覆盖的样本
      if (ring.total - this._cursor > maxBack) this._cursor = ring.total - maxBack;
      let guard = 0;
      while (guard++ < 4 && ring.total - this._cursor >= hop) {
        this._cursor += hop;
        this.wave.pushColumn(ring, this._cursor);
        this.spec.pushColumn(ring, this._cursor);
      }
    }

    start() {
      if (this.running) return;
      this.running = true;
      this._last = performance.now();
      const loop = (now) => {
        if (!this.running) return;
        const dt = Math.min(0.1, (now - this._last) / 1000);
        this._last = now;
        this._tick();
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

  // 供测试使用的纯函数/类
  LabViews.freqToBin = freqToBin;
  LabViews.binToFreq = binToFreq;
  LabViews.SpectroView = SpectroView;
  LabViews.WaveView = WaveView;
  LabViews.FFT_N = FFT_N;
  LabViews.BINS = BINS;

  return LabViews;
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LabViews };
}
