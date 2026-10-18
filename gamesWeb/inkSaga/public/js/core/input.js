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
      // 去重：如果该 canvas 已绑定过，先移除旧监听
      if (c.__inkHandlers) {
        for (const h of c.__inkHandlers) {
          h.target.removeEventListener(h.ev, h.fn);
        }
        c.__inkHandlers = null;
      }
      const rect = () => c.getBoundingClientRect();

      const pos = (clientX, clientY) => {
        const r = rect();
        return { x: clientX - r.left, y: clientY - r.top, t: performance.now() };
      };
      const down = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;  // 只响应左键
        if (this.drawing) return;                                  // 忽略第二根手指/第二次按下
        if (e.preventDefault) e.preventDefault();
        this.drawing = true;
        this.points = [pos(e.clientX, e.clientY)];
        if (c.setPointerCapture && e.pointerId != null) {
          try { c.setPointerCapture(e.pointerId); } catch (err) {}
        }
        if (this.onStrokeStart) this.onStrokeStart();
        if (this.onStrokeMove) this.onStrokeMove(this.points);
      };
      const move = (e) => {
        if (!this.drawing) return;
        if (e.preventDefault) e.preventDefault();
        const p = pos(e.clientX, e.clientY);
        const last = this.points[this.points.length - 1];
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return;
        this.points.push(p);
        // 长笔画只保留最近的 900 个采样点，避免识别阶段做无意义的 O(n) 扫描
        if (this.points.length > 900) this.points.shift();
        if (this.onStrokeMove) this.onStrokeMove(this.points);
      };
      const up = (e) => {
        if (!this.drawing) return;
        this.drawing = false;
        if (e && c.releasePointerCapture && e.pointerId != null) {
          try { c.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        const pts = this.points;
        this.points = [];
        if (pts.length >= 3 && this.onStrokeEnd) this.onStrokeEnd(pts);
      };

      const handlers = [];
      const bind = (target, ev, fn) => { target.addEventListener(ev, fn); handlers.push({ target, ev, fn }); };
      bind(c, 'pointerdown', down);
      bind(c, 'pointermove', move);
      bind(c, 'pointerup', up);
      bind(c, 'pointercancel', up);
      // 指针在画布外松开时也能结束笔画（没有 PointerEvent 的旧环境用 touch 事件兜底）
      if (typeof window !== 'undefined' && window.addEventListener) bind(window, 'pointerup', up);
      if (typeof PointerEvent === 'undefined') {
        const touchDown = (e) => { const t = e.touches[0]; if (t) down({ pointerType: 'touch', clientX: t.clientX, clientY: t.clientY, preventDefault: () => e.preventDefault() }); };
        const touchMove = (e) => { const t = e.touches[0]; if (t) move({ clientX: t.clientX, clientY: t.clientY, preventDefault: () => e.preventDefault() }); };
        bind(c, 'touchstart', touchDown);
        bind(c, 'touchmove', touchMove);
        bind(c, 'touchend', up);
        bind(c, 'touchcancel', up);
      }
      c.__inkHandlers = handlers;
      this._handlers = handlers;
    }

    destroy() {
      if (this._handlers) {
        for (const h of this._handlers) h.target.removeEventListener(h.ev, h.fn);
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
