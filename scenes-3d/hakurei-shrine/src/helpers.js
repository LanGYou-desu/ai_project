import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ *
 * Palette — deliberately softened so the 3D scene and the pixel art
 * share the same dusty, sun-faded anime palette.
 * ------------------------------------------------------------------ */
export const PAL = {
  vermilion: 0xae4543,
  vermilionDeep: 0x7d2f33,
  vermilionLight: 0xc85e58,
  redMuted: 0x9b4145,
  plaster: 0xe7dfcc,
  plasterShade: 0xd6cbb6,
  cream: 0xf0e6d2,
  paper: 0xf2e7cf,
  wood: 0x8b6042,
  woodLight: 0xb88b61,
  woodPale: 0xc9a67d,
  woodDark: 0x513a2c,
  woodInk: 0x3c2d27,
  roof: 0x353947,
  roofDeep: 0x222530,
  roofEdge: 0x4b5060,
  stone: 0x909287,
  stoneLight: 0xaeab9b,
  stoneDark: 0x646a66,
  stoneBlue: 0x828b88,
  moss: 0x74825b,
  mossLight: 0x94a06c,
  grass: 0x8d9b6d,
  grassDeep: 0x667854,
  leaf: 0x667f53,
  leafDeep: 0x4d6446,
  leafLight: 0x91a371,
  blossom: 0xe5acb8,
  blossomDeep: 0xc98699,
  blossomLight: 0xf4d4d3,
  gold: 0xc09c5b,
  goldLight: 0xd7b977,
  ink: 0x2d2c32,
  indigo: 0x414754,
  skyWarm: 0xeadbc0,
  warmLight: 0xffdca0,
  water: 0x8ba7a2,
};

const gradientData = new Uint8Array([78, 138, 198, 255]);
export const toonGradient = new THREE.DataTexture(gradientData, 4, 1, THREE.RedFormat);
toonGradient.minFilter = THREE.NearestFilter;
toonGradient.magFilter = THREE.NearestFilter;
toonGradient.generateMipmaps = false;
toonGradient.needsUpdate = true;

/* ------------------------------------------------------------------ *
 * Small deterministic helpers
 * ------------------------------------------------------------------ */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInQuad = (t) => t * t;

/* ------------------------------------------------------------------ *
 * Canvas textures
 * ------------------------------------------------------------------ */
export function canvasTexture(width, height, draw, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = options.colorSpace ?? THREE.SRGBColorSpace;
  texture.wrapS = options.wrapS ?? THREE.ClampToEdgeWrapping;
  texture.wrapT = options.wrapT ?? THREE.ClampToEdgeWrapping;
  if (options.repeat) texture.repeat.set(options.repeat[0], options.repeat[1]);
  if (options.anisotropy) texture.anisotropy = options.anisotropy;
  if (options.nearest) {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
  }
  texture.needsUpdate = true;
  return texture;
}

function rrect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function createGroundTexture(size = 1024) {
  const rnd = mulberry32(0x5a17);
  return canvasTexture(size, size, (ctx, w, h) => {
    const base = ctx.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, '#93a173');
    base.addColorStop(0.45, '#87966a');
    base.addColorStop(1, '#7d8c64');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // Broad, hand-painted patches of moss and worn earth.
    for (let i = 0; i < 240; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const rx = 16 + rnd() * 104;
      const ry = 10 + rnd() * 60;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rnd() * Math.PI);
      ctx.globalAlpha = 0.08 + rnd() * 0.13;
      ctx.fillStyle = ['#b6b586', '#6f835a', '#9ba878', '#c6b98a', '#78886a'][
        Math.floor(rnd() * 5)
      ];
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // The courtyard is more trodden and sandy than the edges.
    const courtyard = ctx.createRadialGradient(0.5 * w, 0.73 * h, 0.03 * w, 0.5 * w, 0.72 * h, 0.36 * w);
    courtyard.addColorStop(0, 'rgba(188, 168, 124, 0.54)');
    courtyard.addColorStop(0.56, 'rgba(165, 155, 111, 0.27)');
    courtyard.addColorStop(1, 'rgba(120, 129, 95, 0)');
    ctx.fillStyle = courtyard;
    ctx.fillRect(0, 0, w, h);

    // Fine painterly grass strokes.
    ctx.lineCap = 'round';
    for (let i = 0; i < 6200; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const len = 1 + rnd() * 7;
      ctx.globalAlpha = 0.12 + rnd() * 0.3;
      ctx.strokeStyle = ['#627a51', '#a6af7c', '#c1b783', '#718360', '#506a4c'][
        Math.floor(rnd() * 5)
      ];
      ctx.lineWidth = 0.7 + rnd() * 1.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 3, y - len);
      ctx.stroke();
    }

    // Soft pebbles and specks.
    for (let i = 0; i < 400; i++) {
      ctx.globalAlpha = 0.15 + rnd() * 0.35;
      ctx.fillStyle = rnd() > 0.5 ? '#d1c7a9' : '#7b806d';
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, 0.6 + rnd() * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, { anisotropy: 8 });
}

export function createStoneTexture(width = 1024, height = 384) {
  const rnd = mulberry32(0x917c);
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = '#656c69';
    ctx.fillRect(0, 0, w, h);
    const rows = 5;
    const rowH = h / rows;
    for (let row = 0; row < rows; row++) {
      let x = -row * 42;
      const y = row * rowH;
      while (x < w) {
        const bw = 90 + rnd() * 105;
        const inset = 2.5;
        const tone = 132 + Math.floor(rnd() * 36);
        const warm = Math.floor(rnd() * 9);
        ctx.fillStyle = `rgb(${tone + warm}, ${tone + 4}, ${tone - 7})`;
        rrect(ctx, x + inset, y + inset, bw - inset * 2, rowH - inset * 2, 5);
        ctx.fill();
        // Stylized stone facets.
        ctx.globalAlpha = 0.13;
        ctx.fillStyle = rnd() > 0.5 ? '#e4e2d1' : '#333b3b';
        ctx.beginPath();
        ctx.moveTo(x + 9, y + 9);
        ctx.lineTo(x + bw * 0.55, y + 8);
        ctx.lineTo(x + bw * 0.31, y + rowH - 12);
        ctx.lineTo(x + 8, y + rowH * 0.56);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        // Mortar shadow.
        ctx.strokeStyle = 'rgba(43,48,47,0.55)';
        ctx.lineWidth = 2;
        rrect(ctx, x + inset, y + inset, bw - inset * 2, rowH - inset * 2, 5);
        ctx.stroke();
        x += bw;
      }
    }
    // Moss gathering around the lower edge.
    const moss = ctx.createLinearGradient(0, h * 0.55, 0, h);
    moss.addColorStop(0, 'rgba(98, 112, 76, 0)');
    moss.addColorStop(0.68, 'rgba(98, 112, 76, 0.14)');
    moss.addColorStop(1, 'rgba(75, 94, 65, 0.56)');
    ctx.fillStyle = moss;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      ctx.globalAlpha = 0.08 + rnd() * 0.25;
      ctx.fillStyle = rnd() > 0.35 ? '#77845a' : '#a3a27d';
      ctx.beginPath();
      ctx.ellipse(rnd() * w, h * 0.72 + rnd() * h * 0.28, 2 + rnd() * 10, 1 + rnd() * 5, rnd(), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeat: [3, 1],
    anisotropy: 8,
  });
}

export function createPaverTexture(width = 512, height = 512) {
  const rnd = mulberry32(0x7c31);
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = '#c7c5b8';
    ctx.fillRect(0, 0, w, h);
    // Speckled mineral grain.
    for (let i = 0; i < 2600; i++) {
      const tone = rnd() > 0.5 ? 255 : 80;
      ctx.globalAlpha = 0.025 + rnd() * 0.08;
      ctx.fillStyle = `rgba(${tone},${tone},${tone},1)`;
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, 0.5 + rnd() * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // A few quiet hairline cracks.
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = '#7f8078';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      let x = rnd() * w;
      let y = rnd() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j++) {
        x += (rnd() - 0.5) * 42;
        y += 8 + rnd() * 26;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Soft lime / moss wash toward one edge.
    ctx.globalAlpha = 0.1;
    const moss = ctx.createRadialGradient(w * 0.78, h * 0.86, 4, w * 0.78, h * 0.86, w * 0.5);
    moss.addColorStop(0, '#87976b');
    moss.addColorStop(1, 'rgba(135,151,107,0)');
    ctx.fillStyle = moss;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeat: [1, 1],
    anisotropy: 8,
  });
}

export function createWoodTexture(width = 512, height = 128, dark = false) {  const rnd = mulberry32(dark ? 0x54a2 : 0x9911);
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = dark ? '#573c2c' : '#966a46';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 110; i++) {
      ctx.globalAlpha = 0.05 + rnd() * 0.17;
      ctx.strokeStyle = rnd() > 0.45 ? (dark ? '#2f241f' : '#4f3528') : (dark ? '#8c6341' : '#c99a68');
      ctx.lineWidth = 0.6 + rnd() * 2.1;
      const y = rnd() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) {
        ctx.lineTo(x, y + Math.sin(x * 0.022 + i) * (2 + rnd() * 4));
      }
      ctx.stroke();
    }
    // A few knots.
    for (let i = 0; i < 5; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#3f2e25';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(x, y, 5 + rnd() * 8, 2 + rnd() * 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeat: [4, 1],
    anisotropy: 4,
  });
}

export function createRoofTexture(width = 512, height = 512) {
  const rnd = mulberry32(0x22aa);
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = '#383d4c';
    ctx.fillRect(0, 0, w, h);
    const rowH = 42;
    for (let row = 0; row < Math.ceil(h / rowH); row++) {
      const y = row * rowH;
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#2b2f3b';
      ctx.fillRect(0, y, w, rowH - 4);
      ctx.globalAlpha = 1;
      for (let x = (row % 2) * 16; x < w; x += 32) {
        const g = ctx.createLinearGradient(x, 0, x + 28, 0);
        g.addColorStop(0, 'rgba(89,96,115,0.1)');
        g.addColorStop(0.45, 'rgba(104,112,130,0.25)');
        g.addColorStop(1, 'rgba(27,30,41,0.56)');
        ctx.fillStyle = g;
        ctx.fillRect(x + 2, y + 3, 27, rowH - 10);
        ctx.strokeStyle = 'rgba(22,24,32,0.55)';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(x + 2, y + 3, 27, rowH - 10);
      }
      ctx.strokeStyle = 'rgba(17,19,26,0.72)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, y + rowH - 2);
      ctx.lineTo(w, y + rowH - 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(121,127,144,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 3);
      ctx.lineTo(w, y + 3);
      ctx.stroke();
    }
    for (let i = 0; i < 140; i++) {
      ctx.globalAlpha = 0.04 + rnd() * 0.08;
      ctx.fillStyle = rnd() > 0.5 ? '#aab0c0' : '#0d1019';
      ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 5, 1 + rnd() * 4);
    }
    ctx.globalAlpha = 1;
  }, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeat: [1, 2],
    anisotropy: 8,
  });
}

export function createShojiTexture(cols = 4, rows = 7, warm = false) {
  return canvasTexture(256, 384, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    if (warm) {
      bg.addColorStop(0, '#ecdbb8');
      bg.addColorStop(1, '#d8c396');
    } else {
      bg.addColorStop(0, '#eee6d4');
      bg.addColorStop(1, '#dfd4bd');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = i % 2 ? '#b8a88d' : '#fff8e8';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#5c4130';
    ctx.lineWidth = 11;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.lineWidth = 3.5;
    for (let c = 1; c < cols; c++) {
      const x = (w / cols) * c;
      ctx.beginPath();
      ctx.moveTo(x, 5);
      ctx.lineTo(x, h - 5);
      ctx.stroke();
    }
    for (let r = 1; r < rows; r++) {
      const y = (h / rows) * r;
      ctx.beginPath();
      ctx.moveTo(5, y);
      ctx.lineTo(w - 5, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(40,27,20,0.34)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(12, 12, w - 24, h - 24);
  }, { anisotropy: 4 });
}

export function createLanternTexture(label = '奉納') {
  return canvasTexture(256, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#d9bd8a');
    g.addColorStop(0.28, '#f4e4bf');
    g.addColorStop(0.58, '#fbecce');
    g.addColorStop(1, '#cfa873');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8d3438';
    ctx.fillRect(0, 0, w, 26);
    ctx.fillRect(0, h - 26, w, 26);
    for (let i = 0; i < 10; i++) {
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#a7865f';
      ctx.fillRect(0, 38 + i * 44, w, 1.5);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#6e2d30';
    ctx.font = '74px "Yu Mincho", "MS Mincho", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const chars = [...label];
    chars.forEach((ch, i) => ctx.fillText(ch, w / 2, h / 2 + (i - (chars.length - 1) / 2) * 78));
    ctx.fillStyle = 'rgba(111,76,43,0.2)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 78, 0, Math.PI * 2);
    ctx.stroke();
  }, { anisotropy: 4 });
}

export function createPlaqueTexture(text, options = {}) {
  const {
    background = '#25262b',
    foreground = '#d6b66e',
    border = '#b18e4f',
    vertical = false,
    font = 'bold 84px "Yu Mincho", "MS Mincho", serif',
    width = 512,
    height = 168,
  } = options;
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = border;
    ctx.lineWidth = 9;
    ctx.strokeRect(13, 13, w - 26, h - 26);
    ctx.strokeStyle = 'rgba(255,236,181,0.24)';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, w - 48, h - 48);
    ctx.fillStyle = foreground;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (vertical) {
      ctx.font = font;
      const chars = [...text];
      const step = Math.min(112, (h - 52) / Math.max(1, chars.length));
      chars.forEach((ch, i) => ctx.fillText(ch, w / 2, 34 + step * (i + 0.5)));
    } else {
      let size = 80;
      ctx.font = font;
      while (ctx.measureText(text).width > w - 74 && size > 20) {
        size -= 4;
        ctx.font = font.replace(/\d+px/, `${size}px`);
      }
      ctx.fillText(text, w / 2, h / 2 + 2);
    }
  }, { anisotropy: 4 });
}

export function createNoticeTexture() {
  const rnd = mulberry32(0x44cd);
  return canvasTexture(256, 352, (ctx, w, h) => {
    ctx.fillStyle = '#e8dcc1';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(135,103,67,0.12)';
    for (let i = 0; i < 30; i++) ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 12, 1 + rnd() * 3);
    ctx.strokeStyle = '#7b5a3d';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#4b4033';
    ctx.font = 'bold 30px "Yu Mincho", "MS Mincho", serif';
    ctx.textAlign = 'center';
    ctx.fillText('お知らせ', w / 2, 50);
    ctx.font = '19px "Yu Mincho", "MS Mincho", serif';
    ctx.textAlign = 'left';
    const lines = [
      '博麗神社 秋季例大祭',
      '　十月十五日 斎行',
      '',
      '参拝の皆様へ',
      '　静かにご参拝ください。',
      '　御朱印は社務所にて。',
    ];
    lines.forEach((line, i) => ctx.fillText(line, 23, 92 + i * 33));
    ctx.fillStyle = '#a43e3f';
    ctx.beginPath();
    ctx.arc(w - 45, h - 50, 23, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1e2c3';
    ctx.font = 'bold 18px "Yu Mincho", serif';
    ctx.textAlign = 'center';
    ctx.fillText('博', w - 45, h - 43);
  }, { anisotropy: 4 });
}

export function createEmaTexture(index = 0) {
  const rnd = mulberry32(0x800 + index);
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#cfa36a';
    ctx.beginPath();
    ctx.moveTo(10, 22);
    ctx.lineTo(w - 10, 22);
    ctx.lineTo(w - 10, h - 18);
    ctx.lineTo(w / 2, h - 4);
    ctx.lineTo(10, h - 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#72533a';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#8a3b3e';
    ctx.font = 'bold 25px "Yu Mincho", serif';
    ctx.textAlign = 'center';
    ctx.fillText(index % 2 ? '願' : '福', w / 2, 61);
    ctx.strokeStyle = 'rgba(83,61,43,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(35, 78);
    ctx.lineTo(92, 78);
    ctx.moveTo(45, 91);
    ctx.lineTo(82, 91);
    ctx.stroke();
    ctx.fillStyle = 'rgba(60,43,32,0.12)';
    for (let i = 0; i < 9; i++) ctx.fillRect(rnd() * w, rnd() * h, 2, 1);
  }, { anisotropy: 4 });
}

export function createRopeTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#b7a06e';
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    for (let x = -h; x < w + h; x += 28) {
      ctx.strokeStyle = '#806f4d';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.stroke();
      ctx.strokeStyle = '#d8c793';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x + 7, 0);
      ctx.lineTo(x + h + 7, h);
      ctx.stroke();
      ctx.lineWidth = 11;
    }
    ctx.fillStyle = 'rgba(70,54,38,0.14)';
    ctx.fillRect(0, 0, w, h);
  }, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeat: [6, 1],
    anisotropy: 4,
  });
}

export function createSoftShadowTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(38, 38, 44, 0.55)');
    g.addColorStop(0.35, 'rgba(38, 38, 44, 0.32)');
    g.addColorStop(0.72, 'rgba(38, 38, 44, 0.1)');
    g.addColorStop(1, 'rgba(38, 38, 44, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { colorSpace: THREE.NoColorSpace });
}

export function createGlowTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255, 241, 195, 0.95)');
    g.addColorStop(0.25, 'rgba(255, 220, 147, 0.48)');
    g.addColorStop(0.62, 'rgba(255, 197, 108, 0.12)');
    g.addColorStop(1, 'rgba(255, 197, 108, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { colorSpace: THREE.NoColorSpace });
}

export function createCloudTexture() {
  return canvasTexture(512, 220, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.filter = 'blur(8px)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    const blobs = [
      [0.19, 0.64, 0.16, 0.16],
      [0.33, 0.5, 0.2, 0.23],
      [0.5, 0.56, 0.22, 0.21],
      [0.67, 0.51, 0.19, 0.22],
      [0.83, 0.61, 0.14, 0.16],
      [0.94, 0.68, 0.1, 0.1],
      [0.45, 0.35, 0.15, 0.14],
    ];
    for (const [x, y, rx, ry] of blobs) {
      ctx.beginPath();
      ctx.ellipse(x * w, y * h, rx * w, ry * h, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = 'blur(17px)';
    ctx.globalAlpha = 0.4;
    for (const [x, y, rx, ry] of blobs) {
      ctx.beginPath();
      ctx.ellipse(x * w, y * h + 8, rx * w * 1.15, ry * h * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = 'none';
    ctx.globalAlpha = 0.2;
    const shade = ctx.createLinearGradient(0, h * 0.45, 0, h * 0.9);
    shade.addColorStop(0, 'rgba(185, 211, 218, 0)');
    shade.addColorStop(0.65, 'rgba(155, 190, 200, 0.55)');
    shade.addColorStop(1, 'rgba(155, 190, 200, 0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, h * 0.4, w, h * 0.5);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = 'rgba(255, 247, 227, 0.8)';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.68, w * 0.46, h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }, { colorSpace: THREE.SRGBColorSpace });
}

export function createWaterTexture() {
  const rnd = mulberry32(0x6161);
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7d9f9b';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 35; i++) {
      ctx.strokeStyle = `rgba(218,233,222,${0.08 + rnd() * 0.2})`;
      ctx.lineWidth = 1 + rnd() * 2;
      ctx.beginPath();
      const y = rnd() * h;
      ctx.ellipse(w / 2, y, 20 + rnd() * 95, 4 + rnd() * 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, { colorSpace: THREE.SRGBColorSpace, anisotropy: 4 });
}

/* ------------------------------------------------------------------ *
 * Materials & geometry helpers
 * ------------------------------------------------------------------ */
const materialCache = new Map();

export function toon(color, options = {}) {
  const { flatShading, ...rest } = options;
  const key = JSON.stringify({ color, ...rest, map: undefined });
  if (!rest.map && !rest.transparent && materialCache.has(key)) return materialCache.get(key);
  const material = new THREE.MeshToonMaterial({
    color,
    gradientMap: toonGradient,
    ...rest,
  });
  if (!rest.map && !rest.transparent) materialCache.set(key, material);
  return material;
}

const outlineUniforms = {
  uThickness: { value: 0.028 },
  uColor: { value: new THREE.Color(0x2b2830) },
};

const outlineMaterial = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.clone(outlineUniforms),
  side: THREE.BackSide,
  vertexShader: /* glsl */ `
    uniform float uThickness;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      mvPosition.xyz += n * uThickness;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    void main() {
      gl_FragColor = vec4(uColor, 1.0);
      #include <colorspace_fragment>
    }
  `,
});

export function addOutline(mesh, thickness = 0.028) {
  if (!mesh?.geometry || mesh.userData.outline || mesh.material?.transparent) return mesh;
  const material = getOutlineMaterial(thickness);
  const outline = new THREE.Mesh(mesh.geometry, material);
  outline.userData.outline = true;
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.renderOrder = -1;
  mesh.add(outline);
  mesh.userData.outline = true;
  return mesh;
}

const outlineMaterials = new Map();
function getOutlineMaterial(thickness) {
  // Quantising the thickness lets hundreds of silhouette shells share a
  // handful of materials, which in turn lets us batch them into one mesh.
  const quantised = Math.max(0.005, Math.round(thickness * 200) / 200);
  const key = quantised.toFixed(3);
  if (outlineMaterials.has(key)) return outlineMaterials.get(key);
  const material = outlineMaterial.clone();
  material.uniforms.uThickness.value = quantised;
  outlineMaterials.set(key, material);
  return material;
}

function insideDynamic(mesh, boundary) {
  let node = mesh.parent;
  while (node && node !== boundary) {
    if (node.userData?.dynamic) return true;
    node = node.parent;
  }
  return false;
}

/**
 * Collapse static, opaque meshes into one mesh per material. This keeps the
 * diorama's polygon count modest while preserving the crisp hand-built
 * silhouettes. Dynamic subgroups (swaying foliage, paper streamers, ema,
 * leaves, water) are marked by the builders and skipped.
 */
export function mergeStaticMeshes(target) {
  target.updateWorldMatrix(true, true);
  const inverseTarget = new THREE.Matrix4().copy(target.matrixWorld).invert();
  const groups = new Map();
  const candidates = [];

  target.traverse((mesh) => {
    if (mesh === target || !mesh.isMesh || mesh.isInstancedMesh || mesh.isSprite) return;
    if (mesh.userData.noMerge || mesh.userData.dynamic) return;
    if (insideDynamic(mesh, target)) return;
    if (!mesh.geometry?.attributes?.position) return;
    if (Array.isArray(mesh.material) || !mesh.material || mesh.material.transparent) return;
    if (mesh.material.opacity !== undefined && mesh.material.opacity < 1) return;
    const attributes = Object.keys(mesh.geometry.attributes).sort().join(',');
    const key = `${mesh.material.uuid}|${attributes}|${mesh.castShadow ? 1 : 0}|${mesh.receiveShadow ? 1 : 0}`;
    if (!groups.has(key)) groups.set(key, { material: mesh.material, meshes: [], cast: mesh.castShadow, receive: mesh.receiveShadow });
    groups.get(key).meshes.push(mesh);
    candidates.push(mesh);
  });

  for (const group of groups.values()) {
    if (group.meshes.length < 2) continue;
    const geometries = [];
    for (const mesh of group.meshes) {
      let geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverseTarget, mesh.matrixWorld));
      // Only the attributes shared by every mesh in this batch are useful.
      for (const name of Object.keys(geometry.attributes)) {
        if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
      }
      geometries.push(geometry);
    }
    const mergedGeometry = mergeGeometries(geometries, false);
    if (!mergedGeometry) {
      for (const geometry of geometries) geometry.dispose();
      continue;
    }
    mergedGeometry.computeBoundingSphere();
    const mergedMesh = new THREE.Mesh(mergedGeometry, group.material);
    mergedMesh.castShadow = group.cast;
    mergedMesh.receiveShadow = group.receive;
    mergedMesh.matrixAutoUpdate = false;
    mergedMesh.updateMatrix();
    target.add(mergedMesh);
    for (const mesh of group.meshes) {
      mesh.parent?.remove(mesh);
    }
    for (const geometry of geometries) geometry.dispose();
  }

  return candidates.length;
}

export function box(parent, w, h, d, x, y, z, material, options = {}) {
  const geometry = options.rounded
    ? new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.12)
    : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  if (options.outline) addOutline(mesh, options.outline === true ? 0.025 : options.outline);
  return mesh;
}

export function cylinder(parent, radiusTop, radiusBottom, height, radial, x, y, z, material, options = {}) {
  const geometry = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radial,
    1,
    options.openEnded ?? false,
    options.thetaStart ?? 0,
    options.thetaLength ?? Math.PI * 2,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  if (options.outline) addOutline(mesh, options.outline === true ? 0.025 : options.outline);
  return mesh;
}

export function plane(parent, w, h, x, y, z, material, rotation = [-Math.PI / 2, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(...rotation);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function decal(parent, w, h, x, y, z, texture, options = {}) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: options.transparent ?? true,
    alphaTest: options.alphaTest ?? 0.01,
    side: options.side ?? THREE.FrontSide,
    depthWrite: options.depthWrite ?? false,
    toneMapped: options.toneMapped ?? true,
    color: options.color ?? 0xffffff,
    opacity: options.opacity ?? 1,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(...(options.rotation ?? [0, 0, 0]));
  mesh.renderOrder = options.renderOrder ?? 2;
  parent.add(mesh);
  return mesh;
}

export function tube(parent, points, radius, radial, material, options = {}) {
  const curve = new THREE.CatmullRomCurve3(points, options.closed ?? false, 'catmullrom', options.tension ?? 0.25);
  const geometry = new THREE.TubeGeometry(curve, options.segments ?? 32, radius, radial, options.closed ?? false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  if (options.outline) addOutline(mesh, options.outline === true ? 0.02 : options.outline);
  return mesh;
}

export function applyWind(material, { strength = 0.04, speed = 1.4 } = {}) {
  const state = {
    time: { value: 0 },
    strength: { value: strength },
    speed: { value: speed },
  };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = state.time;
    shader.uniforms.uWindStrength = state.strength;
    shader.uniforms.uWindSpeed = state.speed;
    shader.vertexShader = `
      uniform float uWindTime;
      uniform float uWindStrength;
      uniform float uWindSpeed;
    ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 iPos = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
        #endif
        float windPhase = iPos.x * 1.37 + iPos.z * 0.91;
        float bendAmount = max(position.y, 0.0);
        transformed.x += sin(uWindTime * uWindSpeed + windPhase) * uWindStrength * bendAmount;
        transformed.z += cos(uWindTime * uWindSpeed * 0.73 + windPhase) * uWindStrength * 0.55 * bendAmount;
      `,
    );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => `wind-${strength}-${speed}`;
  material.needsUpdate = true;
  return state;
}

export function updateWindState(state, t) {
  state.time.value = t;
}

/** A soft translucent contact shadow which can be reused by props. */
export function contactShadow(parent, x, z, sx, sz, opacity = 0.42, y = 0.018) {
  const texture = getSoftShadowTexture();
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    color: 0x3b3840,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), material);
  mesh.position.set(x, y, z);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  parent.add(mesh);
  return mesh;
}

let softShadowTexture;
export function getSoftShadowTexture() {
  if (!softShadowTexture) softShadowTexture = createSoftShadowTexture();
  return softShadowTexture;
}

/** Flat, billboard-style cloud that slowly drifts across the paper sky. */
export function makeCloud(parent, x, y, z, scale, opacity = 0.4) {
  const texture = createCloudTexture();
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    color: 0xb8d1d6,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.set(scale, scale * 0.42, 1);
  parent.add(sprite);
  return sprite;
}

export function markShadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}
