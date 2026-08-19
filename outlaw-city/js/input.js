"use strict";
const Input = {
  keys: {}, pressed: {}, mouse: { x: 0, y: 0, down: false }, wheel: 0,
  locked: false, dx: 0, dy: 0, suppressShot: false, onLockChange: null, canvas: null,
  init(canvas) {
    this.canvas = canvas;
    window.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].indexOf(e.code) >= 0) e.preventDefault();
      if (!e.repeat) { this.keys[e.code] = true; this.pressed[e.code] = true; }
    });
    window.addEventListener("keyup", (e) => { this.keys[e.code] = false; });
    window.addEventListener("blur", () => { this.keys = {}; this.mouse.down = false; this.releaseLock(); });
    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
      if (this.locked) {
        this.dx += (e.movementX || 0);
        this.dy += (e.movementY || 0);
      }
    });
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        if (!this.locked) {
          this.requestLock();
          this.suppressShot = true;
        }
      }
    });
    window.addEventListener("mouseup", (e) => { if (e.button === 0) this.mouse.down = false; });
    canvas.addEventListener("wheel", (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("pointerlockchange", () => {
      this.locked = !!(document.pointerLockElement || document.webkitPointerLockElement);
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  },
  requestLock() {
    const el = this.canvas;
    if (el && el.requestPointerLock) {
      try { const p = el.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    } else if (el && el.webkitRequestPointerLock) {
      try { el.webkitRequestPointerLock(); } catch (e) {}
    }
  },
  releaseLock() {
    if (document.exitPointerLock) { try { document.exitPointerLock(); } catch (e) {} }
  },
  consume(code) { const p = !!this.pressed[code]; delete this.pressed[code]; return p; },
  clearPressed() { this.pressed = {}; this.wheel = 0; },
};
