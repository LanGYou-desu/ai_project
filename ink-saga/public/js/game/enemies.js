// 墨战 · 天书纪 — 敌人与 Boss v2（精英变体 + 弱点提示，全程序化水墨渲染）
(function (g) {
  'use strict';

  function buildElLookup(dict) {
    const m = {};
    for (const c of dict || []) if (c.ch && !m[c.ch]) m[c.ch] = c.el || 'void';
    return m;
  }
  function buildCatLookup(dict) {
    const m = {};
    for (const c of dict || []) if (c.ch && !m[c.ch]) m[c.ch] = c.cat || '文';
    return m;
  }

  const EL_COLOR = {
    fire: '#e2571a', water: '#2f6fd0', wood: '#3e8e3a', metal: '#9aa0a8',
    earth: '#8a6239', thunder: '#e0b400', wind: '#2ea8a0', light: '#f5e27a',
    dark: '#6b4a8a', heart: '#d85f8a', shield: '#c9c9d8', blade: '#c03333', void: '#3a3a3a'
  };
  const EL_CN = {
    fire: '火', water: '水', wood: '木', metal: '金', earth: '土',
    thunder: '雷', wind: '风', light: '光', dark: '暗', heart: '心',
    shield: '盾', blade: '兵', void: '文'
  };

  const TEMPLATES = {
    mote:    { name: '墨点', hp: 30, speed: 26, r: 20, score: 10, qi: 8,  el: 'void', target: { type: 'any' }, desc: '最普通的墨点，任何字都能消灭' },
    wrong:   { name: '错字妖', hp: 55, speed: 34, r: 24, score: 20, qi: 14, el: 'dark', target: { type: 'char' }, desc: '必须写出它要求的字' },
    radical: { name: '部首兽', hp: 110, speed: 16, r: 32, score: 35, qi: 24, el: 'wood', target: { type: 'cat' }, desc: '写出它所属部首的字（如「水」部）' },
    word:    { name: '废词魔', hp: 150, speed: 22, r: 30, score: 50, qi: 34, el: 'dark', target: { type: 'word' }, desc: '连续写出两个字组成词语' },
    idiom:   { name: '成语魇', hp: 320, speed: 12, r: 38, score: 120, qi: 80, el: 'dark', target: { type: 'idiom' }, desc: '连续写出四个字组成成语' },
    mimic:   { name: '墨傀', hp: 260, speed: 17, r: 30, score: 80, qi: 55, el: 'void', target: { type: 'char' }, desc: '会吸收你写的字：每写对它一次就换一个字，直到过载' },
    inkchild:{ name: '墨童', hp: 22, speed: 50, r: 15, score: 8, qi: 6, el: 'void', target: { type: 'any' }, desc: '矮小迅捷的墨点幼体，成群扑来' },
    inkgen:  { name: '墨将', hp: 380, speed: 12, r: 44, score: 90, qi: 60, el: 'metal', target: { type: 'char' }, desc: '披甲重将，须写对字才能造成可观的伤害' },
    pen:     { name: '笔妖', hp: 120, speed: 24, r: 26, score: 60, qi: 40, el: 'void', target: { type: 'char' }, desc: '正在空中书写自己！在它写完前消灭它' },
    poem:    { name: '诗魔', hp: 420, speed: 10, r: 42, score: 200, qi: 120, el: 'dark', target: { type: 'poem' }, desc: '以诗句为体：连续写出整句诗才能击溃' }
  };

  const BOSS_TEMPLATES = {
    idiom_beast: { name: '成语魇', hp: 900, speed: 10, r: 70, score: 600, qi: 400, el: 'dark', title: 'Boss · 万词之魇', desc: '以成语残片为甲，散句为刃' },
    calligrapher: { name: '大书法家', hp: 1400, speed: 12, r: 62, score: 900, qi: 600, el: 'metal', title: 'Boss · 铁笔镇世', desc: '每一笔都是铁，每一字都是墙' },
    oracle: { name: '甲骨文之灵', hp: 1800, speed: 8, r: 78, score: 1200, qi: 800, el: 'earth', title: 'Boss · 文字之源', desc: '守护着文字最初的记忆' },
    inkdragon: { name: '墨龙', hp: 2600, speed: 9, r: 95, score: 2000, qi: 1200, el: 'dark', title: '终章 · 第一个字', desc: '被遗忘的文字，都沉睡在它体内' },
    zhenzhi:  { name: '镇纸兽', hp: 2200, speed: 6, r: 84, score: 1600, qi: 1000, el: 'earth', title: 'Boss · 万卷镇守', desc: '以压纸之力封锁你的笔势' },
    luobi:    { name: '落笔仙', hp: 3000, speed: 9, r: 72, score: 2200, qi: 1400, el: 'light', title: 'Boss · 挥毫成魔', desc: '每落一笔，便点出一名墨童' }
  };

  // 精英变体定义
  const VARIANTS = {
    armored: { name: '铁甲', mark: '甲', hpMul: 2.0, speedMul: 0.8, color: '#9aa0a8', desc: '披甲之妖：先写「金」部字破甲' },
    cursed:  { name: '诅咒', mark: '咒', hpMul: 1.3, speedMul: 1.0, color: '#6b4a8a', desc: '咒缚之妖：先写「暗」部字解咒' },
    swift:   { name: '疾影', mark: '疾', hpMul: 0.6, speedMul: 1.7, color: '#2ea8a0', desc: '来去如风，速度极快' }
  };

  function hexToRgba(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), gg = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + gg + ',' + b + ',' + a + ')';
  }

  function drawInkBlob(ctx, x, y, r, el, seed, alpha) {
    const s = seed || 1;
    let noise = s;
    const rnd = () => { noise = (noise * 9301 + 49297) % 233280; return noise / 233280; };
    const n = 22;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (0.82 + rnd() * 0.36);
      pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
    }
    const color = EL_COLOR[el] || '#3a3a3a';
    ctx.save();
    ctx.globalAlpha = (alpha ?? 1);
    const aura = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.6);
    aura.addColorStop(0, 'rgba(0,0,0,0)');
    aura.addColorStop(0.75, hexToRgba(color, 0.10));
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= n; i++) {
      const p0 = pts[(i - 1) % n], p1 = pts[i % n], p2 = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p0.x, p0.y, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
    }
    ctx.closePath();
    const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    body.addColorStop(0, '#2e2620');
    body.addColorStop(0.7, '#171310');
    body.addColorStop(1, '#0c0a08');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.fillStyle = hexToRgba(color, 0.5);
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2, rr = r * (0.2 + rnd() * 0.5);
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, r * 0.08, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return pts;
  }

  class Enemy {
    constructor(spec) {
      const t = TEMPLATES[spec.type] || TEMPLATES.mote;
      this.type = spec.type;
      this.name = t.name;
      this.variant = spec.variant || null;
      this.maxHp = t.hp * (spec.hpMul || 1);
      this.hp = this.maxHp;
      this.speed = t.speed * (spec.speedMul || 1) * (0.9 + Math.random() * 0.2);
      this.r = t.r;
      this.score = t.score;
      this.qi = t.qi;
      this.el = spec.el || t.el;
      this.target = spec.target || t.target;
      this.desc = t.desc;
      this.x = spec.x || 0;
      this.y = spec.y || 0;
      this.seed = Math.floor(Math.random() * 233280);
      this.state = 'walk';
      this.attackCd = 0;
      this.burn = 0; this.slow = 0; this.stun = 0;
      this.particles = [];
      this.flicker = Math.random() * Math.PI * 2;
      this.boss = false;
      this.needIdx = 0;
      // 笔妖：自我书写进度
      if (spec.type === 'pen') {
        this.progress = 0;
        this.progressRate = 0.22 + Math.random() * 0.1; // 约 3~4.5 秒写完
      }
      // 精英变体
      if (this.variant) {
        const v = VARIANTS[this.variant];
        if (v) {
          this.maxHp = Math.round(this.maxHp * v.hpMul);
          this.hp = this.maxHp;
          this.speed = this.speed * v.speedMul;
          this.vName = v.name;
          this.vMark = v.mark;
          this.vColor = v.color;
          this.vDesc = v.desc;
          if (this.variant === 'armored') this.armor = 1;      // 需写「金」部破甲
          if (this.variant === 'cursed') this.cursed = true;   // 需写「暗」部解咒
          if (this.variant === 'swift') this.r = Math.max(14, this.r * 0.7);
        }
      }
    }

    tick(dt, boundary) {
      this.flicker += dt * 3;
      if (this.stun > 0) { this.stun -= dt; return false; }
      if (this.slow > 0) this.slow -= dt;
      if (this.burn > 0) { this.burn -= dt; this.hp -= 6 * dt; }
      this.x -= this.speed * (this.slow > 0 ? 0.45 : 1) * dt;
      // 笔妖：自我书写进度
      if (this.type === 'pen' && this.progress !== undefined) {
        this.progress += this.progressRate * dt;
        if (this.progress >= 1) return 'pen_attack';
      }
      if (Math.random() < dt * 4) this.particles.push({ x: this.x + (Math.random() - 0.5) * this.r, y: this.y + this.r * 0.6, v: 20 + Math.random() * 20, life: 1 });
      for (const p of this.particles) { p.y += p.v * dt; p.life -= dt * 2; }
      this.particles = this.particles.filter(p => p.life > 0);
      if (this.x <= boundary) return true;
      return false;
    }

    render(ctx, now) {
      const pulse = 0.9 + Math.sin(this.flicker) * 0.08;
      drawInkBlob(ctx, this.x, this.y, this.r, this.el, this.seed, pulse);
      // 眼睛（墨童两枚大眼 / Boss 光眼 / 其余小眼）
      if (this.type !== 'mimic') {
        const eyeR = this.boss ? this.r * 0.16 : (this.type === 'inkchild' ? this.r * 0.28 : this.r * 0.13);
        const gap = this.r * 0.42;
        const ey = this.y - this.r * 0.1;
        ctx.save();
        ctx.fillStyle = this.boss ? 'rgba(224,180,0,0.9)' : 'rgba(246,241,227,0.9)';
        ctx.beginPath(); ctx.arc(this.x - gap, ey, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x + gap, ey, eyeR, 0, Math.PI * 2); ctx.fill();
        // 瞳孔
        ctx.fillStyle = this.boss ? '#8a2818' : '#2a2018';
        const pr = eyeR * 0.55;
        const lx = this.x - gap + Math.sin(this.flicker * 0.8) * eyeR * 0.4;
        const rx = this.x + gap + Math.sin(this.flicker * 0.8) * eyeR * 0.4;
        ctx.beginPath(); ctx.arc(lx, ey, pr, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx, ey, pr, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // 变体标识
      if (this.variant) {
        ctx.save();
        if (this.variant === 'armored') {
          ctx.strokeStyle = hexToRgba(this.vColor, 0.65);
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 5, 0, Math.PI * 2); ctx.stroke();
          // 甲片
          ctx.fillStyle = hexToRgba(this.vColor, 0.4);
          for (let i = 0; i < 6; i++) {
            const a = this.flicker * 0.5 + i * Math.PI / 3;
            ctx.beginPath(); ctx.arc(this.x + Math.cos(a) * (this.r + 5), this.y + Math.sin(a) * (this.r + 5), 3, 0, Math.PI * 2); ctx.fill();
          }
        } else if (this.variant === 'cursed') {
          ctx.strokeStyle = hexToRgba(this.vColor, 0.5);
          ctx.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            const a = this.flicker + i * Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(this.x + Math.cos(a) * (this.r + 8), this.y + Math.sin(a) * (this.r + 8));
            ctx.lineTo(this.x + Math.cos(a + 0.5) * (this.r + 16), this.y + Math.sin(a + 0.5) * (this.r + 16));
            ctx.stroke();
          }
        } else if (this.variant === 'swift') {
          ctx.strokeStyle = hexToRgba(this.vColor, 0.6);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(this.x + this.r + 4, this.y);
          ctx.lineTo(this.x + this.r + 18, this.y - 8);
          ctx.lineTo(this.x + this.r + 18, this.y + 8);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      // 墨傀：被吸收的字化为环绕的墨滴
      if (this.type === 'mimic' && this.absorbed) {
        ctx.save();
        for (let i = 0; i < this.absorbed; i++) {
          const a = this.flicker * 0.8 + i * (Math.PI * 2 / Math.max(1, this.absorbed));
          const rr = this.r + 12 + Math.sin(this.flicker * 1.7 + i) * 4;
          const mx = this.x + Math.cos(a) * rr, my = this.y + Math.sin(a) * rr;
          ctx.fillStyle = 'rgba(30,26,22,0.7)';
          ctx.beginPath(); ctx.arc(mx, my, 3.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(20,16,12,0.7)';
      for (const p of this.particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (this.hp < this.maxHp) {
        const w = this.r * 1.6, hh = 4, xx = this.x - w / 2, yy = this.y - this.r - 14;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(xx, yy, w, hh);
        ctx.fillStyle = this.el === 'dark' ? '#c03333' : EL_COLOR[this.el] || '#c03333';
        ctx.fillRect(xx, yy, w * Math.max(0, this.hp / this.maxHp), hh);
      }
      // 笔妖：书写进度条（写完即袭击）
      if (this.type === 'pen' && this.progress !== undefined) {
        const w = this.r * 1.8, hh = 4, xx = this.x - w / 2, yy = this.y - this.r - 20;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(xx, yy, w, hh);
        ctx.fillStyle = this.progress > 0.7 ? '#c03333' : '#8a2818';
        ctx.fillRect(xx, yy, w * Math.min(1, this.progress), hh);
      }
      // 墨童：速度残影
      if (this.type === 'inkchild') {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#2a2018';
        ctx.beginPath(); ctx.arc(this.x + this.r + 8, this.y - 2, this.r * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    renderLabel(ctx, fontCh, currentIdx) {
      const texts = this.targetTexts();
      const n = texts.length;
      const cw = 30, chh = 30, gap = 3;
      const tw = n * (cw + gap) - gap;
      const xx = this.x - tw / 2, yy = this.y - this.r - 38;
      ctx.save();
      ctx.fillStyle = 'rgba(250,246,234,0.92)';
      ctx.strokeStyle = 'rgba(150,40,30,0.85)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < n; i++) {
        const bx = xx + i * (cw + gap);
        ctx.fillRect(bx, yy, cw, chh);
        ctx.strokeRect(bx, yy, cw, chh);
        const active = this.target.type === 'word' || this.target.type === 'idiom';
        const isCur = active && i === (currentIdx ?? this.needIdx ?? 0);
        if (isCur) { ctx.fillStyle = 'rgba(150,40,30,0.16)'; ctx.fillRect(bx, yy, cw, chh); }
        ctx.fillStyle = '#2a2018';
        ctx.font = 'bold 20px KaiTi, STKaiti, serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(texts[i], bx + cw / 2, yy + chh / 2 + 1);
      }
      // 变体标记角标
      if (this.variant) {
        ctx.fillStyle = hexToRgba(this.vColor || '#3a3a3a', 0.9);
        ctx.font = 'bold 13px KaiTi, serif';
        ctx.fillText(this.vMark || '', xx - 8, yy + chh / 2 + 1);
      }
      ctx.restore();
    }

    targetTexts() {
      const t = this.target;
      if (this.armor) return ['金部'];
      if (this.cursed) return ['暗部'];
      if (t.type === 'any') return ['任'];
      if (t.type === 'char') return [t.ch];
      if (t.type === 'cat') return [EL_CN[t.cat] + '部'];
      if (t.type === 'word' || t.type === 'idiom' || t.type === 'poem') return t.chars.slice();
      return ['任'];
    }
  }

  class Boss extends Enemy {
    constructor(bossId, spec) {
      super({ type: 'mote', hpMul: 1, target: { type: 'any' } });
      const t = BOSS_TEMPLATES[bossId];
      this.boss = true;
      this.bossId = bossId;
      this.name = t.name;
      this.title = t.title;
      this.desc = t.desc;
      this.maxHp = t.hp * (spec.hpMul || 1);
      this.hp = this.maxHp;
      this.speed = t.speed;
      this.r = t.r;
      this.score = t.score;
      this.qi = t.qi;
      this.el = t.el;
      this.phase = 1;
      this.skillCd = 4;
      this.needChars = spec.needChars || ['斩', '破', '灭'];
      this.needIdx = 0;
      this.guarded = true;
      this.spawnMinionCd = 6;
    }
    renderLabel(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(250,246,234,0.95)';
      ctx.strokeStyle = 'rgba(150,40,30,0.9)';
      ctx.lineWidth = 2;
      const label = this.guarded ? '破防 · 写「' + this.needChars[this.needIdx] + '」' : '破防中 · 全力书写！';
      const fw = 26, fh = 26;
      const tw = Math.max(label.length * 14 + 20, 40);
      const xx = this.x - tw / 2, yy = this.y - this.r - 30;
      ctx.fillStyle = 'rgba(250,246,234,0.92)';
      ctx.fillRect(xx, yy, tw, fh);
      ctx.strokeRect(xx, yy, tw, fh);
      ctx.fillStyle = '#8a2818';
      ctx.font = 'bold 16px KaiTi, STKaiti, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, xx + tw / 2, yy + fh / 2 + 1);
      ctx.restore();
    }
  }

  g.INK_ENEMIES = { TEMPLATES, BOSS_TEMPLATES, VARIANTS, EL_COLOR, EL_CN, Enemy, Boss, buildElLookup, buildCatLookup, drawInkBlob, hexToRgba };
})(typeof globalThis !== 'undefined' ? globalThis : this);
