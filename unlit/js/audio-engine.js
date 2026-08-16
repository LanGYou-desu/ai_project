/* UNLIT · 无光之城 — 音频引擎（Web Audio 程序化合成，零素材）
 * 提供：环境底噪、对象声源（闹钟/钥匙/货架…）、过街信号音、车流、
 *       白杖敲击+回声、烹饪声、章节小调、中文语音（speechSynthesis，可关）。
 * 所有声源按 engine 状态逐帧更新：立体声像、距离音量、低通滤波。
 */
(function (root) {
  'use strict';
  let ctx = null, master = null;
  let voiceOn = true;
  const pools = {};          // 持续声源池：id → {nodes, params}
  let lastStepAt = 0;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function now() { return ctx ? ctx.currentTime : 0; }

  // ---------- 基础合成 ----------
  function tone(freq, dur, type, gain, when, freqEnd) {
    if (!ctx) return;
    const t0 = now() + (when || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noiseBurst(dur, filterType, freq, gain, when) {
    if (!ctx) return;
    const t0 = now() + (when || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = filterType || 'lowpass'; f.frequency.value = freq || 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }
  function click(gain) { noiseBurst(0.03, 'highpass', 2500, gain || 0.25); }

  // ---------- 持续声源池 ----------
  function buildNoiseLoop(type, freq) {
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 800; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(f); f.connect(g);
    if (p) { g.connect(p); p.connect(master); } else g.connect(master);
    src.start();
    return { src, f, g, p };
  }
  function buildOscLoop(type, freq) {
    const o = ctx.createOscillator();
    o.type = type || 'sine'; o.frequency.value = freq || 220;
    const g = ctx.createGain(); g.gain.value = 0;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 4000;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.connect(f); f.connect(g);
    if (p) { g.connect(p); p.connect(master); } else g.connect(master);
    o.start();
    return { o, f, g, p };
  }
  function setPool(id, kind, params) {
    if (!ctx) return;
    let pool = pools[id];
    if (!pool) {
      pool = pools[id] = { kind, nodes: kind === 'noise' ? buildNoiseLoop() : buildOscLoop() };
    }
    const n = pool.nodes;
    const t = now();
    if (n.o) { n.o.type = params.type || n.o.type; n.o.frequency.setTargetAtTime(params.freq || n.o.frequency.value, t, 0.05); }
    if (n.f) n.f.frequency.setTargetAtTime(params.cutoff || 3000, t, 0.05);
    if (n.g) n.g.gain.setTargetAtTime(params.gain || 0, t, 0.08);
    if (n.p) n.p.pan.setTargetAtTime(params.pan || 0, t, 0.06);
    pool.off = !!params.off;
  }
  function killPool(id) {
    const pool = pools[id];
    if (!pool) return;
    try { pool.nodes.src ? pool.nodes.src.stop() : pool.nodes.o.stop(); } catch (e) { /* noop */ }
    delete pools[id];
  }

  // ---------- 说话 ----------
  let lastSpeak = 0;
  function speak(text, speaker, opts) {
    if (!voiceOn) return;
    try {
      if (!('speechSynthesis' in window)) return;
      const u = String(text).slice(0, 160);
      window.speechSynthesis.cancel();
      const uu = new SpeechSynthesisUtterance(u);
      uu.lang = 'zh-CN';
      uu.rate = (opts && opts.rate) || 0.95;
      uu.pitch = 1;
      const voices = window.speechSynthesis.getVoices();
      const zh = voices.find(v => v.lang && v.lang.toLowerCase().indexOf('zh') === 0);
      if (zh) uu.voice = zh;
      window.speechSynthesis.speak(uu);
      lastSpeak = Date.now();
    } catch (e) { /* 无语音环境 */ }
  }
  function stopSpeak() { try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {} }

  // ---------- 白杖 ----------
  function tapCane(res) {
    if (!ctx) return;
    click(0.3);                              // 杖尖落地
    if (res && res.hit) {
      const d = Math.max(0.4, res.dist);
      const delay = d / 340;                 // 声速延迟
      const gain = Math.max(0.05, 1 / (1 + d * 0.8));
      setTimeout(() => {
        noiseBurst(0.12, 'bandpass', Math.max(500, 2600 - d * 300), gain * 0.35, 0);
        if (res.by === 'object') noiseBurst(0.08, 'bandpass', 1800, gain * 0.25, 0.001);
      }, delay * 1000);
    }
  }

  // ---------- 主更新：按 engine 状态驱动声景 ----------
  function update(engine) {
    if (!ctx || !engine) return;
    const ch = engine.curChapter ? engine.curChapter() : null;
    const md = engine.mapDef ? engine.mapDef() : null;
    const ambience = md ? md.ambience : null;

    // 环境底噪
    const amb = ambientParams(ambience);
    if (amb) setPool('amb', 'noise', amb); else killPool('amb');

    // 循环对象声源（闹钟/钥匙/货架/烹饪）
    const wanted = {};
    if (engine.map && engine.map.objects) {
      for (const o of engine.map.objects) {
        const m = engine.objMeta ? engine.objMeta(o.id) : null;
        if (!m || !m.loopSound || engine.collected[o.id]) continue;
        if (m.loopSound === 'alarm' && engine.flags.alarmOff) continue;
        const dx = o.x + 0.5 - engine.px, dy = o.y + 0.5 - engine.py;
        const d = Math.hypot(dx, dy);
        if (d > 9) continue;
        const rel = Math.atan2(dy, dx) - engine.facing;
        const pan = Math.max(-1, Math.min(1, rel / (Math.PI / 2)));
        wanted[m.loopSound] = objectSoundParams(m.loopSound, d, pan, engine);
      }
    }
    // 烹饪：按强度
    const cook = ch && ch.puzzles && ch.puzzles.cook;
    if (cook && engine.cookStep < cook.steps.length) {
      const step = cook.steps[engine.cookStep];
      if (step.id === 'stove') {
        const s = engine.stoveIntensity();
        wanted.boil = { freq: 500 + s * 900, cutoff: 1200 + s * 1800, gain: 0.05 + s * 0.16, pan: boilPan(engine), type: 'bandpass' };
      }
      if (step.id === 'pan') {
        const s = engine.panIntensity();
        wanted.sizzle = { freq: 2600 + s * 1400, cutoff: 3800, gain: 0.03 + s * 0.13, pan: panPan(engine), type: 'highpass' };
      }
    }
    // 同步池
    for (const id of Object.keys(wanted)) setPool(id, 'noise', { ...wanted[id], off: false });
    for (const id of Object.keys(pools)) {
      if (id === 'amb' || id === 'car') continue;
      if (!wanted[id]) killPool(id);
    }

    // 车流（街道）
    const c = engine.crossing;
    if (c) {
      const carCount = engine.cars.length;
      if (carCount > 0) {
        // 综合车流底噪
        const road = c.roads[0];
        const car = engine.cars[0];
        const dx = car.x - engine.px, dy = car.y - engine.py;
        const d = Math.hypot(dx, dy) || 1;
        const rel = Math.atan2(dy, dx) - engine.facing;
        const pan = Math.max(-1, Math.min(1, rel / (Math.PI / 2)));
        const vol = Math.min(0.28, 0.1 + carCount * 0.03);
        setPool('car', 'noise', { freq: 90 + car.speed * 30, cutoff: 500, gain: vol / (1 + d * 0.25), pan });
      } else killPool('car');
      // 过街信号音
      updateBeeper(engine);
    } else killPool('car');

    // 脚步声
    if (engine.gameTime - lastStepAt > 0.5) { /* 由 move 触发 */ }
  }

  function ambientParams(id) {
    switch (id) {
      case 'bedroom': return { type: 'lowpass', freq: 180, cutoff: 380, gain: 0.075 };
      case 'apartment': return { type: 'lowpass', freq: 140, cutoff: 320, gain: 0.065 };
      case 'corridor': return { type: 'bandpass', freq: 240, cutoff: 900, gain: 0.035 };
      case 'elevator': return { type: 'bandpass', freq: 110, cutoff: 700, gain: 0.05 };
      case 'lobby': return { type: 'lowpass', freq: 120, cutoff: 500, gain: 0.05 };
      case 'street': return { type: 'bandpass', freq: 300, cutoff: 900, gain: 0.07 };
      case 'market': return { type: 'lowpass', freq: 350, cutoff: 1400, gain: 0.06 };
      case 'bookstore': return { type: 'lowpass', freq: 160, cutoff: 600, gain: 0.035 };
      case 'kitchen': return { type: 'lowpass', freq: 130, cutoff: 420, gain: 0.045 };
      default: return null;
    }
  }
  function objectSoundParams(id, d, pan, engine) {
    const base = { pan, cutoff: 2500, gain: 0.12 / (1 + d * 0.5), type: 'sine' };
    switch (id) {
      case 'alarm': return { ...base, freq: 940, gain: 0.24 / (1 + d * 0.4), cutoff: 2000, type: 'square' };
      case 'keys': return { ...base, freq: 1500, gain: 0.08 / (1 + d * 0.5), cutoff: 6000 };
      case 'rice': return { ...base, freq: 620, cutoff: 1100, type: 'bandpass', gain: 0.07 / (1 + d * 0.5) };
      case 'tomato': return { ...base, freq: 240, cutoff: 500, gain: 0.06 / (1 + d * 0.5) };
      case 'milk': return { ...base, freq: 420, cutoff: 900, type: 'bandpass', gain: 0.06 / (1 + d * 0.5) };
      case 'can': return { ...base, freq: 2100, cutoff: 6000, gain: 0.06 / (1 + d * 0.5) };
      case 'bottle': return { ...base, freq: 190, cutoff: 800, gain: 0.07 / (1 + d * 0.5) };
      case 'bread': return { ...base, freq: 1800, cutoff: 7000, type: 'bandpass', gain: 0.05 / (1 + d * 0.5) };
      case 'tap': return { ...base, freq: 700, cutoff: 1600, type: 'bandpass', gain: 0.07 / (1 + d * 0.5) };
      default: return base;
    }
  }
  let beeperLast = 0;
  function updateBeeper(engine) {
    const tick = engine.beeperTick();
    if (engine.gameTime - beeperLast >= tick.every) {
      beeperLast = engine.gameTime;
      const sign = engine.signalPhase() === 'green' ? 0 : 0;
      tone(tick.kind === 'green' ? 1320 : 880, 0.08, 'square', tick.kind === 'green' ? 0.12 : 0.14);
      if (tick.kind === 'green') tone(1320, 0.05, 'square', 0.08, 0.02);
    }
  }

  // 烹饪声位置（从对象坐标计算 pan）
  function boilPan(engine) { return objPan(engine, 'stove'); }
  function panPan(engine) { return objPan(engine, 'pan'); }
  function objPan(engine, id) {
    const o = engine.map && engine.map.objects.find(x => x.id === id);
    if (!o) return 0;
    const rel = Math.atan2(o.y + 0.5 - engine.py, o.x + 0.5 - engine.px) - engine.facing;
    return Math.max(-1, Math.min(1, rel / (Math.PI / 2)));
  }

  function step() {
    if (!ctx) return;
    const t = now();
    if (t - lastStepAt > 0.45) {
      lastStepAt = t;
      noiseBurst(0.05, 'lowpass', 500, 0.05);
    }
  }

  // ---------- 章节小调 ----------
  function stinger(chapterId) {
    if (!ctx) return;
    const themes = {
      ch0: [392, 494, 587, 784],
      ch1: [440, 554, 659, 880],
      ch2: [349, 466, 523, 698],
      ch3: [440, 523, 659, 784],
      ch4: [392, 440, 523, 659],
      ch5: [330, 392, 494, 659]
    };
    const notes = themes[chapterId] || themes.ch0;
    notes.forEach((f, i) => tone(f, 0.5, 'sine', 0.08, i * 0.14));
  }
  function ending() {
    if (!ctx) return;
    const notes = [262, 330, 392, 523, 659, 784, 1047];
    notes.forEach((f, i) => tone(f, 1.2, 'sine', 0.07, i * 0.35));
    notes.slice().reverse().forEach((f, i) => tone(f, 1.4, 'sine', 0.05, notes.length * 0.35 + i * 0.3));
  }
  function chime() { tone(1568, 0.25, 'sine', 0.12); tone(2093, 0.4, 'sine', 0.08, 0.12); }

  function stopAll() {
    for (const id of Object.keys(pools)) killPool(id);
    stopSpeak();
  }
  function setVoice(on) { voiceOn = !!on; if (!voiceOn) stopSpeak(); }

  root.UNLIT_AUDIO = {
    ensure, update, tapCane, click, speak, stopSpeak, stinger, ending, chime,
    step, setVoice, stopAll, get voiceOn() { return voiceOn; }
  };
})(typeof self !== 'undefined' ? self : this);
