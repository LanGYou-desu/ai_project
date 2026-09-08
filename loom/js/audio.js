'use strict';
/* LOOM · 织机音效（Web Audio，程序化合成，无音频文件） */
(function (root) {
  'use strict';

  function create() {
    var ctx = null, noiseBuf = null, enabled = false, master = null;

    function ensure() {
      if (ctx) return ctx;
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      var len = Math.floor(ctx.sampleRate * 0.4);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }

    function noise(dur, freq, q, gain, type) {
      if (!enabled) return;
      if (!ensure()) return;
      var src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      var f = ctx.createBiquadFilter();
      f.type = type || 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q || 1;
      var g = ctx.createGain();
      var now = ctx.currentTime;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(now); src.stop(now + dur + 0.05);
    }

    function tone(freq, dur, gain, type) {
      if (!enabled) return;
      if (!ensure()) return;
      var o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = freq;
      var g = ctx.createGain();
      var now = ctx.currentTime;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
      o.connect(g); g.connect(master);
      o.start(now); o.stop(now + dur + 0.05);
    }

    return {
      setEnabled: function (v) { enabled = !!v; if (enabled) ensure(); },
      isEnabled: function () { return enabled; },
      /* 综框开口：木质轻响 */
      shed: function () { noise(0.07, 900, 3.5, 0.16, 'bandpass'); },
      /* 投梭：梭子擦过经线的沙沙声 */
      fly: function () { noise(0.22, 2600, 1.1, 0.11, 'highpass'); },
      /* 打纬：沉闷的一声 */
      beat: function () { tone(96, 0.14, 0.22, 'triangle'); noise(0.10, 420, 1.6, 0.20, 'lowpass'); },
      /* 图案完成 */
      done: function () { tone(523, 0.5, 0.14, 'sine'); tone(784, 0.7, 0.10, 'sine'); },
      resume: function () { if (ctx && ctx.state === 'suspended') ctx.resume(); }
    };
  }

  var api = { create: create };
  root.Loom = root.Loom || {};
  root.Loom.audio = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
