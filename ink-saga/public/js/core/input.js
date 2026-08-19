// 墨战 · 天书纪 — 书写输入采集（Pointer Events；构造时自动清理旧监听，支持重复创建）
(function (g) {
  'use strict';

  class InkInput {
    constructor(canvas) {
      this.canvas = canvas;
      this.points = [];
      this.drawing = false;
      this.onStrokeStart = null;
      this.onStrokeMove = null;
      this.onStrokeEnd = null;
      this._handlers = null;
      this._bind();
    }

    _bind() {
      const c = this.canvas;
      // 去重：如果该 canvas 已绑定过，先移除
      if (c.__inkHandlers) {
        for (const [ev, fn] of c.__inkHandlers) c.removeEventListener(ev, fn);
        c.__inkHandlers = null;
      }
      const rect = () => c.getBoundingClientRect();

      const down = (e) => {
        e.preventDefault();
        const r = rect();
        this.drawing = true;
        this.points = [{ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }];
        if (this.onStrokeStart) this.onStrokeStart();
        if (this.onStrokeMove) this.onStrokeMove(this.points);
      };
      const move = (e) => {
        if (!this.drawing) return;
        e.preventDefault();
        const r = rect();
        const p = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
        const last = this.points[this.points.length - 1];
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return;
        this.points.push(p);
        if (this.points.length > 600) this.points.shift();
        if (this.onStrokeMove) this.onStrokeMove(this.points);
      };
      const up = () => {
        if (!this.drawing) return;
        this.drawing = false;
        const pts = this.points;
        this.points = [];
        if (pts.length >= 3 && this.onStrokeEnd) this.onStrokeEnd(pts);
      };
      const touchDown = (e) => { e.preventDefault(); const t = e.touches[0]; down({ preventDefault: () => {}, clientX: t.clientX, clientY: t.clientY }); };
      const touchMove = (e) => { e.preventDefault(); const t = e.touches[0]; move({ preventDefault: () => {}, clientX: t.clientX, clientY: t.clientY }); };

      const handlers = [
        ['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointerleave', up],
        ['touchstart', touchDown], ['touchmove', touchMove], ['touchend', up]
      ];
      for (const [ev, fn] of handlers) c.addEventListener(ev, fn);
      c.__inkHandlers = handlers;
      this._handlers = handlers;
    }

    destroy() {
      if (this._handlers) {
        for (const [ev, fn] of this._handlers) this.canvas.removeEventListener(ev, fn);
        this.canvas.__inkHandlers = null;
        this._handlers = null;
      }
    }

    static smooth(points) {
      if (points.length < 3) return points.slice();
      const out = [points[0]];
      for (let i = 1; i < points.length - 1; i++) {
        out.push({
          x: (points[i - 1].x + points[i].x * 2 + points[i + 1].x) / 4,
          y: (points[i - 1].y + points[i].y * 2 + points[i + 1].y) / 4,
          t: points[i].t
        });
      }
      out.push(points[points.length - 1]);
      return out;
    }
  }

  g.INK_INPUT = { InkInput };
})(typeof globalThis !== 'undefined' ? globalThis : this);
