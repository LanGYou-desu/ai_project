const AMBIENCE_BASE = './assets/audio/ambience';

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function makeNoiseBuffer(ctx, seconds, fill) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  fill(buffer.getChannelData(0), ctx.sampleRate);
  return buffer;
}

function exponentialEnvelope(t, attack, decay) {
  if (t < 0) return 0;
  return Math.min(1, t / Math.max(0.0001, attack)) * Math.exp(-t / Math.max(0.0001, decay));
}

export class AudioSystem {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.ambientBus = null;
    this.reverbSend = null;
    this.reverb = null;
    this.buffers = new Map();
    this.stepBuffers = { concrete: [], metal: [], wood: [], water: [] };
    this.ambient = null;
    this.ambientToken = 0;
    this.ambientManifest = null;
    this.tension = 0;
    this.targetTension = 0;
    this.tensionNodes = null;
    this._lastListenerUpdate = 0;
    this._listenerPos = { x: 0, y: 0, z: 0 };
    this._listenerQuat = null;
    this.ready = false;
    this.streamStats = { decoded: 0, queued: 0, activeTrack: null };
    this._volume = settings.values.volume;
    this._paused = false;
    this._whisperNodes = [];
  }

  async unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.applyVolume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.ctx = new AudioCtor({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.gain.value = this._volume;
    this.master.connect(this.ctx.destination);

    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 16;
    compressor.ratio.value = 4;
    compressor.attack.value = .006;
    compressor.release.value = .22;
    compressor.connect(this.master);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = .9;
    this.sfxBus.connect(compressor);

    this.ambientBus = this.ctx.createGain();
    this.ambientBus.gain.value = .55;
    this.ambientBus.connect(compressor);

    // A physically-implausible but convincing concrete-tunnel reverb.
    this.reverb = this.ctx.createConvolver();
    const impulseSeconds = 2.1;
    const impulse = this.ctx.createBuffer(2, Math.floor(this.ctx.sampleRate * impulseSeconds), this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / data.length;
        const noise = Math.random() * 2 - 1;
        last = last * .68 + noise * .32;
        data[i] = last * Math.exp(-t * 5.1) * .42;
      }
    }
    this.reverb.buffer = impulse;
    const reverbReturn = this.ctx.createGain();
    reverbReturn.gain.value = .2;
    this.reverb.connect(reverbReturn);
    reverbReturn.connect(compressor);
    this.reverbSend = this.ctx.createGain();
    this.reverbSend.gain.value = .8;
    this.reverbSend.connect(this.reverb);

    this._buildSimpleBuffers();
    this._buildFootsteps();
    this._buildTensionLayers();
    this.ready = true;
    await this.ctx.resume();
    this.applyVolume();
  }

  applyVolume() {
    this._volume = this.settings.values.volume;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this._paused ? this._volume * .16 : this._volume, this.ctx.currentTime, .06);
    }
  }

  setPaused(paused) {
    this._paused = paused;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(paused ? this._volume * .14 : this._volume, this.ctx.currentTime, paused ? .2 : .08);
  }

  _buildSimpleBuffers() {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const B = (name, duration, fn) => {
      const buffer = makeNoiseBuffer(ctx, duration, fn);
      this.buffers.set(name, buffer);
    };

    B('click', .09, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 70) * .07 + Math.sin(t * 2200) * Math.exp(-t * 35) * .03;
      }
    });
    B('uiHover', .06, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        data[i] = Math.sin(t * 1400) * Math.exp(-t * 65) * .018;
      }
    });
    B('switch', .28, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const clunk = (Math.random() * 2 - 1) * Math.exp(-t * 100) + Math.sin(t * 180) * Math.exp(-t * 26) * .4;
        data[i] = clunk * .2;
      }
    });
    B('pickup', .6, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const paper = (Math.random() * 2 - 1) * Math.exp(-t * 18) * .06;
        const ring = (Math.sin(t * 640) + Math.sin(t * 960) * .5) * Math.exp(-t * 8) * .025;
        data[i] = paper + ring;
      }
    });
    B('doorOpen', 1.8, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const groan = Math.sin(t * (52 + t * 9) + Math.sin(t * 3) * .6) * (.1 + t * .018) * Math.exp(-t * 1.25);
        const scrape = (Math.random() * 2 - 1) * Math.exp(-t * 4) * .06;
        data[i] = Math.tanh((groan + scrape) * 1.4) * .44;
      }
    });
    B('doorClose', 1.1, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const thud = Math.sin(t * 58) * Math.exp(-t * 8) * .38;
        const metal = Math.sin(t * 880) * Math.exp(-t * 17) * .08;
        data[i] = thud + metal + (Math.random() * 2 - 1) * Math.exp(-t * 30) * .09;
      }
    });
    B('locked', .45, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const knock = Math.sin(t * 125) * Math.exp(-t * 24) * .22 + (Math.random() * 2 - 1) * Math.exp(-t * 55) * .06;
        data[i] = knock;
      }
    });
    B('keyBeep', .16, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        data[i] = Math.sin(Math.PI * 2 * 910 * t) * Math.exp(-t * 21) * .035;
      }
    });
    B('keyError', .8, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const f = i < data.length / 2 ? 160 : 125;
        data[i] = (Math.sin(Math.PI * 2 * f * t) + Math.sin(Math.PI * 2 * f * 1.5 * t) * .3) * Math.exp(-t * 2.2) * .12;
      }
    });
    B('keyGrant', 1.4, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const a = Math.sin(Math.PI * 2 * 520 * t) * Math.exp(-t * 2.4);
        const b = Math.sin(Math.PI * 2 * 780 * t) * Math.exp(-t * 2.0) * (t > .2 ? 1 : 0);
        data[i] = (a + b) * .04;
      }
    });
    B('metalGroan', 6.5, (data) => {
      let low = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const fm = Math.sin(t * 54 + Math.sin(t * .32) * 2.1) * Math.exp(-t * .22);
        const scrape = (Math.random() * 2 - 1) * .08 * Math.exp(-t * .6) * (.5 + Math.sin(t * 1.3) * .5);
        const harmonic = Math.sin(t * 247 + Math.sin(t * .7) * .2) * .04 * Math.exp(-t * .4);
        low += (fm + scrape + harmonic - low) * .1;
        data[i] = low * .18;
      }
    });
    B('drip', 1.8, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const f = 980 - t * 460;
        data[i] = Math.sin(t * Math.PI * 2 * f) * Math.exp(-t * 13) * .12 +
          Math.sin(t * Math.PI * 2 * f * .498) * Math.exp(-t * 7) * .04;
      }
    });
    B('powerUp', 4.2, (data) => {
      let ph = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const env = Math.min(1, t / .6) * Math.exp(-Math.max(0, t - 2.8) * 1.2);
        const freq = 34 + Math.min(t, 1.8) * 34;
        ph += (Math.PI * 2 * freq) / sr;
        const hum = Math.sin(ph) * .18 + Math.sin(ph * 2) * .06 + Math.sin(ph * 3.01) * .025;
        const noise = (Math.random() * 2 - 1) * .015 * Math.exp(-t * .8);
        data[i] = (hum + noise) * env * .65;
      }
    });
    B('heartbeat', 2.0, (data) => {
      const thumps = [[.06, .95], [.42, .58]];
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        let v = 0;
        for (const [at, amp] of thumps) {
          const tt = t - at;
          if (tt >= 0) {
            v += Math.sin(Math.PI * 2 * (52 - tt * 15) * tt) * Math.exp(-tt * 13) * amp;
            v += Math.sin(Math.PI * 2 * 87 * tt) * Math.exp(-tt * 28) * amp * .27;
          }
        }
        data[i] = v * .3;
      }
    });
    B('breath', 3.2, (data) => {
      let lp = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const n = Math.random() * 2 - 1;
        lp += (n - lp) * .018;
        const env = Math.max(0, Math.sin((t / 1.6) * Math.PI)) ** 1.5;
        data[i] = lp * env * .3;
      }
    });
    B('staticBurst', 1.8, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const env = Math.min(1, t * 14) * Math.exp(-t * 1.7);
        const n = Math.random() * 2 - 1;
        data[i] = n * env * .035 + Math.sin(t * 60) * env * .018;
      }
    });
    B('tapeStop', .5, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const f = 180 - t * 210;
        data[i] = (Math.sin(t * Math.PI * 2 * Math.max(30, f)) * Math.exp(-t * 5) + (Math.random() * 2 - 1) * .03 * Math.exp(-t * 12)) * .06;
      }
    });
    B('thud', 1.2, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        data[i] = Math.sin(t * Math.PI * 2 * (42 - t * 6)) * Math.exp(-t * 7) * .3 +
          (Math.random() * 2 - 1) * Math.exp(-t * 22) * .06;
      }
    });
    B('phoneRing', 3.2, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const ring = (Math.floor(t / .8) % 2 === 0) ? 1 : 0;
        const tremolo = .6 + Math.sin(t * 31) * .4;
        data[i] = (Math.sin(t * Math.PI * 2 * 420) * .04 + Math.sin(t * Math.PI * 2 * 520) * .02) * ring * tremolo;
      }
    });
    B('alarm', 4.0, (data) => {
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const gate = (t % 1.1) < .68 ? 1 : 0;
        data[i] = (Math.sin(t * Math.PI * 2 * 310) * .04 + Math.sin(t * Math.PI * 2 * 465) * .018) * gate;
      }
    });
  }

  _buildFootsteps() {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const makeStep = (type, variation) => {
      const seconds = type === 'water' ? .7 : .42;
      const buffer = makeNoiseBuffer(ctx, seconds, (data) => {
        let lp = 0;
        let hp = 0;
        const pitch = .8 + variation * .12;
        for (let i = 0; i < data.length; i++) {
          const t = i / sr;
          const n = Math.random() * 2 - 1;
          lp += (n - lp) * (type === 'wood' ? .03 : .09);
          hp = n - lp;
          let v = 0;
          if (type === 'concrete') {
            v = lp * Math.exp(-t * 18) * .24 + Math.sin(t * Math.PI * 2 * 72 * pitch) * Math.exp(-t * 23) * .12 + hp * Math.exp(-t * 44) * .025;
          } else if (type === 'metal') {
            v = (Math.sin(t * Math.PI * 2 * 410 * pitch) * .07 + Math.sin(t * Math.PI * 2 * 737 * pitch) * .035 + Math.sin(t * Math.PI * 2 * 1180 * pitch) * .015) * Math.exp(-t * 12) +
              lp * Math.exp(-t * 19) * .12 + hp * Math.exp(-t * 36) * .035;
          } else if (type === 'wood') {
            v = lp * Math.exp(-t * 13) * .27 + Math.sin(t * Math.PI * 2 * 95 * pitch) * Math.exp(-t * 17) * .11 + hp * Math.exp(-t * 27) * .014;
          } else {
            v = hp * Math.exp(-t * 9) * .16 + lp * Math.exp(-t * 6) * .05 + Math.sin(t * Math.PI * 2 * (110 + variation * 24) * pitch) * Math.exp(-t * 7) * .03;
          }
          data[i] = Math.tanh(v * 1.4) * .8;
        }
      });
      return buffer;
    };
    for (const type of ['concrete', 'metal', 'wood', 'water']) {
      for (let v = 0; v < 4; v++) this.stepBuffers[type].push(makeStep(type, v));
    }
  }

  _buildTensionLayers() {
    const ctx = this.ctx;
    this.tensionNodes = {};
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(this.master);
    this.tensionNodes.bus = bus;

    const heartbeat = ctx.createBufferSource();
    heartbeat.buffer = this.buffers.get('heartbeat');
    heartbeat.loop = true;
    const heartFilter = ctx.createBiquadFilter();
    heartFilter.type = 'lowpass';
    heartFilter.frequency.value = 420;
    const heartGain = ctx.createGain();
    heartGain.gain.value = .55;
    heartbeat.connect(heartFilter).connect(heartGain).connect(bus);
    heartbeat.start();
    this.tensionNodes.heartGain = heartGain;

    const chaseBuffer = makeNoiseBuffer(ctx, 4, (data) => {
      let lp = 0;
      const sampleRate = ctx.sampleRate;
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const n = Math.random() * 2 - 1;
        lp += (n - lp) * .02;
        const beatPhase = (t / .5) % 1;
        const pulse = t < 2.4 ? Math.max(0, Math.sin(beatPhase * Math.PI)) ** 5 : .12;
        const low = Math.sin(t * Math.PI * 2 * 36.5 + Math.sin(t * .4) * .5) * .18;
        data[i] = (low + lp * .65 + (Math.random() * 2 - 1) * .012) * (.4 + pulse * .6);
      }
    });
    const chase = ctx.createBufferSource();
    chase.buffer = chaseBuffer;
    chase.loop = true;
    const chaseFilter = ctx.createBiquadFilter();
    chaseFilter.type = 'lowpass';
    chaseFilter.frequency.value = 590;
    const chaseGain = ctx.createGain();
    chaseGain.gain.value = .28;
    chase.connect(chaseFilter).connect(chaseGain).connect(bus);
    chase.start();
    this.tensionNodes.chaseGain = chaseGain;
  }

  _buffer(name) {
    return this.buffers.get(name) || null;
  }

  play(name, { volume = 1, rate = 1, pan = 0, reverb = .12 } = {}) {
    if (!this.ready) return null;
    const buffer = this._buffer(name);
    if (!buffer) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = clamp(pan, -1, 1);
    src.connect(gain).connect(panner);
    panner.connect(this.sfxBus);
    if (reverb > 0) {
      const send = this.ctx.createGain();
      send.gain.value = reverb;
      panner.connect(send).connect(this.reverbSend);
    }
    src.start();
    return src;
  }

  playAt(name, position, { volume = 1, rate = 1, refDistance = 1.8, maxDistance = 28, reverb = .25 } = {}) {
    if (!this.ready) return null;
    const buffer = this._buffer(name);
    if (!buffer) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = refDistance;
    panner.maxDistance = maxDistance;
    panner.rolloffFactor = 1.2;
    panner.positionX.value = position.x;
    panner.positionY.value = position.y;
    panner.positionZ.value = position.z;
    src.connect(gain).connect(panner);
    panner.connect(this.sfxBus);
    if (reverb > 0) {
      const send = this.ctx.createGain();
      send.gain.value = reverb;
      panner.connect(send).connect(this.reverbSend);
    }
    src.start();
    return src;
  }

  footstep(surface = 'concrete', volume = .35, rate = 1) {
    if (!this.ready) return;
    const list = this.stepBuffers[surface] || this.stepBuffers.concrete;
    const buffer = list[Math.floor(Math.random() * list.length)];
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate * (0.93 + Math.random() * .14);
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.sfxBus);
    const send = this.ctx.createGain();
    send.gain.value = surface === 'metal' ? .17 : .09;
    gain.connect(send).connect(this.reverbSend);
    src.start();
  }

  whisper(duration = 3.5, volume = .12) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    const seconds = Math.max(1.5, duration);
    const buffer = makeNoiseBuffer(this.ctx, seconds, (data) => {
      const sr = this.ctx.sampleRate;
      let phase = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        // Filtered breath pulsing through changing vowel-like formants.
        const syllable = (Math.sin(t * 7.3) + Math.sin(t * 4.9 + 1.7)) * .5 + .5;
        const env = Math.sin((t / seconds) * Math.PI) ** .8 * (0.25 + syllable * .75);
        const n = Math.random() * 2 - 1;
        const formant = Math.sin(t * Math.PI * 2 * (170 + Math.sin(t * 2.1) * 70)) * .12 +
          Math.sin(t * Math.PI * 2 * (380 + Math.sin(t * 3.3) * 110)) * .05;
        data[i] = (n * .024 + formant) * env * .15;
      }
    });
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 780;
    filter.Q.value = .7;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter).connect(gain);
    gain.connect(this.sfxBus);
    const send = this.ctx.createGain();
    send.gain.value = .5;
    gain.connect(send).connect(this.reverbSend);
    src.start();
    src.stop(now + seconds + .1);
    this._whisperNodes.push({ src, gain });
    if (this._whisperNodes.length > 5) {
      this._whisperNodes.shift().src.stop();
    }
  }

  tone({ frequency = 220, duration = 1, volume = .03, type = 'sine', reverb = .2 } = {}) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + .03);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain).connect(this.sfxBus);
    if (reverb > 0) {
      const send = this.ctx.createGain();
      send.gain.value = reverb;
      gain.connect(send).connect(this.reverbSend);
    }
    osc.start(now);
    osc.stop(now + duration + .05);
  }

  setTension(value) {
    this.targetTension = clamp(value, 0, 1);
  }

  update(dt, camera = null) {
    if (!this.ready) return;
    if (camera) this._updateListener(camera);
    this.tension += (this.targetTension - this.tension) * Math.min(1, dt * 1.6);
    if (this.tensionNodes) {
      const t = this.tension;
      this.tensionNodes.bus.gain.setTargetAtTime(t > .03 ? .42 * t : 0, this.ctx.currentTime, .3);
      this.tensionNodes.heartGain.gain.setTargetAtTime(.18 + t * .7, this.ctx.currentTime, .4);
      this.tensionNodes.chaseGain.gain.setTargetAtTime(.1 + t * .38, this.ctx.currentTime, .5);
    }
  }

  _updateListener(camera) {
    if (!this.ctx) return;
    const listener = this.ctx.listener;
    const now = this.ctx.currentTime;
    const p = camera.getWorldPosition(this._tmpPos || (this._tmpPos = new camera.position.constructor()));
    const q = camera.getWorldQuaternion(this._tmpQuat || (this._tmpQuat = new camera.quaternion.constructor()));
    // Forward is -Z in camera space.
    const f = this._forward || (this._forward = new p.constructor(0, 0, -1));
    const u = this._up || (this._up = new p.constructor(0, 1, 0));
    f.set(0, 0, -1).applyQuaternion(q);
    u.set(0, 1, 0).applyQuaternion(q);
    if (listener.positionX) {
      listener.positionX.setTargetAtTime(p.x, now, .025);
      listener.positionY.setTargetAtTime(p.y, now, .025);
      listener.positionZ.setTargetAtTime(p.z, now, .025);
      listener.forwardX.setTargetAtTime(f.x, now, .025);
      listener.forwardY.setTargetAtTime(f.y, now, .025);
      listener.forwardZ.setTargetAtTime(f.z, now, .025);
      listener.upX.setTargetAtTime(u.x, now, .025);
      listener.upY.setTargetAtTime(u.y, now, .025);
      listener.upZ.setTargetAtTime(u.z, now, .025);
    } else {
      listener.setPosition(p.x, p.y, p.z);
      listener.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
  }

  async _loadManifest() {
    if (this.ambientManifest) return this.ambientManifest;
    try {
      const res = await fetch(`${AMBIENCE_BASE}/manifest.json`, { cache: 'no-cache' });
      this.ambientManifest = await res.json();
    } catch {
      this.ambientManifest = { tracks: {} };
    }
    return this.ambientManifest;
  }

  async _fetchChunk(trackId, chunk, trackDef) {
    const cacheKey = `${trackId}/${chunk}`;
    if (this._chunkCache?.has(cacheKey)) return this._chunkCache.get(cacheKey);
    if (!this._chunkCache) this._chunkCache = new Map();
    const url = `${AMBIENCE_BASE}/${trackId}/${trackDef.prefix || 'chunk'}-${String(chunk).padStart(2, '0')}.wav`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const array = await res.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(array);
      this._chunkCache.set(cacheKey, buffer);
      this.streamStats.decoded++;
      // Bound decoded streaming memory. Active AudioBufferSources keep their own reference.
      const entries = [...this._chunkCache.keys()];
      if (entries.length > 5) {
        for (let i = 0; i < entries.length - 5; i++) this._chunkCache.delete(entries[i]);
      }
      return buffer;
    } catch (error) {
      console.warn('Ambient chunk unavailable:', url, error);
      return null;
    }
  }

  async setAmbient(trackId, { fade = 3.5, volume = .62 } = {}) {
    if (!this.ctx) return;
    const token = ++this.ambientToken;
    await this.ctx.resume();
    const manifest = await this._loadManifest();
    const trackDef = manifest.tracks?.[trackId];
    if (!trackDef) {
      this._startFallbackDrone(token, trackId);
      return;
    }
    const previous = this.ambient;
    const bus = this.ctx.createGain();
    bus.gain.value = 0;
    bus.connect(this.ambientBus);
    const state = {
      id: trackId,
      token,
      def: trackDef,
      bus,
      volume,
      chunk: 0,
      nextStart: 0,
      source: null,
      fade,
      active: true
    };
    const first = await this._fetchChunk(trackId, 0, trackDef);
    if (token !== this.ambientToken) {
      bus.disconnect();
      return;
    }
    if (!first) {
      this._startFallbackDrone(token, trackId);
      if (previous) this._stopAmbient(previous, fade);
      return;
    }
    this.ambient = state;
    this.streamStats.activeTrack = trackId;
    this._scheduleChunk(state, first);
    bus.gain.setTargetAtTime(volume * .55, this.ctx.currentTime + .15, fade / 3);
    if (previous) this._stopAmbient(previous, fade);
    // Prefetch the next two segments while the first is still playing.
    this._fetchChunk(trackId, 1, trackDef);
    this._fetchChunk(trackId, 2, trackDef);
    state.source.onended = () => {
      if (this.ambient === state && state.active) this._scheduleNextAmbient(state);
    };
  }

  _scheduleChunk(state, buffer) {
    if (!this.ambient || this.ambient !== state) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(state.bus);
    const start = Math.max(now + .035, state.nextStart || 0);
    src.start(start);
    state.source = src;
    state.currentStart = start;
    state.nextStart = start + buffer.duration;
    this.streamStats.queued++;
  }

  async _scheduleNextAmbient(state) {
    if (!state.active || this.ambient !== state) return;
    const def = state.def;
    state.chunk = (state.chunk + 1) % (def.chunks || 1);
    this.streamStats.currentChunk = state.chunk;
    const nextIndex = (state.chunk + 1) % (def.chunks || 1);
    const next = await this._fetchChunk(state.id, state.chunk, def);
    if (!state.active || this.ambient !== state) return;
    if (!next) {
      this._startFallbackDrone(state.token, state.id, state.bus);
      return;
    }
    // If decoding was late, restart smoothly rather than leaving a hard gap.
    if (this.ctx.currentTime > state.nextStart + .3) {
      state.nextStart = this.ctx.currentTime + .05;
    }
    const existing = state.source;
    this._scheduleChunk(state, next);
    state.source.onended = () => {
      if (this.ambient === state && state.active) this._scheduleNextAmbient(state);
    };
    this._fetchChunk(state.id, nextIndex, def);
    if (existing) {
      // Let the previous source finish naturally.
    }
  }

  _stopAmbient(state, fade = 2) {
    state.active = false;
    if (!this.ctx || !state.bus) return;
    const now = this.ctx.currentTime;
    state.bus.gain.cancelScheduledValues(now);
    state.bus.gain.setValueAtTime(state.bus.gain.value, now);
    state.bus.gain.linearRampToValueAtTime(0, now + fade);
    setTimeout(() => {
      try { state.source?.stop(); } catch {}
      try { state.bus.disconnect(); } catch {}
    }, fade * 1000 + 250);
  }

  _startFallbackDrone(token, trackId, existingBus = null) {
    if (!this.ctx || token !== this.ambientToken) return;
    const bus = existingBus || this.ctx.createGain();
    if (!existingBus) {
      bus.gain.value = .0;
      bus.connect(this.ambientBus);
      this.ambient = { id: trackId, token, bus, active: true, source: null, def: { chunks: 1 }, nextStart: 0, chunk: 0 };
      bus.gain.setTargetAtTime(.15, this.ctx.currentTime, 2);
    }
    const duration = 12;
    const buffer = makeNoiseBuffer(this.ctx, duration, (data) => {
      const sr = this.ctx.sampleRate;
      let lp = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const n = Math.random() * 2 - 1;
        lp += (n - lp) * .005;
        data[i] = (lp * .39 + Math.sin(t * Math.PI * 2 * 29) * .06 + Math.sin(t * Math.PI * 2 * 43.2) * .03) * Math.min(1, t / 2) * Math.min(1, (duration - t) / 2) * .5;
      }
    });
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    src.connect(filter).connect(bus);
    src.start();
    if (this.ambient) {
      this.ambient.source = src;
      this.ambient.active = true;
    }
  }

  getDebugInfo() {
    return {
      ready: this.ready,
      ambient: this.ambient?.id || null,
      chunk: this.ambient?.chunk ?? null,
      decodedChunks: this.streamStats.decoded,
      scheduled: this.streamStats.queued,
      cachedBuffers: this._chunkCache?.size || 0,
      tension: this.tension.toFixed(2)
    };
  }

  dispose() {
    try { this.ctx?.close(); } catch {}
    this.ctx = null;
    this.ready = false;
  }
}
