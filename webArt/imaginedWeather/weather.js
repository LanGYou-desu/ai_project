/* =========================================================
   臆候局 / observation window + generative soundscape
   ========================================================= */

(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const rgbCache = new Map();

  function hexToRgb(hex) {
    if (rgbCache.has(hex)) return rgbCache.get(hex);
    const value = String(hex).replace("#", "");
    const normalized = value.length === 3
      ? value.split("").map((letter) => letter + letter).join("")
      : value;
    const result = {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16)
    };
    rgbCache.set(hex, result);
    return result;
  }

  function rgba(hex, alpha) {
    const color = hexToRgb(hex);
    return "rgba(" + color.r + ", " + color.g + ", " + color.b + ", " + alpha + ")";
  }

  function channels(hex) {
    const color = hexToRgb(hex);
    return color.r + ", " + color.g + ", " + color.b;
  }

  function rand(rng, min, max) {
    return min + rng() * (max - min);
  }

  function mulberry32(seed) {
    let state = seed >>> 0;
    return function random() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class WeatherWindow {
    constructor(canvas, onPulse) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.onPulse = onPulse;
      this.w = 0;
      this.h = 0;
      this.dpr = 1;
      this.spec = null;
      this.time = 0;
      this.lastTime = 0;
      this.raf = 0;
      this.paused = false;
      this.pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
      this.motion = reducedMotion ? 0.32 : 1;
      this.clouds = [];
      this.stars = [];
      this.particles = [];
      this.veils = [];
      this.ripples = [];
      this.pulses = [];
      this.bolt = null;
      this.flash = 0;
      this.nextFlash = 2;
      this.rippleTimer = 0;
      this.orb = { x: 0.6, y: 0.34, r: 0.14 };
      this.orbSpots = [];
      this.sprites = [];
      this.glowSprite = null;
      this.noisePattern = null;
      this.rng = mulberry32(1);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas.parentElement);
      this.bindEvents();
      this.resize();
    }

    bindEvents() {
      this._pointerMove = (event) => {
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        this.pointer.tx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        this.pointer.ty = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      };
      this._pointerLeave = () => {
        this.pointer.tx = 0.5;
        this.pointer.ty = 0.5;
      };
      this._pointerDown = (event) => {
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
        this.addPulse(x, y);
        if (this.spec && this.spec.familyKey === "storm") this.triggerLightning();
        if (this.spec && this.spec.familyKey === "rain") this.addRipple(x, Math.max(y, 0.82));
        if (typeof this.onPulse === "function") this.onPulse(this.spec);
      };
      this.canvas.addEventListener("pointermove", this._pointerMove, { passive: true });
      this.canvas.addEventListener("pointerleave", this._pointerLeave, { passive: true });
      this.canvas.addEventListener("pointerdown", this._pointerDown);
      this.canvas.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.addPulse(0.5, 0.45);
          if (typeof this.onPulse === "function") this.onPulse(this.spec);
        }
      });
    }

    resize() {
      const parent = this.canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (w === this.w && h === this.h && dpr === this.dpr) return;
      this.w = w;
      this.h = h;
      this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.spec) {
        this.buildSprites();
        this.drawFrame(0.016);
      }
    }

    setSpecimen(spec) {
      if (!spec) return;
      this.spec = spec;
      this.time = 0;
      this.initScene();
      this.buildSprites();
      this.drawFrame(0.016);
      this.start();
    }

    buildSprites() {
      if (!this.spec) return;
      const palette = this.spec.palette;
      this.sprites = [
        this.makeCloudSprite(palette.soft, 0.72, 1),
        this.makeCloudSprite(palette.haze, 0.55, 2),
        this.makeCloudSprite(palette.glow, 0.38, 3)
      ];
      this.glowSprite = this.makeGlowSprite(palette.rim);
      if (!this.noisePattern) this.noisePattern = this.makeNoisePattern();
    }

    makeCloudSprite(color, opacity, variant) {
      const size = 320;
      const sprite = document.createElement("canvas");
      sprite.width = size;
      sprite.height = size;
      const context = sprite.getContext("2d");
      const blobs = [
        [0.5, 0.5, 0.46, 1],
        [0.36, 0.43, 0.29, 0.85],
        [0.65, 0.4, 0.3, 0.75],
        [0.46, 0.65, 0.3, 0.7],
        [0.66, 0.62, 0.24, 0.56],
        [0.28, 0.6, 0.2, 0.5],
        [0.54, 0.3, 0.2, 0.56]
      ];
      context.globalCompositeOperation = "lighter";
      for (let index = 0; index < blobs.length; index += 1) {
        const blob = blobs[(index + variant) % blobs.length];
        const gradient = context.createRadialGradient(
          blob[0] * size, blob[1] * size, 0,
          blob[0] * size, blob[1] * size, blob[2] * size
        );
        gradient.addColorStop(0, rgba(color, opacity * blob[3]));
        gradient.addColorStop(0.38, rgba(color, opacity * blob[3] * 0.5));
        gradient.addColorStop(1, rgba(color, 0));
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
      }
      return sprite;
    }

    makeGlowSprite(color) {
      const size = 64;
      const sprite = document.createElement("canvas");
      sprite.width = size;
      sprite.height = size;
      const context = sprite.getContext("2d");
      const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, rgba(color, 0.9));
      gradient.addColorStop(0.12, rgba(color, 0.6));
      gradient.addColorStop(0.42, rgba(color, 0.14));
      gradient.addColorStop(1, rgba(color, 0));
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
      return sprite;
    }

    makeNoisePattern() {
      const size = 140;
      const noise = document.createElement("canvas");
      noise.width = size;
      noise.height = size;
      const context = noise.getContext("2d");
      const image = context.createImageData(size, size);
      for (let i = 0; i < image.data.length; i += 4) {
        const value = Math.floor(Math.random() * 255);
        image.data[i] = value;
        image.data[i + 1] = value;
        image.data[i + 2] = value;
        image.data[i + 3] = Math.floor(Math.random() * 28);
      }
      context.putImageData(image, 0, 0);
      return this.ctx.createPattern(noise, "repeat");
    }

    initScene() {
      const spec = this.spec;
      const rng = mulberry32(spec.seed ^ 0x9e3779b9);
      this.rng = rng;
      this.time = 0;
      this.flash = 0;
      this.nextFlash = rand(rng, 2.3, 5.6);
      this.rippleTimer = 0;
      this.ripples = [];
      this.pulses = [];
      this.bolt = null;

      this.staticArc = null;
      if (spec.familyKey === "storm") {
        const arc = [];
        let arcX = rand(rng, 0.25, 0.55);
        let arcY = -0.03;
        arc.push([arcX, arcY]);
        for (let i = 0; i < 9; i += 1) {
          arcX += rand(rng, -0.045, 0.065);
          arcY += rand(rng, 0.045, 0.075);
          arc.push([arcX, arcY]);
        }
        this.staticArc = arc;
      }

      this.orb = {
        x: rand(rng, 0.51, 0.69),
        y: rand(rng, 0.29, 0.38),
        r: rand(rng, 0.1, 0.135)
      };

      this.orbSpots = Array.from({ length: 9 }, () => ({
        x: rand(rng, -0.7, 0.7),
        y: rand(rng, -0.7, 0.7),
        r: rand(rng, 0.08, 0.34),
        a: rand(rng, 0.025, 0.11)
      }));

      this.stars = Array.from({ length: spec.familyKey === "fog" ? 18 : 58 }, () => ({
        x: rng(),
        y: rng() * 0.72,
        r: rand(rng, 0.3, 1.65),
        alpha: rand(rng, 0.18, 0.82),
        twinkle: rand(rng, 0.4, 2.2),
        phase: rng() * TAU
      }));

      const cloudCount = spec.familyKey === "fog" ? 30 : 22;
      this.clouds = Array.from({ length: cloudCount }, (_, index) => {
        const layer = index % 3;
        return {
          x: rand(rng, 0.14, 0.88),
          y: rand(rng, 0.16, 0.78),
          size: rand(rng, 0.22, 0.58),
          alpha: rand(rng, 0.075, 0.2) * (layer === 0 ? 1.15 : 0.82),
          drift: rand(rng, 0.008, 0.028),
          driftY: rand(rng, 0.002, 0.012),
          phase: rng() * TAU,
          speed: rand(rng, 0.035, 0.11),
          depth: rand(rng, 0.3, 1),
          layer: layer,
          sprite: rng() > 0.55 ? 1 : 0,
          rotation: rand(rng, -0.8, 0.8)
        };
      });

      this.veils = Array.from({ length: spec.familyKey === "fog" ? 7 : 3 }, () => ({
        x: rand(rng, 0.25, 0.75),
        y: rand(rng, 0.28, 0.75),
        size: rand(rng, 0.55, 1.1),
        alpha: rand(rng, 0.025, 0.075),
        phase: rng() * TAU,
        speed: rand(rng, 0.02, 0.06)
      }));

      this.wisps = Array.from({ length: spec.familyKey === "fog" ? 8 : 5 }, () => ({
        x: rand(rng, 0.02, 0.42),
        y: rand(rng, 0.25, 0.76),
        length: rand(rng, 0.35, 0.74),
        amp: rand(rng, 0.025, 0.085),
        width: rand(rng, 3, 14),
        alpha: rand(rng, 0.025, 0.09),
        speed: rand(rng, 0.012, 0.045),
        phase: rng() * TAU,
        slant: rand(rng, -0.04, 0.04)
      }));

      this.mistBanks = Array.from({ length: spec.familyKey === "fog" ? 7 : 3 }, () => ({
        x: rand(rng, 0.2, 0.8),
        y: rand(rng, 0.52, 0.76),
        size: rand(rng, 0.45, 0.95),
        alpha: rand(rng, 0.04, 0.12),
        phase: rng() * TAU,
        speed: rand(rng, 0.02, 0.07),
        sprite: rng() > 0.45 ? 1 : 2
      }));

      this.particles = this.createParticles(rng);
    }

    createParticles(rng) {
      const family = this.spec.familyKey;
      const countScale = reducedMotion ? 0.45 : 1;
      const count = (base) => Math.max(8, Math.round(base * countScale));

      if (family === "rain") {
        return {
          type: "rain",
          rain: Array.from({ length: count(110) }, () => ({
            x: rng(),
            y: rng(),
            len: rand(rng, 0.025, 0.12),
            speed: rand(rng, 0.3, 0.76),
            drift: rand(rng, -0.018, 0.018),
            width: rand(rng, 0.45, 1.15),
            alpha: rand(rng, 0.14, 0.58)
          })),
          beads: Array.from({ length: count(18) }, () => ({
            x: rand(rng, 0.08, 0.92),
            y: rand(rng, 0.1, 0.8),
            r: rand(rng, 0.7, 3),
            alpha: rand(rng, 0.1, 0.28)
          }))
        };
      }

      if (family === "snow") {
        return {
          type: "snow",
          flakes: Array.from({ length: count(92) }, () => ({
            x: rng(),
            y: rng(),
            r: rand(rng, 0.55, 3.2),
            speed: rand(rng, 0.018, 0.075),
            drift: rand(rng, 0.002, 0.012),
            phase: rng() * TAU,
            alpha: rand(rng, 0.22, 0.82),
            star: rng() > 0.7
          }))
        };
      }

      if (family === "storm") {
        return {
          type: "storm",
          rain: Array.from({ length: count(86) }, () => ({
            x: rng(),
            y: rng(),
            len: rand(rng, 0.02, 0.085),
            speed: rand(rng, 0.42, 0.95),
            drift: rand(rng, -0.1, -0.03),
            width: rand(rng, 0.35, 0.9),
            alpha: rand(rng, 0.08, 0.38)
          }))
        };
      }

      if (family === "glow") {
        return {
          type: "glow",
          spores: Array.from({ length: count(76) }, () => ({
            x: rng(),
            y: rng(),
            r: rand(rng, 0.5, 2.4),
            phase: rng() * TAU,
            speed: rand(rng, 0.2, 0.9),
            depth: rand(rng, 0.4, 1),
            alpha: rand(rng, 0.18, 0.85)
          })),
          petals: Array.from({ length: count(15) }, () => ({
            x: rng(),
            y: rng(),
            r: rand(rng, 1.2, 4.5),
            phase: rng() * TAU,
            speed: rand(rng, 0.07, 0.28),
            alpha: rand(rng, 0.08, 0.26)
          }))
        };
      }

      if (family === "wind") {
        return {
          type: "wind",
          streams: Array.from({ length: count(33) }, () => ({
            x: rng(),
            y: rng(),
            speed: rand(rng, 0.05, 0.17),
            phase: rng() * TAU,
            width: rand(rng, 0.4, 1.1),
            alpha: rand(rng, 0.12, 0.48),
            trail: []
          })),
          seeds: Array.from({ length: count(16) }, () => ({
            x: rng(),
            y: rand(rng, 0.1, 0.85),
            speed: rand(rng, 0.02, 0.08),
            phase: rng() * TAU,
            size: rand(rng, 2.3, 6.5),
            alpha: rand(rng, 0.18, 0.58)
          }))
        };
      }

      if (family === "ash") {
        return {
          type: "ash",
          embers: Array.from({ length: count(112) }, () => ({
            x: rng(),
            y: rng(),
            speed: rand(rng, 0.018, 0.075),
            drift: rand(rng, -0.012, 0.016),
            phase: rng() * TAU,
            size: rand(rng, 0.6, 3.1),
            alpha: rand(rng, 0.3, 1),
            life: rand(rng, 0, 1)
          })),
          flecks: Array.from({ length: count(42) }, () => ({
            x: rng(),
            y: rng(),
            speed: rand(rng, 0.01, 0.035),
            drift: rand(rng, -0.01, 0.01),
            phase: rng() * TAU,
            alpha: rand(rng, 0.12, 0.42),
            size: rand(rng, 0.4, 1.5)
          }))
        };
      }

      return {
        type: "fog",
        motes: Array.from({ length: count(54) }, () => ({
          x: rng(),
          y: rng(),
          size: rand(rng, 0.3, 1.4),
          speed: rand(rng, 0.008, 0.026),
          phase: rng() * TAU,
          alpha: rand(rng, 0.08, 0.42)
        }))
      };
    }

    addPulse(x, y) {
      this.pulses.push({ x: x, y: y, age: 0, life: 1.8, seed: Math.random() * TAU });
      if (this.pulses.length > 8) this.pulses.shift();
    }

    addRipple(x, y) {
      this.ripples.push({ x: x, y: y, age: 0, life: 1.6, size: 0.02 + Math.random() * 0.035 });
      if (this.ripples.length > 9) this.ripples.shift();
    }

    triggerLightning() {
      const rng = this.rng || Math.random;
      const points = [];
      let x = rand(rng, 0.28, 0.72);
      let y = -0.03;
      points.push([x, y]);
      for (let i = 0; i < 11; i += 1) {
        x += rand(rng, -0.055, 0.07);
        y += rand(rng, 0.065, 0.11);
        points.push([x, y]);
      }
      const branches = [];
      for (let b = 0; b < 2; b += 1) {
        const start = points[3 + Math.floor(rng() * 5)];
        let bx = start[0];
        let by = start[1];
        const branch = [[bx, by]];
        for (let i = 0; i < 4; i += 1) {
          bx += rand(rng, -0.07, 0.07);
          by += rand(rng, 0.04, 0.085);
          branch.push([bx, by]);
        }
        branches.push(branch);
      }
      this.bolt = { points: points, branches: branches, life: 0.34 };
      this.flash = 1;
    }

    update(dt) {
      const speed = this.motion;
      const scaled = dt * speed;
      this.time += scaled;
      this.pointer.x = lerp(this.pointer.x, this.pointer.tx, 0.045);
      this.pointer.y = lerp(this.pointer.y, this.pointer.ty, 0.045);
      this.flash = Math.max(0, this.flash - scaled * 2.8);

      if (this.spec.familyKey === "storm") {
        this.nextFlash -= scaled;
        if (this.nextFlash <= 0) {
          this.triggerLightning();
          this.nextFlash = rand(this.rng, 2.6, 5.8);
        }
        if (this.bolt) {
          this.bolt.life -= scaled;
          if (this.bolt.life <= 0) this.bolt = null;
        }
      }

      if (this.spec.familyKey === "rain") {
        this.rippleTimer -= scaled;
        if (this.rippleTimer <= 0) {
          this.addRipple(rand(this.rng, 0.2, 0.8), rand(this.rng, 0.79, 0.91));
          this.rippleTimer = rand(this.rng, 0.14, 0.48);
        }
      }

      for (const ripple of this.ripples) ripple.age += scaled;
      this.ripples = this.ripples.filter((ripple) => ripple.age < ripple.life);
      for (const pulse of this.pulses) pulse.age += scaled;
      this.pulses = this.pulses.filter((pulse) => pulse.age < pulse.life);
    }

    pause() {
      this.paused = true;
    }

    resume() {
      this.paused = false;
      this.lastTime = performance.now();
    }

    start() {
      if (this.raf) return;
      this.lastTime = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
        this.lastTime = now;
        if (!this.paused && document.visibilityState !== "hidden") {
          this.update(dt);
          this.drawFrame(dt);
        }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }

    drawFrame(dt) {
      if (!this.spec || !this.w || !this.h) return;
      this.frameScale = clamp((dt || 0.016) * 60, 0.25, 2.5);
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      this.drawBackground();
      this.drawStars();
      this.drawRays();
      this.drawOrb();
      this.drawClouds();
      this.drawWisps();
      this.drawFloor();
      this.drawWeather();
      this.drawPulses();
      this.drawLightning();
      this.drawVignette();
      this.drawGrain();
    }

    drawBackground() {
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      const bg = ctx.createLinearGradient(0, 0, w * 0.4, h);
      bg.addColorStop(0, palette.bg);
      bg.addColorStop(0.58, palette.bg);
      bg.addColorStop(1, palette.deep);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const ox = this.orb.x * w;
      const oy = this.orb.y * h;
      const halo = ctx.createRadialGradient(ox, oy, 0, ox, oy, Math.max(w, h) * 0.72);
      halo.addColorStop(0, rgba(palette.glow, this.spec.familyKey === "storm" ? 0.16 : 0.22));
      halo.addColorStop(0.23, rgba(palette.haze, 0.09));
      halo.addColorStop(0.62, rgba(palette.soft, 0.035));
      halo.addColorStop(1, rgba(palette.deep, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      if (this.flash > 0.01) {
        ctx.fillStyle = rgba(palette.rim, this.flash * 0.11);
        ctx.fillRect(0, 0, w, h);
      }
    }

    drawStars() {
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const star of this.stars) {
        const twinkle = 0.64 + Math.sin(this.time * star.twinkle + star.phase) * 0.36;
        const x = star.x * w + (this.pointer.x - 0.5) * 7 * star.r;
        const y = star.y * h + (this.pointer.y - 0.5) * 4 * star.r;
        ctx.fillStyle = rgba(palette.rim, star.alpha * twinkle);
        ctx.beginPath();
        ctx.arc(x, y, star.r, 0, TAU);
        ctx.fill();
        if (star.r > 1.1) {
          ctx.strokeStyle = rgba(palette.rim, star.alpha * twinkle * 0.4);
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(x - star.r * 3, y);
          ctx.lineTo(x + star.r * 3, y);
          ctx.moveTo(x, y - star.r * 3);
          ctx.lineTo(x, y + star.r * 3);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    drawRays() {
      if (!["glow", "wind", "snow"].includes(this.spec.familyKey)) return;
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      const ox = this.orb.x * w;
      const oy = this.orb.y * h;
      const count = this.spec.familyKey === "glow" ? 16 : 8;
      const length = Math.max(w, h) * 0.9;
      const base = this.time * 0.018;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.translate(ox, oy);
      ctx.rotate(base);
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * TAU + Math.sin(i * 3.7) * 0.055;
        const spread = 0.011 + (i % 3) * 0.003;
        const gradient = ctx.createRadialGradient(0, 0, this.orb.r * w * 0.4, 0, 0, length);
        gradient.addColorStop(0, rgba(palette.glow, this.spec.familyKey === "glow" ? 0.16 : 0.07));
        gradient.addColorStop(0.5, rgba(palette.glow, 0.035));
        gradient.addColorStop(1, rgba(palette.glow, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, length, angle - spread, angle + spread);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    drawOrb() {
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      const ox = this.orb.x * w + (this.pointer.x - 0.5) * 14;
      const oy = this.orb.y * h + (this.pointer.y - 0.5) * 9;
      const r = this.orb.r * w;
      const family = this.spec.familyKey;

      const halo = ctx.createRadialGradient(ox, oy, r * 0.25, ox, oy, r * 3.6);
      halo.addColorStop(0, rgba(palette.glow, family === "storm" ? 0.32 : 0.48));
      halo.addColorStop(0.22, rgba(palette.glow, 0.17));
      halo.addColorStop(0.66, rgba(palette.haze, 0.035));
      halo.addColorStop(1, rgba(palette.haze, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, TAU);
      ctx.clip();
      const disc = ctx.createRadialGradient(ox - r * 0.35, oy - r * 0.42, r * 0.06, ox, oy, r);
      disc.addColorStop(0, rgba(palette.rim, 0.98));
      disc.addColorStop(0.5, rgba(palette.orb, family === "storm" ? 0.7 : 0.94));
      disc.addColorStop(1, rgba(palette.glow, family === "storm" ? 0.34 : 0.68));
      ctx.fillStyle = disc;
      ctx.fillRect(ox - r, oy - r, r * 2, r * 2);
      for (const spot of this.orbSpots) {
        const x = ox + spot.x * r;
        const y = oy + spot.y * r;
        const radius = spot.r * r;
        const texture = ctx.createRadialGradient(x, y, 0, x, y, radius);
        texture.addColorStop(0, "rgba(16, 20, 16, " + spot.a + ")");
        texture.addColorStop(1, "rgba(16, 20, 16, 0)");
        ctx.fillStyle = texture;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      ctx.restore();

      ctx.strokeStyle = rgba(palette.rim, 0.32);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, TAU);
      ctx.stroke();

      ctx.save();
      ctx.strokeStyle = rgba(palette.rim, 0.15);
      ctx.lineWidth = 0.6;
      ctx.setLineDash([1.5, 5.5]);
      ctx.beginPath();
      ctx.arc(ox, oy, r * 1.68, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(ox, oy, r * 2.3, 0, TAU);
      ctx.strokeStyle = rgba(palette.rim, 0.075);
      ctx.stroke();
      ctx.fillStyle = rgba(palette.rim, 0.6);
      const moonAngle = -0.64 + Math.sin(this.time * 0.035) * 0.04;
      ctx.beginPath();
      ctx.arc(
        ox + Math.cos(moonAngle) * r * 1.68,
        oy + Math.sin(moonAngle) * r * 1.68,
        1.5, 0, TAU
      );
      ctx.fill();
      ctx.restore();
    }

    drawClouds() {
      const ctx = this.ctx;
      const w = this.w;
      const h = this.h;
      const family = this.spec.familyKey;
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (const veil of this.veils) {
        const x = (veil.x + Math.sin(this.time * veil.speed + veil.phase) * 0.035) * w;
        const y = (veil.y + Math.cos(this.time * veil.speed * 0.7 + veil.phase) * 0.018) * h;
        const size = veil.size * w;
        ctx.globalAlpha = veil.alpha * (family === "fog" ? 1 : 0.6);
        ctx.drawImage(this.sprites[1], x - size / 2, y - size / 2, size, size);
      }

      for (const bank of this.mistBanks) {
        const x = (bank.x + Math.sin(this.time * bank.speed + bank.phase) * 0.035) * w;
        const y = (bank.y + Math.cos(this.time * bank.speed * 0.65 + bank.phase) * 0.02) * h;
        const size = bank.size * w;
        ctx.globalAlpha = bank.alpha * (family === "fog" ? 1.2 : 0.65);
        ctx.drawImage(this.sprites[bank.sprite], x - size / 2, y - size / 2, size, size);
      }

      for (const cloud of this.clouds) {
        const driftX = Math.sin(this.time * cloud.speed + cloud.phase) * cloud.drift * w;
        const driftY = Math.cos(this.time * cloud.speed * 0.78 + cloud.phase) * cloud.driftY * h;
        const x = cloud.x * w + driftX + (this.pointer.x - 0.5) * 24 * cloud.depth;
        const y = cloud.y * h + driftY + (this.pointer.y - 0.5) * 11 * cloud.depth;
        const size = cloud.size * w;
        ctx.globalAlpha = cloud.alpha * (family === "fog" ? 1.6 : 1.08);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(cloud.rotation + Math.sin(this.time * 0.03 + cloud.phase) * 0.08);
        ctx.drawImage(this.sprites[cloud.sprite], -size / 2, -size / 2, size, size);
        ctx.restore();
      }
      ctx.restore();
    }

    drawWisps() {
      if (!this.wisps.length) return;
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      const family = this.spec.familyKey;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";
      for (const wisp of this.wisps) {
        const t = this.time * wisp.speed + wisp.phase;
        const x0 = (wisp.x + Math.sin(t) * 0.03) * w;
        const y0 = (wisp.y + Math.cos(t * 0.7) * 0.018) * h;
        const x1 = x0 + wisp.length * w;
        const lift = wisp.amp * h;
        const draw = () => {
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.bezierCurveTo(
            x0 + wisp.length * w * 0.3,
            y0 - lift + wisp.slant * h,
            x0 + wisp.length * w * 0.67,
            y0 + lift * 0.72,
            x1,
            y0 + wisp.slant * h
          );
        };
        ctx.strokeStyle = rgba(palette.haze, wisp.alpha * (family === "fog" ? 1 : 0.62));
        ctx.lineWidth = wisp.width;
        draw();
        ctx.stroke();
        ctx.strokeStyle = rgba(palette.rim, wisp.alpha * 0.42);
        ctx.lineWidth = 0.7;
        draw();
        ctx.stroke();
      }
      ctx.restore();
    }

    drawFloor() {
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      const floorY = h * 0.82;

      const shade = ctx.createLinearGradient(0, h * 0.62, 0, h);
      shade.addColorStop(0, "rgba(0,0,0,0)");
      shade.addColorStop(0.52, rgba(palette.deep, 0.22));
      shade.addColorStop(1, rgba(palette.deep, 0.86));
      ctx.fillStyle = shade;
      ctx.fillRect(0, h * 0.62, w, h * 0.38);

      ctx.save();
      ctx.translate(this.orb.x * w, floorY + h * 0.025);
      ctx.scale(1, 0.24);
      const reflection = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.2);
      reflection.addColorStop(0, rgba(palette.glow, 0.13));
      reflection.addColorStop(0.5, rgba(palette.glow, 0.045));
      reflection.addColorStop(1, rgba(palette.glow, 0));
      ctx.fillStyle = reflection;
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.2, 0, TAU);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = rgba(palette.rim, 0.23);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, floorY, w * 0.275, h * 0.028, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba(palette.rim, 0.1);
      ctx.setLineDash([2, 7]);
      ctx.beginPath();
      ctx.ellipse(w * 0.5, floorY, w * 0.36, h * 0.042, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * TAU;
        const x = w * 0.5 + Math.cos(angle) * w * 0.275;
        const y = floorY + Math.sin(angle) * h * 0.028;
        const outer = i % 3 === 0 ? 6 : 3.7;
        ctx.strokeStyle = rgba(palette.rim, i % 3 === 0 ? 0.23 : 0.12);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawWeather() {
      const family = this.spec.familyKey;
      if (family === "rain") this.drawRain();
      else if (family === "snow") this.drawSnow();
      else if (family === "storm") this.drawStorm();
      else if (family === "glow") this.drawGlow();
      else if (family === "wind") this.drawWind();
      else if (family === "ash") this.drawAsh();
      else this.drawFog();
    }

    drawRain() {
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      const data = this.particles;
      const wind = (this.pointer.x - 0.5) * 0.05;
      const scale = this.frameScale;
      const motion = reducedMotion ? 0.4 : 1;
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (const bead of data.beads) {
        const x = bead.x * w;
        const y = bead.y * h;
        ctx.fillStyle = rgba(palette.rim, bead.alpha * 0.4);
        ctx.beginPath();
        ctx.arc(x, y, bead.r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rgba(palette.rim, bead.alpha * 0.65);
        ctx.beginPath();
        ctx.arc(x - bead.r * 0.28, y - bead.r * 0.3, Math.max(0.4, bead.r * 0.22), 0, TAU);
        ctx.fill();
      }

      for (const drop of data.rain) {
        drop.y += drop.speed * 0.016 * scale * motion;
        drop.x += (drop.drift + wind) * 0.016 * scale * motion;
        if (drop.y > 1.04) {
          drop.y = -0.03;
          drop.x = this.rng();
        }
        if (drop.x < -0.05) drop.x = 1.03;
        if (drop.x > 1.04) drop.x = -0.02;
        const x = drop.x * w;
        const y = drop.y * h;
        ctx.strokeStyle = rgba(palette.rim, drop.alpha);
        ctx.lineWidth = drop.width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + drop.drift * w * 1.5, y - drop.len * h);
        ctx.stroke();
      }

      for (const ripple of this.ripples) {
        const t = ripple.age / ripple.life;
        ctx.strokeStyle = rgba(palette.rim, (1 - t) * 0.32);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.ellipse(ripple.x * w, ripple.y * h, ripple.size * w * (0.4 + t * 1.9), ripple.size * h * (0.08 + t * 0.42), 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawSnow() {
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      const data = this.particles;
      const scale = this.frameScale;
      const motion = reducedMotion ? 0.35 : 1;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const flake of data.flakes) {
        flake.y += flake.speed * 0.016 * scale * motion;
        flake.x += Math.sin(this.time * 0.3 + flake.phase) * flake.drift * 0.3 * scale;
        if (flake.y > 1.02) {
          flake.y = -0.02;
          flake.x = this.rng();
        }
        const x = flake.x * w;
        const y = flake.y * h;
        const twinkle = 0.72 + Math.sin(this.time * 0.9 + flake.phase) * 0.28;
        ctx.fillStyle = rgba(palette.rim, flake.alpha * twinkle);
        ctx.beginPath();
        ctx.arc(x, y, flake.r, 0, TAU);
        ctx.fill();
        if (flake.star && flake.r > 1.4) {
          ctx.strokeStyle = rgba(palette.rim, flake.alpha * twinkle * 0.36);
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          for (let arm = 0; arm < 3; arm += 1) {
            const angle = (arm / 3) * Math.PI + this.time * 0.04;
            const dx = Math.cos(angle) * flake.r * 3;
            const dy = Math.sin(angle) * flake.r * 3;
            ctx.moveTo(x - dx, y - dy);
            ctx.lineTo(x + dx, y + dy);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    drawStorm() {
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      const data = this.particles;
      const scale = this.frameScale;
      const motion = reducedMotion ? 0.35 : 1;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const drop of data.rain) {
        drop.y += drop.speed * 0.016 * scale * motion;
        drop.x += drop.drift * 0.016 * scale * motion;
        if (drop.y > 1.05) {
          drop.y = -0.04;
          drop.x = this.rng();
        }
        const x = drop.x * w;
        const y = drop.y * h;
        ctx.strokeStyle = rgba(palette.rim, drop.alpha * (0.55 + this.flash * 0.6));
        ctx.lineWidth = drop.width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + drop.len * w * 0.34, y - drop.len * h);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawGlow() {
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      const data = this.particles;
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (const spore of data.spores) {
        const x = (spore.x + Math.sin(this.time * spore.speed + spore.phase) * 0.022) * w + (this.pointer.x - 0.5) * 10 * spore.depth;
        const y = (spore.y + Math.cos(this.time * spore.speed * 0.8 + spore.phase) * 0.012) * h;
        const radius = spore.r * (1.8 + Math.sin(this.time * 1.3 + spore.phase) * 0.35);
        ctx.globalAlpha = spore.alpha * 0.6;
        ctx.drawImage(this.glowSprite, x - radius * 3.2, y - radius * 3.2, radius * 6.4, radius * 6.4);
        ctx.globalAlpha = 1;
        ctx.fillStyle = rgba(palette.rim, spore.alpha);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, spore.r * 0.48), 0, TAU);
        ctx.fill();
      }

      for (const petal of data.petals) {
        const x = (petal.x + Math.sin(this.time * petal.speed + petal.phase) * 0.04) * w;
        const y = (petal.y + Math.cos(this.time * petal.speed * 0.6 + petal.phase) * 0.025) * h;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.time * petal.speed * 0.4 + petal.phase);
        ctx.fillStyle = rgba(palette.haze, petal.alpha);
        ctx.beginPath();
        ctx.ellipse(0, 0, petal.r * 1.8, petal.r * 0.55, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    drawWind() {
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      const data = this.particles;
      const pointerAngle = (this.pointer.x - 0.5) * 0.7;
      const scale = this.frameScale;
      const motion = reducedMotion ? 0.3 : 1;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const stream of data.streams) {
        const angle =
          pointerAngle +
          Math.sin(stream.y * 5.2 + this.time * 0.37 + stream.phase) * 0.44 +
          Math.cos(stream.x * 4.1 - this.time * 0.22) * 0.38;
        stream.x += Math.cos(angle) * stream.speed * 0.016 * scale * motion;
        stream.y += Math.sin(angle) * stream.speed * 0.012 * scale * motion;
        if (stream.x > 1.05) { stream.x = -0.05; stream.trail = []; }
        if (stream.x < -0.06) { stream.x = 1.05; stream.trail = []; }
        if (stream.y > 0.94) stream.y = 0.08;
        if (stream.y < 0.06) stream.y = 0.92;
        stream.trail.unshift([stream.x, stream.y]);
        if (stream.trail.length > 12) stream.trail.pop();
        if (stream.trail.length < 2) continue;
        ctx.strokeStyle = rgba(palette.rim, stream.alpha);
        ctx.lineWidth = stream.width;
        ctx.beginPath();
        ctx.moveTo(stream.trail[0][0] * w, stream.trail[0][1] * h);
        for (let i = 1; i < stream.trail.length; i += 1) {
          const point = stream.trail[i];
          ctx.lineTo(point[0] * w, point[1] * h);
        }
        ctx.stroke();
        const head = stream.trail[0];
        ctx.fillStyle = rgba(palette.rim, stream.alpha * 0.8);
        ctx.beginPath();
        ctx.arc(head[0] * w, head[1] * h, 0.75, 0, TAU);
        ctx.fill();
      }

      for (const seed of data.seeds) {
        seed.x += seed.speed * 0.016 * scale * motion;
        seed.y += Math.sin(this.time * 0.3 + seed.phase) * 0.0007 * scale;
        if (seed.x > 1.04) seed.x = -0.04;
        const x = seed.x * w;
        const y = seed.y * h;
        const angle = this.time * 0.22 + seed.phase;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.strokeStyle = rgba(palette.rim, seed.alpha);
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * TAU;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * seed.size, Math.sin(a) * seed.size);
          ctx.stroke();
        }
        ctx.fillStyle = rgba(palette.rim, seed.alpha * 1.2);
        ctx.beginPath();
        ctx.arc(0, 0, 0.8, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    drawAsh() {
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      const data = this.particles;
      const scale = this.frameScale;
      const motion = reducedMotion ? 0.35 : 1;

      const warmth = ctx.createLinearGradient(0, h * 0.6, 0, h * 0.88);
      warmth.addColorStop(0, rgba(palette.glow, 0));
      warmth.addColorStop(0.68, rgba(palette.glow, 0.045));
      warmth.addColorStop(1, rgba(palette.haze, 0));
      ctx.fillStyle = warmth;
      ctx.fillRect(0, h * 0.6, w, h * 0.28);

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (const fleck of data.flecks) {
        fleck.y += fleck.speed * 0.016 * scale * motion;
        fleck.x += Math.sin(this.time * 0.2 + fleck.phase) * 0.0008 * scale;
        if (fleck.y > 1.03) {
          fleck.y = -0.02;
          fleck.x = this.rng();
        }
        ctx.fillStyle = rgba(palette.rim, fleck.alpha * 0.42);
        ctx.beginPath();
        ctx.arc(fleck.x * w, fleck.y * h, fleck.size, 0, TAU);
        ctx.fill();
      }

      for (const ember of data.embers) {
        ember.y -= ember.speed * 0.016 * scale * motion;
        ember.x += Math.sin(this.time * 0.42 + ember.phase) * 0.0009 * scale + ember.drift * 0.0015 * scale;
        ember.life -= 0.003 * scale * motion;
        if (ember.y < 0.04 || ember.life < 0) {
          ember.y = rand(this.rng, 0.76, 0.98);
          ember.x = rand(this.rng, 0.1, 0.9);
          ember.life = rand(this.rng, 0.5, 1);
          ember.size = rand(this.rng, 0.4, 2.2);
        }
        const flicker = 0.55 + Math.sin(this.time * 3 + ember.phase) * 0.45;
        const x = ember.x * w;
        const y = ember.y * h;
        ctx.globalAlpha = Math.min(1, ember.life) * ember.alpha * flicker;
        ctx.drawImage(this.glowSprite, x - ember.size * 5, y - ember.size * 5, ember.size * 10, ember.size * 10);
        ctx.fillStyle = rgba(palette.rim, Math.min(1, ember.life) * ember.alpha);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.3, ember.size * 0.55), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    drawFog() {
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      const data = this.particles;
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (const mote of data.motes) {
        const x = (mote.x + Math.sin(this.time * 0.16 + mote.phase) * 0.045) * w;
        const y = (mote.y + Math.cos(this.time * 0.11 + mote.phase) * 0.02) * h;
        const alpha = mote.alpha * (0.55 + Math.sin(this.time * 0.6 + mote.phase) * 0.45);
        ctx.fillStyle = rgba(palette.rim, alpha);
        ctx.beginPath();
        ctx.arc(x, y, mote.size, 0, TAU);
        ctx.fill();
      }

      const breathing = ctx.createRadialGradient(w * 0.5, h * 0.44, 0, w * 0.5, h * 0.44, w * 0.5);
      const flicker = 0.85 + Math.sin(this.time * 0.16) * 0.15;
      breathing.addColorStop(0, rgba(palette.glow, 0.055 * flicker));
      breathing.addColorStop(1, rgba(palette.glow, 0));
      ctx.fillStyle = breathing;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    drawPulses() {
      if (!this.pulses.length) return;
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const pulse of this.pulses) {
        const t = pulse.age / pulse.life;
        const alpha = (1 - t) * 0.42;
        const radius = 4 + t * Math.min(w, h) * 0.18;
        ctx.strokeStyle = rgba(palette.rim, alpha);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pulse.x * w, pulse.y * h, radius, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = rgba(palette.rim, alpha * 0.4);
        ctx.beginPath();
        ctx.arc(pulse.x * w, pulse.y * h, radius * 0.58, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = rgba(palette.rim, alpha * 1.3);
        ctx.beginPath();
        ctx.arc(pulse.x * w, pulse.y * h, 1.2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    drawLightning() {
      if (!this.bolt && !this.staticArc) return;
      const ctx = this.ctx;
      const palette = this.spec.palette;
      const w = this.w;
      const h = this.h;
      const drawPath = (points) => {
        ctx.beginPath();
        points.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point[0] * w, point[1] * h);
          else ctx.lineTo(point[0] * w, point[1] * h);
        });
        ctx.stroke();
      };
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      if (this.staticArc) {
        ctx.strokeStyle = rgba(palette.rim, 0.13);
        ctx.lineWidth = 0.65;
        ctx.shadowColor = rgba(palette.glow, 0.28);
        ctx.shadowBlur = 5;
        drawPath(this.staticArc);
      }
      if (this.bolt) {
        const alpha = clamp(this.bolt.life / 0.34, 0, 1);
        ctx.shadowColor = rgba(palette.glow, 0.8);
        ctx.shadowBlur = 14;
        ctx.strokeStyle = rgba(palette.rim, alpha * 0.95);
        ctx.lineWidth = 1.1;
        drawPath(this.bolt.points);
        ctx.lineWidth = 0.55;
        ctx.strokeStyle = rgba(palette.rim, alpha * 0.55);
        for (const branch of this.bolt.branches) drawPath(branch);
      }
      ctx.restore();
    }

    drawVignette() {
      const ctx = this.ctx;
      const w = this.w;
      const h = this.h;
      const palette = this.spec.palette;
      const vignette = ctx.createRadialGradient(
        w * 0.5, h * 0.43, Math.min(w, h) * 0.24,
        w * 0.5, h * 0.5, Math.max(w, h) * 0.72
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(0.65, rgba(palette.deep, 0.18));
      vignette.addColorStop(1, rgba("#050806", 0.7));
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      const topShade = ctx.createLinearGradient(0, 0, 0, h * 0.3);
      topShade.addColorStop(0, "rgba(2,6,4,0.28)");
      topShade.addColorStop(1, "rgba(2,6,4,0)");
      ctx.fillStyle = topShade;
      ctx.fillRect(0, 0, w, h * 0.3);
    }

    drawGrain() {
      if (!this.noisePattern) return;
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = this.noisePattern;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
  }

  class WeatherSound {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.padFilter = null;
      this.padGain = null;
      this.noiseFilter = null;
      this.noiseGain = null;
      this.oscillators = [];
      this.delay = null;
      this.delayFeedback = null;
      this.delayGain = null;
      this.active = false;
      this.spec = null;
      this.noiseSource = null;
    }

    init() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      this.ctx = new AudioContextClass();
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.0001;
      this.master.connect(ctx.destination);

      this.padFilter = ctx.createBiquadFilter();
      this.padFilter.type = "lowpass";
      this.padFilter.frequency.value = 500;
      this.padFilter.Q.value = 0.6;

      this.padGain = ctx.createGain();
      this.padGain.gain.value = 0.016;
      this.padFilter.connect(this.padGain);
      this.padGain.connect(this.master);

      this.delay = ctx.createDelay(1.2);
      this.delay.delayTime.value = 0.47;
      this.delayFeedback = ctx.createGain();
      this.delayFeedback.gain.value = 0.22;
      this.delayGain = ctx.createGain();
      this.delayGain.gain.value = 0.22;
      this.padGain.connect(this.delay);
      this.delay.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delay);
      this.delay.connect(this.delayGain);
      this.delayGain.connect(this.master);

      const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i += 1) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }
      this.noiseSource = ctx.createBufferSource();
      this.noiseSource.buffer = buffer;
      this.noiseSource.loop = true;
      this.noiseFilter = ctx.createBiquadFilter();
      this.noiseFilter.type = "lowpass";
      this.noiseFilter.frequency.value = 400;
      this.noiseGain = ctx.createGain();
      this.noiseGain.gain.value = 0.012;
      this.noiseSource.connect(this.noiseFilter);
      this.noiseFilter.connect(this.noiseGain);
      this.noiseGain.connect(this.master);
      this.noiseSource.start();

      for (let i = 0; i < 3; i += 1) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === 0 ? "sine" : "triangle";
        osc.frequency.value = 98 * [1, 1.5, 2][i];
        osc.detune.value = (i - 1) * 4;
        gain.gain.value = i === 0 ? 0.48 : 0.14;
        osc.connect(gain);
        gain.connect(this.padFilter);
        osc.start();
        this.oscillators.push({ osc: osc, gain: gain });
      }

      this.updateSpec(this.spec);
      return true;
    }

    enable() {
      if (!this.ctx && !this.init()) return false;
      this.active = true;
      if (this.ctx.state === "suspended") {
        const resuming = this.ctx.resume();
        if (resuming && typeof resuming.catch === "function") {
          resuming.catch(function () { /* a browser may still block audio; the scene stays silent */ });
        }
      }
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(0.62, this.ctx.currentTime, 0.4);
      return true;
    }

    disable() {
      this.active = false;
      if (!this.ctx) return;
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.28);
    }

    updateSpec(spec) {
      this.spec = spec;
      if (!this.ctx || !spec) return;
      const family = window.YHJ_DATA.FAMILIES[spec.familyKey];
      if (!family || !family.audio) return;
      const config = family.audio;
      const now = this.ctx.currentTime;
      const root = config.root * (0.94 + ((spec.seed % 37) / 37) * 0.12);
      this.oscillators.forEach((item, index) => {
        const ratio = config.chord[index % config.chord.length];
        item.osc.frequency.setTargetAtTime(root * ratio, now, 0.55);
      });
      this.padFilter.frequency.setTargetAtTime(config.cutoff * 1.7, now, 0.6);
      this.padGain.gain.setTargetAtTime(config.padGain, now, 0.7);
      this.noiseFilter.type = config.noiseType;
      this.noiseFilter.frequency.setTargetAtTime(config.cutoff, now, 0.7);
      this.noiseGain.gain.setTargetAtTime(config.noiseGain, now, 0.7);
    }

    chime(spec) {
      if (!this.active || !this.ctx || !spec) return;
      const family = window.YHJ_DATA.FAMILIES[spec.familyKey];
      if (!family) return;
      const ctx = this.ctx;
      const now = ctx.currentTime + 0.02;
      const base = family.audio.root * 2;
      const scale = [0, 2, 4, 7, 9, 12, 14, 16];
      const notes = [0, 1, 2].map((i) => scale[(spec.seed + i * 3) % scale.length]);
      notes.forEach((semitone, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = base * Math.pow(2, semitone / 12);
        const at = now + index * 0.12;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.035 / (index + 1), at + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 2.1);
        osc.connect(gain);
        gain.connect(this.master);
        gain.connect(this.delay);
        osc.start(at);
        osc.stop(at + 2.2);
      });
    }
  }

  window.YHJ = window.YHJ || {};
  window.YHJ.WeatherWindow = WeatherWindow;
  window.YHJ.WeatherSound = WeatherSound;
  window.YHJ.channels = channels;
})();
