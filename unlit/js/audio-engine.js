/* UNLIT · 无光之城 — 音频引擎（Web Audio 程序化合成，零素材）
 * 提供：环境底噪、对象声源（闹钟/钥匙/货架/砧板…）、过街信号音、车流、
 *       白杖敲击+回声、烹饪声、节拍器、钱币、章节小调、中文语音（speechSynthesis，可关）。
 * 所有声源按 engine 状态逐帧更新：立体声像、距离音量、低通滤波（数学取自 UNLIT_AUDIOSCENE）。
 *
 * 设计要点：
 *  - 声源池按「种类」构建：噪声池（环境/货架/水声）与振荡池（闹钟/钥匙/金属）；
 *    滤波类型、中心频率、振荡波形每帧写入节点，因此每种物品有自己的音色。
 *  - 所有一次性节点在 onended 里 disconnect，避免长时间游玩后节点堆积。
 *  - 噪声缓冲只生成一次并复用（随机起点），不再每次敲击都新建 1 秒随机缓冲。
 *  - 无 StereoPannerNode 的浏览器用 panEqualPower 双声道增益回退，方位感不丢失。
 */
(function (root) {
  'use strict';
  const AS = root.UNLIT_AUDIOSCENE || {
    clamp: (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v),
    relAngle: (px, py, f, tx, ty) => Math.atan2(ty - py, tx - px) - f,
    distanceGain: (d, k) => 1 / (1 + d * (k === undefined ? 0.45 : k)),
    lowpassCutoff: (d) => Math.max(350, Math.min(20000, 20000 / (1 + d * 0.7))),
    echoDelayMs: (d) => (d / 340) * 1000,
    panEqualPower: (p) => {
      const a = (Math.max(-1, Math.min(1, p)) + 1) * Math.PI / 4;
      return [Math.cos(a), Math.sin(a)];
    }
  };

  let ctx = null, master = null;
  let voiceOn = true;
  let unavailable = false;       // 浏览器不支持 / 创建失败 → 文字模式
  let noiseBuf = null;
  const pools = {};              // 持续声源池：id → {kind, nodes}
  let lastStepAt = 0;
  let voicesCache = [];

  // ---------- 初始化 ----------
  function ensure() {
    if (!ctx && !unavailable) {
      try {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) { unavailable = true; return null; }
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.85;
        master.connect(ctx.destination);
      } catch (err) {
        ctx = null; master = null; unavailable = true;
        return null;
      }
    }
    resume();
    return ctx;
  }
  function resume() {
    try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (err) { /* noop */ }
  }
  // 自动播放策略：任何一次用户手势/回到前台都尝试恢复
  function bindAutoResume() {
    const kick = () => { ensure(); resume(); };
    try {
      for (const ev of ['pointerdown', 'touchstart', 'keydown', 'click']) {
        document.addEventListener(ev, kick, { passive: true });
      }
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) kick();
      });
    } catch (err) { /* 无 document 环境 */ }
  }
  function now() { return ctx ? ctx.currentTime : 0; }

  // 共享白噪声缓冲（2 秒），随机起点复用
  const NOISE_SECONDS = 2;
  function getNoiseBuf() {
    if (!noiseBuf) {
      const len = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS));
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  // 立体声像：优先 StereoPannerNode，否则 panEqualPower 双声道增益回退
  function makePan(initial) {
    const start = AS.clamp(initial || 0, -1, 1);
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = start;
      return {
        input: p,
        out: p,
        set(v, t) { p.pan.setTargetAtTime(AS.clamp(v, -1, 1), t, 0.06); }
      };
    }
    const gL = ctx.createGain(), gR = ctx.createGain();
    const lr = AS.panEqualPower(start);
    gL.gain.value = lr[0]; gR.gain.value = lr[1];
    const input = { connect(dest) { gL.connect(dest); gR.connect(dest); } };
    let out;
    if (ctx.createChannelMerger) {
      out = ctx.createChannelMerger(2);
      gL.connect(out, 0, 0); gR.connect(out, 0, 1);
    } else {
      out = { connect(dest) { gL.connect(dest); gR.connect(dest); } };  // 无合并器 → 退化单声道
    }
    return {
      input, out,
      set(v, t) {
        const a = AS.panEqualPower(v);
        gL.gain.setTargetAtTime(a[0], t, 0.06);
        gR.gain.setTargetAtTime(a[1], t, 0.06);
      }
    };
  }

  function disconnectAll(nodes) {
    for (const n of nodes) { if (n && n.disconnect) { try { n.disconnect(); } catch (err) { /* noop */ } } }
  }

  // ---------- 基础合成（一次性节点，播完即断开） ----------
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
    o.onended = () => disconnectAll([o, g]);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, filterType, freq, gain, when, pan) {
    if (!ctx) return;
    const t0 = now() + (when || 0);
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuf();
    src.loop = false;
    const f = ctx.createBiquadFilter();
    f.type = filterType || 'lowpass';
    f.frequency.value = freq || 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const panner = makePan(pan || 0);
    src.connect(f); f.connect(g); g.connect(panner.input); panner.out.connect(master);
    const offset = Math.random() * Math.max(0.01, NOISE_SECONDS - dur - 0.01);
    src.start(t0, offset, dur);
    src.stop(t0 + dur + 0.02);
    src.onended = () => disconnectAll([src, f, g, panner.out]);
  }

  function click(gain) { noiseBurst(0.03, 'highpass', 2500, gain || 0.25); }

  // ---------- 持续声源池 ----------
  // spec: { kind:'noise'|'osc', type, filterType, freq, cutoff, lp, gain, pan, Q }
  // 每个池有两只滤波器：f = 音色（带通/高通/低通 + 中心频率），lp = 距离低通（越远越闷）
  function buildPool(kind, spec) {
    const g = ctx.createGain(); g.gain.value = 0;
    const f = ctx.createBiquadFilter();
    f.type = spec.filterType || 'lowpass';
    f.frequency.value = spec.freq || 800;
    f.Q.value = spec.Q === undefined ? 0.8 : spec.Q;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = spec.lp || 20000;
    const panner = makePan(spec.pan || 0);
    f.connect(lp); lp.connect(g); g.connect(panner.input); panner.out.connect(master);
    const nodes = { f, lp, g, pan: panner };
    if (kind === 'osc') {
      const o = ctx.createOscillator();
      o.type = spec.type || 'sine';
      o.frequency.value = spec.freq || 220;
      o.connect(f);
      o.start();
      nodes.o = o;
    } else {
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuf();
      src.loop = true;
      src.connect(f);
      src.start();
      nodes.src = src;
    }
    return nodes;
  }

  // spec: { kind:'noise'|'osc', type, filterType, freq, cutoff, lp, gain, pan, Q }
  function setPool(id, spec) {
    if (!ctx) return;
    const kind = spec.kind || 'noise';
    let pool = pools[id];
    if (pool && pool.kind !== kind) { killPool(id); pool = null; }   // 种类变了要重建
    if (!pool) pool = pools[id] = { kind, nodes: buildPool(kind, spec) };
    const n = pool.nodes;
    const t = now();
    if (n.o) {
      if (spec.type && n.o.type !== spec.type) n.o.type = spec.type;
      if (spec.freq) n.o.frequency.setTargetAtTime(spec.freq, t, 0.05);
    }
    if (n.f) {
      if (spec.filterType && n.f.type !== spec.filterType) n.f.type = spec.filterType;
      const ff = spec.cutoff || (kind === 'noise' ? spec.freq : 0);
      if (ff) n.f.frequency.setTargetAtTime(ff, t, 0.05);
      if (spec.Q !== undefined) n.f.Q.setTargetAtTime(spec.Q, t, 0.05);
    }
    if (n.lp) n.lp.frequency.setTargetAtTime(spec.lp || 20000, t, 0.08);
    n.g.gain.setTargetAtTime(spec.gain || 0, t, 0.08);
    if (spec.pan !== undefined) n.pan.set(spec.pan, t);
  }
  function killPool(id) {
    const pool = pools[id];
    if (!pool) return;
    const n = pool.nodes;
    try { if (n.src) n.src.stop(); } catch (err) { /* noop */ }
    try { if (n.o) n.o.stop(); } catch (err) { /* noop */ }
    disconnectAll([n.src, n.o, n.f, n.lp, n.g, n.pan && n.pan.out]);
    delete pools[id];
  }

  // ---------- 说话 ----------
  function loadVoices() {
    try { voicesCache = root.speechSynthesis.getVoices() || []; } catch (err) { voicesCache = []; }
  }
  function speak(text, speaker, opts) {
    if (!voiceOn) return;
    try {
      if (!('speechSynthesis' in root)) return;
      if (!voicesCache.length) loadVoices();
      // 纯听觉路径下要听出「谁在说话」：旁白与内心独白不加前缀
      const name = (speaker && speaker !== '旁白' && speaker !== '墨（你）') ? speaker + '：' : '';
      const u = (name + String(text)).slice(0, 200);
      root.speechSynthesis.cancel();
      const uu = new root.SpeechSynthesisUtterance(u);
      uu.lang = 'zh-CN';
      uu.rate = (opts && opts.rate) || 0.95;
      uu.pitch = 1;
      const zh = voicesCache.find(v => v.lang && v.lang.toLowerCase().indexOf('zh') === 0);
      if (zh) uu.voice = zh;
      root.speechSynthesis.speak(uu);
    } catch (err) { /* 无语音环境：文字已经显示在 HUD 上 */ }
  }
  function stopSpeak() { try { if ('speechSynthesis' in root) root.speechSynthesis.cancel(); } catch (err) { /* noop */ } }

  // ---------- 白杖 ----------
  function tapCane(res) {
    if (!ctx) return;
    click(0.3);                              // 杖尖落地
    if (res && res.hit) {
      const d = Math.max(0.4, res.dist);
      const delay = AS.echoDelayMs(d) / 1000; // 声速延迟（用音频时钟，不用 setTimeout）
      const gain = Math.max(0.05, AS.distanceGain(d, 0.8));
      noiseBurst(0.12, 'bandpass', Math.max(500, 2600 - d * 300), gain * 0.35, delay, res.pan || 0);
      if (res.by === 'object') noiseBurst(0.08, 'bandpass', 1800, gain * 0.25, delay + 0.001, res.pan || 0);
    }
  }

  // ---------- 音色表（每种物品一个「指纹」） ----------
  const SOUNDS = {
    alarm: { kind: 'osc', type: 'square', freq: 940, cutoff: 2000, gain: 0.24, k: 0.4 },
    keys: { kind: 'osc', type: 'triangle', freq: 1500, cutoff: 6000, gain: 0.08, k: 0.5 },
    tomato: { kind: 'osc', type: 'sine', freq: 240, cutoff: 500, gain: 0.06, k: 0.5 },
    bottle: { kind: 'osc', type: 'sine', freq: 190, cutoff: 800, gain: 0.07, k: 0.5 },
    can: { kind: 'osc', type: 'triangle', freq: 2100, cutoff: 6000, gain: 0.06, k: 0.5 },
    rice: { kind: 'noise', filterType: 'bandpass', freq: 620, cutoff: 620, gain: 0.07, k: 0.5 },
    milk: { kind: 'noise', filterType: 'bandpass', freq: 420, cutoff: 420, gain: 0.06, k: 0.5 },
    bread: { kind: 'noise', filterType: 'bandpass', freq: 1800, cutoff: 1800, gain: 0.05, k: 0.5 },
    tap: { kind: 'noise', filterType: 'bandpass', freq: 700, cutoff: 700, gain: 0.07, k: 0.5 },
    chop: { kind: 'noise', filterType: 'bandpass', freq: 1200, cutoff: 1200, gain: 0.05, k: 0.5 }
  };
  function objectSoundParams(id, d, pan) {
    const s = SOUNDS[id];
    if (!s) return null;                       // 未知音色（如 beeper 由 updateBeeper 负责）
    return {
      kind: s.kind, type: s.type, filterType: s.filterType, freq: s.freq, cutoff: s.cutoff,
      lp: AS.lowpassCutoff(d),                 // 距离低通：越远越闷
      gain: s.gain * AS.distanceGain(d, s.k || 0.5), pan
    };
  }

  function ambientParams(id) {
    switch (id) {
      case 'bedroom': return { kind: 'noise', filterType: 'lowpass', freq: 180, cutoff: 380, gain: 0.075 };
      case 'apartment': return { kind: 'noise', filterType: 'lowpass', freq: 140, cutoff: 320, gain: 0.065 };
      case 'corridor': return { kind: 'noise', filterType: 'bandpass', freq: 240, cutoff: 900, gain: 0.035 };
      case 'elevator': return { kind: 'noise', filterType: 'bandpass', freq: 110, cutoff: 700, gain: 0.05 };
      case 'lobby': return { kind: 'noise', filterType: 'lowpass', freq: 120, cutoff: 500, gain: 0.05 };
      case 'street': return { kind: 'noise', filterType: 'bandpass', freq: 300, cutoff: 900, gain: 0.07 };
      case 'market': return { kind: 'noise', filterType: 'lowpass', freq: 350, cutoff: 1400, gain: 0.06 };
      case 'bookstore': return { kind: 'noise', filterType: 'lowpass', freq: 160, cutoff: 600, gain: 0.035 };
      case 'kitchen': return { kind: 'noise', filterType: 'lowpass', freq: 130, cutoff: 420, gain: 0.045 };
      default: return null;
    }
  }

  // 对象坐标 → 声像 / 距离
  function objPan(engine, id) {
    const o = engine.map && engine.map.objects.find(x => x.id === id);
    if (!o) return 0;
    const rel = AS.relAngle(engine.px, engine.py, engine.facing, o.x + 0.5, o.y + 0.5);
    return AS.clamp(rel / (Math.PI / 2), -1, 1);
  }
  function objDist(engine, id) {
    const o = engine.map && engine.map.objects.find(x => x.id === id);
    if (!o) return 1;
    return Math.hypot(o.x + 0.5 - engine.px, o.y + 0.5 - engine.py) || 1;
  }
  function nearestObject(engine, id) {
    let best = null, bestD = Infinity;
    for (const o of (engine.map ? engine.map.objects : [])) {
      if (o.id !== id) continue;
      const d = Math.hypot(o.x + 0.5 - engine.px, o.y + 0.5 - engine.py);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best ? { obj: best, d: bestD } : null;
  }

  // ---------- 主更新：按 engine 状态驱动声景 ----------
  function update(engine) {
    if (!ctx || !engine) return;
    const ch = engine.curChapter ? engine.curChapter() : null;
    const md = engine.mapDef ? engine.mapDef() : null;
    const ambience = md ? md.ambience : null;

    // 环境底噪
    const amb = ambientParams(ambience);
    if (amb) setPool('amb', amb); else killPool('amb');

    // 循环对象声源（闹钟/钥匙/货架/烹饪器具）
    // 一个货架在地图上是多格：取「离玩家最近的那一格」定音色与方位，否则会听到货架的另一头
    const wanted = {};
    if (engine.map && engine.map.objects) {
      const bestBySound = {};
      for (const o of engine.map.objects) {
        const m = engine.objMeta ? engine.objMeta(o.id) : null;
        if (!m || !m.loopSound || engine.collected[o.id]) continue;
        if (m.loopSound === 'beeper') continue;          // 信号音由 updateBeeper 按节奏播放
        if (m.loopSound === 'alarm' && engine.flags.alarmOff) continue;
        if (m.loopSound === 'boil' || m.loopSound === 'sizzle') continue;  // 由烹饪强度驱动
        const d = Math.hypot(o.x + 0.5 - engine.px, o.y + 0.5 - engine.py);
        if (d > 9) continue;
        const prev = bestBySound[m.loopSound];
        if (prev && prev.d <= d) continue;
        bestBySound[m.loopSound] = { d, obj: o };
      }
      for (const id of Object.keys(bestBySound)) {
        const hit = bestBySound[id];
        const pan = AS.clamp(AS.relAngle(engine.px, engine.py, engine.facing, hit.obj.x + 0.5, hit.obj.y + 0.5) / (Math.PI / 2), -1, 1);
        const spec = objectSoundParams(id, hit.d, pan);
        if (spec) wanted[id] = spec;
      }
    }
    // 烹饪：按强度（水开气泡声 / 油锅滋啦声）
    const cook = ch && ch.puzzles && ch.puzzles.cook;
    if (cook && engine.cookStep < cook.steps.length) {
      const step = cook.steps[engine.cookStep];
      if (step.id === 'stove') {
        const s = engine.stoveIntensity();
        wanted.boil = { kind: 'noise', filterType: 'bandpass', freq: 500 + s * 900, cutoff: 1200 + s * 1800, lp: AS.lowpassCutoff(objDist(engine, 'stove')), gain: 0.05 + s * 0.16, pan: objPan(engine, 'stove') };
      }
      if (step.id === 'pan') {
        const s = engine.panIntensity();
        wanted.sizzle = { kind: 'noise', filterType: 'highpass', freq: 2600 + s * 1400, cutoff: 3800, lp: AS.lowpassCutoff(objDist(engine, 'pan')), gain: 0.03 + s * 0.13, pan: objPan(engine, 'pan') };
      }
    }
    // 同步池：不在 wanted 里的（除常驻）全部销毁
    for (const id of Object.keys(wanted)) setPool(id, wanted[id]);
    for (const id of Object.keys(pools)) {
      if (id === 'amb' || id === 'car') continue;
      if (!wanted[id]) killPool(id);
    }

    // 车流（街道）
    const c = engine.crossing;
    if (c && engine.cars.length) {
      const car = engine.cars[0];
      const d = Math.hypot(car.x - engine.px, car.y - engine.py) || 1;
      const pan = AS.clamp(AS.relAngle(engine.px, engine.py, engine.facing, car.x, car.y) / (Math.PI / 2), -1, 1);
      const vol = Math.min(0.28, 0.1 + engine.cars.length * 0.03) * AS.distanceGain(d, 0.25);
      setPool('car', { kind: 'noise', filterType: 'lowpass', freq: 90 + car.speed * 30, cutoff: 500, lp: AS.lowpassCutoff(d), gain: vol, pan });
    } else killPool('car');

    if (c) updateBeeper(engine);
  }

  // 过街信号音：按最近提示器的距离/方位播放（"跟着它走"才成立）
  let beeperLast = -99;
  function updateBeeper(engine) {
    const tick = engine.beeperTick();
    const near = nearestObject(engine, 'crossSignA');
    const d = near ? near.d : 99;
    if (d > 14) return;                       // 太远就听不见
    const t = now();                          // 用音频时钟：地图切换重置 gameTime 也不会卡住
    if (t - beeperLast >= tick.every) {
      beeperLast = t;
      const pan = near ? AS.clamp(AS.relAngle(engine.px, engine.py, engine.facing, near.obj.x + 0.5, near.obj.y + 0.5) / (Math.PI / 2), -1, 1) : 0;
      const vol = AS.distanceGain(d, 0.35);
      const green = tick.kind === 'green';
      noiseBurst(green ? 0.06 : 0.1, 'bandpass', green ? 1320 : 880, (green ? 0.16 : 0.2) * vol, 0, pan);
      if (green) noiseBurst(0.04, 'bandpass', 1320, 0.1 * vol, 0.05, pan);
    }
  }

  // ---------- 一次性音效 ----------
  function step() {
    if (!ctx) return;
    const t = now();
    if (t - lastStepAt > 0.45) {
      lastStepAt = t;
      noiseBurst(0.05, 'lowpass', 500, 0.05);
    }
  }
  // 节拍器（试音）：accent 为重音
  function metronome(accent) {
    if (!ctx) return;
    tone(accent ? 1600 : 1100, 0.06, 'square', accent ? 0.16 : 0.11);
    noiseBurst(0.03, 'bandpass', accent ? 2400 : 1700, 0.08);
  }
  // 砧板落刀
  function chop() {
    if (!ctx) return;
    noiseBurst(0.05, 'bandpass', 1200, 0.16);
    tone(170, 0.07, 'sine', 0.1);
  }
  // 硬币：面额越小声音越高越轻
  function coin(value) {
    if (!ctx) return;
    const f = value >= 100 ? 1350 : value >= 50 ? 1850 : 2400;
    tone(f, 0.14, 'triangle', 0.09, 0, f * 0.75);
    noiseBurst(0.06, 'highpass', 3500, 0.05, 0.005);
  }
  // 纸币：纸页摩擦
  function bill() {
    if (!ctx) return;
    noiseBurst(0.16, 'highpass', 3200, 0.05);
    noiseBurst(0.12, 'highpass', 2600, 0.04, 0.09);
  }
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

  // 语音列表在部分浏览器里是异步到达的
  try {
    if (root.speechSynthesis && root.speechSynthesis.addEventListener) {
      root.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }
  } catch (err) { /* noop */ }

  root.UNLIT_AUDIO = {
    ensure, resume, bindAutoResume, update, tapCane, click, speak, stopSpeak,
    stinger, ending, chime, step, metronome, chop, coin, bill, setVoice, stopAll,
    get voiceOn() { return voiceOn; },
    get unavailable() { return unavailable; }
  };
})(typeof self !== 'undefined' ? self : this);
