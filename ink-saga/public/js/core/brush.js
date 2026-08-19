// 墨战 · 天书纪 — 毛笔粒子渲染 + 宣纸纹理（零素材，全程序化）
(function (g) {
  'use strict';

  function makePaperTexture(w, h, seed) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#f6f1e3';
    ctx.fillRect(0, 0, w, h);
    let s = seed || 7;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < w * h * 0.18; i++) {
      const x = rnd() * w, y = rnd() * h, r = rnd() * 1.4 + 0.3;
      ctx.fillStyle = 'rgba(140,120,90,' + (rnd() * 0.08 + 0.02) + ')';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(150,130,100,0.10)';
    for (let i = 0; i < w * h * 0.002; i++) {
      const x = rnd() * w, y = rnd() * h, len = 4 + rnd() * 10, ang = rnd() * Math.PI;
      ctx.lineWidth = 0.5 + rnd();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
    const grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(60,45,30,0.16)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    return cv;
  }

  class InkBrush {
    constructor(ctx) {
      this.ctx = ctx;
      this.particles = [];
      this.trail = [];
      this.drawing = false;
      this.MAX_PARTICLES = 420;
      this.inkColor = 'rgba(20,16,12,';
    }

    begin(x, y) {
      this.drawing = true;
      this.trail = [{ x, y, w: 4 }];
    }

    move(x, y, speed) {
      if (!this.drawing) return;
      const w = Math.max(1.5, Math.min(7, 5 - speed * 0.06));
      this.trail.push({ x, y, w });
      if (speed > 1.2 && Math.random() < 0.5) this.spawn(x, y, speed, 1.2);
      if (this.trail.length > 40) this.trail.shift();
    }

    spawn(x, y, speed, mult) {
      if (this.particles.length >= this.MAX_PARTICLES) this.particles.shift();
      const ang = Math.random() * Math.PI * 2;
      const sp = (0.2 + Math.random() * 0.8) * (speed || 1) * (mult || 1);
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 1, maxLife: 20 + Math.random() * 25,
        size: 1 + Math.random() * 2.4,
        alpha: 0.5 + Math.random() * 0.4
      });
    }

    splat(x, y, power) {
      const n = Math.min(26, 18 + Math.floor(power * 12));
      for (let i = 0; i < n; i++) this.spawn(x, y, power * (0.8 + Math.random() * 0.6), 2.2);
    }

    end() {
      this.drawing = false;
      if (this.trail.length) {
        const t = this.trail[this.trail.length - 1];
        this.splat(t.x, t.y, 0.8);
      }
      this.trail = [];
    }

    clear() { this.particles = []; this.trail = []; }

    update(dt) {
      for (const p of this.particles) {
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vx *= 0.92; p.vy *= 0.92;
        p.life -= dt * 60 / p.maxLife;
      }
      this.particles = this.particles.filter(p => p.life > 0 && p.x > -20 && p.x < this.ctx.canvas.width + 20 && p.y > -20 && p.y < this.ctx.canvas.height + 20);
    }

    render() {
      const ctx = this.ctx;
      if (this.trail.length > 1) {
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 1; i < this.trail.length; i++) {
          const a = this.trail[i - 1], b = this.trail[i];
          ctx.strokeStyle = 'rgba(18,14,10,0.85)';
          ctx.lineWidth = b.w;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.restore();
      }
      for (const p of this.particles) {
        const a = Math.max(0, p.alpha * Math.max(0, p.life));
        ctx.fillStyle = this.inkColor + a + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.6 + p.life * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  g.INK_BRUSH = { InkBrush, makePaperTexture };
})(typeof globalThis !== 'undefined' ? globalThis : this);
