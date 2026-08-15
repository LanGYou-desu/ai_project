'use strict';
// ============================================================
// 声音考古学 · 音频实验室引擎
// 信号链: AudioBufferSource → 去噪(WaveShaper) → 滤波(Biquad)
//         → 增益 → 主音量 → 分析器(Analyser) → 扬声器
// 支持: 变速 / 倒放 / 循环 / 五类滤波 / 去噪门 / 增益 / 进度
// ============================================================

class AudioLab {
  constructor(ctx) {
    this.ctx = ctx;

    this.buffer = null;      // 正向 AudioBuffer
    this._revBuffer = null;  // 倒放缓存
    this.src = null;
    this.playing = false;
    this.frac = 0;           // 播放进度 0..1（正向时间轴）
    this.startedAt = 0;
    this.speed = 1;
    this.reversed = false;
    this.loop = false;

    // 节点链
    this.gate = ctx.createWaveShaper();
    this.gate.oversample = 'none';
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'allpass'; // 直通
    this.filter.frequency.value = 1000;
    this.filter.Q.value = 0.7;
    this.boost = ctx.createGain();
    this.boost.gain.value = 1;
    this.master = ctx.createGain();
    this.master.gain.value = 1;

    this.gate.connect(this.filter);
    this.filter.connect(this.boost);
    this.boost.connect(this.master);
    // 直接输出到扬声器；频谱/波形分析器由视图层自建（复用长生命周期
    // 的分析器节点在部分环境下会退化导致读不到信号）
    this.master.connect(ctx.destination);

    this.setGate(0.05, false);
    this.onEnded = null;
  }

  // ---------- 素材 ----------

  setClip(buffer) {
    const wasPlaying = this.playing;
    this.pause();
    this.buffer = buffer;
    this._revBuffer = null;
    this.frac = 0;
    if (wasPlaying) this.play();
  }

  get duration() {
    return this.buffer ? this.buffer.duration : 0;
  }

  _activeBuffer() {
    if (!this.reversed) return this.buffer;
    if (!this._revBuffer) {
      const b = this.buffer;
      const rev = this.ctx.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
      for (let ch = 0; ch < b.numberOfChannels; ch++) {
        const src = b.getChannelData(ch);
        const dst = rev.getChannelData(ch);
        for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i];
      }
      this._revBuffer = rev;
    }
    return this._revBuffer;
  }

  // ---------- 传输控制 ----------

  play() {
    if (this.playing || !this.buffer) return;
    this.playing = true;
    if (this.onPlay) this.onPlay();
    this._spawn();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.frac = this.getFrac();
    if (this.src) {
      try { this.src.stop(); } catch (e) { /* 已停止 */ }
      this.src = null;
    }
  }

  stop() {
    this.pause();
    this.frac = 0;
  }

  _spawn() {
    const data = this._activeBuffer();
    const src = this.ctx.createBufferSource();
    src.buffer = data;
    src.loop = this.loop;
    src.playbackRate.value = this.speed;
    src.connect(this.gate);
    const self = this;
    src.onended = () => {
      if (self.src !== src) return;
      if (!self.loop) {
        self.playing = false;
        self.frac = 0;
        if (self.onEnded) self.onEnded();
      }
    };
    const start = Math.min(this.frac, 0.999) * data.duration;
    src.start(0, start);
    this.src = src;
    this.startedAt = this.ctx.currentTime;
  }

  // 当前进度 0..1
  getFrac() {
    if (!this.buffer) return 0;
    if (!this.src || !this.playing) return this.frac;
    const d = this.buffer.duration;
    let p = this.frac + ((this.ctx.currentTime - this.startedAt) * this.speed) / d;
    if (this.loop) p = p % 1;
    else if (p > 1) p = 1;
    return p;
  }

  seekFrac(f) {
    const wasPlaying = this.playing;
    this.pause();
    this.frac = Math.max(0, Math.min(1, f));
    if (wasPlaying) this.play();
  }

  togglePlay() {
    if (this.playing) this.pause();
    else this.play();
  }

  // ---------- 仪器 ----------

  setSpeed(v) {
    this.speed = v;
    if (this.src) this.src.playbackRate.value = v;
  }

  setReversed(v) {
    if (this.reversed === v) return;
    this.reversed = v;
    this._rebuild();
  }

  setLoop(v) {
    this.loop = v;
    if (this.src) this.src.loop = v;
  }

  _rebuild() {
    const wasPlaying = this.playing;
    this.pause();
    this.frac = this.frac; // 保留进度
    if (wasPlaying) this.play();
  }

  setFilterType(type) {
    this.filter.type = type; // 'allpass' 直通 / lowpass / highpass / bandpass / notch / peaking
  }

  setFilterFreq(hz) {
    this.filter.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.01);
  }

  setFilterQ(q) {
    this.filter.Q.setTargetAtTime(q, this.ctx.currentTime, 0.01);
  }

  setFilterGainDb(db) {
    this.filter.gain.setTargetAtTime(db, this.ctx.currentTime, 0.01);
  }

  // 去噪门：低于阈值的信号被压到 3%
  setGate(threshold, enabled) {
    const N = 4096;
    const curve = new Float32Array(N);
    const t = Math.max(0.001, Math.min(0.9, threshold));
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 2 - 1;
      const a = Math.abs(x);
      curve[i] = (enabled && a < t) ? x * 0.03 : x;
    }
    this.gate.curve = curve;
  }

  setBoostDb(db) {
    this.boost.gain.setTargetAtTime(Math.pow(10, db / 20), this.ctx.currentTime, 0.01);
  }

  setMasterDb(db) {
    this.master.gain.setTargetAtTime(Math.pow(10, db / 20), this.ctx.currentTime, 0.01);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioLab };
}
