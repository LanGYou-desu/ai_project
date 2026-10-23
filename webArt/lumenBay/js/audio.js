/* 光湾市 — a tiny generative soundtrack for each hour. */
(function () {
  "use strict";

  const L = window.Lumen;
  const MODES = L.MODES;

  const SOUND = {
    morning: {
      bpm: 72, reverb: 0.34, ambience: 0.016, cutoff: 700,
      chords: [
        { notes: [53, 57, 60, 64], bass: 41 },
        { notes: [52, 55, 59, 64], bass: 40 },
        { notes: [50, 53, 57, 60], bass: 38 },
        { notes: [46, 50, 53, 57], bass: 46 }
      ],
      scale: [65, 67, 69, 72, 74, 77, 79]
    },
    dusk: {
      bpm: 66, reverb: 0.46, ambience: 0.013, cutoff: 460,
      chords: [
        { notes: [45, 48, 52, 55], bass: 45 },
        { notes: [41, 45, 48, 53], bass: 41 },
        { notes: [36, 43, 48, 52], bass: 36 },
        { notes: [43, 47, 50, 52], bass: 43 }
      ],
      scale: [69, 72, 74, 76, 79, 81, 84]
    },
    night: {
      bpm: 112, reverb: 0.30, ambience: 0.011, cutoff: 380,
      chords: [
        { notes: [57, 60, 64, 67], bass: 33 },
        { notes: [53, 57, 60, 64], bass: 29 },
        { notes: [48, 52, 55, 59], bass: 36 },
        { notes: [55, 59, 62, 65], bass: 31 }
      ],
      scale: [69, 72, 74, 76, 79, 81, 84, 86]
    }
  };

  function midiToHz(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  class HarborAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.compressor = null;
      this.convolver = null;
      this.wet = null;
      this.noiseBuffer = null;
      this.sessions = [];
      this.currentMode = "morning";
      this.enabled = false;
      this.volume = 0.62;
      this.started = false;
    }

    _createContext() {
      if (this.ctx) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.28;
      this.master.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = this._makeImpulse(2.7, 2.9);
      this.wet = this.ctx.createGain();
      this.wet.gain.value = 0.33;
      this.convolver.connect(this.wet);
      this.wet.connect(this.master);

      this.noiseBuffer = this._makeNoise(3);
    }

    _makeImpulse(seconds, decay) {
      const rate = this.ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buffer = this.ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / len;
          lp = lp * 0.92 + (Math.random() * 2 - 1) * 0.08;
          data[i] = lp * Math.pow(1 - t, decay) * (ch ? 0.88 : 1);
        }
      }
      return buffer;
    }

    _makeNoise(seconds) {
      const rate = this.ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buffer = this.ctx.createBuffer(1, len, rate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = last * 0.94 + white * 0.06;
        data[i] = last;
      }
      return buffer;
    }

    async enable(mode) {
      this.currentMode = mode || this.currentMode;
      this._createContext();
      if (!this.ctx) return false;
      if (this.ctx.state === "suspended") {
        try { await this.ctx.resume(); } catch (e) { /* audio may be blocked */ }
      }
      this.enabled = true;
      this.started = true;
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
      this.master.gain.linearRampToValueAtTime(this._gain(), now + 1.5);
      this._startSession(this.currentMode, 1.5);
      return true;
    }

    disable() {
      this.enabled = false;
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0.0001, now + 0.5);
      this.sessions.forEach((session) => this._retire(session, 1.2));
      this.sessions = [];
    }

    toggle(mode) {
      if (this.enabled) { this.disable(); return Promise.resolve(false); }
      return this.enable(mode).then(() => true);
    }

    setMode(mode) {
      const changed = mode !== this.currentMode;
      this.currentMode = mode;
      if (!this.enabled || !this.ctx || !changed) return;
      this._startSession(mode, 2.6);
    }

    setVolume(value) {
      this.volume = L.clamp(Number(value) / 100, 0, 1);
      if (!this.ctx || !this.enabled) return;
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this._gain(), now, 0.08);
    }

    _gain() {
      return Math.pow(this.volume, 1.45) * 0.92;
    }

    _startSession(mode, fade) {
      const cfg = SOUND[mode];
      if (!cfg) return;
      const now = this.ctx.currentTime;
      this.sessions.forEach((session) => this._retire(session, fade + 0.2));
      this.sessions = [];

      const bus = this.ctx.createGain();
      bus.gain.setValueAtTime(0.0001, now);
      bus.gain.linearRampToValueAtTime(1, now + fade);
      bus.connect(this.master);
      const send = this.ctx.createGain();
      send.gain.value = cfg.reverb;
      bus.connect(send);
      send.connect(this.convolver);

      let delay = null;
      let delayGain = null;
      if (mode === "night") {
        delay = this.ctx.createDelay(1.2);
        delay.delayTime.value = 60 / cfg.bpm * 0.75;
        delayGain = this.ctx.createGain();
        delayGain.gain.value = 0.24;
        const feedback = this.ctx.createGain();
        feedback.gain.value = 0.27;
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(delayGain);
        delayGain.connect(bus);
      }

      const session = {
        mode, bus, send, delay, delayGain,
        nextTime: now + 0.15, step: 0, bar: 0,
        stepDur: 60 / cfg.bpm / 4,
        stopped: false, sources: []
      };
      this._startAmbience(session, cfg);
      session.timer = window.setInterval(() => this._tick(session), 45);
      this.sessions.push(session);
      this._tick(session);
      return session;
    }

    _retire(session, fade) {
      if (!session || session.retired) return;
      session.retired = true;
      const now = this.ctx.currentTime;
      const g = session.bus.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(0.0001, g.value), now);
      g.exponentialRampToValueAtTime(0.0001, now + Math.max(0.2, fade));
      window.setTimeout(() => {
        session.stopped = true;
        window.clearInterval(session.timer);
        session.sources.forEach((source) => {
          try { source.stop(); } catch (e) { /* already stopped */ }
          try { source.disconnect(); } catch (e) { /* noop */ }
        });
        try { session.bus.disconnect(); } catch (e) { /* noop */ }
        try { session.send.disconnect(); } catch (e) { /* noop */ }
      }, Math.max(300, fade * 1000 + 80));
    }

    _startAmbience(session, cfg) {
      const ctx = this.ctx;
      if (!this.noiseBuffer) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cfg.cutoff;
      filter.Q.value = 0.45;
      const gain = ctx.createGain();
      gain.gain.value = cfg.ambience;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = session.mode === "night" ? 0.065 : 0.11;
      lfoGain.gain.value = session.mode === "night" ? 140 : 260;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(session.bus);
      src.start();
      lfo.start();
      session.sources.push(src, lfo);
      session.ambienceGain = gain;
    }

    _tick(session) {
      if (!this.ctx || session.stopped) return;
      const horizon = this.ctx.currentTime + 0.18;
      let guard = 0;
      while (session.nextTime < horizon && guard < 16) {
        this._schedule(session, session.step, session.bar, session.nextTime);
        session.nextTime += session.stepDur;
        session.step++;
        if (session.step >= 16) { session.step = 0; session.bar++; }
        guard++;
      }
    }

    _schedule(session, step, bar, time) {
      if (session.mode === "morning") this._morning(session, step, bar, time);
      else if (session.mode === "dusk") this._dusk(session, step, bar, time);
      else this._night(session, step, bar, time);
    }

    _morning(session, step, bar, time) {
      const cfg = SOUND.morning;
      const chord = cfg.chords[bar % 4];
      if (step === 0) {
        this._pad(session, chord.notes, time, session.stepDur * 16, 0.016, 980, chord.bass);
        this._bass(session, chord.bass + 12, time, 0.65, 0.018, 220);
      }
      if (step === 8) this._bass(session, chord.bass + 12, time + 0.015, 0.5, 0.013, 200);
      if (step % 2 === 0) {
        const idx = [0, 2, 1, 3, 2, 1, 3, 0][step / 2];
        const midi = chord.notes[idx] + 12;
        this._pluck(session, midi, time, 1.3, 0.021, -0.18 + (step / 16) * 0.36, "triangle", 0.08);
      }
      if ((step === 5 || step === 11 || step === 14) && Math.random() < 0.48) {
        this._bell(session, pick(cfg.scale), time + 0.02, 0.09, 0.045, 0.15);
      }
      if (Math.random() < 0.035 && step > 1 && step < 14) {
        this._chirp(session, time + Math.random() * 0.12);
      }
    }

    _dusk(session, step, bar, time) {
      const cfg = SOUND.dusk;
      const chord = cfg.chords[bar % 4];
      if (step === 0) {
        this._pad(session, chord.notes, time, session.stepDur * 16.2, 0.019, 720, chord.bass);
        this._bass(session, chord.bass, time, 1.4, 0.022, 190);
        this._keys(session, chord.notes, time + 0.02, 2.3, 0.011, -0.1);
      }
      if (step === 8) this._bass(session, chord.bass + 7, time, 0.9, 0.014, 170);
      if (step === 10) this._keys(session, chord.notes.slice(1).concat(chord.notes[0] + 12), time, 1.9, 0.008, 0.2);
      if (step === 4 || step === 12) {
        this._bell(session, chord.notes[2] + 12, time, 0.06, 0.035, 0.12);
      }
      if ((step === 2 || step === 6 || step === 13) && Math.random() < 0.52) {
        this._pluck(session, pick(cfg.scale), time, 1.8, 0.018, Math.random() * 0.5 - 0.25, "sine", 0.22);
      }
      if (step === 15 && Math.random() < 0.22) {
        this._chirp(session, time + 0.4, 0.6, 0.35);
      }
    }

    _night(session, step, bar, time) {
      const cfg = SOUND.night;
      const chord = cfg.chords[bar % 4];
      if (step % 4 === 0) this._kick(session, time);
      if (step === 4 || step === 12) this._snare(session, time);
      if (step % 2 === 0) this._hat(session, time, step === 14 ? 0.11 : 0.05, step === 14);
      if (step === 0) this._pad(session, chord.notes, time, session.stepDur * 16, 0.012, 1300, chord.bass);
      if (step % 2 === 0) {
        const pattern = [0, 0, 12, 0, 7, 0, 12, 10];
        const bass = chord.bass + 12 + pattern[(step / 2) % 8];
        this._synthBass(session, bass, time, session.stepDur * 1.45, step % 4 === 0 ? 0.041 : 0.028);
      }
      if (step % 2 === 0) {
        const seq = [0, 2, 1, 3, 2, 3, 1, 2];
        const midi = chord.notes[seq[(step / 2) % 8]] + 12;
        this._pluck(session, midi, time, 0.5, 0.014, (step / 16) * 0.8 - 0.4, "square", 0.3);
      }
      if ((step === 3 || step === 7 || step === 11) && Math.random() < 0.38) {
        this._bell(session, pick(cfg.scale) + 12, time, 0.08, 0.032, -0.28);
      }
      if (step === 14 && Math.random() < 0.3) {
        this._spark(session, time);
      }
    }

    _env(node, time, attack, dur, peak) {
      const gain = node.gain;
      gain.setValueAtTime(0.0001, time);
      gain.linearRampToValueAtTime(peak, time + attack);
      gain.exponentialRampToValueAtTime(0.0001, time + dur);
    }

    _pan(session, value) {
      if (!this.ctx.createStereoPanner) return session.bus;
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = L.clamp(value || 0, -1, 1);
      pan.connect(session.bus);
      return pan;
    }

    _pluck(session, midi, time, dur, vol, pan, type, delaySend) {
      const ctx = this.ctx;
      const freq = midiToHz(midi);
      const out = this._pan(session, pan);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(freq * 6, time);
      filter.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.5), time + dur * 0.8);
      filter.Q.value = 0.6;
      const gain = ctx.createGain();
      this._env(gain, time, 0.008, dur, vol);
      filter.connect(gain);
      gain.connect(out);
      if (delaySend && session.delay) {
        const send = ctx.createGain();
        send.gain.value = delaySend;
        gain.connect(send);
        send.connect(session.delay);
      }
      const osc = ctx.createOscillator();
      osc.type = type || "triangle";
      osc.frequency.value = freq;
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = freq * 2.003;
      const g2 = ctx.createGain();
      g2.gain.value = 0.16;
      osc2.connect(g2);
      g2.connect(filter);
      osc.connect(filter);
      osc.start(time);
      osc2.start(time);
      osc.stop(time + dur + 0.05);
      osc2.stop(time + dur + 0.05);
      session.sources.push(osc, osc2);
    }

    _pad(session, notes, time, dur, vol, cutoff, bass) {
      const ctx = this.ctx;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(cutoff * 0.55, time);
      filter.frequency.linearRampToValueAtTime(cutoff, time + dur * 0.45);
      filter.frequency.linearRampToValueAtTime(cutoff * 0.65, time + dur);
      filter.Q.value = 0.5;
      const gain = ctx.createGain();
      const attack = Math.min(2.2, dur * 0.3);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vol, time + attack);
      gain.gain.setValueAtTime(vol, time + dur * 0.72);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur + 1.2);
      filter.connect(gain);
      gain.connect(session.bus);
      notes.forEach((midi, i) => {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = midiToHz(midi);
        osc.detune.value = (i % 2 ? 3 : -3);
        const soft = ctx.createOscillator();
        soft.type = "sine";
        soft.frequency.value = midiToHz(midi) * 0.5;
        const softGain = ctx.createGain();
        softGain.gain.value = 0.34;
        soft.connect(softGain);
        softGain.connect(filter);
        osc.connect(filter);
        osc.start(time);
        soft.start(time);
        osc.stop(time + dur + 1.4);
        soft.stop(time + dur + 1.4);
        session.sources.push(osc, soft);
      });
      if (bass) {
        const sub = ctx.createOscillator();
        const sg = ctx.createGain();
        sub.type = "sine";
        sub.frequency.value = midiToHz(bass);
        sg.gain.setValueAtTime(0.0001, time);
        sg.gain.linearRampToValueAtTime(vol * 1.5, time + attack);
        sg.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.8);
        sub.connect(sg);
        sg.connect(session.bus);
        sub.start(time);
        sub.stop(time + dur + 1);
        session.sources.push(sub);
      }
    }

    _bass(session, midi, time, dur, vol, cutoff) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = midiToHz(midi);
      sub.type = "sine";
      sub.frequency.value = midiToHz(midi - 12);
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vol, time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(filter); sub.connect(filter); filter.connect(gain); gain.connect(session.bus);
      osc.start(time); sub.start(time);
      osc.stop(time + dur + 0.05); sub.stop(time + dur + 0.05);
      session.sources.push(osc, sub);
    }

    _synthBass(session, midi, time, dur, vol) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = midiToHz(midi);
      filter.type = "lowpass";
      filter.Q.value = 3.5;
      filter.frequency.setValueAtTime(880, time);
      filter.frequency.exponentialRampToValueAtTime(180, time + dur);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vol, time + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(filter); filter.connect(gain); gain.connect(session.bus);
      osc.start(time); osc.stop(time + dur + 0.02);
      session.sources.push(osc);
    }

    _keys(session, notes, time, dur, vol, pan) {
      notes.forEach((midi, i) => {
        const out = this._pan(session, pan + (i - 1.5) * 0.16);
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = "sine";
        osc.frequency.value = midiToHz(midi + 12);
        osc2.type = "triangle";
        osc2.frequency.value = midiToHz(midi + 12) * 2.002;
        osc2.detune.value = 4;
        filter.type = "lowpass";
        filter.frequency.value = 1800;
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(vol, time + 0.045);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        const g2 = ctx.createGain();
        g2.gain.value = 0.13;
        osc.connect(filter);
        osc2.connect(g2); g2.connect(filter);
        filter.connect(gain); gain.connect(out);
        osc.start(time); osc2.start(time);
        osc.stop(time + dur + 0.05); osc2.stop(time + dur + 0.05);
        session.sources.push(osc, osc2);
      });
    }

    _bell(session, midi, time, attack, vol, pan) {
      const ctx = this.ctx;
      const out = this._pan(session, pan);
      const freq = midiToHz(midi);
      const carrier = ctx.createOscillator();
      const shimmer = ctx.createOscillator();
      const mod = ctx.createGain();
      const gain = ctx.createGain();
      carrier.type = "sine";
      carrier.frequency.value = freq;
      shimmer.type = "sine";
      shimmer.frequency.value = freq * 2.01;
      mod.gain.value = vol * 0.22;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vol, time + Math.max(0.01, attack));
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 2.4);
      carrier.connect(gain);
      shimmer.connect(mod);
      mod.connect(gain.gain);
      gain.connect(out);
      carrier.start(time); shimmer.start(time);
      carrier.stop(time + 2.5); shimmer.stop(time + 2.5);
      session.sources.push(carrier, shimmer);
    }

    _kick(session, time) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(145, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.16);
      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
      osc.connect(gain); gain.connect(session.bus);
      osc.start(time); osc.stop(time + 0.35);
      session.sources.push(osc);
    }

    _noiseHit(session, time, type, freq, vol, dur) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = 0.7;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vol, time + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      src.connect(filter); filter.connect(gain); gain.connect(session.bus);
      src.start(time); src.stop(time + dur + 0.02);
      session.sources.push(src);
    }

    _snare(session, time) {
      this._noiseHit(session, time, "highpass", 1600, 0.10, 0.16);
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = 185;
      gain.gain.setValueAtTime(0.055, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
      osc.connect(gain); gain.connect(session.bus);
      osc.start(time); osc.stop(time + 0.12);
      session.sources.push(osc);
    }

    _hat(session, time, vol, open) {
      this._noiseHit(session, time, "highpass", open ? 6200 : 8200, vol, open ? 0.28 : 0.045);
    }

    _spark(session, time) {
      [0, 4, 7].forEach((n, i) => {
        this._bell(session, 81 + n, time + i * 0.06, 0.01, 0.018, i * 0.2 - 0.2);
      });
    }

    _chirp(session, time, vol, pan) {
      const ctx = this.ctx;
      const out = this._pan(session, typeof pan === "number" ? pan : Math.random() * 0.8 - 0.4);
      const v = vol || 0.025;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1800 + Math.random() * 500, time);
      osc.frequency.exponentialRampToValueAtTime(2700 + Math.random() * 700, time + 0.055);
      osc.frequency.exponentialRampToValueAtTime(2100, time + 0.13);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(v, time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
      osc.connect(gain); gain.connect(out);
      osc.start(time); osc.stop(time + 0.18);
      session.sources.push(osc);
    }

    playGreeting() {
      if (!this.enabled || !this.ctx) return;
      const session = this.sessions[this.sessions.length - 1];
      if (!session) return;
      const now = this.ctx.currentTime + 0.02;
      const notes = this.currentMode === "night" ? [76, 81, 88] : [72, 76, 79];
      notes.forEach((note, i) => this._bell(session, note, now + i * 0.07, 0.01, 0.022, i * 0.17 - 0.17));
    }
  }

  window.Lumen.HarborAudio = HarborAudio;
})();
