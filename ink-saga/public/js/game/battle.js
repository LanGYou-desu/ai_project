// 墨战 · 天书纪 — 战斗场景引擎 v2（导引水印 / 震屏 / 光环 / 弱点提示 / 波次奖励 / 精英变体 / 暂停）
(function (g) {
  'use strict';

  const { InkInput } = g.INK_INPUT;
  const R = g.INK_RECOGNITION;
  const { InkBrush, makePaperTexture } = g.INK_BRUSH;
  const E = g.INK_ENEMIES;
  const S = g.INK_SPELLS;

  // 确定性种子随机（每日挑战：同种子同题）
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  class Battle {
    constructor(opts) {
      this.canvas = opts.canvas;
      this.ctx = this.canvas.getContext('2d');
      this.mode = opts.mode;
      this.config = opts.config;
      this.onEnd = opts.onEnd || (() => {});
      this.onHud = opts.onHud || (() => {});
      this.getState = opts.getState || (() => ({}));
      this.dict = opts.dict || [];
      this.words = opts.words || { words2: [], idioms: [] };
      this.elOf = E.buildElLookup(this.dict);
      this.catOf = E.buildCatLookup(this.dict);

      this.input = new InkInput(this.canvas);
      this.brush = new InkBrush(this.ctx);
      this.audio = g.INK_AUDIO.instance || null;

      this.bg = null;
      this.enemies = [];
      this.fx = new FX(this.ctx);
      this.spawnQueue = [];
      this.spawnTimer = 0;
      this.boss = null;
      this.time = 0;
      this.state = 'running';
      this.paused = false;
      this.stats = { kills: 0, written: 0, wrong: 0, perfects: 0, misses: [], maxCombo: 0, qiEarned: 0, score: 0, charsUsed: {}, startTime: 0, wavesCleared: 0 };
      this.scrambled = 0;
      this.shake = { t: 0, mag: 0 };
      this.waveBonusPending = false;
      this.waveIndex = 0;
      this.lastVerdict = null;   // {ch, score, ok, t}
      this.guideTarget = null;   // 导引水印 {ch, key}

      this.boundary = 96;
      this.rnd = (opts.seed != null && opts.seed !== undefined) ? mulberry32(opts.seed) : Math.random;
      this.theme = opts.theme || g.INK_THEMES.themeOf(this.config.chapterId, this.mode) || { bg: 'paper', weather: null, scale: g.INK_THEMES.SCALE_BRIGHT };
      this.threshold = opts.threshold ?? 0.15;
      this.perfectTh = opts.perfectTh ?? 0.50;
      this._setupPlayer();
      this._setupWaves();
      this.input.onStrokeStart = () => {
        const p0 = this.input.points[0];
        this.brush.begin(p0 ? p0.x : 0, p0 ? p0.y : 0);
        this.lastVerdict = null;
        if (this.audio) this.audio.swish(0.3);
      };
      this.input.onStrokeMove = (pts) => {
        const last = pts[pts.length - 1];
        const prev = pts.length > 1 ? pts[pts.length - 2] : last;
        const sp = Math.hypot(last.x - prev.x, last.y - prev.y);
        this.brush.move(last.x, last.y, sp);
        if (this.audio && Math.random() < 0.12) this.audio.swish(Math.min(1, sp / 12));
      };
      this.input.onStrokeEnd = (pts) => { this.brush.end(); this._resolveStroke(InkInput.smooth(pts)); };
      this._bindResize();
      this._buildBg();
      if (this.audio) this.audio.startAmbience();
    }

    _setupPlayer() {
      const st = this.getState();
      const gr = (st && st.growth) || {};
      const lv = (id) => gr.levels ? (gr.levels[id] || 1) : 1;
      // 文房四宝加成
      let eb = { power: 0, crit: 0, hp: 0, qiMul: 0 };
      if (g.INK_EQUIP && st && st.equipment) eb = g.INK_EQUIP.statBonus(st.equipment);
      this.power = (16 + (lv('power') - 1) * 6) + eb.power;
      this.critChance = (0.05 + (lv('crit') - 1) * 0.04) + eb.crit;
      this.maxHp = Math.round((100 + (lv('pool') - 1) * 12) + eb.hp);
      this.qiMul = (1 + (lv('qi') - 1) * 0.1) + eb.qiMul;
      // 连墨/破锐
      this.comboWindow = 3.5 + (lv('combo') - 1) * 0.35;
      this.bossMul = 1 + (lv('boss') - 1) * 0.12;
      this.player = { hp: this.maxHp, maxHp: this.maxHp, shield: 0, qi: 0, qiBonus: 0, combo: 0, comboTime: 0 };
    }

    _setupWaves() {
      if (this.mode === 'story') {
        const ch = g.INK_STORY.chapters.find(c => c.id === this.config.chapterId);
        this.chapter = ch;
        if (ch) {
          this.spawnQueue = ch.waves.map(w => Object.assign({}, w));
          if (ch.boss) this.bossSpec = ch.boss;
        }
      } else {
        const lv = this.config.level || 1;
        this.spawnQueue = [
          { type: 'mote', count: 4 + lv, gap: Math.max(1.1, 2.4 - lv * 0.06) },
          { type: 'wrong', count: Math.max(1, Math.floor(2 + lv * 0.7)), gap: Math.max(1.2, 2.2 - lv * 0.05) },
          { type: 'radical', count: Math.max(1, Math.floor(lv * 0.5)), gap: 2.0 },
          { type: 'word', count: Math.max(1, Math.floor(1 + lv * 0.4)), gap: 2.6 }
        ];
        if (lv >= 2) this.spawnQueue.push({ type: 'mimic', count: Math.max(1, Math.floor(lv * 0.35)), gap: 2.8 });
        if (lv >= 3) this.spawnQueue.push({ type: 'inkchild', count: 3 + lv, gap: 0.9 });
        if (lv >= 4) this.spawnQueue.push({ type: 'pen', count: Math.max(1, Math.floor(lv * 0.3)), gap: 3.0 });
        if (lv >= 5) this.spawnQueue.push({ type: 'inkgen', count: Math.max(1, Math.floor(lv * 0.25)), gap: 3.2 });
        if (lv >= 6) this.spawnQueue.push({ type: 'poem', count: Math.max(1, Math.floor((lv - 4) * 0.4)), gap: 4.0 });
        if (lv >= 3) this.spawnQueue.push({ type: 'idiom', count: Math.max(1, Math.floor((lv - 2) * 0.5)), gap: 3.4 });
        this.hpMul = 1 + lv * 0.12;
        this.speedMul = 1 + lv * 0.03;
        this.variantChance = Math.min(0.45, 0.08 + lv * 0.02);
        if (lv % 5 === 0) {
          const bosses = ['idiom_beast', 'calligrapher', 'oracle', 'inkdragon', 'zhenzhi', 'luobi'];
          this.bossSpec = { id: bosses[(Math.floor(lv / 5) - 1) % bosses.length] };
        }
      }
    }

    _bindResize() {
      const fit = () => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
        this.canvas.width = w * dpr; this.canvas.height = h * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this._buildBg();
      };
      window.addEventListener('resize', fit);
      this._fit = fit;
      fit();
    }

    _buildBg() {
      const w = this.canvas.clientWidth || 900, h = this.canvas.clientHeight || 600;
      const theme = this.theme || {};
      const bgType = theme.bg || 'paper';
      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const ctx = bg.getContext('2d');
      // 底色
      const base = { paper: '#f6f1e3', rain: '#d8d4c8', bamboo: '#eef0df', water: '#dfe6e0', iron: '#b9b8b2', bones: '#e4dcc8', dragon: '#241a18' }[bgType] || '#f6f1e3';
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      if (bgType === 'rain') {
        // 雨夜：暗山 + 斜雨
        ctx.fillStyle = 'rgba(70,80,95,0.16)';
        this._drawMountains(ctx, w, h, 4);
        ctx.strokeStyle = 'rgba(90,100,120,0.18)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 140; i++) {
          const x = (i * 97) % w, y = (i * 53) % h;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 7, y + 16);
          ctx.stroke();
        }
      } else if (bgType === 'bamboo') {
        // 竹影
        ctx.fillStyle = 'rgba(60,95,60,0.14)';
        for (let i = 0; i < 7; i++) {
          const x = w * 0.08 + i * w * 0.14 + Math.sin(i * 2.1) * 12;
          const bh = h * (0.5 + (i % 3) * 0.18);
          ctx.fillRect(x, h - bh, 7, bh);
          // 竹节
          for (let y = h - 30; y > h - bh; y -= 38) ctx.fillRect(x - 2, y, 11, 3);
          // 竹叶
          ctx.beginPath();
          ctx.moveTo(x + 3, h - bh + 14);
          ctx.quadraticCurveTo(x - 26, h - bh - 16, x - 34, h - bh - 4);
          ctx.quadraticCurveTo(x - 16, h - bh + 6, x + 3, h - bh + 14);
          ctx.fill();
        }
      } else if (bgType === 'water') {
        // 泽水波纹
        ctx.strokeStyle = 'rgba(60,110,120,0.15)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 12; i++) {
          const y = h * (0.3 + i * 0.06);
          ctx.beginPath();
          for (let x = 0; x <= w; x += 12) {
            const yy = y + Math.sin(x * 0.03 + i * 1.3) * 5;
            x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
      } else if (bgType === 'iron') {
        // 铁城：网格 + 兵戈
        ctx.strokeStyle = 'rgba(70,65,60,0.20)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(140,120,40,0.20)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
          const x = w * (0.15 + i * 0.18);
          ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 30, h * 0.35); ctx.stroke();
        }
      } else if (bgType === 'bones') {
        // 甲骨裂纹
        ctx.strokeStyle = 'rgba(120,90,60,0.25)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 10; i++) {
          let x = (i * 137) % w, y = (i * 89) % h;
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let s = 0; s < 5; s++) {
            x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 46;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        // 零星甲骨刻痕
        ctx.fillStyle = 'rgba(120,90,60,0.16)';
        for (let i = 0; i < 24; i++) {
          const x = (i * 211) % w, y = (i * 173) % h;
          ctx.font = '13px KaiTi, serif';
          ctx.fillText('卜', x, y);
        }
      } else if (bgType === 'dragon') {
        // 墨龙巢：红光
        const grd = ctx.createRadialGradient(w * 0.7, h * 0.35, 40, w * 0.7, h * 0.35, w * 0.7);
        grd.addColorStop(0, 'rgba(150,40,30,0.28)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(150,40,30,0.10)';
        this._drawMountains(ctx, w, h, 3);
      } else {
        // 宣纸 + 远山
        ctx.fillStyle = 'rgba(40,34,28,0.10)';
        this._drawMountains(ctx, w, h, 5);
      }
      // 暗色调压暗
      if (theme.dark) {
        ctx.fillStyle = 'rgba(30,26,22,0.12)';
        ctx.fillRect(0, 0, w, h);
      }
      this.bg = bg;
      // 天气粒子初始化
      this.weather = [];
      const wt = theme.weather;
      if (wt === 'rain') { for (let i = 0; i < 70; i++) this.weather.push({ type: 'rain', x: Math.random() * w, y: Math.random() * h, v: 420 + Math.random() * 220, len: 12 + Math.random() * 10 }); }
      else if (wt === 'embers') { for (let i = 0; i < 34; i++) this.weather.push({ type: 'ember', x: Math.random() * w, y: Math.random() * h, v: 30 + Math.random() * 40, size: 1.5 + Math.random() * 2, drift: (Math.random() - 0.5) * 24 }); }
      else if (wt === 'petals') { for (let i = 0; i < 26; i++) this.weather.push({ type: 'petal', x: Math.random() * w, y: Math.random() * h, v: 26 + Math.random() * 30, size: 2 + Math.random() * 2.5, drift: (Math.random() - 0.5) * 30, spin: Math.random() * 6 }); }
      else if (wt === 'mist') { for (let i = 0; i < 10; i++) this.weather.push({ type: 'mist', x: Math.random() * w, y: h * 0.6 + Math.random() * h * 0.3, v: 12 + Math.random() * 16, size: 70 + Math.random() * 90, alpha: 0.10 + Math.random() * 0.10 }); }
      else if (wt === 'wind') { for (let i = 0; i < 18; i++) this.weather.push({ type: 'wind', x: Math.random() * w, y: Math.random() * h, v: 380 + Math.random() * 300, len: 20 + Math.random() * 26 }); }
      else if (wt === 'smoke') { for (let i = 0; i < 16; i++) this.weather.push({ type: 'smoke', x: Math.random() * w, y: h * 0.7 + Math.random() * h * 0.2, v: -18 + Math.random() * -10, size: 26 + Math.random() * 34, alpha: 0.12 + Math.random() * 0.10, drift: (Math.random() - 0.5) * 16 }); }
    }

    _drawMountains(ctx, w, h, n) {
      for (let i = 0; i < n; i++) {
        const baseY = h * (0.55 + i * 0.07);
        const amp = h * (0.10 + Math.random() * 0.12);
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) {
          const y = baseY - Math.sin(x * 0.004 + i * 1.7) * amp - Math.sin(x * 0.011 + i) * amp * 0.4;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      }
    }

    setPaused(p) { this.paused = p; if (!p && this.audio) this.audio.startAmbience(); }

    start() {
      this.stats.startTime = performance.now();
      // 旋律层：无尽层数越高节奏越快
      if (this.audio) {
        const lv = this.config.level || 0;
        this.audio.startMelody({
          tempo: this.mode === 'endless' ? Math.max(0.26, 0.52 - lv * 0.02) : 0.5,
          gain: this.mode === 'endless' ? 0.03 : 0.026,
          scale: (this.theme && this.theme.scale) || g.INK_THEMES.SCALE_BRIGHT
        });
      }
    }

    update(dt) {
      if (this.state !== 'running' || this.paused) return;
      this.time += dt;
      // 生成器
      if (this.spawnQueue.length) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          const w = this.spawnQueue[0];
          this._spawn(w.type);
          w.count--;
          this.spawnTimer = w.gap;
          if (w.count <= 0) {
            this.spawnQueue.shift();
            this.waveIndex++;
            this.waveBonusPending = true;
          }
        }
      } else if (this.bossSpec && !this.boss && !this.bossSpawned) {
        this._spawnBoss(this.bossSpec);
        this.bossSpawned = true;
      }
      // 波次间隙奖励
      if (this.waveBonusPending && this.enemies.length === 0 && this.spawnQueue.length > 0) {
        this.waveBonusPending = false;
        const bonus = 10 + this.waveIndex * 6;
        this.player.qi += bonus;
        this.stats.qiEarned += bonus;
        this.fx.addText(this.canvas.clientWidth / 2, 120, '波次间隙 · 文气 +' + bonus, '#3e8e3a', 18);
        if (this.audio) this.audio.hit(1);
      }
      if (this.boss) this._bossTick(dt);
      const reached = [];
      const penAttacks = [];
      for (const e of this.enemies) {
        const r2 = e.tick(dt, this.boundary);
        if (r2 === 'pen_attack') penAttacks.push(e);
        else if (r2 === true) reached.push(e);
      }
      for (const e of reached) this._enemyReached(e);
      for (const e of penAttacks) {
        this.enemies = this.enemies.filter(x => x !== e);
        this._playerTakeRaw(10);
        this.fx.addText(e.x, e.y - e.r - 30, '笔妖写完！-10 砚血', '#c03333', 16);
        this.fx.burst(e.x, e.y, '#c03333');
        if (this.audio) this.audio.hurt();
      }
      if (this.player.combo > 0) {
        this.player.comboTime -= dt;
        if (this.player.comboTime <= 0) this.player.combo = 0;
      }
      if (this.player.buffDmg > 0) {
        this.player.buffDmgT -= dt;
        if (this.player.buffDmgT <= 0) this.player.buffDmg = 0;
      }
      if (this.scrambled > 0) this.scrambled -= dt;
      if (this.inkLock > 0) this.inkLock -= dt;
      if (this.boss && !this.boss.guarded) {
        this.boss.unguardT = (this.boss.unguardT || 0) - dt;
        if (this.boss.unguardT <= 0) { this.boss.guarded = true; this.boss.needIdx = (this.boss.needIdx + 1) % this.boss.needChars.length; }
      }
      this.brush.update(dt);
      this.fx.update(dt);
      this._updateWeather(dt);
      if (this.shake.t > 0) this.shake.t -= dt;
      if (this.lastVerdict) { this.lastVerdict.t -= dt; if (this.lastVerdict.t <= 0) this.lastVerdict = null; }
      // 判定结束
      if (this.player.hp <= 0) { this._end('defeat'); return; }
      const enemiesAll = this.enemies.length === 0;
      const queueDone = this.spawnQueue.length === 0;
      const bossDone = !this.bossSpec || (this.boss && this.boss.hp <= 0);
      if (enemiesAll && queueDone && bossDone) this._end('clear');
      this._hud();
    }

    _spawn(type) {
      const spec = { type };
      if (type === 'char') type = 'wrong';
      if (type === 'wrong') spec.target = { type: 'char', ch: this._pickChar() };
      if (type === 'radical') {
        const cats = ['水', '火', '木', '金', '土', '雷', '风', '光', '暗'];
        const cat = cats[Math.floor(this.rnd() * cats.length)];
        spec.target = { type: 'cat', cat: CAT_TO_EL[cat] || 'water' };
        spec.el = CAT_TO_EL[cat];
      }
      if (type === 'word') {
        const w = this.words.words2[Math.floor(this.rnd() * this.words.words2.length)];
        spec.target = { type: 'word', chars: w.w.split('') };
        spec.el = 'dark';
      }
      if (type === 'idiom') {
        const w = this.words.idioms[Math.floor(this.rnd() * this.words.idioms.length)];
        spec.target = { type: 'idiom', chars: w.w.split('') };
        spec.el = 'dark';
      }
      if (type === 'mimic') {
        spec.target = { type: 'char', ch: this._pickChar() };
        spec.el = 'void';
      }
      if (type === 'inkchild') { spec.el = 'void'; }
      if (type === 'inkgen') { spec.target = { type: 'char', ch: this._pickChar() }; spec.el = 'metal'; }
      if (type === 'pen') { spec.target = { type: 'char', ch: this._pickChar() }; spec.el = 'void'; }
      if (type === 'poem') {
        const lines = this.words.poems || [];
        if (lines.length) {
          const ln = lines[Math.floor(this.rnd() * lines.length)];
          spec.target = { type: 'poem', chars: ln.w.split(''), src: ln.src };
        } else {
          const w = this.words.idioms[Math.floor(this.rnd() * this.words.idioms.length)];
          spec.target = { type: 'poem', chars: w.w.split(''), src: w.p };
        }
        spec.el = 'dark';
      }
      if (this.mode === 'endless') {
        spec.hpMul = this.hpMul; spec.speedMul = this.speedMul;
        // 精英变体（错字妖/部首兽 可携带）
        if (this.variantChance && this.rnd() < this.variantChance && (type === 'wrong' || type === 'radical' || type === 'word')) {
          const pool = ['armored', 'cursed', 'swift'];
          spec.variant = pool[Math.floor(this.rnd() * pool.length)];
        }
      }
      const e = new E.Enemy(spec);
      e.x = this.canvas.clientWidth + 50;
      e.y = this._laneY(e.r);
      this.enemies.push(e);
      return e;
    }

    _pickChar() {
      const pool = this.dict.filter(c => c.ch.length === 1 && c.el !== 'void');
      const c = pool[Math.floor(this.rnd() * pool.length)];
      return c ? c.ch : '火';
    }

    _laneY(r) {
      const h = this.canvas.clientHeight;
      return Math.max(r + 50, Math.min(h - r - 60, r + 60 + this.rnd() * (h - 2 * r - 140)));
    }

    _spawnBoss(spec) {
      const boss = new E.Boss(spec.id, spec);
      boss.x = this.canvas.clientWidth + 80;
      boss.y = this.canvas.clientHeight * 0.42;
      this.boss = boss;
      this.enemies.push(boss);
      this.fx.addText(boss.x - 200, boss.y - boss.r - 60, boss.title + ' 来袭！', '#8a2818', 26);
      if (this.audio) this.audio.gong();
    }

    _spawnMotes(n) {
      for (let i = 0; i < n; i++) {
        const m = this._spawn('mote');
        m.x = this.canvas.clientWidth + 20 + Math.random() * 60;
      }
    }
    _playerTakeRaw(dmg) {
      if (this.player.shield > 0) {
        const absorbed = Math.min(this.player.shield, dmg);
        this.player.shield -= absorbed;
        this.fx.addText(this.canvas.clientWidth * 0.3, 80, '盾抵 -' + absorbed, '#c9c9d8', 16);
        if (this.audio) this.audio.shield();
      } else {
        this.player.hp -= dmg;
        this.fx.addText(this.canvas.clientWidth * 0.3, 80, '-' + dmg, '#c03333', 20);
        this._shake(3, 3);
      }
    }

    _bossTick(dt) {
      const b = this.boss;
      if (b.hp <= 0) return;
      // 二阶段：半血狂暴
      if (b.phase === 1 && b.hp < b.maxHp * 0.5) {
        b.phase = 2;
        b.speed *= 1.5;
        b.skillCd = Math.min(b.skillCd, 3);
        this._shake(8, 5);
        this.fx.addText(this.canvas.clientWidth / 2, 90, b.name + ' 墨怒！第二阶段！', '#c03333', 24);
        if (this.audio) { this.audio.gong(); this.audio.thunder(); }
      }
      b.skillCd -= dt;
      b.spawnMinionCd -= dt;
      if (b.spawnMinionCd <= 0 && this.enemies.length < 12) {
        b.spawnMinionCd = 5 + Math.random() * 4;
        const m = this._spawn('mote');
        m.x = this.canvas.clientWidth + 30;
        if (this.audio) this.audio.splat(0.3);
      }
      if (b.skillCd <= 0) {
        b.skillCd = 7 + Math.random() * 4;
        if (b.bossId === 'calligrapher') {
          this.scrambled = 2.5;
          this._shake(5, 3);
          this.fx.addText(this.canvas.clientWidth / 2, 90, '字乱！目标文字被铁笔搅乱！', '#c03333', 18);
          if (this.audio) this.audio.wrong();
        } else if (b.bossId === 'oracle') {
          // 字谜：按释义写字
          const pool = this.dict.filter(c => c.el !== 'void');
          const c = pool[Math.floor(this.rnd() * pool.length)];
          b.riddle = { answer: c.ch, meaning: c.meaning, timer: 6 };
          this.fx.addText(this.canvas.clientWidth / 2, 90, '字谜：写「' + c.meaning + '」', '#f5e27a', 18);
          if (this.audio) this.audio.gong();
        } else if (b.bossId === 'inkdragon') {
          // 龙息：写「盾」格挡
          b.breath = { timer: 2.5 };
          this._shake(6, 4);
          this.fx.addText(this.canvas.clientWidth / 2, 90, '龙息将至！写「盾」格挡！', '#6b4a8a', 20);
          if (this.audio) this.audio.thunder();
        } else if (b.bossId === 'zhenzhi') {
          // 镇纸：封锁笔势（识别更难 4 秒）
          this.inkLock = 4;
          this._shake(4, 3);
          this.fx.addText(this.canvas.clientWidth / 2, 90, '镇纸压笔！4 秒内书写更难！', '#8a6239', 18);
          if (this.audio) this.audio.wrong();
        } else if (b.bossId === 'luobi') {
          // 落笔点兵：召出墨童群
          this._spawnMotes(3);
          this._shake(4, 3);
          this.fx.addText(this.canvas.clientWidth / 2, 90, '落笔点兵！墨童蜂拥而出！', '#f5e27a', 18);
          if (this.audio) this.audio.splat(0.8);
        } else {
          // 残句：补最后一字
          const w = this.words.idioms[Math.floor(this.rnd() * this.words.idioms.length)];
          b.frag = { chars: w.w.split(''), missing: w.w[3], timer: 4 };
          this.fx.addText(this.canvas.clientWidth / 2, 90, '残句：「' + w.w.slice(0, 3) + '□」补最后一字！', '#c03333', 18);
          if (this.audio) this.audio.wrong();
        }
      }
      // 机制计时
      if (b.breath) {
        b.breath.timer -= dt;
        if (b.breath.timer <= 0) {
          b.breath = null;
          this._playerTakeRaw(15);
          this.fx.addText(this.canvas.clientWidth / 2, 100, '龙息命中！-15 砚血', '#c03333', 20);
          if (this.audio) this.audio.hurt();
        }
      }
      if (b.riddle) {
        b.riddle.timer -= dt;
        if (b.riddle.timer <= 0) {
          b.riddle = null;
          this._spawnMotes(2);
          this.fx.addText(this.canvas.clientWidth / 2, 100, '字谜未解，墨涌滋生！', '#8a6239', 16);
        }
      }
      if (b.frag) {
        b.frag.timer -= dt;
        if (b.frag.timer <= 0) {
          b.frag = null;
          this._spawnMotes(2);
          this.fx.addText(this.canvas.clientWidth / 2, 100, '残句未补，魇气四溢！', '#8a6239', 16);
        }
      }
    }

    _shake(t, mag) { this.shake = { t: Math.max(this.shake.t, t), mag: Math.max(this.shake.mag, mag) }; }

    _updateWeather(dt) {
      if (!this.weather || !this.weather.length) return;
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      for (const p of this.weather) {
        if (p.type === 'rain') { p.y += p.v * dt; p.x -= p.v * 0.42 * dt; if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; } if (p.x < -20) p.x = w + 20; }
        else if (p.type === 'ember') { p.y -= p.v * dt; p.x += p.drift * dt; if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; } }
        else if (p.type === 'petal') { p.y += p.v * dt; p.x += Math.sin(p.spin += dt * 2) * p.drift * dt; if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; } }
        else if (p.type === 'mist') { p.x += p.v * dt; if (p.x > w + p.size) p.x = -p.size; }
        else if (p.type === 'wind') { p.x -= p.v * dt; if (p.x < -40) p.x = w + 40; }
        else if (p.type === 'smoke') { p.y += p.v * dt; p.x += p.drift * dt; if (p.y < -40) { p.y = h + 20; p.x = Math.random() * w; } }
      }
    }

    _renderWeather(ctx, w, h) {
      if (!this.weather || !this.weather.length) return;
      ctx.save();
      for (const p of this.weather) {
        if (p.type === 'rain') {
          ctx.strokeStyle = 'rgba(110,125,150,0.30)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 7, p.y + p.len); ctx.stroke();
        } else if (p.type === 'ember') {
          ctx.fillStyle = 'rgba(230,120,40,' + (0.35 + Math.sin(p.x * 0.1 + p.y * 0.05) * 0.15) + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === 'petal') {
          ctx.fillStyle = 'rgba(220,140,160,0.5)';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === 'mist') {
          const grd = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.size);
          grd.addColorStop(0, 'rgba(210,220,215,' + p.alpha + ')');
          grd.addColorStop(1, 'rgba(210,220,215,0)');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === 'wind') {
          ctx.strokeStyle = 'rgba(160,150,130,0.25)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.len, p.y); ctx.stroke();
        } else if (p.type === 'smoke') {
          ctx.fillStyle = 'rgba(90,90,95,' + p.alpha + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }

    _enemyReached(e) {
      this.enemies = this.enemies.filter(x => x !== e);
      const dmg = Math.max(4, Math.round(e.r / 6) + (this.mode === 'endless' ? this.config.level : 0));
      if (this.player.shield > 0) {
        const absorbed = Math.min(this.player.shield, dmg);
        this.player.shield -= absorbed;
        this.fx.addText(this.canvas.clientWidth * 0.3, 80, '盾破 -' + absorbed, '#c9c9d8', 16);
        if (this.audio) this.audio.shield();
      } else {
        this.player.hp -= dmg;
        this.fx.addText(this.canvas.clientWidth * 0.3, 80, '-' + dmg, '#c03333', 20);
        this._shake(3, 3);
        if (this.audio) this.audio.hurt();
      }
      this.fx.addText(e.x, e.y, e.name + ' 越界！', '#c03333', 14);
      this.player.combo = 0;
    }

    // ---------- 书写判定 ----------
    _resolveStroke(pts) {
      if (this.state !== 'running' || this.paused) return;
      const candidates = this._collectCandidates();
      if (!candidates.length) return;
      const effTh = this.inkLock > 0 ? Math.min(0.30, this.threshold + 0.06) : this.threshold;
      const res = R.match(pts, candidates, effTh);
      if (!res) {
        const all = R.recognize(pts, candidates);
        this.player.combo = 0;
        this.stats.wrong++;
        const top = all.length && all[0].score > 0.07 ? all[0].ch : null;
        this._setVerdict(top ? top : '？', 0, false);
        this.fx.addText(this.canvas.clientWidth / 2, 120, top ? '你写的是「' + top + '」？' : '笔走偏锋，未成字……', '#7a6a5a', 15);
        if (top) this._recordMiss(top, '未识别');
        if (this.audio) this.audio.wrong();
        return;
      }
      const ch = res.ch;
      this.stats.written++;
      this.stats.charsUsed[ch] = (this.stats.charsUsed[ch] || 0) + 1;
      // Boss 机制交互
      if (this.boss && this.boss.hp > 0) {
        if (this.boss.breath && ch === '盾') {
          this.boss.breath = null;
          this.fx.addText(this.canvas.clientWidth / 2, 100, '墨盾格挡龙息！', '#c9c9d8', 22);
          this.fx.burst(this.canvas.clientWidth / 2, 110, '#c9c9d8');
          if (this.audio) this.audio.shield();
          return;
        }
        if (this.boss.riddle && ch === this.boss.riddle.answer) {
          const bdmg = 250 + this.power * 2;
          this.boss.hp -= bdmg;
          this.fx.addText(this.boss.x, this.boss.y - this.boss.r - 90, '字谜破解！-' + Math.round(bdmg), '#f5e27a', 20);
          this.fx.burst(this.boss.x, this.boss.y, '#f5e27a');
          if (this.audio) this.audio.perfect();
          this.boss.riddle = null;
          this.stats.perfects++;
          if (this.boss.hp <= 0) this._kill(this.boss);
          return;
        }
        if (this.boss.frag && ch === this.boss.frag.missing) {
          const bdmg = 250 + this.power * 2;
          this.boss.hp -= bdmg;
          this.fx.addText(this.boss.x, this.boss.y - this.boss.r - 90, '残句补全！-' + Math.round(bdmg), '#e0b400', 20);
          this.fx.burst(this.boss.x, this.boss.y, '#e0b400');
          if (this.audio) this.audio.perfect();
          this.boss.frag = null;
          this.stats.perfects++;
          if (this.boss.hp <= 0) this._kill(this.boss);
          return;
        }
      }
      const perfect = res.score > this.perfectTh;
      if (perfect) this.stats.perfects++;
      const hitTargets = this.enemies.filter(e => this._accepts(e, ch));
      if (!hitTargets.length) {
        this.player.combo = 0;
        this.stats.wrong++;
        this._recordMiss(ch, '未命中目标');
        this._setVerdict(ch, res.score, false);
        this.fx.addText(this.canvas.clientWidth / 2, 120, '「' + ch + '」没打中任何敌人', '#9a8a7a', 15);
        if (this.audio) this.audio.wrong();
        return;
      }
      this._setVerdict(ch, res.score, true);
      for (const e of hitTargets) this._applyHit(e, ch, res.score, perfect);
    }

    _setVerdict(ch, score, ok) {
      this.lastVerdict = { ch, score, ok, t: 1.2 };
    }

    _collectCandidates() {
      const set = new Set();
      for (const e of this.enemies) {
        // 精英锁：破甲需「金」部、解咒需「暗」部
        if (e.armor) { for (const c of this.dict) if (c.cat === '金') set.add(c.ch); continue; }
        if (e.cursed) { for (const c of this.dict) if (c.cat === '暗') set.add(c.ch); continue; }
        const t = e.target;
        if (t.type === 'any') { for (const c of this.dict) set.add(c.ch); }
        else if (t.type === 'char') set.add(t.ch);
        else if (t.type === 'cat') { for (const c of this.dict) if (c.cat === CAT_TO_CN[t.cat]) set.add(c.ch); }
        else if (t.type === 'word' || t.type === 'idiom' || t.type === 'poem') {
          const idx = e.needIdx || 0;
          if (idx < t.chars.length) set.add(t.chars[idx]);
        }
      }
      return [...set];
    }

    _accepts(e, ch) {
      const t = e.target;
      // 精英锁：铁甲需「金」部破甲，诅咒需「暗」部解咒
      if (e.armor) return this.catOf[ch] === '金';
      if (e.cursed) return this.catOf[ch] === '暗';
      if (t.type === 'any') return this.elOf[ch] !== undefined;
      if (t.type === 'char') return t.ch === ch;
      if (t.type === 'cat') return this.catOf[ch] === CAT_TO_CN[t.cat];
      if (t.type === 'word' || t.type === 'idiom' || t.type === 'poem') {
        const idx = e.needIdx || 0;
        return idx < t.chars.length && t.chars[idx] === ch;
      }
      return false;
    }

    _applyHit(e, ch, score, perfect) {
      const el = this.elOf[ch] || 'void';
      const comboMult = 1 + this.player.combo * 0.04;
      const elMult = S.elementMult(el, e.el);
      let dmg = this.power * comboMult * elMult;
      if (this.player.buffDmg > 0) dmg *= this.player.buffDmg;
      const isCrit = Math.random() < this.critChance;
      if (isCrit) dmg *= 2.2;
      if (perfect) dmg *= 1.3;
      // 破甲/解咒
      if (e.armor) { e.armor = 0; this.fx.addText(e.x, e.y - e.r - 56, '甲破！', '#9aa0a8', 18); if (this.audio) this.audio.shield(); dmg *= 1.5; }
      if (e.cursed) { e.cursed = false; this.fx.addText(e.x, e.y - e.r - 56, '咒解！', '#6b4a8a', 18); if (this.audio) this.audio.heal(); dmg *= 1.3; }
      if (this.boss && e === this.boss) {
        dmg *= (this.bossMul || 1);
        if (e.guarded) dmg *= 0.5;
        else dmg *= 2;
      }
      const spell = S.EFFECTS[el] || S.EFFECTS.void;
      const spellCtx = { enemy: e, player: this.player, enemies: this.enemies, fx: this.fx, audio: this.audio, dmg };
      dmg = dmg * (spell.dmg || 1);
      spell.apply(spellCtx);
      e.hp -= dmg;
      this.fx.addFloat(e.x + (Math.random() - 0.5) * 20, e.y - e.r - 10, Math.round(dmg) + (isCrit ? '!' : ''), isCrit ? '#e0b400' : '#2a2018');
      this.fx.ring(e.x, e.y, E.EL_COLOR[el] || '#3a3a3a');
      this.player.combo++;
      this.player.comboTime = this.comboWindow || 3.5;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.player.combo);
      if (isCrit) this._shake(2, 2);
      if (this.audio) perfect ? this.audio.perfect() : this.audio.hit(this.player.combo);
      // 连击里程碑：每 10 连触发增益
      if (this.player.combo > 0 && this.player.combo % 10 === 0) this._comboMilestone(this.player.combo);
      if (perfect) this.fx.addText(e.x, e.y - e.r - 34, '笔笔生花！', '#e0b400', 15);
      if (e.type === 'mimic') {
        // 墨傀：吸收当前字，换新字，累计吸收数
        e.absorbed = (e.absorbed || 0) + 1;
        e.target = { type: 'char', ch: this._pickChar() };
        this.fx.addText(e.x, e.y - e.r - 60, '吸收！已吞 ' + e.absorbed + ' 字', '#3a3a3a', 14);
        if (e.hp <= 0) this._kill(e);
      } else if (e.target.type === 'word' || e.target.type === 'idiom' || e.target.type === 'poem') {
        e.needIdx = (e.needIdx || 0) + 1;
        if (e.needIdx >= e.target.chars.length) {
          // 诗魔整句成诗：额外奖励
          if (e.target.type === 'poem') {
            this.stats.score += 60;
            this.fx.addText(e.x, e.y - e.r - 70, e.target.src || '', '#c03333', 16);
            if (this.audio) this.audio.gong();
          }
          this._kill(e);
        }
      } else if (e.hp <= 0) {
        this._kill(e);
      }
      if (this.boss && e === this.boss && e.guarded && e.needChars.includes(ch)) {
        e.guarded = false; e.unguardT = 6;
        this.fx.addText(e.x, e.y - e.r - 60, '破防！', '#e2571a', 22);
        this._shake(4, 3);
        if (this.audio) this.audio.thunder();
      }
    }

    _kill(e) {
      this.enemies = this.enemies.filter(x => x !== e);
      this.stats.kills++;
      this.stats.killByType = this.stats.killByType || {};
      const kt = e.boss ? ('boss:' + e.bossId) : e.type;
      this.stats.killByType[kt] = (this.stats.killByType[kt] || 0) + 1;
      const comboMult = 1 + this.player.combo * 0.04;
      const qiGain = Math.round(e.qi * comboMult * this.qiMul + (this.player.qiBonus || 0));
      this.player.qi += qiGain;
      this.stats.qiEarned += qiGain;
      const sc = Math.round(e.score * comboMult);
      this.stats.score += sc;
      this.fx.addText(e.x, e.y - e.r - 10, '+' + qiGain + ' 文气', '#3e8e3a', 14);
      this.fx.burst(e.x, e.y, E.EL_COLOR[e.el] || '#3a3a3a');
      this.fx.ring(e.x, e.y, E.EL_COLOR[e.el] || '#3a3a3a', 1.4);
      if (e.variant && e.variant === 'swift') this._shake(2, 2);
      // 装备掉落
      if (g.INK_EQUIP) {
        const dropChance = e.boss ? 1 : 0.08;
        if (Math.random() < dropChance) {
          this.stats.drops = this.stats.drops || [];
          const it = g.INK_EQUIP.makeItem(g.INK_EQUIP.SLOTS[Math.floor(Math.random() * g.INK_EQUIP.SLOTS.length)]);
          this.stats.drops.push(it);
          this.fx.addText(e.x, e.y - e.r - 30, '获得「' + it.name + '」', g.INK_EQUIP.RARITY_MAP[it.rarity].color, 15);
        }
      }
      if (this.audio) this.audio.die();
      if (this.boss && e === this.boss) {
        this.fx.addText(this.canvas.clientWidth / 2, 100, e.title + ' 被击溃！', '#e2571a', 28);
        this._shake(8, 5);
        if (this.audio) this.audio.gong();
      }
    }

    _comboMilestone(n) {
      const kind = (n / 10) % 3;
      const c = this.canvas.clientWidth / 2;
      if (kind === 0) {
        this.player.buffDmg = 1.2; this.player.buffDmgT = 5;
        this.fx.addText(c, 150, '连墨 ×' + n + '！笔力激增！', '#e0b400', 20);
        if (this.audio) this.audio.perfect();
      } else if (kind === 1) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 12);
        this.fx.addText(c, 150, '连墨 ×' + n + '！砚血回涌 +12', '#d85f8a', 20);
        if (this.audio) this.audio.heal();
      } else {
        this.player.shield = Math.min(60, (this.player.shield || 0) + 20);
        this.fx.addText(c, 150, '连墨 ×' + n + '！墨盾 +20', '#c9c9d8', 20);
        if (this.audio) this.audio.shield();
      }
    }

    _recordMiss(ch, why) {
      const m = this.stats.misses.find(x => x.ch === ch);
      if (m) m.count++; else this.stats.misses.push({ ch, why, count: 1 });
    }

    _end(result) {
      if (this.state !== 'running') return;
      this.state = result;
      if (this.audio) { this.audio.stopAmbience(); this.audio.stopMelody(); }
      this.stats.time = (performance.now() - this.stats.startTime) / 1000;
      this.stats.result = result;
      this.stats.mode = this.mode;
      this.stats.level = this.config.level || 0;
      this.stats.chapterId = this.config.chapterId || null;
      this.stats.wavesCleared = this.waveIndex;
      this.onEnd(this.stats, this.player);
    }

    _hud() {
      const p = this.player;
      this.onHud({
        hp: Math.max(0, Math.round(p.hp)), maxHp: p.maxHp, shield: Math.round(p.shield || 0),
        combo: p.combo, maxCombo: this.stats.maxCombo, qi: p.qi, score: this.stats.score,
        time: this.time, wave: this.mode === 'endless' ? '第 ' + this.config.level + ' 层' : (this.chapter ? this.chapter.title : ''),
        boss: this.boss && this.boss.hp > 0 ? { name: this.boss.name, hp: this.boss.hp, maxHp: this.boss.maxHp, guarded: this.boss.guarded } : null,
        enemies: this.enemies.length
      });
    }

    // 当前最紧急的目标字（用于导引水印）
    _priorityGuide() {
      if (!this.enemies.length) return null;
      let best = null;
      for (const e of this.enemies) {
        const ch = this._currentNeeded(e);
        if (!ch) continue;
        if (!best || e.x < best.x) best = { ch, e };
      }
      return best;
    }
    _currentNeeded(e) {
      const t = e.target;
      if (e.armor) return '金';
      if (e.cursed) return '暗';
      if (t.type === 'any') return null; // 任意字不引导
      if (t.type === 'char') return t.ch;
      if (t.type === 'cat') return CAT_TO_CN[t.cat] + '部';
      if (t.type === 'word' || t.type === 'idiom' || t.type === 'poem') {
        const idx = e.needIdx || 0;
        return idx < t.chars.length ? t.chars[idx] : null;
      }
      return null;
    }

    render() {
      const ctx = this.ctx;
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      // 震屏
      ctx.save();
      if (this.shake.t > 0) {
        const m = this.shake.mag * (this.shake.t / 0.3 > 1 ? 1 : this.shake.t / 0.3);
        ctx.translate((Math.random() - 0.5) * m * 2, (Math.random() - 0.5) * m * 2);
      }
      if (this.bg) ctx.drawImage(this.bg, 0, 0, w, h);
      this._renderWeather(ctx, w, h);
      // 纸界
      ctx.save();
      ctx.strokeStyle = 'rgba(40,30,20,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(this.boundary, 0); ctx.lineTo(this.boundary, h); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(40,30,20,0.5)';
      ctx.font = '12px KaiTi, serif';
      ctx.textAlign = 'center';
      ctx.fillText('纸 界', this.boundary, 16);
      ctx.restore();
      // 导引水印（右下角临摹层）
      const guide = this._priorityGuide();
      if (guide && guide.ch.length === 1) {
        const gw = 130, gh = 130;
        const gx = w - gw - 26, gy = h - gh - 26;
        ctx.save();
        ctx.globalAlpha = 0.22;
        R.drawGuideAnimated(ctx, guide.ch, gx, gy, gw, gh, (this.time % 2.4) / 2.4);
        ctx.restore();
        ctx.save();
        ctx.fillStyle = 'rgba(42,32,24,0.6)';
        ctx.font = '12px KaiTi, serif';
        ctx.textAlign = 'center';
        ctx.fillText('临摹此字 · 笔顺不限', gx + gw / 2, gy - 6);
        ctx.restore();
      }
      // 敌人
      const sorted = [...this.enemies].sort((a, b) => (a.boss ? 1 : 0) - (b.boss ? 1 : 0));
      for (const e of sorted) {
        e.render(ctx, this.time);
        if (e.boss && e.phase === 2) {
          // 狂暴红环 + 怒字
          ctx.save();
          ctx.strokeStyle = 'rgba(192,51,51,' + (0.5 + Math.sin(this.time * 6) * 0.3) + ')';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 10 + Math.sin(this.time * 4) * 3, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(192,51,51,0.85)';
          ctx.font = 'bold 22px KaiTi, serif';
          ctx.textAlign = 'center';
          ctx.fillText('怒', e.x, e.y - e.r - 62);
          ctx.restore();
        }
        e.renderLabel(ctx, null, e.needIdx || 0);
        // 弱点提示（克制的元素）
        const weak = S.WEAKNESS[e.el];
        if (weak) {
          ctx.save();
          ctx.fillStyle = 'rgba(250,246,234,0.8)';
          ctx.font = '11px KaiTi, serif';
          ctx.textAlign = 'center';
          const txt = '克 ' + (E.EL_CN[weak] || '');
          const tw2 = ctx.measureText(txt).width + 8;
          ctx.fillRect(e.x - tw2 / 2, e.y - e.r - 54, tw2, 15);
          ctx.fillStyle = '#b8912e';
          ctx.fillText(txt, e.x, e.y - e.r - 43);
          ctx.restore();
        }
      }
      // 判定反馈（最近一次写的字）
      if (this.lastVerdict && this.lastVerdict.t > 0) {
        const v = this.lastVerdict;
        ctx.save();
        ctx.globalAlpha = Math.min(1, v.t);
        ctx.fillStyle = v.ok ? (v.score > this.perfectTh ? '#e0b400' : '#3e8e3a') : '#c03333';
        ctx.font = 'bold 26px KaiTi, serif';
        ctx.textAlign = 'center';
        ctx.fillText('「' + v.ch + '」', this.canvas.clientWidth / 2, h - 90);
        ctx.font = '13px KaiTi, serif';
        ctx.fillText(v.ok ? (v.score > this.perfectTh ? '完美！' : '命中！') : '未中', this.canvas.clientWidth / 2, h - 66);
        ctx.restore();
      }
      // 特效
      this.fx.render();
      // 笔迹
      this.brush.render();
      ctx.restore();
    }

    destroy() {
      if (this.audio) { this.audio.stopAmbience(); this.audio.stopMelody(); }
      if (this._fit) window.removeEventListener('resize', this._fit);
      if (this.input) this.input.destroy();
      this.state = 'destroyed';
    }
  }

  const CAT_TO_EL = { '火': 'fire', '水': 'water', '木': 'wood', '金': 'metal', '土': 'earth', '雷': 'thunder', '风': 'wind', '光': 'light', '暗': 'dark', '心': 'heart', '盾': 'shield', '兵': 'blade', '文': 'void' };
  const CAT_TO_CN = Object.fromEntries(Object.entries(CAT_TO_EL).map(([k, v]) => [v, k]));
  g.INK_BATTLE_CAT = { CAT_TO_EL, CAT_TO_CN };

  class FX {
    constructor(ctx) {
      this.ctx = ctx;
      this.texts = [];
      this.floats = [];
      this.bursts = [];
      this.lightnings = [];
      this.rings = [];
    }
    addText(x, y, text, color, size) { if (this.texts.length > 24) this.texts.shift(); this.texts.push({ x, y, text, color, size: size || 16, life: 1.6, max: 1.6 }); }
    addFloat(x, y, text, color) { if (this.floats.length > 40) this.floats.shift(); this.floats.push({ x, y, text, color, life: 0.9, max: 0.9, vy: -60 }); }
    burst(x, y, color) {
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 90;
        this.bursts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.7, max: 0.7, color, size: 2 + Math.random() * 3 });
      }
      if (this.bursts.length > 200) this.bursts.splice(0, this.bursts.length - 200);
    }
    ring(x, y, color, scale) {
      this.rings.push({ x, y, color, life: 0.45, max: 0.45, r: 10 * (scale || 1), grow: 90 * (scale || 1) });
      if (this.rings.length > 20) this.rings.shift();
    }
    lightning(x, y) { this.lightnings.push({ x, y, life: 0.25, max: 0.25 }); if (this.lightnings.length > 8) this.lightnings.shift(); }
    update(dt) {
      for (const t of this.texts) t.life -= dt;
      this.texts = this.texts.filter(t => t.life > 0);
      for (const f of this.floats) { f.life -= dt; f.y += f.vy * dt; }
      this.floats = this.floats.filter(f => f.life > 0);
      for (const b of this.bursts) { b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 120 * dt; }
      this.bursts = this.bursts.filter(b => b.life > 0);
      for (const l of this.lightnings) l.life -= dt;
      this.lightnings = this.lightnings.filter(l => l.life > 0);
      for (const r of this.rings) { r.life -= dt; r.r += r.grow * dt; }
      this.rings = this.rings.filter(r => r.life > 0);
    }
    render() {
      const ctx = this.ctx;
      for (const t of this.texts) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, t.life / (t.max * 0.6));
        ctx.fillStyle = t.color || '#2a2018';
        ctx.font = 'bold ' + t.size + 'px KaiTi, STKaiti, serif';
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
      }
      for (const f of this.floats) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, f.life / f.max);
        ctx.fillStyle = f.color || '#2a2018';
        ctx.font = 'bold 15px KaiTi, serif';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
      }
      for (const r of this.rings) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, r.life / r.max);
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      for (const b of this.bursts) {
        ctx.globalAlpha = Math.max(0, b.life / b.max);
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const l of this.lightnings) {
        ctx.save();
        ctx.strokeStyle = 'rgba(224,180,0,' + (l.life / l.max) + ')';
        ctx.lineWidth = 2;
        let x = l.x, y = l.y - 40;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let i = 0; i < 5; i++) { x += (Math.random() - 0.5) * 40; y += 30; ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  g.INK_BATTLE = { Battle, FX, CAT_TO_EL, CAT_TO_CN, mulberry32 };
})(typeof globalThis !== 'undefined' ? globalThis : this);
