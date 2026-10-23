/* 光湾市 — the living pixel harbour.
   Everything is drawn procedurally on a 960 脳 540 canvas: no image assets. */
(function () {
  "use strict";

  const L = window.Lumen;
  const W = 960;
  const H = 540;
  const CITY_BASE = 320;
  const WATER_TOP = 320;
  const QUAY_TOP = 426;
  const REFLECT_HEIGHT = 118;

  const FONT = {
    "A": ["010", "101", "111", "101", "101"],
    "B": ["110", "101", "110", "101", "110"],
    "C": ["011", "100", "100", "100", "011"],
    "D": ["110", "101", "101", "101", "110"],
    "E": ["111", "100", "110", "100", "111"],
    "F": ["111", "100", "110", "100", "100"],
    "G": ["011", "100", "101", "101", "011"],
    "H": ["101", "101", "111", "101", "101"],
    "I": ["111", "010", "010", "010", "111"],
    "J": ["001", "001", "001", "101", "010"],
    "K": ["101", "101", "110", "101", "101"],
    "L": ["100", "100", "100", "100", "111"],
    "M": ["101", "111", "111", "101", "101"],
    "N": ["101", "111", "111", "111", "101"],
    "O": ["010", "101", "101", "101", "010"],
    "P": ["110", "101", "110", "100", "100"],
    "Q": ["010", "101", "101", "111", "011"],
    "R": ["110", "101", "110", "101", "101"],
    "S": ["011", "100", "010", "001", "110"],
    "T": ["111", "010", "010", "010", "010"],
    "U": ["101", "101", "101", "101", "111"],
    "V": ["101", "101", "101", "101", "010"],
    "W": ["101", "101", "111", "111", "101"],
    "X": ["101", "101", "010", "101", "101"],
    "Y": ["101", "101", "010", "010", "010"],
    "Z": ["111", "001", "010", "100", "111"],
    "0": ["111", "101", "101", "101", "111"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["110", "001", "010", "100", "111"],
    "3": ["110", "001", "010", "001", "110"],
    "4": ["101", "101", "111", "001", "001"],
    "5": ["111", "100", "110", "001", "110"],
    "6": ["011", "100", "111", "101", "111"],
    "7": ["111", "001", "010", "010", "010"],
    "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "110"],
    ".": ["000", "000", "000", "000", "010"],
    "-": ["000", "000", "111", "000", "000"],
    " ": ["000", "000", "000", "000", "000"]
  };

  const HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
  const NOTE = ["00110", "00101", "00100", "01100", "11100", "11100", "01000"];
  const STAR = ["00100", "00100", "11111", "00100", "01010", "01010"];
  const SPARK = ["00100", "10101", "01110", "11111", "01110", "10101", "00100"];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hash(n) {
    let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rgba(hex, a) { return L.rgba(hex, a); }
  function shade(hex, amount) { return L.shade(hex, amount); }
  function mixHex(a, b, t) {
    const ca = L.hexToRgb(a);
    const cb = L.hexToRgb(b);
    return "#" + ca.map((v, i) => Math.round(lerp(v, cb[i], t)).toString(16).padStart(2, "0")).join("");
  }

  function pixelLine(ctx, x0, y0, x1, y1, color, size) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    ctx.fillStyle = color;
    const s = size || 1;
    while (true) {
      ctx.fillRect(x0, y0, s, s);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function pixelBlob(ctx, cx, cy, rx, ry, color, step) {
    ctx.fillStyle = color;
    const st = step || 2;
    cy = Math.round(cy); cx = Math.round(cx);
    for (let y = -ry; y <= ry; y += st) {
      const k = 1 - (y * y) / (ry * ry);
      if (k <= 0) continue;
      const half = Math.max(1, Math.round(rx * Math.sqrt(k)));
      ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, st);
    }
  }

  function pixelCircle(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let y = -r; y <= r; y += 1) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      if (half >= 0) ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
    }
  }

  function glow(ctx, x, y, r, color, alpha, inner) {
    if (r <= 0 || alpha <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(inner || 0.3, rgba(color, alpha * 0.35));
    g.addColorStop(0.7, rgba(color, alpha * 0.08));
    g.addColorStop(1, rgba(color, 0));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  function pixelTextWidth(text, scale) {
    return Math.max(0, String(text).length * 4 * scale - scale);
  }

  function pixelText(ctx, text, x, y, scale, color) {
    const s = scale || 1;
    ctx.fillStyle = color;
    const str = String(text).toUpperCase();
    for (let c = 0; c < str.length; c++) {
      const glyph = FONT[str[c]] || FONT[" "];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if (glyph[row][col] === "1") {
            ctx.fillRect(Math.round(x + c * 4 * s + col * s), Math.round(y + row * s), s, s);
          }
        }
      }
    }
  }

  function drawIcon(ctx, icon, x, y, color) {
    ctx.fillStyle = color;
    for (let row = 0; row < icon.length; row++) {
      for (let col = 0; col < icon[row].length; col++) {
        if (icon[row][col] === "1") ctx.fillRect(x + col, y + row, 1, 1);
      }
    }
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  class PixelCity {
    constructor(canvas, options) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.canvas.width = W;
      this.canvas.height = H;
      this.opts = options || {};
      this.audio = this.opts.audio || null;
      this.onModeChange = this.opts.onModeChange || null;
      this.onGreeting = this.opts.onGreeting || null;
      this.mode = "morning";
      this.palette = Object.assign({}, L.PALETTES.morning);
      this.fromPalette = this.palette;
      this.toPalette = L.PALETTES.morning;
      this.transition = 1;
      this.transitionDuration = 2.1;
      this.time = 0;
      this.lastFrame = 0;
      this.running = false;
      this.pointer = { x: 0.5, y: 0.5, energy: 0, lastX: null, lastY: null };
      this.reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.flash = 0;

      this.cityCanvas = makeCanvas(W, H);
      this.bridgeCanvas = makeCanvas(W, H);
      this.reflCanvas = makeCanvas(W, REFLECT_HEIGHT);
      this.noiseCanvas = this._makeNoise();

      this._initSky();
      this._initFarCity();
      this._initCity();
      this._initWater();
      this._initBridge();
      this._initForeground();
      this._initAtmosphere();
      this._initPeople();

      this._loop = this._loop.bind(this);
      this._onResize = this._onResize.bind(this);
      this._onPointerMove = this._onPointerMove.bind(this);
      this._onPointerDown = this._onPointerDown.bind(this);
      window.addEventListener("resize", this._onResize, { passive: true });
      canvas.addEventListener("pointermove", this._onPointerMove, { passive: true });
      canvas.addEventListener("pointerdown", this._onPointerDown);
      this._onResize();
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.lastFrame = performance.now();
      requestAnimationFrame(this._loop);
    }

    stop() {
      this.running = false;
    }

    setMode(mode) {
      if (!L.PALETTES[mode] || mode === this.mode) return;
      this.fromPalette = Object.assign({}, this.palette);
      this.toPalette = L.PALETTES[mode];
      this.mode = mode;
      this.transition = 0;
      this.flash = this.reducedMotion ? 0 : 1;
      if (this.onModeChange) this.onModeChange(mode);
    }

    _onResize() {
      // The illustration keeps its internal pixel grid; CSS cover scales it.
      this.canvas.style.imageRendering = "pixelated";
    }

    _mapPointer(event) {
      const rect = this.canvas.getBoundingClientRect();
      const scale = Math.max(rect.width / W, rect.height / H);
      const rw = W * scale;
      const rh = H * scale;
      const x = (event.clientX - rect.left + (rw - rect.width) / 2) / scale;
      const y = (event.clientY - rect.top + (rh - rect.height) / 2) / scale;
      return { x, y };
    }

    _onPointerMove(event) {
      const pos = this._mapPointer(event);
      const prev = this.pointer;
      const dx = prev.lastX === null ? 0 : Math.abs(pos.x - prev.lastX);
      const dy = prev.lastY === null ? 0 : Math.abs(pos.y - prev.lastY);
      prev.x = pos.x / W;
      prev.y = pos.y / H;
      prev.energy = clamp(prev.energy + Math.hypot(dx, dy) * 0.006, 0, 1.2);
      prev.lastX = pos.x;
      prev.lastY = pos.y;
    }

    _onPointerDown(event) {
      if (this.opts.introActive && this.opts.introActive()) return;
      const pos = this._mapPointer(event);
      let best = null;
      let bestDist = 42;
      for (const person of this.people) {
        if (person.state === "chat") continue;
        const d = Math.hypot(person.x - pos.x, (person.y - 18) - pos.y);
        if (d < bestDist) { best = person; bestDist = d; }
      }
      if (best) {
        best.wave = 2.8;
        best.bubble = "heart";
        best.waveStart = this.time;
        if (this.onGreeting) this.onGreeting();
      } else {
        this.gust = 1.5;
        this.spawnLeafBurst(pos.x, pos.y, 7);
      }
    }

    _makeNoise() {
      const c = makeCanvas(160, 90);
      const x = c.getContext("2d");
      const img = x.createImageData(160, 90);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() > 0.5 ? 255 : 0;
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
        img.data[i + 3] = Math.random() * 22;
      }
      x.putImageData(img, 0, 0);
      return c;
    }

    _initSky() {
      const rng = mulberry32(0x51c17);
      this.stars = [];
      for (let i = 0; i < 92; i++) {
        this.stars.push({
          x: Math.round(rng() * W),
          y: Math.round(rng() * 270),
          s: rng() > 0.86 ? 2 : 1,
          phase: rng() * Math.PI * 2,
          speed: 0.5 + rng() * 1.7
        });
      }
      this.clouds = [];
      const shapes = [
        { x: 90, y: 92, w: 166, h: 22, speed: 1.4, op: 0.75 },
        { x: 500, y: 63, w: 238, h: 28, speed: 0.8, op: 0.7 },
        { x: 770, y: 144, w: 146, h: 17, speed: 1.1, op: 0.55 },
        { x: 290, y: 188, w: 210, h: 14, speed: 0.55, op: 0.42 },
        { x: 610, y: 230, w: 185, h: 12, speed: 0.7, op: 0.38 },
        { x: 30, y: 240, w: 130, h: 10, speed: 0.45, op: 0.28 }
      ];
      shapes.forEach((shape, i) => {
        const r = mulberry32(300 + i * 19);
        shape.puffs = [];
        for (let p = 0; p < 6; p++) {
          shape.puffs.push({
            x: (0.12 + r() * 0.76) * shape.w,
            y: shape.h * (0.35 + r() * 0.3),
            r: 4 + r() * (shape.h * 0.52)
          });
        }
        this.clouds.push(shape);
      });
      this.birds = [];
      for (let i = 0; i < 7; i++) {
        this.birds.push({
          x: 60 + rng() * 850,
          y: 96 + rng() * 140,
          speed: 4 + rng() * 5,
          phase: rng() * 10,
          scale: rng() > 0.6 ? 2 : 1
        });
      }
    }

    _initFarCity() {
      const rng = mulberry32(0xfa12);
      this.farBuildings = [];
      let x = -50;
      while (x < W + 60) {
        const w = 14 + Math.round(rng() * 35);
        const h = 22 + Math.round(Math.pow(rng(), 1.55) * 136);
        const b = {
          x, w, h,
          top: CITY_BASE - h,
          roof: rng(),
          antenna: rng() > 0.68,
          seed: rng(),
          depth: rng()
        };
        this.farBuildings.push(b);
        const gap = -1 + Math.round(rng() * 8);
        x += w + gap;
      }
      const rng2 = mulberry32(0xfa77);
      for (const b of this.farBuildings) {
        b.lights = [];
        for (let ly = b.top + 8; ly < CITY_BASE - 5; ly += 7) {
          for (let lx = b.x + 4; lx < b.x + b.w - 3; lx += 6) {
            if (rng2() > 0.78) b.lights.push({ x: lx, y: ly, t: rng2(), c: rng2() });
          }
        }
      }
    }

    _initCity() {
      const specs = [
        { x: -24, w: 68, h: 114, kind: "old", roof: "mansard", seed: 11 },
        { x: 42, w: 52, h: 94, kind: "old", roof: "gable", seed: 12 },
        { x: 92, w: 72, h: 109, kind: "old", roof: "gable", seed: 13, sign: "BAY" },
        { x: 166, w: 36, h: 79, kind: "old", roof: "flat", seed: 14 },
        { x: 202, w: 42, h: 187, kind: "clock", roof: "spire", seed: 15 },
        { x: 244, w: 56, h: 96, kind: "old", roof: "mansard", seed: 16 },
        { x: 300, w: 53, h: 117, kind: "old", roof: "gable", seed: 17, sign: "FISH" },
        { x: 351, w: 72, h: 86, kind: "warehouse", roof: "flat", seed: 18 },
        { x: 421, w: 40, h: 58, kind: "old", roof: "flat", seed: 19 },
        { x: 478, w: 42, h: 152, kind: "brick", roof: "flat", seed: 20 },
        { x: 522, w: 48, h: 205, kind: "glass", roof: "antenna", seed: 21, sign: "LUMEN" },
        { x: 574, w: 44, h: 168, kind: "modern", roof: "stepped", seed: 22 },
        { x: 622, w: 57, h: 236, kind: "deco", roof: "spire", seed: 23 },
        { x: 686, w: 55, h: 85, kind: "market", roof: "flat", seed: 24, sign: "NIGHT MARKET" },
        { x: 746, w: 53, h: 193, kind: "brick", roof: "stepped", seed: 25, sign: "HOTEL" },
        { x: 804, w: 61, h: 154, kind: "deco", roof: "flat", seed: 26 },
        { x: 870, w: 82, h: 229, kind: "modern", roof: "antenna", seed: 27, sign: "SEA & CO" }
      ];

      this.buildings = specs.map((spec) => {
        const b = Object.assign({ base: CITY_BASE, litSeed: Math.random() * 7 }, spec);
        b.top = b.base - b.h;
        b.roofH = b.kind === "clock" ? 0 : b.kind === "glass" || b.kind === "modern" || b.kind === "deco" || b.kind === "brick" || b.kind === "market" ? 5 + Math.floor((spec.seed % 3) * 2) : Math.min(28, Math.round(b.h * 0.23));
        this._prepareWindows(b);
        return b;
      });
      const clockTower = this.buildings.find(function (b) { return b.kind === "clock"; });
      this.clocks = clockTower ? [{ x: clockTower.x + clockTower.w / 2, y: clockTower.top + 94, r: 12 }] : [];
      this.landmarkLights = [];
    }

    _prepareWindows(b) {
      const rng = mulberry32(0xabc + (b.seed || 1) * 131);
      b.windows = [];
      b.floors = [];
      const top = b.top + b.roofH + 9;
      const bodyBottom = b.base - 8;
      if (b.kind === "clock") {
        for (let y = top + 54; y < bodyBottom; y += 22) {
          for (let x = b.x + 10; x < b.x + b.w - 7; x += 17) {
            b.windows.push({ x, y, w: 6, h: 10, lit: rng(), color: rng(), arch: true });
          }
        }
        return;
      }
      if (b.kind === "old" || b.kind === "warehouse") {
        const cols = Math.max(1, Math.floor((b.w - 12) / 17));
        const stepX = Math.max(12, Math.floor((b.w - 10) / cols));
        for (let y = top + 2; y < bodyBottom - 9; y += 19) {
          for (let c = 0; c < cols; c++) {
            const x = b.x + 7 + c * stepX;
            if (x + 6 > b.x + b.w - 4) continue;
            b.windows.push({
              x, y, w: 6, h: rng() > 0.75 ? 6 : 9,
              lit: rng(), color: rng(), shutters: rng() > 0.35,
              flower: rng() > 0.55
            });
          }
        }
      } else {
        const cols = Math.max(2, Math.floor((b.w - 10) / 7));
        const stepX = (b.w - 10) / cols;
        for (let y = top; y < bodyBottom - 3; y += 8) {
          for (let c = 0; c < cols; c++) {
            if (rng() > 0.9) continue;
            b.windows.push({
              x: Math.round(b.x + 5 + c * stepX),
              y, w: b.kind === "glass" ? 4 : 3, h: b.kind === "glass" ? 5 : 4,
              lit: rng(), color: rng()
            });
          }
        }
      }
    }

    _initWater() {
      const rng = mulberry32(0x7ea);
      this.ripples = [];
      for (let i = 0; i < 56; i++) {
        this.ripples.push({
          x: rng() * W,
          y: WATER_TOP + 8 + rng() * 107,
          len: 5 + rng() * 17,
          speed: (rng() - 0.5) * 7,
          alpha: 0.15 + rng() * 0.45,
          phase: rng() * 10,
          tint: rng()
        });
      }
      this.farBoats = [
        { x: 852, y: 337, dir: 1, speed: 1.6, scale: 1 },
        { x: 454, y: 341, dir: -1, speed: 0.9, scale: 0.72 },
        { x: 716, y: 412, dir: -1, speed: 0.55, scale: 0.78 }
      ];
    }

    _initBridge() {
      this.bridgeLamps = [76, 252, 430, 606, 780, 932];
      this.bridgeWalkers = [
        { x: 145, dir: 1, speed: 7, phase: 0, coat: "#7d5b61" },
        { x: 366, dir: -1, speed: 5, phase: 2, coat: "#59667b" },
        { x: 548, dir: 1, speed: 6, phase: 4, coat: "#a37860" },
        { x: 706, dir: -1, speed: 4.5, phase: 1, coat: "#5f6157" }
      ];
    }

    _initForeground() {
      const rng = mulberry32(0xc0ffee);
      this.cafe = { x: -20, y: 481, w: 208, h: 204, seed: 4 };
      this.rightHouse = { x: 846, y: 507, w: 142, h: 180, seed: 9 };
      this.trees = [
        this._makeTree(744, 508, 194, 116, 0x71ee, 0),
        this._makeTree(215, 478, 123, 67, 0x7a22, 1),
        this._makeTree(914, 536, 150, 86, 0x17ee, 2)
      ];
      this.lampPosts = [
        { x: 280, base: 500, h: 70, glow: 1 },
        { x: 585, base: 516, h: 78, glow: 1 },
        { x: 814, base: 516, h: 68, glow: 1 }
      ];
      this.puddles = [
        { x: 410, y: 503, rx: 31, ry: 6, phase: 0 },
        { x: 690, y: 533, rx: 45, ry: 8, phase: 2 },
        { x: 89, y: 532, rx: 22, ry: 4, phase: 4 }
      ];
      this.pigeons = [];
      for (let i = 0; i < 5; i++) {
        this.pigeons.push({
          x: 424 + rng() * 124,
          y: 518 + rng() * 10,
          phase: rng() * 9,
          dir: rng() > 0.5 ? 1 : -1
        });
      }
      this.groundLeaves = [];
      for (let i = 0; i < 26; i++) {
        this.groundLeaves.push({
          x: 200 + rng() * 610,
          y: 483 + rng() * 51,
          c: rng(),
          a: 0.2 + rng() * 0.4
        });
      }
      this.festoon = [];
      const festoonStart = { x: 190, y: 374 };
      const festoonEnd = { x: 838, y: 398 };
      for (let i = 0; i <= 22; i++) {
        const t = i / 22;
        this.festoon.push({
          x: lerp(festoonStart.x, festoonEnd.x, t),
          y: lerp(festoonStart.y, festoonEnd.y, t) + Math.sin(t * Math.PI) * 40,
          i
        });
      }
    }

    _makeTree(x, baseY, height, spread, seed, layer) {
      const rng = mulberry32(seed);
      const clusters = [];
      const canopyY = baseY - height * 0.67;
      const clusterCount = Math.round(28 + spread * 0.19);
      for (let i = 0; i < clusterCount; i++) {
        const angle = rng() * Math.PI * 2;
        const radius = Math.sqrt(rng());
        clusters.push({
          x: x + Math.cos(angle) * spread * 0.54 * radius,
          y: canopyY + Math.sin(angle) * height * 0.22 * radius - (1 - radius) * height * 0.05,
          r: 5 + rng() * (height * 0.075),
          shade: rng(),
          seed: rng(),
          lift: 0.3 + rng() * 0.7
        });
      }
      clusters.sort((a, b) => a.y - b.y);
      const branches = [];
      const branchY = baseY - height * 0.42;
      branches.push([x, baseY, x + (rng() - 0.5) * 7, branchY]);
      for (let i = 0; i < 5; i++) {
        const sy = branchY + (rng() - 0.5) * 16;
        branches.push([x + (rng() - 0.5) * 3, sy, x + (rng() - 0.5) * spread * 0.7, canopyY + (rng() - 0.5) * height * 0.25]);
      }
      return {
        x, baseY, height, spread, seed, layer,
        canopyY, clusters, branches,
        leaves: clusters.filter((_, i) => i % 3 === 0).map((c) => ({ x: c.x, y: c.y, r: c.r }))
      };
    }

    _initPeople() {
      const looks = [
        { coat: "#c47a52", pants: "#343847", skin: "#c58e6a", hair: "#3b2b27", accent: "#e1c687", hat: "beanie", scarf: true, bag: "tote" },
        { coat: "#5e7f79", pants: "#2d3543", skin: "#e3b58e", hair: "#1f2528", accent: "#d9b77e", hat: "none", scarf: false, bag: "camera" },
        { coat: "#b55f64", pants: "#34384a", skin: "#9d654b", hair: "#2b211f", accent: "#e8c4a2", hat: "none", scarf: true, bag: "none" },
        { coat: "#d5b36b", pants: "#3f4153", skin: "#dcaa84", hair: "#63452f", accent: "#537f75", hat: "cap", scarf: false, bag: "tote" },
        { coat: "#454f70", pants: "#32303c", skin: "#bc8464", hair: "#252228", accent: "#e5b36e", hat: "none", scarf: true, bag: "none", dog: true },
        { coat: "#7d526c", pants: "#323745", skin: "#d19a78", hair: "#462f2b", accent: "#d8c798", hat: "bun", scarf: false, bag: "tote" },
        { coat: "#4d7160", pants: "#363948", skin: "#b47a58", hair: "#2c2927", accent: "#d9b777", hat: "none", scarf: true, bag: "camera" },
        { coat: "#d3c5a3", pants: "#4c4e60", skin: "#c78e69", hair: "#68483a", accent: "#ad665d", hat: "beanie", scarf: false, bag: "none" },
        { coat: "#a86145", pants: "#2e3440", skin: "#e0ad86", hair: "#3b2b22", accent: "#7c9f9c", hat: "none", scarf: true, bag: "tote" },
        { coat: "#60739c", pants: "#3a3540", skin: "#99654e", hair: "#262226", accent: "#efc77d", hat: "none", scarf: false, bag: "camera" },
        { coat: "#9a7b4c", pants: "#323740", skin: "#d7a27b", hair: "#544138", accent: "#4e8178", hat: "cap", scarf: false, bag: "tote" }
      ];
      const rng = mulberry32(0x5eed);
      this.people = [];
      const lanes = [476, 489, 500, 513, 525];
      for (let i = 0; i < looks.length; i++) {
        const lane = lanes[i % lanes.length];
        const p = Object.assign({}, looks[i], {
          id: i,
          x: 248 + i * 46 + rng() * 24,
          y: lane + (rng() - 0.5) * 4,
          lane,
          targetY: lane,
          dir: rng() > 0.5 ? 1 : -1,
          speed: 8.5 + rng() * 8,
          phase: rng() * 10,
          state: "walk",
          partner: null,
          chatUntil: 0,
          chatType: "dots",
          cooldown: rng() * 3,
          wave: 0,
          bubble: null,
          bubbleStart: 0,
          style: rng() > 0.8 ? 1 : 0,
          dogOffset: i === 4 ? 1 : 0
        });
        this.people.push(p);
      }
      this.startChat(1, 6, this.time + 1.7);
      this.chatCheck = 1.4;
      this.dog = { x: this.people[4].x + 18, y: this.people[4].y + 5, wag: 0 };
    }

    _initAtmosphere() {
      const rng = mulberry32(0xbee5);
      this.bokeh = [];
      for (let i = 0; i < 13; i++) {
        this.bokeh.push({
          x: 30 + rng() * (W - 60),
          y: 60 + rng() * (H - 40),
          r: 7 + rng() * 28,
          c: i % 3,
          phase: rng() * Math.PI * 2,
          drift: 1.5 + rng() * 3.5,
          alpha: 0.3 + rng() * 0.7,
          front: rng() > 0.38
        });
      }
      this.motes = [];
      for (let i = 0; i < 24; i++) {
        this.motes.push({
          x: rng() * W, y: 200 + rng() * 300,
          phase: rng() * 10, speed: 2 + rng() * 4, alpha: 0.2 + rng() * 0.6
        });
      }
      this.leaves = [];
      this.leafClock = 0;
      this.gust = 0.4;
      this.windPhase = rng() * 10;
      this.conversationParticles = [];
      this.greetingParticles = [];
      this.meteor = null;
      this.meteorClock = 6;
      this.paletteMeta = L.MODES[this.mode];
    }

    _loop(now) {
      if (!this.running) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrame) / 1000));
      this.lastFrame = now;
      this._update(dt);
      this._render();
      requestAnimationFrame(this._loop);
    }

    _update(dt) {
      this.time += dt;
      if (this.transition < 1) {
        this.transition = Math.min(1, this.transition + dt / this.transitionDuration);
        this.palette = L.blendPalettes(this.fromPalette, this.toPalette, L.ease(this.transition));
        if (this.transition >= 1) this.fromPalette = Object.assign({}, this.toPalette);
      }
      this.flash = Math.max(0, this.flash - dt * 0.8);
      this.pointer.energy *= Math.pow(0.12, dt);
      this.gust += ((0.45 + Math.sin(this.time * 0.37) * 0.17 + Math.sin(this.time * 1.13 + 1.7) * 0.12) - this.gust) * dt * 0.55;
      this.gust = Math.max(0, Math.min(1.8, this.gust + this.pointer.energy * dt * 0.7));
      this.windPhase += dt * (0.7 + this.gust * 0.6);

      this._updatePeople(dt);
      this._updateDog(dt);
      this._updateLeaves(dt);
      this._updateParticles(dt);
      this._updateAmbient(dt);

      this.chatCheck -= dt;
      if (this.chatCheck <= 0) {
        this.chatCheck = 1.15;
        this._lookForConversation();
      }
    }

    _render() {
      const ctx = this.ctx;
      const p = this.palette;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);

      this._drawSky(ctx, p);
      this._drawBirds(ctx, p);
      this._drawFarCity(ctx, p);
      this._drawCityLayer(ctx, p);
      this._drawMist(ctx, p);
      this._drawWater(ctx, p);
      this._drawBridge(ctx, p);
      this._drawQuay(ctx, p);
      this._drawCafe(ctx, p);
      this._drawRightHouse(ctx, p);
      this._drawStreetProps(ctx, p);
      this._drawTrees(ctx, p);
      this._drawLamps(ctx, p);
      this._drawPeople(ctx, p);
      this._drawForegroundDetail(ctx, p);
      this._drawLeaves(ctx, p);
      this._drawLighting(ctx, p);
      this._drawBokeh(ctx, p);
      this._drawVignette(ctx);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(this.noiseCanvas, Math.floor(Math.random() * 10) - 5, Math.floor(Math.random() * 6) - 3, W, H);
    }

    _drawSky(ctx, p) {
      const sky = ctx.createLinearGradient(0, 0, 0, 330);
      sky.addColorStop(0, p.skyTop);
      sky.addColorStop(0.42, p.skyUpper);
      sky.addColorStop(0.7, p.skyMid);
      sky.addColorStop(0.88, p.skyLow);
      sky.addColorStop(1, p.skyHorizon);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 334);

      const sx = p.sunX;
      const sy = p.sunY;
      const sunLow = Math.max(0, 1 - Math.abs(sy - 205) / 230);
      glow(ctx, sx, sy, 190 + p.sunR * 3, p.sunGlow, 0.18 + sunLow * 0.12, 0.16);
      glow(ctx, sx, sy, 62 + p.sunR * 2, p.sunGlow, 0.34, 0.12);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(sx, sy);
      ctx.rotate(Math.sin(this.time * 0.002) * 0.08);
      for (let i = 0; i < 9; i++) {
        const angle = -Math.PI * 0.92 + i * (Math.PI * 1.84 / 8);
        const length = 260 + (i % 3) * 110;
        const width = 0.012 + (i % 2) * 0.009;
        ctx.fillStyle = rgba(p.sunGlow, 0.027 + sunLow * 0.012);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle - width) * length, Math.sin(angle - width) * length);
        ctx.lineTo(Math.cos(angle + width) * length, Math.sin(angle + width) * length);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      if (p.starAlpha > 0.015) {
        for (const star of this.stars) {
          const twinkle = 0.55 + Math.sin(this.time * star.speed + star.phase) * 0.45;
          ctx.globalAlpha = p.starAlpha * twinkle;
          ctx.fillStyle = star.s === 2 ? p.waterLine : "#d9eff4";
          ctx.fillRect(star.x, star.y, star.s, star.s);
          if (star.s === 2 && twinkle > 0.84) {
            ctx.globalAlpha *= 0.6;
            ctx.fillRect(star.x - 2, star.y, 6, 1);
            ctx.fillRect(star.x, star.y - 2, 1, 6);
          }
        }
        ctx.globalAlpha = 1;
        this._drawMeteor(ctx, p);
      }

      const diskR = p.sunR;
      pixelCircle(ctx, Math.round(sx), Math.round(sy), Math.round(diskR), p.sunColor);
      ctx.globalAlpha = 0.28;
      pixelCircle(ctx, Math.round(sx - diskR * 0.28), Math.round(sy - diskR * 0.25), Math.max(2, Math.round(diskR * 0.58)), "#ffffff");
      ctx.globalAlpha = 1;
      if (p.moonness > 0.08) {
        const crater = mixHex(p.sunColor, p.skyUpper, 0.2);
        ctx.globalAlpha = p.moonness * 0.52;
        pixelCircle(ctx, Math.round(sx + diskR * 0.35), Math.round(sy - diskR * 0.18), Math.max(2, Math.round(diskR * 0.22)), crater);
        pixelCircle(ctx, Math.round(sx - diskR * 0.25), Math.round(sy + diskR * 0.28), Math.max(1, Math.round(diskR * 0.15)), crater);
        pixelCircle(ctx, Math.round(sx + 1), Math.round(sy + diskR * 0.08), Math.max(1, Math.round(diskR * 0.11)), crater);
        pixelCircle(ctx, Math.round(sx + diskR * 0.48), Math.round(sy + diskR * 0.38), Math.max(1, Math.round(diskR * 0.08)), crater);
        ctx.globalAlpha = p.moonness * 0.2;
        ctx.fillStyle = p.sunColor;
        ctx.fillRect(Math.round(sx + diskR * 0.18), Math.round(sy - diskR * 0.34), Math.max(1, Math.round(diskR * 0.2)), 1);
        ctx.globalAlpha = 1;
      }

      for (const cloud of this.clouds) {
        const span = cloud.w + 360;
        let cx = (cloud.x + this.time * cloud.speed) % span - 180;
        if (cx < -cloud.w - 40) cx += span;
        this._drawCloud(ctx, cloud, cx, cloud.y, p, sx, sy);
      }

      const horizon = ctx.createLinearGradient(0, 230, 0, 334);
      horizon.addColorStop(0, rgba(p.skyHorizon, 0));
      horizon.addColorStop(0.72, rgba(p.skyHorizon, 0.2 + p.mistAlpha));
      horizon.addColorStop(1, rgba(p.skyHorizon, 0.36));
      ctx.fillStyle = horizon;
      ctx.fillRect(0, 230, W, 104);

      if (this.flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const f = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.8);
        f.addColorStop(0, rgba(p.sunGlow, this.flash * 0.12));
        f.addColorStop(0.55, rgba(p.sunGlow, this.flash * 0.025));
        f.addColorStop(1, rgba(p.sunGlow, 0));
        ctx.fillStyle = f;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    _drawCloud(ctx, cloud, x, y, p, sunX, sunY) {
      const w = cloud.w;
      const h = cloud.h;
      const step = 2;
      ctx.save();
      ctx.globalAlpha = cloud.op;
      for (let px = 0; px < w; px += step) {
        let top = h;
        for (const puff of cloud.puffs) {
          const dx = px - puff.x;
          if (Math.abs(dx) < puff.r) {
            const py = puff.y - Math.sqrt(puff.r * puff.r - dx * dx);
            if (py < top) top = py;
          }
        }
        if (top >= h - 1) continue;
        const yy = Math.round(y + top);
        const hh = Math.max(1, h - top + 5);
        const noise = Math.sin(px * 0.34 + cloud.x) * 1.4;
        ctx.fillStyle = p.cloudMid;
        ctx.fillRect(Math.round(x + px), Math.round(yy + noise), step, Math.round(hh));
        const sunReach = clamp(1 - Math.abs(x + px - sunX) / 300, 0, 1);
        if (top < h * 0.56) {
          ctx.fillStyle = sunReach > 0.32 ? p.cloudLight : p.cloudMid;
          ctx.fillRect(Math.round(x + px), Math.round(yy + noise), step, 3);
        }
        if (px % 10 === 0) {
          ctx.fillStyle = rgba(p.cloudDark, 0.36);
          ctx.fillRect(Math.round(x + px), Math.round(y + h - 1 + noise), 6, 2);
        }
      }
      ctx.restore();
    }

    _drawMeteor(ctx, p) {
      this.meteorClock -= 1 / 60;
      if (this.meteorClock <= 0 && Math.random() < 0.018) {
        this.meteor = { x: 120 + Math.random() * 660, y: 30 + Math.random() * 110, life: 1 };
        this.meteorClock = 9 + Math.random() * 11;
      }
      if (this.meteor) {
        this.meteor.life -= 0.014;
        this.meteor.x += 140 / 60;
        this.meteor.y += 42 / 60;
        if (this.meteor.life <= 0) { this.meteor = null; return; }
        const a = p.starAlpha * this.meteor.life;
        const g = ctx.createLinearGradient(this.meteor.x, this.meteor.y, this.meteor.x - 80, this.meteor.y - 24);
        g.addColorStop(0, rgba("#e9ffff", a));
        g.addColorStop(1, rgba("#e9ffff", 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.meteor.x, this.meteor.y);
        ctx.lineTo(this.meteor.x - 80, this.meteor.y - 24);
        ctx.stroke();
        ctx.fillStyle = rgba("#ffffff", a);
        ctx.fillRect(Math.round(this.meteor.x), Math.round(this.meteor.y), 2, 2);
      }
    }

    _drawBirds(ctx, p) {
      if (p.birdAlpha <= 0.01) return;
      for (const bird of this.birds) {
        const x = (bird.x + this.time * bird.speed) % (W + 100) - 50;
        const flap = Math.sin(this.time * 6 + bird.phase) > 0 ? 1 : -1;
        const y = bird.y + Math.sin(this.time * 1.4 + bird.phase) * 3;
        ctx.globalAlpha = p.birdAlpha;
        ctx.fillStyle = shade(p.skyTop, -0.35);
        const s = bird.scale;
        ctx.fillRect(Math.round(x - 3 * s), Math.round(y), 2 * s, 1);
        ctx.fillRect(Math.round(x - s), Math.round(y - flap), 2 * s, 1);
        ctx.fillRect(Math.round(x + s), Math.round(y + 1), s, 1);
        ctx.fillRect(Math.round(x + 2 * s), Math.round(y + flap), s, 1);
      }
      ctx.globalAlpha = 1;
    }

    _drawFarCity(ctx, p) {
      ctx.save();
      ctx.globalAlpha = p.farAlpha;
      ctx.fillStyle = rgba(p.farDark, 0.33);
      ctx.beginPath();
      ctx.moveTo(0, 306);
      for (let x = 0; x <= W; x += 24) {
        const y = 268 + Math.sin(x * 0.012 + 1.2) * 20 + Math.sin(x * 0.027) * 7;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, CITY_BASE);
      ctx.lineTo(0, CITY_BASE);
      ctx.closePath();
      ctx.fill();

      for (const b of this.farBuildings) {
        const bodyColor = b.depth > 0.54 ? p.far : p.farDark;
        ctx.fillStyle = bodyColor;
        ctx.fillRect(b.x, b.top, b.w, CITY_BASE - b.top + 3);
        ctx.fillStyle = rgba(p.farLit, 0.16);
        ctx.fillRect(b.x + b.w - 2, b.top, 2, CITY_BASE - b.top);
        if (b.roof > 0.7) {
          ctx.fillStyle = p.farDark;
          ctx.fillRect(b.x + 3, b.top - 5, Math.max(2, b.w - 6), 5);
          ctx.fillRect(b.x + 8, b.top - 9, Math.max(1, b.w - 16), 4);
        } else if (b.roof > 0.38) {
          ctx.fillStyle = p.far;
          ctx.fillRect(b.x + Math.round(b.w * 0.32), b.top - 4, Math.max(2, Math.round(b.w * 0.36)), 4);
        }
        if (b.antenna && b.top > 90) {
          pixelLine(ctx, b.x + b.w - 5, b.top - 3, b.x + b.w - 5, b.top - 19, rgba(p.farLit, 0.7), 1);
          if (p.neonAlpha > 0.3) {
            ctx.fillStyle = rgba(p.windowPink, 0.8 * p.neonAlpha);
            ctx.fillRect(b.x + b.w - 6, b.top - 20, 2, 2);
          }
        }
        if (b.lights.length && p.litFrac > 0.18) {
          for (const li of b.lights) {
            if (li.t > p.litFrac * 0.95) continue;
            const flicker = Math.sin(this.time * 0.25 + li.t * 12) > -0.94 ? 1 : 0.2;
            ctx.globalAlpha = p.farAlpha * 0.78 * flicker;
            ctx.fillStyle = li.c > 0.82 ? p.windowPink : li.c > 0.5 ? p.windowCool : p.windowWarm;
            ctx.fillRect(Math.round(li.x), Math.round(li.y), 1, 1);
          }
          ctx.globalAlpha = p.farAlpha;
        }
      }
      ctx.restore();

      // Two harbour cranes and the distant sea wall.
      ctx.save();
      ctx.globalAlpha = p.farAlpha * 0.6;
      for (const cx of [438, 840]) {
        pixelLine(ctx, cx, 303, cx, 247, p.farDark, 1);
        pixelLine(ctx, cx, 258, cx - 19, 263, p.farDark, 1);
        pixelLine(ctx, cx, 258, cx + 24, 263, p.farDark, 1);
        pixelLine(ctx, cx + 24, 263, cx + 24, 277, p.farDark, 1);
        pixelLine(ctx, cx - 20, 263, cx + 34, 282, rgba(p.farDark, 0.45), 1);
      }
      ctx.restore();

      const bank = ctx.createLinearGradient(0, 294, 0, 322);
      bank.addColorStop(0, rgba(p.haze, 0.02));
      bank.addColorStop(0.7, rgba(p.haze, 0.22));
      bank.addColorStop(1, rgba(p.haze, 0.62));
      ctx.fillStyle = bank;
      ctx.fillRect(0, 292, W, 32);
    }

    _drawCityLayer(ctx, p) {
      const cc = this.cityCanvas.getContext("2d");
      cc.clearRect(0, 0, W, H);
      cc.save();
      for (const b of this.buildings) this._drawBuilding(cc, b, p);

      // Seawall and a few tiny figures at the far waterfront.
      cc.fillStyle = p.oldTrim;
      cc.fillRect(0, CITY_BASE - 4, W, 7);
      cc.fillStyle = rgba(p.quayLight, 0.5);
      cc.fillRect(0, CITY_BASE - 4, W, 1);
      cc.fillStyle = rgba(p.oldTrim, 0.8);
      for (let x = 16; x < W; x += 52) {
        cc.fillRect(x, CITY_BASE - 2, 2, 2);
        if ((x + (p.litFrac * 10 | 0)) % 7 === 0) {
          cc.fillStyle = rgba(p.skyLow, 0.55);
          cc.fillRect(x + 5, CITY_BASE - 8, 2, 5);
          cc.fillStyle = rgba(p.oldTrim, 0.8);
        }
      }

      const wash = cc.createLinearGradient(0, 120, 0, CITY_BASE);
      wash.addColorStop(0, rgba(p.haze, 0.02));
      wash.addColorStop(0.64, rgba(p.haze, 0.04));
      wash.addColorStop(1, rgba(p.haze, 0.13 + p.mistAlpha));
      cc.fillStyle = wash;
      cc.fillRect(0, 80, W, CITY_BASE - 80);
      cc.restore();
      ctx.drawImage(this.cityCanvas, 0, 0);
    }

    _drawBuilding(ctx, b, p) {
      if (b.kind === "old" || b.kind === "warehouse") this._drawOldBuilding(ctx, b, p);
      else if (b.kind === "clock") this._drawClockBuilding(ctx, b, p);
      else this._drawModernBuilding(ctx, b, p);
      if (b.sign) this._drawSign(ctx, b, p);
    }

    _drawOldBuilding(ctx, b, p) {
      const x = Math.round(b.x);
      const top = Math.round(b.top);
      const w = Math.round(b.w);
      const base = b.base;
      const roofH = b.roofH;
      const bodyTop = top + roofH;
      const bodyH = base - bodyTop;
      const seedN = b.seed % 5;
      const wall = shade(p.oldWall, (seedN - 2) * 0.045);
      const trim = p.oldTrim;
      const lit = p.lightDir;

      if (roofH > 12 && seedN % 2 === 0) {
        const cx = x + Math.round(w * 0.23);
        ctx.fillStyle = p.oldWallDark;
        ctx.fillRect(cx, top + 2, 7, roofH + 8);
        ctx.fillStyle = p.oldRoof;
        ctx.fillRect(cx - 1, top, 9, 3);
      }

      ctx.fillStyle = wall;
      ctx.fillRect(x, bodyTop, w, bodyH);
      ctx.fillStyle = rgba(lit < 0 ? p.oldWallLit : p.oldWallDark, 0.22);
      ctx.fillRect(lit < 0 ? x : x + w - 4, bodyTop, 4, bodyH);
      ctx.fillStyle = rgba(p.oldWallDark, 0.36);
      ctx.fillRect(x, bodyTop, w, 1);
      ctx.fillRect(lit < 0 ? x + w - 1 : x, bodyTop, 1, bodyH);

      ctx.fillStyle = rgba(trim, 0.72);
      ctx.fillRect(x, bodyTop + 4, w, 1);
      for (let fy = bodyTop + 25; fy < base - 3; fy += 25) ctx.fillRect(x + 1, fy, w - 2, 1);
      const bays = w > 50 ? 3 : 2;
      for (let bay = 0; bay <= bays; bay++) {
        const bx = x + Math.round((w - 2) * bay / bays);
        ctx.fillRect(bx, bodyTop + 1, 1, bodyH - 2);
      }

      if (b.kind === "warehouse") {
        ctx.fillStyle = rgba(trim, 0.8);
        ctx.fillRect(x + 7, base - 18, 19, 15);
        ctx.fillStyle = rgba(p.oldRoofLit, 0.55);
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 9 + i * 6, base - 16, 2, 11);
        ctx.fillStyle = rgba(p.windowWarm, 0.3 + p.litFrac);
        ctx.fillRect(x + 8, base - 17, 1, 2);
        ctx.fillStyle = rgba(p.oldWallDark, 0.7);
        ctx.fillRect(x + w - 22, base - 13, 14, 10);
      } else {
        const shopW = Math.min(28, w - 12);
        const sx = x + Math.round((w - shopW) / 2);
        ctx.fillStyle = rgba(p.skyLow, 0.28 + p.windowGlowAlpha * 0.5);
        ctx.fillRect(sx, base - 19, shopW, 13);
        ctx.fillStyle = rgba(p.windowWarm, 0.45 + p.windowGlowAlpha * 0.5);
        ctx.fillRect(sx + 2, base - 17, shopW - 4, 8);
        ctx.fillStyle = rgba(trim, 0.9);
        for (let i = 0; i < 4; i++) ctx.fillRect(sx + 3 + i * 6, base - 17, 1, 8);
        ctx.fillStyle = rgba(p.oldTrim, 0.85);
        ctx.fillRect(sx - 3, base - 22, shopW + 6, 4);
        ctx.fillStyle = rgba(p.oldRoofLit, 0.55);
        for (let i = 0; i < 5; i++) ctx.fillRect(sx - 2 + i * 7, base - 21, 3, 2);
      }

      this._drawOldWindows(ctx, b, p, trim);
      this._drawOldRoof(ctx, b, p, x, top, w, roofH);

      if (seedN === 1 || seedN === 3) {
        ctx.fillStyle = rgba(p.treeDark, 0.8);
        for (let i = 0; i < 8; i++) {
          const ix = x + 4 + Math.round(hash(b.seed * 4 + i) * 9);
          const iy = bodyTop + 18 + Math.round(hash(b.seed * 9 + i) * (bodyH - 24));
          ctx.fillRect(ix, iy, 1, 2);
          if (i % 3 === 0) ctx.fillRect(ix + 1, iy - 1, 2, 1);
        }
      }

      if (p.windowGlowAlpha > 0.35) {
        glow(ctx, x + w * 0.55, bodyTop + bodyH * 0.62, w * 0.4, p.windowWarm, p.windowGlowAlpha * 0.085, 0.55);
      }
    }

    _drawOldWindows(ctx, b, p, trim) {
      for (const win of b.windows) {
        if (win.y + win.h > b.base - 24) continue;
        const windowLit = win.lit < p.litFrac;
        const wx = Math.round(win.x);
        const wy = Math.round(win.y);
        ctx.fillStyle = rgba(trim, 0.86);
        ctx.fillRect(wx - 1, wy - 1, win.w + 2, win.h + 2);
        if (windowLit) {
          const color = win.color > 0.72 ? p.windowCool : p.windowPink;
          ctx.fillStyle = win.color > 0.88 ? color : p.windowWarm;
          ctx.fillRect(wx, wy, win.w, win.h);
          ctx.fillStyle = rgba(p.windowWarm, 0.35);
          ctx.fillRect(wx + 1, wy + 1, win.w - 2, 2);
          ctx.fillStyle = rgba(p.oldTrim, 0.55);
          ctx.fillRect(wx + Math.floor(win.w / 2), wy, 1, win.h);
        } else {
          ctx.fillStyle = p.windowOff;
          ctx.fillRect(wx, wy, win.w, win.h);
          ctx.fillStyle = rgba(p.glass, 0.4);
          ctx.fillRect(wx, wy, win.w, 1);
        }
        if (win.shutters) {
          ctx.fillStyle = rgba(p.oldTrim, 0.72);
          ctx.fillRect(wx - 3, wy, 2, win.h);
          ctx.fillRect(wx + win.w + 1, wy, 2, win.h);
          ctx.fillStyle = rgba(p.oldRoofLit, 0.36);
          ctx.fillRect(wx - 3, wy, 1, win.h);
          ctx.fillRect(wx + win.w + 2, wy, 1, win.h);
        }
        if (win.flower && windowLit) {
          ctx.fillStyle = rgba(p.treeDark, 0.95);
          ctx.fillRect(wx - 1, wy + win.h + 1, win.w + 2, 2);
          ctx.fillStyle = win.color > 0.5 ? p.neon2 : p.windowPink;
          ctx.fillRect(wx + 1, wy + win.h, 1, 1);
          ctx.fillRect(wx + 4, wy + win.h + 1, 1, 1);
        }
      }
    }

    _drawOldRoof(ctx, b, p, x, top, w, roofH) {
      const lit = p.lightDir;
      if (b.roof === "flat") {
        ctx.fillStyle = p.oldTrim;
        ctx.fillRect(x - 2, top, w + 4, 4);
        ctx.fillStyle = rgba(p.oldWallLit, 0.6);
        ctx.fillRect(x - 2, top, w + 4, 1);
        ctx.fillStyle = p.oldWallDark;
        ctx.fillRect(x + 5, top - 2, 5, 2);
        ctx.fillRect(x + w - 14, top - 3, 3, 3);
        pixelLine(ctx, x + w - 8, top, x + w - 8, top - 13, p.oldTrim, 1);
        return;
      }
      ctx.save();
      for (let yy = 0; yy < roofH; yy += 2) {
        const t = yy / Math.max(1, roofH);
        let inset;
        if (b.roof === "mansard") {
          inset = Math.round((1 - t) * 8);
        } else {
          inset = Math.round((1 - t) * roofH * 0.58);
        }
        const rx = x - 3 + inset;
        const rw = Math.max(8, w + 6 - inset * 2);
        ctx.fillStyle = p.oldRoof;
        ctx.fillRect(rx, top + yy, rw, 2);
        if (yy % 4 === 0 || yy < 4) {
          ctx.fillStyle = rgba(p.oldRoofLit, lit < 0 ? 0.36 : 0.2);
          ctx.fillRect(lit < 0 ? rx : rx + rw - 5, top + yy, 5, 1);
        }
        if (yy > roofH * 0.45) {
          ctx.fillStyle = rgba(p.oldRoofLit, 0.33);
          ctx.fillRect(rx + rw - 3, top + yy, 2, 2);
        }
        if (yy > 2 && yy % 6 === 0) {
          ctx.fillStyle = rgba(p.oldTrim, 0.38);
          ctx.fillRect(rx + 2, top + yy, rw - 4, 1);
        }
      }
      ctx.fillStyle = p.oldTrim;
      ctx.fillRect(x - 4, top + roofH - 1, w + 8, 3);
      ctx.fillStyle = rgba(p.oldRoofLit, 0.45);
      ctx.fillRect(x - 4, top + roofH - 1, w + 8, 1);

      if (b.roof === "mansard" && w > 45) {
        const dx = x + Math.round(w * 0.55);
        const dy = top + roofH - 14;
        ctx.fillStyle = p.oldWallDark;
        ctx.fillRect(dx, dy, 11, 11);
        ctx.fillStyle = p.windowWarm;
        ctx.fillRect(dx + 2, dy + 3, 7, 5);
        ctx.fillStyle = p.oldTrim;
        ctx.fillRect(dx - 2, dy - 2, 15, 3);
      }
      if ((b.seed % 3) === 0) {
        const vx = x + w * 0.7;
        pixelLine(ctx, vx, top + 3, vx, top - 11, rgba(p.oldTrim, 0.8), 1);
        pixelLine(ctx, vx - 3, top - 8, vx + 4, top - 10, rgba(p.oldTrim, 0.8), 1);
      }
      ctx.restore();
    }

    _drawModernBuilding(ctx, b, p) {
      const x = Math.round(b.x);
      const w = Math.round(b.w);
      const top = Math.round(b.top);
      const base = b.base;
      const height = base - top;
      const isGlass = b.kind === "glass";
      const isBrick = b.kind === "brick" || b.kind === "market";
      const lit = p.lightDir;
      let body = isGlass ? p.glass : isBrick ? mixHex(p.modern, p.oldWall, 0.42) : p.modern;
      if (b.kind === "deco") body = mixHex(p.modern, p.oldWall, 0.14);
      const bodyDark = isGlass ? mixHex(p.modernDark, p.waterDeep, 0.2) : p.modernDark;

      ctx.fillStyle = bodyDark;
      ctx.fillRect(x - 1, top + 2, w + 2, height);
      ctx.fillStyle = body;
      ctx.fillRect(x, top, w, height - 2);
      ctx.fillStyle = rgba(p.modernLit, 0.28);
      ctx.fillRect(lit < 0 ? x : x + w - 3, top, 3, height);
      ctx.fillStyle = rgba(bodyDark, 0.42);
      ctx.fillRect(lit < 0 ? x + w - 3 : x, top, 3, height);

      if (isGlass) {
        for (let gx = x + 4; gx < x + w - 2; gx += 6) {
          ctx.fillStyle = rgba(p.modernDark, 0.34);
          ctx.fillRect(gx, top + 6, 1, height - 8);
        }
        ctx.fillStyle = rgba(p.windowCool, 0.16);
        ctx.fillRect(x + 6, top + 7, 2, height - 20);
      } else if (isBrick) {
        ctx.fillStyle = rgba(p.oldTrim, 0.16);
        for (let yy = top + 12; yy < base - 3; yy += 6) {
          ctx.fillRect(x + 2, yy, w - 4, 1);
          for (let xx = x + 3 + (yy % 12); xx < x + w - 2; xx += 9) {
            ctx.fillRect(xx, yy - 3, 1, 3);
          }
        }
      } else {
        ctx.fillStyle = rgba(p.modernLit, 0.12);
        for (let yy = top + 15; yy < base - 5; yy += 9) {
          ctx.fillRect(x + 2, yy, w - 4, 1);
        }
        ctx.fillStyle = rgba(p.modernDark, 0.4);
        ctx.fillRect(x + Math.round(w * 0.48), top + 4, 1, height - 8);
      }

      for (const win of b.windows) {
        const windowLit = win.lit < p.litFrac;
        const wx = Math.round(win.x);
        const wy = Math.round(win.y);
        if (wy + win.h > base - 3) continue;
        if (windowLit) {
          let color = p.windowWarm;
          if (win.color > 0.78) color = p.windowPink;
          else if (win.color > 0.48) color = p.windowCool;
          ctx.fillStyle = color;
          ctx.fillRect(wx, wy, win.w, win.h);
          if (p.windowGlowAlpha > 0.62 && win.color > 0.7) {
            ctx.fillStyle = rgba(color, 0.12);
            ctx.fillRect(wx - 1, wy - 1, win.w + 2, win.h + 2);
          }
        } else {
          ctx.fillStyle = rgba(isGlass ? p.windowCool : p.windowOff, isGlass ? 0.3 : 0.9);
          ctx.fillRect(wx, wy, win.w, win.h);
          ctx.fillStyle = rgba(p.waterLine, isGlass ? 0.25 : 0.12);
          ctx.fillRect(wx, wy, win.w, 1);
        }
      }

      ctx.fillStyle = rgba(p.modernDark, 0.46);
      for (let ry = top + 10; ry < base - 8; ry += 25) {
        ctx.fillRect(x + 2, ry, w - 4, 1);
      }
      ctx.fillStyle = rgba(p.modernLit, 0.33);
      ctx.fillRect(x, top, w, 1);

      // After dark, a few towers switch on coloured edge tubes.
      if (p.neonAlpha > 0.72 && (b.kind === "deco" || b.kind === "glass" || b.seed % 5 === 0)) {
        const tube = [p.neon1, p.neon2, p.neon3][b.seed % 3];
        const tx = lit < 0 ? x + 2 : x + w - 3;
        const hum = 0.72 + Math.sin(this.time * 2.4 + b.seed * 1.7) * 0.18;
        ctx.fillStyle = rgba(tube, 0.56 * hum);
        for (let sy = top + 11; sy < base - 18; sy += 7) ctx.fillRect(tx, sy, 1, 4);
        ctx.fillStyle = rgba(tube, 0.34 * hum);
        ctx.fillRect(x + 4, top + 6, w - 8, 1);
        glow(ctx, tx, top + height * 0.48, 20, tube, p.neonAlpha * 0.16 * hum, 0.3);
      }

      this._drawModernRoof(ctx, b, p, x, w, top);

      if (p.windowGlowAlpha > 0.45 && (b.kind === "glass" || b.kind === "deco" || b.kind === "brick")) {
        glow(ctx, x + w * 0.52, top + height * 0.5, Math.min(70, w * 1.4), p.windowWarm, p.windowGlowAlpha * 0.06, 0.5);
      }
    }

    _drawModernRoof(ctx, b, p, x, w, top) {
      const style = b.roof;
      ctx.fillStyle = p.modernDark;
      ctx.fillRect(x - 1, top - 2, w + 2, 4);
      ctx.fillStyle = rgba(p.modernLit, 0.48);
      ctx.fillRect(x, top - 2, w, 1);
      if (style === "antenna") {
        const ax = x + Math.round(w * 0.64);
        pixelLine(ctx, ax, top - 2, ax, top - 31, p.modernDark, 1);
        pixelLine(ctx, ax - 4, top - 16, ax + 4, top - 16, p.modernDark, 1);
        if (p.neonAlpha > 0.25) {
          const blink = Math.sin(this.time * 0.8 + b.seed) > 0.5 ? 1 : 0.25;
          ctx.fillStyle = rgba("#ff5f63", 0.45 + blink * 0.5);
          ctx.fillRect(ax - 1, top - 33, 3, 2);
          glow(ctx, ax + 1, top - 32, 12, "#ff6366", blink * p.neonAlpha * 0.32, 0.2);
        }
      } else if (style === "spire") {
        const cx = x + Math.round(w * 0.52);
        for (let i = 0; i < 7; i++) {
          const half = Math.max(1, 6 - i);
          ctx.fillStyle = i % 2 ? p.modernDark : p.modern;
          ctx.fillRect(cx - half, top - 4 - i * 3, half * 2, 3);
        }
        pixelLine(ctx, cx, top - 26, cx, top - 38, rgba(p.modernLit, 0.8), 1);
      } else if (style === "stepped") {
        ctx.fillStyle = p.modern;
        ctx.fillRect(x + 5, top - 6, w - 10, 6);
        ctx.fillStyle = p.modernLit;
        ctx.fillRect(x + 14, top - 12, Math.max(8, w - 28), 7);
        ctx.fillStyle = rgba(p.modernDark, 0.72);
        ctx.fillRect(x + 16, top - 15, Math.max(4, w - 32), 4);
        ctx.fillRect(x + Math.round(w * 0.55), top - 21, 2, 8);
      }
      if (w > 48) {
        const wx = x + 7;
        ctx.fillStyle = p.modernDark;
        ctx.fillRect(wx, top - 12, 9, 8);
        ctx.fillStyle = rgba(p.modernLit, 0.42);
        ctx.fillRect(wx + 1, top - 11, 2, 6);
        pixelLine(ctx, wx + 2, top - 14, wx + 2, top - 9, p.modernDark, 1);
        pixelLine(ctx, wx + 7, top - 14, wx + 7, top - 9, p.modernDark, 1);
      }
      if (w > 65) {
        ctx.fillStyle = rgba(p.modernDark, 0.8);
        ctx.fillRect(x + w - 20, top - 8, 10, 6);
        ctx.fillStyle = rgba(p.lamp, 0.18 + p.windowGlowAlpha * 0.2);
        ctx.fillRect(x + w - 18, top - 6, 2, 1);
      }
    }

    _drawClockBuilding(ctx, b, p) {
      const x = b.x;
      const w = b.w;
      const top = b.top;
      const base = b.base;
      const cx = x + w / 2;
      const stone = mixHex(p.oldWallLit, p.bridgeLight, 0.28);
      const stoneDark = mixHex(p.oldWallDark, p.bridgeDark, 0.32);
      const lit = p.lightDir;

      const spireBaseY = top + 62;
      for (let i = 0; i < 16; i++) {
        const half = Math.max(1, Math.round(16 - i));
        ctx.fillStyle = i % 2 === 0 ? p.oldRoof : p.oldRoofLit;
        ctx.fillRect(Math.round(cx - half), Math.round(spireBaseY - i * 4), half * 2, 5);
      }
      ctx.fillStyle = p.oldTrim;
      ctx.fillRect(Math.round(cx - 18), spireBaseY + 1, 36, 3);
      ctx.fillRect(Math.round(cx - 17), top + 62, 34, 3);
      ctx.fillStyle = stoneDark;
      ctx.fillRect(x + 4, top + 64, w - 8, 52);
      ctx.fillStyle = stone;
      ctx.fillRect(x + 6, top + 66, w - 12, 48);
      ctx.fillStyle = p.oldTrim;
      ctx.fillRect(x + 10, top + 74, 8, 21);
      ctx.fillRect(x + 24, top + 74, 8, 21);
      ctx.fillRect(x + 33, top + 82, 2, 8);

      const cy = top + 94;
      pixelCircle(ctx, cx, cy, 14, stoneDark);
      pixelCircle(ctx, cx, cy, 12, p.windowWarm);
      ctx.fillStyle = rgba(p.oldTrim, 0.9);
      pixelCircle(ctx, cx, cy, 2, p.oldTrim);
      ctx.fillRect(cx, cy - 7, 1, 7);
      ctx.fillRect(cx, cy, 5, 1);
      for (let m = 0; m < 12; m++) {
        const a = m / 12 * Math.PI * 2;
        ctx.fillRect(Math.round(cx + Math.cos(a) * 9), Math.round(cy + Math.sin(a) * 9), 1, 1);
      }
      if (p.windowGlowAlpha > 0.3) glow(ctx, cx, cy, 27, p.windowWarm, p.windowGlowAlpha * 0.26, 0.4);

      ctx.fillStyle = stoneDark;
      ctx.fillRect(x + 2, top + 114, w - 4, base - top - 114);
      ctx.fillStyle = stone;
      ctx.fillRect(x + 4, top + 116, w - 8, base - top - 116);
      ctx.fillStyle = rgba(lit < 0 ? p.oldWallLit : p.oldWallDark, 0.28);
      ctx.fillRect(lit < 0 ? x + 4 : x + w - 8, top + 116, 4, base - top - 116);
      ctx.fillStyle = rgba(p.oldTrim, 0.55);
      for (let yy = top + 142; yy < base - 4; yy += 27) ctx.fillRect(x + 5, yy, w - 10, 1);
      ctx.fillStyle = p.oldTrim;
      ctx.fillRect(x + 1, top + 114, w - 2, 3);
      ctx.fillRect(x - 2, top + 61, w + 4, 4);

      for (let i = 0; i < 2; i++) {
        const wy = top + 126 + i * 42;
        ctx.fillStyle = rgba(p.oldTrim, 0.85);
        ctx.fillRect(x + 12, wy, 18, 28);
        ctx.fillStyle = i === 0 && p.litFrac > 0.3 ? p.windowWarm : p.windowOff;
        ctx.fillRect(x + 14, wy + 4, 14, 22);
        pixelCircle(ctx, x + 21, wy + 4, 7, ctx.fillStyle);
        ctx.fillStyle = rgba(p.oldTrim, 0.5);
        ctx.fillRect(x + 20, wy + 1, 1, 26);
        if (p.neonAlpha > 0.3) glow(ctx, x + 21, wy + 14, 20, p.windowWarm, p.windowGlowAlpha * 0.1, 0.45);
      }
      ctx.fillStyle = p.windowOff;
      ctx.fillRect(x + 14, top + 70, 3, 12);
      ctx.fillRect(x + 26, top + 70, 3, 12);
      const vx = cx + 2;
      pixelLine(ctx, vx, top + 3, vx, top - 9, p.oldTrim, 1);
      pixelLine(ctx, vx - 3, top - 5, vx + 4, top - 8, p.oldTrim, 1);
      if (p.starAlpha > 0.2) {
        ctx.fillStyle = rgba(p.neon1, 0.7 * p.starAlpha);
        ctx.fillRect(vx - 1, top - 9, 1, 1);
      }
    }

    _drawSign(ctx, b, p) {
      const neon = p.neonAlpha;
      const signColors = [p.neon1, p.neon2, p.neon3];
      const color = signColors[b.seed % 3];
      const dayColor = mixHex(p.oldWallLit, p.windowWarm, 0.25);
      const ink = neon > 0.18 ? color : dayColor;
      const flicker = neon > 0.3
        ? clamp(0.82 + Math.sin(this.time * (2.1 + (b.seed % 3) * 0.7) + b.seed) * 0.18
          - (Math.sin(this.time * 10.3 + b.seed * 2.7) > 0.985 ? 0.34 : 0), 0.32, 1)
        : 1;
      const neonLive = neon * flicker;
      let x, y, scale, text, vertical = false, boardW, boardH, alignCenter = true;

      if (b.sign === "NIGHT MARKET") {
        text = "NIGHT";
        x = b.x + b.w / 2;
        y = b.top - 35;
        scale = 2;
        boardW = 72;
        boardH = 31;
      } else if (b.sign === "HOTEL") {
        text = "HOTEL";
        x = b.x + b.w - 10;
        y = b.top + 26;
        scale = 1;
        boardW = 12;
        boardH = 43;
        vertical = true;
      } else if (b.sign === "LUMEN") {
        text = "LUMEN";
        x = b.x + b.w / 2;
        y = b.top + 51;
        scale = 1;
        boardW = 42;
        boardH = 15;
      } else {
        text = b.sign;
        x = b.x + b.w / 2;
        y = b.top + b.roofH + 8;
        scale = 1;
        boardW = pixelTextWidth(text, scale) + 7;
        boardH = 11;
        alignCenter = true;
      }

      const bx = Math.round(x - boardW / 2);
      const by = Math.round(y);
      if (neon > 0.12) glow(ctx, x, by + boardH / 2, Math.max(24, boardW * 0.85), color, neonLive * 0.24, 0.3);
      if (b.sign === "NIGHT MARKET") {
        ctx.fillStyle = rgba(p.oldTrim, 0.54);
        ctx.fillRect(bx + 4, by + boardH, 2, 16);
        ctx.fillRect(bx + boardW - 6, by + boardH, 2, 16);
      }
      ctx.fillStyle = rgba(shade(p.modernDark, -0.2), 0.92);
      ctx.fillRect(bx - 1, by - 1, boardW + 2, boardH + 2);
      ctx.fillStyle = rgba(neon > 0.15 ? color : p.oldTrim, 0.36);
      ctx.fillRect(bx, by, boardW, 1);
      ctx.fillRect(bx, by + boardH - 1, boardW, 1);
      ctx.save();
      if (neon > 0.12) ctx.globalAlpha = flicker;
      if (vertical) {
        text.split("").forEach((letter, i) => {
          pixelText(ctx, letter, x - 1, by + 4 + i * 7, 1, ink);
        });
        if (neon > 0.12) {
          ctx.fillStyle = rgba(color, 0.35);
          ctx.fillRect(bx + boardW - 2, by + 3, 1, boardH - 5);
        }
      } else {
        const tx = alignCenter ? x - pixelTextWidth(text, scale) / 2 : bx + 3;
        pixelText(ctx, text, tx, by + Math.round((boardH - 5 * scale) / 2), scale, ink);
        if (b.sign === "NIGHT MARKET") {
          pixelText(ctx, "MARKET", x - pixelTextWidth("MARKET", 1) / 2, by + 15, 1, rgba(ink, 0.65));
        }
      }
      ctx.restore();
      if (neon > 0.4) {
        ctx.globalAlpha = 0.3;
        pixelText(ctx, text, (alignCenter ? x - pixelTextWidth(text, scale) / 2 : bx + 3) + 1, by + (vertical ? 5 : Math.round((boardH - 5 * scale) / 2)), scale, color);
        ctx.globalAlpha = 1;
      }
    }

    _drawMist(ctx, p) {
      const mist = ctx.createLinearGradient(0, 212, 0, 348);
      mist.addColorStop(0, rgba(p.haze, 0));
      mist.addColorStop(0.55, rgba(p.haze, p.mistAlpha * 0.6));
      mist.addColorStop(1, rgba(p.haze, p.mistAlpha * 1.65));
      ctx.fillStyle = mist;
      ctx.fillRect(0, 212, W, 138);

      if (p.mistAlpha > 0.05) {
        ctx.save();
        ctx.globalAlpha = p.mistAlpha * 0.62;
        for (let i = 0; i < 4; i++) {
          const y = 302 + i * 9;
          const x = ((this.time * (2.5 + i * 1.4) + i * 240) % (W + 340)) - 170;
          ctx.fillStyle = rgba(p.haze, 0.4);
          ctx.fillRect(x, y, 200 + i * 30, 2);
          ctx.fillRect(x + 30, y + 2, 160, 1);
        }
        ctx.restore();
      }
    }

    // __CITY_METHODS_END__

    _drawWater(ctx, p) {
      // The city drops into the bay as a wobbling, upside-down copy.
      const rc = this.reflCanvas.getContext("2d");
      rc.clearRect(0, 0, W, REFLECT_HEIGHT);
      rc.save();
      rc.translate(0, REFLECT_HEIGHT);
      rc.scale(1, -1);
      rc.drawImage(this.cityCanvas, 0, CITY_BASE - REFLECT_HEIGHT, W, REFLECT_HEIGHT, 0, 0, W, REFLECT_HEIGHT);
      rc.restore();

      const water = ctx.createLinearGradient(0, WATER_TOP, 0, 432);
      water.addColorStop(0, p.waterDeep);
      water.addColorStop(0.18, p.waterTop);
      water.addColorStop(0.64, p.waterMid);
      water.addColorStop(1, p.waterBottom);
      ctx.fillStyle = water;
      ctx.fillRect(0, WATER_TOP, W, 116);
      ctx.fillStyle = p.waterBottom;
      ctx.fillRect(0, 426, W, 6);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, WATER_TOP, W, 110);
      ctx.clip();
      ctx.globalAlpha = p.reflectAlpha;
      for (let sy = 0; sy < REFLECT_HEIGHT; sy += 2) {
        const fade = Math.max(0, 1 - sy / REFLECT_HEIGHT);
        const off = Math.sin(this.time * 0.62 + sy * 0.22) * (1.4 + sy * 0.028) + Math.sin(this.time * 1.7 + sy * 0.4) * 0.8;
        ctx.globalAlpha = p.reflectAlpha * (0.16 + fade * 0.84);
        ctx.drawImage(this.reflCanvas, 0, sy, W, 2, Math.round(off), WATER_TOP + 2 + sy, W, 2);
      }
      ctx.globalAlpha = 1;

      // A wash of water colour pulls the reflection into the bay.
      const wash = ctx.createLinearGradient(0, WATER_TOP, 0, 430);
      wash.addColorStop(0, rgba(p.waterTop, 0.2));
      wash.addColorStop(0.55, rgba(p.waterMid, 0.32));
      wash.addColorStop(1, rgba(p.waterDeep, 0.52));
      ctx.fillStyle = wash;
      ctx.fillRect(0, WATER_TOP, W, 112);

      this._drawSunPath(ctx, p);
      this._drawRipples(ctx, p);
      this._drawLampReflections(ctx, p);

      // Low, slow harbour mist.
      ctx.globalAlpha = p.mistAlpha * 0.6;
      for (let i = 0; i < 3; i++) {
        const x = ((this.time * (3 + i) + i * 370) % (W + 260)) - 130;
        ctx.fillStyle = rgba(p.mistAlpha > 0.1 ? p.skyLow : p.waterLine, 0.3);
        ctx.fillRect(x, 333 + i * 8, 180 + i * 50, 2);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      this._drawBoats(ctx, p);

      const shoreLine = ctx.createLinearGradient(0, 320, 0, 336);
      shoreLine.addColorStop(0, rgba(p.haze, 0.35));
      shoreLine.addColorStop(1, rgba(p.waterLine, 0));
      ctx.fillStyle = shoreLine;
      ctx.fillRect(0, 320, W, 16);
    }

    _drawSunPath(ctx, p) {
      const cx = p.sunX;
      const intensity = p.starAlpha > 0.4 ? 0.7 : 0.9;
      for (let y = 324; y < 425; y += 3) {
        const t = (y - 320) / 106;
        const spread = 6 + t * t * 38;
        const alpha = intensity * (0.18 + t * 0.22) * (0.7 + Math.sin(y * 0.55 + this.time * 1.6) * 0.3);
        const x = cx + Math.sin(this.time * 0.9 + y * 0.2) * (2 + t * 7) + Math.sin(y * 0.27) * 4;
        ctx.fillStyle = rgba(p.glint, alpha);
        ctx.fillRect(Math.round(x - spread), y, Math.round(spread * (0.8 + Math.sin(y) * 0.25)), 1);
        if (y % 9 === 0) {
          ctx.fillStyle = rgba(p.glint, alpha * 1.2);
          ctx.fillRect(Math.round(x - spread * 0.15), y, Math.round(spread * 0.3), 1);
        }
      }
    }

    _drawRipples(ctx, p) {
      for (const r of this.ripples) {
        const x = ((r.x + this.time * r.speed) % (W + 40) + W + 40) % (W + 40) - 20;
        const y = r.y + Math.sin(this.time * 0.8 + r.phase) * 1.5;
        const a = r.alpha * p.rippleAlpha * (0.5 + Math.sin(this.time * 1.1 + r.phase) * 0.5);
        ctx.fillStyle = rgba(r.tint > 0.72 ? p.glint : p.waterLine, a);
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(r.len), 1);
        if (r.len > 14) ctx.fillRect(Math.round(x + 6), Math.round(y + 2), Math.round(r.len * 0.5), 1);
      }
      // Sparkling highlights gathered around the sun path.
      for (let i = 0; i < 18; i++) {
        const t = i / 18;
        const y = 329 + t * 89 + Math.sin(this.time * 1.4 + i * 2.1) * 1.5;
        const x = p.sunX + Math.sin(i * 7.7 + this.time * 0.45) * (8 + t * 45);
        const a = (0.25 + Math.sin(this.time * 2 + i) * 0.2) * p.rippleAlpha;
        ctx.fillStyle = rgba(p.glint, Math.max(0, a));
        ctx.fillRect(Math.round(x), Math.round(y), 2 + (i % 4), 1);
      }
    }

    _drawLampReflections(ctx, p) {
      for (const x of this.bridgeLamps) {
        for (let y = 403; y < 426; y += 4) {
          const wobble = Math.sin(this.time * 1.1 + y * 0.3 + x) * 2;
          const a = p.lampAlpha * 0.24 * (1 - (y - 403) / 28);
          ctx.fillStyle = rgba(p.lamp, a);
          ctx.fillRect(Math.round(x + wobble - (y % 8 === 0 ? 2 : 1)), y, 4, 1);
        }
      }
    }

    _drawBoats(ctx, p) {
      for (const boat of this.farBoats) {
        boat.x += boat.dir * boat.speed * 0.016;
        if (boat.x > W + 20) boat.x = -20;
        if (boat.x < -20) boat.x = W + 20;
        const bob = Math.sin(this.time * 1.2 + boat.x * 0.02) * 1.2;
        const x = Math.round(boat.x);
        const y = Math.round(boat.y + bob);
        const s = boat.scale;
        ctx.fillStyle = p.oldTrim;
        ctx.fillRect(x - 9 * s, y, 17 * s, 2 * s);
        ctx.fillRect(x - 6 * s, y + 2 * s, 12 * s, 1);
        if (!this.reducedMotion) {
          ctx.fillStyle = rgba(p.waterLine, 0.45);
          ctx.fillRect(x - 12 * s, y + 4 * s, 20 * s, 1);
        }
        ctx.fillStyle = rgba(p.oldWallLit, 0.9);
        pixelLine(ctx, x, y, x, y - 10 * s, p.oldTrim, 1);
        ctx.fillStyle = rgba(p.oldWallLit, 0.72);
        ctx.beginPath();
        ctx.moveTo(x + 1, y - 9 * s);
        ctx.lineTo(x + 1, y - 2 * s);
        ctx.lineTo(x + 7 * s, y - 3 * s);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = p.windowOff;
        ctx.fillRect(x - 2 * s, y - 5 * s, 2, 2 * s);
        if (p.lampAlpha > 0.4) {
          ctx.fillStyle = rgba(p.lamp, 0.85);
          ctx.fillRect(x - 1, y - 7 * s, 1, 1);
          glow(ctx, x, y - 7 * s, 8 * s, p.lamp, p.lampAlpha * 0.15, 0.2);
        }
      }
    }

    // __WATER_METHODS_END__

    _drawBridge(ctx, p) {
      const bc = this.bridgeCanvas.getContext("2d");
      bc.clearRect(0, 0, W, H);
      const x0 = -20;
      const x1 = W + 20;
      const deckTop = 350;
      const deckBase = 372;
      const bodyBottom = 402;
      const arches = [120, 300, 480, 660, 840];
      const half = 62;
      const spring = 396;
      const arcTop = 375;
      const vrad = spring - arcTop;

      // The stone mass.
      const stone = bc.createLinearGradient(0, deckBase, 0, bodyBottom);
      stone.addColorStop(0, p.bridgeLight);
      stone.addColorStop(0.18, p.bridge);
      stone.addColorStop(1, p.bridgeDark);
      bc.fillStyle = stone;
      bc.fillRect(x0, deckBase, x1 - x0, bodyBottom - deckBase);

      // Block courses.
      bc.globalAlpha = 0.32;
      for (let y = deckBase + 7; y < bodyBottom; y += 8) {
        bc.fillStyle = p.bridgeTrim;
        bc.fillRect(x0, y, x1 - x0, 1);
        for (let x = x0 + ((y / 8) % 2 ? 6 : 0); x < x1; x += 19) {
          bc.fillRect(x, y - 6, 1, 6);
        }
      }
      bc.globalAlpha = 1;

      // Carve the five elliptical arches from the stone.
      bc.globalCompositeOperation = "destination-out";
      for (const cx of arches) {
        for (let y = arcTop; y < bodyBottom; y += 2) {
          let w = half;
          if (y < spring) {
            const dy = (spring - y) / vrad;
            w = half * Math.sqrt(Math.max(0, 1 - dy * dy));
          }
          bc.fillRect(Math.round(cx - w), y, Math.round(w * 2), 2);
        }
      }
      bc.globalCompositeOperation = "source-over";

      // Arch voussoirs and keystones.
      for (const cx of arches) {
        for (let y = arcTop; y < spring; y += 2) {
          const dy = (spring - y) / vrad;
          const w = half * Math.sqrt(Math.max(0, 1 - dy * dy));
          bc.fillStyle = y < arcTop + 4 ? p.bridgeLight : rgba(p.bridgeLight, 0.55);
          bc.fillRect(Math.round(cx - w - 2), y, 3, 2);
          bc.fillRect(Math.round(cx + w - 1), y, 3, 2);
        }
        bc.fillStyle = p.bridgeLight;
        bc.fillRect(Math.round(cx - 5), arcTop, 10, 7);
        bc.fillStyle = rgba(p.bridgeTrim, 0.42);
        bc.fillRect(Math.round(cx - 4), arcTop + 3, 8, 1);
        bc.fillStyle = rgba(p.bridgeLight, 0.24);
        bc.fillRect(Math.round(cx - half), spring, 2, bodyBottom - spring);
        bc.fillRect(Math.round(cx + half - 2), spring, 2, bodyBottom - spring);
      }

      // Stone parapet.
      bc.fillStyle = p.bridgeDark;
      bc.fillRect(x0, deckTop, x1 - x0, 11);
      bc.fillStyle = p.bridge;
      bc.fillRect(x0, deckTop, x1 - x0, 8);
      bc.fillStyle = p.bridgeLight;
      bc.fillRect(x0, deckTop, x1 - x0, 2);
      bc.fillStyle = p.bridgeTrim;
      bc.fillRect(x0, deckTop + 8, x1 - x0, 3);
      bc.fillStyle = p.bridge;
      bc.fillRect(x0, deckTop - 13, x1 - x0, 5);
      bc.fillStyle = p.bridgeLight;
      bc.fillRect(x0, deckTop - 13, x1 - x0, 1);
      bc.fillStyle = rgba(p.bridgeDark, 0.7);
      bc.fillRect(x0, deckTop - 8, x1 - x0, 1);

      // Balusters. Slightly irregular spacing keeps it hand-placed.
      for (let x = 0; x < W; x += 10) {
        const h = 10 + (x % 3 === 0 ? 2 : 0);
        bc.fillStyle = rgba(p.bridgeDark, 0.8);
        bc.fillRect(x + 2, deckTop - 13 + h, 2, 13 - h);
        bc.fillStyle = rgba(p.bridge, 0.85);
        bc.fillRect(x + 2, deckTop - 12 + h, 1, 12 - h);
      }
      // Larger pier caps.
      for (let x = 44; x < W; x += 102) {
        bc.fillStyle = p.bridgeDark;
        bc.fillRect(x, deckTop - 21, 7, 11);
        bc.fillStyle = p.bridgeLight;
        bc.fillRect(x + 1, deckTop - 21, 5, 2);
        bc.fillStyle = rgba(p.bridgeTrim, 0.55);
        bc.fillRect(x + 1, deckTop - 14, 5, 2);
      }

      // Deck road and its worn edge.
      const road = bc.createLinearGradient(0, deckTop + 10, 0, deckBase + 3);
      road.addColorStop(0, mixHex(p.bridgeTrim, p.bridge, 0.34));
      road.addColorStop(1, p.bridge);
      bc.fillStyle = road;
      bc.fillRect(x0, deckTop + 10, x1 - x0, 13);
      bc.fillStyle = rgba(p.bridgeLight, 0.55);
      bc.fillRect(x0, deckTop + 10, x1 - x0, 1);
      bc.fillStyle = rgba(p.bridgeTrim, 0.36);
      for (let x = 0; x < W; x += 23) bc.fillRect(x, deckTop + 14, 10, 1);

      // A central decorative rail plaque.
      for (let px = 224; px < 830; px += 205) {
        bc.fillStyle = rgba(p.bridgeDark, 0.7);
        bc.fillRect(px, deckTop + 16, 17, 4);
        bc.fillStyle = rgba(p.bridgeLight, 0.4);
        bc.fillRect(px + 3, deckTop + 17, 11, 1);
      }

      // Lampposts.
      for (const lx of this.bridgeLamps) {
        const baseY = deckTop - 8;
        const topY = baseY - 35;
        bc.fillStyle = p.bridgeTrim;
        bc.fillRect(lx - 2, baseY - 2, 5, 3);
        bc.fillRect(lx - 1, topY + 7, 2, 27);
        bc.fillRect(lx - 4, topY + 8, 9, 2);
        bc.fillRect(lx - 5, topY + 10, 2, 2);
        bc.fillRect(lx + 4, topY + 10, 2, 2);
        bc.fillStyle = rgba(p.bridgeLight, 0.5);
        bc.fillRect(lx, topY + 10, 1, 24);
        bc.fillStyle = p.bridgeDark;
        bc.fillRect(lx - 4, topY, 9, 10);
        bc.fillStyle = p.lamp;
        bc.fillRect(lx - 3, topY + 2, 7, 6);
        bc.fillStyle = rgba(p.lampGlow, 0.9);
        bc.fillRect(lx - 2, topY + 3, 5, 4);
        bc.fillStyle = p.bridgeLight;
        bc.fillRect(lx - 4, topY + 8, 9, 1);
      }

      // Two small pennants catch the wind above the parapet.
      for (let i = 0; i < 8; i++) {
        const fx = 74 + i * 112;
        const wave = Math.sin(this.time * 2 + i) * 1.8;
        bc.fillStyle = i % 2 ? rgba(p.neon2, 0.5 + p.neonAlpha * 0.3) : rgba(p.oldRoofLit, 0.52);
        bc.fillRect(Math.round(fx + wave), deckTop - 29, 6, 3);
        bc.fillRect(Math.round(fx + wave), deckTop - 26, 3, 1);
      }

      ctx.drawImage(this.bridgeCanvas, 0, 0);

      // A broken reflection stitches the bridge into the near water.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, bodyBottom, W, 24);
      ctx.clip();
      const bridgeReflection = ctx.createLinearGradient(0, bodyBottom, 0, 426);
      bridgeReflection.addColorStop(0, rgba(p.bridgeDark, 0.34));
      bridgeReflection.addColorStop(0.55, rgba(p.bridgeDark, 0.14));
      bridgeReflection.addColorStop(1, rgba(p.bridgeDark, 0));
      ctx.fillStyle = bridgeReflection;
      ctx.fillRect(0, bodyBottom, W, 24);
      for (let y = bodyBottom + 1; y < 426; y += 3) {
        const off = Math.sin(this.time * 0.9 + y * 0.55) * 2 + Math.sin(this.time * 0.4 + y) * 1;
        ctx.fillStyle = rgba(p.bridge, 0.1 + (426 - y) * 0.004);
        ctx.fillRect(Math.round(off), y, W, 1);
      }
      ctx.restore();

      // Lamp glows sit in front of the stone, like real haloes in the mist.
      const lampLightY = deckTop - 38;
      for (const lx of this.bridgeLamps) {
        if (p.lampAlpha <= 0.04) continue;
        glow(ctx, lx, lampLightY, 44, p.lampGlow, p.lampAlpha * 0.34, 0.18);
        glow(ctx, lx, lampLightY, 13, p.lamp, p.lampAlpha * 0.5, 0.2);
        ctx.fillStyle = rgba(p.lampGlow, p.lampAlpha * 0.06);
        ctx.fillRect(lx - 20, deckTop + 11, 40, 2);
        // Hanging reflection of the lamp on the deck.
        ctx.fillStyle = rgba(p.lamp, p.lampAlpha * 0.08);
        ctx.fillRect(lx - 7, deckTop + 12, 14, 16);
      }

      // Tiny pedestrians on the bridge, far below the scale of the quay.
      for (const walker of this.bridgeWalkers) {
        let wx = walker.x;
        if (wx < 25) wx = 25;
        if (wx > W - 25) wx = W - 25;
        const step = Math.sin(this.time * 5 + walker.phase) > 0 ? 1 : 0;
        const by = deckTop - 12;
        const small = p.modernDark;
        ctx.fillStyle = rgba(p.bridgeDark, 0.8);
        ctx.fillRect(Math.round(wx) - 3, by + 10, 7, 1);
        ctx.fillStyle = walker.coat;
        ctx.fillRect(Math.round(wx) - 1, by + 3, 3, 5);
        ctx.fillStyle = p.skin || "#d0a37d";
        ctx.fillRect(Math.round(wx), by, 2, 2);
        ctx.fillStyle = p.bridgeTrim;
        ctx.fillRect(Math.round(wx) - 2, by + 8, 2, 2 + step);
        ctx.fillRect(Math.round(wx) + 1, by + 8 + step, 2, 2);
        if (p.neonAlpha > 0.3) {
          ctx.fillStyle = rgba(p.windowWarm, 0.65);
          ctx.fillRect(Math.round(wx) - 1, by + 4, 1, 1);
        }
      }
    }

    // __BRIDGE_METHODS_END__

    _drawQuay(ctx, p) {
      const top = QUAY_TOP;

      // Sloping stone wall facing the water.
      const wall = ctx.createLinearGradient(0, top, 0, top + 22);
      wall.addColorStop(0, p.quayLight);
      wall.addColorStop(0.28, p.quay);
      wall.addColorStop(1, p.quayDark);
      ctx.fillStyle = wall;
      ctx.fillRect(0, top, W, 22);
      ctx.fillStyle = rgba(p.quayLight, 0.7);
      ctx.fillRect(0, top, W, 2);
      ctx.fillStyle = rgba(p.quayJoint, 0.54);
      for (let x = 0; x < W; x += 38) {
        ctx.fillRect(x, top + 4, 1, 16);
        ctx.fillRect(x + 12, top + 11, 18, 1);
      }
      ctx.fillStyle = rgba(p.treeDark, 0.28);
      ctx.fillRect(0, top + 12, W, 1);

      // Pavement.
      const ground = ctx.createLinearGradient(0, top + 18, 0, H);
      ground.addColorStop(0, p.quay);
      ground.addColorStop(0.46, mixHex(p.quay, p.quayLight, 0.18));
      ground.addColorStop(1, p.quayDark);
      ctx.fillStyle = ground;
      ctx.fillRect(0, top + 19, W, H - top - 19);

      // Perspective joints and paving stones.
      const rows = [449, 468, 491, 517];
      ctx.fillStyle = rgba(p.quayJoint, 0.38);
      for (const y of rows) {
        ctx.fillRect(0, y, W, 1);
        if (y !== rows[rows.length - 1]) {
          ctx.fillStyle = rgba(p.quayLight, 0.09);
          ctx.fillRect(0, y + 1, W, 1);
          ctx.fillStyle = rgba(p.quayJoint, 0.38);
        }
      }
      for (let i = 0; i < rows.length; i++) {
        const y = i === 0 ? 438 : rows[i - 1];
        const y2 = rows[i];
        const shift = i % 2 ? 34 : 0;
        for (let x = -20 + shift; x < W + 40; x += 61 + i * 8) {
          const bottomX = x + Math.round((x - W / 2) * 0.022);
          pixelLine(ctx, x, y, bottomX, y2, rgba(p.quayJoint, 0.2), 1);
        }
      }
      const foreground = ctx.createLinearGradient(0, 485, 0, H);
      foreground.addColorStop(0, rgba(p.quayDark, 0));
      foreground.addColorStop(1, rgba(p.quayDark, 0.42));
      ctx.fillStyle = foreground;
      ctx.fillRect(0, 480, W, H - 480);

      // A few cracked stones, moss and a brass drain.
      const rng = mulberry32(0x9873);
      for (let i = 0; i < 30; i++) {
        const x = 210 + rng() * 590;
        const y = 447 + rng() * 80;
        ctx.fillStyle = rgba(i % 5 ? p.quayJoint : p.treeDark, 0.22);
        ctx.fillRect(Math.round(x), Math.round(y), 2 + (i % 4), 1);
      }
      ctx.fillStyle = rgba(p.quayJoint, 0.6);
      ctx.fillRect(524, 504, 18, 5);
      ctx.fillRect(526, 502, 14, 2);
      ctx.fillStyle = rgba(p.quayLight, 0.25);
      for (let i = 0; i < 4; i++) ctx.fillRect(526, 503 + i * 2, 14, 1);

      this._drawRailing(ctx, p);
    }

    _drawRailing(ctx, p) {
      const y = 424;
      ctx.fillStyle = rgba(p.quayJoint, 0.75);
      ctx.fillRect(0, y + 12, W, 2);
      ctx.fillStyle = rgba(p.quayLight, 0.24);
      ctx.fillRect(0, y + 11, W, 1);

      // Wrought-iron uprights.
      for (let x = 12; x < W; x += 24) {
        ctx.fillStyle = rgba(p.quayJoint, 0.64);
        ctx.fillRect(x, y - 1, 1, 13);
        if (x % 48 === 12) {
          ctx.fillRect(x + 4, y + 3, 1, 7);
          ctx.fillRect(x + 7, y + 4, 1, 6);
        }
      }
      ctx.fillStyle = rgba(p.quayJoint, 0.74);
      ctx.fillRect(0, y, W, 2);
      ctx.fillStyle = rgba(p.quayLight, 0.38);
      ctx.fillRect(0, y - 1, W, 1);
      ctx.fillRect(0, y + 8, W, 1);

      // Practical bollards at the stair opening.
      for (const bx of [206, 784]) {
        ctx.fillStyle = rgba(p.quayJoint, 0.85);
        ctx.fillRect(bx, y + 1, 5, 10);
        ctx.fillStyle = rgba(p.quayLight, 0.35);
        ctx.fillRect(bx + 1, y + 2, 1, 7);
        ctx.fillStyle = rgba(p.quayJoint, 0.9);
        ctx.fillRect(bx - 1, y, 7, 2);
      }
    }

    _drawCafe(ctx, p) {
      const c = this.cafe;
      const x = c.x;
      const base = c.y;
      const w = c.w;
      const top = base - c.h;
      const light = p.lightDir;
      const plaster = mixHex(p.oldWall, p.oldWallLit, 0.22);
      const plasterDark = mixHex(p.oldWallDark, p.oldWall, 0.2);
      const teal = mixHex(p.oldTrim, p.treeDark, 0.4);

      // Long early-morning / late-evening shadow on the pavement.
      ctx.save();
      ctx.fillStyle = rgba(p.shadowColor, p.shadowAlpha * 0.66);
      const dir = light < 0 ? 1 : -1;
      for (let i = 0; i < 12; i++) {
        const sx = x + w + dir * (i * 8);
        const sw = 22 - i * 1.2;
        if (sw <= 0) break;
        ctx.fillRect(Math.round(Math.min(sx, sx + sw)), base + 9 + i, Math.round(Math.abs(sw)), 3);
      }
      ctx.restore();

      // Chimney and roof.
      ctx.fillStyle = plasterDark;
      ctx.fillRect(x + 33, top - 33, 12, 48);
      ctx.fillStyle = p.oldRoofLit;
      ctx.fillRect(x + 31, top - 36, 16, 4);
      ctx.fillStyle = rgba(p.oldTrim, 0.65);
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 34, top - 30 + i * 9, 10, 1);

      for (let yy = 0; yy < 42; yy += 2) {
        const t = yy / 42;
        const half = Math.round(lerp(71, 109, t));
        const cx = x + 83;
        ctx.fillStyle = yy % 8 === 0 ? p.oldRoof : p.oldRoofLit;
        ctx.fillRect(Math.round(cx - half), top + yy, half * 2, 2);
        if (yy % 6 === 0) {
          ctx.fillStyle = rgba(p.oldTrim, 0.42);
          ctx.fillRect(Math.round(cx - half + 5), top + yy, half * 2 - 10, 1);
        }
      }
      ctx.fillStyle = p.oldTrim;
      ctx.fillRect(x - 6, top + 40, w + 12, 4);
      ctx.fillStyle = rgba(p.oldRoofLit, 0.42);
      ctx.fillRect(x - 6, top + 40, w + 12, 1);

      // Main facade.
      ctx.fillStyle = plasterDark;
      ctx.fillRect(x, top + 44, w, 160);
      ctx.fillStyle = plaster;
      ctx.fillRect(x, top + 44, w - 3, 157);
      ctx.fillStyle = rgba(light < 0 ? p.oldWallLit : p.oldWallDark, 0.25);
      ctx.fillRect(light < 0 ? x : x + w - 4, top + 44, 4, 157);
      ctx.fillStyle = rgba(p.oldWallDark, 0.3);
      ctx.fillRect(x, top + 44, w, 1);

      // Exposed timber frame and a whitewashed upper band.
      ctx.fillStyle = rgba(p.oldTrim, 0.8);
      ctx.fillRect(x, top + 94, w, 2);
      for (let bx = x + 8; bx < x + w; bx += 48) ctx.fillRect(bx, top + 46, 2, 111);
      ctx.fillStyle = rgba(p.oldWallLit, 0.18);
      ctx.fillRect(x, top + 46, w, 44);

      // Upper windows.
      const windows = [
        { x: x + 18, y: top + 55, w: 34, h: 31, lit: p.litFrac > 0.04 },
        { x: x + 82, y: top + 55, w: 34, h: 31, lit: p.litFrac > 0.55 },
        { x: x + 144, y: top + 55, w: 30, h: 31, lit: p.litFrac > 0.24 }
      ];
      for (const win of windows) {
        ctx.fillStyle = p.oldTrim;
        ctx.fillRect(win.x - 2, win.y - 2, win.w + 4, win.h + 4);
        ctx.fillStyle = win.lit ? p.windowWarm : p.windowOff;
        ctx.fillRect(win.x, win.y, win.w, win.h);
        ctx.fillStyle = rgba(p.windowCool, win.lit ? 0.2 : 0.32);
        ctx.fillRect(win.x + 2, win.y + 2, win.w - 4, 8);
        ctx.fillStyle = rgba(p.oldTrim, 0.75);
        ctx.fillRect(win.x + Math.floor(win.w / 2), win.y, 1, win.h);
        ctx.fillRect(win.x, win.y + Math.floor(win.h / 2), win.w, 1);
        ctx.fillStyle = teal;
        ctx.fillRect(win.x - 6, win.y, 4, win.h);
        ctx.fillRect(win.x + win.w + 2, win.y, 4, win.h);
        ctx.fillStyle = rgba(p.treeDark, 0.9);
        ctx.fillRect(win.x - 2, win.y + win.h + 3, win.w + 4, 4);
        ctx.fillStyle = p.neon2;
        ctx.fillRect(win.x + 3, win.y + win.h + 1, 2, 2);
        ctx.fillRect(win.x + 13, win.y + win.h + 2, 2, 1);
        ctx.fillStyle = p.treeMid;
        ctx.fillRect(win.x + 7, win.y + win.h + 1, 2, 1);
        if (win.lit) glow(ctx, win.x + win.w / 2, win.y + win.h / 2, 34, p.windowWarm, p.windowGlowAlpha * 0.13, 0.45);
      }

      // Hand-painted sign, which becomes a cyan neon at night.
      const sx = x + 21;
      const sy = top + 104;
      const sw = 146;
      ctx.fillStyle = rgba(p.oldTrim, 0.9);
      ctx.fillRect(sx, sy, sw, 33);
      ctx.fillStyle = p.oldRoof;
      ctx.fillRect(sx + 2, sy + 2, sw - 4, 28);
      ctx.fillStyle = rgba(p.oldWallLit, 0.36);
      ctx.fillRect(sx + 4, sy + 4, sw - 8, 1);
      if (p.neonAlpha > 0.15) {
        glow(ctx, sx + sw / 2, sy + 16, 90, p.neon2, p.neonAlpha * 0.28, 0.2);
      }
      pixelText(ctx, "TIDE CAFE", sx + Math.round((sw - pixelTextWidth("TIDE CAFE", 2)) / 2), sy + 10, 2, p.neonAlpha > 0.2 ? p.neon2 : p.windowWarm);
      ctx.fillStyle = rgba(p.oldWallLit, 0.5);
      ctx.fillRect(sx + 18, sy + 26, 14, 1);
      ctx.fillRect(sx + 36, sy + 26, 8, 1);
      ctx.fillRect(sx + sw - 30, sy + 26, 12, 1);

      // Striped awning.
      const ay = top + 141;
      ctx.fillStyle = rgba(p.oldTrim, 0.9);
      ctx.fillRect(x + 8, ay, w - 10, 4);
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = i % 2 ? p.oldRoof : p.oldWallLit;
        ctx.fillRect(x + 10 + i * 14, ay + 3, 14, 14);
        ctx.fillStyle = rgba(p.oldWallDark, i % 2 ? 0.2 : 0.08);
        ctx.fillRect(x + 10 + i * 14, ay + 15, 14, 2);
      }
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = p.oldRoof;
        ctx.fillRect(x + 11 + i * 28, ay + 17, 8, 3);
      }
      ctx.fillStyle = rgba(p.shadowColor, 0.25);
      ctx.fillRect(x + 10, ay + 20, w - 14, 4);

      // Ground floor: warm windows, open door, hand-pulled espresso counter.
      const gy = ay + 30;
      ctx.fillStyle = p.oldTrim;
      ctx.fillRect(x + 6, gy - 3, 174, 58);
      ctx.fillStyle = mixHex(p.windowOff, p.windowWarm, 0.16 + p.windowGlowAlpha * 0.24);
      ctx.fillRect(x + 10, gy, 104, 45);
      ctx.fillStyle = rgba(p.oldTrim, 0.75);
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 32 + i * 26, gy, 1, 45);
      ctx.fillRect(x + 10, gy + 22, 104, 1);
      ctx.fillStyle = p.windowWarm;
      ctx.fillRect(x + 12, gy + 3, 100, 16);
      ctx.fillStyle = rgba(p.windowCool, 0.26);
      ctx.fillRect(x + 12, gy + 3, 100, 3);
      // A tiny counter and hanging lamps inside the big glass.
      ctx.fillStyle = rgba(p.oldTrim, 0.74);
      ctx.fillRect(x + 30, gy + 27, 48, 8);
      ctx.fillRect(x + 36, gy + 35, 2, 8);
      ctx.fillRect(x + 68, gy + 35, 2, 8);
      ctx.fillStyle = p.windowCool;
      ctx.fillRect(x + 53, gy + 27, 2, 3);
      ctx.fillRect(x + 57, gy + 27, 2, 3);
      ctx.fillStyle = rgba(p.oldTrim, 0.7);
      pixelLine(ctx, x + 38, gy + 3, x + 38, gy + 9, p.oldTrim, 1);
      pixelLine(ctx, x + 74, gy + 3, x + 74, gy + 8, p.oldTrim, 1);
      glow(ctx, x + 38, gy + 9, 10, p.windowWarm, 0.3, 0.3);
      glow(ctx, x + 74, gy + 9, 10, p.windowWarm, 0.26, 0.3);

      // Door.
      ctx.fillStyle = p.oldTrim;
      ctx.fillRect(x + 128, gy - 4, 35, 58);
      ctx.fillStyle = mixHex(p.windowWarm, p.oldRoof, 0.45 + p.neonAlpha * 0.2);
      ctx.fillRect(x + 131, gy, 29, 54);
      ctx.fillStyle = rgba(p.windowWarm, 0.65);
      ctx.fillRect(x + 133, gy + 4, 25, 20);
      ctx.fillStyle = rgba(p.oldTrim, 0.45);
      ctx.fillRect(x + 133, gy + 26, 25, 1);
      ctx.fillStyle = rgba(p.oldTrim, 0.7);
      ctx.fillRect(x + 142, gy + 6, 1, 48);
      ctx.fillStyle = p.lamp;
      ctx.fillRect(x + 156, gy + 26, 1, 2);
      ctx.fillStyle = rgba(p.oldTrim, 0.42);
      ctx.fillRect(x + 129, gy - 6, 33, 2);

      if (p.windowGlowAlpha > 0.35) {
        glow(ctx, x + 58, gy + 18, 72, p.windowWarm, p.windowGlowAlpha * 0.18, 0.4);
        glow(ctx, x + 144, gy + 24, 38, p.windowWarm, p.windowGlowAlpha * 0.2, 0.35);
      }
      // Window flower boxes, a cat, a bicycle basket's worth of details.
      ctx.fillStyle = p.treeDark;
      ctx.fillRect(x + w - 30, top + 86, 18, 4);
      ctx.fillStyle = p.neon3;
      ctx.fillRect(x + w - 25, top + 84, 2, 2);
      ctx.fillRect(x + w - 19, top + 84, 2, 2);
      ctx.fillStyle = p.windowOff;
      ctx.fillRect(x + 114, gy + 13, 4, 5);
      ctx.fillRect(x + 117, gy + 11, 3, 3);
      ctx.fillRect(x + 120, gy + 13, 1, 2);
      ctx.fillStyle = p.windowWarm;
      ctx.fillRect(x + 118, gy + 13, 1, 1);

      // Wall base and climbing ivy.
      ctx.fillStyle = rgba(p.oldTrim, 0.68);
      ctx.fillRect(x, base - 6, w, 7);
      ctx.fillStyle = p.treeDark;
      for (let i = 0; i < 24; i++) {
        const vx = x + 8 + hash(i * 3.7) * 20;
        const vy = top + 60 + hash(i * 9.3) * 80;
        ctx.fillRect(Math.round(vx), Math.round(vy), 1, 2);
        if (i % 4 === 0) ctx.fillRect(Math.round(vx) + 1, Math.round(vy) - 1, 2, 1);
      }
    }

    _drawRightHouse(ctx, p) {
      const h = this.rightHouse;
      const x = h.x;
      const base = h.y;
      const w = h.w;
      const top = base - h.h;
      const lit = p.lightDir;
      const brick = mixHex(p.oldWall, p.oldRoof, 0.3);
      const brickDark = mixHex(p.oldWallDark, p.oldRoof, 0.2);

      // The tree in front will partially veil this house.
      ctx.fillStyle = brickDark;
      ctx.fillRect(x, top + 21, w, base - top);
      ctx.fillStyle = brick;
      ctx.fillRect(x + 2, top + 23, w - 3, base - top - 23);
      ctx.fillStyle = rgba(lit < 0 ? p.oldWallLit : p.oldWallDark, 0.24);
      ctx.fillRect(lit < 0 ? x + 2 : x + w - 6, top + 23, 4, base - top - 23);

      // Brick coursing.
      ctx.fillStyle = rgba(p.oldTrim, 0.18);
      for (let yy = top + 32; yy < base - 5; yy += 7) {
        ctx.fillRect(x + 3, yy, w - 6, 1);
        for (let xx = x + 5 + (yy % 14); xx < x + w - 3; xx += 14) {
          ctx.fillRect(xx, yy - 4, 1, 4);
        }
      }

      // Flat roof, parapet and water tank.
      ctx.fillStyle = p.oldTrim;
      ctx.fillRect(x - 3, top + 17, w + 6, 5);
      ctx.fillStyle = rgba(p.oldWallLit, 0.6);
      ctx.fillRect(x - 3, top + 17, w + 6, 1);
      ctx.fillStyle = brickDark;
      ctx.fillRect(x + 6, top - 4, 20, 22);
      ctx.fillStyle = p.oldRoof;
      ctx.fillRect(x + 5, top - 5, 22, 3);
      pixelLine(ctx, x + 11, top - 4, x + 11, top + 13, rgba(p.oldTrim, 0.7), 1);
      pixelLine(ctx, x + 21, top - 4, x + 21, top + 13, rgba(p.oldTrim, 0.7), 1);
      ctx.fillStyle = rgba(p.treeDark, 0.9);
      ctx.fillRect(x + 107, top + 12, 14, 5);
      ctx.fillRect(x + 110, top + 8, 3, 5);
      ctx.fillRect(x + 116, top + 7, 2, 6);

      // Windows, each with a dark frame and warm interior.
      const winRows = [top + 44, top + 91, top + 138];
      for (let r = 0; r < winRows.length; r++) {
        for (let c = 0; c < 2; c++) {
          const wx = x + 20 + c * 51;
          const wy = winRows[r];
          const winLit = ((r * 2 + c + h.seed) % 3) < (p.litFrac > 0.3 ? 3 : 1);
          ctx.fillStyle = p.oldTrim;
          ctx.fillRect(wx - 2, wy - 2, 27, 27);
          ctx.fillStyle = winLit ? p.windowWarm : p.windowOff;
          ctx.fillRect(wx, wy, 23, 23);
          ctx.fillStyle = rgba(p.windowCool, winLit ? 0.22 : 0.35);
          ctx.fillRect(wx + 1, wy + 1, 21, 6);
          ctx.fillStyle = rgba(p.oldTrim, 0.75);
          ctx.fillRect(wx + 11, wy, 1, 23);
          ctx.fillRect(wx, wy + 11, 23, 1);
          if (winLit) {
            ctx.fillStyle = rgba(p.oldTrim, 0.5);
            ctx.fillRect(wx + 4, wy + 13, 5, 6);
            ctx.fillRect(wx + 16, wy + 14, 3, 5);
            glow(ctx, wx + 12, wy + 12, 23, p.windowWarm, p.windowGlowAlpha * 0.13, 0.35);
          }
          ctx.fillStyle = rgba(p.quayJoint, 0.5);
          ctx.fillRect(wx - 4, wy - 4, 31, 2);
        }
      }

      // Fire escape lace-work on the far side.
      ctx.fillStyle = rgba(p.oldTrim, 0.7);
      for (let i = 0; i < 3; i++) {
        const fy = top + 77 + i * 47;
        ctx.fillRect(x + 97, fy, 23, 2);
        ctx.fillRect(x + 97, fy, 1, 47);
        ctx.fillRect(x + 119, fy, 1, 47);
        for (let xx = x + 101; xx < x + 118; xx += 5) ctx.fillRect(xx, fy, 1, 13);
      }
      pixelLine(ctx, x + 97, top + 78, x + 85, top + 76, rgba(p.oldTrim, 0.6), 1);
      pixelLine(ctx, x + 97, top + 126, x + 82, top + 123, rgba(p.oldTrim, 0.6), 1);

      // Ground-floor bar.
      const gy = top + 164;
      ctx.fillStyle = p.oldTrim;
      ctx.fillRect(x - 1, gy - 2, w + 1, 31);
      ctx.fillStyle = mixHex(p.windowWarm, p.windowOff, 0.25 + (1 - p.windowGlowAlpha) * 0.15);
      ctx.fillRect(x + 3, gy, w - 8, 27);
      ctx.fillStyle = p.windowWarm;
      ctx.fillRect(x + 7, gy + 3, w - 16, 13);
      ctx.fillStyle = rgba(p.oldTrim, 0.78);
      for (let i = 0; i < 6; i++) ctx.fillRect(x + 12 + i * 16, gy + 2, 1, 23);
      ctx.fillRect(x + 4, gy + 17, w - 10, 1);
      ctx.fillStyle = rgba(p.oldTrim, 0.8);
      ctx.fillRect(x + 35, gy + 17, 25, 3);

      // A vertical bar sign, legible as neon at night.
      ctx.fillStyle = rgba(p.oldTrim, 0.8);
      ctx.fillRect(x + 6, top + 26, 10, 33);
      if (p.neonAlpha > 0.1) glow(ctx, x + 11, top + 42, 38, p.neon1, p.neonAlpha * 0.32, 0.2);
      pixelText(ctx, "B", x + 9, top + 31, 1, p.neonAlpha > 0.15 ? p.neon1 : p.windowWarm);
      pixelText(ctx, "A", x + 9, top + 38, 1, p.neonAlpha > 0.15 ? p.neon1 : p.windowWarm);
      pixelText(ctx, "R", x + 9, top + 45, 1, p.neonAlpha > 0.15 ? p.neon1 : p.windowWarm);

      if (p.windowGlowAlpha > 0.4) {
        glow(ctx, x + 35, top + 175, 80, p.windowWarm, p.windowGlowAlpha * 0.2, 0.35);
        glow(ctx, x + 12, top + 43, 22, p.neon1, p.neonAlpha * 0.25, 0.2);
      }
      // Hanging plants and a crooked roofline.
      ctx.fillStyle = p.treeMid;
      for (let i = 0; i < 5; i++) {
        const px = x + 75 + i * 7;
        ctx.fillRect(px, top + 18, 2 + (i % 3), 2);
      }
      ctx.fillStyle = rgba(p.oldTrim, 0.8);
      ctx.fillRect(x - 3, base - 8, w + 4, 8);
    }

    _drawStreetProps(ctx, p) {
      // Puddles from the evening tide.
      for (const puddle of this.puddles) {
        const y = puddle.y;
        ctx.save();
        ctx.globalAlpha = 0.72;
        pixelBlob(ctx, puddle.x, y, puddle.rx, puddle.ry, mixHex(p.quayDark, p.waterDeep, 0.34), 1);
        ctx.globalAlpha = 0.6;
        pixelBlob(ctx, puddle.x + 2, y - 1, puddle.rx - 7, Math.max(1, puddle.ry - 2), mixHex(p.waterTop, p.quayDark, 0.3), 1);
        ctx.globalAlpha = 1;
        for (let i = 0; i < 3; i++) {
          const wy = y - puddle.ry + 2 + i * 3;
          const wx = puddle.x - puddle.rx * 0.52 + Math.sin(this.time * 1.5 + i * 2 + puddle.phase) * 3;
          ctx.fillStyle = rgba(i === 0 ? p.glint : p.waterLine, 0.18 + p.windowGlowAlpha * 0.16);
          ctx.fillRect(Math.round(wx), Math.round(wy), Math.round(puddle.rx * (0.9 - i * 0.17)), 1);
        }
        if (p.neonAlpha > 0.3) {
          ctx.fillStyle = rgba(p.neon2, 0.14 * p.neonAlpha);
          ctx.fillRect(puddle.x - 8, y - 2, 16, 1);
        }
        ctx.restore();
      }

      // Fallen leaves and tiny weeds softening the stone.
      for (const leaf of this.groundLeaves) {
        ctx.fillStyle = rgba(leaf.c > 0.62 ? p.leafLitter : leaf.c > 0.3 ? p.treeHi : p.treeDark, leaf.a);
        ctx.fillRect(Math.round(leaf.x), Math.round(leaf.y), leaf.c > 0.7 ? 3 : 2, 1);
      }

      // Railing planters.
      for (const planter of [{ x: 332, y: 451, s: 1 }, { x: 492, y: 452, s: 0.86 }, { x: 642, y: 450, s: 0.8 }, { x: 760, y: 451, s: 0.72 }]) {
        const wobble = Math.sin(this.windPhase * 1.3 + planter.x) * 1.2 * this.gust;
        ctx.fillStyle = p.oldWallDark;
        ctx.fillRect(planter.x - 12, planter.y, 25, 8);
        ctx.fillStyle = rgba(p.oldWallLit, 0.5);
        ctx.fillRect(planter.x - 12, planter.y, 25, 1);
        ctx.fillStyle = p.oldTrim;
        ctx.fillRect(planter.x - 9, planter.y + 4, 19, 1);
        ctx.fillStyle = p.treeDark;
        pixelBlob(ctx, planter.x + wobble, planter.y - 4, 10 * planter.s, 6, p.treeDark, 1);
        pixelBlob(ctx, planter.x + wobble - 2, planter.y - 5, 7 * planter.s, 4, p.treeMid, 1);
        // Grass blades and a few bright petals, gently leaning with the wind.
        for (let g = 0; g < 5; g++) {
          const gx = planter.x - 8 + g * 4 + wobble * 0.3;
          const gy = planter.y - 5 - (g % 3);
          ctx.fillStyle = g % 2 ? p.treeLight : p.treeMid;
          ctx.fillRect(Math.round(gx), Math.round(gy), 1, 3);
        }
        const petal = planter.s > 0.9 ? p.windowPink : planter.s > 0.8 ? p.neon3 : p.windowCool;
        ctx.fillStyle = petal;
        ctx.fillRect(Math.round(planter.x - 5 + wobble), planter.y - 8, 2, 2);
        ctx.fillRect(Math.round(planter.x + 2 + wobble), planter.y - 6, 1, 1);
        ctx.fillRect(Math.round(planter.x + 7 + wobble), planter.y - 9, 1, 1);
        if (p.neonAlpha > 0.4) {
          ctx.fillStyle = p.neon2;
          ctx.fillRect(planter.x + 1 + wobble, planter.y - 9, 1, 1);
        }
      }

      // Weeds and stubborn little flowers between the paving stones.
      for (let i = 0; i < 36; i++) {
        const fx = 218 + hash(i * 2.73) * 584;
        const fy = 448 + hash(i * 7.19) * 83;
        if (fx > 430 && fx < 540 && fy > 496) continue;
        const sway = Math.sin(this.windPhase * 1.8 + i * 1.7) * 0.8 * this.gust;
        ctx.fillStyle = i % 3 === 0 ? p.treeLight : p.treeMid;
        ctx.fillRect(Math.round(fx + sway), Math.round(fy), 1, i % 4 === 0 ? 3 : 2);
        if (i % 5 === 1) {
          ctx.fillStyle = i % 10 === 1 ? p.windowPink : p.neon3;
          ctx.fillRect(Math.round(fx + sway + 1), Math.round(fy - 1), 1, 1);
        }
      }

      // Café terrace: two little tables under the awning.
      this._drawCafeTables(ctx, p);

      // Bench beneath the big tree.
      this._drawBench(ctx, p, 812, 525, 84);

      // A seagull perched on the railing and a tiny mailbox.
      ctx.fillStyle = rgba(p.quayJoint, 0.9);
      ctx.fillRect(591, 422, 4, 3);
      ctx.fillRect(595, 419, 3, 5);
      ctx.fillStyle = rgba(p.quayLight, 0.7);
      ctx.fillRect(596, 419, 2, 2);
      ctx.fillStyle = p.neon3;
      ctx.fillRect(598, 420, 1, 1);
      ctx.fillStyle = rgba(p.quayJoint, 0.36);
      ctx.fillRect(589, 425, 12, 1);

      // Mailbox.
      ctx.fillStyle = mixHex(p.oldRoof, p.oldTrim, 0.35);
      ctx.fillRect(474, 448, 12, 19);
      ctx.fillRect(472, 446, 16, 4);
      ctx.fillStyle = rgba(p.oldWallLit, 0.4);
      ctx.fillRect(476, 449, 8, 1);
      ctx.fillStyle = p.oldTrim;
      ctx.fillRect(476, 460, 8, 1);
      ctx.fillStyle = p.windowOff;
      ctx.fillRect(478, 453, 4, 1);
      ctx.fillStyle = rgba(p.shadowColor, p.shadowAlpha * 0.8);
      ctx.fillRect(488, 464, 9, 2);

      // A bicycle resting against the café.
      this._drawBicycle(ctx, p, 205, 493);

      // Chalkboard menu.
      ctx.save();
      ctx.translate(239, 490);
      ctx.rotate(-0.045);
      ctx.fillStyle = p.oldTrim;
      ctx.fillRect(-9, -20, 18, 25);
      ctx.fillStyle = mixHex(p.oldTrim, p.windowOff, 0.68);
      ctx.fillRect(-7, -18, 14, 19);
      pixelText(ctx, "TIDE", -5, -15, 1, rgba(p.windowWarm, 0.8));
      ctx.fillStyle = rgba(p.windowWarm, 0.55);
      ctx.fillRect(-5, -8, 10, 1);
      ctx.fillRect(-5, -5, 7, 1);
      ctx.fillRect(-5, -2, 9, 1);
      ctx.fillStyle = rgba(p.shadowColor, p.shadowAlpha * 0.85);
      ctx.fillRect(-7, 5, 18, 2);
      ctx.restore();

      // Pigeons bobbing near the railing.
      for (const bird of this.pigeons) {
        const peck = Math.sin(this.time * 3 + bird.phase) > 0.55 ? 1 : 0;
        ctx.fillStyle = rgba(p.quayJoint, 0.78);
        ctx.fillRect(Math.round(bird.x), Math.round(bird.y), 4, 2);
        ctx.fillRect(Math.round(bird.x + (bird.dir > 0 ? 3 : -1)), Math.round(bird.y - 2), 2, 2);
        ctx.fillStyle = rgba(p.quayDark, 0.9);
        ctx.fillRect(Math.round(bird.x + (bird.dir > 0 ? 4 : -2)), Math.round(bird.y - 1 - peck), 1, 1);
        ctx.fillStyle = rgba(p.skyLow, 0.55);
        ctx.fillRect(Math.round(bird.x + 1), Math.round(bird.y + 2), 1, 1);
      }
    }

    _drawCafeTables(ctx, p) {
      for (const [tx, ty, flip] of [[59, 505, 1], [128, 515, -1]]) {
        ctx.fillStyle = rgba(p.shadowColor, p.shadowAlpha * 0.6);
        ctx.fillRect(tx - 13, ty + 4, 29, 3);
        ctx.fillStyle = p.oldTrim;
        ctx.fillRect(tx - 11, ty - 2, 22, 3);
        ctx.fillStyle = p.oldWallLit;
        ctx.fillRect(tx - 10, ty - 3, 20, 1);
        pixelLine(ctx, tx - 5, ty, tx - 6, ty + 14, p.oldTrim, 1);
        pixelLine(ctx, tx + 6, ty, tx + 7, ty + 14, p.oldTrim, 1);
        ctx.fillStyle = p.oldTrim;
        ctx.fillRect(tx - 8, ty + 14, 5, 1);
        ctx.fillRect(tx + 5, ty + 14, 5, 1);
        // Cup.
        ctx.fillStyle = p.windowOff;
        ctx.fillRect(tx - 2, ty - 8, 3, 4);
        ctx.fillStyle = p.windowWarm;
        ctx.fillRect(tx - 2, ty - 8, 2, 1);
        if (!this.reducedMotion) {
          ctx.fillStyle = rgba(p.haze, 0.3);
          ctx.fillRect(tx - 1, ty - 12 - Math.sin(this.time * 1.5 + tx) * 1, 1, 4);
        }
        // Chair.
        const cx = tx + flip * 17;
        ctx.fillStyle = p.oldRoof;
        ctx.fillRect(cx - 4, ty - 7, 2, 15);
        ctx.fillRect(cx + 2, ty - 5, 2, 13);
        ctx.fillRect(cx - 3, ty - 6, 5, 1);
      }
    }

    _drawBench(ctx, p, x, y, w) {
      ctx.fillStyle = rgba(p.shadowColor, p.shadowAlpha * 0.7);
      ctx.fillRect(x - 3, y + 2, w + 10, 4);
      ctx.fillStyle = p.oldTrim;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x, y - 25 + i * 4, w, 2);
        ctx.fillStyle = rgba(p.oldWallLit, 0.35);
        ctx.fillRect(x + 1, y - 25 + i * 4, w - 2, 1);
        ctx.fillStyle = p.oldTrim;
      }
      ctx.fillRect(x + 5, y - 27, 3, 12);
      ctx.fillRect(x + w - 8, y - 27, 3, 12);
      ctx.fillStyle = p.quayJoint;
      ctx.fillRect(x - 2, y - 15, w + 4, 3);
      ctx.fillRect(x + 4, y - 13, 3, 13);
      ctx.fillRect(x + w - 7, y - 13, 3, 13);
      // A seated figure with a newspaper, seen from behind.
      ctx.fillStyle = p.quayJoint;
      ctx.fillRect(x + w - 28, y - 39, 11, 13);
      ctx.fillStyle = mixHex(p.oldWall, p.oldWallDark, 0.5);
      ctx.fillRect(x + w - 31, y - 41, 16, 16);
      ctx.fillStyle = p.oldWallDark;
      ctx.fillRect(x + w - 30, y - 43, 8, 3);
      ctx.fillRect(x + w - 23, y - 42, 4, 2);
      ctx.fillStyle = mixHex(p.windowWarm, p.oldWall, 0.45);
      ctx.fillRect(x + w - 35, y - 35, 10, 7);
      ctx.fillStyle = rgba(p.quayLight, 0.55);
      ctx.fillRect(x + w - 34, y - 34, 8, 1);
      if (p.neonAlpha > 0.25) {
        ctx.fillStyle = rgba(p.windowWarm, 0.65);
        ctx.fillRect(x + w - 35, y - 35, 1, 1);
      }
      // A small warm lantern under the bench arm.
      ctx.fillStyle = rgba(p.lamp, 0.7 + p.lampAlpha * 0.25);
      ctx.fillRect(x + 2, y - 14, 2, 3);
    }

    _drawBicycle(ctx, p, x, y) {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = rgba(p.quayJoint, 0.9);
      ctx.lineWidth = 1;
      ctx.fillStyle = rgba(p.quayJoint, 0.9);
      for (const wx of [-9, 10]) {
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2;
          ctx.fillRect(Math.round(wx + Math.cos(a) * 6), Math.round(-6 + Math.sin(a) * 6), 2, 1);
        }
      }
      pixelLine(ctx, -9, -6, -2, -18, p.oldTrim, 1);
      pixelLine(ctx, -2, -18, 9, -18, p.oldTrim, 1);
      pixelLine(ctx, 9, -18, 10, -6, p.oldTrim, 1);
      pixelLine(ctx, -2, -18, 2, -6, p.oldTrim, 1);
      pixelLine(ctx, 2, -6, 10, -6, p.oldTrim, 1);
      pixelLine(ctx, 2, -6, -2, -18, p.oldTrim, 1);
      ctx.fillStyle = p.oldRoof;
      ctx.fillRect(-5, -21, 7, 2);
      ctx.fillStyle = p.oldWallLit;
      ctx.fillRect(8, -22, 7, 3);
      ctx.fillStyle = p.windowWarm;
      ctx.fillRect(10, -21, 1, 1);
      ctx.fillStyle = rgba(p.shadowColor, p.shadowAlpha * 0.7);
      ctx.fillRect(-12, 1, 28, 2);
      ctx.restore();
    }

    _drawTrees(ctx, p) {
      for (const tree of this.trees) {
        const gust = this.gust;
        const sway = (Math.sin(this.windPhase * 1.1 + tree.seed * 0.003) * 2.1 + Math.sin(this.windPhase * 2.3 + 1) * 0.8) * gust;
        const shadowDir = -p.lightDir;
        ctx.save();
        // Long, broken tree shadow.
        ctx.fillStyle = rgba(p.shadowColor, p.shadowAlpha * 0.7);
        for (let i = 0; i < 8; i++) {
          const ox = shadowDir * (i * 14 + 8);
          const yy = tree.baseY + 5 + i * 1.2;
          const ww = Math.max(3, 23 - i * 2.1);
          ctx.fillRect(Math.round(tree.x + ox), Math.round(yy), Math.round(ww), 3);
          ctx.fillRect(Math.round(tree.x + ox + 8), Math.round(yy + 4), Math.round(ww * 0.5), 1);
        }

        // Trunk.
        ctx.fillStyle = p.trunk;
        const trunkTop = tree.baseY - tree.height * 0.51;
        pixelLine(ctx, tree.x, tree.baseY, tree.x - 2 + sway * 0.2, trunkTop, p.trunk, 4);
        pixelLine(ctx, tree.x + 1, tree.baseY, tree.x + 1, trunkTop, rgba(p.trunkLight, 0.7), 1);
        ctx.fillStyle = rgba(p.shadowColor, 0.36);
        ctx.fillRect(tree.x - 11, tree.baseY - 2, 23, 4);
        ctx.fillRect(tree.x - 8, tree.baseY + 1, 17, 3);
        for (let i = 0; i < 3; i++) {
          const ry = tree.baseY - 20 - i * 15;
          ctx.fillStyle = rgba(p.quayLight, 0.22);
          ctx.fillRect(Math.round(tree.x + 2 + Math.sin(this.windPhase * 2 + i + tree.seed) * 1.2), Math.round(ry), 2, 1);
        }
        // Branches; high tips follow the gust.
        for (const br of tree.branches) {
          const hFrac0 = clamp((tree.baseY - br[1]) / tree.height, 0, 1);
          const hFrac1 = clamp((tree.baseY - br[3]) / tree.height, 0, 1);
          const x0 = br[0] + sway * hFrac0 * 3;
          const x1 = br[2] + sway * hFrac1 * 9;
          pixelLine(ctx, x0, br[1], x1, br[3], p.trunk, hFrac1 > 0.6 ? 2 : 3);
          pixelLine(ctx, x0 + 1, br[1], x1 + 1, br[3], rgba(p.trunkLight, 0.4), 1);
        }

        // Layered, wind-swept leaf clusters.
        for (const cluster of tree.clusters) {
          const hFrac = clamp((tree.baseY - cluster.y) / tree.height, 0, 1.2);
          const wind = Math.sin(this.windPhase * 1.3 + cluster.seed * 14 + tree.seed * 0.01) * (1 + gust * 2.5) * hFrac;
          const cx = Math.round(cluster.x + wind + sway * 1.7 * cluster.lift);
          const cy = Math.round(cluster.y + Math.sin(this.windPhase * 0.9 + cluster.seed * 9) * 1.3);
          const r = cluster.r;
          ctx.globalAlpha = 0.9;
          pixelBlob(ctx, cx + 1, cy + 2, r + 2, r * 0.84, p.treeDark, 2);
          ctx.globalAlpha = 1;
          ctx.fillStyle = cluster.shade > 0.62 ? p.treeDark : p.treeMid;
          ctx.fillRect(cx - Math.round(r), cy - Math.round(r * 0.6), Math.round(r * 2), Math.round(r * 1.3));
          pixelBlob(ctx, cx - 1, cy, r * 0.87, r * 0.66, cluster.shade > 0.6 ? p.treeDark : p.treeMid, 2);
          pixelBlob(ctx, cx + p.lightDir * r * 0.18, cy - r * 0.22, r * 0.52, r * 0.4, cluster.shade > 0.4 ? p.treeLight : p.treeMid, 1);
          if (p.starAlpha < 0.4) {
            pixelBlob(ctx, cx + p.lightDir * r * 0.35, cy - r * 0.35, r * 0.2, r * 0.16, p.treeHi, 1);
          }
          // Irregular leaf tips.
          for (let t = 0; t < 4; t++) {
            const a = t * 1.9 + cluster.seed * 11;
            ctx.fillStyle = t % 2 ? p.treeDark : p.treeLight;
            ctx.fillRect(
              Math.round(cx + Math.cos(a) * r * 0.9),
              Math.round(cy + Math.sin(a) * r * 0.7),
              2, 2
            );
          }
          if (p.neonAlpha > 0.5 && tree.layer !== 2 && cluster.seed > 0.83) {
            ctx.fillStyle = rgba(p.lamp, 0.9);
            ctx.fillRect(cx + 3, cy - 4, 1, 1);
            ctx.fillStyle = rgba(p.lamp, 0.2);
            ctx.fillRect(cx + 2, cy - 5, 3, 3);
          }
        }
        ctx.restore();
      }
    }

    _drawLamps(ctx, p) {
      for (const lamp of this.lampPosts) {
        const dir = -p.lightDir;
        ctx.fillStyle = rgba(p.shadowColor, p.shadowAlpha * 0.65);
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(Math.round(lamp.x + dir * (5 + i * 7)), lamp.base - 2 + i, 10 - i, 2);
        }
        ctx.fillStyle = p.quayJoint;
        ctx.fillRect(lamp.x - 4, lamp.base - 3, 9, 4);
        ctx.fillStyle = p.quayDark;
        ctx.fillRect(lamp.x - 2, lamp.base - 54, 3, 52);
        ctx.fillStyle = rgba(p.quayLight, 0.5);
        ctx.fillRect(lamp.x - 1, lamp.base - 53, 1, 41);
        // Decorative bracket and lantern.
        const topY = lamp.base - lamp.h + 12;
        ctx.fillStyle = p.quayJoint;
        ctx.fillRect(lamp.x - 2, topY + 12, 5, 3);
        ctx.fillRect(lamp.x - 4, topY + 17, 9, 2);
        ctx.fillRect(lamp.x - 2, topY + 19, 3, 10);
        ctx.fillStyle = p.oldTrim;
        ctx.fillRect(lamp.x - 6, topY + 7, 13, 7);
        ctx.fillRect(lamp.x - 7, topY + 12, 15, 2);
        ctx.fillStyle = rgba(p.lampGlow, 0.82);
        ctx.fillRect(lamp.x - 4, topY + 9, 9, 4);
        ctx.fillStyle = p.lamp;
        ctx.fillRect(lamp.x - 2, topY + 9, 5, 2);
        ctx.fillStyle = p.quayJoint;
        ctx.fillRect(lamp.x - 8, topY + 5, 17, 2);
        ctx.fillRect(lamp.x - 4, topY + 1, 9, 4);
        ctx.fillRect(lamp.x - 1, topY - 2, 3, 3);
        // A little number plaque.
        ctx.fillStyle = rgba(p.quayLight, 0.4);
        ctx.fillRect(lamp.x - 3, lamp.base - 18, 5, 3);
        ctx.fillStyle = rgba(p.quayJoint, 0.65);
        ctx.fillRect(lamp.x - 2, lamp.base - 17, 3, 1);
      }
    }

    _drawForegroundDetail(ctx, p) {
      // Festoon lights strung between the old café and the warehouses.
      for (let i = 1; i < this.festoon.length; i++) {
        const a = this.festoon[i - 1];
        const b = this.festoon[i];
        const swayA = Math.sin(this.windPhase * 0.8 + i) * 1.2;
        const swayB = Math.sin(this.windPhase * 0.8 + i + 1) * 1.2;
        pixelLine(ctx, a.x, a.y + swayA, b.x, b.y + swayB, rgba(p.quayJoint, 0.62), 1);
      }
      for (const bulb of this.festoon) {
        const sway = Math.sin(this.windPhase * 0.8 + bulb.i) * 1.2;
        ctx.fillStyle = p.oldTrim;
        ctx.fillRect(Math.round(bulb.x), Math.round(bulb.y + sway), 1, 2);
        ctx.fillStyle = p.neonAlpha > 0.18 || p.lampAlpha > 0.45 ? p.lamp : rgba(p.oldWallLit, 0.55);
        ctx.fillRect(Math.round(bulb.x), Math.round(bulb.y + sway + 2), 2, 2);
        if (p.neonAlpha > 0.4 && bulb.i % 2 === 0) {
          glow(ctx, bulb.x, bulb.y + sway + 2, 8, p.lamp, p.lampAlpha * 0.14, 0.2);
        }
      }

      // Lamp haloes and pools.
      for (const lamp of this.lampPosts) {
        const topY = lamp.base - lamp.h + 22;
        if (p.lampAlpha > 0.07) {
          glow(ctx, lamp.x, topY, 105, p.lampGlow, p.lampAlpha * 0.18, 0.16);
          glow(ctx, lamp.x, topY, 22, p.lamp, p.lampAlpha * 0.28, 0.15);
          const pool = ctx.createLinearGradient(0, lamp.base - 4, 0, lamp.base + 33);
          pool.addColorStop(0, rgba(p.lamp, p.lampAlpha * 0.12));
          pool.addColorStop(1, rgba(p.lamp, 0));
          ctx.fillStyle = pool;
          ctx.fillRect(lamp.x - 28, lamp.base - 3, 56, 35);
        }
      }

      // Soft light leaking from the café windows and the bar.
      const c = this.cafe;
      const gy = c.y - 481 + 444;
      if (p.windowGlowAlpha > 0.2) {
        glow(ctx, c.x + 62, 445, 105, p.windowWarm, p.windowGlowAlpha * 0.1, 0.32);
        glow(ctx, c.x + 145, 456, 62, p.windowWarm, p.windowGlowAlpha * 0.12, 0.32);
        ctx.save();
        const spill = ctx.createLinearGradient(0, 460, 0, 530);
        spill.addColorStop(0, rgba(p.windowWarm, p.windowGlowAlpha * 0.11));
        spill.addColorStop(1, rgba(p.windowWarm, 0));
        ctx.fillStyle = spill;
        ctx.fillRect(c.x + 15, 460, c.w - 18, 70);
        ctx.restore();
        glow(ctx, 893, 493, 84, p.windowWarm, p.windowGlowAlpha * 0.11, 0.3);
        if (p.neonAlpha > 0.35) {
          glow(ctx, c.x + 94, 400, 55, p.neon2, p.neonAlpha * 0.18, 0.22);
          glow(ctx, 854, 367, 30, p.neon1, p.neonAlpha * 0.17, 0.2);
        }
      }

      // Chimney smoke from the café.
      for (let i = 0; i < 9; i++) {
        const phase = (this.time * 0.07 + i / 9) % 1;
        const sx = c.x + 39 + Math.sin(phase * 8 + i) * (5 + phase * 14) + this.gust * phase * 8;
        const sy = c.y - c.h - 38 - phase * 74;
        ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.2;
        ctx.fillStyle = p.haze;
        ctx.fillRect(Math.round(sx), Math.round(sy), 3 + Math.round(phase * 8), 2 + Math.round(phase * 3));
        if (phase > 0.35) ctx.fillRect(Math.round(sx + 3), Math.round(sy - 2), 5, 2);
      }
      ctx.globalAlpha = 1;

      // Night insects and tiny warm sparks around the trees.
      if (p.starAlpha > 0.3) {
        for (let i = 0; i < 10; i++) {
          const bx = 664 + Math.sin(this.time * 0.35 + i * 2.4) * (25 + i * 3);
          const by = 443 + Math.cos(this.time * 0.28 + i * 1.7) * (13 + i);
          const a = 0.3 + Math.sin(this.time * 2 + i) * 0.28;
          ctx.fillStyle = rgba(p.lamp, Math.max(0, a) * p.starAlpha);
          ctx.fillRect(Math.round(bx), Math.round(by), 1, 1);
          if (i % 3 === 0) glow(ctx, bx, by, 5, p.lamp, a * 0.15, 0.2);
        }
      }
    }

    // __FOREGROUND_METHODS_END2__

    _updatePeople(dt) {
      for (const person of this.people) {
        if (!person.nextTurn) person.nextTurn = this.time + 2 + hash(person.id + 0.3) * 5;
        if (!person.pauseUntil) person.pauseUntil = 0;

        if (person.wave > 0) {
          person.wave -= dt;
          if (person.wave <= 0) {
            person.bubble = null;
            person.pauseUntil = 0;
          }
        }

        if (person.state === "chat") {
          const partner = this.people[person.partner];
          if (partner) {
            person.dir = partner.x >= person.x ? 1 : -1;
            if (this.time >= person.chatUntil) {
              person.state = "walk";
              person.partner = null;
              person.cooldown = this.time + 3.5 + Math.random() * 5;
              person.targetY = person.lane + (Math.random() - 0.5) * 5;
              person.nextTurn = this.time + 2 + Math.random() * 4;
            }
          } else {
            person.state = "walk";
            person.partner = null;
          }
          continue;
        }

        if (person.wave > 0 || this.time < person.pauseUntil) {
          continue;
        }

        if (this.time > person.nextTurn) {
          person.nextTurn = this.time + 2.5 + Math.random() * 5;
          if (Math.random() < 0.3) {
            person.pauseUntil = this.time + 0.7 + Math.random() * 1.8;
          }
          if (Math.random() < 0.4) {
            person.targetY = person.lane + (Math.random() - 0.5) * 9;
          }
          if (Math.random() < 0.16) person.dir *= -1;
        }

        const speed = person.speed * (person.state === "walk" ? 1 : 0.4);
        person.x += person.dir * speed * dt;
        person.y += (person.targetY - person.y) * Math.min(1, dt * 0.8);
        if (person.x > 798) { person.x = 798; person.dir = -1; }
        if (person.x < 236) { person.x = 236; person.dir = 1; }

        // Softly part ways with anyone lingering directly in the path.
        for (const other of this.people) {
          if (other === person || other.state === "chat") continue;
          const dx = Math.abs(other.x - person.x);
          const dy = Math.abs(other.y - person.y);
          if (dx < 9 && dy < 5) {
            person.targetY = clamp(person.y + (person.y <= other.y ? -8 : 8), 474, 526);
          }
        }
      }
    }

    _updateDog(dt) {
      const owner = this.people[4];
      const sitting = owner.state === "chat" || owner.wave > 0;
      const targetX = clamp(owner.x - owner.dir * 23, 240, 800);
      const targetY = owner.y + 6;
      this.dog.x += (targetX - this.dog.x) * Math.min(1, dt * 3.2);
      this.dog.y += (targetY - this.dog.y) * Math.min(1, dt * 3.2);
      this.dog.wag += dt * (sitting ? 4 : 10);
      this.dog.sitting = sitting;
    }

    startChat(aId, bId, until) {
      const a = this.people[aId];
      const b = this.people[bId];
      if (!a || !b || a.state === "chat" || b.state === "chat") return;
      const types = ["heart", "dots", "note", "sparkle"];
      const type = types[Math.floor(Math.random() * types.length)];
      const chatEnd = until || this.time + 3.2 + Math.random() * 3.2;
      for (const person of [a, b]) {
        person.state = "chat";
        person.chatUntil = chatEnd;
        person.chatStart = this.time;
        person.chatType = type;
        person.partner = person === a ? b.id : a.id;
        person.pauseUntil = 0;
      }
      a.dir = b.x >= a.x ? 1 : -1;
      b.dir = a.x >= b.x ? 1 : -1;
      this._addChatParticles((a.x + b.x) / 2, Math.min(a.y, b.y) - 30, type);
    }

    _lookForConversation() {
      if (this.people.some((person) => person.state === "chat")) return;
      const available = this.people.filter((person) => person.cooldown < this.time && person.wave <= 0);
      let best = null;
      let bestDist = 32;
      for (let i = 0; i < available.length; i++) {
        for (let j = i + 1; j < available.length; j++) {
          const a = available[i];
          const b = available[j];
          if (Math.abs(a.y - b.y) > 13) continue;
          const dist = Math.abs(a.x - b.x);
          if (dist < bestDist) {
            bestDist = dist;
            best = [a, b];
          }
        }
      }
      if (best) this.startChat(best[0].id, best[1].id);
    }

    _addChatParticles(x, y, type) {
      for (let i = 0; i < 5; i++) {
        this.conversationParticles.push({
          x: x + (Math.random() - 0.5) * 22,
          y: y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 8,
          vy: -7 - Math.random() * 10,
          life: 0.8 + Math.random() * 1.4,
          age: 0,
          type: type === "heart" ? "heart" : type === "note" ? "note" : "spark"
        });
      }
    }

    _drawPeople(ctx, p) {
      const sorted = this.people.slice().sort((a, b) => a.y - b.y);
      for (const person of sorted) this._drawPerson(ctx, p, person);
      this._drawDog(ctx, p);
      for (const person of this.people) {
        const bubble = this._personBubble(person);
        if (bubble) this._drawBubble(ctx, p, bubble);
      }
      this._drawChatParticles(ctx, p);
    }

    _personColor(hex, p, amount) {
      const dim = p.starAlpha * 0.18 + (p.windowGlowAlpha - 0.28) * 0.05;
      return shade(hex, -clamp(dim * amount, 0, 0.28));
    }

    _drawPerson(ctx, p, person) {
      const x = Math.round(person.x);
      const y = Math.round(person.y);
      const isChatting = person.state === "chat";
      const isWaving = person.wave > 0;
      const moving = !isChatting && !isWaving && this.time >= person.pauseUntil;
      const phase = this.time * (person.speed * 0.85) + person.phase;
      const cycle = Math.sin(phase);
      const step = moving ? (cycle > 0.05 ? 1 : 0) : 0;
      const bodyBob = moving ? (Math.abs(cycle) > 0.55 ? 1 : 0) : 0;
      const coat = this._personColor(person.coat, p, 1);
      const coatLight = shade(coat, 0.18);
      const pants = this._personColor(person.pants, p, 0.8);
      const skin = this._personColor(person.skin, p, 0.45);
      const accent = this._personColor(person.accent, p, 0.7);
      const hair = this._personColor(person.hair, p, 0.55);
      const dir = person.dir >= 0 ? 1 : -1;
      const shadowDir = -p.lightDir;

      // Ground shadow, long when the sun is low.
      ctx.save();
      ctx.globalAlpha = p.shadowAlpha * 0.9;
      ctx.fillStyle = p.shadowColor;
      pixelBlob(ctx, x, y + 2, 8, 2, p.shadowColor, 1);
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(Math.round(x + shadowDir * (5 + i * 4)), y + 1 + i * 0.5, 8 - i, 2);
      }
      ctx.restore();

      ctx.save();
      ctx.translate(x, y - bodyBob);
      if (dir < 0) ctx.scale(-1, 1);

      // A dark underdrawing keeps the tiny figure legible at 1脳 scale.
      ctx.fillStyle = rgba(p.shadowColor, 0.7);
      ctx.fillRect(-5, -29, 10, 9);
      ctx.fillRect(-5, -20, 9, 12);
      ctx.fillRect(-4, -8, 8, 9);

      // Legs and shoes.
      const legSwing = moving ? Math.round(cycle * 1.6) : 0;
      ctx.fillStyle = pants;
      ctx.fillRect(-3 + legSwing, -10, 3, 8);
      ctx.fillRect(1 - legSwing, -10, 3, 8 + step);
      ctx.fillStyle = shade(pants, -0.25);
      ctx.fillRect(-4 + legSwing, -3, 4, 2);
      ctx.fillRect(1 - legSwing, -3 + step, 4, 2);

      // Jacket and arms.
      ctx.fillStyle = coat;
      ctx.fillRect(-4, -21, 8, 12);
      ctx.fillStyle = coatLight;
      ctx.fillRect(-4, -21, 2, 10);
      ctx.fillStyle = shade(coat, -0.14);
      ctx.fillRect(2, -20, 2, 8);
      const armSwing = moving ? Math.round(cycle * 2) : 0;
      ctx.fillStyle = coat;
      if (isWaving) {
        ctx.fillRect(4, -27, 2, 9);
        ctx.fillStyle = skin;
        ctx.fillRect(5, -29, 2, 3);
      } else if (isChatting) {
        ctx.fillRect(3, -18, 5, 2);
        ctx.fillStyle = skin;
        ctx.fillRect(7, -18, 2, 2);
        ctx.fillStyle = coat;
        ctx.fillRect(-5, -17, 2, 7);
      } else {
        ctx.fillRect(4, -19 - Math.max(0, armSwing), 2, 8);
        ctx.fillStyle = skin;
        ctx.fillRect(4, -11 - Math.max(0, armSwing), 2, 2);
        ctx.fillStyle = coat;
        ctx.fillRect(-5, -19 + Math.max(0, armSwing), 2, 7);
      }

      // Head, ear, eye and hair silhouette.
      ctx.fillStyle = skin;
      ctx.fillRect(-3, -27, 6, 7);
      ctx.fillStyle = shade(skin, -0.1);
      ctx.fillRect(-3, -22, 6, 2);
      ctx.fillStyle = p.windowOff;
      ctx.fillRect(2, -24, 1, 1);
      ctx.fillStyle = hair;
      ctx.fillRect(-4, -29, 8, 3);
      ctx.fillRect(-4, -27, 2, 3);
      ctx.fillRect(3, -27, 1, 2);
      // Hat or bun.
      if (person.hat === "beanie") {
        ctx.fillStyle = accent;
        ctx.fillRect(-4, -30, 8, 3);
        ctx.fillRect(-4, -27, 2, 2);
        ctx.fillStyle = shade(accent, -0.2);
        ctx.fillRect(-4, -28, 8, 1);
      } else if (person.hat === "cap") {
        ctx.fillStyle = accent;
        ctx.fillRect(-4, -30, 8, 2);
        ctx.fillRect(1, -28, 5, 1);
      } else if (person.hat === "bun") {
        ctx.fillStyle = hair;
        pixelBlob(ctx, -4, -30, 3, 3, hair, 1);
        ctx.fillStyle = accent;
        ctx.fillRect(-5, -31, 2, 1);
      }

      // Scarf moving in the wind.
      if (person.scarf) {
        ctx.fillStyle = accent;
        ctx.fillRect(-3, -21, 6, 2);
        const tail = Math.sin(this.windPhase * 2 + person.id) * 1.6;
        ctx.fillRect(-5 + Math.round(tail), -20, 2, 2);
        ctx.fillRect(-6 + Math.round(tail * 1.5), -18, 2, 2);
        ctx.fillRect(-7 + Math.round(tail * 1.9), -16, 2, 1);
      }

      // Bag and camera details.
      if (person.bag === "tote") {
        ctx.fillStyle = accent;
        ctx.fillRect(-6, -15, 4, 6);
        ctx.fillStyle = shade(accent, -0.2);
        ctx.fillRect(-6, -15, 1, 5);
        ctx.fillStyle = rgba(accent, 0.65);
        pixelLine(ctx, -4, -21, -5, -16, rgba(accent, 0.65), 1);
      } else if (person.bag === "camera") {
        ctx.fillStyle = p.oldTrim;
        ctx.fillRect(-2, -17, 4, 3);
        ctx.fillStyle = p.windowCool;
        ctx.fillRect(-1, -16, 2, 1);
        ctx.fillStyle = rgba(accent, 0.5);
        pixelLine(ctx, -3, -21, 1, -18, rgba(accent, 0.5), 1);
      }

      // Rim light from the key or the street lamps.
      if (p.windowGlowAlpha > 0.25) {
        ctx.fillStyle = rgba(p.lightDir < 0 ? p.windowWarm : p.windowCool, p.starAlpha > 0.3 ? 0.24 : 0.13);
        ctx.fillRect(p.lightDir < 0 ? -5 : 4, -28, 1, 18);
      }
      ctx.restore();

      if (isWaving) {
        const bob = Math.sin(this.time * 9) * 1;
        ctx.fillStyle = p.windowPink;
        ctx.fillRect(x + dir * 8, y - 34 + bob, 1, 1);
        ctx.fillRect(x + dir * 9 - 1, y - 38 + bob, 3, 1);
      }
    }

    _drawDog(ctx, p) {
      const dog = this.dog;
      const owner = this.people[4];
      const x = Math.round(dog.x);
      const y = Math.round(dog.y);
      const bounce = dog.sitting ? 0 : (Math.sin(this.time * 7) > 0 ? 1 : 0);
      const wag = Math.sin(dog.wag) * 2;
      ctx.save();
      ctx.globalAlpha = p.shadowAlpha * 0.7;
      pixelBlob(ctx, x, y + 1, 7, 1, p.shadowColor, 1);
      ctx.restore();
      // Leash from the owner's hand.
      const handX = owner.x - owner.dir * 4;
      const handY = owner.y - 12;
      ctx.globalAlpha = 0.5;
      pixelLine(ctx, handX, handY, x, y - 7, rgba(p.quayJoint, 0.9), 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = this._personColor("#a26d4d", p, 0.6);
      ctx.fillRect(x - 5, y - 9 + bounce, 9, 4);
      ctx.fillRect(x + 3, y - 12 + bounce, 4, 4);
      ctx.fillStyle = this._personColor("#e3c8a3", p, 0.4);
      ctx.fillRect(x + 4, y - 12 + bounce, 2, 2);
      ctx.fillStyle = p.quayJoint;
      ctx.fillRect(x + 7, y - 10 + bounce, 2, 2);
      ctx.fillRect(x - 6, y - 10, 2, 3);
      ctx.fillRect(x - 2, y - 5, 2, 4);
      ctx.fillRect(x + 3, y - 5, 2, 4);
      ctx.fillStyle = this._personColor("#a26d4d", p, 0.7);
      ctx.fillRect(x - 8, y - 12 + Math.round(wag), 3, 2);
      if (p.neonAlpha > 0.3) {
        ctx.fillStyle = rgba(p.lamp, 0.4);
        ctx.fillRect(x + 5, y - 11, 1, 1);
      }
    }

    _personBubble(person) {
      if (person.state === "chat" && person.partner !== null) {
        if (person.id > person.partner) return null;
        const partner = this.people[person.partner];
        if (!partner) return null;
        const elapsed = this.time - (person.chatStart || 0);
        const remaining = person.chatUntil - this.time;
        const opacity = clamp(Math.min(elapsed * 3, remaining * 2), 0, 1);
        return {
          x: (person.x + partner.x) / 2,
          y: Math.min(person.y, partner.y) - 43 + Math.sin(this.time * 2 + person.id) * 1.5,
          type: person.chatType || "dots",
          alpha: opacity,
          big: true
        };
      }
      if (person.wave > 0) {
        return { x: person.x, y: person.y - 43, type: "heart", alpha: clamp(person.wave, 0, 1), big: false };
      }
      return null;
    }

    _drawBubble(ctx, p, bubble) {
      const x = Math.round(bubble.x);
      const y = Math.round(bubble.y);
      const w = bubble.big ? 25 : 17;
      const h = bubble.big ? 18 : 16;
      const color = bubble.type === "heart" ? p.neon2 : bubble.type === "note" ? p.neon1 : bubble.type === "sparkle" ? p.neon3 : p.windowWarm;
      ctx.save();
      ctx.globalAlpha = bubble.alpha;
      if (p.neonAlpha > 0.2) glow(ctx, x, y, w, color, p.neonAlpha * 0.08, 0.2);
      ctx.fillStyle = rgba(p.oldTrim, 0.85);
      ctx.fillRect(x - w / 2 - 1, y - h / 2 - 1, w + 2, h + 2);
      ctx.fillStyle = rgba(shade(p.modernDark, -0.15), 0.9);
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.fillStyle = rgba(color, 0.72);
      ctx.fillRect(x - w / 2, y - h / 2, w, 1);
      ctx.fillRect(x - w / 2, y + h / 2 - 1, w, 1);
      ctx.fillRect(x - w / 2, y - h / 2, 1, h);
      ctx.fillRect(x + w / 2 - 1, y - h / 2, 1, h);
      ctx.fillStyle = rgba(p.oldTrim, 0.9);
      ctx.fillRect(x - 3, y + h / 2, 3, 1);
      ctx.fillRect(x - 2, y + h / 2 + 1, 2, 1);
      ctx.fillRect(x - 1, y + h / 2 + 2, 1, 1);
      if (bubble.type === "heart") {
        drawIcon(ctx, HEART, x - 3, y - 3, color);
      } else if (bubble.type === "note") {
        drawIcon(ctx, NOTE, x - 2, y - 5, color);
      } else if (bubble.type === "sparkle") {
        drawIcon(ctx, SPARK, x - 3, y - 3, color);
      } else {
        ctx.fillStyle = color;
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(x - 5 + i * 4, y - 1 + (i === 1 ? -1 : 0), 2, 2);
        }
      }
      ctx.restore();
    }

    _drawChatParticles(ctx, p) {
      for (const par of this.conversationParticles) {
        const alpha = clamp(par.life / 0.6, 0, 1) * 0.8;
        const color = par.type === "heart" ? p.neon2 : par.type === "note" ? p.neon1 : p.windowWarm;
        ctx.globalAlpha = alpha;
        if (par.type === "heart") {
          drawIcon(ctx, HEART, Math.round(par.x) - 3, Math.round(par.y) - 3, color);
        } else if (par.type === "note") {
          drawIcon(ctx, NOTE, Math.round(par.x), Math.round(par.y), color);
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(Math.round(par.x), Math.round(par.y), 2, 2);
        }
      }
      ctx.globalAlpha = 1;
    }

    // __PEOPLE_METHODS_END__

    _updateLeaves(dt) {
      const modeRate = this.mode === "dusk" ? 1.4 : this.mode === "night" ? 0.48 : 0.8;
      const wind = this.gust;
      this.leafClock += dt * (1.8 + wind * 4.5) * modeRate;
      let guard = 0;
      while (this.leafClock >= 1 && guard < 4) {
        this.leafClock -= 1;
        guard++;
        if (this.leaves.length < 86) this._spawnLeaf();
      }
      for (let i = this.leaves.length - 1; i >= 0; i--) {
        const leaf = this.leaves[i];
        leaf.age += dt;
        if (!leaf.grounded) {
          leaf.x += (leaf.vx + Math.sin(leaf.age * leaf.flutter + leaf.phase) * leaf.swing + wind * (3 + leaf.size * 2)) * dt;
          leaf.y += leaf.vy * dt;
          leaf.vy += 3.2 * dt;
          if (leaf.y >= leaf.groundY) {
            leaf.grounded = true;
            leaf.groundAge = 0;
            leaf.y = leaf.groundY;
          }
        } else {
          leaf.groundAge += dt;
          leaf.x += Math.sin(leaf.age * 1.5 + leaf.phase) * 0.8 * dt;
        }
        if (leaf.grounded && leaf.groundAge > 3.5) this.leaves.splice(i, 1);
        else if (!leaf.grounded && leaf.y > H + 20) this.leaves.splice(i, 1);
      }
    }

    _spawnLeaf() {
      const tree = this.trees[Math.floor(Math.random() * this.trees.length)];
      const cluster = tree.clusters[Math.floor(Math.random() * tree.clusters.length)];
      const y = cluster.y + (Math.random() - 0.5) * cluster.r;
      const groundY = tree.baseY - 4 + Math.random() * 30;
      const colors = ["leafLitter", "treeHi", "oldRoofLit", "treeLight"];
      this.leaves.push({
        x: cluster.x + (Math.random() - 0.5) * cluster.r * 1.5,
        y,
        vx: (Math.random() - 0.3) * 3,
        vy: 2 + Math.random() * 5,
        flutter: 1.6 + Math.random() * 3.2,
        swing: 4 + Math.random() * 10,
        phase: Math.random() * Math.PI * 2,
        size: Math.random() > 0.58 ? 2 : 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        age: 0,
        grounded: false,
        groundAge: 0,
        groundY
      });
    }

    spawnLeafBurst(x, y, count) {
      for (let i = 0; i < count; i++) {
        const colors = ["leafLitter", "treeHi", "oldRoofLit", "neon3"];
        this.leaves.push({
          x: x + (Math.random() - 0.5) * 16,
          y: y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 18,
          vy: -5 - Math.random() * 12,
          flutter: 1.5 + Math.random() * 3,
          swing: 8 + Math.random() * 10,
          phase: Math.random() * Math.PI * 2,
          size: 1 + Math.round(Math.random()),
          color: colors[Math.floor(Math.random() * colors.length)],
          age: 0,
          grounded: false,
          groundAge: 0,
          groundY: y + 40 + Math.random() * 50,
          burst: true
        });
      }
    }

    _updateParticles(dt) {
      for (let i = this.conversationParticles.length - 1; i >= 0; i--) {
        const par = this.conversationParticles[i];
        par.age += dt;
        par.x += par.vx * dt;
        par.y += par.vy * dt;
        par.vy *= Math.pow(0.6, dt);
        par.vx *= Math.pow(0.25, dt);
        par.life -= dt;
        if (par.life <= 0) this.conversationParticles.splice(i, 1);
      }
      if (this.greetingParticles) {
        for (let i = this.greetingParticles.length - 1; i >= 0; i--) {
          const gp = this.greetingParticles[i];
          gp.age += dt;
          gp.y -= dt * 7;
          if (gp.age > gp.life) this.greetingParticles.splice(i, 1);
        }
      }
    }

    _updateAmbient(dt) {
      for (const walker of this.bridgeWalkers) {
        walker.x += walker.dir * walker.speed * dt;
        if (walker.x > W - 24) { walker.x = W - 24; walker.dir = -1; }
        if (walker.x < 24) { walker.x = 24; walker.dir = 1; }
      }
      for (const pigeon of this.pigeons) {
        if (Math.sin(this.time * 0.7 + pigeon.phase) > 0.997) {
          pigeon.x += pigeon.dir * 2;
          pigeon.dir *= pigeon.dir;
        }
      }
      // Leaves get an extra flurry whenever the pointer sweeps by.
      if (this.pointer.energy > 0.18 && Math.random() < dt * this.pointer.energy * 3) {
        this.spawnLeafBurst(this.pointer.x * W, this.pointer.y * H, 1);
      }
    }

    _drawLeaves(ctx, p) {
      for (const leaf of this.leaves) {
        const alpha = leaf.grounded ? Math.max(0, 1 - leaf.groundAge / 3.5) * 0.65 : 0.88;
        const color = p[leaf.color] || p.leafLitter;
        const wobble = Math.sin(leaf.age * leaf.flutter + leaf.phase);
        const x = Math.round(leaf.x + wobble * (leaf.grounded ? 0.5 : 1.5));
        const y = Math.round(leaf.y);
        ctx.globalAlpha = alpha * (this.mode === "night" ? 0.8 : 1);
        ctx.fillStyle = color;
        if (leaf.grounded) {
          ctx.fillRect(x, y, leaf.size + 2, 1);
        } else if (leaf.size > 1) {
          ctx.fillRect(x, y, 2, 1);
          ctx.fillRect(x + (wobble > 0 ? 1 : -1), y - 1, 1, 1);
          if (leaf.burst) {
            ctx.fillStyle = rgba(p.glint, 0.3);
            ctx.fillRect(x + 1, y + 1, 1, 1);
          }
        } else {
          ctx.fillRect(x, y, 1, 2);
          if (wobble > 0.7) ctx.fillRect(x + 1, y - 1, 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    }

    _drawLighting(ctx, p) {
      // Key light falls across the scene; the direction changes with the hour.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const sx = p.sunX;
      const sy = p.sunY;
      const lightDir = p.lightDir || 0;
      for (let i = 0; i < 4; i++) {
        const spread = 28 + i * 50;
        const length = 570;
        const angle = Math.PI / 2 + lightDir * (0.2 + i * 0.11);
        const x1 = sx + Math.cos(angle - 0.06) * length;
        const y1 = sy + Math.sin(angle - 0.06) * length;
        const x2 = sx + Math.cos(angle + 0.06) * length + spread;
        const y2 = sy + Math.sin(angle + 0.06) * length;
        ctx.fillStyle = rgba(p.sunGlow, p.starAlpha > 0.4 ? 0.012 : 0.022);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Bounce light off the water (the secondary source) climbs the foreground.
      const bounce = ctx.createLinearGradient(0, 430, 0, 250);
      bounce.addColorStop(0, rgba(p.fillColor, p.fillAlpha * 0.55));
      bounce.addColorStop(0.5, rgba(p.fillColor, p.fillAlpha * 0.18));
      bounce.addColorStop(1, rgba(p.fillColor, 0));
      ctx.fillStyle = bounce;
      ctx.fillRect(0, 220, W, 260);

      // Overall graded wash.
      const grade = ctx.createLinearGradient(0, 0, W, H);
      grade.addColorStop(0, rgba(p.gradeColor, p.gradeAlpha * 0.55));
      grade.addColorStop(0.5, rgba(p.gradeColor, p.gradeAlpha * 0.2));
      grade.addColorStop(1, rgba(p.shadowColor, p.gradeAlpha * 0.6));
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = grade;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";

      // A pool of direct sun where the quay is unobstructed.
      if (p.starAlpha < 0.4) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const pool = ctx.createLinearGradient(0, 450, 0, 540);
        pool.addColorStop(0, rgba(p.sunGlow, 0.035));
        pool.addColorStop(1, rgba(p.sunGlow, 0));
        ctx.fillStyle = pool;
        ctx.beginPath();
        ctx.moveTo(lightDir < 0 ? 210 : 560, 455);
        ctx.lineTo(lightDir < 0 ? 580 : 930, 455);
        ctx.lineTo(lightDir < 0 ? 900 : 760, 540);
        ctx.lineTo(lightDir < 0 ? 380 : 220, 540);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Night: cool moon haze settles on the far rooftops.
      if (p.starAlpha > 0.25) {
        const moonHaze = ctx.createRadialGradient(p.sunX, p.sunY, 12, p.sunX, p.sunY, 430);
        moonHaze.addColorStop(0, rgba(p.fillColor, 0.10));
        moonHaze.addColorStop(0.6, rgba(p.fillColor, 0.035));
        moonHaze.addColorStop(1, rgba(p.fillColor, 0));
        ctx.fillStyle = moonHaze;
        ctx.fillRect(0, 0, W, H);
      }
    }

    _drawBokeh(ctx, p) {
      // Out-of-focus highlights at the edge of the lens.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const orb of this.bokeh) {
        const pxShift = (this.pointer.x - 0.5) * (orb.front ? 22 : 8);
        const pyShift = (this.pointer.y - 0.5) * (orb.front ? 10 : 4);
        const driftX = Math.sin(this.time * 0.12 + orb.phase) * orb.drift * 2;
        const driftY = Math.cos(this.time * 0.09 + orb.phase * 1.7) * orb.drift;
        const x = ((orb.x + driftX + pxShift) % (W + 80) + W + 80) % (W + 80) - 40;
        const y = orb.y + driftY + pyShift;
        const color = [p.bokeh1, p.bokeh2, p.bokeh3][orb.c];
        const alpha = p.bokehAlpha * orb.alpha * (this.reducedMotion ? 0.6 : 1);
        if (alpha < 0.006) continue;
        const g = ctx.createRadialGradient(x, y, orb.r * 0.12, x, y, orb.r);
        g.addColorStop(0, rgba(color, alpha * 0.12));
        g.addColorStop(0.56, rgba(color, alpha * 0.09));
        g.addColorStop(0.79, rgba(color, alpha * 0.28));
        g.addColorStop(0.92, rgba(color, alpha * 0.45));
        g.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - orb.r, y - orb.r, orb.r * 2, orb.r * 2);
      }

      // Dust motes caught in the low sun.
      const day = 1 - p.starAlpha;
      for (const mote of this.motes) {
        const x = ((mote.x + this.time * mote.speed * (0.6 + this.gust * 0.8) + 30) % (W + 60) + W + 60) % (W + 60) - 30;
        const y = mote.y + Math.sin(this.time * 0.8 + mote.phase) * 9;
        const alpha = (0.12 + Math.sin(this.time * 1.5 + mote.phase) * 0.08) * mote.alpha * (day * 0.9 + p.starAlpha * 0.55);
        ctx.fillStyle = rgba(p.starAlpha > 0.3 ? p.neon2 : p.glint, Math.max(0, alpha));
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      ctx.restore();
    }

    _drawVignette(ctx) {
      const v = ctx.createRadialGradient(480, 285, 140, 480, 285, 780);
      v.addColorStop(0, "rgba(3,8,11,0)");
      v.addColorStop(0.58, "rgba(3,8,11,0.04)");
      v.addColorStop(1, "rgba(3,8,11,0.6)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);

      const top = ctx.createLinearGradient(0, 0, 0, 112);
      top.addColorStop(0, "rgba(3,8,10,0.4)");
      top.addColorStop(1, "rgba(3,8,10,0)");
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, W, 112);

      const bottom = ctx.createLinearGradient(0, H - 150, 0, H);
      bottom.addColorStop(0, "rgba(2,7,9,0)");
      bottom.addColorStop(1, "rgba(2,7,9,0.54)");
      ctx.fillStyle = bottom;
      ctx.fillRect(0, H - 150, W, 150);
    }
  }

  L.PixelCity = PixelCity;
})();
