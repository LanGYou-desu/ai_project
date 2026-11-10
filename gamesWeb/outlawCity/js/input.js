"use strict";
/* 输入层：只负责把浏览器事件整理成“本帧动作 + 鼠标相对位移”。
 * 游戏逻辑不直接读事件，也不再根据光标绝对位置每帧转向。
 */
const Input = {
  keys: {},
  pressed: {},
  mouse: { x: 0, y: 0, down: false, right: false, pressed: false },
  wheel: 0,
  locked: false,
  dx: 0,
  dy: 0,
  suppressShot: false, // 捕获鼠标的那一次按压整段禁射，直到下一次真实按下
  onLockChange: null,
  canvas: null,
  lastCX: null,
  lastCY: null,
  reacquireBlock: true,
  _windowBound: false,
  _canvasBound: null,

  init(canvas) {
    this.canvas = canvas;
    if (!this._windowBound) {
      this._windowBound = true;
      this.bindWindow();
    }
    if (this._canvasBound !== canvas) {
      this._canvasBound = canvas;
      this.bindCanvas(canvas);
    }
    this.centerMouse();
  },

  bindWindow() {
    window.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].indexOf(e.code) >= 0) {
        if (e.preventDefault) e.preventDefault();
      }
      if (!e.repeat) {
        this.keys[e.code] = true;
        this.pressed[e.code] = true;
      }
    });
    window.addEventListener("keyup", (e) => { this.keys[e.code] = false; });
    window.addEventListener("mouseup", (e) => this.onWindowMouseUp(e));
    window.addEventListener("blur", () => this.onBlur());
    document.addEventListener("pointerlockchange", () => this.syncLockState());
    document.addEventListener("webkitpointerlockchange", () => this.syncLockState());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.onBlur();
    });
  },

  bindCanvas(canvas) {
    canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    canvas.addEventListener("mouseleave", () => {
      this.lastCX = null;
      this.lastCY = null;
    });
    // 个别浏览器只允许在完整 click 手势里进入 Pointer Lock；
    // mousedown 请求失败时，click 再补一次。
    canvas.addEventListener("click", () => {
      if (!this.locked) this.requestLock();
    });
    canvas.addEventListener("wheel", (e) => {
      this.wheel += Math.sign(e.deltaY || 0);
      if (e.preventDefault) e.preventDefault();
    }, { passive: false });
    canvas.addEventListener("contextmenu", (e) => {
      if (e.preventDefault) e.preventDefault();
    });
  },

  onMouseMove(e) {
    const canvas = this.canvas;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
    // 窗口最小化/画布隐藏时宽高为 0，不能做除法，否则会得到 Infinity。
    if (r && r.width > 0 && r.height > 0) {
      const lw = (typeof W !== "undefined" && W.viewW) ? W.viewW : (canvas.width || 1280);
      const lh = (typeof W !== "undefined" && W.viewH) ? W.viewH : (canvas.height || 720);
      this.mouse.x = (e.clientX - r.left) * (lw / r.width);
      this.mouse.y = (e.clientY - r.top) * (lh / r.height);
    }
    if (this.locked) {
      // Pointer Lock 下浏览器直接给相对位移，和光标绝对位置无关。
      this.dx += e.movementX || 0;
      this.dy += e.movementY || 0;
    } else if (this.lastCX != null) {
      // 未锁定时用两次 mousemove 的位置差转向；光标停住，镜头就停住。
      // 限制单次跳变量，鼠标从窗口外移入时不会让镜头猛甩。
      const mx = e.clientX - this.lastCX;
      const my = e.clientY - this.lastCY;
      if (Math.abs(mx) <= 180 && Math.abs(my) <= 180) {
        this.dx += mx;
        this.dy += my;
      }
    }
    this.lastCX = e.clientX;
    this.lastCY = e.clientY;
  },

  onMouseDown(e) {
    if (e.button === 0) {
      this.mouse.down = true;
      this.mouse.pressed = true;
      if (!this.locked) {
        // 重新锁定鼠标的第一次点击只负责捕获指针。这个标记必须
        // 一直留到更新帧消费它，快速“按下即松开”也不能走火。
        const capture = this.reacquireBlock;
        this.reacquireBlock = false;
        this.suppressShot = capture;
        this.requestLock();
      } else {
        // 已经锁定时的左键是真实射击；顺手清理恢复游戏时遗留的抑制标记。
        this.suppressShot = false;
      }
    } else if (e.button === 2) {
      this.mouse.right = true;
      if (!this.locked) this.requestLock();
    }
  },

  onWindowMouseUp(e) {
    if (e.button === 0) {
      this.mouse.down = false;
      // 不在这里清 suppressShot：捕获点击可能在下一帧前就松开，
      // 清理时机交给更新帧的 consumeMouse()/playerShoot()。
    } else if (e.button === 2) {
      this.mouse.right = false;
    }
  },

  onBlur() {
    this.keys = {};
    this.mouse.down = false;
    this.mouse.right = false;
    this.mouse.pressed = false;
    this.dx = 0;
    this.dy = 0;
    this.lastCX = null;
    this.lastCY = null;
    this.locked = false;
    this.suppressShot = false;
    this.reacquireBlock = true;
    this.releaseLock();
    if (this.onLockChange) this.onLockChange(false);
  },

  syncLockState() {
    const el = document.pointerLockElement || document.webkitPointerLockElement || null;
    const next = !!el;
    if (next === this.locked) return;
    this.locked = next;
    if (next) {
      // 锁定成功时丢弃捕获瞬间的残留位移。
      this.dx = 0;
      this.dy = 0;
      this.lastCX = null;
      this.lastCY = null;
      this.reacquireBlock = false;
      // 捕获点击的 suppressShot 不在这里清除：mousedown 和更新帧之间
      // 可能已经发生 mouseup，必须让下一次 update 继续吞掉这一发。
    } else {
      this.centerMouse();
      this.mouse.down = false;
      this.mouse.right = false;
      this.mouse.pressed = false;
      this.reacquireBlock = true;
      this.suppressShot = false;
    }
    if (this.onLockChange) this.onLockChange(next);
  },

  centerMouse() {
    const w = (typeof W !== "undefined" && W.viewW) ? W.viewW : 1280;
    const h = (typeof W !== "undefined" && W.viewH) ? W.viewH : 720;
    this.mouse.x = w / 2;
    this.mouse.y = h / 2;
    this.dx = 0;
    this.dy = 0;
    this.lastCX = null;
    this.lastCY = null;
  },

  requestLock() {
    if (this.locked) return;
    const el = this.canvas;
    if (!el) return;
    if (el.requestPointerLock) {
      try {
        const p = el.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* 浏览器拒绝时保留相对位移回退 */ }
    } else if (el.webkitRequestPointerLock) {
      try { el.webkitRequestPointerLock(); } catch (e) {}
    }
  },

  releaseLock() {
    if (document.exitPointerLock) {
      try { document.exitPointerLock(); } catch (e) {}
    }
  },

  takeLook() {
    const x = this.dx;
    const y = this.dy;
    this.dx = 0;
    this.dy = 0;
    return { x: x, y: y };
  },

  consumeMouse() {
    const p = !!this.mouse.pressed;
    this.mouse.pressed = false;
    return p;
  },

  reset() {
    this.keys = {};
    this.pressed = {};
    this.wheel = 0;
    this.mouse.down = false;
    this.mouse.right = false;
    this.mouse.pressed = false;
    this.dx = 0;
    this.dy = 0;
    this.lastCX = null;
    this.lastCY = null;
    this.suppressShot = false;
  },

  consume(code) {
    const p = !!this.pressed[code];
    delete this.pressed[code];
    return p;
  },

  clearPressed() {
    this.pressed = {};
    this.wheel = 0;
    this.mouse.pressed = false;
  },
};
