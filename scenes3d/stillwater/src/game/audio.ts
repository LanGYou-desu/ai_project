/** A small procedural bathhouse ambience: room tone, water lapping, and a low drone. */
export class WaterAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private started = false;
  muted = false;

  start() {
    if (this.started) {
      void this.ctx?.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.started = true;

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    this.master = master;

    // Generate a smooth impulse response for the tiled hall.
    const seconds = 4.8;
    const rate = ctx.sampleRate;
    const ir = ctx.createBuffer(2, Math.floor(seconds * rate), rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / data.length;
        const decay = Math.pow(1 - t, 3.4);
        const n = Math.random() * 2 - 1;
        lp += (n - lp) * 0.18;
        data[i] = (lp * 0.72 + n * 0.28) * decay;
      }
    }
    const verb = ctx.createConvolver();
    verb.buffer = ir;
    const verbGain = ctx.createGain();
    verbGain.gain.value = 0.34;
    verb.connect(verbGain);
    verbGain.connect(master);

    const dry = ctx.createGain();
    dry.gain.value = 0.46;
    dry.connect(master);
    dry.connect(verb);

    // Layer several decorrelated noise bands for a wide, breathing water bed.
    const bufferLength = rate * 7;
    const noiseBuffer = ctx.createBuffer(2, bufferLength, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = noiseBuffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferLength; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
      }
    }

    for (let i = 0; i < 3; i++) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;
      src.playbackRate.value = 0.85 + i * 0.11;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 280 + i * 310;
      filter.Q.value = 0.5 + i * 0.35;
      const gain = ctx.createGain();
      gain.gain.value = 0.028 + i * 0.012;
      const pan = ctx.createStereoPanner();
      pan.pan.value = i === 0 ? -0.55 : i === 1 ? 0.55 : 0;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(dry);

      // Slow amplitude breathing, like water moving against tile.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.035 + i * 0.017;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.013 + i * 0.004;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      src.start(ctx.currentTime + i * 0.007);
    }

    // A large, quiet harmonic room tone.
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.017;
    droneGain.connect(verb);
    droneGain.connect(dry);
    [43.65, 65.4, 87.3, 130.8].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 3 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      osc.detune.value = [-7, 4, 8, -3][i];
      const g = ctx.createGain();
      g.gain.value = [0.55, 0.23, 0.12, 0.035][i];
      osc.connect(g);
      g.connect(droneGain);
      osc.start();
    });

    master.gain.setTargetAtTime(0.78, ctx.currentTime + 0.1, 2.0);
    void ctx.resume();
  }

  toggle(): boolean {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0.0001 : 0.78, this.ctx.currentTime, 0.4);
    }
    return this.muted;
  }

  stop() {
    if (!this.ctx) return;
    this.ctx.close();
    this.ctx = null;
    this.started = false;
  }
}
