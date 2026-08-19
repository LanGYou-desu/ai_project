// 墨战 · 天书纪 — 程序化音效（全合成，无外部音频）
(function (g) {
  'use strict';

  class InkAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.enabled = true;
      this._ambNodes = [];
    }

    ensure() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }

    setEnabled(b) { this.enabled = b; if (this.master) this.master.gain.value = b ? 0.5 : 0; }

    _noiseBuffer(sec) {
      const ctx = this.ctx;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    _env(gain, t0, a, peak, d) {
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + a);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    }

    // 笔划过纸（噪声扫频）
    swish(intensity) {
      if (!this.ready()) return;
      const ctx = this.ctx, t0 = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffer(0.25);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(600 + Math.random() * 500, t0);
      bp.frequency.exponentialRampToValueAtTime(1800 + intensity * 1200, t0 + 0.18);
      const gn = ctx.createGain();
      this._env(gn, t0, 0.02, 0.05 + intensity * 0.05, 0.22);
      src.connect(bp); bp.connect(gn); gn.connect(this.master);
      src.start(t0); src.stop(t0 + 0.3);
    }

    // 墨点爆开
    splat(power) {
      if (!this.ready()) return;
      const ctx = this.ctx, t0 = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffer(0.3);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3000, t0); lp.frequency.exponentialRampToValueAtTime(300, t0 + 0.25);
      const gn = ctx.createGain();
      this._env(gn, t0, 0.005, 0.3 + power * 0.2, 0.28);
      src.connect(lp); lp.connect(gn); gn.connect(this.master);
      src.start(t0); src.stop(t0 + 0.35);
      // 低音闷响
      const osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t0); osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.25);
      const og = ctx.createGain(); this._env(og, t0, 0.01, 0.25, 0.24);
      osc.connect(og); og.connect(this.master);
      osc.start(t0); osc.stop(t0 + 0.3);
    }

    // 命中（五声音阶上行，随连击升高）
    hit(combo) {
      if (!this.ready()) return;
      const ctx = this.ctx, t0 = ctx.currentTime;
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const f = scale[Math.min(combo, 8) % scale.length];
      const osc = ctx.createOscillator(); osc.type = 'triangle';
      osc.frequency.value = f;
      const osc2 = ctx.createOscillator(); osc2.type = 'sine';
      osc2.frequency.value = f * 2;
      const gn = ctx.createGain(); this._env(gn, t0, 0.004, 0.18, 0.28);
      const gn2 = ctx.createGain(); this._env(gn2, t0, 0.004, 0.08, 0.22);
      osc.connect(gn); gn.connect(this.master);
      osc2.connect(gn2); gn2.connect(this.master);
      osc.start(t0); osc.stop(t0 + 0.32);
      osc2.start(t0); osc2.stop(t0 + 0.26);
    }

    // 完美命中（更亮的双音）
    perfect() {
      if (!this.ready()) return;
      const ctx = this.ctx, t0 = ctx.currentTime;
      [880, 1320].forEach((f, i) => {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
        const gn = ctx.createGain(); this._env(gn, t0 + i * 0.05, 0.004, 0.14, 0.35);
        osc.connect(gn); gn.connect(this.master);
        osc.start(t0 + i * 0.05); osc.stop(t0 + i * 0.05 + 0.4);
      });
    }

    // 写错（闷钝音）
    wrong() {
      if (!this.ready()) return;
      const ctx = this.ctx, t0 = ctx.currentTime;
      const osc = ctx.createOscillator(); osc.type = 'square';
      osc.frequency.setValueAtTime(160, t0); osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.18);
      const gn = ctx.createGain(); this._env(gn, t0, 0.005, 0.12, 0.18);
      osc.connect(gn); gn.connect(this.master);
      osc.start(t0); osc.stop(t0 + 0.22);
    }

    // 敌人死亡（下滑音）
    die() {
      if (!this.ready()) return;
      const ctx = this.ctx, t0 = ctx.currentTime;
      const osc = ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320 + Math.random() * 120, t0);
      osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.3);
      const gn = ctx.createGain(); this._env(gn, t0, 0.01, 0.12, 0.3);
      osc.connect(gn); gn.connect(this.master);
      osc.start(t0); osc.stop(t0 + 0.35);
    }

    // 受伤（低噪）
    hurt() {
      if (!this.ready()) return;
      const ctx = this.ctx, t0 = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer(0.3);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(900, t0); lp.frequency.exponentialRampToValueAtTime(150, t0 + 0.25);
      const gn = ctx.createGain(); this._env(gn, t0, 0.01, 0.3, 0.28);
      src.connect(lp); lp.connect(gn); gn.connect(this.master);
      src.start(t0); src.stop(t0 + 0.32);
    }

    // 治疗（上行琶音）
    heal() {
      if (!this.ready()) return;
      const ctx = this.ctx, t0 = ctx.currentTime;
      [392, 523.25, 659.25, 783.99].forEach((f, i) => {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
        const gn = ctx.createGain(); this._env(gn, t0 + i * 0.09, 0.008, 0.12, 0.5);
        osc.connect(gn); gn.connect(this.master);
        osc.start(t0 + i * 0.09); osc.stop(t0 + i * 0.09 + 0.6);
      });
    }

    // 护盾（金属颤音）
    shield() {
      if (!this.ready()) return;
      const ctx = this.ctx, t0 = ctx.currentTime;
      const osc = ctx.createOscillator(); osc.type = 'triangle';
      osc.frequency.value = 700;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 30;
      const lfoG = ctx.createGain(); lfoG.gain.value = 120;
      lfo.connect(lfoG); lfoG.connect(osc.frequency);
      const gn = ctx.createGain(); this._env(gn, t0, 0.01, 0.12, 0.35);
      osc.connect(gn); gn.connect(this.master);
      osc.start(t0); osc.stop(t0 + 0.4); lfo.start(t0); lfo.stop(t0 + 0.4);
    }

    // 雷霆（低鸣 + 脆裂）
    thunder() {
      if (!this.ready()) return;
      const ctx = this.ctx, t0 = ctx.currentTime;
      const osc = ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, t0); osc.frequency.exponentialRampToValueAtTime(30, t0 + 0.5);
      const gn = ctx.createGain(); this._env(gn, t0, 0.02, 0.3, 0.55);
      osc.connect(gn); gn.connect(this.master); osc.start(t0); osc.stop(t0 + 0.6);
      const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer(0.12);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
      const gn2 = ctx.createGain(); this._env(gn2, t0 + 0.05, 0.002, 0.2, 0.12);
      src.connect(hp); hp.connect(gn2); gn2.connect(this.master);
      src.start(t0 + 0.05); src.stop(t0 + 0.2);
    }

    // 大锣（氛围/章节）
    gong() {
      if (!this.ready()) return;
      const ctx = this.ctx, t0 = ctx.currentTime;
      [110, 165, 220].forEach(f => {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
        const gn = ctx.createGain();
        gn.gain.setValueAtTime(0.0001, t0);
        gn.gain.exponentialRampToValueAtTime(0.1, t0 + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.5);
        osc.connect(gn); gn.connect(this.master);
        osc.start(t0); osc.stop(t0 + 3.8);
      });
    }

    // 氛围底噪（战斗背景）
    startAmbience() {
      if (!this.ready() || this._ambNodes.length) return;
      const ctx = this.ctx, t0 = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer(4); src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
      const gn = ctx.createGain(); gn.gain.value = 0.05;
      src.connect(lp); lp.connect(gn); gn.connect(this.master);
      src.start(t0);
      // 缓慢呼吸的深音
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 55;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
      const lfoG = ctx.createGain(); lfoG.gain.value = 12;
      lfo.connect(lfoG); lfoG.connect(osc.frequency);
      const og = ctx.createGain(); og.gain.value = 0.035;
      osc.connect(og); og.connect(this.master);
      osc.start(t0); lfo.start(t0);
      this._ambNodes = [src, lp, gn, osc, lfo, lfoG, og];
    }

    stopAmbience() {
      for (const n of this._ambNodes) { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} }
      this._ambNodes = [];
    }

    // ---------- 五声音阶旋律层 ----------
    // opts: { tempo(秒/音), gain, scale[], drift(随机游走概率), label }
    startMelody(opts) {
      if (!this.ready()) return;
      this.stopMelody();
      const o = opts || {};
      this._mel = {
        tempo: o.tempo || 0.5,
        gain: o.gain || 0.028,
        scale: o.scale || [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25],
        drift: o.drift ?? 0.35,
        idx: Math.floor(Math.random() * 5) + 1,
        nextT: this.ctx.currentTime + 0.2,
        scheduled: [],
        timer: null
      };
      const mel = this._mel;
      const tick = () => {
        const ctx = this.ctx;
        while (mel.nextT < ctx.currentTime + 0.8) {
          // 随机游走选音
          let step = 0;
          const r = Math.random();
          if (r < mel.drift) step = (Math.random() < 0.5 ? -1 : 1);
          else if (r < 0.7) step = (Math.random() < 0.5 ? -2 : 2);
          else if (r < 0.8) step = (Math.random() < 0.5 ? -3 : 3);
          mel.idx = Math.max(0, Math.min(mel.scale.length - 1, mel.idx + step));
          // 约 1/5 概率休止
          if (Math.random() < 0.18) { mel.nextT += mel.tempo; continue; }
          const f = mel.scale[mel.idx];
          const t0 = mel.nextT;
          const osc1 = ctx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = f;
          const osc2 = ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = f * 2;
          const g1 = ctx.createGain();
          g1.gain.setValueAtTime(0.0001, t0);
          g1.gain.exponentialRampToValueAtTime(mel.gain, t0 + 0.03);
          g1.gain.exponentialRampToValueAtTime(0.0001, t0 + mel.tempo * 1.6);
          const g2 = ctx.createGain();
          g2.gain.setValueAtTime(0.0001, t0);
          g2.gain.exponentialRampToValueAtTime(mel.gain * 0.35, t0 + 0.03);
          g2.gain.exponentialRampToValueAtTime(0.0001, t0 + mel.tempo * 1.4);
          osc1.connect(g1); g1.connect(this.master);
          osc2.connect(g2); g2.connect(this.master);
          osc1.start(t0); osc1.stop(t0 + mel.tempo * 1.7);
          osc2.start(t0); osc2.stop(t0 + mel.tempo * 1.5);
          mel.scheduled.push(osc1, osc2, g1, g2);
          mel.nextT += mel.tempo;
        }
        if (mel.scheduled.length > 120) mel.scheduled.splice(0, 40);
      };
      mel.timer = setInterval(tick, 250);
      tick();
    }

    stopMelody() {
      if (!this._mel) return;
      const mel = this._mel;
      clearInterval(mel.timer);
      for (const n of mel.scheduled) { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} }
      mel.scheduled = [];
      this._mel = null;
    }

    ready() { return this.enabled && this.ctx; }
  }

  g.INK_AUDIO = { InkAudio };
})(typeof globalThis !== 'undefined' ? globalThis : this);
