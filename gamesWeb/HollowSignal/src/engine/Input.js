export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.enabled = false;
    this.locked = false;
    this.onLockChange = null;
    this.onLockError = null;
    this._requestPending = false;

    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      if (this._shouldIgnoreEvent(e)) return;
      if (this._isGameKey(e.code)) e.preventDefault();
      if (!e.repeat) this.justPressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this._onMouseMove = (e) => {
      if (!this.enabled || !this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    };
    this._onBlur = () => this.releaseAll();
    this._onPointerLockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
      this._requestPending = false;
      if (!this.locked) this.releaseAll();
      if (this.onLockChange) this.onLockChange(this.locked);
    };
    this._onPointerLockError = () => {
      this._requestPending = false;
      if (this.onLockError) this.onLockError();
    };

    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('pointerlockerror', this._onPointerLockError);
  }

  _isGameKey(code) {
    return ['KeyW','KeyA','KeyS','KeyD','KeyE','KeyF','KeyC','KeyJ','ShiftLeft','ShiftRight','Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab'].includes(code);
  }

  _shouldIgnoreEvent(e) {
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return true;
    return false;
  }

  releaseAll() {
    this.keys.clear();
    this.justPressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  isDown(code) {
    return this.enabled && this.keys.has(code);
  }

  wasPressed(code) {
    return this.enabled && this.justPressed.has(code);
  }

  consumeMouse() {
    const m = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return m;
  }

  endFrame() {
    this.justPressed.clear();
  }

  requestPointerLock() {
    if (this.locked || this._requestPending) return;
    this._requestPending = true;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Some browsers/platforms do not support raw mouse input. Retry normally.
          try {
            const retry = this.canvas.requestPointerLock();
            if (retry && typeof retry.catch === 'function') {
              retry.catch(() => {
                this._requestPending = false;
                if (this.onLockError) this.onLockError();
              });
            }
          } catch {
            this._requestPending = false;
            if (this.onLockError) this.onLockError();
          }
        });
      }
    } catch {
      try {
        const retry = this.canvas.requestPointerLock();
        if (retry && typeof retry.catch === 'function') {
          retry.catch(() => {
            this._requestPending = false;
            if (this.onLockError) this.onLockError();
          });
        }
      } catch {
        this._requestPending = false;
        if (this.onLockError) this.onLockError();
      }
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
