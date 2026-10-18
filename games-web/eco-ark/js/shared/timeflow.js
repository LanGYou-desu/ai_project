/* ECO-ARK · 时间步进器（浏览器 + Node 双端 UMD）
 * 固定步长累加器：把「真实经过的毫秒」换算成整数个模拟月。
 *
 * 修复的缺陷：原主循环写的是
 *     var months = Math.min(40, monthsPerSec * dt / 1000);
 *     for (var i = 0; i < months; i++) stepOnce();
 * 当 months 是小数时（1×~8× 下每帧只有 0.2~1.9），for 循环仍然会跑 1 次，
 * 于是 1×/2×/4×/8× 的实际速度几乎一样（都≈每帧 1 月）。这里用累加器保留
 * 小数余量，速度档位才真正生效；单帧步数上限避免掉帧/切后台后一次性补算。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else { root.ECOARK = root.ECOARK || {}; root.ECOARK.timeflow = factory(root); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MONTHS_PER_YEAR = 12;
  var MAX_STEPS_PER_FRAME = 40;

  // speed 的单位是「年/秒」：1× → 12 月/秒，4× → 48 月/秒
  function createClock(speed) {
    return { speed: speed > 0 ? speed : 1, acc: 0 };
  }

  function setSpeed(clock, speed) {
    if (speed > 0) clock.speed = speed;
    return clock;
  }

  // 返回本帧应推进的整月数；余数留在 acc 中，下一帧继续累积
  function advance(clock, dtMs, maxSteps) {
    if (!(dtMs > 0)) return 0;
    clock.acc += clock.speed * MONTHS_PER_YEAR * dtMs / 1000;
    var cap = maxSteps == null ? MAX_STEPS_PER_FRAME : maxSteps;
    var steps = Math.floor(clock.acc);
    if (steps > cap) { steps = cap; clock.acc = 0; } // 丢弃积压，避免追帧雪崩
    else clock.acc -= steps;
    return steps;
  }

  return {
    MONTHS_PER_YEAR: MONTHS_PER_YEAR,
    MAX_STEPS_PER_FRAME: MAX_STEPS_PER_FRAME,
    createClock: createClock,
    setSpeed: setSpeed,
    advance: advance
  };
});
