import * as THREE from 'three';
import { canvasTexture, mulberry32 } from './utils.js';

export function createTextures() {
  const rng = mulberry32(0xa37b91);

  const grass = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#d2dfbe';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const r = 18 + rng() * 60;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, rng() > 0.5 ? 'rgba(255,250,210,0.11)' : 'rgba(58,86,45,0.1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 4200; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const len = 1.6 + rng() * 8;
      ctx.strokeStyle = rng() > 0.46 ? 'rgba(255,255,235,0.2)' : 'rgba(41,70,37,0.22)';
      ctx.lineWidth = 0.6 + rng() * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (rng() - 0.5) * 5, y - len * 0.5, x + (rng() - 0.5) * 7, y - len);
      ctx.stroke();
    }
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = rng() > 0.42 ? 'rgba(233,226,158,0.2)' : 'rgba(250,255,236,0.15)';
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 0.5 + rng() * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [9, 9] });

  const rock = canvasTexture(768, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#b6aa92');
    grad.addColorStop(0.24, '#999686');
    grad.addColorStop(0.44, '#aa9d89');
    grad.addColorStop(0.6, '#858c80');
    grad.addColorStop(0.78, '#8a8777');
    grad.addColorStop(1, '#5a655f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let band = 0; band < 16; band++) {
      const y = 20 + band * 32 + rng() * 12;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) {
        ctx.lineTo(x, y + Math.sin(x * 0.027 + band * 1.7) * 6 + (rng() - 0.5) * 7);
      }
      ctx.strokeStyle = band % 3 === 0 ? 'rgba(48,44,38,0.3)' : 'rgba(221,207,181,0.1)';
      ctx.lineWidth = 1.5 + rng() * 3.2;
      ctx.stroke();
    }
    for (let i = 0; i < 420; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const r = 1 + rng() * 8;
      ctx.fillStyle = rng() > 0.55 ? 'rgba(30,31,27,0.22)' : 'rgba(229,215,189,0.12)';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.35 + rng() * 0.55), rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = 'rgba(95,112,70,0.12)';
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 2 + rng() * 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [3, 3] });

  const stone = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#beb49f';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 9; row++) {
      let x = row % 2 ? -40 : -10;
      while (x < w) {
        const bw = 80 + rng() * 46;
        const bh = 52 + rng() * 12;
        const y = row * 59 + rng() * 5;
        const shade = 166 + Math.floor(rng() * 44);
        ctx.fillStyle = 'rgb(' + shade + ',' + (shade - 8) + ',' + (shade - 21) + ')';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, 7 + rng() * 6);
        else ctx.rect(x, y, bw, bh);
        ctx.fill();
        ctx.strokeStyle = 'rgba(64,60,52,0.23)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,253,236,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 5);
        ctx.lineTo(x + bw - 8, y + 3 + rng() * 4);
        ctx.stroke();
        x += bw + 4 + rng() * 5;
      }
    }
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(89,105,67,0.1)' : 'rgba(255,255,235,0.09)';
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 1 + rng() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [2.4, 2.4] });

  const paving = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8b806e';
    ctx.fillRect(0, 0, w, h);
    const rings = 5;
    for (let i = 0; i < rings; i++) {
      const y = i * 102 + 10;
      let x = i % 2 ? -50 : 0;
      while (x < w + 60) {
        const sw = 58 + rng() * 51;
        const sh = 74 + rng() * 24;
        const shade = 159 + Math.floor(rng() * 45);
        ctx.fillStyle = 'rgb(' + shade + ',' + (shade - 7) + ',' + (shade - 20) + ')';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, sw, sh, 14 + rng() * 9);
        else ctx.rect(x, y, sw, sh);
        ctx.fill();
        ctx.strokeStyle = 'rgba(55,49,40,0.29)';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,251,225,0.16)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(x + sw * 0.4, y + sh * 0.4, Math.min(sw, sh) * 0.2, 0.4, 2.5);
        ctx.stroke();
        x += sw + 5 + rng() * 7;
      }
    }
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = rng() > 0.6 ? 'rgba(85,107,63,0.13)' : 'rgba(255,248,217,0.08)';
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 0.5 + rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [3, 3] });

  const wood = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#78533c';
    ctx.fillRect(0, 0, w, h);
    const plank = 64;
    for (let p = 0; p < 9; p++) {
      const x = p * plank;
      ctx.fillStyle = 'rgba(' + (65 + Math.floor(rng() * 36)) + ',' + (42 + Math.floor(rng() * 23)) + ',28,0.16)';
      ctx.fillRect(x, 0, plank - 2, h);
      ctx.fillStyle = 'rgba(29,20,13,0.43)';
      ctx.fillRect(x - 1, 0, 2, h);
      for (let g = 0; g < 8; g++) {
        ctx.strokeStyle = 'rgba(' + (43 + Math.floor(rng() * 24)) + ',31,22,' + (0.08 + rng() * 0.12) + ')';
        ctx.lineWidth = 0.7 + rng() * 1.2;
        const yy = rng() * h;
        ctx.beginPath();
        ctx.moveTo(x + 5, yy);
        ctx.bezierCurveTo(x + 18, yy + 3, x + 42, yy - 5, x + plank - 6, yy + 2);
        ctx.stroke();
      }
    }
  }, { repeat: [2, 1] });

  const tiles = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5f6964';
    ctx.fillRect(0, 0, w, h);
    const tw = 33;
    const th = 25;
    for (let row = 0; row < 13; row++) {
      const y = row * th;
      const offset = row % 2 ? -tw / 2 : 0;
      for (let col = -1; col < 10; col++) {
        const x = offset + col * tw;
        const shade = 164 + Math.floor(rng() * 50);
        ctx.fillStyle = 'rgb(' + (shade - 10) + ',' + (shade + 4) + ',' + (shade - 3) + ')';
        ctx.beginPath();
        ctx.moveTo(x + 1, y + 2);
        ctx.lineTo(x + tw - 3, y + 2);
        ctx.quadraticCurveTo(x + tw, y + th * 0.58, x + tw * 0.52, y + th - 1);
        ctx.quadraticCurveTo(x + 2, y + th * 0.58, x + 1, y + 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(37,46,43,0.28)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(236,255,244,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 4);
        ctx.lineTo(x + tw - 7, y + 4);
        ctx.stroke();
      }
    }
  }, { repeat: [2.5, 2.2] });

  const cloud = canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // Cool shaded bellies first.
    for (let i = 0; i < 32; i++) {
      const x = w * (0.08 + rng() * 0.84);
      const y = h * (0.55 + (rng() - 0.5) * 0.28);
      const r = 45 + rng() * 115;
      const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, 'rgba(124,151,157,0.3)');
      grad.addColorStop(0.4, 'rgba(143,166,169,0.2)');
      grad.addColorStop(0.75, 'rgba(166,184,184,0.06)');
      grad.addColorStop(1, 'rgba(170,190,190,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Sunlit crowns.
    for (let i = 0; i < 54; i++) {
      const x = w * (0.08 + rng() * 0.84);
      const y = h * (0.32 + (rng() - 0.5) * 0.3);
      const r = 35 + rng() * 104;
      const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, 'rgba(255,254,244,0.72)');
      grad.addColorStop(0.34, 'rgba(249,247,237,0.4)');
      grad.addColorStop(0.7, 'rgba(239,241,233,0.12)');
      grad.addColorStop(1, 'rgba(233,238,232,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bright rims catch the sun.
    for (let i = 0; i < 20; i++) {
      const x = w * (0.12 + rng() * 0.76);
      const y = h * (0.2 + rng() * 0.22);
      const r = 20 + rng() * 58;
      const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, 'rgba(255,254,242,0.5)');
      grad.addColorStop(0.55, 'rgba(255,251,235,0.12)');
      grad.addColorStop(1, 'rgba(255,250,235,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { clamp: true });

  const mist = canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(244,255,249,0.5)');
    grad.addColorStop(0.48, 'rgba(228,246,240,0.18)');
    grad.addColorStop(1, 'rgba(220,240,236,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }, { clamp: true });

  const glow = canvasTexture(128, 128, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,253,230,1)');
    grad.addColorStop(0.12, 'rgba(255,228,160,0.96)');
    grad.addColorStop(0.32, 'rgba(255,189,107,0.46)');
    grad.addColorStop(0.68, 'rgba(255,174,93,0.1)');
    grad.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }, { clamp: true });

  const spark = canvasTexture(64, 64, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,246,1)');
    grad.addColorStop(0.18, 'rgba(213,255,237,0.9)');
    grad.addColorStop(0.5, 'rgba(146,239,210,0.28)');
    grad.addColorStop(1, 'rgba(120,230,200,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }, { clamp: true });

  const petal = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(246,183,189,0.96)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 12, 25, Math.PI / 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,235,228,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 6, h / 2 + 15);
    ctx.quadraticCurveTo(w / 2 + 3, h / 2, w / 2 + 5, h / 2 - 18);
    ctx.stroke();
  }, { clamp: true });

  const waterfall = canvasTexture(256, 768, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(227,255,248,0.95)');
    grad.addColorStop(0.14, 'rgba(184,240,234,0.88)');
    grad.addColorStop(0.66, 'rgba(207,250,244,0.7)');
    grad.addColorStop(1, 'rgba(242,255,251,0.18)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 65; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.12 + rng() * 0.4) + ')';
      ctx.lineWidth = 0.8 + rng() * 4;
      ctx.beginPath();
      const x = rng() * w;
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 9, h * 0.27, x - 10, h * 0.63, x + 3, h);
      ctx.stroke();
    }
    for (let i = 0; i < 150; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.12 + rng() * 0.45) + ')';
      ctx.beginPath();
      ctx.ellipse(rng() * w, rng() * h, 0.6 + rng() * 2.2, 1 + rng() * 5, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  waterfall.wrapS = THREE.RepeatWrapping;
  waterfall.wrapT = THREE.RepeatWrapping;
  waterfall.repeat.set(1, 2.2);

  const plaque = canvasTexture(768, 224, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(33,45,40,0.82)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(8, 8, w - 16, h - 16, 16);
    else ctx.rect(8, 8, w - 16, h - 16);
    ctx.fill();
    ctx.strokeStyle = '#b9975b';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, w - 40, h - 40);
    ctx.fillStyle = '#e2c68c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 80px "Songti SC", "STSong", Georgia, serif';
    ctx.fillText('浮 光 庭', w / 2, h / 2 - 2);
    ctx.font = '400 21px Georgia, serif';
    ctx.fillStyle = 'rgba(235,220,187,0.68)';
    ctx.fillText('A E T H E R   G A R D E N', w / 2, h / 2 + 62);
  }, { clamp: true });

  const starChart = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, w / 2);
    grad.addColorStop(0, '#213d3d');
    grad.addColorStop(1, '#0d1d22');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 240, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,197,142,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 222, 0, Math.PI * 2);
    ctx.stroke();
    for (let r = 50; r < 220; r += 54) {
      ctx.strokeStyle = 'rgba(198,183,144,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const constellations = [
      [[150, 170], [190, 146], [233, 162], [250, 215], [218, 260]],
      [[300, 142], [336, 178], [388, 170], [414, 218], [380, 252]],
      [[150, 320], [190, 345], [232, 320], [250, 368], [314, 358]]
    ];
    constellations.forEach((line) => {
      ctx.strokeStyle = 'rgba(195,226,209,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      line.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.stroke();
      line.forEach(([x, y]) => {
        ctx.fillStyle = 'rgba(239,220,168,0.9)';
        ctx.beginPath();
        ctx.arc(x, y, 3 + rng() * 2, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    for (let i = 0; i < 80; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * 205;
      ctx.fillStyle = 'rgba(221,235,218,' + (0.2 + rng() * 0.5) + ')';
      ctx.beginPath();
      ctx.arc(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 0.5 + rng() * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(194,220,199,0.6)';
    ctx.font = '13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('AETHER SKY ATLAS · III', w / 2, h - 58);
  }, { clamp: true });

  const banner = canvasTexture(256, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(44,91,82,0.94)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w * 0.92, h);
    ctx.lineTo(w / 2, h * 0.93);
    ctx.lineTo(w * 0.08, h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(237,216,171,0.82)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(18, 22);
    ctx.lineTo(w - 18, 22);
    ctx.stroke();
    ctx.fillStyle = 'rgba(238,216,171,0.92)';
    ctx.font = '600 82px "Songti SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText('云', w / 2, 175);
    ctx.font = '400 18px Georgia, serif';
    ctx.fillText('AETHER', w / 2, 240);
    ctx.beginPath();
    ctx.arc(w / 2, 325, 38, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(238,216,171,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, 325, 23, 0.2, Math.PI * 1.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, 325, 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(238,216,171,0.8)';
    ctx.fill();
  }, { clamp: true });

  return { grass, rock, stone, paving, wood, tiles, cloud, mist, glow, spark, petal, waterfall, plaque, starChart, banner };
}
