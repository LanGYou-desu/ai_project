// 墨战 · 天书纪 — 剧情场景水墨插图（程序化氛围背景）
(function (g) {
  'use strict';

  function drawSceneBackdrop(canvas, bgType) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const sky = { paper: '#f6f1e3', rain: '#c9c7bd', bamboo: '#eef0df', water: '#dde6e0', iron: '#b7b6b0', bones: '#e4dcc8', dragon: '#201816' };
    ctx.fillStyle = sky[bgType] || sky.paper;
    ctx.fillRect(0, 0, w, h);

    // 光体
    if (bgType === 'dragon') {
      const grd = ctx.createRadialGradient(w * 0.7, h * 0.3, 10, w * 0.7, h * 0.3, w * 0.5);
      grd.addColorStop(0, 'rgba(150,40,30,0.5)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    } else if (bgType === 'rain' || bgType === 'bones') {
      ctx.fillStyle = 'rgba(240,240,225,0.7)';
      ctx.beginPath(); ctx.arc(w * 0.8, h * 0.22, 26, 0, Math.PI * 2); ctx.fill();
    } else if (bgType === 'bamboo' || bgType === 'paper') {
      ctx.fillStyle = 'rgba(230,120,60,0.35)';
      ctx.beginPath(); ctx.arc(w * 0.78, h * 0.2, 20, 0, Math.PI * 2); ctx.fill();
    }

    // 远山两层
    ctx.fillStyle = 'rgba(60,52,42,0.20)';
    mountain(ctx, w, h, 0.78, 0.16, 0.55);
    ctx.fillStyle = 'rgba(40,34,28,0.30)';
    mountain(ctx, w, h, 0.88, 0.22, 0.78);

    // 主题元素
    if (bgType === 'rain') {
      ctx.strokeStyle = 'rgba(100,110,130,0.22)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        const x = (i * 83) % w, y = (i * 47) % h;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 14); ctx.stroke();
      }
    } else if (bgType === 'bamboo') {
      ctx.fillStyle = 'rgba(60,95,60,0.20)';
      for (let i = 0; i < 5; i++) {
        const x = w * 0.12 + i * w * 0.19;
        const bh = h * (0.45 + (i % 3) * 0.2);
        ctx.fillRect(x, h - bh, 6, bh);
        for (let y = h - 24; y > h - bh; y -= 34) ctx.fillRect(x - 2, y, 10, 3);
      }
    } else if (bgType === 'water') {
      ctx.strokeStyle = 'rgba(60,110,120,0.18)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const y = h * (0.35 + i * 0.08);
        ctx.beginPath();
        for (let x = 0; x <= w; x += 10) {
          const yy = y + Math.sin(x * 0.03 + i * 1.3) * 4;
          x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    } else if (bgType === 'iron') {
      ctx.strokeStyle = 'rgba(70,65,60,0.18)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    } else if (bgType === 'bones') {
      ctx.strokeStyle = 'rgba(120,90,60,0.22)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        let x = (i * 137) % w, y = (i * 89) % h;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 4; s++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 40; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }

    function mountain(ctx, w, h, base, amp, alpha) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        const y = h * base - Math.sin(x * 0.004) * h * amp - Math.sin(x * 0.011 + 2) * h * amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
  }

  g.INK_SCENEART = { drawSceneBackdrop };
})(typeof globalThis !== 'undefined' ? globalThis : this);
