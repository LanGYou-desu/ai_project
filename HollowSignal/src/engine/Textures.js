import * as THREE from 'three';

/* Deterministic, tileable procedural surfaces.
   Everything ships as code; no external photographic textures are used. */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

class TileNoise {
  constructor(seed, basePeriod = 4, octaves = 4) {
    this.periods = [];
    this.grids = [];
    this.weights = [];
    const rand = mulberry32(seed);
    let total = 0;
    for (let o = 0; o < octaves; o++) {
      const p = basePeriod * (2 ** o);
      this.periods.push(p);
      const grid = new Float32Array(p * p);
      for (let i = 0; i < grid.length; i++) grid[i] = rand();
      this.grids.push(grid);
      const w = 1 / (1.75 ** o);
      this.weights.push(w);
      total += w;
    }
    this.weights = this.weights.map((w) => w / total);
  }
  sample(u, v) {
    let sum = 0;
    for (let o = 0; o < this.grids.length; o++) {
      const p = this.periods[o];
      const grid = this.grids[o];
      const x = u * p;
      const y = v * p;
      let x0 = Math.floor(x);
      let y0 = Math.floor(y);
      const tx = x - x0;
      const ty = y - y0;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      x0 %= p; y0 %= p;
      const x1 = (x0 + 1) % p;
      const y1 = (y0 + 1) % p;
      const a = grid[y0 * p + x0];
      const b = grid[y0 * p + x1];
      const c = grid[y1 * p + x0];
      const d = grid[y1 * p + x1];
      const v00 = a + (b - a) * sx;
      const v10 = c + (d - c) * sx;
      sum += (v00 + (v10 - v00) * sy) * this.weights[o];
    }
    return sum;
  }
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function rgba(r, g, b, a = 255) {
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

function shade(hex, amount) {
  const n = typeof hex === 'number' ? hex : parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return [r, g, b];
}

function drawStain(ctx, x, y, r, color, alpha = 0.3) {
  const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  grad.addColorStop(0, rgba(color[0], color[1], color[2], alpha));
  grad.addColorStop(0.65, rgba(color[0], color[1], color[2], alpha * 0.5));
  grad.addColorStop(1, rgba(color[0], color[1], color[2], 0));
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawCrack(ctx, rand, size, color = 'rgba(20,22,18,.65)', count = 2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  for (let i = 0; i < count; i++) {
    let x = size * (0.08 + rand() * 0.84);
    let y = size * (0.06 + rand() * 0.25);
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segments = 8 + Math.floor(rand() * 12);
    for (let s = 0; s < segments; s++) {
      x += (rand() - 0.5) * 26;
      y += 8 + rand() * 24;
      ctx.lineTo(x, y);
      if (rand() < 0.2) {
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.5) * 22, y + 8 + rand() * 22);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawRivets(ctx, size, step = 128, color = 'rgba(18,22,19,.85)') {
  ctx.save();
  for (let y = step / 2; y < size; y += step) {
    for (let x = step / 2; x < size; x += step) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 5, y + 6, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(205,200,170,.18)';
      ctx.beginPath();
      ctx.arc(x + 3.6, y + 4.4, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export class TextureFactory {
  constructor(renderer = null) {
    this.cache = new Map();
    this.signCache = new Map();
    this.decalCache = new Map();
    this.renderer = renderer;
    this.size = 512;
    this.anisotropy = 4;
  }

  setRenderer(renderer) {
    this.renderer = renderer;
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  _texture(canvas, srgb = true, repeat = true) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.anisotropy;
    tex.needsUpdate = true;
    return tex;
  }

  _makeBump(colorCanvas, name) {
    const size = 256;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.drawImage(colorCanvas, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < data.data.length; i += 4) {
      const l = data.data[i] * 0.299 + data.data[i + 1] * 0.587 + data.data[i + 2] * 0.114;
      const v = Math.max(0, Math.min(255, (l - 128) * 1.2 + 128));
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
    }
    ctx.putImageData(data, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = this.anisotropy;
    return tex;
  }

  _register(name, canvas, { bump = true, repeat = true } = {}) {
    const map = this._texture(canvas, true, repeat);
    const bumpMap = bump ? this._makeBump(canvas, name) : null;
    const entry = { map, bumpMap, name };
    this.cache.set(name, entry);
    return entry;
  }

  get(name) {
    return this.cache.get(name);
  }

  async preload(onProgress) {
    const generators = [
      ['concrete', () => this.makeConcrete()],
      ['concreteFloor', () => this.makeConcreteFloor()],
      ['ceilingTiles', () => this.makeCeilingTiles()],
      ['paintedMetal', () => this.makePaintedMetal()],
      ['rustMetal', () => this.makeRustMetal()],
      ['metalFloor', () => this.makeMetalFloor()],
      ['wallpaper', () => this.makeWallpaper()],
      ['tileWall', () => this.makeTileWall()],
      ['wood', () => this.makeWood()],
      ['woodPale', () => this.makeWoodPale()],
      ['fabric', () => this.makeFabric()],
      ['mattress', () => this.makeMattress()],
      ['paper', () => this.makePaper()],
      ['dirt', () => this.makeDirt()],
      ['water', () => this.makeWater()]
    ];
    for (let i = 0; i < generators.length; i++) {
      const [name, gen] = generators[i];
      if (!this.cache.has(name)) this._register(name, gen());
      onProgress?.((i + 1) / generators.length, name);
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    // Small decal and sign atlases are generated on demand.
  }

  makeConcrete() {
    const s = this.size;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const rand = mulberry32(33471);
    const n1 = new TileNoise(1182, 3, 5);
    const n2 = new TileNoise(9821, 16, 3);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = x / s;
        const v = y / s;
        const broad = n1.sample(u, v);
        const fine = n2.sample(u, v);
        const grain = (rand() - 0.5) * 12;
        const base = 104 + broad * 33 - fine * 13 + grain;
        const i = (y * s + x) * 4;
        img.data[i] = base * 0.93;
        img.data[i + 1] = base * 0.98;
        img.data[i + 2] = base * 0.9;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Damp patches, mostly green-black, with a few pale mineral blooms.
    for (let i = 0; i < 12; i++) {
      const x = rand() * s;
      const y = rand() * s;
      drawStain(ctx, x, y, 30 + rand() * 120, [30, 44, 32], 0.06 + rand() * 0.13);
    }
    for (let i = 0; i < 7; i++) {
      drawStain(ctx, rand() * s, rand() * s, 20 + rand() * 65, [168, 168, 144], 0.035 + rand() * 0.05);
    }
    // Vertical seepage lines.
    for (let i = 0; i < 6; i++) {
      const x = rand() * s;
      const w = 3 + rand() * 17;
      const top = rand() * s * 0.4;
      const grad = ctx.createLinearGradient(0, top, 0, top + 140 + rand() * 260);
      grad.addColorStop(0, 'rgba(25,33,27,.26)');
      grad.addColorStop(1, 'rgba(25,33,27,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, top, w, 300);
    }
    // Formwork tie holes.
    ctx.strokeStyle = 'rgba(33,38,31,.55)';
    for (let i = 0; i < 4; i++) {
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(rand() * s, rand() * s, 2.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawCrack(ctx, rand, s, 'rgba(28,31,25,.52)', 2);
    ctx.strokeStyle = 'rgba(26,30,26,.38)';
    ctx.lineWidth = 2;
    const seamY = s * (0.47 + rand() * .1);
    ctx.beginPath();
    ctx.moveTo(0, seamY);
    ctx.lineTo(s, seamY + (rand() - .5) * 8);
    ctx.stroke();
    return c;
  }

  makeConcreteFloor() {
    const s = this.size;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const rand = mulberry32(87332);
    const n1 = new TileNoise(1244, 4, 5);
    const n2 = new TileNoise(5321, 22, 3);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const broad = n1.sample(x / s, y / s);
        const fine = n2.sample(x / s, y / s);
        const grain = (rand() - .5) * 10;
        const base = 70 + broad * 23 - fine * 12 + grain;
        const i = (y * s + x) * 4;
        img.data[i] = base * 0.91;
        img.data[i + 1] = base * 0.97;
        img.data[i + 2] = base * 0.88;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Two expansion joints per tile.
    ctx.strokeStyle = 'rgba(22,26,22,.62)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(159,159,137,.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, s / 2 + 3); ctx.lineTo(s, s / 2 + 3); ctx.stroke();
    // Oil and water stains.
    for (let i = 0; i < 9; i++) drawStain(ctx, rand() * s, rand() * s, 28 + rand() * 110, [16, 22, 18], 0.08 + rand() * 0.18);
    for (let i = 0; i < 3; i++) drawStain(ctx, rand() * s, rand() * s, 40 + rand() * 90, [72, 72, 54], 0.08);
    // Scuffs.
    ctx.globalAlpha = 0.24;
    for (let i = 0; i < 28; i++) {
      ctx.strokeStyle = i % 3 ? 'rgba(22,24,20,.55)' : 'rgba(185,180,158,.3)';
      ctx.lineWidth = 1 + rand() * 2;
      ctx.beginPath();
      const x = rand() * s;
      const y = rand() * s;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 12 + rand() * 40, y + rand() * 7 - 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawCrack(ctx, rand, s, 'rgba(20,23,20,.55)', 3);
    return c;
  }

  makeCeilingTiles() {
    const s = this.size;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const rand = mulberry32(23511);
    ctx.fillStyle = '#6d6d60';
    ctx.fillRect(0, 0, s, s);
    const cell = s / 4;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const tone = 100 + rand() * 28;
        ctx.fillStyle = rgba(tone * .95, tone, tone * .89);
        ctx.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
        ctx.fillStyle = 'rgba(26,28,24,.28)';
        ctx.fillRect(x * cell + 3, y * cell + cell - 10, cell - 6, 7);
        for (let i = 0; i < 110; i++) {
          const px = x * cell + 6 + rand() * (cell - 12);
          const py = y * cell + 6 + rand() * (cell - 12);
          ctx.fillStyle = rand() < .5 ? 'rgba(32,35,28,.18)' : 'rgba(200,196,170,.08)';
          ctx.fillRect(px, py, 1.2, 1.2);
        }
      }
    }
    ctx.strokeStyle = 'rgba(24,26,22,.6)';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(s, i * cell); ctx.stroke();
    }
    for (let i = 0; i < 7; i++) drawStain(ctx, rand() * s, rand() * s, 20 + rand() * 95, [105, 78, 37], .11 + rand() * .12);
    drawCrack(ctx, rand, s, 'rgba(30,31,25,.35)', 2);
    return c;
  }

  makePaintedMetal() {
    const s = this.size;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const rand = mulberry32(99132);
    const n1 = new TileNoise(9092, 4, 4);
    const n2 = new TileNoise(2210, 18, 3);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = n1.sample(x / s, y / s);
        const f = n2.sample(x / s, y / s);
        const grain = (rand() - .5) * 4;
        const base = 59 + n * 15 - f * 10 + grain;
        const i = (y * s + x) * 4;
        img.data[i] = base * .83;
        img.data[i + 1] = base * 1.02;
        img.data[i + 2] = base * .92;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Two vertical panels and one horizontal seam.
    ctx.strokeStyle = 'rgba(10,15,12,.58)';
    ctx.lineWidth = 3;
    for (const x of [s * .5, 0]) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(175,175,150,.09)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(4, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * .5 + 4, 0); ctx.lineTo(s * .5 + 4, s); ctx.stroke();
    drawRivets(ctx, s, 64, 'rgba(12,17,14,.68)');
    // Chipped paint and rust blooms.
    for (let i = 0; i < 18; i++) {
      const x = rand() * s, y = rand() * s, r = 2 + rand() * 8;
      ctx.fillStyle = rgba(86 + rand() * 36, 53 + rand() * 20, 33, .5 + rand() * .4);
      ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.5 + rand()), rand() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 7; i++) {
      drawStain(ctx, rand() * s, rand() * s, 20 + rand() * 80, [93, 50, 26], .08 + rand() * .1);
    }
    ctx.globalAlpha = .25;
    for (let i = 0; i < 24; i++) {
      ctx.strokeStyle = 'rgba(194,194,164,.45)';
      ctx.lineWidth = .8;
      const x = rand() * s;
      const y = rand() * s;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10 + rand() * 32, y + (rand() - .5) * 6); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return c;
  }

  makeRustMetal() {
    const s = this.size;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const rand = mulberry32(23811);
    const n1 = new TileNoise(2187, 5, 5);
    const n2 = new TileNoise(7712, 23, 3);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = n1.sample(x / s, y / s);
        const f = n2.sample(x / s, y / s);
        const pitting = (rand() - .5) * 26;
        const base = 77 + n * 42 + f * 18 + pitting;
        const i = (y * s + x) * 4;
        img.data[i] = base * 1.25;
        img.data[i + 1] = base * .69;
        img.data[i + 2] = base * .4;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 25; i++) {
      const x = rand() * s, y = rand() * s, r = 4 + rand() * 26;
      ctx.fillStyle = i % 4 === 0 ? 'rgba(40,35,26,.34)' : 'rgba(138,77,39,.22)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 9; i++) drawStain(ctx, rand() * s, rand() * s, 20 + rand() * 55, [38, 30, 22], .2);
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = 'rgba(160,101,53,.45)';
      ctx.lineWidth = 2 + rand() * 3;
      ctx.beginPath();
      const x = rand() * s, y = rand() * s;
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 20, y + 18, x + 12, y + 52, x + 25, y + 70);
      ctx.stroke();
    }
    return c;
  }

  makeMetalFloor() {
    const s = this.size;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const rand = mulberry32(49921);
    const n1 = new TileNoise(3212, 5, 4);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = n1.sample(x / s, y / s);
        const grain = (rand() - .5) * 10;
        const base = 56 + n * 19 + grain;
        const i = (y * s + x) * 4;
        img.data[i] = base * .9;
        img.data[i + 1] = base * .96;
        img.data[i + 2] = base * .93;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Raised diamond-plate tread, drawn as small paired slashes.
    const spacing = s / 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const px = x * spacing + spacing * .3;
        const py = y * spacing + spacing * .36;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((x + y) % 2 ? .72 : -.72);
        ctx.fillStyle = 'rgba(173,175,157,.13)';
        ctx.fillRect(-7, -2, 14, 3);
        ctx.fillStyle = 'rgba(13,16,14,.35)';
        ctx.fillRect(-7, 1.5, 14, 2);
        ctx.restore();
      }
    }
    for (let i = 0; i < 5; i++) drawStain(ctx, rand() * s, rand() * s, 40 + rand() * 120, [29, 36, 29], .14 + rand() * .15);
    ctx.strokeStyle = 'rgba(12,15,13,.55)';
    ctx.lineWidth = 5;
    ctx.strokeRect(2, 2, s - 4, s - 4);
    return c;
  }

  makeWallpaper() {
    const s = this.size;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const rand = mulberry32(77821);
    const n1 = new TileNoise(8172, 4, 4);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = n1.sample(x / s, y / s);
        const base = 123 + n * 20;
        const i = (y * s + x) * 4;
        img.data[i] = base * 1.04;
        img.data[i + 1] = base * .99;
        img.data[i + 2] = base * .79;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Faded vertical stripe and a sparse botanical print.
    ctx.fillStyle = 'rgba(105,110,77,.25)';
    for (let x = 0; x < s; x += 76) ctx.fillRect(x, 0, 22, s);
    ctx.fillStyle = 'rgba(81,77,56,.2)';
    for (let x = 0; x < s; x += 76) {
      for (let y = 30; y < s; y += 81) {
        ctx.beginPath();
        ctx.ellipse(x + 50, y, 7, 17, .45, 0, Math.PI * 2);
        ctx.ellipse(x + 38, y + 10, 5, 12, -.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 0; i < 9; i++) {
      drawStain(ctx, rand() * s, rand() * s, 35 + rand() * 100, [93, 74, 42], .08 + rand() * .15);
    }
    // Peeling seam.
    ctx.strokeStyle = 'rgba(60,50,34,.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * .83, 0);
    ctx.lineTo(s * .83, s);
    ctx.stroke();
    ctx.fillStyle = 'rgba(73,60,42,.3)';
    ctx.beginPath();
    ctx.moveTo(s * .83, 0); ctx.lineTo(s * .88, 0); ctx.lineTo(s * .85, 85); ctx.lineTo(s * .83, 70); ctx.fill();
    return c;
  }

  makeTileWall() {
    const s = this.size;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const rand = mulberry32(11729);
    ctx.fillStyle = '#575a4b';
    ctx.fillRect(0, 0, s, s);
    const cols = 5, rows = 10;
    const cw = s / cols, ch = s / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tone = 133 + rand() * 19;
        ctx.fillStyle = rgba(tone * .97, tone, tone * .82);
        ctx.fillRect(x * cw + 2, y * ch + 2, cw - 4, ch - 4);
        ctx.fillStyle = 'rgba(216,212,179,.12)';
        ctx.fillRect(x * cw + 2, y * ch + 2, cw - 4, 2);
        if (rand() < .17) {
          ctx.strokeStyle = 'rgba(57,53,38,.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          const cx = x * cw + cw * (.2 + rand() * .6);
          const cy = y * ch + ch * .3;
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + (rand() - .5) * 18, cy + ch * .35);
          ctx.stroke();
        }
      }
    }
    for (let i = 0; i < 14; i++) drawStain(ctx, rand() * s, rand() * s, 15 + rand() * 90, [69, 65, 43], .07 + rand() * .17);
    for (let i = 0; i < 7; i++) {
      const x = rand() * s;
      const y = rand() * s;
      ctx.fillStyle = 'rgba(68,63,38,.2)';
      ctx.fillRect(x, y, 3 + rand() * 14, 5 + rand() * 25);
    }
    return c;
  }

  makeWood() {
    const s = this.size;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const rand = mulberry32(9917);
    const n1 = new TileNoise(6612, 3, 3);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = x / s, v = y / s;
        const grain = Math.sin((u * 52 + n1.sample(u, v) * 6.5) * Math.PI * 2) * .5 + .5;
        const base = 59 + grain * 24 + n1.sample(u * .3, v) * 22;
        const i = (y * s + x) * 4;
        img.data[i] = base * 1.1;
        img.data[i + 1] = base * .86;
        img.data[i + 2] = base * .62;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(34,23,15,.5)';
    ctx.lineWidth = 2;
    for (let x = 0; x < s; x += s / 3) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
    }
    for (let i = 0; i < 8; i++) drawStain(ctx, rand() * s, rand() * s, 18 + rand() * 60, [28, 20, 14], .12);
    return c;
  }

  makeWoodPale() {
    const s = this.size;
    const c = this.makeWood();
    const ctx = c.getContext('2d');
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = 'rgba(166,137,94,.36)';
    ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = 'source-over';
    const rand = mulberry32(4411);
    for (let i = 0; i < 11; i++) drawStain(ctx, rand() * s, rand() * s, 12 + rand() * 55, [60, 36, 21], .08);
    return c;
  }

  makeFabric() {
    const s = this.size;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const rand = mulberry32(4310);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const weave = ((x % 4 < 2) ^ (y % 4 < 2)) ? 4 : -3;
        const grain = (rand() - .5) * 8;
        const base = 64 + weave + grain;
        const i = (y * s + x) * 4;
        img.data[i] = base * .9;
        img.data[i + 1] = base * .96;
        img.data[i + 2] = base * .82;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 6; i++) drawStain(ctx, rand() * s, rand() * s, 25 + rand() * 80, [20, 24, 18], .1);
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = 'rgba(170,164,133,.1)';
      ctx.beginPath();
      const y = rand() * s;
      ctx.moveTo(0, y);
      ctx.lineTo(s, y + 20);
      ctx.stroke();
    }
    return c;
  }

  makeMattress() {
    const s = this.size;
    const c = this.makeFabric();
    const ctx = c.getContext('2d');
    const rand = mulberry32(78113);
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = 'rgba(196,183,150,.3)';
    ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 10; i++) drawStain(ctx, rand() * s, rand() * s, 15 + rand() * 65, [102, 72, 35], .07 + rand() * .2);
    for (let i = 0; i < 3; i++) drawStain(ctx, rand() * s, rand() * s, 30 + rand() * 60, [32, 28, 21], .12);
    return c;
  }

  makePaper() {
    const s = this.size;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const rand = mulberry32(4431);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const grain = (rand() - .5) * 12;
        const fiber = Math.sin(x * .08 + y * .01) * 2;
        const base = 184 + grain + fiber;
        const i = (y * s + x) * 4;
        img.data[i] = base;
        img.data[i + 1] = base * .955;
        img.data[i + 2] = base * .82;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 7; i++) drawStain(ctx, rand() * s, rand() * s, 10 + rand() * 48, [128, 101, 52], .05 + rand() * .08);
    return c;
  }

  makeDirt() {
    const s = this.size;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const rand = mulberry32(12111);
    const n1 = new TileNoise(9511, 4, 5);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = n1.sample(x / s, y / s);
        const grain = (rand() - .5) * 30;
        const base = 63 + n * 35 + grain;
        const i = (y * s + x) * 4;
        img.data[i] = base * 1.08;
        img.data[i + 1] = base * .95;
        img.data[i + 2] = base * .77;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 22; i++) drawStain(ctx, rand() * s, rand() * s, 4 + rand() * 35, [24, 20, 14], .16);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = 'rgba(194,180,146,.12)';
      ctx.fillRect(rand() * s, rand() * s, 1.5, 1.5);
    }
    return c;
  }

  makeWater() {
    const s = this.size;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const rand = mulberry32(73311);
    const n1 = new TileNoise(2181, 6, 4);
    const n2 = new TileNoise(7712, 34, 2);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = x / s, v = y / s;
        const a = n1.sample(u, v);
        const b = n2.sample(u, v);
        const ripple = (Math.sin(u * 42 + a * 5) + Math.cos(v * 35 - a * 4) + b * 2) * .25 + .5;
        const base = 24 + ripple * 18;
        const i = (y * s + x) * 4;
        img.data[i] = base * .72;
        img.data[i + 1] = base * .9;
        img.data[i + 2] = base * .89;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 12; i++) drawStain(ctx, rand() * s, rand() * s, 20 + rand() * 100, [13, 21, 19], .1);
    return c;
  }

  getSign(key, options = {}) {
    if (this.signCache.has(key)) return this.signCache.get(key);
    const {
      width = 512, height = 256, bg = '#2d342d', fg = '#d6d0b8',
      accent = '#b59760', title = '', lines = [], titleSize = 54,
      lineSize = 24, border = true, font = '"Noto Sans SC", "Microsoft YaHei", sans-serif', upper = false
    } = options;
    const c = makeCanvas(width, height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    const rand = mulberry32(key.length * 771 + width);
    // Subtle patina.
    for (let i = 0; i < 10; i++) {
      const grad = ctx.createRadialGradient(rand() * width, rand() * height, 0, rand() * width, rand() * height, 30 + rand() * 130);
      grad.addColorStop(0, 'rgba(20,24,20,.12)');
      grad.addColorStop(1, 'rgba(20,24,20,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
    if (border) {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = .42;
      ctx.lineWidth = 2;
      ctx.strokeRect(12, 12, width - 24, height - 24);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    ctx.font = `500 ${titleSize}px ${font}`;
    const titleText = upper ? title.toUpperCase() : title;
    ctx.fillText(titleText, width / 2, height * (lines.length ? .37 : .5));
    ctx.fillStyle = accent;
    ctx.font = `400 ${lineSize}px ${font}`;
    lines.forEach((line, i) => {
      ctx.fillText((upper ? line.toUpperCase() : line), width / 2, height * .55 + i * (lineSize * 1.55));
    });
    // Scuffs.
    ctx.globalAlpha = .11;
    ctx.strokeStyle = '#0c100d';
    for (let i = 0; i < 14; i++) {
      ctx.lineWidth = .6 + rand() * 1.5;
      ctx.beginPath();
      const x = rand() * width, y = rand() * height;
      ctx.moveTo(x, y); ctx.lineTo(x + (rand() - .5) * 50, y + (rand() - .5) * 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const tex = this._texture(c, true, false);
    this.signCache.set(key, tex);
    return tex;
  }

  getLabel(key, title, sub = '', options = {}) {
    return this.getSign(key, {
      width: 512, height: 180, title, lines: sub ? [sub] : [],
      titleSize: title.length > 12 ? 38 : 52, lineSize: 19,
      bg: options.bg || '#222821', fg: options.fg || '#c9c6ae',
      border: true
    });
  }

  getDecal(name) {
    if (this.decalCache.has(name)) return this.decalCache.get(name);
    const size = 512;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const rand = mulberry32(name.length * 9181 + 22);
    if (name === 'grime' || name === 'mold' || name === 'waterstain') {
      ctx.clearRect(0, 0, size, size);
      const color = name === 'mold' ? [40, 52, 33] : [29, 30, 25];
      const blobs = name === 'waterstain' ? 2 : 9;
      for (let i = 0; i < 20 * blobs; i++) {
        const ang = rand() * Math.PI * 2;
        const rad = Math.pow(rand(), .6) * size * .34;
        const x = size / 2 + Math.cos(ang) * rad;
        const y = size / 2 + Math.sin(ang) * rad;
        drawStain(ctx, x, y, 15 + rand() * 70, color, .055 + rand() * .075);
      }
      if (name === 'waterstain') {
        ctx.globalAlpha = .17;
        for (let i = 0; i < 7; i++) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2 + rand() * 4;
          ctx.beginPath();
          ctx.moveTo(200 + rand() * 110, 45 + rand() * 40);
          ctx.bezierCurveTo(170 + rand() * 160, 180, 190 + rand() * 180, 280, 220 + rand() * 130, 350 + rand() * 80);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      if (name === 'mold') {
        for (let i = 0; i < 200; i++) {
          const a = rand() * Math.PI * 2;
          const r = Math.pow(rand(), .5) * size * .34;
          ctx.fillStyle = `rgba(35,44,28,${.06 + rand() * .14})`;
          ctx.beginPath();
          ctx.arc(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, 1 + rand() * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (name === 'handprint') {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(35,29,21,.45)';
      ctx.beginPath();
      ctx.ellipse(260, 300, 56, 72, .12, 0, Math.PI * 2);
      ctx.fill();
      const fingers = [
        [206, 232, 18, 62, -.45], [229, 198, 18, 78, -.22], [258, 188, 17, 84, -.08],
        [288, 198, 16, 73, .14], [310, 232, 14, 51, .38]
      ];
      for (const [x, y, rx, ry, rot] of fingers) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = .17;
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = 'rgba(35,29,21,.5)';
        ctx.fillRect(170 + rand() * 200, 220 + rand() * 160, 1 + rand() * 2, 1 + rand() * 3);
      }
    } else if (name === 'footprint') {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(25,24,18,.26)';
      ctx.beginPath();
      ctx.ellipse(256, 280, 70, 120, .05, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(256, 175, 58, 48, .02, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = this._texture(c, true, false);
    this.decalCache.set(name, tex);
    return tex;
  }

  makeGradientSky(top = '#111b1b', bottom = '#030503', accent = '#39463b') {
    const c = makeCanvas(1024, 512);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, top);
    g.addColorStop(.48, bottom);
    g.addColorStop(1, '#010201');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    const glow = ctx.createRadialGradient(512, 220, 1, 512, 220, 140);
    glow.addColorStop(0, accent);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = .15;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(201,200,178,${.1 + Math.random() * .2})`;
      const x = Math.random() * 1024;
      const y = Math.random() * 250;
      ctx.fillRect(x, y, 1, 1);
    }
    return c;
  }

  makeDustSprite() {
    const size = 64;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
    g.addColorStop(0, 'rgba(214,211,185,.85)');
    g.addColorStop(.28, 'rgba(203,199,171,.35)');
    g.addColorStop(1, 'rgba(203,199,171,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
}
