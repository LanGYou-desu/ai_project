// 墨战 · 天书纪 — 挥毫疾书：60 秒限时书写挑战
(function (g) {
  'use strict';

  const { InkInput } = g.INK_INPUT;
  const R = g.INK_RECOGNITION;
  const { InkBrush } = g.INK_BRUSH;

  class TimeAttack {
    constructor(opts) {
      this.canvas = opts.canvas;
      this.ctx = this.canvas.getContext('2d');
      this.dict = opts.dict || [];
      this.onHud = opts.onHud || (() => {});
      this.onEnd = opts.onEnd || (() => {});
      this.audio = g.INK_AUDIO.instance || null;
      this.DURATION = 60;
      this.timeLeft = this.DURATION;
      this.score = 0;
      this.correct = 0;
      this.wrong = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.target = null;
      this.targetTime = 3;
      this.state = 'running';

      this.input = new InkInput(this.canvas);
      this.brush = new InkBrush(this.ctx);
      this.fx = new g.INK_BATTLE.FX(this.ctx);
      this.bg = null;
      this._resize();
      window.addEventListener('resize', this._resize.bind(this));
      this._buildBg();
      this._nextTarget();

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
      };
      this.input.onStrokeEnd = (pts) => { this.brush.end(); this._judge(InkInput.smooth(pts)); };
      if (this.audio) this.audio.startMelody({ tempo: 0.32, gain: 0.032 });
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
      const w = this.canvas.clientWidth || 700, h = this.canvas.clientHeight || 460;
      const paper = g.INK_BRUSH.makePaperTexture ? g.INK_BRUSH.makePaperTexture(w, h, 41) : null;
      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const ctx = bg.getContext('2d');
      if (paper) ctx.drawImage(paper, 0, 0);
      // 计时区装饰
      ctx.fillStyle = 'rgba(42,32,24,0.08)';
      ctx.fillRect(0, 0, w, 58);
      this.bg = bg;
    }

    _pickChar() {
      const pool = this.dict.filter(c => c.el !== 'void' && c.ch.length === 1);
      return pool[Math.floor(Math.random() * pool.length)];
    }

    _nextTarget() {
      const c = this._pickChar();
      this.target = { ch: c.ch, pinyin: c.pinyin };
      this.targetTime = 3;
      if (this.audio) this.audio.swish(0.3);
    }

    _judge(pts) {
      if (this.state !== 'running' || !this.target) return;
      const res = R.match(pts, this.dict.map(d => d.ch), 0.15);
      if (!res) { this._feedback('未成字……', '#7a6a5a'); if (this.audio) this.audio.wrong(); return; }
      if (res.ch === this.target.ch) {
        this.correct++;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        const pts2 = 10 + this.combo * 2;
        this.score += pts2;
        this.fx.addFloat(this.canvas.clientWidth / 2, 140, '+' + pts2, '#3e8e3a');
        this.fx.burst(this.canvas.clientWidth / 2, this.canvas.clientHeight / 2, '#3e8e3a');
        this._feedback('写对了！' + (this.combo > 1 ? ' 连墨 ×' + this.combo : ''), '#3e8e3a');
        if (this.audio) this.audio.hit(this.combo);
        this._nextTarget();
      } else {
        this.wrong++;
        this.combo = 0;
        this._feedback('你写的是「' + res.ch + '」？再试试', '#c03333');
        if (this.audio) this.audio.wrong();
      }
      this._hud();
    }

    _feedback(text, color) {
      this.fx.addText(this.canvas.clientWidth / 2, 110, text, color, 17);
    }

    _hud() {
      this.onHud({
        time: Math.ceil(this.timeLeft), score: this.score, combo: this.combo,
        correct: this.correct, wrong: this.wrong, target: this.target ? this.target.ch : null, pinyin: this.target ? this.target.pinyin : ''
      });
    }

    loop(ts) {
      if (this._destroyed) return;
      const dt = Math.min(0.05, (ts - (this._last || ts)) / 1000);
      this._last = ts;
      if (this.state === 'running') {
        this.timeLeft -= dt;
        this.targetTime -= dt;
        if (this.targetTime <= 0) { this.wrong++; this.combo = 0; this._nextTarget(); this._feedback('超时！换字', '#c03333'); }
        if (this.timeLeft <= 0) { this.timeLeft = 0; this._end(); }
      }
      this.ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
      if (this.bg) this.ctx.drawImage(this.bg, 0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
      // 目标字大图
      if (this.target && this.state === 'running') {
        const gw = 150, gh = 150;
        const gx = this.canvas.clientWidth / 2 - gw / 2, gy = 74;
        this.ctx.save();
        this.ctx.globalAlpha = 0.22;
        R.drawGuideAnimated(this.ctx, this.target.ch, gx, gy, gw, gh, (ts / 1000 % 1.6) / 1.6);
        this.ctx.restore();
        this.ctx.fillStyle = '#2a2018';
        this.ctx.font = 'bold 15px KaiTi, serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.target.pinyin, this.canvas.clientWidth / 2, gy + gh + 18);
      }
      this.brush.update(dt);
      this.fx.update(dt);
      this.fx.render();
      this.brush.render();
      this._hud();
      requestAnimationFrame(this.loop.bind(this));
    }

    _end() {
      if (this.state !== 'running') return;
      this.state = 'ended';
      if (this.audio) this.audio.stopMelody();
      this.onEnd({ score: this.score, correct: this.correct, wrong: this.wrong, maxCombo: this.maxCombo });
    }

    destroy() {
      this._destroyed = true;
      if (this.input) this.input.destroy();
      if (this.audio) this.audio.stopMelody();
    }
  }

  g.INK_TIMEATTACK = { TimeAttack };
})(typeof globalThis !== 'undefined' ? globalThis : this);
