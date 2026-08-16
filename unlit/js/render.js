/* UNLIT · 无光之城 — 画布渲染
 * 沉浸模式：近乎全黑；辅助模式：微弱轮廓 + 车流 + 信号灯，便于上手。
 */
(function (root) {
  'use strict';
  let cv, g, W, H;
  function init(c) { cv = c; g = cv.getContext('2d'); resize(); window.addEventListener('resize', resize); }
  function resize() { if (!cv) return; W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }

  function draw(engine, assist) {
    if (!g) return;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (!engine || !engine.map) return;
    const m = engine.map;
    const scale = Math.min((W - 60) / m.w, (H - 160) / m.h);
    const ox = (W - m.w * scale) / 2, oy = (H - m.h * scale) / 2;
    const sx = x => ox + x * scale, sy = y => oy + y * scale;

    if (assist) {
      g.fillStyle = 'rgba(255,255,255,0.045)';
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.grid[y][x] === '#') g.fillRect(sx(x), sy(y), scale, scale);
      for (const o of m.objects) {
        const meta = engine.objMeta(o.id);
        if (o.id === '__exit__') {
          g.strokeStyle = 'rgba(232,185,106,0.55)'; g.lineWidth = 1.5;
          g.strokeRect(sx(o.x) + scale * 0.15, sy(o.y) + scale * 0.15, scale * 0.7, scale * 0.7);
          continue;
        }
        if (!meta || engine.collected[o.id]) continue;
        g.fillStyle = meta.loopSound ? 'rgba(232,185,106,0.75)' : 'rgba(255,255,255,0.3)';
        g.beginPath(); g.arc(sx(o.x + 0.5), sy(o.y + 0.5), Math.max(2, scale * 0.13), 0, Math.PI * 2); g.fill();
        if (scale > 20 && meta.name) {
          g.fillStyle = 'rgba(255,255,255,0.35)';
          g.font = Math.max(9, scale * 0.15) + 'px "Microsoft YaHei", sans-serif';
          g.fillText(meta.name, sx(o.x + 0.5) + 5, sy(o.y + 0.5) - 5);
        }
      }
      // 玩家箭头
      g.save();
      g.translate(sx(engine.px), sy(engine.py));
      g.rotate(engine.facing);
      g.beginPath(); g.moveTo(scale * 0.32, 0); g.lineTo(-scale * 0.2, -scale * 0.16); g.lineTo(-scale * 0.2, scale * 0.16); g.closePath();
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
      g.restore();
      // 过街区域 + 车 + 信号
      const cw = engine.crossing;
      if (cw) {
        g.fillStyle = 'rgba(232,185,106,0.07)';
        for (const road of cw.roads) for (const row of road.rows) for (const col of cw.crosswalk.cols) g.fillRect(sx(col), sy(row), scale, scale);
        for (const car of engine.cars) {
          g.fillStyle = 'rgba(255,120,80,0.85)';
          g.fillRect(sx(car.x), sy(car.y - 0.5), car.len * scale, scale * 0.7);
        }
        const ph = engine.signalPhase ? engine.signalPhase() : 'red';
        g.fillStyle = ph === 'green' ? 'rgba(80,255,130,0.9)' : 'rgba(255,90,80,0.9)';
        g.beginPath(); g.arc(sx(12.5), sy(2.5), 6, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(sx(12.5), sy(9.5), 6, 0, Math.PI * 2); g.fill();
      }
      // 目标高亮
      const nav = engine.navTarget ? engine.navTarget() : null;
      if (nav) {
        g.strokeStyle = 'rgba(232,185,106,0.8)'; g.lineWidth = 2;
        g.setLineDash([4, 4]);
        g.strokeRect(sx(nav.x) + 2, sy(nav.y) + 2, scale - 4, scale - 4);
        g.setLineDash([]);
      }
    } else {
      // 沉浸：呼吸微光（几乎纯黑，仅给屏幕一点层次）
      const grad = g.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.85);
      grad.addColorStop(0, 'rgba(10,10,12,1)');
      grad.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
    }
  }

  // 心灵地图
  function drawMapCanvas(cv2, engine, cursor, selType) {
    const g2 = cv2.getContext('2d');
    const W2 = cv2.width, H2 = cv2.height;
    g2.clearRect(0, 0, W2, H2);
    g2.fillStyle = '#0a0a08'; g2.fillRect(0, 0, W2, H2);
    if (!engine || !engine.map) return;
    const m = engine.map;
    const scale = Math.min((W2 - 20) / m.w, (H2 - 20) / m.h);
    const ox = (W2 - m.w * scale) / 2, oy = (H2 - m.h * scale) / 2;
    const sx = x => ox + x * scale, sy = y => oy + y * scale;
    g2.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.grid[y][x] === '#') g2.fillRect(sx(x), sy(y), scale, scale);
    const STYLE = { self: '#e8b96a', door: '#8fd0a0', item: '#9db8e8', sound: '#d0a0e8', danger: '#e88a7a' };
    for (const mk of engine.memory) {
      g2.fillStyle = STYLE[mk.type] || '#ccc';
      g2.beginPath(); g2.arc(sx(mk.x + 0.5), sy(mk.y + 0.5), 5, 0, Math.PI * 2); g2.fill();
      g2.font = '12px sans-serif';
      g2.fillText(mk.type === 'self' ? '我' : (mk.type === 'door' ? '门' : mk.type === 'item' ? '物' : mk.type === 'sound' ? '声' : '险'), sx(mk.x + 0.5) + 7, sy(mk.y + 0.5) + 4);
    }
    if (cursor) {
      g2.strokeStyle = STYLE[selType] || '#fff'; g2.lineWidth = 1.5;
      g2.strokeRect(sx(cursor.x) + 2, sy(cursor.y) + 2, scale - 4, scale - 4);
    }
  }

  root.UNLIT_RENDER = { init, resize, draw, drawMapCanvas };
})(typeof self !== 'undefined' ? self : this);
