// 墨战 · 天书纪 — 书法练习场：自由临摹 + 实时识别反馈
(function (g) {
  'use strict';

  const { InkInput } = g.INK_INPUT;
  const R = g.INK_RECOGNITION;
  const { InkBrush } = g.INK_BRUSH;

  class Practice {
    constructor(opts) {
      this.canvas = opts.canvas;
      this.ctx = this.canvas.getContext('2d');
      this.dict = opts.dict || [];
      this.target = null;
      this.streak = 0;
      this.best = 0;
      this.lastScore = null;
      this.verdictEl = opts.verdictEl || null;
      this.statsEls = opts.statsEls || {};
      this.onUpdate = opts.onUpdate || (() => {});
      this.audio = g.INK_AUDIO.instance || null;

      this.input = new InkInput(this.canvas);
      this.brush = new InkBrush(this.ctx);
      this.fx = new g.INK_BATTLE.FX(this.ctx);
      this.bg = null;
      this.fxTexts = [];

      this.input.onStrokeStart = () => {
        const p0 = this.input.points[0];
        this.brush.begin(p0 ? p0.x : 0, p0 ? p0.y : 0);
        if (this.audio) this.audio.swish(0.25);
      };
      this.input.onStrokeMove = (pts) => {
        const last = pts[pts.length - 1];
        const prev = pts.length > 1 ? pts[pts.length - 2] : last;
        const sp = Math.hypot(last.x - prev.x, last.y - prev.y);
        this.brush.move(last.x, last.y, sp);
        if (this.audio && Math.random() < 0.08) this.audio.swish(Math.min(1, sp / 14));
      };
      this.input.onStrokeEnd = (pts) => { this.brush.end(); this._judge(InkInput.smooth(pts)); };

      this._resize();
      window.addEventListener('resize', this._resize.bind(this));
      this._buildBg();
      if (this.audio) this.audio.startMelody({ tempo: 0.7, gain: 0.02 });
    }

    _resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      if (!w || !h) return;
      this.canvas.width = w * dpr; this.canvas.height = h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._buildBg();
    }

    _buildBg() {
      const w = this.canvas.clientWidth || 600, h = this.canvas.clientHeight || 420;
      const paper = g.INK_BRUSH.makePaperTexture ? g.INK_BRUSH.makePaperTexture(w, h, 23) : null;
      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const ctx = bg.getContext('2d');
      if (paper) ctx.drawImage(paper, 0, 0);
      // 田字格
      ctx.strokeStyle = 'rgba(42,32,24,0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.beginPath();
      ctx.moveTo(w / 2, 4); ctx.lineTo(w / 2, h - 4);
      ctx.moveTo(4, h / 2); ctx.lineTo(w - 4, h / 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(42,32,24,0.10)';
      ctx.beginPath();
      ctx.moveTo(4, 4); ctx.lineTo(w - 4, h - 4);
      ctx.moveTo(w - 4, 4); ctx.lineTo(4, h - 4);
      ctx.stroke();
      this.bg = bg;
    }

    setTarget(ch) {
      const d = this.dict.find(c => c.ch === ch) || null;
      this.target = { ch, pinyin: d ? d.pinyin : '', meaning: d ? d.meaning : '' };
      this.lastScore = null;
      this._refreshInfo();
    }

    randomTarget() {
      const pool = this.dict.filter(c => c.el !== 'void');
      const c = pool[Math.floor(Math.random() * pool.length)];
      if (c) this.setTarget(c.ch);
    }

    _refreshInfo() {
      if (!this.target) return;
      const el = document.getElementById('practice-char');
      const py = document.getElementById('practice-pinyin');
      const me = document.getElementById('practice-mean');
      if (el) el.textContent = this.target.ch;
      if (py) py.textContent = this.target.pinyin;
      if (me) me.textContent = this.target.meaning;
    }

    _judge(pts) {
      if (!this.target) return;
      const res = R.recognize(pts, this.dict.map(c => c.ch));
      if (!res.length) { this._verdict('笔走偏锋，未成字……', '#7a6a5a'); return; }
      const top = res[0];
      const hit = top.ch === this.target.ch;
      const score = top.score;
      this.lastScore = Math.round(score * 100);
      if (hit) {
        this.streak++;
        if (this.streak > this.best) this.best = this.streak;
        const perfect = score > 0.50;
        this._verdict(perfect ? '笔笔生花！' : '写对了！', perfect ? '#e0b400' : '#3e8e3a');
        if (this.audio) perfect ? this.audio.perfect() : this.audio.hit(this.streak);
        this.fx.burst(this.canvas.clientWidth / 2, this.canvas.clientHeight / 2, perfect ? '#e0b400' : '#3e8e3a');
        // 统计
        const st = g.INK_SAVE.load();
        st.stats.practiceSessions = (st.stats.practiceSessions || 0) + 1;
        if (perfect) st.stats.practicePerfects = (st.stats.practicePerfects || 0) + 1;
        g.INK_SAVE.save();
        g.INK_ACHIEVEMENTS.checkAll(st, a => { const t = document.getElementById('toast'); if (t) { t.textContent = '成就达成：' + a.name; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); } });
      } else {
        this.streak = 0;
        this._verdict('你写的是「' + top.ch + '」？再对照临摹区练练', '#c03333');
        if (this.audio) this.audio.wrong();
      }
      this._updateStats();
    }

    _verdict(text, color) {
      this.fxTexts.push({ text, color, t: 1.6 });
      if (this.verdictEl) {
        this.verdictEl.textContent = text;
        this.verdictEl.style.color = color;
      }
    }

    _updateStats() {
      const st = g.INK_SAVE.load();
      if (this.statsEls.streak) this.statsEls.streak.textContent = this.streak;
      if (this.statsEls.best) this.statsEls.best.textContent = this.best;
      if (this.statsEls.total) this.statsEls.total.textContent = (st.stats.practiceSessions || 0);
      this.onUpdate({ streak: this.streak, best: this.best, lastScore: this.lastScore });
    }

    loop(ts) {
      if (this._destroyed) return;
      const dt = Math.min(0.05, (ts - (this._last || ts)) / 1000);
      this._last = ts;
      this.ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
      if (this.bg) this.ctx.drawImage(this.bg, 0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
      // 导引水印
      if (this.target) {
        const gw = Math.min(180, this.canvas.clientWidth * 0.3), gh = gw;
        const gx = this.canvas.clientWidth / 2 - gw / 2, gy = this.canvas.clientHeight / 2 - gh / 2;
        this.ctx.save();
        this.ctx.globalAlpha = 0.18;
        R.drawGuideAnimated(this.ctx, this.target.ch, gx, gy, gw, gh, (ts / 1000 % 3) / 3);
        this.ctx.restore();
      }
      this.brush.update(dt);
      this.fx.update(dt);
      this.fx.render();
      this.brush.render();
      // 判定文字
      for (const ft of this.fxTexts) ft.t -= dt;
      this.fxTexts = this.fxTexts.filter(ft => ft.t > 0);
      if (this.fxTexts.length) {
        const ft = this.fxTexts[this.fxTexts.length - 1];
        this.ctx.save();
        this.ctx.globalAlpha = Math.min(1, ft.t);
        this.ctx.fillStyle = ft.color;
        this.ctx.font = 'bold 24px KaiTi, serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(ft.text, this.canvas.clientWidth / 2, this.canvas.clientHeight - 20);
        this.ctx.restore();
      }
      requestAnimationFrame(this.loop.bind(this));
    }

    destroy() {
      this._destroyed = true;
      if (this.input) this.input.destroy();
      if (this.audio) this.audio.stopMelody();
    }
  }

  g.INK_PRACTICE = { Practice };
})(typeof globalThis !== 'undefined' ? globalThis : this);
