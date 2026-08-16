/* UNLIT · 无光之城 — 听觉场景数学（纯函数）
 * 把「世界坐标 → 立体声/音量/滤波」的换算全部抽离，便于单元测试。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UNLIT_AUDIOSCENE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TWO_PI = Math.PI * 2;
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function normAngle(a) {
    a = a % TWO_PI;
    if (a > Math.PI) a -= TWO_PI;
    if (a < -Math.PI) a += TWO_PI;
    return a;
  }
  // 目标相对玩家的方位角（-π..π，0=正前方）
  function relAngle(px, py, facing, tx, ty) {
    return normAngle(Math.atan2(ty - py, tx - px) - facing);
  }
  // 目标是否在面向锥体内
  function isFacing(px, py, facing, tx, ty, coneRad) {
    return Math.abs(relAngle(px, py, facing, tx, ty)) <= coneRad;
  }
  // 等功率立体声：pan ∈ [-1,1] → [left, right]
  function panEqualPower(pan) {
    const p = clamp(pan, -1, 1);
    const a = (p + 1) * Math.PI / 4;
    return [Math.cos(a), Math.sin(a)];
  }
  // 距离 → 增益（1/(1+d*k)）
  function distanceGain(d, k) { return 1 / (1 + (d * (k === undefined ? 0.45 : k))); }
  // 距离 → 低通截止频率（越远越闷）
  function lowpassCutoff(d) { return clamp(20000 / (1 + d * 0.7), 350, 20000); }
  // 距离 → 回声延迟 ms（声速约 340m/s）
  function echoDelayMs(d) { return (d / 340) * 1000; }
  function dist(px, py, tx, ty) { return Math.hypot(tx - px, ty - py); }
  return { clamp, normAngle, relAngle, isFacing, panEqualPower, distanceGain, lowpassCutoff, echoDelayMs, dist };
});
