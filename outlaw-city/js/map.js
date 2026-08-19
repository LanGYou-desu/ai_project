"use strict";
const MapSys = {
  data: null, chunks: [], chunkSize: 1040, mini: null, use2DChunks: true,
  init() {
    const W0 = CFG.WORLD;
    const cell = W0.cell, road = W0.road, margin = W0.margin;
    const cols = W0.cols, rows = W0.rows;
    const worldW = cols * cell, worldH = rows * cell;
    const roadsV = [], roadsH = [];
    for (let i = 0; i <= cols; i++) roadsV.push(i * cell);
    for (let j = 0; j <= rows; j++) roadsH.push(j * cell);
    const buildings = [], water = [], parks = [], lamps = [], trees = [];
    const blockW = cell - road - margin * 2;
    const SPECIAL = { "0,0": "park", "1,0": "park", "3,7": "park", "9,9": "park", "9,3": "park", "2,11": "park", "5,10": "park", "1,9": "park" };
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x0 = i * cell + road / 2 + margin;
        const y0 = j * cell + road / 2 + margin;
        const edge = i === 0 || j === 0 || i === cols - 1 || j === rows - 1;
        const sp = SPECIAL[i + "," + j];
        let type = sp || "building";
        if (!sp && !edge) {
          const r = Math.random();
          if (r < 0.06) type = "water";
          else if (r < 0.14) type = "park";
        }
        if (type === "water") {
          const w = Utils.rand(blockW * 0.5, blockW * 0.85), h = Utils.rand(blockW * 0.5, blockW * 0.85);
          water.push({ x: x0 + Utils.rand(0, blockW - w), y: y0 + Utils.rand(0, blockW - h), w: w, h: h });
        } else if (type === "park") {
          parks.push({ x: x0, y: y0, w: blockW, h: blockW });
          const n = Utils.randInt(4, 9);
          for (let k = 0; k < n; k++) trees.push({ x: Utils.rand(x0 + 18, x0 + blockW - 18), y: Utils.rand(y0 + 18, y0 + blockW - 18), r: Utils.rand(9, 15) });
        } else {
          const n = Math.random() < 0.5 ? 1 : 2;
          for (let k = 0; k < n; k++) {
            const bw = Utils.rand(blockW * 0.42, blockW * 0.8);
            const bh = Utils.rand(blockW * 0.42, blockW * 0.8);
            const bx = Utils.rand(x0, x0 + blockW - bw);
            const by = Utils.rand(y0, y0 + blockW - bh);
            buildings.push({ x: bx, y: by, w: bw, h: bh, color: Utils.choice(CFG.BUILDING_COLORS), height: Utils.rand(0.6, 1.6) });
          }
        }
      }
    }
    for (const vx of roadsV) for (const hy of roadsH) {
      if (Math.random() < 0.7) lamps.push({ x: vx + road / 2 + 8, y: hy + road / 2 + 8 });
    }
    this.data = { worldW: worldW, worldH: worldH, roadsV: roadsV, roadsH: roadsH, buildings: buildings, water: water, parks: parks, lamps: lamps, trees: trees, cell: cell, road: road };
    if (this.use2DChunks !== false) this.buildChunks();
    this.buildMini();
  },
  cellCenter(i, j) { return { x: i * this.data.cell + this.data.cell / 2, y: j * this.data.cell + this.data.cell / 2 }; },
  randomWalkablePoint() {
    const d = this.data, cell = d.cell, road = d.road, margin = CFG.WORLD.margin;
    for (let tries = 0; tries < 40; tries++) {
      const i = Utils.randInt(0, CFG.WORLD.cols - 1), j = Utils.randInt(0, CFG.WORLD.rows - 1);
      const x = Utils.rand(i * cell + road / 2 + margin, (i + 1) * cell - road / 2 - margin);
      const y = Utils.rand(j * cell + road / 2 + margin, (j + 1) * cell - road / 2 - margin);
      if (!this.isBlocked(x, y)) return { x: x, y: y };
    }
    return { x: d.worldW / 2, y: d.worldH / 2 };
  },
  walkableNear(x, y, radius) {
    for (let tries = 0; tries < 30; tries++) {
      const a = Utils.rand(0, Math.PI * 2);
      const r = Utils.rand(0, radius);
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (!this.isBlocked(px, py)) return { x: px, y: py };
    }
    return { x: x, y: y };
  },
  randomRoadPoint() {
    const d = this.data;
    let x, y, axis, dir;
    if (Math.random() < 0.5) {
      const vx = Utils.choice(d.roadsV);
      x = vx; y = Utils.rand(20, d.worldH - 20);
      axis = "v"; dir = Math.random() < 0.5 ? 1 : -1;
    } else {
      const hy = Utils.choice(d.roadsH);
      x = Utils.rand(20, d.worldW - 20); y = hy;
      axis = "h"; dir = Math.random() < 0.5 ? 1 : -1;
    }
    return { x: x, y: y, axis: axis, dir: dir, lane: dir * (d.road / 4) };
  },
  circleRect(cx, cy, r, rect) {
    const nx = Utils.clamp(cx, rect.x, rect.x + rect.w);
    const ny = Utils.clamp(cy, rect.y, rect.y + rect.h);
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  },
  isBlocked(x, y) {
    const d = this.data;
    for (const b of d.buildings) { if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true; }
    for (const w of d.water) { if (x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) return true; }
    return x < 4 || y < 4 || x > d.worldW - 4 || y > d.worldH - 4;
  },
  resolve(x, y, r, out) {
    out.x = x; out.y = y;
    const d = this.data;
    const doPush = (rects, rr) => {
      for (const b of rects) {
        if (!this.circleRect(out.x, out.y, rr, b)) continue;
        const nx = Utils.clamp(out.x, b.x, b.x + b.w);
        const ny = Utils.clamp(out.y, b.y, b.y + b.h);
        let dx = out.x - nx, dy = out.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1e-6) {
          const d0 = Math.sqrt(d2);
          out.x = nx + dx / d0 * rr; out.y = ny + dy / d0 * rr;
        } else {
          const l = out.x - b.x, rt = b.x + b.w - out.x, t = out.y - b.y, bo = b.y + b.h - out.y;
          const m = Math.min(l, rt, t, bo);
          if (m === l) out.x = b.x - rr; else if (m === rt) out.x = b.x + b.w + rr; else if (m === t) out.y = b.y - rr; else out.y = b.y + b.h + rr;
        }
      }
    };
    doPush(d.buildings, r);
    doPush(d.water, r * 0.6);
    out.x = Utils.clamp(out.x, 6, d.worldW - 6);
    out.y = Utils.clamp(out.y, 6, d.worldH - 6);
    return { x: out.x, y: out.y, hit: Math.abs(out.x - x) > 0.01 || Math.abs(out.y - y) > 0.01 };
  },
  buildChunks() {
    const cs = this.chunkSize, d = this.data;
    const nx = Math.ceil(d.worldW / cs), ny = Math.ceil(d.worldH / cs);
    this.chunks = [];
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx < nx; cx++) {
        const cv = document.createElement("canvas");
        cv.width = cs; cv.height = cs;
        const g = cv.getContext("2d");
        this.drawStatic(g, cx * cs, cy * cs);
        this.chunks.push({ x: cx * cs, y: cy * cs, cv: cv });
      }
    }
  },
  drawStatic(g, ox, oy) {
    const d = this.data, cs = this.chunkSize;
    const road = d.road;
    g.fillStyle = "#4a453e";
    g.fillRect(0, 0, cs, cs);
    g.fillStyle = "#2f6f9e";
    for (const w of d.water) {
      if (w.x + w.w < ox || w.x > ox + cs || w.y + w.h < oy || w.y > oy + cs) continue;
      g.beginPath(); g.moveTo(w.x - ox + 12, w.y - oy);
      g.arcTo(w.x - ox + w.w, w.y - oy, w.x - ox + w.w, w.y - oy + w.h, 12);
      g.arcTo(w.x - ox + w.w, w.y - oy + w.h, w.x - ox, w.y - oy + w.h, 12);
      g.arcTo(w.x - ox, w.y - oy + w.h, w.x - ox, w.y - oy, 12);
      g.arcTo(w.x - ox, w.y - oy, w.x - ox + w.w, w.y - oy, 12);
      g.closePath(); g.fill();
    }
    g.fillStyle = "#4e7d43";
    for (const p of d.parks) {
      if (p.x + p.w < ox || p.x > ox + cs || p.y + p.h < oy || p.y > oy + cs) continue;
      g.fillRect(p.x - ox, p.y - oy, p.w, p.h);
    }
    g.fillStyle = "#2c2c2c";
    for (const vx of d.roadsV) { if (vx + road / 2 > ox && vx - road / 2 < ox + cs) g.fillRect(vx - road / 2 - ox, 0, road, cs); }
    for (const hy of d.roadsH) { if (hy + road / 2 > oy && hy - road / 2 < oy + cs) g.fillRect(0, hy - road / 2 - oy, cs, road); }
    g.fillStyle = "#d9b64a";
    const dash = 26, gap = 20;
    for (const vx of d.roadsV) {
      const rx = vx - ox;
      if (rx > -road && rx < cs + road) for (let yy = 0; yy < cs; yy += dash + gap) g.fillRect(rx - 2, yy, 4, dash);
    }
    for (const hy of d.roadsH) {
      const ry = hy - oy;
      if (ry > -road && ry < cs + road) for (let xx = 0; xx < cs; xx += dash + gap) g.fillRect(xx, ry - 2, dash, 4);
    }
    for (const b of d.buildings) {
      if (b.x + b.w < ox || b.x > ox + cs || b.y + b.h < oy || b.y > oy + cs) continue;
      const x = b.x - ox, y = b.y - oy;
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(x + 5, y + 7, b.w, b.h);
      g.fillStyle = b.color;
      g.fillRect(x, y, b.w, b.h);
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fillRect(x, y, b.w, 5);
      if (b.w * b.h > 4200) {
        g.fillStyle = "rgba(255,255,255,0.22)";
        const step = 18;
        for (let wx = x + 9; wx < x + b.w - 9; wx += step) {
          for (let wy = y + 12; wy < y + b.h - 9; wy += step) {
            if (Math.random() < 0.55) g.fillRect(wx, wy, 4, 6);
          }
        }
      }
    }
    for (const t of d.trees) {
      if (t.x < ox || t.x > ox + cs || t.y < oy || t.y > oy + cs) continue;
      g.fillStyle = "#5b3a1e";
      g.fillRect(t.x - ox - 2, t.y - oy - 2, 5, 5);
      g.fillStyle = "#2f6b32";
      g.beginPath(); g.arc(t.x - ox, t.y - oy, t.r, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3d8a41";
      g.beginPath(); g.arc(t.x - ox - t.r * 0.25, t.y - oy - t.r * 0.25, t.r * 0.55, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#22252a";
    for (const lp of d.lamps) {
      if (lp.x < ox || lp.x > ox + cs || lp.y < oy || lp.y > oy + cs) continue;
      g.fillRect(lp.x - ox - 2, lp.y - oy - 8, 4, 12);
      g.fillStyle = "#ffe9a8";
      g.fillRect(lp.x - ox - 4, lp.y - oy - 12, 8, 5);
      g.fillStyle = "#22252a";
    }
  },
  buildMini() {
    const size = 190, d = this.data;
    const cv = document.createElement("canvas"); cv.width = size; cv.height = size;
    const g = cv.getContext("2d");
    const s = size / d.worldW;
    g.fillStyle = "#16181d"; g.fillRect(0, 0, size, size);
    g.fillStyle = "#24507a";
    for (const w of d.water) g.fillRect(w.x * s, w.y * s, w.w * s, w.h * s);
    g.fillStyle = "#234030";
    for (const p of d.parks) g.fillRect(p.x * s, p.y * s, p.w * s, p.h * s);
    g.fillStyle = "#3a3f47";
    for (const vx of d.roadsV) g.fillRect(vx * s - 2, 0, 4, size);
    for (const hy of d.roadsH) g.fillRect(0, hy * s - 2, size, 4);
    this.mini = cv;
  },
  draw(ctx, cam) {
    const cs = this.chunkSize;
    const vx0 = cam.x - 80, vy0 = cam.y - 80, vx1 = cam.x + W.viewW + 80, vy1 = cam.y + W.viewH + 80;
    for (const ch of this.chunks) {
      if (ch.x + cs < vx0 || ch.x > vx1 || ch.y + cs < vy0 || ch.y > vy1) continue;
      ctx.drawImage(ch.cv, ch.x, ch.y);
    }
  },
  drawNightLamps(ctx, cam, light) {
    if (light > 0.55) return;
    const d = this.data;
    const a = (0.55 - light) * 0.5;
    const g0 = 95;
    for (const lp of d.lamps) {
      if (lp.x < cam.x - g0 || lp.x > cam.x + W.viewW + g0 || lp.y < cam.y - g0 || lp.y > cam.y + W.viewH + g0) continue;
      const rad = ctx.createRadialGradient(lp.x, lp.y, 2, lp.x, lp.y, g0);
      rad.addColorStop(0, "rgba(255,220,150," + a + ")");
      rad.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = rad;
      ctx.beginPath(); ctx.arc(lp.x, lp.y, g0, 0, Math.PI * 2); ctx.fill();
    }
  },
};
