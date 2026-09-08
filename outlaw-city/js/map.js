"use strict";
// 城市地图：随机生成街区/道路/建筑/水面/公园/街灯，并提供碰撞查询与小地图位图。
// 3D 版只使用 data / mini 与几何查询函数（原先的 2D 分块贴图已删除）。
const MapSys = {
  data: null, mini: null,
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
    // 结果写回调用方提供的 out（可跨帧复用，避免每帧每个实体都新建对象），并返回同一个对象
    out.x = x; out.y = y;
    const d = this.data;
    const doPush = (rects, rr) => {
      let pushes = 0;
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
        pushes++;
      }
      return pushes;
    };
    // 建筑会互相重叠：单次遍历可能把实体从一个矩形推进另一个，最多迭代 3 轮收敛
    for (let pass = 0; pass < 3; pass++) {
      const pushed = doPush(d.buildings, r) + doPush(d.water, r * 0.6);
      if (!pushed) break;
    }
    out.x = Utils.clamp(out.x, 6, d.worldW - 6);
    out.y = Utils.clamp(out.y, 6, d.worldH - 6);
    out.hit = Math.abs(out.x - x) > 0.01 || Math.abs(out.y - y) > 0.01;
    return out;
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
};
