import * as THREE from 'three';
import { canvasTexture, fillRoundRect, COLORS, mulberry32, randBetween } from './utils.js';

const JP_FONT = '"Yu Gothic", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif';
const JP_SERIF = '"Yu Mincho", "Hiragino Mincho ProN", "MS PMincho", serif';

function verticalGloss(ctx, w, h, strength = 0.22) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(255,255,255,${strength})`);
  g.addColorStop(0.22, `rgba(255,255,255,${strength * 0.25})`);
  g.addColorStop(0.7, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0.04)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function speckle(ctx, w, h, count, colors, seed = 2, maxR = 2.2) {
  const rng = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 0.3 + rng() * maxR;
    ctx.globalAlpha = 0.05 + rng() * 0.18;
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function makeAsphaltTexture() {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#141d24';
    ctx.fillRect(0, 0, w, h);
    const rng = mulberry32(771);
    // large tonal patches
    for (let i = 0; i < 70; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const rx = 25 + rng() * 170;
      const ry = 18 + rng() * 100;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
      const light = rng() > 0.6;
      g.addColorStop(0, light ? 'rgba(56,72,82,0.13)' : 'rgba(3,8,13,0.18)');
      g.addColorStop(1, 'rgba(16,24,31,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, ry / rx);
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    speckle(ctx, w, h, 6500, ['#77838a', '#26343c', '#b6c2c5', '#0a1015'], 33, 1.8);
    // hairline cracks
    ctx.strokeStyle = 'rgba(5,10,14,0.34)';
    ctx.lineWidth = 1.2;
    for (let c = 0; c < 12; c++) {
      ctx.beginPath();
      let x = rng() * w;
      let y = rng() * h;
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += (rng() - 0.5) * 55;
        y += (rng() - 0.3) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // subtle wet seams
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#6d7e86';
    for (let i = 0; i < 18; i++) {
      ctx.fillRect(rng() * w, rng() * h, 8 + rng() * 90, 1);
    }
    ctx.globalAlpha = 1;
  }, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeatX: 5,
    repeatY: 5,
  });
}

export function makeAsphaltRoughnessTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#585858';
    ctx.fillRect(0, 0, w, h);
    const rng = mulberry32(991);
    for (let i = 0; i < 100; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const r = 10 + rng() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(20,20,20,${0.08 + rng() * 0.28})`);
      g.addColorStop(1, 'rgba(70,70,70,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    speckle(ctx, w, h, 1800, ['#b0b0b0', '#292929'], 12, 2);
  }, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeatX: 5,
    repeatY: 5,
    colorSpace: THREE.NoColorSpace,
  });
}

export function makeSidewalkTexture() {
  return canvasTexture(768, 768, (ctx, w, h) => {
    ctx.fillStyle = '#58676c';
    ctx.fillRect(0, 0, w, h);
    const cellW = 96;
    const cellH = 96;
    const rng = mulberry32(417);
    for (let y = 0; y < h; y += cellH) {
      for (let x = 0; x < w; x += cellW) {
        const v = 80 + Math.floor(rng() * 19);
        ctx.fillStyle = `rgb(${v - 6}, ${v + 4}, ${v + 7})`;
        ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.045)';
        ctx.fillRect(x + 5, y + 5, cellW - 16, 2);
        ctx.strokeStyle = 'rgba(24,35,40,0.33)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
        // tiny drainage cuts common on Japanese pavers
        ctx.strokeStyle = 'rgba(35,45,50,0.28)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + cellW - 15, y + 12);
        ctx.lineTo(x + cellW - 15, y + cellH - 12);
        ctx.stroke();
      }
    }
    speckle(ctx, w, h, 2500, ['#c3cccd', '#2d3a40'], 2, 1.4);
    // damp stains
    for (let i = 0; i < 15; i++) {
      const g = ctx.createRadialGradient(rng() * w, rng() * h, 0, rng() * w, rng() * h, 90);
      g.addColorStop(0, 'rgba(12,24,27,0.16)');
      g.addColorStop(1, 'rgba(12,24,27,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeatX: 3,
    repeatY: 3,
  });
}

export function makeTactileTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b69b52';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(80,67,35,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const cx = 32 + x * 64;
        const cy = 32 + y * 64;
        ctx.fillStyle = 'rgba(66,54,26,0.23)';
        ctx.beginPath();
        ctx.arc(cx + 2, cy + 3, 15, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, 15);
        g.addColorStop(0, '#d4bb73');
        g.addColorStop(0.72, '#bda25a');
        g.addColorStop(1, '#9c8345');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const rng = mulberry32(37);
    for (let i = 0; i < 240; i++) {
      ctx.fillStyle = `rgba(255,242,190,${rng() * 0.06})`;
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 1);
    }
  }, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeatX: 2,
    repeatY: 2,
  });
}

export function makePaintTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(238,240,230,0.9)';
    ctx.fillRect(0, 0, w, h);
    const rng = mulberry32(300);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 160; i++) {
      ctx.globalAlpha = 0.12 + rng() * 0.44;
      const x = rng() * w;
      const y = rng() * h;
      const r = 0.5 + rng() * 4.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 20; i++) {
      ctx.fillRect(0, rng() * h, w, 0.5 + rng() * 1.8);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#8da3a2';
    for (let i = 0; i < 20; i++) {
      ctx.fillRect(rng() * w, rng() * h, 2 + rng() * 18, 1);
    }
    ctx.globalAlpha = 1;
  }, { colorSpace: THREE.SRGBColorSpace });
}

export function makeInteriorFloorTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#d9ceb6';
    ctx.fillRect(0, 0, w, h);
    const tile = 64;
    const rng = mulberry32(1201);
    for (let y = 0; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) {
        const warm = rng() > 0.5;
        ctx.fillStyle = warm ? '#e9dfc9' : '#d9cfbb';
        ctx.fillRect(x, y, tile, tile);
        ctx.strokeStyle = 'rgba(113,104,89,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, tile - 1, tile - 1);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 4, y + 4, tile - 8, 1);
      }
    }
    // worn center strip
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(77,80,75,0)');
    g.addColorStop(0.45, 'rgba(77,80,75,0.08)');
    g.addColorStop(0.55, 'rgba(77,80,75,0.08)');
    g.addColorStop(1, 'rgba(77,80,75,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeatX: 2,
    repeatY: 2,
  });
}

export function makeStoreSignTexture(variant = 'south') {
  const wide = variant === 'south';
  const w = wide ? 2048 : 1024;
  const h = 280;
  return canvasTexture(w, h, (ctx) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#fff9e7');
    bg.addColorStop(0.48, '#fff2cf');
    bg.addColorStop(1, '#f6e3b8');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // soft interior light unevenness
    const glow = ctx.createLinearGradient(0, 0, w, 0);
    glow.addColorStop(0, 'rgba(255,255,255,0.04)');
    glow.addColorStop(0.26, 'rgba(255,255,255,0.28)');
    glow.addColorStop(0.7, 'rgba(255,247,220,0.05)');
    glow.addColorStop(1, 'rgba(255,255,255,0.2)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // dark teal border
    ctx.strokeStyle = '#194c4b';
    ctx.lineWidth = 10;
    ctx.strokeRect(7, 7, w - 14, h - 14);

    // bottom tricolor ribbon
    const ribbonY = h - 35;
    ctx.fillStyle = '#df6b52';
    ctx.fillRect(8, ribbonY, w - 16, 8);
    ctx.fillStyle = '#e3b354';
    ctx.fillRect(8, ribbonY + 8, w - 16, 8);
    ctx.fillStyle = '#66bca8';
    ctx.fillRect(8, ribbonY + 16, w - 16, 11);

    const starX = wide ? 118 : 88;
    const starY = h * 0.45;
    ctx.save();
    ctx.translate(starX, starY);
    ctx.fillStyle = '#1c5e5b';
    ctx.beginPath();
    ctx.arc(0, 0, wide ? 67 : 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f8edcf';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, wide ? 55 : 39, 0, Math.PI * 2);
    ctx.stroke();
    // crescent and little star
    ctx.fillStyle = '#f8edcf';
    ctx.beginPath();
    ctx.arc(-7, -8, wide ? 26 : 19, 0.2, Math.PI * 1.7);
    ctx.arc(3, -8, wide ? 22 : 16, Math.PI * 1.7, 0.2, true);
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? (wide ? 14 : 10) : (wide ? 5 : 4);
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = 25 + Math.cos(a) * r;
      const y = -26 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const textX = wide ? 225 : 165;
    ctx.fillStyle = '#214c4c';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${wide ? 31 : 22}px "Trebuchet MS", ${JP_FONT}`;
    ctx.letterSpacing = wide ? '8px' : '4px';
    ctx.fillText('H O S H I F U R U   M A R T', textX, 55);
    ctx.font = `800 ${wide ? 105 : 73}px ${JP_FONT}`;
    ctx.fillStyle = '#173f40';
    ctx.fillText('星降マート', textX, 137);
    ctx.font = `600 ${wide ? 26 : 18}px ${JP_FONT}`;
    ctx.fillStyle = '#386664';
    ctx.fillText('あかりの灯る、かど。', textX + 4, 211);

    const badgeW = wide ? 230 : 142;
    const badgeX = w - badgeW - (wide ? 46 : 30);
    ctx.fillStyle = '#1b5754';
    fillRoundRect(ctx, badgeX, 65, badgeW, 125, 18, '#1b5754');
    ctx.fillStyle = '#fff4d4';
    ctx.textAlign = 'center';
    ctx.font = '900 65px "Trebuchet MS", sans-serif';
    ctx.fillText('24H', badgeX + badgeW / 2, 112);
    ctx.font = `600 ${wide ? 20 : 14}px ${JP_FONT}`;
    ctx.fillStyle = '#a9dfcf';
    ctx.fillText('OPEN EVERYDAY', badgeX + badgeW / 2, 158);
    ctx.textAlign = 'left';

    ctx.letterSpacing = '0px';
  });
}

export function makeVerticalSignTexture() {
  return canvasTexture(256, 900, (ctx, w, h) => {
    ctx.fillStyle = '#173f40';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f4e8c8';
    ctx.lineWidth = 8;
    ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.fillStyle = '#f8e9c5';
    ctx.textAlign = 'center';
    ctx.font = '900 112px "Trebuchet MS", sans-serif';
    ctx.fillText('24', w / 2, 166);
    ctx.font = '800 76px sans-serif';
    ctx.fillText('H', w / 2, 252);
    ctx.fillStyle = '#e2b152';
    ctx.fillRect(37, 310, w - 74, 5);
    ctx.fillStyle = '#f8e9c5';
    ctx.font = `800 72px ${JP_FONT}`;
    const chars = ['星', '降', 'マ', 'ー', 'ト'];
    chars.forEach((c, i) => ctx.fillText(c, w / 2, 406 + i * 88));
    ctx.strokeStyle = '#6dbca9';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(w / 2, 836, 18, 0, Math.PI * 2);
    ctx.stroke();
  });
}

export function makeOpenSignTexture() {
  return canvasTexture(512, 180, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(21, 51, 53, 0.9)';
    fillRoundRect(ctx, 8, 9, w - 16, h - 18, 22, 'rgba(21, 51, 53, 0.94)');
    ctx.strokeStyle = '#8fe1cd';
    ctx.lineWidth = 5;
    roundRectStroke(ctx, 17, 18, w - 34, h - 36, 16);
    ctx.fillStyle = '#c7fff0';
    ctx.textAlign = 'center';
    ctx.font = '700 35px "Trebuchet MS", sans-serif';
    ctx.fillText('WELCOME', w / 2, 63);
    ctx.font = '900 69px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#ffd78d';
    ctx.fillText('OPEN 24H', w / 2, 132);
    ctx.textAlign = 'left';

    function roundRectStroke(c, x, y, ww, hh, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + ww, y, x + ww, y + hh, r);
      c.arcTo(x + ww, y + hh, x, y + hh, r);
      c.arcTo(x, y + hh, x, y, r);
      c.arcTo(x, y, x + ww, y, r);
      c.closePath();
      c.stroke();
    }
  }, { colorSpace: THREE.SRGBColorSpace });
}

export function makeDoormatTexture() {
  return canvasTexture(768, 256, (ctx, w, h) => {
    ctx.fillStyle = '#263536';
    ctx.fillRect(0, 0, w, h);
    const rng = mulberry32(95);
    ctx.strokeStyle = 'rgba(141,173,164,0.16)';
    ctx.lineWidth = 2;
    for (let y = 8; y < h; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.05 + y) * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 150; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rng() * 0.045})`;
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 1 + rng() * 3);
    }
    ctx.strokeStyle = '#728b82';
    ctx.lineWidth = 5;
    ctx.strokeRect(17, 17, w - 34, h - 34);
    ctx.fillStyle = '#e9ddbf';
    ctx.textAlign = 'center';
    ctx.font = `700 52px ${JP_FONT}`;
    ctx.fillText('いらっしゃいませ', w / 2, 114);
    ctx.font = '700 26px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#b8c7b5';
    ctx.letterSpacing = '8px';
    ctx.fillText('HOSHIFURU MART', w / 2, 165);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = '#e1b25b';
    ctx.fillRect(w / 2 - 62, 190, 124, 4);
    ctx.textAlign = 'left';
  });
}

export function makeVendingTexture(scheme = 'aqua') {
  const palette = scheme === 'coral'
    ? { body: '#e8ded2', main: '#c05d51', dark: '#392b2d', glow: '#ffd3b2' }
    : { body: '#e5edf0', main: '#2f7b83', dark: '#25343d', glow: '#bff7ff' };
  return canvasTexture(512, 1024, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, palette.body);
    bg.addColorStop(0.6, '#d8e0e2');
    bg.addColorStop(1, '#aebbc0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // top glowing ad panel
    fillRoundRect(ctx, 22, 24, w - 44, 125, 15, palette.main);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    fillRoundRect(ctx, 38, 38, w - 76, 32, 9, 'rgba(255,255,255,0.12)');
    ctx.fillStyle = '#f9f5e8';
    ctx.textAlign = 'center';
    ctx.font = '900 52px "Trebuchet MS", sans-serif';
    ctx.fillText(scheme === 'coral' ? 'HOSHI DRINK' : 'AQUA / COLD', w / 2, 87);
    ctx.font = `700 23px ${JP_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(scheme === 'coral' ? 'あたたかい、いっぽ。' : 'つめた〜い　ドリンク', w / 2, 122);
    ctx.textAlign = 'left';

    // display window
    ctx.fillStyle = '#16262d';
    fillRoundRect(ctx, 30, 170, w - 60, 600, 10, '#16262d');
    const glass = ctx.createLinearGradient(0, 175, 0, 760);
    glass.addColorStop(0, 'rgba(255,255,255,0.13)');
    glass.addColorStop(1, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = glass;
    ctx.fillRect(38, 178, w - 76, 584);

    // four shelves of drinks
    const rng = mulberry32(scheme === 'coral' ? 77 : 41);
    const drinkPalette = ['#e95d4e', '#e4b24e', '#63bf9e', '#5ba9d8', '#f4f0d6', '#8d6cba', '#e88aa8', '#6b7fd1', '#a9d65c'];
    for (let row = 0; row < 4; row++) {
      const shelfY = 198 + row * 142;
      const light = ctx.createLinearGradient(0, shelfY, 0, shelfY + 88);
      light.addColorStop(0, 'rgba(226,249,255,0.32)');
      light.addColorStop(1, 'rgba(226,249,255,0.02)');
      ctx.fillStyle = light;
      ctx.fillRect(42, shelfY - 10, w - 84, 118);
      for (let col = 0; col < 7; col++) {
        const cx = 64 + col * 56;
        const color = drinkPalette[Math.floor(rng() * drinkPalette.length)];
        const tall = 64 + rng() * 32;
        ctx.fillStyle = 'rgba(5,12,15,0.35)';
        ctx.fillRect(cx + 3, shelfY + 4, 33, 100);
        ctx.fillStyle = color;
        fillRoundRect(ctx, cx, shelfY + 26 + (88 - tall) * 0.3, 33, tall, 7, color);
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillRect(cx + 5, shelfY + 52 + (88 - tall) * 0.3, 23, 14);
        ctx.fillStyle = 'rgba(20,38,43,0.5)';
        ctx.fillRect(cx + 8, shelfY + 56 + (88 - tall) * 0.3, 16, 2);
        ctx.fillStyle = '#dae7e9';
        ctx.fillRect(cx + 13, shelfY + 17 + (88 - tall) * 0.3, 7, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(cx + 4, shelfY + 32 + (88 - tall) * 0.3, 3, tall * 0.55);
      }
      ctx.fillStyle = '#aab8bd';
      ctx.fillRect(38, shelfY + 104, w - 76, 7);
      ctx.fillStyle = '#dbe7e8';
      ctx.fillRect(38, shelfY + 105, w - 76, 2);
      // tiny price tags
      const prices = ['¥130', '¥150', '¥120', '¥160'];
      ctx.fillStyle = '#f8f0da';
      ctx.font = '700 17px "Trebuchet MS", sans-serif';
      const tag = prices[row % prices.length];
      for (let p = 0; p < 4; p++) ctx.fillText(tag, 98 + p * 96, shelfY + 124);
    }

    // right control column
    ctx.fillStyle = palette.dark;
    fillRoundRect(ctx, w - 108, 782, 76, 95, 12, palette.dark);
    ctx.fillStyle = '#d4e2e4';
    ctx.fillRect(w - 94, 798, 48, 24);
    ctx.fillStyle = '#2a3a40';
    ctx.fillRect(w - 91, 801, 42, 18);
    ctx.fillStyle = '#ffd478';
    ctx.font = '700 17px "Trebuchet MS", sans-serif';
    ctx.fillText('¥130', w - 87, 817);
    ctx.fillStyle = '#10191e';
    ctx.fillRect(w - 92, 834, 44, 11);
    ctx.fillStyle = '#718186';
    ctx.fillRect(w - 92, 852, 11, 13);
    ctx.fillStyle = palette.glow;
    ctx.beginPath();
    ctx.arc(w - 69, 858, 5, 0, Math.PI * 2);
    ctx.fill();

    // dispenser
    const disp = ctx.createLinearGradient(0, 900, 0, 975);
    disp.addColorStop(0, '#091116');
    disp.addColorStop(1, '#26383e');
    ctx.fillStyle = disp;
    fillRoundRect(ctx, 58, 892, w - 116, 86, 12, disp);
    ctx.fillStyle = '#4c6469';
    ctx.fillRect(64, 966, w - 128, 5);
    ctx.fillStyle = '#171f24';
    fillRoundRect(ctx, 86, 837, w - 172, 23, 5, '#171f24');
    ctx.fillStyle = '#f4ecd8';
    ctx.font = `700 20px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('あつい　コーヒーも　あります', w / 2, 837);
    ctx.textAlign = 'left';

    // reflection
    ctx.globalAlpha = 0.11;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(34, 0);
    ctx.lineTo(92, 0);
    ctx.lineTo(262, h);
    ctx.lineTo(150, h);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // subtle wear at base
    const rng2 = mulberry32(5);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(40,47,45,${rng2() * 0.07})`;
      ctx.fillRect(rng2() * w, h - 55 + rng2() * 47, 2 + rng2() * 28, 1);
    }
  });
}

export function makeFridgeTexture() {
  return canvasTexture(1024, 560, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#fdf5d9');
    bg.addColorStop(0.45, '#fff6dd');
    bg.addColorStop(1, '#e9dfc4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // ceiling light bloom
    const bloom = ctx.createLinearGradient(0, 0, 0, h * 0.42);
    bloom.addColorStop(0, 'rgba(255,255,255,0.8)');
    bloom.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, w, h * 0.42);
    ctx.fillStyle = '#255f5d';
    ctx.fillRect(0, 0, w, 44);
    ctx.fillStyle = '#f6e8c5';
    ctx.font = '700 24px "Trebuchet MS", sans-serif';
    ctx.fillText('COLD DRINKS', 24, 30);
    ctx.font = `700 17px ${JP_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('つめた〜い お飲みもの', w - 22, 30);
    ctx.textAlign = 'left';

    const rng = mulberry32(902);
    const beverageColors = ['#d9534f', '#f0bb48', '#65b99b', '#4e90bd', '#f3eee0', '#745a9e', '#e48194', '#7cc66c', '#d7e6e8', '#ea9b4a'];
    for (let row = 0; row < 5; row++) {
      const shelfY = 90 + row * 91;
      ctx.fillStyle = 'rgba(223,233,226,0.52)';
      ctx.fillRect(12, shelfY, w - 24, 76);
      ctx.fillStyle = '#aeb9ac';
      ctx.fillRect(12, shelfY + 72, w - 24, 5);
      for (let col = 0; col < 16; col++) {
        const x = 22 + col * 62;
        const color = beverageColors[Math.floor(rng() * beverageColors.length)];
        const width = 28 + rng() * 8;
        const height = 45 + rng() * 18;
        // bottle silhouette
        ctx.fillStyle = 'rgba(65,77,70,0.15)';
        fillRoundRect(ctx, x + 5, shelfY + 7, width, height + 8, 7, 'rgba(65,77,70,0.12)');
        ctx.fillStyle = color;
        fillRoundRect(ctx, x, shelfY + 16 + (58 - height), width, height, 5, color);
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillRect(x + 4, shelfY + 33 + (58 - height), width - 8, 13);
        ctx.fillStyle = 'rgba(27,46,49,0.7)';
        ctx.fillRect(x + 4, shelfY + 39 + (58 - height), width - 8, 2);
        ctx.fillStyle = '#b8c8c5';
        ctx.fillRect(x + width / 2 - 4, shelfY + 6 + (58 - height), 8, 16);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x + 4, shelfY + 20 + (58 - height), 3, height * 0.62);
      }
      // door vertical frames
      for (let door = 0; door < 4; door++) {
        ctx.fillStyle = 'rgba(30,57,57,0.5)';
        ctx.fillRect(door * 256, 48, 3, h - 58);
      }
    }
    // shelf tags
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 12; col++) {
        ctx.fillStyle = ['#dc6b55', '#f1d78d', '#8ecabb'][Math.floor(rng() * 3)];
        ctx.fillRect(22 + col * 82, 160 + row * 91, 22, 12);
      }
    }
    // top glass glare
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(90, 44);
    ctx.lineTo(190, 44);
    ctx.lineTo(80, h);
    ctx.lineTo(20, h);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // four door handles
    for (let d = 0; d < 4; d++) {
      ctx.fillStyle = '#365655';
      ctx.fillRect(d * 256 + 232, 230, 8, 120);
      ctx.fillStyle = '#d7e3d9';
      ctx.fillRect(d * 256 + 234, 234, 2, 112);
    }
  });
}

export function makeGondolaSignTexture(label, sub, accent = '#2c7d75') {
  return canvasTexture(512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#fbf3df';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent;
    ctx.fillRect(0, h - 26, w, 26);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 17, h);
    ctx.fillStyle = '#1c3f41';
    ctx.font = `800 58px ${JP_FONT}`;
    ctx.fillText(label, 45, 76);
    ctx.fillStyle = '#54706d';
    ctx.font = '600 23px "Trebuchet MS", sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText(sub, 47, 111);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 19px ${JP_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('星降マート', w - 26, h - 7);
    ctx.textAlign = 'left';
  });
}

export function makePosterTexture(kind = 'coffee') {
  return canvasTexture(512, 720, (ctx, w, h) => {
    if (kind === 'coffee') {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#f0d8a2');
      g.addColorStop(1, '#ca815b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#5b352b';
      ctx.fillRect(46, 50, 420, 620);
      ctx.fillStyle = '#fff2d4';
      ctx.textAlign = 'center';
      ctx.font = '800 28px "Trebuchet MS", sans-serif';
      ctx.fillText('HOSHIFURU CAFE', w / 2, 102);
      ctx.font = `800 82px ${JP_FONT}`;
      ctx.fillText('ホット', w / 2, 220);
      ctx.fillText('コーヒー', w / 2, 305);
      ctx.font = '600 23px "Trebuchet MS", sans-serif';
      ctx.fillText('WARM YOUR HANDS', w / 2, 352);
      // cup
      ctx.fillStyle = '#f4e6c4';
      fillRoundRect(ctx, 165, 410, 182, 132, 18, '#f4e6c4');
      ctx.strokeStyle = '#dbbf8e';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(354, 470, 47, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.fillStyle = '#7d4b34';
      ctx.beginPath();
      ctx.ellipse(256, 415, 91, 19, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,244,220,0.7)';
      ctx.lineWidth = 7;
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(205 + i * 45, 378);
        ctx.bezierCurveTo(185 + i * 45, 340, 235 + i * 45, 325, 210 + i * 45, 282);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f7e8c5';
      ctx.font = `700 30px ${JP_FONT}`;
      ctx.fillText('¥120', w / 2, 627);
      ctx.textAlign = 'left';
    } else if (kind === 'onigiri') {
      ctx.fillStyle = '#f5efdc';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#cf6e56';
      ctx.fillRect(0, 0, w, 120);
      ctx.fillStyle = '#fff8e8';
      ctx.font = '900 39px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NEW!', w / 2, 52);
      ctx.font = `700 26px ${JP_FONT}`;
      ctx.fillText('できたて おにぎり', w / 2, 92);
      // rice ball
      ctx.fillStyle = '#fbf7e9';
      ctx.strokeStyle = '#d8cfae';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(256, 190);
      ctx.lineTo(375, 470);
      ctx.quadraticCurveTo(380, 495, 345, 498);
      ctx.lineTo(166, 498);
      ctx.quadraticCurveTo(130, 493, 144, 464);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1e3533';
      fillRoundRect(ctx, 205, 330, 102, 145, 16, '#1e3533');
      ctx.fillStyle = 'rgba(255,255,255,0.26)';
      ctx.fillRect(227, 348, 20, 74);
      ctx.fillStyle = '#264a47';
      ctx.font = `800 74px ${JP_FONT}`;
      ctx.fillText('おにぎり', w / 2, 600);
      ctx.fillStyle = '#b85a48';
      ctx.font = '900 47px "Trebuchet MS", sans-serif';
      ctx.fillText('¥140', w / 2, 673);
      ctx.textAlign = 'left';
    } else {
      // event / seasonal poster
      ctx.fillStyle = '#dfe9e2';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#213f48';
      ctx.fillRect(0, 0, w, 100);
      ctx.fillStyle = '#f5edd7';
      ctx.font = `700 25px ${JP_FONT}`;
      ctx.fillText('星見町 商店会', 34, 60);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#344c51';
      ctx.font = `800 65px ${JP_FONT}`;
      ctx.fillText('夏祭り', w / 2, 195);
      ctx.font = '500 24px "Trebuchet MS", sans-serif';
      ctx.fillText('HOSHIMI SUMMER FESTIVAL', w / 2, 238);
      // lantern illustration
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = ['#e9835d', '#f2d080', '#83b9a2'][i];
        const x = 130 + i * 126;
        ctx.beginPath();
        ctx.ellipse(x, 382, 41, 68, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4e3c32';
        ctx.fillRect(x - 24, 312, 48, 9);
        ctx.fillRect(x - 24, 444, 48, 9);
        ctx.strokeStyle = 'rgba(80,48,38,0.25)';
        ctx.lineWidth = 2;
        for (let l = -2; l <= 2; l++) {
          ctx.beginPath();
          ctx.ellipse(x, 382, 41 - Math.abs(l) * 5, 68, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#344c51';
      ctx.font = `600 26px ${JP_FONT}`;
      ctx.fillText('八月二十日 ・ 駅前通り', w / 2, 545);
      ctx.fillStyle = '#b1624e';
      ctx.fillRect(80, 585, w - 160, 3);
      ctx.font = `500 19px ${JP_FONT}`;
      ctx.fillStyle = '#61716f';
      ctx.fillText('雨天決行 / 星降マート 協賛', w / 2, 632);
      ctx.textAlign = 'left';
    }
    // paper wear
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#352c25';
    for (let i = 0; i < 35; i++) {
      ctx.fillRect(Math.random() * w, h - 25 + Math.random() * 25, 2 + Math.random() * 20, 1);
    }
    ctx.globalAlpha = 1;
  });
}

export function makeMagazineTexture(index = 0) {
  const covers = [
    { bg: '#dd6f61', accent: '#ffe0b2', title: '雨の日', sub: 'TOKYO NIGHT WALK' },
    { bg: '#4e7d8c', accent: '#f3dfb4', title: 'まち', sub: 'SMALL TOWN STORIES' },
    { bg: '#e1c36c', accent: '#264a49', title: '星', sub: 'ASTRONOMY TODAY' },
    { bg: '#91b59a', accent: '#213e3d', title: '暮らし', sub: 'SLOW LIVING' },
    { bg: '#d17f95', accent: '#ffe4ca', title: 'コーヒー', sub: 'CAFE & RAIN' },
    { bg: '#7b83b8', accent: '#f1e8ca', title: '夜', sub: 'TOKYO AFTER DARK' },
    { bg: '#f0e1c2', accent: '#b04f44', title: '旅', sub: 'WEEKEND TRIP' },
    { bg: '#5a9b8d', accent: '#fff0ce', title: '猫', sub: 'CATS & STREETS' },
  ];
  const c = covers[index % covers.length];
  return canvasTexture(256, 340, (ctx, w, h) => {
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);
    // stylized cover art
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(w * 0.62, h * 0.37, 64, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#132a31';
    ctx.beginPath();
    ctx.arc(w * 0.53, h * 0.42, 76, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(14,32,39,0.7)';
    for (let i = 0; i < 6; i++) ctx.fillRect(16, 252 + i * 9, 114 + (i % 3) * 34, 3);
    ctx.fillStyle = c.accent;
    ctx.font = `800 51px ${JP_FONT}`;
    ctx.fillText(c.title, 15, 79);
    ctx.fillStyle = '#f7f1e2';
    ctx.font = '700 13px "Trebuchet MS", sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText(c.sub, 17, 99);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(176, 0, 7, h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, w, h * 0.04);
    // barcode
    ctx.fillStyle = '#f7efe0';
    ctx.fillRect(w - 63, h - 44, 48, 31);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 ? '#1b2322' : '#f7efe0';
      ctx.fillRect(w - 58 + i * 4, h - 39, i % 3 === 0 ? 3 : 1, 21);
    }
  });
}

export function makeBoardTexture() {
  return canvasTexture(768, 512, (ctx, w, h) => {
    ctx.fillStyle = '#b8aa8b';
    ctx.fillRect(0, 0, w, h);
    const rng = mulberry32(214);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(30,25,18,${rng() * 0.06})`;
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 8, 1);
    }
    const papers = [
      { x: 32, y: 34, w: 214, h: 290, bg: '#f2e8cc', bar: '#bd5d50' },
      { x: 270, y: 54, w: 202, h: 174, bg: '#e9eddc', bar: '#3c7d72' },
      { x: 494, y: 28, w: 222, h: 206, bg: '#f4e3c0', bar: '#e1aa4e' },
      { x: 294, y: 268, w: 256, h: 184, bg: '#e8e4d5', bar: '#4e607a' },
      { x: 58, y: 354, w: 190, h: 118, bg: '#f4ead0', bar: '#c57460' },
    ];
    papers.forEach((p, i) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((rng() - 0.5) * 0.05);
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, p.w, p.h);
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = p.bar;
      ctx.fillRect(0, 0, p.w, 26);
      ctx.fillStyle = 'rgba(24,34,34,0.72)';
      ctx.font = `700 ${i === 0 ? 24 : 18}px ${JP_FONT}`;
      const titles = ['商店会 お知らせ', '迷い猫', '夏祭り', '求人募集', '営業時間'];
      ctx.fillText(titles[i], 12, 20);
      ctx.fillStyle = 'rgba(50,54,46,0.5)';
      const lines = Math.floor((p.h - 44) / 18);
      for (let l = 0; l < lines; l++) {
        ctx.fillRect(13, 39 + l * 17, p.w * (0.32 + rng() * 0.54), 3);
      }
      if (i === 1) {
        // tiny cat portrait
        ctx.fillStyle = '#c9b18d';
        ctx.beginPath();
        ctx.arc(p.w / 2, p.h - 50, 27, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6d563e';
        ctx.beginPath();
        ctx.moveTo(p.w / 2 - 24, p.h - 68);
        ctx.lineTo(p.w / 2 - 33, p.h - 91);
        ctx.lineTo(p.w / 2 - 10, p.h - 76);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(p.w / 2 + 24, p.h - 68);
        ctx.lineTo(p.w / 2 + 33, p.h - 91);
        ctx.lineTo(p.w / 2 + 10, p.h - 76);
        ctx.fill();
      }
      ctx.restore();
    });
    // tape
    ctx.fillStyle = 'rgba(239,228,196,0.7)';
    ctx.save();
    ctx.rotate(-0.24);
    ctx.fillRect(-9, -8, 63, 18);
    ctx.restore();
  });
}

export function makeStreetNameTexture(text = '星見町', sub = 'HOSHIMI-CHO') {
  return canvasTexture(700, 220, (ctx, w, h) => {
    ctx.fillStyle = '#174d79';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d7e5e6';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#f4f7ec';
    ctx.font = `800 80px ${JP_FONT}`;
    ctx.fillText(text, 34, 98);
    ctx.font = '700 28px "Trebuchet MS", sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillStyle = '#bed9e1';
    ctx.fillText(sub, 38, 140);
    ctx.letterSpacing = '0px';
    // arrow
    ctx.strokeStyle = '#f4f7ec';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(w - 175, h / 2 + 10);
    ctx.lineTo(w - 75, h / 2 + 10);
    ctx.lineTo(w - 105, h / 2 - 20);
    ctx.moveTo(w - 75, h / 2 + 10);
    ctx.lineTo(w - 105, h / 2 + 40);
    ctx.stroke();
    ctx.fillStyle = '#8bc7d0';
    ctx.font = '600 22px "Trebuchet MS", sans-serif';
    ctx.fillText('HOSHIFURU MART →', 38, 186);
  });
}

export function makeParkingSignTexture() {
  return canvasTexture(320, 500, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#194c79';
    fillRoundRect(ctx, 10, 10, w - 20, 300, 28, '#194c79');
    ctx.strokeStyle = '#e7f1ef';
    ctx.lineWidth = 8;
    fillRoundRect(ctx, 23, 23, w - 46, 274, 19, '#194c79');
    ctx.strokeRect(23, 23, w - 46, 274);
    ctx.fillStyle = '#f5f4e7';
    ctx.textAlign = 'center';
    ctx.font = '900 195px "Trebuchet MS", sans-serif';
    ctx.fillText('P', w / 2, 224);
    ctx.font = `700 23px ${JP_FONT}`;
    ctx.fillText('24時間 駐車可', w / 2, 275);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#182830';
    ctx.font = '700 30px "Trebuchet MS", sans-serif';
    ctx.fillText('PARKING', 54, 370);
    ctx.font = `500 21px ${JP_FONT}`;
    ctx.fillStyle = '#6a716a';
    ctx.fillText('星降マート 提携駐車場', 40, 410);
    ctx.fillStyle = '#d5b66b';
    ctx.fillRect(40, 432, w - 80, 3);
  });
}

export function makeStopTexture() {
  return canvasTexture(512, 460, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#e0ddd0';
    ctx.beginPath();
    ctx.moveTo(w / 2, 8);
    ctx.lineTo(w - 18, h - 22);
    ctx.lineTo(18, h - 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c94743';
    ctx.beginPath();
    ctx.moveTo(w / 2, 28);
    ctx.lineTo(w - 47, h - 50);
    ctx.lineTo(47, h - 50);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#f4ecda';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(w / 2, 64);
    ctx.lineTo(w - 90, h - 82);
    ctx.lineTo(90, h - 82);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#fff7e3';
    ctx.textAlign = 'center';
    ctx.font = `900 112px ${JP_FONT}`;
    ctx.fillText('止まれ', w / 2, h - 104);
    ctx.textAlign = 'left';
  });
}

export function makeRoadTextTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(228,233,222,0.72)';
    ctx.textAlign = 'center';
    ctx.font = `800 108px ${JP_FONT}`;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1.6, 1);
    ctx.fillText('止まれ', 0, 35);
    ctx.restore();
    // worn paint
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 210; i++) {
      ctx.globalAlpha = 0.1 + Math.random() * 0.5;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 0.5 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  });
}

export function makeDrainTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#263239';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#596a6d';
    ctx.lineWidth = 7;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.strokeStyle = '#0d151a';
    ctx.lineWidth = 10;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(24 + i * 18, 18);
      ctx.lineTo(24 + i * 18, h - 18);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(137,155,156,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(30 + i * 18, 18);
      ctx.lineTo(30 + i * 18, h - 18);
      ctx.stroke();
    }
  }, { colorSpace: THREE.SRGBColorSpace });
}

export function makeNameplateTexture() {
  return canvasTexture(1024, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#d5b678');
    g.addColorStop(0.35, '#a8844e');
    g.addColorStop(0.6, '#caa76b');
    g.addColorStop(1, '#8b6a3c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(56,43,25,0.55)';
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = 'rgba(247,224,179,0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(15, 15, w - 30, h - 30);
    ctx.fillStyle = '#332719';
    ctx.textAlign = 'center';
    ctx.font = '700 34px "Trebuchet MS", sans-serif';
    ctx.letterSpacing = '8px';
    ctx.fillText('HOSHIFURU MART', w / 2, 52);
    ctx.font = `500 23px ${JP_FONT}`;
    ctx.letterSpacing = '3px';
    ctx.fillText('雨の夜、かどで。  /  A RAINY NIGHT CORNER', w / 2, 89);
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'left';
  });
}

export function makeClockTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#17282d';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9ebe2';
    ctx.font = '700 66px "Trebuchet MS", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('23:47', w / 2, 122);
    ctx.fillStyle = '#d1a95e';
    ctx.font = `500 26px ${JP_FONT}`;
    ctx.fillText('雨　/　18°C', w / 2, 186);
    ctx.textAlign = 'left';
  });
}

export function makeCatCollarTexture() {
  return canvasTexture(64, 16, (ctx, w, h) => {
    ctx.fillStyle = '#c94943';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e4c279';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}
