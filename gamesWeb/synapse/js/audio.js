'use strict';
/* SYNAPSE · 程序化音效（Web Audio，纯合成） */
(function (root) {
  'use strict';
  let ctx = null;
  let muted = false;
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, when) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = vol == null ? 0.05 : vol;
      o.connect(g); g.connect(c.destination);
      const t = c.currentTime + (when || 0);
      o.start(t); o.stop(t + dur);
    } catch (e) { /* ignore */ }
  }
  function milestone(loss) {
    const f = 180 + Math.max(0, Math.min(1, 1 - loss)) * 640;
    tone(f, 0.09, 'sine', 0.045);
  }
  function success() {
    [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.28, 'sine', 0.06, i * 0.12); });
  }
  function pop() { tone(190, 0.05, 'triangle', 0.035); }
  function setMuted(m) { muted = !!m; }
  function isMuted() { return muted; }
  root.Synapse = root.Synapse || {};
  root.Synapse.audio = { tone: tone, milestone: milestone, success: success, pop: pop, setMuted: setMuted, isMuted: isMuted };
})(window);
