/* LASTBROADCAST · 广播合成音：电台底噪 + 按歌曲标签生成氛围乐 + VU 表 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LB = root.LB || {}; root.LB.synth = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ctx = null, master = null, analyser = null;
  var humGain = null, musicGain = null, musicTimer = null, musicProg = null, musicStep = 0;
  var noiseGain = null;

  // 每个标签对应一组和弦进行（根音半音数，大调/小调色彩）
  var PROGRESSIONS = {
    calm:     { roots: [0, 5, 3, 4], minor: false, wave: 'sine',  interval: 4.5, arp: false },
    lullaby:  { roots: [0, 0, 3, 4], minor: false, wave: 'sine',  interval: 5,   arp: true, arpSpeed: 1.2 },
    hype:     { roots: [0, 0, 5, 3], minor: false, wave: 'square', interval: 2.5, arp: true, arpSpeed: 0.22 },
    sad:      { roots: [0, 3, 0, 5], minor: true,  wave: 'triangle', interval: 5, arp: false },
    nostalgic:{ roots: [0, 4, 5, 3], minor: false, wave: 'triangle', interval: 4, arp: false, lowpass: 900 },
    hopeful:  { roots: [0, 5, 7, 4], minor: false, wave: 'triangle', interval: 3.5, arp: true, arpSpeed: 0.5 },
    warm:     { roots: [0, 3, 5, 4], minor: false, wave: 'sine',  interval: 4, arp: false },
    farewell: { roots: [0, 0, 3, 3], minor: true,  wave: 'sine',  interval: 6, arp: false }
  };
  var BASE = 220; // A3 附近

  function ensure() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    master.connect(analyser); analyser.connect(ctx.destination);
    // 电台底噪（柔和嘶声）
    var len = ctx.sampleRate * 2;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    var noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    noiseGain = ctx.createGain(); noiseGain.gain.value = 0.05;
    noise.connect(lp); lp.connect(noiseGain); noiseGain.connect(master);
    noise.start();
    // 设备嗡鸣
    var hum = ctx.createOscillator(); hum.frequency.value = 50; hum.type = 'sine';
    humGain = ctx.createGain(); humGain.gain.value = 0.015;
    hum.connect(humGain); humGain.connect(master); hum.start();
    musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
    if (ctx.state === 'suspended') ctx.resume();
  }

  function noteFreq(root, semis) {
    return BASE * Math.pow(2, (root + semis) / 12);
  }

  function playChord(prog, step, when) {
    var root = prog.roots[step % prog.roots.length];
    var semis = prog.minor ? [0, 3, 7] : [0, 4, 7];
    semis.push(prog.minor ? 10 : 11); // 七音
    semis.forEach(function (s, idx) {
      var osc = ctx.createOscillator();
      osc.type = prog.wave;
      osc.frequency.value = noteFreq(root, s);
      if (idx === 0) osc.frequency.value *= 0.5; // 低音
      var g = ctx.createGain();
      var dur = prog.interval * 0.9;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.12 / (idx === 3 ? 1.6 : 1), when + 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      var filt = null;
      if (prog.lowpass) {
        filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = prog.lowpass;
        osc.connect(filt); filt.connect(g);
      } else {
        osc.connect(g);
      }
      g.connect(musicGain);
      osc.start(when); osc.stop(when + dur + 0.1);
    });
  }

  function playArp(prog, step, when) {
    if (!prog.arp) return;
    var root = prog.roots[step % prog.roots.length];
    var semis = [0, 7, 12, 16, 12, 7];
    semis.forEach(function (s, i) {
      var t = when + i * prog.arpSpeed;
      var osc = ctx.createOscillator();
      osc.type = prog.minor ? 'triangle' : 'sine';
      osc.frequency.value = noteFreq(root, s) * 2;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + prog.arpSpeed * 0.8);
      osc.connect(g); g.connect(musicGain);
      osc.start(t); osc.stop(t + prog.arpSpeed);
    });
  }

  // tags -> 选择一种进行
  function progFor(tags) {
    var order = ['calm', 'lullaby', 'hype', 'sad', 'nostalgic', 'hopeful', 'warm', 'farewell'];
    for (var i = 0; i < order.length; i++) if (tags.indexOf(order[i]) >= 0) return PROGRESSIONS[order[i]];
    return PROGRESSIONS.calm;
  }

  function startMusic(tags) {
    ensure();
    if (!ctx || !musicGain) return;
    stopMusic();
    musicProg = progFor(tags);
    musicStep = 0;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicGain.gain.exponentialRampToValueAtTime(0.8, ctx.currentTime + 1.5);
    var tick = function () {
      var t = ctx.currentTime + 0.1;
      playChord(musicProg, musicStep, t);
      playArp(musicProg, musicStep, t + 0.5);
      musicStep++;
    };
    tick();
    musicTimer = setInterval(tick, musicProg.interval * 1000);
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (ctx && musicGain) {
      var t = ctx.currentTime;
      musicGain.gain.cancelScheduledValues(t);
      musicGain.gain.setValueAtTime(musicGain.gain.value || 0, t);
      musicGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    }
  }

  function setNoise(level) { if (noiseGain) noiseGain.gain.value = Math.max(0, Math.min(1, level)); }

  function vuLevel() {
    if (!analyser) return 0;
    var data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    var sum = 0;
    for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; sum += v * v; }
    return Math.sqrt(sum / data.length);
  }

  // 波形数据（示波器）
  function waveform() {
    if (!analyser) return null;
    var data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    return data;
  }

  function setVolume(v) { if (master) master.gain.value = Math.max(0, Math.min(1, v)); }

  // 环境音层（风/雨/远方警报）：随回合切换的氛围底
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
    ensure();
    if (!ctx) return;
    ensureAmbient();
    var t = ctx.currentTime;
    var g = p.gain != null ? p.gain : 0.06;
    ambGain.gain.cancelScheduledValues(t);
    ambGain.gain.setValueAtTime(ambGain.gain.value || 0, t);
    ambGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, g), t + 1.2);
    ambFilter.frequency.setTargetAtTime(p.filterFreq || 600, t, 0.8);
    if (ambLfo) { ambLfo.frequency.setTargetAtTime(p.lfoRate || 0.2, t, 0.5); }
  }
  function ambientOff() {
    if (!ctx || !ambGain) return;
    var t = ctx.currentTime;
    ambGain.gain.cancelScheduledValues(t);
    ambGain.gain.setValueAtTime(ambGain.gain.value || 0, t);
    ambGain.gain.exponentialRampToValueAtTime(0.0001, t + 1);
  }

  // 局间清理（C2）：停掉音乐并挂起上下文
  function cleanup() {
    stopMusic();
    if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) {} }
  }

  return { ensure: ensure, startMusic: startMusic, stopMusic: stopMusic, setNoise: setNoise, vuLevel: vuLevel, waveform: waveform, setVolume: setVolume, cleanup: cleanup, setAmbient: setAmbient, ambientOff: ambientOff };
});
