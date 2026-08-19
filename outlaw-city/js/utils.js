"use strict";
const Utils = {
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(this.rand(a, b + 1)); },
  choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); },
  dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; },
  angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); },
  angleDiff(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; },
  angleLerp(a, b, t) { return a + this.angleDiff(b - a) * t; },
  hypot(x, y) { return Math.sqrt(x * x + y * y); },
  fmtMoney(n) { return "$" + Math.floor(n).toLocaleString("en-US"); },
};
