/* UNLIT · 无光之城 — 白杖回声定位（纯函数）
 * 玩家敲击白杖：沿朝向锥体射线检测墙体与障碍物，返回回声参数。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UNLIT_CANE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const CONE = (26 * Math.PI) / 180;   // 半锥角
  const RANGE = 5.5;                    // 回声探测距离（格）
  const STEP = 0.08;                    // 射线步长

  function isWall(grid, x, y) {
    const row = grid[Math.floor(y)];
    if (!row) return true;
    const c = row[Math.floor(x)];
    return c === undefined || c === '#';
  }

  // 沿朝向射线求到墙的精确距离：粗步进定位命中区间，再二分细化（误差 < 1cm）
  function rayWallDist(grid, px, py, facing) {
    const cx = Math.cos(facing), cy = Math.sin(facing);
    let prev = 0;
    for (let d = STEP; d <= RANGE; d += STEP) {
      if (isWall(grid, px + cx * d, py + cy * d)) {
        let lo = prev, hi = d;
        for (let i = 0; i < 16; i++) {
          const mid = (lo + hi) / 2;
          if (isWall(grid, px + cx * mid, py + cy * mid)) hi = mid; else lo = mid;
        }
        return hi;
      }
      prev = d;
    }
    return null;
  }

  // 敲击回声：返回 { hit, dist, angle(相对), pan, openness, by }
  function tap(grid, px, py, facing, obstacles) {
    const wallDist = rayWallDist(grid, px, py, facing);
    let best = null;
    for (const o of obstacles || []) {
      const dx = o.x - px, dy = o.y - py;
      const d = Math.hypot(dx, dy);
      if (d < 0.35 || d > RANGE) continue;
      const a = Math.atan2(dy, dx) - facing;
      const na = ((a % TAU) + TAU + Math.PI) % TAU - Math.PI;
      if (Math.abs(na) > CONE) continue;
      if (!best || d < best.d) best = { d, a: na };
    }
    let hitDist = wallDist, hitAngle = 0, hitBy = 'wall';
    if (best && (hitDist === null || best.d < hitDist)) { hitDist = best.d; hitAngle = best.a; hitBy = 'object'; }
    const openness = nearestWallDist(grid, px, py);
    if (hitDist === null) return { hit: false, openness, pan: 0 };
    return { hit: true, dist: hitDist, angle: hitAngle, pan: hitAngle / (Math.PI / 2), by: hitBy, openness };
  }

  // 八方向最近墙距离 → 房间开放度（越大越空旷）
  function nearestWallDist(grid, x, y) {
    let min = 99;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      for (let d = 0.3; d < 30; d += 0.5) {
        if (isWall(grid, x + Math.cos(a) * d, y + Math.sin(a) * d)) { min = Math.min(min, d); break; }
      }
    }
    return min;
  }

  return { tap, rayWallDist, nearestWallDist, isWall, CONE, RANGE };
});
