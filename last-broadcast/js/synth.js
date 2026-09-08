/* LASTBROADCAST · 合成器引擎
   电台底噪 + 31 首曲谱音序器（和弦/低音/旋律/鼓/音色）+ 环境音层 + VU/示波器 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./shared/scores.js'));
  else { root.LB = root.LB || {}; root.LB.synth = factory(root.LB.scores); }
})(typeof self !== 'undefined' ? self : this, function (scoresMod) {
  'use strict';

  var SCORES = scoresMod ? scoresMod.SCORES : {};
  var noteFreq = scoresMod ? scoresMod.noteFreq : function () { return null; };
  var chordNotes = scoresMod ? scoresMod.chordNotes : function () { return []; };
  var melodyTrack = scoresMod ? scoresMod.melodyTrack : function () { return { map: {}, totalSteps: 0 }; };

  var ctx = null, master = null, analyser = null;
  var humGain = null, noiseGain = null, musicGain = null;
  var musicScore = null, track = null, schedTimer = null, nextT = 0, stepIdx = 0;
  var volume = 0.9, noiseLevel = 0.05;      // 上下文创建前设置的音量/底噪要先记住
  var trackCache = {};                       // 曲谱展开结果按曲目缓存
  var hatBuffer = null;                      // 鼓点噪声只生成一次

  // 一个音符用完的节点必须断开，否则整夜下来会累积上千个节点
  function release(nodes) {
    return function () {
      for (var i = 0; i < nodes.length; i++) {
        try { if (nodes[i] && nodes[i].disconnect) nodes[i].disconnect(); } catch (e) {}
      }
    };
  }

  // ---------- 基础 ----------
  function resumeCtx() {
    if (!ctx || ctx.state !== 'suspended') return;
    try {
      var p = ctx.resume();
      if (p && typeof p.catch === 'function') p.catch(function () {}); // 自动播放策略被拒时不产生未处理的 rejection
    } catch (e) {}
  }

  function ensure() {
    if (ctx) { resumeCtx(); return; }
    var AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = volume;
    analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    master.connect(analyser); analyser.connect(ctx.destination);
    var len = ctx.sampleRate * 2;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    var noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    noiseGain = ctx.createGain(); noiseGain.gain.value = noiseLevel;
    noise.connect(lp); lp.connect(noiseGain); noiseGain.connect(master);
    noise.start();
    var hum = ctx.createOscillator(); hum.frequency.value = 50; hum.type = 'sine';
    humGain = ctx.createGain(); humGain.gain.value = 0.015;
    hum.connect(humGain); humGain.connect(master); hum.start();
    musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
    resumeCtx();
  }

  // ---------- 乐器（音色） ----------
  function playTone(freq, t, dur, style, vol) {
    if (!ctx || !musicGain || freq <= 0) return;
    var o1 = ctx.createOscillator();
    var g = ctx.createGain();
    var filter = null;
    if (style === 'lead') {
      o1.type = 'sawtooth';
      filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1800; filter.Q.value = 2;
    } else if (style === 'bell') {
      o1.type = 'sine';
    } else {
      o1.type = 'triangle';
    }
    o1.frequency.value = freq;
    var attack = style === 'pad' ? 0.25 : 0.012;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o1.connect(filter || g);
    if (filter) filter.connect(g);
    g.connect(musicGain);
    o1.start(t); o1.stop(t + dur + 0.05);
    o1.onended = release([o1, g, filter]);
    if (style === 'bell' || style === 'piano') {
      var o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = freq * (style === 'bell' ? 2.76 : 2);
      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(vol * 0.35, t + attack);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);
      o2.connect(g2); g2.connect(musicGain);
      o2.start(t); o2.stop(t + dur);
      o2.onended = release([o2, g2]);
    }
    if (style === 'pad') {
      var o3 = ctx.createOscillator();
      o3.type = 'triangle'; o3.frequency.value = freq * 1.006;
      var g3 = ctx.createGain();
      g3.gain.setValueAtTime(0.0001, t);
      g3.gain.exponentialRampToValueAtTime(vol * 0.5, t + attack);
      g3.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o3.connect(g3); g3.connect(musicGain);
      o3.start(t); o3.stop(t + dur + 0.05);
      o3.onended = release([o3, g3]);
    }
  }

  function playKick(t, vol) {
    if (!ctx || !musicGain) return;
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    var g = ctx.createGain();
    var v = vol == null ? 0.22 : vol;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.15);
    o.onended = release([o, g]);
  }

  function playHat(t, vol) {
    if (!ctx || !musicGain) return;
    if (!hatBuffer || hatBuffer.sampleRate !== ctx.sampleRate) {
      var len = Math.floor(ctx.sampleRate * 0.05);
      hatBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = hatBuffer.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    var src = ctx.createBufferSource(); src.buffer = hatBuffer;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol == null ? 0.1 : vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp); hp.connect(g); g.connect(musicGain);
    src.start(t); src.stop(t + 0.06);
    src.onended = release([src, hp, g]);
  }

  // ---------- 音序器 ----------
  function spb(score) { return 60 / score.bpm / 4; }

  function scheduleAhead() {
    if (!musicScore || !track) return;
    var stepDur = spb(musicScore);
    // 标签页被节流后 nextT 会落在过去，若不追上会一次性补发成百上千个音符
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.02;
    while (nextT < ctx.currentTime + 0.22) {
      scheduleStep(stepIdx, nextT, stepDur);
      nextT += stepDur;
      stepIdx = (stepIdx + 1) % 64;
    }
  }

  function scheduleStep(s, t, stepDur) {
    var beat = s / 4;
    var bar = Math.floor(beat / 4);
    var inBar = beat - bar * 4;
    var chord = chordNotes(musicScore.prog[bar], 3);
    if (inBar === 0) {
      var dur = stepDur * 16 * 0.96;
      chord.forEach(function (f) { playTone(f, t, dur, 'pad', 0.055); });
      playTone(chord[0] / 2, t, dur * 0.9, 'bass', 0.085);
    } else if (inBar === 2) {
      playTone(chord[0] / 2, t, stepDur * 8 * 0.9, 'bass', 0.06);
    }
    var entry = track.map[s];
    if (entry) playTone(entry.freq, t, entry.durSteps * stepDur * 0.92, musicScore.style, 0.12);
    if (musicScore.drums === 'soft') {
      if (inBar === 0) playKick(t);
      else if (inBar === 2) playKick(t, 0.7);
      if (s % 2 === 1) playHat(t, s % 4 === 3 ? 0.32 : 0.2);
    }
  }

  function startMusic(id) {
    stopMusic();
    ensure();
    if (!ctx || !musicGain) return;
    var sc = null;
    if (typeof id === 'string') sc = SCORES[id] || null;
    if (!sc) return;
    musicScore = sc;
    // 同一首歌反复播放时不必重新展开曲谱
    track = trackCache[id] || (trackCache[id] = melodyTrack(sc.melody));
    stepIdx = 0;
    nextT = ctx.currentTime + 0.12;
    var t = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(0.0001, t);
    musicGain.gain.exponentialRampToValueAtTime(0.9, t + 1);
    schedTimer = setInterval(scheduleAhead, 30);
  }

  function stopMusic() {
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
    musicScore = null; track = null;
    if (ctx && musicGain) {
      var t = ctx.currentTime;
      musicGain.gain.cancelScheduledValues(t);
      musicGain.gain.setValueAtTime(musicGain.gain.value || 0, t);
      musicGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    }
  }

  // 底噪强度：上下文还没建立时先记住，建立后生效（平滑过渡，避免爆音）
  function setNoise(level) {
    noiseLevel = Math.max(0, Math.min(1, level));
    if (!noiseGain || !ctx) return;
    noiseGain.gain.setTargetAtTime(noiseLevel, ctx.currentTime, 0.4);
  }

  // ---------- 仪表 ----------
  function vuLevel() {
    if (!analyser) return 0;
    var data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    var sum = 0;
    for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; sum += v * v; }
    return Math.sqrt(sum / data.length);
  }

  function waveform() {
    if (!analyser) return null;
    var data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    return data;
  }

  // 音量：上下文还没建立时先记住，ensure() 建好后立即生效（否则存档里的音量会被 0.9 覆盖）
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = volume;
  }

  function ring() {
    if (!ctx) return;           // 没有用户手势就不创建音频上下文（自动播放策略）
    resumeCtx();
    var t = ctx.currentTime + 0.02;
    for (var i = 0; i < 2; i++) {
      var o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = 1180;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.18);
      o.onended = release([o, g]);
      t += 0.3;
    }
  }

  // 环境音层
  var ambGain = null, ambFilter = null, ambLfo = null;
  function ensureAmbient() {
    if (ambGain) return;
    var len = ctx.sampleRate * 3;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.8;
    var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    ambFilter = ctx.createBiquadFilter(); ambFilter.type = 'bandpass'; ambFilter.frequency.value = 600; ambFilter.Q.value = 0.6;
    ambGain = ctx.createGain(); ambGain.gain.value = 0;
    src.connect(ambFilter); ambFilter.connect(ambGain); ambGain.connect(master);
    src.start();
    ambLfo = ctx.createOscillator(); ambLfo.frequency.value = 0.25;
    var lfoGain = ctx.createGain(); lfoGain.gain.value = 0;
    ambLfo.connect(lfoGain); lfoGain.connect(ambFilter.frequency);
    ambLfo.start();
  }
  function setAmbient(p) {
    if (!ctx) return;           // 不主动创建上下文（等用户手势），否则会被自动播放策略拦下
    ensureAmbient();
    var t = ctx.currentTime;
    var g = p.gain != null ? p.gain : 0.06;
    ambGain.gain.cancelScheduledValues(t);
    ambGain.gain.setValueAtTime(ambGain.gain.value || 0, t);
    ambGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, g), t + 1.2);
    ambFilter.frequency.setTargetAtTime(p.filterFreq || 600, t, 0.8);
    if (ambLfo) ambLfo.frequency.setTargetAtTime(p.lfoRate || 0.2, t, 0.5);
  }
  function ambientOff() {
    if (!ctx || !ambGain) return;
    var t = ctx.currentTime;
    ambGain.gain.cancelScheduledValues(t);
    ambGain.gain.setValueAtTime(ambGain.gain.value || 0, t);
    ambGain.gain.exponentialRampToValueAtTime(0.0001, t + 1);
  }

  function cleanup() {
    stopMusic();
    if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) {} }
  }

  return {
    ensure: ensure, startMusic: startMusic, stopMusic: stopMusic,
    setNoise: setNoise, vuLevel: vuLevel, waveform: waveform, setVolume: setVolume,
    cleanup: cleanup, setAmbient: setAmbient, ambientOff: ambientOff, ring: ring
  };
});
