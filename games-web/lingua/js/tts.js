/* LINGUA · 简易"发音试听"：把词形逐音位合成出声（B3）
   元音 = 正弦音，辅音 = 短噪声脉冲，90ms 一个音位。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LINGUA = root.LINGUA || {}; root.LINGUA.tts = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ctx = null, active = [];
  var VOWEL = { a: 220, e: 247, i: 262, o: 294, u: 330 };
  var MAX_PHONES = 32;   // 词形再长也只合成前 32 个音位，防止一次点击排入上千个节点

  function ensure() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
  }

  function phoneFreq(c) { return VOWEL[c] || null; }

  // 停掉上一次尚未播完的音，避免连点多个 🔊 时声音叠在一起
  function stop() {
    active.forEach(function (node) { try { node.stop(); } catch (e) {} });
    active = [];
  }

  function speak(word) {
    ensure();
    if (!ctx || !word) return;
    stop();
    if (ctx.state === 'suspended') ctx.resume();
    var chars = String(word).split('').slice(0, MAX_PHONES);
    var t = ctx.currentTime + 0.05;
    chars.forEach(function (c, i) {
      var f = phoneFreq(c);
      if (f != null) {
        // 元音：正弦 + 轻微泛音
        var o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = f;
        var o2 = ctx.createOscillator();
        o2.type = 'triangle'; o2.frequency.value = f * 1.5; o2.detune.value = 8;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        o.connect(g); o2.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.1); o2.start(t); o2.stop(t + 0.1);
        active.push(o, o2);
      } else {
        // 辅音：滤波噪声脉冲
        var len = Math.floor(ctx.sampleRate * 0.04);
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * 0.5;
        var src = ctx.createBufferSource();
        src.buffer = buf;
        var bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1200 + (c.charCodeAt(0) % 900);
        bp.Q.value = 2;
        var g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.12, t);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        src.connect(bp); bp.connect(g2); g2.connect(ctx.destination);
        src.start(t);
        active.push(src);
      }
      t += 0.09;
    });
  }

  return { speak: speak, stop: stop };
});
