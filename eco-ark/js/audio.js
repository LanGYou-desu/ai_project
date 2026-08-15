/* ECO-ARK · Web Audio 环境音（风声 / 雨声 / 鸟鸣 / 水声）——极简合成，静音优先 */
(function () {
  'use strict';
  var ctx = null;
  var master = null;
  var windGain = null, rainGain = null, waterGain = null;
  var birdTimer = null;
  var muted = false;
  var lastBird = 0;

  function ensure() {
    if (ctx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      // 风：粉色噪声 + 低通
      var windBuf = noiseBuffer();
      var windSrc = ctx.createBufferSource();
      windSrc.buffer = windBuf; windSrc.loop = true;
      var windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass'; windFilter.frequency.value = 420;
      windGain = ctx.createGain(); windGain.gain.value = 0;
      windSrc.connect(windFilter).connect(windGain).connect(master);
      windSrc.start();

      // 雨：白噪声 + 带通
      var rainBuf = noiseBuffer(2);
      var rainSrc = ctx.createBufferSource();
      rainSrc.buffer = rainBuf; rainSrc.loop = true;
      var rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'bandpass'; rainFilter.frequency.value = 1800; rainFilter.Q.value = 0.6;
      rainGain = ctx.createGain(); rainGain.gain.value = 0;
      rainSrc.connect(rainFilter).connect(rainGain).connect(master);
      rainSrc.start();

      // 水：低频流动
      var waterBuf = noiseBuffer(1.5);
      var waterSrc = ctx.createBufferSource();
      waterSrc.buffer = waterBuf; waterSrc.loop = true;
      var waterFilter = ctx.createBiquadFilter();
      waterFilter.type = 'lowpass'; waterFilter.frequency.value = 260;
      waterGain = ctx.createGain(); waterGain.gain.value = 0;
      waterSrc.connect(waterFilter).connect(waterGain).connect(master);
      waterSrc.start();
    } catch (e) { ctx = null; }
  }

  function noiseBuffer(seconds) {
    seconds = seconds || 2;
    var len = ctx.sampleRate * seconds;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      var white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // 简单粉化
      data[i] = last * 3.5;
    }
    return buf;
  }

  function setEnv(stats) {
    if (!ctx) return;
    var t = ctx.currentTime;
    var wind = 0.04 + 0.05 * Math.abs(stats.temp - 16) / 12 + (stats.rain > 0.6 ? 0.05 : 0);
    var rain = Math.max(0, (stats.rain - 0.45) * 0.55);
    var water = 0.03;
    setGain(windGain, Math.min(0.22, wind), t);
    setGain(rainGain, Math.min(0.18, rain), t);
    setGain(waterGain, water, t);

    // 鸟鸣：随机啁啾（频率与昆虫/鸟数量正相关）
    var birdiness = (stats.counts && stats.counts.hawk ? stats.counts.hawk : 0) +
      (stats.counts && stats.counts.insect ? stats.counts.insect / 40 : 0);
    if (birdiness > 0.5 && Date.now() - lastBird > 2500 && Math.random() < 0.25) {
      lastBird = Date.now();
      chirp();
    }
  }

  function setGain(g, v, t) {
    if (!g) return;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(v, t + 0.8);
  }

  function chirp() {
    try {
      var n = 2 + Math.floor(Math.random() * 3);
      for (var i = 0; i < n; i++) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        var f = 2200 + Math.random() * 1800;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.09);
        osc.frequency.exponentialRampToValueAtTime(f * 1.6, ctx.currentTime + i * 0.09 + 0.06);
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.09);
        g.gain.linearRampToValueAtTime(0.035, ctx.currentTime + i * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.09 + 0.07);
        osc.connect(g).connect(master);
        osc.start(ctx.currentTime + i * 0.09);
        osc.stop(ctx.currentTime + i * 0.09 + 0.1);
      }
    } catch (e) { /* ignore */ }
  }

  function resume() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  function setMuted(m) {
    muted = m;
    if (ctx && master) {
      master.gain.setValueAtTime(muted ? 0 : 0.5, ctx.currentTime);
    }
  }
  function isMuted() { return muted; }

  window.ECOARK = window.ECOARK || {};
  window.ECOARK.audio = { resume: resume, setEnv: setEnv, setMuted: setMuted, isMuted: isMuted };
})();
