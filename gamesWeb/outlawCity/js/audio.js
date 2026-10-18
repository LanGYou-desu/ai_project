"use strict";
const AudioSys = {
  ctx: null, master: null, noiseBuf: null, enabled: true,
  engineOsc: null, engineGain: null, engineFilter: null,
  sirenOscA: null, sirenOscB: null, sirenGain: null, sirenTimer: null,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.enabled = false; }
  },
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {}); },
  _noise() {
    if (!this.noiseBuf) {
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  },
  tone(freq, dur, vol, type, endFreq) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, freq, type) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise();
    const f = this.ctx.createBiquadFilter();
    f.type = type || "lowpass"; f.frequency.value = freq || 1000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  },
  shoot(type) {
    const def = CFG.WEAPONS[type]; if (!def) return;
    if (def.melee) { this.noise(0.06, 0.18, 300, "bandpass"); this.tone(120, 0.05, 0.2, "triangle"); return; }
    this.noise(0.08, 0.4, 1400);
    this.tone(200 + Math.random() * 80, 0.09, 0.28, "square", 70);
  },
  explosion() { this.noise(0.8, 0.9, 220, "lowpass"); this.tone(90, 0.7, 0.5, "sine", 28); },
  hit() { this.tone(220, 0.05, 0.16, "triangle"); },
  blood() { this.noise(0.06, 0.22, 700, "bandpass"); },
  pickup() { this.tone(660, 0.08, 0.22, "sine"); setTimeout(() => this.tone(990, 0.1, 0.22, "sine"), 60); },
  money() { this.tone(1040, 0.07, 0.16, "square"); setTimeout(() => this.tone(1560, 0.09, 0.16, "square"), 55); },
  missionStart() { [392, 494, 587, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 0.2, "triangle"), i * 90)); },
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 0.22, "triangle"), i * 100)); },
  missionFail() { [330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 0.25, "sawtooth"), i * 130)); },
  missionTick() { this.tone(880, 0.06, 0.18, "sine"); },
  death() { this.tone(400, 1.2, 0.35, "sawtooth", 60); this.noise(0.6, 0.4, 500); },
  sirenStart() {
    if (!this.enabled || !this.ctx || this.sirenGain) return;
    const t = this.ctx.currentTime;
    this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0.045;
    this.sirenGain.connect(this.master);
    this.sirenOscA = this.ctx.createOscillator(); this.sirenOscA.type = "sawtooth"; this.sirenOscA.frequency.value = 700; this.sirenOscA.connect(this.sirenGain); this.sirenOscA.start();
    this.sirenOscB = this.ctx.createOscillator(); this.sirenOscB.type = "sawtooth"; this.sirenOscB.frequency.value = 950; this.sirenOscB.connect(this.sirenGain); this.sirenOscB.start();
    let up = true, v = 700;
    this.sirenTimer = setInterval(() => {
      if (!this.sirenGain) return;
      v = up ? 880 : 620; up = !up;
      this.sirenOscA.frequency.setValueAtTime(v, this.ctx.currentTime);
      this.sirenOscB.frequency.setValueAtTime(v * 1.3, this.ctx.currentTime);
    }, 320);
  },
  sirenStop() {
    if (!this.sirenGain) return;
    clearInterval(this.sirenTimer); this.sirenTimer = null;
    try { this.sirenOscA.stop(); this.sirenOscB.stop(); } catch (e) {}
    this.sirenOscA = this.sirenOscB = null;
    this.sirenGain.disconnect(); this.sirenGain = null;
  },
  horn() { this.tone(420, 0.28, 0.3, "sawtooth", 360); },
  engineStart() {
    if (!this.enabled || !this.ctx || this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
    this.engineFilter = this.ctx.createBiquadFilter(); this.engineFilter.type = "lowpass"; this.engineFilter.frequency.value = 300;
    this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = "sawtooth"; this.engineOsc.frequency.value = 60;
    this.engineOsc.connect(this.engineFilter); this.engineFilter.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineGain.gain.linearRampToValueAtTime(0.06, t + 0.3);
  },
  engineUpdate(speed01) {
    if (!this.engineOsc) return;
    const f = 55 + speed01 * 150;
    this.engineOsc.frequency.setValueAtTime(f, this.ctx.currentTime);
    this.engineFilter.frequency.setValueAtTime(200 + speed01 * 900, this.ctx.currentTime);
  },
  engineStop() {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.linearRampToValueAtTime(0, t + 0.25);
    try { this.engineOsc.stop(t + 0.3); } catch (e) {}
    this.engineOsc = null; this.engineGain = null; this.engineFilter = null;
  },
};
