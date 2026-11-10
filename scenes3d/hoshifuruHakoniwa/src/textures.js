import * as THREE from 'three';
import { canvasTexture, mulberry32 } from './utils.js';

function createNoiseTexture(size, base, variance, speckleAmount, seed) {
  const rng = mulberry32(seed);
  return canvasTexture(size, size, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < image.data.length; i += 4) {
      const n = (rng() - 0.5) * variance;
      image.data[i] = Math.max(0, Math.min(255, image.data[i] + n));
      image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + n * 0.92));
      image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + n * 0.78));
    }
    ctx.putImageData(image, 0, 0);
    for (let i = 0; i < speckleAmount; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const r = 0.4 + rng() * 1.7;
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,238,0.055)' : 'rgba(45,52,33,0.075)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [1, 1] });
}

export function createTextures() {
  const rng = mulberry32(0xa113beef);
  const grass = canvasTexture(384, 384, (ctx, w, h) => {
    ctx.fillStyle = '#e1e7d5';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const len = 1.5 + rng() * 5;
      ctx.strokeStyle = rng() > 0.52 ? 'rgba(255,255,244,0.18)' : 'rgba(55,78,43,0.14)';
      ctx.lineWidth = 0.6 + rng() * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * 3, y - len);
      ctx.stroke();
    }
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = rng() > 0.4 ? 'rgba(230,228,165,0.16)' : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 0.5 + rng() * 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [15, 12] });

  const grassFine = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e5eadb';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(26,49,22,0.11)' : 'rgba(255,255,236,0.14)';
      ctx.fillRect(rng() * w, rng() * h, 0.7 + rng() * 2, 0.7 + rng() * 4);
    }
  }, { repeat: [8, 8] });

  const plaster = createNoiseTexture(256, '#e2ded1', 22, 240, 0x77aa33);
  plaster.repeat.set(2, 2);

  const plasterWarm = createNoiseTexture(256, '#e6dfce', 18, 180, 0x19a4ef);
  plasterWarm.repeat.set(2, 2);

  const soil = canvasTexture(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#6f5138');
    grad.addColorStop(0.18, '#8b6649');
    grad.addColorStop(0.42, '#70503a');
    grad.addColorStop(0.62, '#876d51');
    grad.addColorStop(0.8, '#57453a');
    grad.addColorStop(1, '#3f3731');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let band = 0; band < 9; band++) {
      const y = 40 + band * 53 + rng() * 16;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 18) {
        ctx.lineTo(x, y + Math.sin(x * 0.035 + band) * 4 + (rng() - 0.5) * 6);
      }
      ctx.strokeStyle = band % 2 ? 'rgba(37,28,23,0.2)' : 'rgba(228,199,155,0.12)';
      ctx.lineWidth = 1 + rng() * 3;
      ctx.stroke();
    }
    for (let i = 0; i < 340; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const r = 1 + rng() * 5;
      ctx.fillStyle = rng() > 0.5 ? 'rgba(38,31,26,0.22)' : 'rgba(213,188,149,0.16)';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.45 + rng() * 0.5), rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [3.5, 1] });

  const stone = canvasTexture(512, 384, (ctx, w, h) => {
    ctx.fillStyle = '#7c786c';
    ctx.fillRect(0, 0, w, h);
    const rowH = 43;
    for (let row = 0; row < Math.ceil(h / rowH) + 1; row++) {
      const offset = row % 2 ? -45 : 0;
      for (let col = -1; col < 8; col++) {
        const x = offset + col * 82 + rng() * 10;
        const y = row * rowH + rng() * 4;
        const bw = 66 + rng() * 26;
        const bh = rowH - 5 - rng() * 5;
        const shade = 152 + Math.floor(rng() * 45);
        ctx.fillStyle = 'rgb(' + shade + ',' + (shade - 4) + ',' + (shade - 16) + ')';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, 4 + rng() * 5);
        else ctx.rect(x, y, bw, bh);
        ctx.fill();
        ctx.strokeStyle = 'rgba(38,35,30,0.22)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,238,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 5);
        ctx.lineTo(x + bw - 8, y + 4 + rng() * 4);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = 'rgba(65,88,51,0.1)';
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 1 + rng() * 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [2, 2] });

  const cobble = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#706a5e';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 12; row++) {
      const yBase = row * 47;
      let x = -20 + (row % 2 ? 15 : 0);
      while (x < w + 30) {
        const cw = 30 + rng() * 34;
        const ch = 27 + rng() * 17;
        const px = x + rng() * 5;
        const py = yBase + rng() * 6;
        const shade = 147 + Math.floor(rng() * 55);
        ctx.fillStyle = 'rgb(' + shade + ',' + (shade - 8) + ',' + (shade - 22) + ')';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px, py, cw, ch, 8 + rng() * 8);
        else ctx.ellipse(px + cw / 2, py + ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(48,43,35,0.3)';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,251,224,0.16)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(px + cw * 0.52, py + ch * 0.36, Math.min(cw, ch) * 0.26, 0.25, Math.PI * 1.15);
        ctx.stroke();
        x += cw + 3 + rng() * 4;
      }
    }
    for (let i = 0; i < 280; i++) {
      ctx.fillStyle = rng() > 0.55 ? 'rgba(98,118,61,0.12)' : 'rgba(239,229,193,0.09)';
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 0.5 + rng() * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [3.6, 3.6] });

  const roof = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6e6861';
    ctx.fillRect(0, 0, w, h);
    const tileW = 30;
    const tileH = 23;
    for (let row = 0; row < 13; row++) {
      const y = row * tileH;
      const offset = row % 2 ? -tileW / 2 : 0;
      for (let col = -1; col < 11; col++) {
        const x = offset + col * tileW + 1;
        const shade = 178 + Math.floor(rng() * 46);
        ctx.fillStyle = 'rgb(' + shade + ',' + (shade - 7) + ',' + (shade - 14) + ')';
        ctx.beginPath();
        ctx.moveTo(x, y + 2);
        ctx.lineTo(x + tileW - 3, y + 2);
        ctx.quadraticCurveTo(x + tileW - 1, y + tileH * 0.55, x + tileW * 0.52, y + tileH - 1);
        ctx.quadraticCurveTo(x + 2, y + tileH * 0.55, x, y + 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(52,47,43,0.24)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,235,0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 4);
        ctx.lineTo(x + tileW - 7, y + 4);
        ctx.stroke();
      }
    }
  }, { repeat: [2.5, 2.2] });

  const wood = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#9c7955';
    ctx.fillRect(0, 0, w, h);
    const plankW = 63;
    for (let p = 0; p < 9; p++) {
      const x = p * plankW;
      ctx.fillStyle = 'rgba(' + (68 + Math.floor(rng() * 30)) + ',' + (48 + Math.floor(rng() * 18)) + ',32,0.16)';
      ctx.fillRect(x, 0, plankW - 2, h);
      ctx.fillStyle = 'rgba(36,25,16,0.35)';
      ctx.fillRect(x - 1, 0, 2, h);
      for (let g = 0; g < 7; g++) {
        ctx.strokeStyle = 'rgba(' + (48 + Math.floor(rng() * 22)) + ',35,23,' + (0.05 + rng() * 0.09) + ')';
        ctx.lineWidth = 0.7 + rng() * 1.1;
        ctx.beginPath();
        const yy = rng() * h;
        ctx.moveTo(x + 5, yy);
        ctx.bezierCurveTo(x + 20, yy + 4, x + 40, yy - 6, x + plankW - 5, yy + 2);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(45,31,20,0.25)';
      ctx.beginPath();
      ctx.ellipse(rng() * w, rng() * h, 3 + rng() * 4, 1.5 + rng() * 2, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [2, 1] });

  const windowDay = canvasTexture(128, 160, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#3c4e58');
    grad.addColorStop(0.52, '#6c8891');
    grad.addColorStop(0.54, '#31424d');
    grad.addColorStop(1, '#263942');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(242,229,200,0.2)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.62, 0);
    ctx.lineTo(0, h * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(24,27,27,0.55)';
    ctx.lineWidth = 7;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h * 0.48);
    ctx.lineTo(w, h * 0.48);
    ctx.stroke();
    ctx.fillStyle = 'rgba(238,218,177,0.18)';
    ctx.fillRect(8, 8, w * 0.22, h - 16);
  }, { repeat: [1, 1] });

  const windowGlow = canvasTexture(128, 160, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ffdf9b');
    grad.addColorStop(0.5, '#ffb65b');
    grad.addColorStop(1, '#ffd58e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(152,78,31,0.32)';
    ctx.fillRect(7, 8, w * 0.22, h - 16);
    ctx.strokeStyle = 'rgba(74,44,26,0.85)';
    ctx.lineWidth = 8;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h * 0.48);
    ctx.lineTo(w, h * 0.48);
    ctx.stroke();
  }, { repeat: [1, 1] });

  const awningCream = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f1e4c7';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#b95f4d' : '#f3e8cf';
      ctx.fillRect(i * 32, 0, 32, h);
    }
    ctx.fillStyle = 'rgba(91,42,32,0.12)';
    ctx.fillRect(0, h - 18, w, 18);
  }, { repeat: [2, 1] });

  const awningTeal = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e9e5d4';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#4f817e' : '#eee8d5';
      ctx.fillRect(i * 32, 0, 32, h);
    }
    ctx.fillStyle = 'rgba(33,73,70,0.12)';
    ctx.fillRect(0, h - 18, w, 18);
  }, { repeat: [2, 1] });

  const awningGold = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#efdfb7';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#c89b4b' : '#f1e5c9';
      ctx.fillRect(i * 32, 0, 32, h);
    }
    ctx.fillStyle = 'rgba(101,70,24,0.12)';
    ctx.fillRect(0, h - 18, w, 18);
  }, { repeat: [2, 1] });

  const glow = canvasTexture(128, 128, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,246,214,1)');
    grad.addColorStop(0.13, 'rgba(255,218,145,0.98)');
    grad.addColorStop(0.35, 'rgba(255,179,99,0.5)');
    grad.addColorStop(0.7, 'rgba(255,157,75,0.12)');
    grad.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  glow.wrapS = glow.wrapT = THREE.ClampToEdgeWrapping;

  const cloud = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      const x = w * (0.16 + rng() * 0.68);
      const y = h * (0.4 + (rng() - 0.5) * 0.32);
      const r = 28 + rng() * 72;
      const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,250,0.72)');
      grad.addColorStop(0.46, 'rgba(255,252,240,0.38)');
      grad.addColorStop(1, 'rgba(255,250,240,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  cloud.wrapS = cloud.wrapT = THREE.ClampToEdgeWrapping;

  const smoke = canvasTexture(128, 128, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(245,242,230,0.46)');
    grad.addColorStop(0.55, 'rgba(230,226,216,0.16)');
    grad.addColorStop(1, 'rgba(220,217,208,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  smoke.wrapS = smoke.wrapT = THREE.ClampToEdgeWrapping;

  const spark = canvasTexture(64, 64, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,240,1)');
    grad.addColorStop(0.25, 'rgba(255,235,174,0.9)');
    grad.addColorStop(1, 'rgba(255,220,130,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  spark.wrapS = spark.wrapT = THREE.ClampToEdgeWrapping;

  const clock = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 238, 0, Math.PI * 2);
    ctx.fillStyle = '#f1e5c9';
    ctx.fill();
    ctx.strokeStyle = '#625341';
    ctx.lineWidth = 15;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 217, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100,81,58,0.4)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#554533';
    ctx.font = '600 39px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.fillText(numerals[i], cx + Math.cos(a) * 178, cy + Math.sin(a) * 178 + 2);
      ctx.save();
      ctx.translate(cx + Math.cos(a) * 203, cy + Math.sin(a) * 203);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillRect(-2.5, -10, 5, 20);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#5d4a35';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#c49d5b';
    ctx.fill();
  });
  clock.wrapS = clock.wrapT = THREE.ClampToEdgeWrapping;

  const waterFall = canvasTexture(128, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(225,251,249,0.95)');
    grad.addColorStop(0.2, 'rgba(177,230,229,0.84)');
    grad.addColorStop(0.7, 'rgba(215,247,241,0.72)');
    grad.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = rng() * w;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.18 + rng() * 0.45) + ')';
      ctx.lineWidth = 1 + rng() * 4;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 5, h * 0.3, x - 7, h * 0.65, x + 2, h);
      ctx.stroke();
    }
  });
  waterFall.wrapS = THREE.RepeatWrapping;
  waterFall.wrapT = THREE.RepeatWrapping;
  waterFall.repeat.set(1, 2.6);

  const foam = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 36; i++) {
      const y = h * (0.2 + rng() * 0.64);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.16 + rng() * 0.38) + ')';
      ctx.lineWidth = 0.8 + rng() * 2.8;
      ctx.beginPath();
      const x = rng() * w;
      const len = 18 + rng() * 70;
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + len * 0.3, y - 4, x + len * 0.65, y + 3, x + len, y);
      ctx.stroke();
    }
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.08 + rng() * 0.3) + ')';
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 0.5 + rng() * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [1, 1] });
  foam.wrapS = THREE.RepeatWrapping;
  foam.wrapT = THREE.ClampToEdgeWrapping;

  const plaque = canvasTexture(768, 192, (ctx, w, h) => {
    ctx.fillStyle = '#2e2b24';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b99a5e';
    ctx.lineWidth = 5;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#d8bb7e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 76px Georgia, "SimSun", serif';
    ctx.fillText('星 落 町', w / 2, 78);
    ctx.font = '400 26px Georgia, serif';
    ctx.letterSpacing = '8px';
    ctx.fillText('H O S H I F U R U   H A K O N I W A', w / 2, 139);
  });
  plaque.wrapS = plaque.wrapT = THREE.ClampToEdgeWrapping;

  return {
    grass,
    grassFine,
    plaster,
    plasterWarm,
    soil,
    stone,
    cobble,
    roof,
    wood,
    windowDay,
    windowGlow,
    awningCream,
    awningTeal,
    awningGold,
    glow,
    cloud,
    smoke,
    spark,
    clock,
    waterFall,
    foam,
    plaque
  };
}

export function makeSignTexture(text, background = '#2f3d35', foreground = '#f1e4c7', border = '#c9aa70') {
  return canvasTexture(512, 180, (ctx, w, h) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = border;
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.fillStyle = foreground;
    ctx.font = '600 62px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(24, h - 33, w - 48, 1);
  });
}

export function makeBannerTexture(text, background = '#a65542', foreground = '#f5e8ce') {
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,240,205,0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, w - 32, h - 32);
    ctx.fillStyle = foreground;
    ctx.font = '600 78px "Microsoft YaHei", "PingFang SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const chars = text.split('');
    chars.forEach((ch, i) => ctx.fillText(ch, w / 2, 94 + i * 103));
  });
}
