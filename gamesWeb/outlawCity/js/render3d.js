"use strict";
/* OUTLAW CITY 3D · 黄昏霓虹开放世界渲染器
 * 纯 Three.js r128，无外部资源：所有贴图、建筑、街具、角色与车辆均在运行时生成。
 * 世界几何、贴图与车辆/角色共用几何体均按“静态冻结 + 共享资源”组织，避免每帧矩阵更新。
 */
const Render3D = {
  disabled: false, errorMsg: "",
  renderer: null, scene: null, camera: null,
  worldGroup: null, skyGroup: null,
  amb: null, hemi: null, sun: null, fill: null, head: null, heroLight: null,
  playerMesh: null,
  vehs: [], npcs: [], pickups: [], markers: [], flashFxList: [], boomLights: [], beacons: [],
  vehSet: null, vehMap: null, npcSet: null, npcMap: null,
  pkSet: null, pkMap: null,
  markerList: null, lampIdx: null, lampDist: null, lampLights: [],
  camTarget: null, camYaw: 0, camPitch: 0.17, zoomD: 15.5, camZoom: 1, mouseIdleT: 99,
  camFov: 60, camAim: 0, camRoll: 0, camArmLen: 0,
  minPitch: -0.18, maxPitch: 1.12,
  raycaster: null, plane: null, ndc: null, hitV: null,
  pGeo: null, pPos: null, pCol: null, pPts: null,
  bGeo: null, bPos: null, bPts: null,
  pPosAttr: null, pColAttr: null, bPosAttr: null,
  sparkGeo: null, sparkPos: null, sparkCol: null, sparkPts: null,
  sparkPosAttr: null, sparkColAttr: null,
  spawn: { x: 160, y: 160 }, hero: null, heroFront: null,
  tex: null, mat: null, geo: null, facadeMats: null, storefrontMats: null,
  signMats: null, glowMats: null,
  sharedGeoSet: null, sharedMatSet: null,
  elapsed: 0, night: 0, carGeoCache: null, clothMats: null,
  pickMatCache: null, markerMats: null,

  /* ------------------------------------------------------------------ */
  init(glCanvas, w, h) {
    this.disabled = false; this.errorMsg = "";
    if (!window.THREE) {
      this.disabled = true;
      this.errorMsg = "three.js 未加载";
      console.warn("three.js 未加载，3D 渲染停用");
      return;
    }
    const T = window.THREE;
    try {
      this.renderer = new T.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: false });
    } catch (e) {
      this.disabled = true;
      this.errorMsg = "WebGL 不可用：" + (e && e.message ? e.message : e);
      console.warn("WebGL 初始化失败，3D 渲染停用", e);
      return;
    }
    this.renderer.setPixelRatio(1);
    // 不让 three 写死 canvas 的 inline CSS 尺寸；响应式尺寸完全交给 #game3d 的 CSS
    this.renderer.setSize(w, h, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    // 静态城市阴影不必每帧重画；按固定间隔刷新，移动物体投影最多滞后约 80ms。
    if ("autoUpdate" in this.renderer.shadowMap) {
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.shadowTimer = 0.08;
    if ("outputEncoding" in this.renderer) this.renderer.outputEncoding = T.sRGBEncoding;
    if ("toneMapping" in this.renderer) this.renderer.toneMapping = T.ACESFilmicToneMapping;
    if ("toneMappingExposure" in this.renderer) this.renderer.toneMappingExposure = 0.99;
    this.renderer.setClearColor(0x0b111d, 1);
    this.canInstance = false;
    try {
      const cap = this.renderer.capabilities;
      this.canInstance = !!(cap && cap.isWebGL2);
      if (!this.canInstance && this.renderer.extensions) {
        this.canInstance = !!this.renderer.extensions.get("ANGLE_instanced_arrays");
      }
    } catch (e) { this.canInstance = false; }

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(60, (w || 1280) / (h || 720), 0.5, 7600);
    this.scene.fog = new T.Fog(0x1a2334, 360, 3300);
    this.scene.background = new T.Color(0x1a2334);

    this.vehs.length = 0; this.npcs.length = 0; this.pickups.length = 0;
    this.markers.length = 0; this.flashFxList.length = 0; this.boomLights.length = 0;
    this.beacons.length = 0;
    this.lampLights = [];
    this.vehSet = new Set(); this.vehMap = new Map();
    this.npcSet = new Set(); this.npcMap = new Map();
    this.pkSet = new Set(); this.pkMap = new Map();
    this.markerList = [];
    this.sharedGeoSet = new Set(); this.sharedMatSet = new Set();
    this.carGeoCache = new Map(); this.clothMats = new Map();
    this.pickMatCache = new Map(); this.markerMats = new Map();
    this.lampIdx = new Int32Array(10);
    this.lampDist = new Float64Array(10);
    this.elapsed = 0; this.night = 0;
    this.camFov = 60; this.camAim = 0; this.camRoll = 0;
    this.facadeStats = { escapes: 0, acs: 0 };

    this.raycaster = new T.Raycaster();
    this.plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    this.ndc = new T.Vector2();
    this.hitV = new T.Vector3();
    this.camTarget = new T.Vector3();
    this.camDir = new T.Vector3();

    this.spawn.x = (W.spawnPoint && isFinite(W.spawnPoint.x)) ? W.spawnPoint.x : W.hospital.x;
    this.spawn.y = (W.spawnPoint && isFinite(W.spawnPoint.y)) ? W.spawnPoint.y : W.hospital.y;
    if (w > 0 && h > 0) this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    this.buildTextures();
    this.buildMaterials();
    this.buildSharedGeometry();
    this.buildSky();
    this.buildWorld();
    this.buildLights();
    this.buildParticles();

    this.playerMesh = this.makeCharacter(0x8d2b22, 1.55, true);
    this.playerMesh.group.position.set(this.spawn.x, 0, this.spawn.y);
    this.scene.add(this.playerMesh.group);

    this.camYaw = Math.atan2(this.spawn.y - this.heroFront.y, this.spawn.x - this.heroFront.x);
    this.camPitch = 0.17;
    this.zoomD = 15.5;
    this.camZoom = 1;
    this.camArmLen = 0;
    this._camArmLen = null;
    this._camPivotX = null;
    this.snapCamera();
    this.updateDayNight(0, true);
  },

  // 显示层尺寸与像素比：CSS 尺寸负责响应式，绘制缓冲按 DPR 提高清晰度
  resize(cssW, cssH, dpr) {
    if (this.disabled || !this.renderer) return;
    const w = cssW > 0 ? cssW : 1280;
    const h = cssH > 0 ? cssH : 720;
    const ratio = Math.max(1, Math.min(isFinite(dpr) ? dpr : 1, 2));
    try {
      this.renderer.setPixelRatio(ratio);
      this.renderer.setSize(w, h, false);
    } catch (e) { /* 降级环境忽略尺寸设置失败 */ }
    if (this.camera && w > 0 && h > 0) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  },

  /* ------------------------------------------------------------------ */
  rngSeed(seed) {
    let s = seed | 0;
    return function () {
      s = (s * 1664525 + 1013904223) | 0;
      return ((s >>> 0) % 100000) / 100000;
    };
  },
  canvasTex(w, h, draw, repeatX, repeatY, clamp) {
    const T = window.THREE;
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const g = cv.getContext("2d");
    if (g) draw(g, w, h);
    const tx = new T.CanvasTexture(cv);
    tx.wrapS = tx.wrapT = clamp ? T.ClampToEdgeWrapping : T.RepeatWrapping;
    if (repeatX != null && repeatY != null) tx.repeat.set(repeatX, repeatY);
    tx.encoding = T.sRGBEncoding;
    tx.anisotropy = 4;
    return tx;
  },
  makeToonGradient() {
    const T = window.THREE;
    const data = new Uint8Array([28, 78, 142, 218]);
    const tx = new T.DataTexture(data, 4, 1, T.LuminanceFormat);
    tx.minFilter = T.NearestFilter;
    tx.magFilter = T.NearestFilter;
    tx.generateMipmaps = false;
    tx.needsUpdate = true;
    return tx;
  },
  sharedGeo(g) { this.sharedGeoSet.add(g); g.userData.shared = true; return g; },
  sharedMat(m) { this.sharedMatSet.add(m); m.userData.shared = true; return m; },
  toon(color, opts) {
    const T = window.THREE;
    const key = "t" + color + (opts ? JSON.stringify(opts) : "");
    this._matCache = this._matCache || new Map();
    let m = this._matCache.get(key);
    if (m) return m;
    const p = { color: color, gradientMap: this.tex.toon };
    if (opts) for (const k in opts) p[k] = opts[k];
    m = new T.MeshToonMaterial(p);
    this._matCache.set(key, m);
    return this.sharedMat(m);
  },
  basic(color, opts) {
    const T = window.THREE;
    const key = "b" + color + (opts ? JSON.stringify(opts) : "");
    this._matCache = this._matCache || new Map();
    let m = this._matCache.get(key);
    if (m) return m;
    const p = { color: color };
    if (opts) for (const k in opts) p[k] = opts[k];
    m = new T.MeshBasicMaterial(p);
    this._matCache.set(key, m);
    return this.sharedMat(m);
  },
  phong(color, opts) {
    const T = window.THREE;
    const key = "p" + color + (opts ? JSON.stringify(opts) : "");
    this._matCache = this._matCache || new Map();
    let m = this._matCache.get(key);
    if (m) return m;
    const p = { color: color, shininess: 24 };
    if (opts) for (const k in opts) p[k] = opts[k];
    m = new T.MeshPhongMaterial(p);
    this._matCache.set(key, m);
    return this.sharedMat(m);
  },

  /* ------------------------------------------------------------------ */
  buildTextures() {
    const self = this;
    const tx = this.tex = {};
    tx.toon = this.makeToonGradient();

    const drawAsphalt = (g, w, h, base) => {
      const r = self.rngSeed(7871 + base.length);
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const v = Math.floor(44 + r() * 42);
        g.fillStyle = "rgba(" + v + "," + (v + 1) + "," + (v + 3) + "," + (0.12 + r() * 0.3) + ")";
        const s = 1 + r() * 3;
        g.fillRect(r() * w, r() * h, s, s);
      }
      g.strokeStyle = "rgba(12,15,18,0.5)";
      for (let i = 0; i < 8; i++) {
        g.lineWidth = 0.6 + r() * 1.2;
        g.beginPath();
        let x = r() * w, y = r() * h;
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 36; y += 8 + r() * 20; g.lineTo(x, y); }
        g.stroke();
      }
      g.strokeStyle = "rgba(120,112,98,0.13)";
      for (let i = 0; i < 9; i++) {
        g.lineWidth = 1.5 + r() * 3;
        g.beginPath();
        g.moveTo(r() * w, 0); g.lineTo(r() * w, h);
        g.stroke();
      }
      const grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, "rgba(255,213,148,0.09)");
      grd.addColorStop(0.5, "rgba(255,255,255,0)");
      grd.addColorStop(1, "rgba(70,130,180,0.08)");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    };
    tx.asphaltGround = this.canvasTex(256, 256, (g, w, h) => drawAsphalt(g, w, h, "#3c3d3b"), 26, 26);
    tx.asphaltV = this.canvasTex(256, 256, (g, w, h) => drawAsphalt(g, w, h, "#343635"), 2, 24);
    tx.asphaltH = this.canvasTex(256, 256, (g, w, h) => drawAsphalt(g, w, h, "#343635"), 24, 2);

    tx.pavers = this.canvasTex(256, 256, (g, w, h) => {
      const r = self.rngSeed(9127);
      g.fillStyle = "#726d62"; g.fillRect(0, 0, w, h);
      const bw = 64, bh = 32;
      for (let y = 0; y < h; y += bh) {
        const off = (y / bh) % 2 ? bw / 2 : 0;
        for (let x = -bw; x < w + bw; x += bw) {
          const v = 104 + Math.floor(r() * 26);
          g.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 11) + ")";
          g.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
          g.fillStyle = "rgba(255,238,205,0.07)";
          g.fillRect(x + off + 3, y + 3, bw - 6, 2);
          g.fillStyle = "rgba(20,22,24,0.18)";
          g.fillRect(x + off + 3, y + bh - 4, bw - 6, 2);
        }
      }
      for (let i = 0; i < 24; i++) {
        g.fillStyle = "rgba(40,44,42," + (0.03 + r() * 0.1) + ")";
        g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 7, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = "rgba(28,30,30,0.32)";
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, 127.5); g.lineTo(w, 127.5); g.stroke();
    }, 18, 18);

    tx.grass = this.canvasTex(256, 256, (g, w, h) => {
      const r = self.rngSeed(3319);
      g.fillStyle = "#405a34"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) {
        const v = 40 + Math.floor(r() * 58);
        g.fillStyle = "rgba(" + Math.floor(v * 0.65) + "," + v + "," + Math.floor(v * 0.52) + "," + (0.25 + r() * 0.5) + ")";
        g.fillRect(r() * w, r() * h, 1 + r() * 2.4, 2 + r() * 5);
      }
      for (let i = 0; i < 18; i++) {
        g.fillStyle = "rgba(132,150,84,0.18)";
        g.beginPath(); g.arc(r() * w, r() * h, 5 + r() * 16, 0, Math.PI * 2); g.fill();
      }
    }, 5, 5);

    tx.water = this.canvasTex(256, 256, (g, w, h) => {
      const r = self.rngSeed(6281);
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, "#123b4b"); grd.addColorStop(0.5, "#175568"); grd.addColorStop(1, "#0d2e3d");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(120,225,232,0.18)";
      for (let i = 0; i < 34; i++) {
        g.lineWidth = 0.7 + r() * 2.2;
        g.beginPath();
        const y = r() * h;
        for (let x = 0; x < w; x += 12) g.lineTo(x, y + Math.sin(x * 0.08 + r() * 2) * (2 + r() * 4));
        g.stroke();
      }
      g.fillStyle = "rgba(255,185,95,0.10)";
      g.beginPath(); g.ellipse(160, 74, 48, 9, -0.2, 0, Math.PI * 2); g.fill();
    }, 7, 7);

    const drawFacade = (g, w, h, variant) => {
      const r = self.rngSeed(4411 + variant * 977);
      const walls = ["#8d7a67", "#7d8b8d", "#9a7c63", "#6f7d7c"];
      g.fillStyle = walls[variant]; g.fillRect(0, 0, w, h);
      const grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, "rgba(255,230,190,0.18)");
      grd.addColorStop(0.6, "rgba(255,255,255,0)");
      grd.addColorStop(1, "rgba(22,31,39,0.22)");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      const cols = variant === 2 ? 3 : 4;
      const rows = 7;
      const mx = 18, my = 16;
      const cw = (w - mx * 2) / cols, ch = (h - my * 2) / rows;
      for (let row = 0; row < rows; row++) {
        g.fillStyle = "rgba(42,44,42,0.28)";
        g.fillRect(0, my + row * ch + ch - 3, w, 3);
        for (let col = 0; col < cols; col++) {
          const x = mx + col * cw + 8, y = my + row * ch + 6;
          const ww = cw - 16, wh = ch - 15;
          const lit = r() < 0.3;
          g.fillStyle = "rgba(18,22,28,0.32)";
          g.fillRect(x - 3, y - 3, ww + 6, wh + 6);
          if (lit) {
            const lg = g.createLinearGradient(x, y, x, y + wh);
            lg.addColorStop(0, "rgba(255,232,165,0.96)");
            lg.addColorStop(1, "rgba(210,139,73,0.82)");
            g.fillStyle = lg;
          } else {
            const dg = g.createLinearGradient(x, y, x + ww, y + wh);
            dg.addColorStop(0, "rgba(38,64,78,0.92)");
            dg.addColorStop(0.5, "rgba(19,34,46,0.96)");
            dg.addColorStop(1, "rgba(58,83,92,0.86)");
            g.fillStyle = dg;
          }
          g.fillRect(x, y, ww, wh);
          g.fillStyle = "rgba(255,255,255,0.07)";
          g.fillRect(x + 2, y + 2, ww - 4, 2);
          g.fillStyle = "rgba(8,12,16,0.45)";
          g.fillRect(x + ww / 2 - 1, y, 2, wh);
          if (r() < 0.26) {
            g.fillStyle = "rgba(74,77,70,0.9)";
            g.fillRect(x + 3, y + wh - 7, Math.min(22, ww - 6), 5);
            g.fillStyle = "rgba(160,160,145,0.5)";
            g.fillRect(x + 4, y + wh - 10, Math.min(20, ww - 8), 2);
          }
        }
      }
      g.fillStyle = "rgba(25,28,29,0.92)";
      g.fillRect(10, h - 68, w - 20, 58);
      for (let i = 0; i < 5; i++) {
        g.fillStyle = "rgba(100,108,104,0.22)";
        g.fillRect(14, h - 62 + i * 11, w - 28, 4);
      }
      for (let i = 0; i < 12; i++) {
        g.fillStyle = "rgba(23,28,28," + (0.04 + r() * 0.11) + ")";
        g.fillRect(r() * w, 0, 1 + r() * 4, h * (0.25 + r() * 0.7));
      }
      for (let i = 0; i < 8; i++) {
        g.fillStyle = "rgba(34,38,33,0.10)";
        g.beginPath(); g.arc(r() * w, r() * h, 8 + r() * 24, 0, Math.PI * 2); g.fill();
      }
    };
    tx.facade = [];
    for (let i = 0; i < 4; i++) tx.facade.push(this.canvasTex(256, 512, (g, w, h) => drawFacade(g, w, h, i)));

    tx.roof = this.canvasTex(256, 256, (g, w, h) => {
      const r = self.rngSeed(5513);
      g.fillStyle = "#4a4b46"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 3800; i++) {
        const v = 46 + Math.floor(r() * 54);
        g.fillStyle = "rgba(" + v + "," + v + "," + (v - 3) + "," + (0.2 + r() * 0.4) + ")";
        g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
      }
      g.strokeStyle = "rgba(24,26,25,0.4)"; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(0, r() * h); g.lineTo(w, r() * h); g.stroke(); }
      g.fillStyle = "rgba(154,138,100,0.1)";
      for (let i = 0; i < 10; i++) g.fillRect(r() * w, r() * h, 4 + r() * 20, 2 + r() * 4);
    }, 4, 4);

    const drawShop = (g, w, h, variant) => {
      const r = self.rngSeed(7717 + variant * 311);
      const warm = variant === 0;
      const frame = warm ? "#1b1512" : "#101c22";
      const neon = warm ? "#ff9a52" : "#59d8e6";
      const glassTop = warm ? "#ffe3a0" : "#b7f4f8";
      const glassMid = warm ? "#d59048" : "#4b9aa8";
      const glassLow = warm ? "#6f3d1f" : "#1b4651";
      g.fillStyle = "#070b0e"; g.fillRect(0, 0, w, h);
      // 顶部灯箱横带
      const head = g.createLinearGradient(0, 4, 0, 42);
      head.addColorStop(0, warm ? "#3b2a1b" : "#152a33");
      head.addColorStop(1, warm ? "#160f0b" : "#0b151b");
      g.fillStyle = head; g.fillRect(8, 4, w - 16, 38);
      g.strokeStyle = neon; g.lineWidth = 3; g.globalAlpha = 0.8;
      g.beginPath(); g.moveTo(16, 38); g.lineTo(w - 16, 38); g.stroke();
      g.globalAlpha = 1;
      for (let i = 0; i < 4; i++) {
        g.fillStyle = "rgba(255,236,198,0.20)";
        g.fillRect(24 + i * 62, 13, 34, 12);
      }
      // 玻璃幕墙：四扇橱窗 + 一扇入口
      const gx = 14, gy = 44, gw = w - 28, gh = h - 74;
      const doorW = gw * 0.18;
      const paneW = (gw - doorW - 4 * 7) / 4;
      for (let p = 0; p < 5; p++) {
        const x = gx + p * (paneW + 7) + (p >= 3 ? doorW - paneW : 0);
        const isDoor = p === 3;
        const pw = isDoor ? doorW : paneW;
        const grd = g.createLinearGradient(0, gy, 0, gy + gh);
        grd.addColorStop(0, glassTop);
        grd.addColorStop(0.42, glassMid);
        grd.addColorStop(1, glassLow);
        g.fillStyle = grd; g.fillRect(x, gy, pw, gh);
        // 室内货架与商品剪影
        if (!isDoor) {
          for (let row = 0; row < 3; row++) {
            const sy = gy + 24 + row * 42;
            g.fillStyle = "rgba(20,22,23,0.50)"; g.fillRect(x + 4, sy, pw - 8, 5);
            for (let i = 0; i < 5; i++) {
              const bw2 = 5 + r() * 7;
              g.fillStyle = "rgba(" + (85 + r() * 120) + "," + (55 + r() * 80) + "," + (32 + r() * 55) + ",0.72)";
              g.fillRect(x + 6 + i * (pw - 16) / 5, sy - 13, bw2, 12);
            }
          }
          g.fillStyle = "rgba(255,255,255,0.12)";
          g.beginPath(); g.moveTo(x + 8, gy + gh); g.lineTo(x + pw * 0.42, gy); g.lineTo(x + pw * 0.56, gy); g.lineTo(x + 20, gy + gh); g.fill();
        } else {
          // 门：玻璃 + 横向推杆 + OPEN 牌
          g.fillStyle = "rgba(8,12,14,0.32)"; g.fillRect(x, gy, pw, gh);
          g.fillStyle = "rgba(255,249,224,0.82)";
          g.fillRect(x + 6, gy + 12, pw - 12, 4);
          g.fillStyle = "rgba(12,16,18,0.85)";
          g.fillRect(x + 6, gy + gh * 0.48, pw - 12, 5);
          const sg = g.createLinearGradient(x, gy + 6, x, gy + 28);
          sg.addColorStop(0, "rgba(255,244,204,0.95)"); sg.addColorStop(1, "rgba(233,170,86,0.85)");
          g.fillStyle = sg; g.fillRect(x + pw - 30, gy + 8, 22, 12);
          g.fillStyle = "#1b1410"; g.font = "bold 8px 'Segoe UI', sans-serif";
          g.textAlign = "center"; g.fillText("OPEN", x + pw - 19, gy + 17);
        }
        // 竖向窗框
        g.strokeStyle = frame; g.lineWidth = 4; g.strokeRect(x + 1, gy, pw - 2, gh);
        g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(x + 4, gy + 2, 2, gh - 4);
      }
      // 踢脚墙与雨棚投影
      g.fillStyle = "rgba(9,13,15,0.95)"; g.fillRect(0, h - 30, w, 30);
      g.fillStyle = "rgba(120,110,94,0.18)"; g.fillRect(10, h - 26, w - 20, 3);
      g.fillStyle = "rgba(0,0,0,0.28)"; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
      // 边缘霓虹框
      g.strokeStyle = neon; g.lineWidth = 4; g.globalAlpha = 0.9;
      g.strokeRect(9, 5, w - 18, h - 12);
      g.globalAlpha = 0.5; g.strokeRect(18, 12, w - 36, h - 26); g.globalAlpha = 1;
      // 玻璃反光与雨痕
      g.fillStyle = "rgba(255,255,255,0.07)";
      for (let i = 0; i < 12; i++) g.fillRect(18 + r() * (w - 36), 46 + r() * (h - 90), 2, 8 + r() * 22);
    };
    tx.storefront = [
      this.canvasTex(512, 256, (g, w, h) => drawShop(g, w, h, 0)),
      this.canvasTex(512, 256, (g, w, h) => drawShop(g, w, h, 1)),
    ];

    const signDefs = [
      ["亡命酒馆", "#ffb35c", "#ff5c35", "OUTLAW BAR"],
      ["霓虹旅社", "#62e7ff", "#ff6ec7", "NEON HOTEL"],
      ["夜行拉面", "#ffe66b", "#ff3d6e", "NIGHT RAMEN"],
      ["黑猫当铺", "#c08cff", "#52e0c4", "PAWN SHOP"],
      ["24H 超市", "#7dffb1", "#fff27a", "24H MART"],
      ["赤月俱乐部", "#ff5b72", "#ffb15c", "RED MOON"],
    ];
    const drawSign = (g, w, h, def) => {
      const r = self.rngSeed(997 + def[0].length * 31 + w);
      g.clearRect(0, 0, w, h);
      g.fillStyle = "rgba(8,11,16,0.88)";
      g.fillRect(4, 4, w - 8, h - 8);
      g.strokeStyle = def[1]; g.lineWidth = 5;
      g.shadowColor = def[1]; g.shadowBlur = 16;
      g.strokeRect(8, 8, w - 16, h - 16);
      g.shadowBlur = 12;
      g.fillStyle = def[2];
      g.font = "bold 54px 'Microsoft YaHei', 'Segoe UI', sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(def[0], w / 2, h / 2 - 10);
      g.shadowBlur = 6;
      g.fillStyle = def[1];
      g.font = "bold 17px 'Segoe UI', sans-serif";
      g.fillText(def[3], w / 2, h - 26);
      g.shadowBlur = 0;
      g.fillStyle = "rgba(255,255,255,0.18)";
      for (let i = 0; i < 14; i++) g.fillRect(14 + r() * (w - 28), 12 + r() * (h - 24), 2, 2);
    };
    tx.signs = signDefs.map((def) => this.canvasTex(512, 128, (g, w, h) => drawSign(g, w, h, def), 1, 1, true));

    tx.verticalSign = this.canvasTex(128, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = "rgba(8,12,17,0.9)"; g.fillRect(5, 5, w - 10, h - 10);
      g.strokeStyle = "#ff5d74"; g.lineWidth = 5;
      g.shadowColor = "#ff5d74"; g.shadowBlur = 18;
      g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = "#ffd0a2"; g.font = "bold 62px 'Microsoft YaHei', sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      const chars = ["亡", "命", "都", "市"];
      for (let i = 0; i < chars.length; i++) g.fillText(chars[i], w / 2, 70 + i * 112);
      g.shadowBlur = 0;
      g.fillStyle = "#ff7f8f"; g.font = "bold 17px 'Segoe UI', sans-serif";
      g.fillText("NIGHT", w / 2, h - 32);
    }, 1, 1, true);

    tx.billboard = this.canvasTex(512, 256, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, "#101c2b"); grd.addColorStop(0.55, "#421d33"); grd.addColorStop(1, "#071016");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#ffb154"; g.lineWidth = 7; g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = "#ffd18a"; g.font = "bold 57px 'Segoe UI', sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.shadowColor = "#ff6a38"; g.shadowBlur = 18;
      g.fillText("NIGHT CITY", w / 2, 96);
      g.font = "bold 25px 'Segoe UI', sans-serif";
      g.fillStyle = "#6fe6ff";
      g.fillText("NO GODS · ONLY OUTLAWS", w / 2, 158);
      g.shadowBlur = 0;
      g.fillStyle = "rgba(255,255,255,0.16)";
      g.fillRect(38, 204, w - 76, 2);
      g.font = "16px 'Segoe UI', sans-serif"; g.fillStyle = "#b7c4cc";
      g.fillText("DOWNTOWN   ·   10 MINUTES FROM ANYWHERE", w / 2, 224);
    }, 1, 1, true);

    const drawAwning = (g, w, h, a, b) => {
      g.fillStyle = a; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 28) { g.fillStyle = b; g.fillRect(x, 0, 14, h); }
      g.fillStyle = "rgba(20,24,26,0.35)"; g.fillRect(0, h - 8, w, 8);
      g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(0, 0, w, 4);
    };
    tx.awning = [
      this.canvasTex(128, 64, (g, w, h) => drawAwning(g, w, h, "#9b3f32", "#d89b62"), 1, 1),
      this.canvasTex(128, 64, (g, w, h) => drawAwning(g, w, h, "#1f5f63", "#d8c48c"), 1, 1),
    ];

    tx.stallSign = this.canvasTex(256, 96, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = "rgba(12,16,18,0.94)"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#ff8b52"; g.lineWidth = 4; g.shadowColor = "#ff5b36"; g.shadowBlur = 14;
      g.strokeRect(5, 5, w - 10, h - 10);
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = "#ffe4a8"; g.font = "bold 40px 'Microsoft YaHei', sans-serif";
      g.fillText("夜市小馆", w / 2, h / 2 - 8);
      g.shadowBlur = 6; g.fillStyle = "#71e6ff"; g.font = "bold 16px 'Segoe UI', sans-serif";
      g.fillText("NIGHT MARKET · HOT FOOD", w / 2, h - 24);
    }, 1, 1, true);

    tx.vending = this.canvasTex(256, 512, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, "#c93333"); grd.addColorStop(0.55, "#871d2a"); grd.addColorStop(1, "#35141c");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(10,15,20,0.88)"; g.fillRect(18, 24, w - 36, 188);
      const r = self.rngSeed(2214);
      for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
        g.fillStyle = ["#f87171", "#fbbf24", "#7dd3fc", "#86efac", "#f8fafc"][Math.floor(r() * 5)];
        g.fillRect(29 + col * 50, 40 + row * 42, 22, 30);
      }
      g.fillStyle = "#f8edd7"; g.font = "bold 30px 'Segoe UI', sans-serif"; g.textAlign = "center";
      g.fillText("DRINKS", w / 2, 258);
      g.fillStyle = "rgba(255,230,160,0.9)"; g.fillRect(40, 286, w - 80, 34);
      g.fillStyle = "#1a2026"; g.fillRect(48, 294, w - 96, 12);
      g.fillStyle = "rgba(15,18,20,0.85)"; g.fillRect(40, 360, w - 80, 70);
      g.fillStyle = "rgba(120,230,255,0.5)"; g.fillRect(58, 380, w - 116, 6);
    }, 1, 1, true);

    tx.graffiti = this.canvasTex(512, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.textAlign = "center"; g.textBaseline = "middle";
      g.font = "bold 78px 'Segoe UI', sans-serif";
      g.fillStyle = "rgba(255,72,124,0.9)";
      g.shadowColor = "#ff2d6f"; g.shadowBlur = 14;
      g.fillText("NO RULES", w / 2, h / 2 - 10);
      g.strokeStyle = "rgba(115,245,255,0.8)"; g.lineWidth = 3;
      g.strokeText("NO RULES", w / 2, h / 2 - 10);
      g.shadowBlur = 0;
      g.font = "bold 22px 'Segoe UI', sans-serif"; g.fillStyle = "rgba(240,230,200,0.8)";
      g.fillText("OUTLAW CITY", w / 2, h - 38);
    }, 1, 1, true);

    tx.glow = this.canvasTex(128, 128, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.18, "rgba(255,245,210,0.95)");
      grd.addColorStop(0.5, "rgba(255,180,80,0.35)");
      grd.addColorStop(1, "rgba(255,140,50,0)");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }, 1, 1, true);

    tx.shadow = this.canvasTex(128, 128, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      grd.addColorStop(0, "rgba(0,0,0,0.62)");
      grd.addColorStop(0.36, "rgba(0,0,0,0.34)");
      grd.addColorStop(0.75, "rgba(0,0,0,0.08)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }, 1, 1, true);

    tx.puddle = this.canvasTex(128, 128, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      grd.addColorStop(0, "rgba(120,205,225,0.34)");
      grd.addColorStop(0.62, "rgba(64,126,150,0.25)");
      grd.addColorStop(1, "rgba(28,58,74,0)");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(180,240,250,0.22)"; g.lineWidth = 1;
      g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.33, h * 0.2, 0.2, 0, Math.PI * 2); g.stroke();
    }, 1, 1, true);

    tx.cloud = this.canvasTex(256, 128, (g, w, h) => {
      const r = self.rngSeed(3321);
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < 22; i++) {
        const x = 28 + r() * (w - 56), y = 42 + r() * (h - 70), rad = 16 + r() * 36;
        const grd = g.createRadialGradient(x, y, 1, x, y, rad);
        grd.addColorStop(0, "rgba(255,220,190,0.14)");
        grd.addColorStop(0.6, "rgba(170,180,200,0.06)");
        grd.addColorStop(1, "rgba(80,100,130,0)");
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      }
    }, 1, 1, true);

    tx.sun = this.canvasTex(256, 256, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 3, w / 2, h / 2, w / 2);
      grd.addColorStop(0, "rgba(255,255,245,1)");
      grd.addColorStop(0.12, "rgba(255,228,160,0.95)");
      grd.addColorStop(0.34, "rgba(255,130,70,0.5)");
      grd.addColorStop(1, "rgba(255,90,45,0)");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }, 1, 1, true);

    tx.moon = this.canvasTex(256, 256, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      grd.addColorStop(0, "rgba(245,248,255,1)");
      grd.addColorStop(0.2, "rgba(210,225,245,0.85)");
      grd.addColorStop(0.5, "rgba(145,175,220,0.24)");
      grd.addColorStop(1, "rgba(90,130,190,0)");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }, 1, 1, true);

    tx.question = this.canvasTex(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.textAlign = "center"; g.textBaseline = "middle";
      g.font = "bold 90px 'Segoe UI', sans-serif";
      g.fillStyle = "#fff3a6";
      g.shadowColor = "#ffb02e"; g.shadowBlur = 20;
      g.fillText("?", w / 2, h / 2 + 4);
      g.shadowBlur = 0;
      g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 2;
      g.strokeText("?", w / 2, h / 2 + 4);
    }, 1, 1, true);
  },

  /* ------------------------------------------------------------------ */
  buildMaterials() {
    const T = window.THREE, tx = this.tex;
    this._matCache = new Map();
    const m = this.mat = {};
    const mapMat = (mat) => this.sharedMat(mat);

    m.asphaltGround = mapMat(new T.MeshPhongMaterial({ map: tx.asphaltGround, color: 0x807d74, shininess: 24, specular: 0x2a2a2a }));
    m.asphaltV = mapMat(new T.MeshPhongMaterial({ map: tx.asphaltV, color: 0x77746c, shininess: 30, specular: 0x303030 }));
    m.asphaltH = mapMat(new T.MeshPhongMaterial({ map: tx.asphaltH, color: 0x77746c, shininess: 30, specular: 0x303030 }));
    m.pavers = mapMat(new T.MeshPhongMaterial({ map: tx.pavers, color: 0x8d8474, shininess: 26, specular: 0x303030 }));
    m.roof = mapMat(new T.MeshToonMaterial({ map: tx.roof, color: 0x777369, gradientMap: tx.toon }));
    m.grass = mapMat(new T.MeshToonMaterial({ map: tx.grass, color: 0x4a573d, gradientMap: tx.toon }));
    m.water = mapMat(new T.MeshPhongMaterial({ map: tx.water, color: 0x9cdce4, transparent: true, opacity: 0.82, shininess: 90, specular: 0x8fdbe6, side: T.DoubleSide }));

    m.curb = this.toon(0x6b675f);
    m.trim = this.toon(0xb6aa93);
    m.trimDark = this.toon(0x413f3b);
    m.metalDark = this.toon(0x262b31);
    m.metal = this.toon(0x59636a);
    m.wood = this.toon(0x765035);
    m.woodDark = this.toon(0x3e2c22);
    m.stone = this.toon(0x99917f);
    m.stoneDark = this.toon(0x4c4a43);
    m.vermilion = this.toon(0xb64032);
    m.shrineRoof = this.toon(0x28353b);
    m.leafA = this.toon(0x2a4928);
    m.leafB = this.toon(0x3b5f2f);
    m.cherry = this.toon(0x6a2f48);
    m.cherryLight = this.toon(0x824055);
    m.trunk = this.toon(0x573a27);
    m.hydrant = this.toon(0xb83c32);
    m.bin = this.toon(0x3c5a4e);
    m.trafficBody = this.toon(0x191e23);
    m.trafficRed = this.basic(0xcc0000);
    m.trafficYellow = this.basic(0xffc14d);
    m.trafficGreen = this.basic(0x58e88e);
    m.neonCyan = this.basic(0x68e7ff);
    m.neonPink = this.basic(0xff5fa2);
    m.hospitalRed = this.basic(0xe04444);
    m.white = this.toon(0xd8d3c3);
    // 车漆统一用顶点色：一辆车一个几何体色调，但所有车共享同一材质，避免车色把材质数推爆
    m.carPaint = this.sharedMat(new T.MeshToonMaterial({
      color: 0xffffff, vertexColors: true, gradientMap: tx.toon,
      emissive: 0xffffff, emissiveIntensity: 0.02,
    }));
    m.glass = this.toon(0x1d3b4b);
    m.headlight = this.basic(0xfff1c2);
    m.taillight = this.basic(0xcc0000);
    // 尾灯/警灯不参与 ACES 高光压缩，并压暗基色，避免亮红在日光下变成粉色。
    m.taillight.toneMapped = false;
    m.trafficRed.toneMapped = false;
    m.laneWhite = this.basic(0x6c685d);
    m.laneYellow = this.basic(0x7d5f2b);
    m.puddle = mapMat(new T.MeshBasicMaterial({ map: tx.puddle, transparent: true, opacity: 0.40, depthWrite: false, color: 0x8ea0aa }));
    m.shadow = mapMat(new T.MeshBasicMaterial({ map: tx.shadow, transparent: true, opacity: 0.82, depthWrite: false, color: 0x000000 }));
    m.hull = mapMat(new T.MeshBasicMaterial({ color: 0x0b1016, side: T.BackSide }));
    m.skyline = this.toon(0x202b38);
    m.neonGlow = mapMat(new T.MeshBasicMaterial({ map: tx.glow, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
    m.wire = mapMat(new T.LineBasicMaterial({ color: 0x151b20, transparent: true, opacity: 0.8 }));

    this.facadeMats = [];
    for (let i = 0; i < 4; i++) {
      this.facadeMats.push(mapMat(new T.MeshToonMaterial({
        map: tx.facade[i], color: 0xbfb2a2, gradientMap: tx.toon, vertexColors: true,
        emissive: 0xffc07a, emissiveMap: tx.facade[i], emissiveIntensity: 0,
      })));
    }
    this.storefrontMats = [
      mapMat(new T.MeshBasicMaterial({ map: tx.storefront[0], color: 0xcac0b2 })),
      mapMat(new T.MeshBasicMaterial({ map: tx.storefront[1], color: 0xb5c3c4 })),
    ];
    this.signMats = [];
    for (let i = 0; i < 6; i++) {
      this.signMats.push(mapMat(new T.MeshBasicMaterial({
        map: tx.signs[i], transparent: true, depthWrite: false, side: T.DoubleSide, alphaTest: 0.02,
      })));
    }
    m.verticalSign = mapMat(new T.MeshBasicMaterial({ map: tx.verticalSign, transparent: true, depthWrite: false, side: T.DoubleSide }));
    m.billboard = mapMat(new T.MeshBasicMaterial({ map: tx.billboard, color: 0xffffff }));
    m.awningA = mapMat(new T.MeshToonMaterial({ map: tx.awning[0], color: 0xffffff, gradientMap: tx.toon, side: T.DoubleSide }));
    m.awningB = mapMat(new T.MeshToonMaterial({ map: tx.awning[1], color: 0xffffff, gradientMap: tx.toon, side: T.DoubleSide }));
    m.vending = mapMat(new T.MeshBasicMaterial({ map: tx.vending, color: 0xffffff }));
    m.stallSign = mapMat(new T.MeshBasicMaterial({ map: tx.stallSign, transparent: true, side: T.DoubleSide, depthWrite: false }));
    m.wetNeon = mapMat(new T.MeshBasicMaterial({ map: tx.glow, color: 0xff6fb5, transparent: true, opacity: 0.22, depthWrite: false, blending: T.AdditiveBlending }));
    m.graffiti = mapMat(new T.MeshBasicMaterial({ map: tx.graffiti, transparent: true, depthWrite: false, side: T.DoubleSide }));

    this.glowMats = [
      mapMat(new T.SpriteMaterial({ map: tx.glow, color: 0xffb85c, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.75 })),
      mapMat(new T.SpriteMaterial({ map: tx.glow, color: 0x7ce8ff, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.6 })),
      mapMat(new T.SpriteMaterial({ map: tx.glow, color: 0xff5b65, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.65 })),
    ];
    m.glowWarm = this.glowMats[0]; m.glowCyan = this.glowMats[1]; m.glowRed = this.glowMats[2];
    m.cloud = mapMat(new T.SpriteMaterial({ map: tx.cloud, color: 0xc4cfe0, transparent: true, depthWrite: false, opacity: 0.5, fog: false }));
    m.star = mapMat(new T.PointsMaterial({ map: tx.glow, color: 0xffffff, size: 5, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: T.AdditiveBlending }));
    m.sun = mapMat(new T.SpriteMaterial({ map: tx.sun, color: 0xffd2a0, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    m.moon = mapMat(new T.SpriteMaterial({ map: tx.moon, color: 0xcfe4ff, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, opacity: 0.7 }));
    m.particle = mapMat(new T.PointsMaterial({ map: tx.glow, vertexColors: true, size: 5, sizeAttenuation: true, transparent: true, opacity: 0.96, depthWrite: false, blending: T.AdditiveBlending }));
    m.bullet = mapMat(new T.PointsMaterial({ map: tx.glow, color: 0xffe29a, size: 7, sizeAttenuation: true, transparent: true, opacity: 0.98, depthWrite: false, blending: T.AdditiveBlending }));

    m.playerJacket = this.toon(0x4b161d);
    m.playerSkin = this.toon(0xb37a58);
    m.playerHair = this.toon(0x211d1a);

    m.sky = mapMat(new T.ShaderMaterial({
      uniforms: {
        topColor: { value: new T.Color(0x111b35) },
        midColor: { value: new T.Color(0x9a4f63) },
        bottomColor: { value: new T.Color(0xf0a15f) },
        sunDir: { value: new T.Vector3(0.5, 0.24, -0.8) },
        sunColor: { value: new T.Color(0xffc07a) },
        haze: { value: 0.7 },
      },
      vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform vec3 topColor; uniform vec3 midColor; uniform vec3 bottomColor; uniform vec3 sunDir; uniform vec3 sunColor; uniform float haze; varying vec3 vDir; void main(){ float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0); vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.22, h)); col = mix(col, topColor, smoothstep(0.30, 0.92, h)); float sd = max(dot(normalize(vDir), normalize(sunDir)), 0.0); col += sunColor * pow(sd, 10.0) * 0.45 * haze; col += sunColor * pow(sd, 160.0) * 1.8; float horizon = exp(-abs(vDir.y) * 7.0); col += vec3(1.0, 0.48, 0.20) * horizon * 0.16 * haze; gl_FragColor = vec4(col, 1.0); }",
      side: T.BackSide, depthWrite: false, fog: false,
    }));
  },

  buildSharedGeometry() {
    const T = window.THREE;
    this.geo = {
      box: this.sharedGeo(new T.BoxGeometry(1, 1, 1)),
      plane: this.sharedGeo(new T.PlaneGeometry(1, 1)),
      cyl: this.sharedGeo(new T.CylinderGeometry(1, 1, 1, 10)),
      cylLow: this.sharedGeo(new T.CylinderGeometry(1, 1, 1, 6)),
      tower8: this.sharedGeo(new T.CylinderGeometry(1, 1, 1, 8)),
      tower3: this.sharedGeo(new T.CylinderGeometry(1, 1, 1, 3)),
      cone: this.sharedGeo(new T.ConeGeometry(1, 1, 10)),
      cone4: this.sharedGeo(new T.ConeGeometry(1, 1, 4)),
      sphere: this.sharedGeo(new T.SphereGeometry(1, 10, 8)),
      sphereLow: this.sharedGeo(new T.SphereGeometry(1, 6, 5)),
      sphereFlat: this.sharedGeo((() => {
        const g = new T.SphereGeometry(1, 8, 6).toNonIndexed();
        g.computeVertexNormals();
        return g;
      })()),
      torus: this.sharedGeo(new T.TorusGeometry(1, 0.09, 6, 18)),
      octa: this.sharedGeo(new T.OctahedronGeometry(1, 0)),
      circle: this.sharedGeo(new T.CircleGeometry(1, 22)),
      ring: this.sharedGeo(new T.RingGeometry(0.82, 1, 22)),
      ringThin: this.sharedGeo(new T.RingGeometry(0.965, 1, 64)),
    };
  },

  mk(parent, geo, mat, x, y, z, sx, sy, sz) {
    const m = new window.THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (sx != null) m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  },

  /* ------------------------------------------------------------------ */
  buildSky() {
    const T = window.THREE;
    const g = new T.Group();
    this.skyGroup = g;
    const dome = new T.Mesh(new T.SphereGeometry(5200, 28, 18), this.mat.sky);
    dome.frustumCulled = false; dome.renderOrder = -100;
    g.add(dome);

    // 星空：北半球随机分布，夜间淡入
    const N = 900;
    const pos = new Float32Array(N * 3);
    const rnd = this.rngSeed(44591);
    for (let i = 0; i < N; i++) {
      const a = rnd() * Math.PI * 2;
      const y = 0.08 + rnd() * 0.92;
      const rad = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(a) * rad * 4600;
      pos[i * 3 + 1] = y * 4600;
      pos[i * 3 + 2] = Math.sin(a) * rad * 4600;
    }
    const sg = new T.BufferGeometry();
    sg.setAttribute("position", new T.BufferAttribute(pos, 3));
    this.starPts = new T.Points(sg, this.mat.star);
    this.starPts.frustumCulled = false;
    this.starPts.renderOrder = -95;
    this.starPts.visible = false;
    g.add(this.starPts);

    this.sunSprite = new T.Sprite(this.mat.sun);
    this.sunSprite.scale.set(620, 620, 1);
    this.sunSprite.renderOrder = -90;
    g.add(this.sunSprite);
    this.moonSprite = new T.Sprite(this.mat.moon);
    this.moonSprite.scale.set(260, 260, 1);
    this.moonSprite.renderOrder = -89;
    g.add(this.moonSprite);

    this.cloudSprites = [];
    const crnd = this.rngSeed(91211);
    for (let i = 0; i < 14; i++) {
      const s = new T.Sprite(this.mat.cloud);
      const a = crnd() * Math.PI * 2;
      const rad = 900 + crnd() * 2600;
      s.position.set(Math.cos(a) * rad, 650 + crnd() * 900, Math.sin(a) * rad);
      const sc = 520 + crnd() * 1100;
      s.scale.set(sc, sc * 0.33, 1);
      s.renderOrder = -80;
      s.userData.baseX = s.position.x;
      s.userData.baseZ = s.position.z;
      s.userData.speed = 2 + crnd() * 5;
      g.add(s);
      this.cloudSprites.push(s);
    }

    g.position.set(this.spawn.x, 0, this.spawn.y);
    this.scene.add(g);
  },

  /* ------------------------------------------------------------------ */
  buildWorld() {
    const T = window.THREE;
    this.prepareLandmarks();
    const wg = new T.Group();
    this.worldGroup = wg;
    this.scene.add(wg);
    this.buildGroundAndRoads(wg);
    this.buildSidewalks(wg);
    this.buildBuildings(wg);
    this.buildParks(wg);
    this.buildWater(wg);
    this.buildStreetLamps(wg);
    this.buildTrees(wg);
    this.buildStreetProps(wg);
    this.buildParkedCars(wg);
    this.buildSkyline(wg);
    this.buildHospitalCourtyard(wg);
    this.buildHeroStore(wg);
    this.buildCitySignature(wg);
    this.freeze(wg);
    this.freeze(this.skyGroup);
  },

  prepareLandmarks() {
    const d = MapSys.data;
    let hero = null;
    for (const b of d.buildings) if (b.hero) { hero = b; break; }
    if (!hero) {
      hero = { x: this.spawn.x + 46, y: this.spawn.y + 50, w: 64, h: 48, color: "#7b5846", height: 0.45, hero: true };
      // 保证英雄店铺落在起点公园内，不压到其他建筑
      hero.x = 206; hero.y = 210;
      d.buildings.push(hero);
    }
    this.hero = hero;
    this.heroFront = { x: hero.x + hero.w * 0.5, y: hero.y - 8 };
  },

  buildGroundAndRoads(wg) {
    const T = window.THREE, d = MapSys.data, W2 = d.worldW;
    const ground = new T.Mesh(this.geo.plane, this.mat.asphaltGround);
    ground.rotation.x = -Math.PI / 2;
    ground.scale.set(W2, W2, 1);
    ground.position.set(W2 / 2, 0, W2 / 2);
    ground.receiveShadow = true;
    wg.add(ground);

    for (const vx of d.roadsV) {
      const m = new T.Mesh(this.geo.plane, this.mat.asphaltV);
      m.rotation.x = -Math.PI / 2;
      m.scale.set(d.road, W2, 1);
      m.position.set(vx, 0.035, W2 / 2);
      m.receiveShadow = true;
      wg.add(m);
    }
    for (const hy of d.roadsH) {
      const m = new T.Mesh(this.geo.plane, this.mat.asphaltH);
      m.rotation.x = -Math.PI / 2;
      m.scale.set(W2, d.road, 1);
      m.position.set(W2 / 2, 0.04, hy);
      m.receiveShadow = true;
      wg.add(m);
    }

    const dummy = new T.Object3D();
    const centers = { x: [], z: [] };
    const whites = { x: [], z: [], sx: [], sz: [] };
    const yellow = { x: [], z: [], sx: [], sz: [] };
    const cell = d.cell, road = d.road;
    const nearCross = (v, list) => {
      for (const c of list) if (Math.abs(v - c) < road * 0.5 + 10) return true;
      return false;
    };
    for (const vx of d.roadsV) {
      for (let z = 60; z < W2 - 40; z += 62) {
        if (nearCross(z, d.roadsH)) continue;
        yellow.x.push(vx); yellow.z.push(z); yellow.sx.push(0.85); yellow.sz.push(20);
        for (const off of [-16, 16]) {
          whites.x.push(vx + off); whites.z.push(z + 22); whites.sx.push(0.38); whites.sz.push(15);
        }
      }
    }
    for (const hy of d.roadsH) {
      for (let x = 60; x < W2 - 40; x += 62) {
        if (nearCross(x, d.roadsV)) continue;
        yellow.x.push(x); yellow.z.push(hy); yellow.sx.push(20); yellow.sz.push(0.85);
        for (const off of [-16, 16]) {
          whites.x.push(x + 22); whites.z.push(hy + off); whites.sx.push(15); whites.sz.push(0.38);
        }
      }
    }
    const makeInstanced = (geo, mat, data, y, name) => {
      if (!data.x.length || !this.canInstance) return null;
      const im = new T.InstancedMesh(geo, mat, data.x.length);
      im.receiveShadow = false; im.castShadow = false;
      im.frustumCulled = false;
      for (let i = 0; i < data.x.length; i++) {
        dummy.position.set(data.x[i], y, data.z[i]);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(data.sx[i], data.sz[i], 1);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      im.userData.instanced = true;
      wg.add(im);
      return im;
    };
    makeInstanced(this.geo.plane, this.mat.laneYellow, yellow, 0.075, "lane-y");
    makeInstanced(this.geo.plane, this.mat.laneWhite, whites, 0.077, "lane-w");

    // 人行横道：每个路口四个方向各 4 条斑马线，用一个 InstancedMesh
    const cross = { x: [], z: [], sx: [], sz: [] };
    for (const vx of d.roadsV) {
      for (const hy of d.roadsH) {
        for (let k = 0; k < 4; k++) {
          if (k < 2) {
            const z = hy + (k === 0 ? -road * 0.5 - 13 : road * 0.5 + 13);
            for (let s = 0; s < 4; s++) {
              cross.x.push(vx - road * 0.5 + 9 + s * 15);
              cross.z.push(z); cross.sx.push(5.2); cross.sz.push(12.5);
            }
          } else {
            const x = vx + (k === 2 ? -road * 0.5 - 13 : road * 0.5 + 13);
            for (let s = 0; s < 4; s++) {
              cross.x.push(x);
              cross.z.push(hy - road * 0.5 + 9 + s * 15);
              cross.sx.push(12.5); cross.sz.push(5.2);
            }
          }
        }
      }
    }
    makeInstanced(this.geo.plane, this.mat.laneWhite, cross, 0.079, "crosswalk");

    // 对角线人行横道：打破每个路口都横平竖直的呆板节奏，也更符合繁华路口的混乱感。
    for (const dc of [[d.cell, d.cell], [d.cell * 2, d.cell * 2], [d.cell * 3, d.cell * 2]]) {
      const gate = new T.Group();
      gate.position.set(dc[0], 0, dc[1]);
      gate.rotation.y = Math.PI / 4;
      const stripeMat = this.canInstance ? this.mat.laneYellow : this.mat.laneWhite;
      for (let i = -3; i <= 3; i++) {
        const stripe = new T.Mesh(this.geo.plane, stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(i * 6.2, 0.082, 0);
        stripe.scale.set(2.9, 46, 1);
        stripe.castShadow = false; stripe.receiveShadow = false;
        gate.add(stripe);
      }
      wg.add(gate);
    }

    // 井盖
    const mans = { x: [], z: [], sx: [], sz: [] };
    const mr = this.rngSeed(731);
    for (let i = 0; i < 76; i++) {
      const vertical = mr() < 0.5;
      if (vertical) {
        mans.x.push(d.roadsV[Math.floor(mr() * d.roadsV.length)] + (mr() < 0.5 ? -15 : 15));
        mans.z.push(30 + mr() * (W2 - 60));
      } else {
        mans.x.push(30 + mr() * (W2 - 60));
        mans.z.push(d.roadsH[Math.floor(mr() * d.roadsH.length)] + (mr() < 0.5 ? -15 : 15));
      }
    }
    if (mans.x.length) {
      if (!this.canInstance) { this.roadDummy = dummy; return; }
      const im = new T.InstancedMesh(this.geo.cylLow, this.mat.metalDark, mans.x.length);
      for (let i = 0; i < mans.x.length; i++) {
        dummy.position.set(mans.x[i], 0.085, mans.z[i]);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1.5, 0.035, 1.5);
        dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      im.receiveShadow = true;
      wg.add(im);
    }

    // 水洼
    const pud = { x: [], z: [], s: [] };
    const pr = this.rngSeed(8887);
    for (let i = 0; i < 110; i++) {
      if (pr() < 0.55) {
        pud.x.push(d.roadsV[Math.floor(pr() * d.roadsV.length)] + (pr() < 0.5 ? -21 : 21));
        pud.z.push(24 + pr() * (W2 - 48));
      } else {
        pud.x.push(24 + pr() * (W2 - 48));
        pud.z.push(d.roadsH[Math.floor(pr() * d.roadsH.length)] + (pr() < 0.5 ? -21 : 21));
      }
      pud.s.push(5 + pr() * 11);
    }
    const pim = new T.InstancedMesh(this.geo.plane, this.mat.puddle, pud.x.length);
    for (let i = 0; i < pud.x.length; i++) {
      dummy.position.set(pud.x[i], 0.09, pud.z[i]);
      dummy.rotation.set(-Math.PI / 2, 0, pr() * Math.PI);
      dummy.scale.set(pud.s[i], pud.s[i] * (0.45 + pr() * 0.35), 1);
      dummy.updateMatrix(); pim.setMatrixAt(i, dummy.matrix);
    }
    pim.instanceMatrix.needsUpdate = true;
    pim.renderOrder = 2;
    wg.add(pim);

    this.roadDummy = dummy;
  },

  buildSidewalks(wg) {
    const T = window.THREE, d = MapSys.data, cell = d.cell, road = d.road;
    const pads = [];
    const curbs = [];
    for (let i = 0; i < CFG.WORLD.cols; i++) {
      for (let j = 0; j < CFG.WORLD.rows; j++) {
        const x0 = i * cell + road / 2;
        const y0 = j * cell + road / 2;
        const size = cell - road;
        pads.push({ x: x0 + size / 2, z: y0 + size / 2, s: size });
        curbs.push({ x: x0 + size / 2, z: y0 - 0.4, sx: size + 1.4, sz: 1.2 });
        curbs.push({ x: x0 + size / 2, z: y0 + size + 0.4, sx: size + 1.4, sz: 1.2 });
        curbs.push({ x: x0 - 0.4, z: y0 + size / 2, sx: 1.2, sz: size + 1.4 });
        curbs.push({ x: x0 + size + 0.4, z: y0 + size / 2, sx: 1.2, sz: size + 1.4 });
      }
    }
    const dummy = new T.Object3D();
    if (!this.canInstance) return;
    const padMesh = new T.InstancedMesh(this.geo.box, this.mat.pavers, pads.length);
    padMesh.receiveShadow = true; padMesh.castShadow = false;
    for (let i = 0; i < pads.length; i++) {
      dummy.position.set(pads[i].x, 0.19, pads[i].z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(pads[i].s, 0.38, pads[i].s);
      dummy.updateMatrix(); padMesh.setMatrixAt(i, dummy.matrix);
    }
    padMesh.instanceMatrix.needsUpdate = true;
    wg.add(padMesh);

    const curbMesh = new T.InstancedMesh(this.geo.box, this.mat.curb, curbs.length);
    curbMesh.receiveShadow = true;
    for (let i = 0; i < curbs.length; i++) {
      dummy.position.set(curbs[i].x, 0.26, curbs[i].z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(curbs[i].sx, 0.5, curbs[i].sz);
      dummy.updateMatrix(); curbMesh.setMatrixAt(i, dummy.matrix);
    }
    curbMesh.instanceMatrix.needsUpdate = true;
    wg.add(curbMesh);
  },

  makeBuildingGeo(b, w, h, d) {
    const T = window.THREE;
    const g = new T.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const us = 54, vs = 36;
    const scaleFace = (start, u, v) => {
      for (let i = 0; i < 4; i++) uv.setXY(start + i, uv.getX(start + i) * Math.max(1, u / us), uv.getY(start + i) * Math.max(1, v / vs));
    };
    scaleFace(0, d, h); scaleFace(4, d, h);
    scaleFace(8, w, d); scaleFace(12, w, d);
    scaleFace(16, w, h); scaleFace(20, w, h);
    uv.needsUpdate = true;
    const c = new T.Color(b.color);
    c.lerp(new T.Color(0xffffff), 0.34);
    const colors = new Float32Array(24 * 3);
    for (let i = 0; i < 24; i++) { colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
    g.setAttribute("color", new T.BufferAttribute(colors, 3));
    return g;
  },

  faceToPoint(b, tx, tz) {
    const dx = tx - (b.x + b.w / 2), dz = tz - (b.y + b.h / 2);
    if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 3 : 2;
    return dz > 0 ? 1 : 0;
  },

  chooseFace(b) {
    const cell = CFG.WORLD.cell, road = CFG.WORLD.road, margin = CFG.WORLD.margin;
    const i = Utils.clamp(Math.floor((b.x + b.w / 2) / cell), 0, CFG.WORLD.cols - 1);
    const j = Utils.clamp(Math.floor((b.y + b.h / 2) / cell), 0, CFG.WORLD.rows - 1);
    const x0 = i * cell + road / 2 + margin, x1 = (i + 1) * cell - road / 2 - margin;
    const y0 = j * cell + road / 2 + margin, y1 = (j + 1) * cell - road / 2 - margin;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const dTop = cy - y0, dBottom = y1 - cy, dLeft = cx - x0, dRight = x1 - cx;
    const m = Math.min(dTop, dBottom, dLeft, dRight);
    if (m === dTop) return 0;
    if (m === dBottom) return 1;
    if (m === dLeft) return 2;
    return 3;
  },

  faceInfo(b, face, off) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (face === 0) return { x: cx, z: b.y - off, rot: Math.PI, nx: 0, nz: -1, len: b.w };
    if (face === 1) return { x: cx, z: b.y + b.h + off, rot: 0, nx: 0, nz: 1, len: b.w };
    if (face === 2) return { x: b.x - off, z: cy, rot: -Math.PI / 2, nx: -1, nz: 0, len: b.h };
    return { x: b.x + b.w + off, z: cy, rot: Math.PI / 2, nx: 1, nz: 0, len: b.h };
  },

  addStorefront(wg, b, face, width, sidx) {
    const T = window.THREE;
    const info = this.faceInfo(b, face, 0.62);
    const w = Math.min(width, info.len - 5);
    if (w < 12) return;
    const sf = new T.Mesh(this.geo.plane, this.storefrontMats[sidx % 2]);
    sf.position.set(info.x, 4.15, info.z);
    sf.scale.set(w, 7.4, 1);
    sf.rotation.y = info.rot;
    wg.add(sf);
    const awn = new T.Mesh(this.geo.box, sidx % 2 ? this.mat.awningB : this.mat.awningA);
    awn.position.set(info.x + info.nx * 1.45, 8.25, info.z + info.nz * 1.45);
    awn.scale.set(w * 0.98, 0.34, 2.5);
    awn.rotation.y = info.rot;
    awn.castShadow = true; awn.receiveShadow = true;
    wg.add(awn);
    const sm = new T.Mesh(this.geo.plane, this.signMats[sidx % 6]);
    sm.position.set(info.x + info.nx * 0.12, 12.0, info.z + info.nz * 0.12);
    sm.scale.set(Math.min(w * 0.92, 32), 4.8, 1);
    sm.rotation.y = info.rot;
    wg.add(sm);
    const gl = new T.Mesh(this.geo.plane, this.mat.neonGlow);
    gl.position.set(info.x + info.nx * 0.2, 12.0, info.z + info.nz * 0.2);
    gl.scale.set(Math.min(w * 1.35, 44), 8.6, 1);
    gl.rotation.y = info.rot;
    gl.castShadow = false; gl.receiveShadow = false; gl.renderOrder = 3;
    wg.add(gl);
  },

  // 近景立面的消防梯、窗式空调与外挂管，让街道尺度更可信
  addFacadeDetails(wg, b, face, rnd, distSpawn) {
    if (distSpawn > 760) return;
    const T = window.THREE;
    const info = this.faceInfo(b, face, 0.55);
    const hgt = b.renderH || 22;
    const tx = Math.cos(info.rot), tz = -Math.sin(info.rot);
    const levels = Math.max(0, Math.min(2, Math.floor((hgt - 14) / 7.4)));
    if (distSpawn < 580 && hgt > 40 && info.len > 14 && levels > 0 && rnd() < 0.58) {
      if (this.facadeStats) this.facadeStats.escapes++;
      b._hasEscape = true;
      const offT = (rnd() - 0.5) * Math.max(0, info.len - 17);
      const fw = Math.min(9.5, info.len * 0.5);
      for (let l = 0; l < levels; l++) {
        const y = 13.2 + l * 7.4;
        if (y + 2.2 > hgt) break;
        const bx = info.x + info.nx * 1.5 + tx * offT;
        const bz = info.z + info.nz * 1.5 + tz * offT;
        const platform = new T.Mesh(this.geo.box, this.mat.metal);
        platform.position.set(bx, y, bz);
        platform.scale.set(fw, 0.14, 2.7);
        platform.rotation.y = info.rot;
        platform.castShadow = true; platform.receiveShadow = true; wg.add(platform);
        const rail = new T.Mesh(this.geo.box, this.mat.metalDark);
        rail.position.set(bx + info.nx * 1.35, y + 1.05, bz + info.nz * 1.35);
        rail.scale.set(fw + 0.3, 0.07, 0.07);
        rail.rotation.y = info.rot; wg.add(rail);
        for (let k = -1; k <= 1; k++) {
          const post = new T.Mesh(this.geo.box, this.mat.metalDark);
          post.position.set(bx + info.nx * 1.35 + tx * k * fw * 0.46, y + 0.52, bz + info.nz * 1.35 + tz * k * fw * 0.46);
          post.scale.set(0.07, 1.05, 0.07);
          post.rotation.y = info.rot; wg.add(post);
        }
        if (l < levels - 1) {
          const lx = offT - fw * 0.36;
          const lbx = info.x + info.nx * 1.62 + tx * lx;
          const lbz = info.z + info.nz * 1.62 + tz * lx;
          for (const side of [-0.3, 0.3]) {
            const bar = new T.Mesh(this.geo.box, this.mat.metalDark);
            bar.position.set(lbx + tx * side, y + 3.65, lbz + tz * side);
            bar.scale.set(0.07, 7.0, 0.07);
            bar.rotation.y = info.rot; wg.add(bar);
          }
          for (let rr = 0; rr < 5; rr++) {
            const rung = new T.Mesh(this.geo.box, this.mat.metalDark);
            rung.position.set(lbx, y + 1.15 + rr * 1.18, lbz);
            rung.scale.set(0.68, 0.06, 0.06);
            rung.rotation.y = info.rot; wg.add(rung);
          }
        }
      }
    }
    if (distSpawn < 780 && info.len > 13 && hgt > 25) {
      const n = 2 + Math.floor(rnd() * 3);
      if (this.facadeStats) this.facadeStats.acs += n;
      for (let i = 0; i < n; i++) {
        const y = 15.5 + rnd() * Math.max(3, hgt - 23);
        const off = (rnd() - 0.5) * Math.max(1, info.len - 6);
        const ux = info.x + info.nx * 0.95 + tx * off;
        const uz = info.z + info.nz * 0.95 + tz * off;
        const unit = new T.Mesh(this.geo.box, this.mat.metal);
        unit.position.set(ux, y, uz);
        unit.scale.set(1.7, 1.05, 0.9);
        unit.rotation.y = info.rot;
        unit.castShadow = true; unit.receiveShadow = true; wg.add(unit);
        const grille = new T.Mesh(this.geo.box, this.mat.metalDark);
        grille.position.set(ux + info.nx * 0.48, y, uz + info.nz * 0.48);
        grille.scale.set(1.35, 0.72, 0.06);
        grille.rotation.y = info.rot; wg.add(grille);
        const pipe = new T.Mesh(this.geo.box, this.mat.metalDark);
        pipe.position.set(ux - tx * 1.02, y - 1.9, uz - tz * 1.02);
        pipe.scale.set(0.08, 3.8, 0.08);
        pipe.rotation.y = info.rot; wg.add(pipe);
      }
    }
  },

  buildBuildings(wg) {
    const T = window.THREE, d = MapSys.data;
    const base = 0.35;
    for (let bi = 0; bi < d.buildings.length; bi++) {
      const b = d.buildings[bi];
      const hgt = b.hero ? 21 : (22 + b.height * 44);
      b.renderH = hgt;
      const distSpawn = Utils.dist(b.x + b.w / 2, b.y + b.h / 2, this.spawn.x, this.spawn.y);
      const shapeRnd = this.rngSeed(Math.floor(b.x * 23 + b.y * 13 + b.w * 19 + b.h * 7));
      // 少量街区塔楼改成八边形/三角形平面，底层保留矩形骑楼，保证店面和碰撞仍按原 AABB 工作。
      const roundStyle = (!b.hero && distSpawn < 980 && hgt > 40 && shapeRnd() < 0.20)
        ? (shapeRnd() < 0.42 ? 3 : 8) : 0;
      const fm = this.facadeMats[(Math.floor(b.x * 0.07) + Math.floor(b.y * 0.11)) & 3];
      let body;
      if (roundStyle) {
        const podiumH = Math.min(18, Math.max(9, hgt * 0.30));
        const podiumGeo = this.makeBuildingGeo(b, b.w, podiumH, b.h);
        body = new T.Mesh(podiumGeo, fm);
        body.position.set(b.x + b.w / 2, base + podiumH / 2, b.y + b.h / 2);
        body.castShadow = true; body.receiveShadow = true;
        wg.add(body);
        const towerH = hgt - podiumH;
        const towerR = Math.min(b.w, b.h) * (roundStyle === 3 ? 0.58 : 0.51);
        const tower = new T.Mesh(roundStyle === 3 ? this.geo.tower3 : this.geo.tower8, fm);
        tower.position.set(b.x + b.w / 2, base + podiumH + towerH / 2, b.y + b.h / 2);
        tower.scale.set(towerR, towerH, towerR);
        tower.rotation.y = shapeRnd() * Math.PI;
        tower.castShadow = true; tower.receiveShadow = true;
        wg.add(tower);
        const crown = new T.Mesh(this.geo.cyl, this.mat.trimDark);
        crown.position.set(b.x + b.w / 2, base + hgt + 0.55, b.y + b.h / 2);
        crown.scale.set(towerR * 1.06, 0.55, towerR * 1.06);
        wg.add(crown);
        const halo = new T.Mesh(this.geo.ringThin, this.mat.neonCyan);
        halo.rotation.x = -Math.PI / 2;
        halo.position.set(b.x + b.w / 2, base + hgt + 0.88, b.y + b.h / 2);
        halo.scale.set(towerR * 1.02, towerR * 1.02, 1);
        halo.castShadow = false; halo.receiveShadow = false;
        wg.add(halo);
      } else {
        const geo = this.makeBuildingGeo(b, b.w, hgt, b.h);
        body = new T.Mesh(geo, fm);
        body.position.set(b.x + b.w / 2, base + hgt / 2, b.y + b.h / 2);
        body.castShadow = true; body.receiveShadow = true;
        wg.add(body);
        // 出生点附近建筑加一层背面扩张壳，勾出卡通轮廓（远处省略以控制开销）。
        if (distSpawn < 520) {
          const hull = new T.Mesh(this.geo.box, this.mat.hull);
          hull.position.copy(body.position);
          hull.scale.set(b.w + 1.1, hgt + 1.1, b.h + 1.1);
          wg.add(hull);
        }
        const roof = new T.Mesh(this.geo.box, this.mat.roof);
        roof.position.set(b.x + b.w / 2, base + hgt + 0.32, b.y + b.h / 2);
        roof.scale.set(b.w + 1.4, 0.64, b.h + 1.4);
        roof.castShadow = true; roof.receiveShadow = true;
        wg.add(roof);

        // 退台式冠部：建筑不再全部是同一个方盒高度，远景和天际线有了多个层次。
        if (!b.hero && distSpawn < 1120 && hgt > 38) {
          const cr = this.rngSeed(Math.floor(b.x * 31 + b.y * 17 + b.w * 5));
          if (cr() < 0.58) {
            const tierH = 4.5 + cr() * 8.5;
            const tierW = b.w * (0.58 + cr() * 0.22);
            const tierD = b.h * (0.58 + cr() * 0.22);
            const tGeo = this.makeBuildingGeo(b, tierW, tierH, tierD);
            const tier = new T.Mesh(tGeo, fm);
            tier.position.set(b.x + b.w / 2, base + hgt + tierH / 2, b.y + b.h / 2);
            tier.rotation.y = (cr() - 0.5) * 0.42;
            tier.castShadow = true; tier.receiveShadow = true;
            wg.add(tier);
            const cap = new T.Mesh(this.geo.box, this.mat.roof);
            cap.position.set(tier.position.x, base + hgt + tierH + 0.28, tier.position.z);
            cap.rotation.y = tier.rotation.y;
            cap.scale.set(tierW + 1.0, 0.5, tierD + 1.0);
            wg.add(cap);
            if (hgt > 52 && cr() < 0.62) {
              const spire = new T.Mesh(this.geo.cylLow, this.mat.metalDark);
              spire.position.set(tier.position.x, base + hgt + tierH + 3.0, tier.position.z);
              spire.scale.set(0.24, 5.6, 0.24);
              wg.add(spire);
              const tip = new T.Mesh(this.geo.sphereLow, cr() < 0.5 ? this.mat.neonPink : this.mat.neonCyan);
              tip.position.set(tier.position.x, base + hgt + tierH + 5.9, tier.position.z);
              tip.scale.setScalar(0.48); tip.castShadow = false; wg.add(tip);
            }
            if (distSpawn < 760) {
              const ring = new T.Mesh(this.geo.ringThin, cr() < 0.5 ? this.mat.neonPink : this.mat.neonCyan);
              ring.rotation.x = -Math.PI / 2;
              ring.position.set(tier.position.x, base + hgt + tierH + 0.58, tier.position.z);
              ring.scale.set(tierW * 0.52, tierD * 0.52, 1);
              ring.castShadow = false; ring.receiveShadow = false;
              wg.add(ring);
            }
          }
        }
      }
      const r = this.rngSeed(Math.floor(b.x * 17 + b.y * 7 + b.w * 11));
      // 屋顶空调/水箱/天线
      const ac = new T.Mesh(this.geo.box, this.mat.metal);
      ac.position.set(b.x + 6 + r() * Math.max(1, b.w - 14), base + hgt + 2.0, b.y + 6 + r() * Math.max(1, b.h - 14));
      ac.scale.set(5 + r() * 4, 2.8 + r() * 2, 4 + r() * 4);
      ac.castShadow = true; ac.receiveShadow = true; wg.add(ac);
      if (r() < 0.62) {
        const vent = new T.Mesh(this.geo.cyl, this.mat.metalDark);
        vent.position.set(b.x + 6 + r() * Math.max(1, b.w - 12), base + hgt + 3.0, b.y + 6 + r() * Math.max(1, b.h - 12));
        vent.scale.set(1.1, 4.5, 1.1);
        vent.castShadow = true; wg.add(vent);
      }
      if (hgt > 58 && r() < 0.42) {
        const tank = new T.Mesh(this.geo.cyl, this.mat.woodDark);
        tank.position.set(b.x + 8 + r() * Math.max(1, b.w - 16), base + hgt + 5.3, b.y + 8 + r() * Math.max(1, b.h - 16));
        tank.scale.set(3.1, 6.2, 3.1);
        tank.castShadow = true; wg.add(tank);
        const cap = new T.Mesh(this.geo.cone, this.mat.metalDark);
        cap.position.copy(tank.position); cap.position.y += 3.9;
        cap.scale.set(3.3, 2.0, 3.3); wg.add(cap);
      }
      if (!b.hero && r() < 0.55) {
        const ant = new T.Mesh(this.geo.cylLow, this.mat.metalDark);
        ant.position.set(b.x + 3 + r() * Math.max(1, b.w - 6), base + hgt + 6.2, b.y + 3 + r() * Math.max(1, b.h - 6));
        ant.scale.set(0.16, 9.5, 0.16); wg.add(ant);
      }
      // 高楼顶部的红色航空障碍灯，夜间缓慢闪烁
      if (!b.hero && hgt > 60) {
        const br = this.rngSeed(Math.floor(b.x * 13 + b.y * 19 + b.w * 3));
        if (br() < 0.5) {
          const beacon = new T.Sprite(this.mat.glowRed);
          beacon.position.set(b.x + b.w * 0.5, base + hgt + 3.4, b.y + b.h * 0.5);
          beacon.scale.set(7.5, 7.5, 1);
          beacon.userData.phase = br() * 12;
          wg.add(beacon);
          this.beacons.push(beacon);
        }
      }

      if (!b.hero) {
        // 出生点附近的店面朝向广场，让玩家第一眼看到成排亮着的橱窗，而不是建筑背面。
        const face = distSpawn < 460 ? this.faceToPoint(b, this.spawn.x, this.spawn.y) : this.chooseFace(b);
        const info = this.faceInfo(b, face, 0);
        const srnd = this.rngSeed(Math.floor(b.x * 3 + b.y * 5 + b.w));
        if (srnd() < 0.42 || distSpawn < 620) {
          const width = Math.min(info.len - 6, 16 + srnd() * 24);
          this.addStorefront(wg, b, face, width, Math.floor(srnd() * 6));
        }
        if (!roundStyle) this.addFacadeDetails(wg, b, face, srnd, distSpawn);
        // 竖向霓虹边条和阳台：把立面从一块平面墙切成有尺度的街墙。
        if (!roundStyle && distSpawn < 760) {
          const tx = Math.cos(info.rot), tz = -Math.sin(info.rot);
          for (const side of [-1, 1]) {
            const strip = new T.Mesh(this.geo.box, srnd() < 0.5 ? this.mat.neonCyan : this.mat.neonPink);
            strip.position.set(
              info.x + info.nx * 0.22 + tx * side * Math.max(2, info.len * 0.38),
              9 + hgt * 0.36,
              info.z + info.nz * 0.22 + tz * side * Math.max(2, info.len * 0.38)
            );
            strip.scale.set(0.16, Math.max(4, hgt * 0.55), 0.16);
            strip.rotation.y = info.rot;
            strip.castShadow = false; strip.receiveShadow = false;
            wg.add(strip);
          }
          if (distSpawn < 480 && hgt > 34 && srnd() < 0.58) {
            const tx2 = Math.cos(info.rot), tz2 = -Math.sin(info.rot);
            for (let l = 0; l < 3; l++) {
              const y = 13.5 + l * 7.0;
              if (y + 1.4 > hgt) break;
              const platform = new T.Mesh(this.geo.box, this.mat.metalDark);
              platform.position.set(info.x + info.nx * 1.8, y, info.z + info.nz * 1.8);
              platform.scale.set(Math.max(8, info.len * 0.48), 0.14, 2.1);
              platform.rotation.y = info.rot;
              wg.add(platform);
              const rail = new T.Mesh(this.geo.box, this.mat.metal);
              rail.position.set(info.x + info.nx * 2.8, y + 0.62, info.z + info.nz * 2.8);
              rail.scale.set(Math.max(8, info.len * 0.48), 0.06, 0.06);
              rail.rotation.y = info.rot;
              wg.add(rail);
              for (const sh of [-0.42, 0.42]) {
                const post = new T.Mesh(this.geo.box, this.mat.metalDark);
                post.position.set(
                  info.x + info.nx * 2.8 + tx2 * info.len * sh,
                  y + 0.32,
                  info.z + info.nz * 2.8 + tz2 * info.len * sh
                );
                post.scale.set(0.07, 0.64, 0.07);
                post.rotation.y = info.rot;
                wg.add(post);
              }
            }
          }
        }
        if (!roundStyle && srnd() < (distSpawn < 460 ? 0.55 : 0.30)) {
          const vin = this.faceInfo(b, face, 0.7);
          const vp = new T.Mesh(this.geo.plane, this.mat.verticalSign);
          vp.position.set(vin.x, 17 + srnd() * 14, vin.z);
          vp.scale.set(5.2, 22, 1);
          vp.rotation.y = vin.rot;
          wg.add(vp);
          const vg = new T.Mesh(this.geo.plane, this.mat.neonGlow);
          vg.position.set(vin.x + vin.nx * 0.1, vp.position.y, vin.z + vin.nz * 0.1);
          vg.scale.set(9, 27, 1); vg.rotation.y = vin.rot;
          vg.castShadow = false; vg.receiveShadow = false; vg.renderOrder = 3;
          wg.add(vg);
          // 霓虹在湿地面上的一层粉色倒影
          const pool = new T.Mesh(this.geo.plane, this.mat.wetNeon);
          pool.rotation.x = -Math.PI / 2;
          pool.rotation.z = (face === 0 || face === 1) ? 0 : Math.PI / 2;
          pool.position.set(vin.x + vin.nx * 3.2, 0.435, vin.z + vin.nz * 3.2);
          pool.scale.set(4.2, 11, 1);
          pool.castShadow = false; pool.receiveShadow = false; pool.renderOrder = 2;
          wg.add(pool);
        }
        if (hgt > 62 && srnd() < 0.16) {
          const binfo = this.faceInfo(b, face, 0.9);
          const bw = Math.min(22, info.len * 0.55);
          const board = new T.Mesh(this.geo.plane, this.mat.billboard);
          board.position.set(binfo.x, base + hgt + 8.5, binfo.z);
          board.scale.set(bw, bw * 0.5, 1);
          board.rotation.y = binfo.rot;
          wg.add(board);
          const postGeo = this.geo.box;
          for (const side of [-1, 1]) {
            const post = new T.Mesh(postGeo, this.mat.metalDark);
            post.position.set(binfo.x + Math.cos(binfo.rot) * side * bw * 0.35, base + hgt + 4.2, binfo.z - Math.sin(binfo.rot) * side * bw * 0.35);
            post.scale.set(0.4, 8.5, 0.4); wg.add(post);
          }
        }
        if (srnd() < 0.09) {
          const ginfo = this.faceInfo(b, face === 0 ? 2 : 0, 0.68);
          const gr = new T.Mesh(this.geo.plane, this.mat.graffiti);
          gr.position.set(ginfo.x, 6.5, ginfo.z);
          gr.scale.set(Math.min(22, ginfo.len * 0.6), 8, 1);
          gr.rotation.y = ginfo.rot;
          wg.add(gr);
        }
        // 近景屋顶霓虹压边，给轮廓补一层赛博颜色
        if (distSpawn < 760) {
          const einfo = this.faceInfo(b, face, 0.45);
          const strip = new T.Mesh(this.geo.box, (srnd() < 0.5 ? this.mat.neonCyan : this.mat.neonPink));
          strip.position.set(einfo.x, base + hgt + 0.55, einfo.z);
          strip.scale.set(Math.max(10, einfo.len - 6), 0.22, 0.22);
          strip.rotation.y = einfo.rot;
          wg.add(strip);
        }
      }
    }
  },

  buildParks(wg) {
    const T = window.THREE, d = MapSys.data;
    for (let pi = 0; pi < d.parks.length; pi++) {
      const p = d.parks[pi];
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      const grass = new T.Mesh(this.geo.plane, this.mat.grass);
      grass.rotation.x = -Math.PI / 2;
      grass.scale.set(p.w, p.h, 1);
      grass.position.set(cx, 0.39, cy);
      grass.receiveShadow = true;
      wg.add(grass);
      const pathMat = this.mat.pavers;
      const px = new T.Mesh(this.geo.plane, pathMat);
      px.rotation.x = -Math.PI / 2; px.scale.set(p.w, 9, 1); px.position.set(cx, 0.407, cy);
      wg.add(px);
      const pz = new T.Mesh(this.geo.plane, pathMat);
      pz.rotation.x = -Math.PI / 2; pz.scale.set(9, p.h, 1); pz.position.set(cx, 0.409, cy);
      wg.add(pz);
      // 对角步道 + 圆形小广场：绿地不再只是两条正交十字路。
      const dg = new T.Group();
      dg.position.set(cx, 0, cy);
      dg.rotation.y = Math.PI / 4;
      const dp = new T.Mesh(this.geo.plane, pathMat);
      dp.rotation.x = -Math.PI / 2; dp.position.y = 0.411;
      dp.scale.set(p.w * 0.94, 7.5, 1); dp.receiveShadow = true;
      dg.add(dp);
      wg.add(dg);
      if (pi % 3 === 1) {
        const plaza = new T.Mesh(this.geo.circle, pathMat);
        plaza.rotation.x = -Math.PI / 2; plaza.position.set(cx - p.w * 0.22, 0.413, cy + p.h * 0.22);
        plaza.scale.set(13, 13, 1); wg.add(plaza);
        const ring = new T.Mesh(this.geo.ringThin, this.mat.stoneDark);
        ring.rotation.x = -Math.PI / 2; ring.position.set(cx - p.w * 0.22, 0.416, cy + p.h * 0.22);
        ring.scale.set(13.2, 13.2, 1); wg.add(ring);
        this.addBench(wg, cx - p.w * 0.35, cy + p.h * 0.05, Math.PI / 4);
        this.addBench(wg, cx - p.w * 0.08, cy + p.h * 0.35, -Math.PI / 4);
      }
      if (pi < 5 && pi !== 0) {
        this.buildGazebo(wg, cx + (pi % 2 ? 24 : -24), cy + (pi % 3 ? -22 : 20));
      }
    }
    // 公园 1,0 是市区另一块绿地，加一个醒目的鸟居入口
    const p1 = d.parks[1];
    if (p1) this.buildTorii(wg, p1.x + p1.w / 2, p1.y + 20);
  },

  buildGazebo(wg, x, z) {
    const T = window.THREE;
    const g = new T.Group();
    g.position.set(x, 0.42, z);
    const base = new T.Mesh(this.geo.cylinder || this.geo.cyl, this.mat.stone);
    base.position.y = 0.35; base.scale.set(9, 0.7, 9); base.receiveShadow = true; g.add(base);
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + Math.PI / 4;
      const col = new T.Mesh(this.geo.cyl, this.mat.vermilion);
      col.position.set(Math.cos(a) * 6.2, 4.2, Math.sin(a) * 6.2);
      col.scale.set(0.42, 7.5, 0.42); col.castShadow = true; g.add(col);
    }
    const roof = new T.Mesh(this.geo.cone4, this.mat.shrineRoof);
    roof.position.y = 9.2; roof.scale.set(9.6, 4.4, 9.6); roof.rotation.y = Math.PI / 4;
    roof.castShadow = true; g.add(roof);
    const finial = new T.Mesh(this.geo.octa, this.mat.vermilion);
    finial.position.y = 12.2; finial.scale.setScalar(1.1); g.add(finial);
    const lamp = new T.Mesh(this.geo.sphereLow, this.mat.headlight);
    lamp.position.set(0, 6.4, 0); lamp.scale.setScalar(0.8); g.add(lamp);
    const glow = new T.Sprite(this.mat.glowWarm);
    glow.position.set(0, 6.4, 0); glow.scale.set(9, 9, 1); g.add(glow);
    wg.add(g);
  },

  buildTorii(wg, x, z) {
    const T = window.THREE;
    const g = new T.Group();
    g.position.set(x, 0.42, z);
    for (const sx of [-1, 1]) {
      const col = new T.Mesh(this.geo.cyl, this.mat.vermilion);
      col.position.set(sx * 10, 6, 0); col.scale.set(1.1, 12, 1.1); col.castShadow = true; g.add(col);
      const foot = new T.Mesh(this.geo.box, this.mat.stoneDark);
      foot.position.set(sx * 10, 0.5, 0); foot.scale.set(3, 1, 3); g.add(foot);
    }
    const top = new T.Mesh(this.geo.box, this.mat.vermilion);
    top.position.y = 12.2; top.scale.set(28, 1.1, 2.2); top.castShadow = true; g.add(top);
    const roof = new T.Mesh(this.geo.box, this.mat.shrineRoof);
    roof.position.y = 13.0; roof.scale.set(31, 0.9, 3.2); g.add(roof);
    const plate = new T.Mesh(this.geo.box, this.mat.vermilion);
    plate.position.y = 9.6; plate.scale.set(4, 3.5, 0.8); g.add(plate);
    wg.add(g);
  },

  buildWater(wg) {
    const T = window.THREE, d = MapSys.data;
    for (const w of d.water) {
      const cx = w.x + w.w / 2, cz = w.y + w.h / 2;
      const water = new T.Mesh(this.geo.plane, this.mat.water);
      water.rotation.x = -Math.PI / 2;
      water.scale.set(w.w, w.h, 1);
      water.position.set(cx, 0.42, cz);
      water.receiveShadow = false;
      wg.add(water);
      const rim = new T.Mesh(this.geo.box, this.mat.stone);
      const t = 1.4;
      rim.position.set(cx, 0.48, w.y - t / 2); rim.scale.set(w.w + t * 2, 0.7, t); wg.add(rim);
      const rim2 = rim.clone(); rim2.position.z = w.y + w.h + t / 2; wg.add(rim2);
      const rim3 = new T.Mesh(this.geo.box, this.mat.stone);
      rim3.position.set(w.x - t / 2, 0.48, cz); rim3.scale.set(t, 0.7, w.h); wg.add(rim3);
      const rim4 = rim3.clone(); rim4.position.x = w.x + w.w + t / 2; wg.add(rim4);
    }
  },

  buildStreetLamps(wg) {
    const T = window.THREE, d = MapSys.data;
    for (const lp of d.lamps) {
      const g = new T.Group();
      g.position.set(lp.x, 0.38, lp.y);
      const pole = new T.Mesh(this.geo.cyl, this.mat.metalDark);
      pole.position.y = 4.6; pole.scale.set(0.26, 9.2, 0.26);
      pole.castShadow = true; g.add(pole);
      const arm = new T.Mesh(this.geo.box, this.mat.metalDark);
      arm.position.set(-2.6, 8.7, 0); arm.scale.set(5.2, 0.24, 0.24); arm.castShadow = true; g.add(arm);
      const head = new T.Mesh(this.geo.box, this.mat.headlight);
      head.position.set(-5.0, 8.52, 0); head.scale.set(1.9, 0.32, 0.8); g.add(head);
      const glow = new T.Sprite(this.mat.glowWarm);
      glow.position.set(-5.0, 8.45, 0); glow.scale.set(8.5, 8.5, 1);
      glow.renderOrder = 4; g.add(glow);
      wg.add(g);
    }
  },

  addTree(wg, x, z, r, cherry) {
    const T = window.THREE;
    const g = new T.Group();
    g.position.set(x, 0.4, z);
    const trunk = new T.Mesh(this.geo.cylLow, this.mat.trunk);
    trunk.position.y = 2.7; trunk.scale.set(Math.max(0.38, r * 0.055), 5.4, Math.max(0.38, r * 0.055));
    trunk.castShadow = true; g.add(trunk);
    const branch = new T.Mesh(this.geo.cylLow, this.mat.trunk);
    branch.position.set(r * 0.05, 5.6, 0); branch.scale.set(Math.max(0.16, r * 0.026), 3.2, Math.max(0.16, r * 0.026));
    branch.rotation.z = 0.42; branch.castShadow = true; g.add(branch);
    const leaf = cherry ? this.mat.cherry : ((x + z) % 2 < 1 ? this.mat.leafA : this.mat.leafB);
    const leaf2 = cherry ? this.mat.cherryLight : this.mat.leafB;
    const c1 = new T.Mesh(this.geo.sphereFlat, leaf);
    c1.position.set(0, 7.15, 0); c1.scale.set(r * 0.44, r * 0.30, r * 0.42);
    c1.castShadow = true; g.add(c1);
    const c2 = new T.Mesh(this.geo.sphereFlat, leaf2);
    c2.position.set(r * 0.28, 8.0, -r * 0.16); c2.scale.set(r * 0.30, r * 0.26, r * 0.28);
    c2.castShadow = true; g.add(c2);
    const c3 = new T.Mesh(this.geo.sphereFlat, leaf);
    c3.position.set(-r * 0.27, 7.0, r * 0.18); c3.scale.set(r * 0.28, r * 0.24, r * 0.30);
    c3.castShadow = true; g.add(c3);
    if (r > 9) {
      const c4 = new T.Mesh(this.geo.sphereFlat, leaf2);
      c4.position.set(-r * 0.05, 8.7, -r * 0.05); c4.scale.set(r * 0.22, r * 0.20, r * 0.22);
      c4.castShadow = true; g.add(c4);
    }
    const sh = new T.Mesh(this.geo.plane, this.mat.shadow);
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012; sh.scale.set(r * 1.15, r * 1.15, 1);
    sh.renderOrder = 2; g.add(sh);
    if (cherry) {
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + r * 0.17;
        const petal = new T.Mesh(this.geo.circle, this.mat.cherryLight);
        petal.rotation.x = -Math.PI / 2;
        petal.position.set(Math.cos(a) * (r * 0.28), 0.008, Math.sin(a) * (r * 0.28));
        const ps = 1.4 + (i % 3) * 0.8;
        petal.scale.set(ps, ps * 0.65, 1);
        g.add(petal);
      }
    }
    wg.add(g);
    return g;
  },

  buildTrees(wg) {
    const T = window.THREE, d = MapSys.data;
    for (const t of d.trees) {
      if (Utils.dist(t.x, t.y, this.spawn.x, this.spawn.y) < 88) continue;
      if (this.hero && Utils.dist(t.x, t.y, this.hero.x + this.hero.w / 2, this.hero.y + this.hero.h / 2) < 68) continue;
      this.addTree(wg, t.x, t.y, t.r, (t.x + t.y) < 620);
    }
    // 人行道行道树：每个街区选一个角落，避开建筑与水面
    const cell = d.cell, road = d.road;
    for (let i = 0; i < CFG.WORLD.cols; i++) {
      for (let j = 0; j < CFG.WORLD.rows; j++) {
        const r = this.rngSeed(i * 131 + j * 977 + 17);
        if (r() > 0.52) continue;
        const x0 = i * cell + road / 2;
        const y0 = j * cell + road / 2;
        const side = Math.floor(r() * 4);
        let x, z;
        if (side === 0) { x = x0 + 10 + r() * 40; z = y0 + 7; }
        else if (side === 1) { x = x0 + (cell - road) - 7; z = y0 + 10 + r() * 40; }
        else if (side === 2) { x = x0 + 10 + r() * 40; z = y0 + (cell - road) - 7; }
        else { x = x0 + 7; z = y0 + 10 + r() * 40; }
        if (MapSys.isBlocked(x, z)) continue;
        if (Utils.dist(x, z, this.spawn.x, this.spawn.y) < 70) continue;
        if (this.hero && x > this.hero.x - 14 && x < this.hero.x + this.hero.w + 14 &&
            z > this.hero.y - 14 && z < this.hero.y + this.hero.h + 14) continue;
        this.addTree(wg, x, z, 7 + r() * 4, false);
      }
    }
  },

  addBench(wg, x, z, rot, parent) {
    const T = window.THREE;
    const g = new T.Group();
    g.position.set(x, 0.42, z); g.rotation.y = rot || 0;
    const seat = new T.Mesh(this.geo.box, this.mat.wood);
    seat.position.y = 1.45; seat.scale.set(6.8, 0.36, 2.1); seat.castShadow = true; g.add(seat);
    const back = new T.Mesh(this.geo.box, this.mat.woodDark);
    back.position.set(0, 2.5, -0.82); back.scale.set(6.8, 1.8, 0.28); back.castShadow = true; g.add(back);
    for (const sx of [-2.5, 2.5]) {
      const leg = new T.Mesh(this.geo.box, this.mat.metalDark);
      leg.position.set(sx, 0.72, 0); leg.scale.set(0.28, 1.4, 1.5); g.add(leg);
    }
    (parent || wg).add(g);
    return g;
  },

  addBin(wg, x, z) {
    const T = window.THREE;
    const b = new T.Mesh(this.geo.cylLow, this.mat.bin);
    b.position.set(x, 1.6, z); b.scale.set(1.0, 2.4, 1.0); b.castShadow = true; wg.add(b);
    const lid = new T.Mesh(this.geo.cylLow, this.mat.metalDark);
    lid.position.set(x, 2.9, z); lid.scale.set(1.15, 0.22, 1.15); wg.add(lid);
  },

  addHydrant(wg, x, z) {
    const T = window.THREE;
    const body = new T.Mesh(this.geo.cyl, this.mat.hydrant);
    body.position.set(x, 1.15, z); body.scale.set(0.6, 1.7, 0.6); body.castShadow = true; wg.add(body);
    const cap = new T.Mesh(this.geo.sphere, this.mat.hydrant);
    cap.position.set(x, 2.1, z); cap.scale.set(0.66, 0.5, 0.66); wg.add(cap);
    const arm = new T.Mesh(this.geo.box, this.mat.redArm || this.mat.trafficRed);
    arm.position.set(x, 1.5, z); arm.scale.set(1.6, 0.3, 0.3); wg.add(arm);
  },

  addPlanter(wg, x, z) {
    const T = window.THREE;
    const box = new T.Mesh(this.geo.box, this.mat.stoneDark);
    box.position.set(x, 0.85, z); box.scale.set(4.2, 1.2, 4.2); box.castShadow = true; wg.add(box);
    const bush = new T.Mesh(this.geo.sphereLow, this.mat.leafA);
    bush.position.set(x, 2.1, z); bush.scale.set(2.2, 1.6, 2.2); bush.castShadow = true; wg.add(bush);
    const flower = new T.Mesh(this.geo.sphereLow, this.mat.cherry);
    flower.position.set(x + 0.8, 2.9, z - 0.4); flower.scale.setScalar(0.8); wg.add(flower);
  },

  addVending(wg, x, z, rot) {
    const T = window.THREE;
    const v = new T.Mesh(this.geo.box, this.mat.vending);
    v.position.set(x, 2.9, z); v.scale.set(3.4, 5.8, 2.1); v.rotation.y = rot || 0;
    v.castShadow = true; v.receiveShadow = true; wg.add(v);
    const glow = new T.Mesh(this.geo.plane, this.mat.neonGlow);
    glow.position.set(x + Math.sin(rot || 0) * 0.9, 2.9, z + Math.cos(rot || 0) * 0.9);
    glow.scale.set(7, 7, 1); glow.rotation.y = rot || 0;
    glow.castShadow = false; glow.receiveShadow = false; glow.renderOrder = 3;
    wg.add(glow);
  },

  addTrafficLight(wg, x, z, rot) {
    const T = window.THREE;
    const g = new T.Group();
    g.position.set(x, 0.42, z); g.rotation.y = rot || 0;
    const pole = new T.Mesh(this.geo.cyl, this.mat.metalDark);
    pole.position.y = 5.4; pole.scale.set(0.22, 10.8, 0.22); pole.castShadow = true; g.add(pole);
    const arm = new T.Mesh(this.geo.box, this.mat.metalDark);
    arm.position.set(3.2, 9.9, 0); arm.scale.set(6.4, 0.22, 0.22); g.add(arm);
    const box = new T.Mesh(this.geo.box, this.mat.trafficBody);
    box.position.set(6.2, 9.8, 0); box.scale.set(1.15, 3.0, 1.15); box.castShadow = true; g.add(box);
    const cols = [this.mat.trafficRed, this.mat.trafficYellow, this.mat.trafficGreen];
    for (let i = 0; i < 3; i++) {
      const lamp = new T.Mesh(this.geo.sphereLow, cols[i]);
      lamp.position.set(6.2, 10.65 - i * 0.92, 0.62); lamp.scale.set(0.28, 0.28, 0.16); g.add(lamp);
    }
    wg.add(g);
  },

  buildStreetProps(wg) {
    const T = window.THREE, d = MapSys.data, cell = d.cell, road = d.road;
    const size = cell - road;
    for (let i = 0; i < CFG.WORLD.cols; i++) {
      for (let j = 0; j < CFG.WORLD.rows; j++) {
        const r = this.rngSeed(i * 709 + j * 313 + 71);
        const x0 = i * cell + road / 2, y0 = j * cell + road / 2;
        if (r() < 0.58) {
          const side = Math.floor(r() * 4);
          let x, z, rot;
          if (side === 0) { x = x0 + 14 + r() * (size - 28); z = y0 + 7; rot = 0; }
          else if (side === 1) { x = x0 + size - 7; z = y0 + 14 + r() * (size - 28); rot = Math.PI / 2; }
          else if (side === 2) { x = x0 + 14 + r() * (size - 28); z = y0 + size - 7; rot = Math.PI; }
          else { x = x0 + 7; z = y0 + 14 + r() * (size - 28); rot = -Math.PI / 2; }
          if (MapSys.isBlocked(x, z)) { /* 人行道被建筑/水面占用则跳过 */ }
          else {
            const pick = r();
            if (pick < 0.3) this.addBench(wg, x, z, rot);
            else if (pick < 0.58) this.addBin(wg, x, z);
            else if (pick < 0.78) this.addHydrant(wg, x, z);
            else if (pick < 0.92) this.addPlanter(wg, x, z);
            else this.addVending(wg, x, z, rot);
          }
        }
      }
    }
    // 公交站与候车亭（英雄店铺同街区路边）
    const bx = this.hero.x + this.hero.w + 14, bz = this.hero.y + this.hero.h * 0.5;
    if (!MapSys.isBlocked(bx, bz)) {
      const g = new T.Group(); g.position.set(bx, 0.42, bz);
      const roof = new T.Mesh(this.geo.box, this.mat.metalDark);
      roof.position.y = 5.6; roof.scale.set(12, 0.35, 4.4); roof.castShadow = true; g.add(roof);
      for (const z of [-1.7, 1.7]) {
        const post = new T.Mesh(this.geo.cyl, this.mat.metal);
        post.position.set(-4.6, 2.8, z); post.scale.set(0.16, 5.2, 0.16); g.add(post);
      }
      const back = new T.Mesh(this.geo.box, this.mat.glass);
      back.position.set(4.2, 2.7, 0); back.scale.set(0.25, 4.6, 4.0); g.add(back);
      const bench = new T.Mesh(this.geo.box, this.mat.wood);
      bench.position.set(2.8, 1.5, 0); bench.scale.set(2.2, 0.3, 6); g.add(bench);
      wg.add(g);
    }
    // 主要路口红绿灯
    for (const [ii, jj] of [[1, 1], [2, 1], [1, 2], [2, 2], [3, 3], [4, 4]]) {
      const x = ii * cell - road / 2 - 8;
      const z = jj * cell - road / 2 - 8;
      this.addTrafficLight(wg, x, z, Math.PI);
    }
    // 电线：一条 LineSegments，给街道加一点凌乱的城市感
    const linePos = [];
    for (let j = 1; j < CFG.WORLD.rows; j += 3) {
      const z = j * cell + road / 2 + 7;
      for (let x = cell; x < d.worldW - cell; x += cell * 2) {
        linePos.push(x, 11.5, z, x + cell * 2, 12.2, z);
      }
    }
    if (linePos.length) {
      const lg = new T.BufferGeometry();
      lg.setAttribute("position", new T.Float32BufferAttribute(linePos, 3));
      const lines = new T.LineSegments(lg, this.mat.wire);
      wg.add(lines);
    }
  },

  buildParkedCars(wg) {
    const T = window.THREE;
    const list = [
      { type: "taxi", x: 240, y: 320, heading: 0, color: "#facc15" },
      { type: "sports", x: 320, y: 180, heading: -Math.PI / 2, color: "#0ea5e9" },
      { type: "bike", x: 286, y: 126, heading: -Math.PI / 2, color: "#f43f5e" },
      { type: "sedan", x: 220, y: 350, heading: 0, color: "#7f1d1d" },
      { type: "van", x: 617, y: 500, heading: Math.PI / 2, color: "#4f6f86" },
      { type: "pickup", x: 350, y: 297, heading: 0, color: "#8f5a3c" },
      { type: "suv", x: 600, y: 343, heading: Math.PI, color: "#38424a" },
      { type: "muscle", x: 480, y: 617, heading: 0, color: "#991b1b" },
      { type: "limo", x: 817, y: 937, heading: Math.PI, color: "#111827" },
      { type: "sports", x: 937, y: 500, heading: -Math.PI / 2, color: "#7c3aed" },
      { type: "sedan", x: 100, y: 297, heading: 0, color: "#c2a878" },
      { type: "van", x: 937, y: 800, heading: Math.PI / 2, color: "#8b5e3c" },
    ];
    for (const p of list) {
      const v = { type: p.type, def: CFG.VEHICLES[p.type], color: p.color, x: p.x, y: p.y, heading: p.heading, siren: false };
      const mesh = this.makeVehicleMesh(v);
      this.freeze(mesh.group);
      wg.add(mesh.group);
    }
  },

  buildSkyline(wg) {    const T = window.THREE;
    if (!this.canInstance) return;
    const dummy = new T.Object3D();
    const list = [];
    const r = this.rngSeed(6161);
    const W2 = MapSys.data.worldW;
    for (let i = 0; i < 92; i++) {
      const side = Math.floor(r() * 4);
      let x, z;
      if (side === 0) { x = -260 - r() * 900; z = -200 + r() * (W2 + 400); }
      else if (side === 1) { x = W2 + 260 + r() * 900; z = -200 + r() * (W2 + 400); }
      else if (side === 2) { x = -200 + r() * (W2 + 400); z = -260 - r() * 900; }
      else { x = -200 + r() * (W2 + 400); z = W2 + 260 + r() * 900; }
      list.push({ x: x, z: z, side: side, w: 60 + r() * 130, h: 110 + r() * 360, d: 60 + r() * 130 });
    }
    const im = new T.InstancedMesh(this.geo.box, this.mat.skyline, list.length);
    for (let i = 0; i < list.length; i++) {
      const rot = r() * 0.5;
      list[i].rot = rot;
      dummy.position.set(list[i].x, list[i].h / 2, list[i].z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(list[i].w, list[i].h, list[i].d);
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = false; im.receiveShadow = false;
    wg.add(im);
    // 让远景楼体朝向城市的一侧带上窗格，而不是一排纯灰盒子。
    const faceGeo = new T.PlaneGeometry(1, 1);
    const cols = new Float32Array(faceGeo.attributes.position.count * 3);
    cols.fill(1);
    faceGeo.setAttribute("color", new T.BufferAttribute(cols, 3));
    // 远景窗格使用独立的无雾材质：楼体仍被雾吞掉，但窗口保留一点城市密度。
    const skyTex = this.tex.facade[3].clone();
    skyTex.wrapS = T.RepeatWrapping; skyTex.wrapT = T.RepeatWrapping;
    skyTex.repeat.set(2, 6); skyTex.needsUpdate = true;
    const faceMat = new T.MeshBasicMaterial({ map: skyTex, color: 0x737c87, fog: false });
    const faces = new T.InstancedMesh(faceGeo, faceMat, list.length);
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const nx0 = b.side === 0 ? 1 : b.side === 1 ? -1 : 0;
      const nz0 = b.side === 2 ? 1 : b.side === 3 ? -1 : 0;
      const cr = Math.cos(b.rot), sr = Math.sin(b.rot);
      const nx = nx0 * cr + nz0 * sr;
      const nz = -nx0 * sr + nz0 * cr;
      const offset = (b.side === 0 || b.side === 1 ? b.w : b.d) * 0.5 + 0.4;
      const baseYaw = b.side === 0 ? Math.PI / 2 : b.side === 1 ? -Math.PI / 2 : b.side === 3 ? Math.PI : 0;
      dummy.position.set(b.x + nx * offset, b.h * 0.5, b.z + nz * offset);
      dummy.rotation.set(0, b.rot + baseYaw, 0);
      dummy.scale.set((b.side === 0 || b.side === 1 ? b.w : b.d) * 0.86, b.h * 0.78, 1);
      dummy.updateMatrix(); faces.setMatrixAt(i, dummy.matrix);
    }
    faces.instanceMatrix.needsUpdate = true;
    faces.castShadow = false; faces.receiveShadow = false;
    wg.add(faces);
  },

  addLantern(wg, x, z) {
    const T = window.THREE;
    const g = new T.Group(); g.position.set(x, 0.42, z);
    const pole = new T.Mesh(this.geo.cyl, this.mat.woodDark);
    pole.position.y = 1.8; pole.scale.set(0.18, 3.6, 0.18); g.add(pole);
    const head = new T.Mesh(this.geo.box, this.mat.wood);
    head.position.y = 4.0; head.scale.set(1.3, 1.6, 1.3); g.add(head);
    const paper = new T.Mesh(this.geo.box, this.mat.headlight);
    paper.position.y = 4.0; paper.scale.set(0.9, 1.15, 0.9); g.add(paper);
    const glow = new T.Sprite(this.mat.glowWarm);
    glow.position.y = 4.0; glow.scale.set(5, 5, 1); g.add(glow);
    wg.add(g);
  },

  addParkLamp(wg, x, z) {
    const T = window.THREE;
    const g = new T.Group(); g.position.set(x, 0.42, z);
    const pole = new T.Mesh(this.geo.cyl, this.mat.metalDark);
    pole.position.y = 4.4; pole.scale.set(0.2, 8.8, 0.2); pole.castShadow = true; g.add(pole);
    const crown = new T.Mesh(this.geo.cone4, this.mat.metalDark);
    crown.position.y = 9.0; crown.rotation.y = Math.PI / 4;
    crown.scale.set(1.0, 0.85, 1.0); g.add(crown);
    const bulb = new T.Mesh(this.geo.sphereLow, this.mat.headlight);
    bulb.position.y = 8.75; bulb.scale.set(0.55, 0.7, 0.55); g.add(bulb);
    const glow = new T.Sprite(this.mat.glowWarm);
    glow.position.y = 8.7; glow.scale.set(8.5, 8.5, 1); glow.renderOrder = 4; g.add(glow);
    const pool = new T.Mesh(this.geo.circle, this.mat.neonGlow);
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.02;
    pool.scale.set(11, 11, 1); pool.renderOrder = 2; g.add(pool);
    wg.add(g);
  },

  addFoodCart(wg, x, z, rot) {
    const T = window.THREE;
    const g = new T.Group(); g.position.set(x, 0.42, z); g.rotation.y = rot || 0;
    const body = new T.Mesh(this.geo.box, this.mat.vermilion);
    body.position.y = 1.65; body.scale.set(7.4, 2.1, 3.6); body.castShadow = true; body.receiveShadow = true; g.add(body);
    const counter = new T.Mesh(this.geo.box, this.mat.trim);
    counter.position.y = 2.82; counter.scale.set(7.9, 0.26, 4.0); counter.castShadow = true; g.add(counter);
    for (const sx of [-3.1, 3.1]) for (const sz of [-1.55, 1.55]) {
      const leg = new T.Mesh(this.geo.cyl, this.mat.metalDark);
      leg.position.set(sx, 3.7, sz); leg.scale.set(0.12, 2.3, 0.12); g.add(leg);
    }
    const awn = new T.Mesh(this.geo.box, this.mat.awningA);
    awn.position.y = 4.9; awn.scale.set(8.8, 0.20, 5.0); awn.castShadow = true; g.add(awn);
    const valance = new T.Mesh(this.geo.box, this.mat.awningA);
    valance.position.set(0, 4.62, -2.36); valance.scale.set(8.8, 0.46, 0.18); g.add(valance);
    const sign = new T.Mesh(this.geo.plane, this.mat.stallSign);
    sign.position.set(0, 3.62, -2.05); sign.rotation.y = Math.PI; sign.scale.set(5.6, 2.0, 1); g.add(sign);
    const sglow = new T.Mesh(this.geo.plane, this.mat.neonGlow);
    sglow.position.set(0, 3.62, -2.10); sglow.rotation.y = Math.PI; sglow.scale.set(7.6, 3.2, 1);
    sglow.renderOrder = 3; g.add(sglow);
    const sideSign = new T.Mesh(this.geo.plane, this.mat.stallSign);
    sideSign.position.set(-3.72, 3.62, 0); sideSign.rotation.y = -Math.PI / 2; sideSign.scale.set(4.2, 1.7, 1); g.add(sideSign);
    const lamp = new T.Mesh(this.geo.sphereLow, this.mat.headlight);
    lamp.position.set(0, 4.35, -0.2); lamp.scale.set(0.45, 0.5, 0.45); g.add(lamp);
    const glow = new T.Sprite(this.mat.glowWarm);
    glow.position.set(0, 4.3, -0.2); glow.scale.set(7.0, 7.0, 1); glow.renderOrder = 4; g.add(glow);
    for (const sx of [-2.8, 2.8]) {
      const lan = new T.Mesh(this.geo.sphereLow, this.mat.vermilion);
      lan.position.set(sx, 4.05, -1.9); lan.scale.set(0.36, 0.48, 0.36); g.add(lan);
      const lglow = new T.Sprite(this.mat.glowWarm);
      lglow.position.copy(lan.position); lglow.scale.set(3.0, 3.0, 1); g.add(lglow);
      const wm = new T.Mesh(this.geo.cyl, this.mat.metalDark);
      wm.position.set(sx, 0.75, 1.9); wm.rotation.x = Math.PI / 2; wm.scale.set(1.0, 0.3, 1.0); g.add(wm);
    }
    wg.add(g);
  },

  buildHospitalCourtyard(wg) {
    const T = window.THREE;
    const cx = this.spawn.x, cz = this.spawn.y;
    const plaza = new T.Mesh(this.geo.circle, this.mat.pavers);
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(cx, 0.412, cz);
    plaza.scale.set(30, 30, 1); plaza.receiveShadow = true; wg.add(plaza);
    const rim = new T.Mesh(this.geo.torus, this.mat.metalDark);
    rim.rotation.x = -Math.PI / 2; rim.position.set(cx, 0.43, cz);
    rim.scale.set(29.4, 29.4, 2.4); wg.add(rim);
    // 广场不再铺细长的浅色分缝或放射条：它们在低角度和夜景里会被误读成车道线。
    // 只保留深色检修井，维持地面的尺度感。
    for (const man of [[-9, 13], [14, -7], [-17, -12]]) {
      const cover = new T.Mesh(this.geo.circle, this.mat.metalDark);
      cover.rotation.x = -Math.PI / 2; cover.position.set(cx + man[0], 0.428, cz + man[1]);
      cover.scale.set(1.55, 1.55, 1); wg.add(cover);
      const ring = new T.Mesh(this.geo.ringThin, this.mat.metalDark);
      ring.rotation.x = -Math.PI / 2; ring.position.set(cx + man[0], 0.431, cz + man[1]);
      ring.scale.set(1.75, 1.75, 1); wg.add(ring);
    }
    // 被风吹散的传单和纸屑
    const scraps = [[-6, -20, 0.4, 0.9], [17, 9, -1.2, 0.7], [-23, 4, 2.2, 1.0], [5, 24, 0.8, 0.6], [22, -19, -0.6, 0.8], [-14, -9, 1.7, 0.5], [2, 11, 2.8, 0.9]];
    for (const sp of scraps) {
      // 用偏暗的纸屑材质，避免在俯视角下被误读成车道白线。
      const scrap = new T.Mesh(this.geo.plane, this.mat.trimDark);
      scrap.rotation.set(-Math.PI / 2, 0, sp[2]);
      scrap.position.set(cx + sp[0], 0.434, cz + sp[1]);
      scrap.scale.set(sp[3] * 0.7, sp[3] * 0.9, 1);
      wg.add(scrap);
    }
    // 广场湿痕：把霓虹和天空反光摊在地面上
    for (const pd of [
      [-29, 24, 9, 4, -0.5], [-41, -12, 13, 6, 0.1],
      [-12, -54, 12, 5, 0.6],
    ]) {
      const pud = new T.Mesh(this.geo.circle, this.mat.puddle);
      pud.rotation.x = -Math.PI / 2; pud.rotation.z = pd[4];
      pud.position.set(cx + pd[0], 0.421, cz + pd[1]);
      pud.scale.set(pd[2], pd[3], 1);
      pud.renderOrder = 1;
      wg.add(pud);
    }
    // 广场边界矮桩，给巨大的铺装前景提供尺度参照
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - 0.83), Math.cos(a - 0.83))) < 0.30) continue;
      const bx = cx + Math.cos(a) * 27.4, bz = cz + Math.sin(a) * 27.4;
      const post = new T.Mesh(this.geo.cylLow, this.mat.metalDark);
      post.position.set(bx, 1.15, bz); post.scale.set(0.32, 1.9, 0.32); post.castShadow = true; wg.add(post);
      const cap = new T.Mesh(this.geo.sphereLow, this.mat.headlight);
      cap.position.set(bx, 2.25, bz); cap.scale.set(0.35, 0.28, 0.35); wg.add(cap);
    }

    // 喷泉在西北侧，给相机前景增加层次，同时不挡住出生点
    const fx = cx - 48, fz = cz - 42;
    const basin = new T.Mesh(this.geo.cyl, this.mat.stone);
    basin.position.set(fx, 1.2, fz); basin.scale.set(10, 1.6, 10); basin.castShadow = true; wg.add(basin);
    const water = new T.Mesh(this.geo.circle, this.mat.water);
    water.rotation.x = -Math.PI / 2; water.position.set(fx, 2.02, fz); water.scale.set(8.6, 8.6, 1); wg.add(water);
    const column = new T.Mesh(this.geo.cyl, this.mat.stone);
    column.position.set(fx, 4.2, fz); column.scale.set(1.3, 5.2, 1.3); column.castShadow = true; wg.add(column);
    const stat = new T.Mesh(this.geo.octa, this.mat.vermilion);
    stat.position.set(fx, 7.3, fz); stat.scale.set(1.5, 2.2, 1.5); wg.add(stat);
    const fglow = new T.Sprite(this.mat.glowWarm);
    fglow.position.set(fx, 3.1, fz); fglow.scale.set(16, 9, 1); wg.add(fglow);
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + Math.PI / 4;
      const bench = this.addBench(wg, cx + Math.cos(a) * 28, cz + Math.sin(a) * 28, -a + Math.PI / 2);
    }
    this.addLantern(wg, cx - 24, cz + 18);
    this.addLantern(wg, cx + 24, cz + 18);
    this.addLantern(wg, cx - 20, cz - 18);
    this.addLantern(wg, cx + 20, cz - 18);
    this.addParkLamp(wg, cx - 25, cz - 35);
    this.addParkLamp(wg, cx + 36, cz + 7);
    this.addParkLamp(wg, cx - 34, cz + 28);
    this.addFoodCart(wg, cx + 40, cz - 10, 0.25);
    this.addFoodCart(wg, cx + 16, cz + 40, -0.35);
    this.addPlanter(wg, cx + 20, cz - 15);
    this.addPlanter(wg, cx + 2, cz + 22);
    for (const wp of [[cx + 42, cz + 4, 12, 6, 0.3], [cx + 18, cz + 30, 9, 5, -0.2], [cx - 12, cz + 15, 7, 4, 0.6]]) {
      const wet = new T.Mesh(this.geo.circle, this.mat.wetNeon);
      wet.rotation.x = -Math.PI / 2; wet.rotation.z = wp[4];
      wet.position.set(wp[0], 0.423, wp[1]);
      wet.scale.set(wp[2], wp[3], 1); wet.renderOrder = 2;
      wg.add(wet);
    }
    // 樱花树
    this.addTree(wg, 74, 166, 11, true);
    this.addTree(wg, 252, 150, 10, true);
    this.addTree(wg, 112, 246, 9, true);
    this.addTree(wg, 268, 250, 8, true);
    // 花坛
    const bed = new T.Mesh(this.geo.cyl, this.mat.stoneDark);
    bed.position.set(cx + 40, 0.8, cz - 30); bed.scale.set(7, 0.9, 7); wg.add(bed);
    const bed2 = new T.Mesh(this.geo.cyl, this.mat.stoneDark);
    bed2.position.set(cx - 38, 0.8, cz + 28); bed2.scale.set(6, 0.9, 6); wg.add(bed2);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const fl = new T.Mesh(this.geo.sphereLow, i % 2 ? this.mat.cherry : this.mat.leafB);
      fl.position.set(cx + 40 + Math.cos(a) * 4.2, 2.0 + (i % 3) * 0.3, cz - 30 + Math.sin(a) * 4.2);
      fl.scale.setScalar(0.8 + (i % 2) * 0.3); wg.add(fl);
    }
    // 医院入口拱门（公园南侧，面向出生点）
    const ax = cx - 34, az = cz + 108;
    for (const sx of [-1, 1]) {
      const pil = new T.Mesh(this.geo.box, this.mat.white);
      pil.position.set(ax + sx * 11, 7.5, az); pil.scale.set(3.2, 15, 3.2); pil.castShadow = true; wg.add(pil);
      const base = new T.Mesh(this.geo.box, this.mat.stone);
      base.position.set(ax + sx * 11, 1.0, az); base.scale.set(5, 2, 5); wg.add(base);
    }
    const beam = new T.Mesh(this.geo.box, this.mat.white);
    beam.position.set(ax, 15.6, az); beam.scale.set(29, 3.2, 4); beam.castShadow = true; wg.add(beam);
    const crossV = new T.Mesh(this.geo.box, this.mat.hospitalRed);
    crossV.position.set(ax, 17.8, az - 2.1); crossV.scale.set(1.3, 5, 0.6); wg.add(crossV);
    const crossH = new T.Mesh(this.geo.box, this.mat.hospitalRed);
    crossH.position.set(ax, 17.8, az - 2.1); crossH.scale.set(5, 1.3, 0.6); wg.add(crossH);
    this.mat.hospitalSign = new T.MeshBasicMaterial({
      map: this.canvasTex(512, 128, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = "rgba(15,22,26,0.9)"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "#e36b5f"; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
        g.fillStyle = "#f4e9d6"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = "bold 54px 'Microsoft YaHei', 'Segoe UI', sans-serif";
        g.fillText("圣玛丽医院", w / 2, h / 2 - 10);
        g.fillStyle = "#e9b48c"; g.font = "bold 18px 'Segoe UI', sans-serif";
        g.fillText("ST. MARY'S HOSPITAL  ·  EMERGENCY", w / 2, h - 27);
      }, 1, 1, true),
      transparent: true, side: T.DoubleSide,
    });
    this.sharedMat(this.mat.hospitalSign);
    const sign = new T.Mesh(this.geo.plane, this.mat.hospitalSign);
    sign.position.set(ax, 11.8, az - 2.4); sign.scale.set(32, 6.2, 1); sign.rotation.y = Math.PI; wg.add(sign);
    const sglow = new T.Mesh(this.geo.plane, this.mat.neonGlow);
    sglow.position.set(ax, 11.8, az - 2.5); sglow.scale.set(40, 12, 1); sglow.rotation.y = Math.PI;
    sglow.castShadow = false; sglow.receiveShadow = false; sglow.renderOrder = 3; wg.add(sglow);
    // 从广场通往英雄店铺的石板路
    const path = new T.Mesh(this.geo.plane, this.mat.pavers);
    path.rotation.set(-Math.PI / 2, 0, -Math.PI / 4);
    path.position.set(cx + 38, 0.414, cz + 38);
    path.scale.set(72, 9, 1); wg.add(path);
  },

  buildHeroStore(wg) {
    const T = window.THREE;
    const b = this.hero;
    const cx = b.x + b.w / 2;
    const info = this.faceInfo(b, 0, 0.72);
    // 店前小广场
    const fore = new T.Mesh(this.geo.plane, this.mat.pavers);
    fore.rotation.x = -Math.PI / 2;
    fore.position.set(cx, 0.416, b.y - 12);
    fore.scale.set(b.w + 10, 26, 1); wg.add(fore);
    const sf = new T.Mesh(this.geo.plane, this.storefrontMats[0]);
    sf.position.set(cx, 4.55, info.z); sf.scale.set(b.w - 10, 7.7, 1); sf.rotation.y = Math.PI; wg.add(sf);
    const awn = new T.Mesh(this.geo.box, this.mat.awningA);
    awn.position.set(cx, 9.3, b.y - 1.5); awn.scale.set(b.w - 5, 0.42, 3.2); awn.castShadow = true; wg.add(awn);
    this.mat.heroSign = new T.MeshBasicMaterial({
      map: this.canvasTex(1024, 192, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = "rgba(8,12,16,0.92)"; g.fillRect(4, 4, w - 8, h - 8);
        g.strokeStyle = "#ffb45c"; g.lineWidth = 8; g.shadowColor = "#ff7a2f"; g.shadowBlur = 22;
        g.strokeRect(12, 12, w - 24, h - 24);
        g.fillStyle = "#ffe5ae"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = "bold 92px 'Segoe UI', 'Microsoft YaHei', sans-serif";
        g.fillText("OUTLAW MART", w / 2, h / 2 - 16);
        g.shadowBlur = 8; g.fillStyle = "#ff8d63"; g.font = "bold 28px 'Microsoft YaHei', sans-serif";
        g.fillText("亡命超市  ·  OPEN 24 HOURS  ·  COLD BEER", w / 2, h - 34);
        g.shadowBlur = 0;
      }, 1, 1, true),
      transparent: true, side: T.DoubleSide,
    });
    this.sharedMat(this.mat.heroSign);
    this.mat.heroRoofSign = new T.MeshBasicMaterial({
      map: this.canvasTex(1024, 192, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = "rgba(12,8,16,0.94)"; g.fillRect(4, 4, w - 8, h - 8);
        g.strokeStyle = "#ff6a9e"; g.lineWidth = 7; g.shadowColor = "#ff2f72"; g.shadowBlur = 24;
        g.strokeRect(12, 12, w - 24, h - 24);
        g.fillStyle = "#ffe2ec"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = "bold 96px 'Microsoft YaHei', 'Segoe UI', sans-serif";
        g.fillText("亡 命 超 市", w / 2, h / 2 - 14);
        g.shadowBlur = 10; g.fillStyle = "#ff9ec0"; g.font = "bold 27px 'Segoe UI', sans-serif";
        g.fillText("NIGHT MARKET  ·  COLD BEER  ·  OPEN 24H", w / 2, h - 34);
        g.shadowBlur = 0;
      }, 1, 1, true),
      transparent: true, side: T.DoubleSide,
    });
    this.sharedMat(this.mat.heroRoofSign);
    const sign = new T.Mesh(this.geo.plane, this.mat.heroSign);
    sign.position.set(cx, 13.4, info.z - 0.12); sign.scale.set(b.w - 9, 8.2, 1); sign.rotation.y = Math.PI; wg.add(sign);
    const sglow = new T.Mesh(this.geo.plane, this.mat.neonGlow);
    sglow.position.set(cx, 13.6, info.z - 0.24); sglow.scale.set(b.w - 2, 14, 1); sglow.rotation.y = Math.PI;
    sglow.castShadow = false; sglow.receiveShadow = false; sglow.renderOrder = 3; wg.add(sglow);
    // 屋顶大招牌
    const roofSign = new T.Mesh(this.geo.plane, this.mat.heroRoofSign);
    roofSign.position.set(cx, b.renderH + 4.1, b.y - 0.9); roofSign.scale.set(b.w - 10, 5.6, 1);
    roofSign.rotation.y = Math.PI; wg.add(roofSign);
    const roofGlow = new T.Mesh(this.geo.plane, this.mat.neonGlow);
    roofGlow.position.set(cx, b.renderH + 4.1, b.y - 1.1); roofGlow.scale.set(b.w + 2, 10, 1);
    roofGlow.rotation.y = Math.PI; roofGlow.renderOrder = 3; wg.add(roofGlow);
    for (const sx of [-1, 1]) {
      const post = new T.Mesh(this.geo.box, this.mat.metalDark);
      post.position.set(cx + sx * (b.w * 0.32), b.renderH + 1.8, b.y - 1.2);
      post.scale.set(0.42, 5.2, 0.42); wg.add(post);
    }
    // 西侧竖向霓虹
    const winfo = this.faceInfo(b, 2, 0.7);
    const vs = new T.Mesh(this.geo.plane, this.mat.verticalSign);
    vs.position.set(winfo.x, 14.5, b.y + b.h * 0.45); vs.scale.set(6.4, 26, 1); vs.rotation.y = -Math.PI / 2; wg.add(vs);
    const vg = new T.Mesh(this.geo.plane, this.mat.neonGlow);
    vg.position.set(winfo.x - 0.1, 14.5, b.y + b.h * 0.45); vg.scale.set(12, 31, 1); vg.rotation.y = -Math.PI / 2;
    vg.castShadow = false; vg.receiveShadow = false; vg.renderOrder = 3; wg.add(vg);
    const vpool = new T.Mesh(this.geo.plane, this.mat.wetNeon);
    vpool.rotation.x = -Math.PI / 2;
    vpool.position.set(b.x - 5.4, 0.438, b.y + b.h * 0.45);
    vpool.scale.set(5.5, 24, 1);
    vpool.castShadow = false; vpool.receiveShadow = false; vpool.renderOrder = 2;
    wg.add(vpool);
    // 店前售卖机与长椅
    this.addVending(wg, b.x + 11, b.y - 3.5, 0);
    this.addVending(wg, b.x + b.w - 12, b.y - 3.5, 0);
    this.addBench(wg, b.x + 28, b.y - 9, Math.PI);
    this.addBin(wg, b.x + 4, b.y - 5);
    // 暖色灯带
    const strip = new T.Mesh(this.geo.box, this.mat.trafficYellow);
    strip.position.set(cx, 9.75, b.y - 0.35); strip.scale.set(b.w - 7, 0.18, 0.18); wg.add(strip);
    const strip2 = new T.Mesh(this.geo.box, this.mat.trafficRed);
    strip2.position.set(cx, 9.9, b.y - 0.33); strip2.scale.set(b.w - 15, 0.12, 0.12); wg.add(strip2);
    // 店门口暖色光斑
    const carpet = new T.Mesh(this.geo.plane, this.mat.neonGlow);
    carpet.rotation.x = -Math.PI / 2; carpet.position.set(cx, 0.43, b.y - 6);
    carpet.scale.set(26, 10, 1); carpet.castShadow = false; carpet.receiveShadow = false; carpet.renderOrder = 2;
    wg.add(carpet);
  },

  /* ---------------- 城市签名：斜向连廊、街口门架、屋顶广告与空中轨道 ---------------- */
  buildCitySignature(wg) {
    this.buildSkybridges(wg);
    this.buildDistrictGates(wg);
    this.buildRoofBillboards(wg);
    this.buildLandmarkNeedle(wg);
    this.buildMonorail(wg);
  },

  buildSkybridges(wg) {
    const T = window.THREE, d = MapSys.data, base = 0.35;
    const cand = d.buildings.filter((b) => !b.hero && b.renderH && Utils.dist(
      b.x + b.w / 2, b.y + b.h / 2, this.spawn.x, this.spawn.y) < 980
    ).sort((a, b) => Utils.dist(a.x, a.y, this.spawn.x, this.spawn.y) - Utils.dist(b.x, b.y, this.spawn.x, this.spawn.y));
    const used = new Set();
    let made = 0;
    for (let i = 0; i < cand.length && made < 5; i++) {
      if (used.has(cand[i])) continue;
      const a = cand[i], ax = a.x + a.w / 2, az = a.y + a.h / 2;
      for (let j = i + 1; j < cand.length && made < 5; j++) {
        if (used.has(cand[j])) continue;
        const b = cand[j], bx = b.x + b.w / 2, bz = b.y + b.h / 2;
        const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
        if (len < 54 || len > 194) continue;
        const y1 = base + a.renderH, y2 = base + b.renderH;
        const by = Math.min(y1, y2) * 0.56 + 7;
        if (by < 19 || by > 58) continue;
        used.add(a); used.add(b); made++;
        const grp = new T.Group();
        grp.position.set((ax + bx) / 2, by, (az + bz) / 2);
        grp.rotation.y = -Math.atan2(dz, dx);
        const glass = new T.Mesh(this.geo.box, this.mat.glass);
        glass.scale.set(len, 4.2, 7.0); grp.add(glass);
        const floor = new T.Mesh(this.geo.box, this.mat.metalDark);
        floor.position.y = -2.25; floor.scale.set(len, 0.38, 7.4); grp.add(floor);
        const roof = new T.Mesh(this.geo.box, this.mat.metal);
        roof.position.y = 2.35; roof.scale.set(len, 0.28, 7.3); grp.add(roof);
        for (const z of [-3.56, 3.56]) {
          const strip = new T.Mesh(this.geo.box, z < 0 ? this.mat.neonCyan : this.mat.neonPink);
          strip.position.set(0, 0.05, z); strip.scale.set(len, 0.18, 0.16); grp.add(strip);
          const rail = new T.Mesh(this.geo.box, this.mat.metalDark);
          rail.position.set(0, 2.2, z * 0.97); rail.scale.set(len, 0.10, 0.10); grp.add(rail);
        }
        for (let k = 1; k < 7; k++) {
          const mull = new T.Mesh(this.geo.box, this.mat.metalDark);
          mull.position.set(-len * 0.5 + len * k / 7, 0, 0);
          mull.scale.set(0.14, 4.4, 7.2); grp.add(mull);
        }
        // 斜向支撑杆，进一步避免所有桥都像水平盒子。
        for (const sx of [-0.42, 0.42]) {
          const strut = new T.Mesh(this.geo.box, this.mat.metal);
          strut.position.set(len * sx, -3.0, 0);
          strut.scale.set(0.28, 6.0, 0.28);
          strut.rotation.z = sx * 0.38; grp.add(strut);
        }
        grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        wg.add(grp);
      }
    }
  },

  buildDistrictGates(wg) {
    const T = window.THREE;
    const makeGate = (x, z, rot, seed) => {
      const grp = new T.Group();
      grp.position.set(x, 0, z);
      grp.rotation.y = rot;
      for (const sx of [-1, 1]) {
        const pillar = new T.Mesh(this.geo.box, this.mat.metalDark);
        pillar.position.set(sx * 27, 8.5, 0); pillar.scale.set(2.5, 17, 2.7); grp.add(pillar);
        const glow = new T.Mesh(this.geo.box, sx < 0 ? this.mat.neonCyan : this.mat.neonPink);
        glow.position.set(sx * 27, 8.5, 1.42); glow.scale.set(0.22, 12.5, 0.10); grp.add(glow);
        const foot = new T.Mesh(this.geo.box, this.mat.stoneDark);
        foot.position.set(sx * 27, 0.55, 0); foot.scale.set(4.2, 1.1, 4.2); grp.add(foot);
        const brace = new T.Mesh(this.geo.box, this.mat.metal);
        brace.position.set(sx * 20.5, 12.0, 0); brace.scale.set(0.45, 12.5, 0.45);
        brace.rotation.z = -sx * 0.52; grp.add(brace);
      }
      const beam = new T.Mesh(this.geo.box, this.mat.metalDark);
      beam.position.set(0, 17.5, 0); beam.scale.set(58, 1.35, 2.7); grp.add(beam);
      const edge = new T.Mesh(this.geo.box, this.mat.neonPink);
      edge.position.set(0, 18.25, 0); edge.scale.set(52, 0.16, 0.22); grp.add(edge);
      // 双面招牌：从街道两侧经过都能看到
      const sign = new T.Mesh(this.geo.plane, this.mat.billboard);
      sign.position.set(0, 13.0, 1.42); sign.scale.set(26, 7.8, 1); grp.add(sign);
      const sign2 = new T.Mesh(this.geo.plane, this.mat.billboard);
      sign2.position.set(0, 13.0, -1.42); sign2.rotation.y = Math.PI; sign2.scale.set(26, 7.8, 1); grp.add(sign2);
      const halo = new T.Mesh(this.geo.plane, this.mat.neonGlow);
      halo.position.set(0, 13.0, 1.48); halo.scale.set(32, 12, 1); grp.add(halo);
      for (const sx of [-1, 1]) {
        const banner = new T.Mesh(this.geo.plane, this.mat.verticalSign);
        banner.position.set(sx * 18, 9.2, 0.11); banner.scale.set(5.4, 9.5, 1); grp.add(banner);
      }
      grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      wg.add(grp);
    };
    // 出生点东侧主路和南侧路口各放一座斜切门架，第一眼就能看到非正交元素。
    makeGate(MapSys.data.cell, this.spawn.y, Math.PI / 2 + 0.12, 1);
    makeGate(this.spawn.x, MapSys.data.cell * 2, 0.09, 2);
    makeGate(MapSys.data.cell * 2, MapSys.data.cell, Math.PI / 2 - 0.16, 3);
  },

  buildRoofBillboards(wg) {
    const T = window.THREE, d = MapSys.data;
    const cand = d.buildings.filter((b) => !b.hero && b.renderH > 26 && Utils.dist(
      b.x + b.w / 2, b.y + b.h / 2, this.spawn.x, this.spawn.y) < 760
    ).sort((a, b) => Utils.dist(a.x, a.y, this.spawn.x, this.spawn.y) - Utils.dist(b.x, b.y, this.spawn.x, this.spawn.y));
    for (let i = 0; i < Math.min(4, cand.length); i++) {
      const b = cand[i], cx = b.x + b.w / 2, cz = b.y + b.h / 2;
      const dx = this.spawn.x - cx, dz = this.spawn.y - cz;
      const y = 0.35 + b.renderH + 8.0;
      const ang = Math.atan2(dx, dz) + (i % 2 ? 0.22 : -0.16);
      const grp = new T.Group();
      grp.position.set(cx, y, cz);
      grp.rotation.y = ang;
      const board = new T.Mesh(this.geo.plane, this.signMats[i % this.signMats.length]);
      board.scale.set(23, 12, 1); grp.add(board);
      const glow = new T.Mesh(this.geo.plane, this.mat.neonGlow);
      glow.position.z = 0.08; glow.scale.set(29, 17, 1); grp.add(glow);
      for (const sx of [-1, 1]) {
        const post = new T.Mesh(this.geo.box, this.mat.metalDark);
        post.position.set(sx * 7.5, -6.2, -0.35); post.scale.set(0.32, 12.0, 0.32); grp.add(post);
        const brace = new T.Mesh(this.geo.box, this.mat.metal);
        brace.position.set(sx * 4.0, -4.0, 0); brace.scale.set(0.24, 10.0, 0.24);
        brace.rotation.z = sx * 0.62; grp.add(brace);
      }
      const back = new T.Mesh(this.geo.box, this.mat.metalDark);
      back.position.set(0, 0, -0.16); back.scale.set(19.5, 10.2, 0.16); grp.add(back);
      wg.add(grp);
    }
  },

  buildLandmarkNeedle(wg) {
    const T = window.THREE, d = MapSys.data;
    let best = null, bd = Infinity;
    for (const b of d.buildings) {
      if (b.hero) continue;
      const dist = Utils.dist(b.x + b.w / 2, b.y + b.h / 2, this.spawn.x, this.spawn.y);
      if (b.renderH && dist < 1250 && b.renderH > 42 && dist < bd) { best = b; bd = dist; }
    }
    if (!best) return;
    const cx = best.x + best.w * 0.5, cz = best.y + best.h * 0.5;
    const y0 = 0.35 + best.renderH;
    const mast = new T.Mesh(this.geo.cyl, this.mat.metalDark);
    mast.position.set(cx, y0 + 15, cz); mast.scale.set(0.55, 30, 0.55); wg.add(mast);
    for (let i = 0; i < 4; i++) {
      const ring = new T.Mesh(this.geo.ringThin, i % 2 ? this.mat.neonCyan : this.mat.neonPink);
      ring.rotation.x = -Math.PI / 2; ring.position.set(cx, y0 + 5 + i * 8.5, cz);
      ring.scale.set(5.2 - i * 0.7, 5.2 - i * 0.7, 1); wg.add(ring);
      const arm = new T.Mesh(this.geo.box, this.mat.metal);
      arm.position.set(cx, y0 + 5 + i * 8.5, cz); arm.rotation.y = i * 0.7;
      arm.scale.set(8 - i * 0.9, 0.16, 0.16); wg.add(arm);
    }
    const tip = new T.Mesh(this.geo.sphereLow, this.mat.neonPink);
    tip.position.set(cx, y0 + 31, cz); tip.scale.setScalar(1.1); wg.add(tip);
    const glow = new T.Sprite(this.mat.glowPink || this.mat.glowWarm);
    glow.position.set(cx, y0 + 30.5, cz); glow.scale.set(16, 16, 1); wg.add(glow);
  },

  buildMonorail(wg) {
    const T = window.THREE, d = MapSys.data;
    const A = 0.63, half = 2750;
    const dx = Math.cos(A), dz = Math.sin(A);
    const sx = this.spawn.x - dx * half, sz = this.spawn.y - dz * half;
    const ex = this.spawn.x + dx * half, ez = this.spawn.y + dz * half;
    const cy = 86;
    const len = half * 2;
    const mx = (sx + ex) / 2, mz = (sz + ez) / 2;
    const track = new T.Group();
    track.position.set(mx, cy, mz);
    track.rotation.y = -A;
    const beam = new T.Mesh(this.geo.box, this.mat.metalDark);
    beam.scale.set(len, 1.25, 7.4); track.add(beam);
    for (const z of [-2.8, 2.8]) {
      const rail = new T.Mesh(this.geo.box, this.mat.metal);
      rail.position.y = 1.0; rail.position.z = z; rail.scale.set(len, 0.32, 0.55); track.add(rail);
    }
    // 斜向桁架与灯带：从街谷抬头能看到一条穿过城市的斜线。
    for (let i = 0; i < 22; i++) {
      const x = -len * 0.5 + len * (i + 0.5) / 22;
      const cross = new T.Mesh(this.geo.box, this.mat.metal);
      cross.position.set(x, 0.4, 0); cross.scale.set(0.32, 0.26, 7.0); track.add(cross);
      if (i % 4 === 0) {
        const lamp = new T.Mesh(this.geo.box, i % 8 === 0 ? this.mat.neonCyan : this.mat.neonPink);
        lamp.position.set(x, -0.75, 0); lamp.scale.set(0.18, 0.10, 6.2); track.add(lamp);
      }
    }
    wg.add(track);
    // 落地支撑只放在道路/空地上，避免穿进建筑内部。
    for (let i = 0; i <= 30; i++) {
      const u = i / 30;
      const x = sx + (ex - sx) * u, z = sz + (ez - sz) * u;
      if (MapSys.isBlocked(x, z)) continue;
      // 轨道穿过出生广场时，不要在相机正前方落下一根 86 米高的柱子。
      if (Utils.dist(x, z, this.spawn.x, this.spawn.y) < 150) continue;
      const col = new T.Mesh(this.geo.cyl, this.mat.metalDark);
      col.position.set(x, cy / 2, z); col.scale.set(1.25, cy, 1.25); wg.add(col);
      const cap = new T.Mesh(this.geo.box, this.mat.metal);
      cap.position.set(x, cy - 1.8, z); cap.rotation.y = -A; cap.scale.set(4.2, 0.7, 3.4); wg.add(cap);
    }

    const train = new T.Group();
    for (let i = -1; i <= 1; i++) {
      const car = new T.Mesh(this.geo.box, this.mat.metal);
      car.position.x = i * 23.0; car.scale.set(21.5, 4.0, 6.1); train.add(car);
      const window = new T.Mesh(this.geo.box, this.mat.glass);
      window.position.set(i * 23.0, 0.25, 0); window.scale.set(17.0, 1.7, 6.18); train.add(window);
      const strip = new T.Mesh(this.geo.box, i < 0 ? this.mat.neonCyan : this.mat.neonPink);
      strip.position.set(i * 23.0, 1.9, 0); strip.scale.set(18.5, 0.12, 0.14); train.add(strip);
      const wheel = new T.Mesh(this.geo.box, this.mat.metalDark);
      wheel.position.set(i * 23.0, -2.15, 0); wheel.scale.set(11, 0.22, 4.4); train.add(wheel);
    }
    const nose = new T.Mesh(this.geo.cone, this.mat.metalDark);
    nose.position.set(36.2, 0, 0); nose.rotation.z = -Math.PI / 2; nose.scale.set(2.4, 4.2, 2.4); train.add(nose);
    const head = new T.Sprite(this.mat.glowWarm);
    head.position.set(39.4, 0, 0); head.scale.set(9, 9, 1); train.add(head);
    this.freezeChildren(train);
    train.position.set(mx, cy + 2.7, mz);
    train.rotation.y = -A;
    this.scene.add(train);
    this.monorail = {
      train: train, sx: sx, sz: sz, ex: ex, ez: ez, y: cy + 2.7,
      angle: -A, u: 0.54, speed: 0.011
    };
  },

  updateSignature(dt) {
    const m = this.monorail;
    if (!m || !m.train) return;
    m.u += dt * m.speed;
    if (m.u > 1) m.u -= 1;
    const x = m.sx + (m.ex - m.sx) * m.u;
    const z = m.sz + (m.ez - m.sz) * m.u;
    m.train.position.set(x, m.y, z);
    m.train.rotation.y = m.angle;
    m.train.updateMatrix();
  },

  freeze(root) {
    if (!root) return;
    root.traverse((o) => {
      o.updateMatrix();
      o.matrixAutoUpdate = false;
    });
  },

  buildLights() {
    const T = window.THREE;
    this.amb = new T.AmbientLight(0x63758f, 0.3);
    this.scene.add(this.amb);
    this.hemi = new T.HemisphereLight(0x8fa9c9, 0x33241e, 0.38);
    this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight(0xffb781, 1.7);
    this.sun.position.set(320, 430, 220);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -300;
    this.sun.shadow.camera.right = 300;
    this.sun.shadow.camera.top = 300;
    this.sun.shadow.camera.bottom = -300;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 1100;
    this.sun.shadow.bias = -0.00035;
    if ("normalBias" in this.sun.shadow) this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.fill = new T.DirectionalLight(0x5d82b8, 0.2);
    this.fill.position.set(-260, 180, -300);
    this.scene.add(this.fill);
    this.head = new T.SpotLight(0xfff0c0, 0, 190, 0.52, 0.68, 1.2);
    this.scene.add(this.head);
    this.scene.add(this.head.target);
    this.heroLight = new T.PointLight(0xff9f54, 1.1, 155, 1.8);
    this.heroLight.position.set(this.hero.x + this.hero.w / 2, 12, this.hero.y - 7);
    this.scene.add(this.heroLight);
    this.parkLights = [];
    for (const pp of [
      { x: this.spawn.x - 24, z: this.spawn.y - 38, h: 10 },
      { x: this.spawn.x + 34, z: this.spawn.y + 8, h: 9 },
    ]) {
      const pl = new T.PointLight(0xffa45e, 0, 110, 1.8);
      pl.position.set(pp.x, pp.h, pp.z);
      this.scene.add(pl);
      this.parkLights.push(pl);
    }
    this.playerLight = new T.PointLight(0xffb377, 0.24, 88, 1.7);
    this.playerLight.position.set(this.spawn.x, 8, this.spawn.y);
    this.scene.add(this.playerLight);
    this.lampLights = [];
    for (let i = 0; i < 10; i++) {
      const pl = new T.PointLight(0xffb95e, 0, 150, 1.8);
      this.scene.add(pl);
      this.lampLights.push(pl);
    }
  },

  buildParticles() {
    const T = window.THREE;
    const MAXP = 600;
    this.pGeo = new T.BufferGeometry();
    this.pPos = new Float32Array(MAXP * 3);
    this.pCol = new Float32Array(MAXP * 3);
    this.pGeo.setAttribute("position", new T.BufferAttribute(this.pPos, 3));
    this.pGeo.setAttribute("color", new T.BufferAttribute(this.pCol, 3));
    this.pPts = new T.Points(this.pGeo, this.mat.particle);
    this.pPts.frustumCulled = false;
    this.pPts.matrixAutoUpdate = false; this.pPts.updateMatrix();
    this.pGeo.setDrawRange(0, 0);
    this.scene.add(this.pPts);

    const MAXB = 320;
    this.bGeo = new T.BufferGeometry();
    this.bPos = new Float32Array(MAXB * 3);
    this.bGeo.setAttribute("position", new T.BufferAttribute(this.bPos, 3));
    this.bPts = new T.Points(this.bGeo, this.mat.bullet);
    this.bPts.frustumCulled = false;
    this.bPts.matrixAutoUpdate = false; this.bPts.updateMatrix();
    this.bGeo.setDrawRange(0, 0);
    this.scene.add(this.bPts);

    this.pPosAttr = this.pGeo.attributes.position;
    this.pColAttr = this.pGeo.attributes.color;
    this.bPosAttr = this.bGeo.attributes.position;
  },

  clothMaterial(color) {
    const c = color >>> 0;
    let m = this.clothMats.get(c);
    if (!m) {
      m = new window.THREE.MeshToonMaterial({ color: c, gradientMap: this.tex.toon });
      m.userData.cache = true;
      this.clothMats.set(c, m);
    }
    return m;
  },

  carPaintGeo(color) {
    const T = window.THREE;
    const key = typeof color === "string" ? color.toLowerCase() : String(color >>> 0);
    let g = this.carGeoCache.get(key);
    if (!g) {
      g = this.geo.box.clone();
      const col = new T.Color(color == null ? 0x8d99ae : color);
      // 在 ACES 色调映射下，明亮环境会把车漆洗成粉彩色；提高饱和度并压暗高亮色，
      // 让红/黄/绿在日光下仍然读得出本色。
      const hsl = {};
      col.getHSL(hsl);
      if (hsl.s > 0.25 && hsl.l > 0.15) {
        col.setHSL(hsl.h, Math.min(1, hsl.s * 1.15 + 0.02), Math.max(0.14, hsl.l * 0.88));
      }
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b;
      }
      g.setAttribute("color", new T.BufferAttribute(arr, 3));
      this.carGeoCache.set(key, g);
    }
    return g;
  },

  freezeChildren(root) {
    if (!root) return;
    for (const c of root.children.slice()) this.freeze(c);
  },

  // 角色模型统一使用：+X 为正面、+Y 向上、+Z 为角色右侧。
  // 旧模型肩膀沿 X 展开、枪却沿 X 伸出，身体和武器相差 90°；这里从骨骼层级重做，
  // 所有帽子、脸、衣襟、鞋尖和枪口都朝向 +X，并让四肢绕真正的肩/髋关节摆动。
  makeCharacter(bodyColor, scale, isPlayer, styleOpts) {
    const T = window.THREE, g = new T.Group();
    const s = scale || 1.32;
    g.scale.setScalar(s);
    const style = (styleOpts && typeof styleOpts === "object") ? styleOpts : {};
    const variant = style.variant == null ? 0 : (style.variant | 0);
    const isPolice = !!style.police;
    const isBoss = !!style.boss;
    const isGang = !!style.gang;
    const isWorker = variant === 2;
    const isPunk = variant === 3;
    const isTourist = variant === 4;
    const isBusiness = variant === 1 || variant === 5;
    const isElder = variant === 6;
    const isHoodie = variant === 0 || variant === 7;

    // 材质按固定小调色板复用；角色数量增加后也不会把材质数推爆。
    const bodyPalette = [0x31465b, 0x6d3a33, 0x8a6b42, 0x3d5b4a, 0x5b466b, 0x9b4b3b, 0x506b80];
    const pantsPalette = [0x222b36, 0x3c4656, 0x4a4038];
    const trimPalette = [0xb64032, 0xd0a24a, 0x7de9ff];
    const skinPalette = [0xb37a58, 0x8b5a3c];
    const pick = (arr, n) => arr[Math.abs(n) % arr.length];
    const npcBody = isPolice ? 0x1f3348 : isBoss ? 0xd8d1c1 : isGang ? 0x5d2523 : pick(bodyPalette, bodyColor);
    const jacket = isPlayer ? this.mat.playerJacket : this.toon(npcBody);
    const pants = this.toon(isPolice ? 0x1d2a3a : pick(pantsPalette, variant * 7 + (isBoss ? 2 : 0)));
    const accent = this.toon(isPlayer ? 0xb64032 : isBoss ? 0xc9a227 : isGang ? 0x8e2f32 : pick(trimPalette, variant + 1));
    const skin = this.toon(pick(skinPalette, variant * 3 + (style.skin || 0)));
    const hair = isPunk ? accent : (isWorker ? this.mat.woodDark : isTourist ? this.mat.wood : this.mat.playerHair);
    const leather = this.mat.metalDark;
    const gold = this.mat.trim;
    const white = this.mat.white;

    // ---------- 躯干：前襟、腰带、下摆和领口分开建，近看不再是一块彩色方盒 ----------
    // 体型有宽窄变化，避免整条街的 NPC 都共用同一个方盒轮廓。
    const buildW = isWorker ? 1.10 : isPunk ? 0.94 : isElder ? 0.94 : 1.0;
    const body = this.mk(g, this.geo.box, jacket, 0, 1.86, 0, 0.52 * buildW, 1.18, 0.86 * buildW);
    const waist = this.mk(g, this.geo.box, pants, 0, 1.23, 0, 0.47 * buildW, 0.22, 0.72 * buildW);
    // 衬衫只露一条前襟，而不是一块白色方纸；领带/领巾再把视线拉回纵向。
    const shirt = this.mk(g, this.geo.box, white, 0.265, 2.02, 0, 0.05, 0.42, 0.24);
    shirt.castShadow = false;
    if (!isPolice && !isBoss && !isWorker && !isGang) {
      const tie = this.mk(g, this.geo.box, accent, 0.276, 2.12, 0, 0.045, 0.30, 0.070);
      tie.castShadow = false;
    }
    const belt = this.mk(g, this.geo.box, leather, 0, 1.33, 0, 0.54 * buildW, 0.11, 0.82 * buildW);
    const buckle = this.mk(g, this.geo.box, gold, 0.286, 1.33, 0, 0.045, 0.14, 0.17);
    buckle.castShadow = false;
    this.mk(g, this.geo.box, accent, 0.267, 2.21, 0, 0.06, 0.18, 0.69);
    // 双排扣
    for (const z of [-0.16, 0.16]) for (const y of [1.55, 1.78]) {
      const btn = this.mk(g, this.geo.sphereLow, gold, 0.294, y, z, 0.035, 0.035, 0.035);
      btn.castShadow = false;
    }
    // 领子和围巾：玩家是红围巾，NPC 随造型变化
    this.mk(g, this.geo.box, accent, 0.24, 2.34, 0, 0.18, 0.12, 0.42);
    const collarL = this.mk(g, this.geo.box, jacket, 0.22, 2.34, -0.28, 0.17, 0.25, 0.15);
    collarL.rotation.z = -0.30;
    const collarR = this.mk(g, this.geo.box, jacket, 0.22, 2.34, 0.28, 0.17, 0.25, 0.15);
    collarR.rotation.z = 0.30;
    // 后摆/风衣尾巴
    if (!isPlayer && (isGang || isBusiness || isElder)) {
      const tailMat = isGang ? leather : jacket;
      const tail = this.mk(g, this.geo.box, tailMat, -0.22, 1.06, 0, 0.38, 0.82, 0.84);
      tail.rotation.z = 0;
      const tailL = this.mk(g, this.geo.box, tailMat, -0.25, 0.96, -0.32, 0.34, 0.58, 0.22);
      const tailR = this.mk(g, this.geo.box, tailMat, -0.25, 0.96, 0.32, 0.34, 0.58, 0.22);
      tailL.rotation.z = -0.16; tailR.rotation.z = -0.16;
    }
    if (isPolice) {
      const vest = this.mk(g, this.geo.box, leather, 0.02, 1.93, 0, 0.58, 1.02, 0.80);
      vest.castShadow = true;
      const badge = this.mk(g, this.geo.box, gold, 0.31, 2.13, -0.23, 0.04, 0.15, 0.11);
      badge.castShadow = false;
    }
    if (isBoss) {
      this.mk(g, this.geo.box, leather, 0.272, 2.04, 0, 0.05, 0.58, 0.3);
      this.mk(g, this.geo.box, gold, 0.31, 1.92, 0, 0.03, 0.5, 0.06);
    }
    if (isWorker) {
      this.mk(g, this.geo.box, accent, 0, 1.87, 0, 0.58, 0.82, 0.88);
      this.mk(g, this.geo.box, leather, 0, 1.35, 0, 0.55, 0.16, 0.84);
      for (const z of [-0.24, 0.24]) this.mk(g, this.geo.box, leather, 0.31, 1.38, z, 0.10, 0.17, 0.16);
    }
    if (isTourist) {
      // 游客：背包和外扩的下摆，让人群侧面也有第二种轮廓。
      this.mk(g, this.geo.box, jacket, 0, 1.04, 0, 0.54, 0.48, 0.86);
      this.mk(g, this.geo.box, accent, 0, 1.27, 0, 0.56, 0.055, 0.88);
      const pack = this.mk(g, this.geo.box, leather, -0.39, 1.96, 0, 0.22, 0.62, 0.54);
      pack.castShadow = true;
      for (const z of [-0.22, 0.22]) this.mk(g, this.geo.box, accent, -0.30, 1.96, z, 0.035, 0.55, 0.075);
    }
    if (isPunk) {
      for (const z of [-0.3, -0.16, 0, 0.16, 0.3]) {
        const spike = this.mk(g, this.geo.cone4, hair, 0.02, 3.03, z, 0.12, 0.36, 0.12);
        spike.rotation.z = -0.15;
      }
    }

    // ---------- 头：五官、耳朵、下颌、头发全部按 +X 正面放置 ----------
    const neck = this.mk(g, this.geo.cyl, skin, 0, 2.43, 0, 0.17, 0.17, 0.17);
    const head = this.mk(g, this.geo.sphere, skin, 0, 2.70, 0, 0.37, 0.42, 0.35);
    const jaw = this.mk(g, this.geo.box, skin, 0.24, 2.57, 0, 0.16, 0.18, 0.30);
    const nose = this.mk(g, this.geo.box, skin, 0.365, 2.66, 0, 0.09, 0.11, 0.09);
    nose.rotation.z = -0.18;
    for (const z of [-0.135, 0.135]) {
      const eye = this.mk(g, this.geo.box, this.mat.eyeWhite || white, 0.333, 2.74, z, 0.035, 0.075, 0.09);
      eye.castShadow = false;
      const pupil = this.mk(g, this.geo.box, this.mat.eyeDark || leather, 0.36, 2.73, z, 0.024, 0.042, 0.045);
      pupil.castShadow = false;
      const brow = this.mk(g, this.geo.box, hair, 0.34, 2.82, z, 0.035, 0.035, 0.115);
      brow.castShadow = false;
    }
    this.mk(g, this.geo.box, this.mat.eyeDark || leather, 0.335, 2.53, 0, 0.025, 0.025, 0.13);
    for (const z of [-0.34, 0.34]) this.mk(g, this.geo.sphereLow, skin, 0, 2.68, z, 0.075, 0.115, 0.065);
    const hairM = this.mk(g, this.geo.sphereLow, hair, -0.015, 2.86, 0, 0.385, 0.24, 0.37);
    this.mk(g, this.geo.box, hair, -0.30, 2.70, 0, 0.10, 0.36, 0.58);
    this.mk(g, this.geo.box, hair, -0.09, 2.94, 0, 0.25, 0.10, 0.40);

    // 帽子/发型：每一种轮廓都能从背后认出来
    if (isPlayer || isBusiness || isElder) {
      const brim = this.mk(g, this.geo.cylLow, isPlayer ? hair : leather, 0, 3.02, 0, 0.62, 0.06, 0.62);
      brim.castShadow = true;
      const crown = this.mk(g, this.geo.cyl, isPlayer ? hair : leather, 0, 3.14, 0, 0.34, 0.27, 0.34);
      crown.castShadow = true;
      this.mk(g, this.geo.cyl, accent, 0, 3.00, 0, 0.365, 0.055, 0.365);
      if (isPlayer) this.mk(g, this.geo.box, this.mat.vermilion, 0.02, 3.12, 0, 0.24, 0.035, 0.54);
    } else if (isPolice) {
      const cap = this.mk(g, this.geo.cylLow, leather, 0, 3.02, 0, 0.50, 0.10, 0.50);
      cap.castShadow = true;
      this.mk(g, this.geo.box, leather, 0.30, 3.01, 0, 0.30, 0.055, 0.48);
      this.mk(g, this.geo.box, gold, 0.47, 3.10, 0, 0.04, 0.11, 0.12);
    } else if (isWorker) {
      const helmet = this.mk(g, this.geo.sphereLow, this.mat.trafficYellow, 0, 2.98, 0, 0.40, 0.22, 0.38);
      helmet.castShadow = true;
      this.mk(g, this.geo.box, this.mat.trafficYellow, 0.27, 2.95, 0, 0.25, 0.05, 0.36);
    } else if (isPunk) {
      // 莫西干已经在上方生成
    } else if (isTourist) {
      this.mk(g, this.geo.cylLow, accent, 0, 2.98, 0, 0.48, 0.08, 0.48);
      this.mk(g, this.geo.box, accent, 0.28, 2.98, 0, 0.28, 0.07, 0.38);
      this.mk(g, this.geo.box, leather, 0.35, 2.72, 0, 0.04, 0.10, 0.19);
    } else if (isGang) {
      this.mk(g, this.geo.box, accent, 0.31, 2.53, 0, 0.08, 0.20, 0.39);
      const beanie = this.mk(g, this.geo.sphereLow, hair, 0, 2.97, 0, 0.40, 0.24, 0.38);
      beanie.castShadow = true;
    } else if (isBoss) {
      const brim = this.mk(g, this.geo.cylLow, this.mat.metalDark, 0, 3.03, 0, 0.64, 0.065, 0.64);
      brim.castShadow = true;
      this.mk(g, this.geo.cyl, this.mat.metalDark, 0, 3.15, 0, 0.35, 0.27, 0.35);
      this.mk(g, this.geo.box, this.mat.eyeDark || leather, 0.36, 2.72, 0, 0.035, 0.075, 0.28);
      this.mk(g, this.geo.box, gold, 0.31, 1.92, 0, 0.035, 0.46, 0.06);
    } else if (isElder) {
      this.mk(g, this.geo.box, white, 0.34, 2.54, 0, 0.05, 0.20, 0.30);
      const cane = this.mk(g, this.geo.cyl, this.mat.woodDark, 0.45, 0.68, 0.55, 0.045, 1.12, 0.045);
      cane.rotation.z = -0.13;
    } else if (isHoodie) {
      const hood = this.mk(g, this.geo.sphereLow, jacket, -0.10, 2.56, 0, 0.34, 0.34, 0.46);
      hood.castShadow = true;
      this.mk(g, this.geo.box, accent, 0.28, 1.60, 0, 0.05, 0.22, 0.35);
    } else {
      this.mk(g, this.geo.box, this.mat.metalDark, 0.035, 2.94, 0, 0.30, 0.08, 0.38);
      this.mk(g, this.geo.box, this.mat.metalDark, 0.28, 2.94, 0, 0.25, 0.06, 0.36);
    }

    // ---------- 四肢：用肩/髋关节组做支点，摆臂摆腿不再绕脚底转 ----------
    const makeArm = (side, hasBag) => {
      const arm = new T.Group();
      arm.position.set(0, 2.31, side * 0.53);
      g.add(arm);
      const shoulderPad = this.mk(arm, this.geo.box, jacket, 0, -0.055, 0, 0.30, 0.22, 0.33);
      shoulderPad.rotation.z = side * 0.04;
      shoulderPad.castShadow = true;
      const sleeve = this.mk(arm, this.geo.box, jacket, 0, -0.42, 0, 0.27, 0.88, 0.29);
      sleeve.castShadow = true;
      this.mk(arm, this.geo.box, accent, 0, -0.80, 0, 0.23, 0.10, 0.27);
      this.mk(arm, this.geo.box, isPlayer ? leather : jacket, 0, -0.85, 0, 0.24, 0.28, 0.24);
      this.mk(arm, this.geo.sphereLow, isPlayer ? leather : skin, 0.02, -1.05, 0, 0.18, 0.18, 0.18);
      if (hasBag) {
        const bag = this.mk(arm, this.geo.box, leather, -0.16, -1.10, 0, 0.28, 0.36, 0.22);
        bag.rotation.z = 0.24;
      }
      return arm;
    };
    const armL = makeArm(-1, isTourist || isBusiness);
    const armR = makeArm(1, false);
    const makeLeg = (side) => {
      const leg = new T.Group();
      leg.position.set(0, 1.29, side * 0.23);
      g.add(leg);
      this.mk(leg, this.geo.box, pants, 0, -0.45, 0, 0.32, 0.92, 0.33);
      this.mk(leg, this.geo.box, pants, 0.02, -0.91, 0, 0.31, 0.22, 0.31);
      this.mk(leg, this.geo.box, leather, 0.10, -1.07, 0, 0.45, 0.18, 0.33);
      this.mk(leg, this.geo.box, leather, 0.10, -1.17, 0, 0.47, 0.06, 0.35);
      return leg;
    };
    const legL = makeLeg(-1);
    const legR = makeLeg(1);

    // ---------- 武器挂点：本地 +X 是枪口，NPC 可以绕 Y 轴独立瞄准 ----------
    const gunMount = new T.Group();
    gunMount.position.set(0.26, 2.02, 0.37);
    g.add(gunMount);
    const weaponModels = {}, weaponLens = {};
    const buildWeapon = (key, len, y, z) => {
      const w = new T.Group();
      w.visible = false;
      gunMount.add(w);
      weaponModels[key] = w; weaponLens[key] = len;
      return w;
    };
    const pistol = buildWeapon("pistol", 0.62, 0, 0);
    this.mk(pistol, this.geo.box, leather, 0.18, 0, 0, 0.62, 0.16, 0.18);
    const pgrip = this.mk(pistol, this.geo.box, this.mat.woodDark, -0.10, -0.14, 0, 0.18, 0.30, 0.16);
    pgrip.rotation.z = -0.22;
    this.mk(pistol, this.geo.box, this.mat.metal, 0.48, 0, 0, 0.22, 0.08, 0.14);
    const smg = buildWeapon("smg", 0.78, 0, 0);
    this.mk(smg, this.geo.box, leather, 0.18, 0, 0, 0.78, 0.20, 0.20);
    this.mk(smg, this.geo.box, this.mat.metalDark, 0.58, 0.03, 0, 0.32, 0.09, 0.14);
    this.mk(smg, this.geo.box, this.mat.metalDark, 0.06, -0.22, 0, 0.16, 0.34, 0.15);
    this.mk(smg, this.geo.box, this.mat.metal, 0.05, 0.14, 0, 0.16, 0.08, 0.20);
    this.mk(smg, this.geo.box, accent, -0.18, -0.02, 0, 0.18, 0.22, 0.17);
    const shotgun = buildWeapon("shotgun", 1.02, 0, 0);
    this.mk(shotgun, this.geo.box, leather, 0.28, 0, 0, 1.00, 0.13, 0.16);
    this.mk(shotgun, this.geo.box, this.mat.wood, 0.48, -0.07, 0, 0.44, 0.10, 0.14);
    this.mk(shotgun, this.geo.box, this.mat.woodDark, -0.25, -0.14, 0, 0.30, 0.30, 0.15);
    const rifle = buildWeapon("rifle", 1.18, 0, 0);
    this.mk(rifle, this.geo.box, leather, 0.20, 0, 0, 1.08, 0.14, 0.16);
    this.mk(rifle, this.geo.box, this.mat.metalDark, 0.22, 0.14, 0, 0.38, 0.10, 0.14);
    this.mk(rifle, this.geo.box, this.mat.metalDark, 0.06, -0.18, 0, 0.15, 0.28, 0.13);
    this.mk(rifle, this.geo.box, this.mat.woodDark, -0.30, -0.08, 0, 0.38, 0.20, 0.15);
    this.mk(rifle, this.geo.box, this.mat.rocketGlass || this.mat.neonCyan, 0.10, 0.26, 0, 0.18, 0.12, 0.10);
    const rocket = buildWeapon("rocket", 1.18, 0, 0);
    const rocketTube = this.mk(rocket, this.geo.cyl, leather, 0.24, 0, 0, 0.16, 1.02, 0.16);
    rocketTube.rotation.z = Math.PI / 2;
    this.mk(rocket, this.geo.cone, accent, 0.88, 0, 0, 0.18, 0.28, 0.18).rotation.z = -Math.PI / 2;
    this.mk(rocket, this.geo.box, leather, 0.02, -0.14, 0, 0.17, 0.28, 0.14);
    // NPC 的基本武器：警察/黑帮显示，平民不显示
    if (!isPlayer) {
      const npcKey = isPolice || isBoss ? "pistol" : isGang ? "smg" : null;
      if (npcKey && weaponModels[npcKey]) weaponModels[npcKey].visible = true;
      gunMount.visible = !!npcKey;
    }
    const muzzle = new T.Sprite(this.mat.glowWarm);
    muzzle.position.set(0.8, 0, 0); muzzle.scale.set(2.2, 2.2, 1);
    muzzle.visible = false; gunMount.add(muzzle);

    // 角色投影：贴地柔和阴影比真实阴影更便宜，也不会在低角度时闪烁。
    const sh = new T.Mesh(this.geo.plane, this.mat.shadow);
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.028; sh.scale.set(2.5, 2.1, 1);
    sh.castShadow = false; sh.receiveShadow = false; sh.renderOrder = 2; g.add(sh);

    if (isPlayer) {
      // 玩家专属红色风衣：后摆从中缝分开，走路和转身时能看见腿与枪套。
      const tailL = this.mk(g, this.geo.box, jacket, -0.20, 0.95, -0.27, 0.40, 0.76, 0.30);
      const tailR = this.mk(g, this.geo.box, jacket, -0.20, 0.95, 0.27, 0.40, 0.76, 0.30);
      tailL.rotation.x = 0.13; tailR.rotation.x = -0.13;
      tailL.rotation.z = 0.045; tailR.rotation.z = -0.045;
      // 背部覆片、短围巾尾和斜背枪带，让背面不再是一整块方盒。
      this.mk(g, this.geo.box, jacket, -0.285, 1.96, 0, 0.09, 0.72, 0.66);
      const scarfTail = this.mk(g, this.geo.box, this.mat.vermilion, -0.337, 2.12, 0.08, 0.05, 0.36, 0.14);
      scarfTail.rotation.z = -0.11; scarfTail.rotation.x = 0.07;
      const strap = this.mk(g, this.geo.box, leather, -0.365, 1.95, 0, 0.035, 1.02, 0.10);
      strap.rotation.x = -0.66;
      this.mk(g, this.geo.box, gold, -0.387, 1.95, 0, 0.035, 0.10, 0.12);
      this.mk(g, this.geo.box, this.mat.vermilion, 0.02, 2.34, 0, 0.34, 0.12, 0.56);
      // 后腰枪套与腰带金属扣。
      const holster = this.mk(g, this.geo.box, leather, -0.15, 1.05, 0.48, 0.20, 0.34, 0.13);
      holster.rotation.z = 0.12;
      for (const z of [-0.34, 0.34]) this.mk(g, this.geo.box, gold, -0.279, 1.33, z, 0.035, 0.10, 0.10);
      const hull = new T.Mesh(this.geo.box, this.mat.hull);
      hull.position.set(0, 1.87, 0); hull.scale.set(0.56, 1.14, 0.90); g.add(hull);
    }

    this.freezeChildren(g);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.traverseShadowReset(g);
    g.matrixAutoUpdate = false;
    g.updateMatrix();
    return {
      group: g, body: body, head: head, gun: gunMount, muzzle: muzzle,
      armL: armL, armR: armR, legL: legL, legR: legR,
      weaponModels: weaponModels, weaponLens: weaponLens,
      baseColor: npcBody, baseMat: jacket, flash: false, dead: false, scale: s,
      variant: variant,
    };
  },

  traverseShadowReset(g) {
    g.traverse((o) => {
      if (o.isMesh && o.material === this.mat.shadow) { o.castShadow = false; o.receiveShadow = false; }
    });
  },

  // 程序化车辆模块：所有车型共用一套低多边形零件，但通过比例、座舱、货斗、
  // 灯组和附件形成明显差异。参考了开源 low-poly city / vehicle kit 的模块化思路，
  // 几何与材质全部在本项目内生成，不引入外部模型或依赖。
  makeVehicleMesh(v) {
    const T = window.THREE, def = v.def, g = new T.Group();
    // 车身单独做纵向拉伸，轮胎保持正圆；0.55 的整体比例让轿车长度约为角色身高的四倍。
    // 车身下沿压到轮心附近，让轮胎真正装进车身下方，而不是像旧版一样悬空挂在地面。
    const hull = new T.Group();
    g.add(hull);
    const scale = 0.55;
    const len = def.h * 0.32, wid = def.w * 0.30;
    const type = v.type;
    const isBike = type === "bike";
    // 摩托没有轿车那么高的驾驶舱，不能沿用 2.2 的 hull 纵向拉伸，
    // 否则油箱、车灯和车架会飘在轮子上面。
    hull.scale.y = isBike ? 1.5 : 2.2;
    const isTruck = type === "truck";
    const isBus = type === "bus";
    const isVan = type === "van";
    const isSuv = type === "suv";
    const isPickup = type === "pickup";
    const isLimo = type === "limo";
    const isSports = type === "sports" || type === "muscle";
    const isTaxi = type === "taxi";
    const isPolice = type === "police";
    const bodyMat = this.mat.carPaint;
    const bodyGeo = this.carPaintGeo(v.color);
    const paintParts = [];
    const paint = (x, y, z, sx, sy, sz, rz) => {
      const m = this.mk(hull, bodyGeo, bodyMat, x, y, z, sx, sy, sz);
      if (rz) m.rotation.z = rz;
      paintParts.push(m);
      return m;
    };
    const dark = (x, y, z, sx, sy, sz, mat) => this.mk(hull, this.geo.box, mat || this.mat.metalDark, x, y, z, sx, sy, sz);
    const chrome = (x, y, z, sx, sy, sz) => this.mk(hull, this.geo.box, this.mat.metal, x, y, z, sx, sy, sz);
    const glass = (x, y, z, sx, sy, sz) => this.mk(hull, this.geo.box, this.mat.glass, x, y, z, sx, sy, sz);
    // 轮胎再放大一档，车身压低：车顶/车窗占更多比例，侧面不再是一整块厚钢板。
    const wheelR = isBike ? 1.55 : isBus ? 2.70 : isTruck ? 2.50 : isVan ? 2.45 : (isSuv || isPickup) ? 2.30 : isSports ? 2.10 : isLimo ? 2.25 : 2.30;
    let bodyY = 1.92;
    let bodyH = 1.65;
    let lightY = 0;
    let cabin = null;
    let body = null;
    const carH = isSports ? 1.25 : isLimo ? 1.50 : 1.65;
    const carY = isSports ? 1.72 : isLimo ? 1.88 : (isSuv || isPickup) ? 2.00 : 1.92;
    bodyY = carY; bodyH = carH;
    const floorY = () => bodyY - bodyH * 0.5;

    if (isBike) {
      // 摩托：钢管车架 + 油箱 + 座垫 + 双轮，细节比旧版单块盒子完整
      const tank = paint(len * 0.10, wheelR + 1.02, 0, len * 0.34, 0.72, wid * 0.58);
      tank.castShadow = true;
      body = tank;
      dark(-len * 0.14, wheelR + 1.02, 0, len * 0.42, 0.24, wid * 0.38, this.mat.leather || this.mat.metalDark);
      // 低车架、发动机块和后摇臂把油箱与轮心连接起来。
      dark(0, wheelR + 0.24, 0, len * 0.46, 0.16, 0.16);
      dark(0, wheelR + 0.30, 0, len * 0.22, 0.44, wid * 0.30, this.mat.metalDark);
      const swing = dark(-len * 0.22, wheelR + 0.08, 0, len * 0.38, 0.10, 0.14);
      swing.rotation.z = -0.24;
      const fork = dark(len * 0.38, wheelR + 0.56, 0, 0.12, 1.26, 0.12);
      fork.rotation.z = 0.34;
      const bar = dark(len * 0.38, wheelR + 1.16, 0, 0.10, 0.10, wid * 0.84);
      const seat = this.mk(hull, this.geo.box, this.mat.metalDark, -len * 0.20, wheelR + 1.22, 0, len * 0.30, 0.18, wid * 0.42);
      seat.rotation.z = 0.08;
      this.mk(hull, this.geo.cyl, this.mat.metal, -len * 0.34, wheelR + 0.44, 0.20, 0.09, 1.0, 0.09).rotation.z = Math.PI / 2;
      this.mk(hull, this.geo.box, this.mat.headlight, len * 0.48, wheelR + 0.92, 0, 0.16, 0.26, 0.34);
      this.mk(hull, this.geo.box, this.mat.taillight, -len * 0.48, wheelR + 0.92, 0, 0.12, 0.20, 0.28);
      lightY = wheelR + 0.92;
    } else {
      // 主车身、底盘、前后盖
      if (isBus) { bodyY = 3.08; bodyH = 4.15; }
      else if (isTruck) { bodyY = 1.98; bodyH = 1.65; }
      else if (isVan) { bodyY = 2.50; bodyH = 2.85; }
      else if (isSuv) { bodyY = 2.00; bodyH = 1.72; }
      else if (isPickup) { bodyY = 1.98; bodyH = 1.65; }

      lightY = bodyY - bodyH * 0.16;
      const chassis = dark(0, floorY() + 0.12, 0, len * 0.94, 0.32, wid * 0.90);
      chassis.castShadow = true;
      if (isTruck) {
        body = paint(len * 0.28, bodyY, 0, len * 0.38, bodyH, wid * 0.92);
        paint(len * 0.28, bodyY + bodyH * 0.42, 0, len * 0.36, 0.25, wid * 0.95);
        cabin = glass(len * 0.29, bodyY + bodyH * 0.43, 0, len * 0.18, 0.90, wid * 0.80);
        // 货箱：竖向筋条和双开后门让它一眼区别于厢式车
        const cargoY = bodyY + 0.55;
        const cargo = paint(-len * 0.20, cargoY, 0, len * 0.72, 3.05, wid * 0.97);
        cargo.castShadow = true;
        for (let i = -2; i <= 2; i++) dark(-len * 0.20 + i * len * 0.13, cargoY, 0, 0.08, 3.05, wid * 1.01, this.mat.metalDark);
        dark(-len * 0.56, cargoY, 0, 0.10, 2.90, wid * 0.96);
        this.mk(hull, this.geo.box, this.mat.taillight, -len * 0.565, bodyY - 0.15, 0, 0.10, 0.15, wid * 0.58);
      } else if (isBus) {
        body = paint(0, bodyY, 0, len, bodyH, wid);
        paint(0, bodyY + 0.48, 0, len * 0.99, 0.22, wid * 1.015);
        // 侧窗带、前风挡、车门与车顶空调
        glass(0, bodyY + 0.75, 0, len * 0.94, 1.08, wid * 1.015);
        glass(len * 0.43, bodyY + 0.40, 0, len * 0.14, 1.55, wid * 0.95);
        dark(len * 0.31, bodyY - 0.38, wid * 0.49, len * 0.13, 1.65, 0.12);
        dark(-len * 0.34, bodyY - 0.38, wid * 0.49, len * 0.13, 1.65, 0.12);
        dark(0, bodyY + bodyH * 0.5 + 0.12, 0, len * 0.48, 0.28, wid * 0.62);
        this.mk(hull, this.geo.box, this.mat.neonCyan, len * 0.30, bodyY + 1.42, 0, len * 0.22, 0.28, wid * 0.74);
        dark(0, bodyY - bodyH * 0.5 + 0.25, 0, len * 0.97, 0.12, wid * 0.98);
        // 车尾玻璃、双开门缝和路线灯条，形成可以辨认的公交尾部轮廓。
        dark(-len * 0.504, bodyY + 0.45, 0, 0.022, 0.92, wid * 0.78);
        glass(-len * 0.510, bodyY + 0.45, 0, 0.018, 0.78, wid * 0.68);
        dark(-len * 0.514, bodyY + 0.45, 0, 0.014, 0.88, 0.045);
        this.mk(hull, this.geo.box, this.mat.neonCyan, -len * 0.515, bodyY + 1.48, 0, 0.016, 0.16, wid * 0.36);
      } else if (isVan) {
        body = paint(0, bodyY, 0, len, bodyH, wid);
        // 更高的厢体、短鼻子、前风挡、侧窗带、后开双门和后窗；车尾不再用整块黑板封死。
        paint(len * 0.38, bodyY - 0.28, 0, len * 0.24, 1.55, wid * 0.94);
        glass(len * 0.506, bodyY + 0.82, 0, 0.025, 1.18, wid * 0.78);
        for (const z of [-1, 1]) dark(len * 0.508, bodyY + 0.82, z * wid * 0.40, 0.03, 1.16, 0.05);
        glass(len * 0.33, bodyY + 0.72, 0, len * 0.22, 1.15, wid * 0.88);
        glass(-len * 0.04, bodyY + 0.72, 0, len * 0.36, 0.95, wid * 1.015);
        for (const z of [-1, 1]) {
          dark(-len * 0.05, bodyY - 0.62, z * wid * 0.507, len * 0.76, 0.06, 0.03);
          dark(len * 0.05, bodyY - 0.15, z * wid * 0.507, 0.05, bodyH * 0.66, 0.025);
          paint(len * 0.40, bodyY + 0.55, z * wid * 0.62, 0.20, 0.16, 0.34);
          dark(-len * 0.05, bodyY + 0.82, z * wid * 0.512, len * 0.34, 0.05, 0.025);
        }
        dark(-len * 0.507, bodyY - 0.08, 0, 0.018, bodyH * 0.82, 0.035);
        dark(-len * 0.507, bodyY - 0.08, -wid * 0.17, 0.018, bodyH * 0.76, 0.045);
        dark(-len * 0.507, bodyY - 0.08, wid * 0.17, 0.018, bodyH * 0.76, 0.045);
        dark(-len * 0.509, bodyY + 0.82, 0, 0.022, 0.96, wid * 0.70);
        glass(-len * 0.516, bodyY + 0.82, 0, 0.018, 0.82, wid * 0.60);
        chrome(-len * 0.518, bodyY - 0.40, -wid * 0.30, 0.03, 0.07, 0.17);
        chrome(-len * 0.518, bodyY - 0.40, wid * 0.30, 0.03, 0.07, 0.17);
        const wiper = dark(-len * 0.520, bodyY + 0.88, 0, 0.015, 0.035, 0.26);
        wiper.rotation.x = 0.24;
        dark(-len * 0.10, bodyY + bodyH * 0.5 + 0.10, -wid * 0.34, len * 0.32, 0.10, 0.09);
        dark(-len * 0.10, bodyY + bodyH * 0.5 + 0.10, wid * 0.34, len * 0.32, 0.10, 0.09);
        dark(len * 0.18, bodyY + bodyH * 0.5 + 0.12, 0, len * 0.16, 0.10, wid * 0.24);
        // 前格栅、下保险杠和车侧防擦条，补足车头的识别面。
        dark(len * 0.505, bodyY - 0.48, 0, 0.025, 0.55, wid * 0.58);
        chrome(len * 0.512, bodyY - 0.78, 0, 0.03, 0.10, wid * 0.72);
        dark(len * 0.10, floorY() + 0.20, 0, len * 0.10, 0.12, wid * 1.02);
      } else if (isPickup) {
        body = paint(len * 0.16, bodyY, 0, len * 0.54, bodyH, wid * 0.94);
        paint(len * 0.14, bodyY + bodyH * 0.42, 0, len * 0.52, 0.28, wid * 0.96);
        cabin = glass(len * 0.18, bodyY + bodyH * 0.50, 0, len * 0.28, 0.90, wid * 0.80);
        const cabTop = bodyY + bodyH * 0.5 + 0.50;
        paint(len * 0.18, cabTop, 0, len * 0.30, 0.12, wid * 0.86);
        // 开放货斗，三段箱板和尾门；高度跟随车身而不是跟轮胎走。
        const bedY = bodyY + bodyH * 0.5;
        paint(-len * 0.25, bedY, 0, len * 0.56, 0.18, wid * 0.90);
        // 货斗侧板向下延伸到车底，轮子不再悬在一条薄板下面。
        paint(-len * 0.25, bodyY + 0.02, -wid * 0.455, len * 0.56, bodyH * 0.62, 0.10);
        paint(-len * 0.25, bodyY + 0.02, wid * 0.455, len * 0.56, bodyH * 0.62, 0.10);
        paint(-len * 0.52, bodyY + 0.02, 0, 0.10, bodyH * 0.62, wid * 0.92);
        dark(-len * 0.25, bedY + 0.15, -wid * 0.46, len * 0.56, 0.22, 0.10);
        dark(-len * 0.25, bedY + 0.15, wid * 0.46, len * 0.56, 0.22, 0.10);
        dark(-len * 0.51, bedY + 0.15, 0, 0.10, 0.22, wid * 0.94);
        this.mk(hull, this.geo.box, this.mat.metalDark, -len * 0.22, bedY + 0.38, 0, len * 0.20, 0.16, wid * 0.38);
      } else if (isSuv) {
        body = paint(0, bodyY, 0, len, bodyH, wid);
        paint(0, bodyY + bodyH * 0.5 + 0.06, 0, len * 0.94, 0.20, wid * 0.96);
        cabin = glass(-len * 0.03, bodyY + bodyH * 0.78, 0, len * 0.54, 1.18, wid * 0.84);
        paint(-len * 0.03, bodyY + bodyH * 0.78 + 0.64, 0, len * 0.50, 0.18, wid * 0.86);
        for (const z of [-1, 1]) {
          dark(-len * 0.03, bodyY + bodyH * 0.78 + 0.78, z * wid * 0.34, len * 0.56, 0.08, 0.10, this.mat.metal);
        }
        // 后挂备胎和底部护板
        const spare = this.mk(hull, this.geo.cyl, this.mat.tire || this.mat.metalDark, -len * 0.54, bodyY + 0.12, 0, wheelR * 0.56, 0.35, wheelR * 0.56);
        spare.rotation.z = Math.PI / 2;
        dark(0, wheelR + 0.12, 0, len * 0.48, 0.14, wid * 0.55, this.mat.metal);
      } else if (isLimo) {
        body = paint(0, bodyY, 0, len, bodyH, wid);
        cabin = glass(-len * 0.02, bodyY + 0.88, 0, len * 0.74, 1.12, wid * 0.84);
        paint(-len * 0.02, bodyY + 1.50, 0, len * 0.70, 0.18, wid * 0.86);
        for (let i = -2; i <= 2; i++) dark(-len * 0.02 + i * len * 0.14, bodyY + 0.88, wid * 0.49, 0.09, 1.08, 0.07);
        const skirtY = floorY() + 0.10;
        this.mk(hull, this.geo.box, this.mat.neonPink, 0, skirtY, wid * 0.36, len * 0.88, 0.06, 0.05);
        this.mk(hull, this.geo.box, this.mat.neonCyan, 0, skirtY, -wid * 0.36, len * 0.88, 0.06, 0.05);
      } else {
        // 轿车 / 跑车 / 肌肉车 / 出租 / 警车
        body = paint(0, bodyY, 0, len, bodyH, wid);
        paint(len * 0.31, bodyY + 0.27, 0, len * 0.35, 0.28, wid * 0.94);
        paint(-len * 0.38, bodyY + 0.25, 0, len * 0.22, 0.30, wid * 0.90);
        const cabinLen = isSports ? len * 0.42 : len * 0.48;
        const cabinH = isSports ? 0.86 : 1.18;
        const cy = bodyY + bodyH * 0.5 + cabinH * 0.5 - 0.10;
        const cx = isSports ? -len * 0.08 : -len * 0.06;
        cabin = glass(cx, cy, 0, cabinLen, cabinH, wid * 0.82);
        paint(cx, cy + cabinH * 0.5 + 0.05, 0, cabinLen * 0.84, 0.18, wid * 0.84);
        for (const z of [-1, 1]) dark(cx, cy - cabinH * 0.46, z * wid * 0.415, cabinLen * 0.96, 0.045, 0.028);
        // 前挡风玻璃向后倾斜，车顶不再像积木
        const ws = glass(cx + cabinLen * 0.45, cy + 0.02, 0, 0.12, cabinH * 0.96, wid * 0.80);
        ws.rotation.z = -0.30;
        glass(cx - cabinLen * 0.48, cy, 0, 0.12, cabinH * 0.86, wid * 0.78);
        // A/B/C 柱与门缝
        for (const z of [-1, 1]) {
          dark(cx + cabinLen * 0.43, cy, z * wid * 0.41, 0.09, cabinH, 0.12);
          dark(cx - cabinLen * 0.05, cy, z * wid * 0.41, 0.08, cabinH, 0.10);
          const mir = paint(len * 0.13, cy - 0.12, z * wid * 0.56, 0.32, 0.16, 0.46);
          mir.castShadow = true;
        }
        if (isSports) {
          // 车尾只留一道贴紧行李厢盖的薄唇边，不再出现悬空尾翼。
          paint(-len * 0.455, bodyY + bodyH * 0.5 + 0.018, 0, len * 0.16, 0.035, wid * 0.62);
          paint(len * 0.33, bodyY + bodyH * 0.5 + 0.12, 0, len * 0.18, 0.14, wid * 0.35);
          // 贯穿式尾灯带，夜间追尾视角不再只剩两块小方灯。
          this.mk(hull, this.geo.box, this.mat.taillight, -len * 0.514, lightY, 0, 0.020, 0.12, wid * 0.60).castShadow = false;
          for (const z of [-1, 1]) {
            this.mk(hull, this.geo.cyl, this.mat.metal, -len * 0.505, floorY() + 0.20, z * wid * 0.22, 0.09, 0.24, 0.09).rotation.z = Math.PI / 2;
          }
          const ug = new T.Sprite(this.mat.glowCyan);
          ug.position.set(0, 0.28, 0); ug.scale.set(len * 0.70, wid * 0.52, 1); g.add(ug); g.userData.underglow = ug;
        }
        if (type === "muscle") {
          paint(len * 0.10, bodyY + bodyH * 0.5 + 0.14, 0, len * 0.62, 0.07, wid * 0.16);
          for (const z of [-1, 1]) this.mk(hull, this.geo.cyl, this.mat.metal, -len * 0.51, 0.58, z * wid * 0.28, 0.10, 0.42, 0.10).rotation.z = Math.PI / 2;
        }
        if (isTaxi) {
          // 小号顶灯加黑色底座，避免整块米色板悬在车顶。
          const sign = this.mk(hull, this.geo.box, this.mat.trafficYellow, cx, cy + cabinH * 0.5 + 0.16, 0, len * 0.16, 0.22, 0.32);
          sign.castShadow = false;
          this.mk(hull, this.geo.box, this.mat.metalDark, cx, cy + cabinH * 0.5 + 0.035, 0, len * 0.17, 0.045, 0.34);
          dark(-len * 0.22, bodyY + 0.10, wid * 0.50, len * 0.56, 0.10, 0.05, this.mat.eyeDark || this.mat.metalDark);
          dark(-len * 0.22, bodyY + 0.10, -wid * 0.50, len * 0.56, 0.10, 0.05, this.mat.eyeDark || this.mat.metalDark);
        }
        if (isPolice) {
          // 真正的白色车门 + 深色警灯底座；之前 paint 的颜色覆盖参数没生效，
          // 车门被涂成了车身深蓝，整辆车看起来只是普通轿车。
          this.mk(hull, this.geo.box, this.mat.white, -len * 0.04, bodyY + 0.06, wid * 0.505, len * 0.34, 0.70, 0.045);
          this.mk(hull, this.geo.box, this.mat.white, -len * 0.04, bodyY + 0.06, -wid * 0.505, len * 0.34, 0.70, 0.045);
          // 白色车顶把黑白涂装从侧面也读成警车，而不是普通深蓝轿车。
          this.mk(hull, this.geo.box, this.mat.white, cx, cy + cabinH * 0.5 + 0.17, 0, cabinLen * 0.80, 0.055, wid * 0.80);
          if (!v.siren) {
            // 静态警灯条；若车辆带警报器，后续会生成可闪烁的红蓝灯组。
            this.mk(hull, this.geo.box, this.mat.metalDark, -len * 0.05, bodyY + bodyH * 0.5 + 1.27, 0, len * 0.30, 0.10, wid * 0.60);
            this.mk(hull, this.geo.box, this.mat.trafficRed, -len * 0.05, bodyY + bodyH * 0.5 + 1.36, wid * 0.15, len * 0.22, 0.16, wid * 0.22);
            this.mk(hull, this.geo.box, this.mat.headlight, -len * 0.05, bodyY + bodyH * 0.5 + 1.36, -wid * 0.15, len * 0.22, 0.16, wid * 0.22);
          }
          chrome(len * 0.52, floorY() + 0.22, 0, 0.18, 0.80, wid * 0.94);
        }
      }
      // 前后保险杠、牌照、车门缝/腰线和轮拱：这些细节决定近景能不能读成“车”。
      const foot = floorY();
      dark(len * 0.505, foot + 0.20, 0, 0.16, 0.28, wid * 0.92, this.mat.metalDark);
      dark(-len * 0.505, foot + 0.20, 0, 0.14, 0.26, wid * 0.90, this.mat.metalDark);
      this.mk(hull, this.geo.box, this.mat.white, len * 0.515, foot + 0.17, 0, 0.06, 0.16, wid * 0.30);
      this.mk(hull, this.geo.box, this.mat.white, -len * 0.515, foot + 0.17, 0, 0.06, 0.14, wid * 0.26);
      chrome(len * 0.512, foot + 0.34, 0, 0.035, 0.055, wid * 0.82);
      chrome(-len * 0.512, foot + 0.34, 0, 0.035, 0.045, wid * 0.76);

      if (!isBus && !isTruck && !isVan) {
        for (const z of [-1, 1]) {
          // 前后门缝、门把手和侧裙，把一整块车身切开。
          dark(-len * 0.06, bodyY + bodyH * 0.02, z * wid * 0.506, 0.035, bodyH * 0.58, 0.025);
          dark(-len * 0.29, bodyY + bodyH * 0.04, z * wid * 0.508, 0.022, bodyH * 0.50, 0.022);
          chrome(len * 0.10, bodyY + bodyH * 0.13, z * wid * 0.516, len * 0.17, 0.040, 0.040);
          chrome(-len * 0.14, bodyY + bodyH * 0.13, z * wid * 0.516, len * 0.14, 0.035, 0.035);
          dark(0, foot + 0.15, z * wid * 0.507, len * 0.62, 0.095, 0.035);
        }
        // 发动机盖/后备箱盖分缝，顶部不再是一整块平板。
        dark(len * 0.19, bodyY + bodyH * 0.5 + 0.011, 0, 0.020, 0.018, wid * 0.74);
        dark(-len * 0.25, bodyY + bodyH * 0.5 + 0.011, 0, 0.018, 0.018, wid * 0.70);
        // 前格栅只给轿车/跑车/出租/警车，厢车和巴士已有自己的前脸。
        dark(len * 0.505, lightY, 0, 0.030, 0.19, wid * 0.38);
        chrome(len * 0.512, lightY, 0, 0.022, 0.045, wid * 0.44);
      }
    }

    // ---------- 轮组：轮胎、轮毂、可旋转的轴心组 ----------
    // 轮胎复用已有的深色车身材质，避免每批车辆再多一份几乎相同的黑色材质。
    const wheelMat = this.mat.trafficBody || this.mat.tire || this.mat.metalDark;
    const wheels = [];
    let spots;
    if (isBike) spots = [[-1, 0], [1, 0]];
    else if (isBus || isTruck) spots = [[1, -1], [1, 1], [-0.72, -1], [-0.72, 1], [-0.46, -1], [-0.46, 1]];
    else spots = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const spot of spots) {
      const wg = new T.Group();
      if (isBike) wg.position.set(spot[0] * len * 0.38, wheelR, 0);
      else wg.position.set(spot[0] * len * 0.34, wheelR, spot[1] * wid * (isBus || isTruck ? 0.48 : 0.53));
      const tire = new T.Mesh(this.geo.cyl, wheelMat);
      tire.rotation.x = Math.PI / 2;
      tire.scale.set(wheelR, isBike ? 0.48 : (isTruck || isBus ? 0.92 : 0.68), wheelR);
      tire.castShadow = true; tire.receiveShadow = true; wg.add(tire);
      for (const z of [-1, 1]) {
        const rim = new T.Mesh(this.geo.cyl, this.mat.metal);
        rim.rotation.x = Math.PI / 2;
        rim.position.z = z * (isBike ? 0.25 : (isTruck || isBus ? 0.47 : 0.35));
        rim.scale.set(wheelR * 0.54, 0.035, wheelR * 0.54);
        rim.castShadow = false; wg.add(rim);
      }
      g.add(wg); wheels.push(wg);
    }
    // ---------- 灯组 / 警灯 / 出租顶灯：夜间和追尾视角的识别点 ----------
    const lights = [];
    for (const src of [-1, 1]) {
      const ll = this.mk(hull, this.geo.box, this.mat.headlight, len * 0.515, lightY, src * wid * 0.33, 0.20, 0.30, 0.54);
      ll.castShadow = false;
      const glow = new T.Sprite(this.mat.glowWarm);
      glow.position.set(len * 0.56, isBike ? lightY * 1.5 : lightY * 2.2, src * wid * 0.32); glow.scale.set(5.2, 5.2, 1);
      g.add(glow); lights.push(glow);
      this.mk(hull, this.geo.box, this.mat.taillight, -len * 0.515, lightY, src * wid * 0.33, 0.20, 0.30, 0.52).castShadow = false;
    }
    let sirenR = null, sirenB = null;
    if (v.siren) {
      if (!this.mat.sirenBlue) {
        this.mat.sirenBlue = new T.MeshBasicMaterial({ color: 0x3b82f6 });
        this.sharedMat(this.mat.sirenBlue);
      }
      const sy = (isPolice ? (bodyY + bodyH * 0.5 + 1.34) : bodyY + 1.60);
      sirenR = this.mk(hull, this.geo.box, this.mat.trafficRed, -len * 0.05, sy, -0.26, 0.78, 0.24, 0.46);
      sirenB = this.mk(hull, this.geo.box, this.mat.sirenBlue, -len * 0.05, sy, 0.26, 0.78, 0.24, 0.46);
      sirenR.castShadow = false; sirenB.castShadow = false;
    }
    // 出租车顶灯已在轿车分支生成，避免同一位置叠加两层灯箱。

    const sh = new T.Mesh(this.geo.plane, this.mat.shadow);
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.035; sh.scale.set(len * 1.08, wid * 1.22, 1);
    sh.castShadow = false; sh.receiveShadow = false; sh.renderOrder = 2; g.add(sh);
    this.freezeChildren(g);
    g.scale.setScalar(scale);
    g.position.set(v.x, 0, v.y);
    g.rotation.y = -v.heading;
    g.matrixAutoUpdate = false;
    g.updateMatrix();
    return {
      group: g, body: body, cabin: cabin, sirenR: sirenR, sirenB: sirenB,
      headGlows: lights, wheels: wheels, paintParts: paintParts,
      baseMat: bodyMat, wreckMat: null, wrecked: false, wheelAngle: 0,
      underglow: g.userData.underglow || null
    };
  },

  pickupMaterials(color) {
    let p = this.pickMatCache.get(color);
    if (p) return p;
    const T = window.THREE;
    const main = new T.MeshBasicMaterial({ color: color });
    const beam = new T.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.14, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
    const sprite = new T.SpriteMaterial({ map: this.tex.glow, color: color, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.7 });
    main.userData.cache = true; beam.userData.cache = true; sprite.userData.cache = true;
    p = { main: main, beam: beam, sprite: sprite };
    this.pickMatCache.set(color, p);
    return p;
  },

  makePickupMesh(color) {
    const T = window.THREE, g = new T.Group();
    const p = this.pickupMaterials(color);
    const icon = new T.Mesh(this.geo.octa, p.main);
    icon.position.y = 2.7; icon.scale.set(1.4, 1.4, 1.4);
    icon.castShadow = true; g.add(icon);
    const ring = new T.Mesh(this.geo.torus, p.main);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.9; ring.scale.set(3.2, 3.2, 3.2); g.add(ring);
    const beam = new T.Mesh(this.geo.cyl, p.beam);
    beam.position.y = 5.0; beam.scale.set(1.1, 9, 1.1); g.add(beam);
    const glow = new T.Sprite(p.sprite);
    glow.position.y = 2.8; glow.scale.set(8.5, 8.5, 1); g.add(glow);
    const sh = new T.Mesh(this.geo.plane, this.mat.shadow);
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.04; sh.scale.set(4.5, 4.5, 1);
    sh.castShadow = false; sh.receiveShadow = false; g.add(sh);
    this.freezeChildren(g);
    return { group: g, icon: icon, ring: ring, beam: beam, color: color };
  },

  markerMaterials(color) {
    let p = this.markerMats.get(color);
    if (p) return p;
    const T = window.THREE;
    const ring = new T.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.95 });
    const beam = new T.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.2, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending });
    const sprite = new T.SpriteMaterial({ map: this.tex.question, color: 0xffffff, transparent: true, depthWrite: false });
    ring.userData.cache = true; beam.userData.cache = true; sprite.userData.cache = true;
    p = { ring: ring, beam: beam, sprite: sprite };
    this.markerMats.set(color, p);
    return p;
  },

  makeMarkerMesh(color) {
    const T = window.THREE, g = new T.Group();
    const p = this.markerMaterials(color);
    const ring = new T.Mesh(this.geo.torus, p.ring);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.7; ring.scale.set(5, 5, 5); g.add(ring);
    const ring2 = new T.Mesh(this.geo.ring, p.ring);
    ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.12; ring2.scale.set(5.2, 5.2, 5.2);
    ring2.renderOrder = 2; g.add(ring2);
    const beam = new T.Mesh(this.geo.cyl, p.beam);
    beam.position.y = 9; beam.scale.set(1.0, 17, 1.0); g.add(beam);
    const question = new T.Sprite(p.sprite);
    question.position.y = 19; question.scale.set(7.5, 7.5, 1); g.add(question);
    this.freezeChildren(g);
    return { group: g, ring: ring, ring2: ring2, beam: beam, question: question, color: color };
  },

  recolorMarker(m, color) {
    if (m.color === color) return;
    const T = window.THREE;
    const p = this.markerMaterials(color);
    m.ring.material = p.ring; m.ring2.material = p.ring;
    m.beam.material = p.beam; m.question.material = p.sprite;
    m.color = color;
  },

  flashFx(x, y, r) {
    if (this.disabled || !this.scene) return;
    if (this.flashFxList.length > 12) return;
    const T = window.THREE;
    const mat = new T.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
    const m = new T.Mesh(this.geo.sphere, mat);
    m.position.set(x, 2.2, y);
    m.scale.setScalar(r * 0.28);
    this.scene.add(m);
    const light = new T.PointLight(0xff8b45, 3.8, 210, 1.4);
    light.position.set(x, 5, y);
    this.scene.add(light);
    this.flashFxList.push({ mesh: m, light: light, life: 0.24, max: 0.24, r: r });
  },

  syncEntities() {
    const T = window.THREE;
    const p = W.player;
    const pm = this.playerMesh;
    if (pm) {
      pm.group.visible = !p.vehicle && !p.dead;
      pm.group.position.set(p.x, 0, p.y);
      pm.group.rotation.y = -p.aim;

      // 玩家手腕上真正显示当前武器；切枪时只切可见模型，不重建角色。
      const wkey = p.weapon();
      if (pm._weapon !== wkey) {
        pm._weapon = wkey;
        for (const k in pm.weaponModels) pm.weaponModels[k].visible = (k === wkey);
      }
      const wm = pm.weaponModels[wkey];
      pm.gun.visible = !!wm;
      if (wm) {
        const wl = pm.weaponLens[wkey] || 0.8;
        pm.muzzle.position.set(wl, 0, 0);
      }
      pm.muzzle.visible = !!wm && p.muzzleT > 0 && !p.vehicle;
      if (pm.muzzle.visible) pm.muzzle.scale.setScalar(2.0 + p.muzzleT * 9);
      pm.muzzle.updateMatrix();

      const walk = Utils.clamp((p.moveSpeed || 0) / CFG.PLAYER.speed, 0, 1.35);
      let phase = p.walkPhase || 0;
      if (walk < 0.02) phase = (this._idlePhase = (this._idlePhase || 0) + 0.032);
      const sw = walk > 0.02 ? 0.12 + Math.min(1, walk) * 0.58 : 0.012;
      // 角色正面是 +X，所以前后摆腿应绕 Z 轴，而不是旧模型的 X 轴。
      pm.legL.rotation.z = Math.sin(phase) * sw;
      pm.legR.rotation.z = -Math.sin(phase) * sw;
      pm.armL.rotation.z = -Math.sin(phase) * sw * 0.55;
      pm.armR.rotation.z = Math.sin(phase) * sw * 0.55;
      if (W.aiming && !p.vehicle) {
        pm.armL.rotation.z = -0.16;
        pm.armR.rotation.z = 0.12;
      }
      pm.legL.updateMatrix(); pm.legR.updateMatrix();
      pm.armL.updateMatrix(); pm.armR.updateMatrix();
      pm.group.updateMatrix();
    }

    const vSet = this.vehSet, vMap = this.vehMap;
    vSet.clear(); vMap.clear();
    for (const v of W.vehicles) vSet.add(v);
    for (let i = this.vehs.length - 1; i >= 0; i--) {
      if (!vSet.has(this.vehs[i].v)) {
        this.scene.remove(this.vehs[i].m.group);
        this.disposeGroup(this.vehs[i].m.group);
        this.vehs.splice(i, 1);
      } else vMap.set(this.vehs[i].v, this.vehs[i]);
    }
    for (const v of W.vehicles) {
      let e = vMap.get(v);
      if (!e) {
        const m = this.makeVehicleMesh(v);
        this.scene.add(m.group);
        e = { v: v, m: m };
        this.vehs.push(e); vMap.set(v, e);
      }
      const m = e.m;
      m.group.position.set(v.x, 0, v.y);
      m.group.rotation.set(0, -v.heading, 0);
      if (v.wrecked && !m.wrecked) {
        m.wrecked = true;
        if (!m.wreckMat) m.wreckMat = new T.MeshToonMaterial({ color: 0x202326, gradientMap: this.tex.toon });
        if (m.paintParts) for (const p of m.paintParts) p.material = m.wreckMat;
        else if (m.body) m.body.material = m.wreckMat;
        if (m.cabin) m.cabin.visible = false;
        m.group.rotation.z = 0.16; m.group.rotation.x = 0.08;
        for (const gl of m.headGlows) gl.visible = false;
        if (m.underglow) m.underglow.visible = false;
      } else if (!v.wrecked && m.wrecked) {
        m.wrecked = false;
        if (m.paintParts) for (const p of m.paintParts) p.material = m.baseMat;
        else if (m.body) m.body.material = m.baseMat;
        if (m.cabin) m.cabin.visible = true;
        m.group.rotation.z = 0; m.group.rotation.x = 0;
        if (m.underglow) m.underglow.visible = true;
      }
      if (v.siren && m.sirenR) {
        const on = Math.floor(W.gameTime * 6) % 2;
        m.sirenR.visible = !on; m.sirenB.visible = !!on;
      }
      const showLights = this.night > 0.24 && !v.wrecked;
      for (const gl of m.headGlows) gl.visible = showLights;
      // 底盘灯只在夜间出现，避免白天停车场里出现一圈突兀的绿色光斑。
      if (m.underglow) m.underglow.visible = showLights;
      // 轮组绕自身 Z 轴滚动，低速时也能看出车在动。
      if (m.wheels && m.wheelAngle != null) {
        m.wheelAngle += (v.fs || 0) * (this.frameDt || 0.016) * 0.075;
        for (const w of m.wheels) { w.rotation.z = m.wheelAngle; w.updateMatrix(); }
      }
      m.group.updateMatrix();
    }

    const nSet = this.npcSet, nMap = this.npcMap;
    nSet.clear(); nMap.clear();
    for (const n of W.npcs) nSet.add(n);
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      if (!nSet.has(this.npcs[i].n)) {
        this.scene.remove(this.npcs[i].m.group);
        this.disposeGroup(this.npcs[i].m.group);
        this.npcs.splice(i, 1);
      } else nMap.set(this.npcs[i].n, this.npcs[i]);
    }
    for (let ni = 0; ni < W.npcs.length; ni++) {
      const n = W.npcs[ni];
      let e = nMap.get(n);
      if (!e) {
        let c = 0x94a3b8;
        if (n.police) c = 0x244b73;
        else if (n.gang) c = 0x712a27;
        else if (n.boss) c = 0xd9d1be;
        else if (n.clothes) c = parseInt(n.clothes.replace("#", ""), 16) || 0x94a3b8;
        const m = this.makeCharacter(c, n.boss ? 1.65 : (n.police ? 1.38 : 1.30 + (n.variant % 3) * 0.035), false, {
          variant: n.variant, skin: n.skin, police: n.police, boss: n.boss, gang: n.gang
        });
        this.scene.add(m.group);
        e = { n: n, m: m };
        this.npcs.push(e); nMap.set(n, e);
      }
      const m = e.m;
      if (n.dead) {
        if (!m.dead) {
          m.dead = true;
          m.group.rotation.z = Math.PI / 2;
          m.group.position.y = 1.25;
        }
        m.group.position.x = n.x; m.group.position.z = n.y;
        m.group.visible = true;
        m.group.updateMatrix();
      } else {
        if (m.dead) { m.dead = false; m.group.rotation.z = 0; m.group.position.y = 0; }
        m.group.visible = true;
        m.group.position.set(n.x, 0, n.y);
        m.group.rotation.y = -n.heading;
        m.gun.rotation.y = -(n.aimAngle - n.heading);
        m.gun.updateMatrix();
        const walking = n.state === "wander" || n.state === "chase" || n.state === "flee";
        const ph = W.gameTime * (walking ? 7.4 : 1.2) + ni * 1.7;
        const sw = walking ? 0.46 : 0.025;
        m.legL.rotation.z = Math.sin(ph) * sw;
        m.legR.rotation.z = -Math.sin(ph) * sw;
        m.armL.rotation.z = -Math.sin(ph) * sw * 0.55;
        m.armR.rotation.z = Math.sin(ph) * sw * 0.55;
        m.legL.updateMatrix(); m.legR.updateMatrix(); m.armL.updateMatrix(); m.armR.updateMatrix();
        m.group.updateMatrix();
        this.applyFlash(m, n.dmgFlash > 0.2, m.baseColor);
      }
    }
  },

  applyFlash(m, flashing) {
    if (!m.body || !m.body.material || m.body.material === this.mat.playerJacket) return;
    if (flashing) {
      if (!m.flash) {
        m.flash = true;
        m._flashMat = m.body.material;
        m.body.material = this.mat.flashWhite || this.mat.white;
      }
    } else if (m.flash) {
      m.flash = false;
      m.body.material = m._flashMat || m.baseMat;
    }
  },

  syncPickups(dt) {
    const T = window.THREE;
    const pSet = this.pkSet, pMap = this.pkMap;
    pSet.clear(); pMap.clear();
    for (const pk of W.pickups) pSet.add(pk);
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      if (!pSet.has(this.pickups[i].pk)) {
        this.scene.remove(this.pickups[i].m.group);
        this.disposeGroup(this.pickups[i].m.group);
        this.pickups.splice(i, 1);
      } else pMap.set(this.pickups[i].pk, this.pickups[i]);
    }
    for (let i = 0; i < W.pickups.length; i++) {
      const pk = W.pickups[i];
      let e = pMap.get(pk);
      if (!e) {
        let c = 0xeab308;
        if (pk.type === "money") c = 0x32d78a;
        else if (pk.type === "health") c = 0xff5b5b;
        else if (pk.type === "armor") c = 0x4cc9f0;
        else if (pk.type === "ammo") c = 0xffc14d;
        const m = this.makePickupMesh(c);
        this.scene.add(m.group);
        e = { pk: pk, m: m };
        this.pickups.push(e); pMap.set(pk, e);
      }
      const m = e.m;
      const tt = W.gameTime + (pk.t || 0);
      m.group.position.set(pk.x, 0.5 + Math.sin(tt * 2.8) * 0.55, pk.y);
      m.icon.rotation.y = tt * 2.3;
      m.icon.rotation.x = tt * 0.7;
      m.icon.updateMatrix();
      m.ring.rotation.z = tt * 1.1;
      m.ring.updateMatrix();
      const pulse = 1 + Math.sin(tt * 4) * 0.1;
      m.beam.scale.set(pulse, 9, pulse);
      m.beam.updateMatrix();
    }
  },

  syncMarkers(dt) {
    const T = window.THREE;
    const list = this.markerList;
    let n = 0;
    const push = (x, y, color) => {
      let o = list[n];
      if (!o) { o = { x: 0, y: 0, color: "#ffffff" }; list[n] = o; }
      o.x = x; o.y = y; o.color = color || "#facc15"; n++;
    };
    const cur = Missions.current;
    if (cur && cur.current && cur.current.marker && isFinite(cur.current.marker.x)) {
      push(cur.current.marker.x, cur.current.marker.y, cur.current.marker.color);
    } else if (Missions.markers) {
      for (const mm of Missions.markers) if (!Missions.doneIds[mm.id]) push(mm.x, mm.y, "#facc15");
      if (Missions.taxiUnlocked && Missions.taxiStand) push(Missions.taxiStand.x, Missions.taxiStand.y, "#22c55e");
    }
    while (this.markers.length < n) {
      const m = this.makeMarkerMesh("#facc15");
      this.scene.add(m.group);
      this.markers.push({ m: m });
    }
    for (let i = 0; i < this.markers.length; i++) {
      const mm = this.markers[i].m;
      if (i < n) {
        mm.group.visible = true;
        mm.group.position.set(list[i].x, 0.06, list[i].y);
        this.recolorMarker(mm, list[i].color);
        mm.ring.rotation.z += dt * 1.5;
        mm.ring.updateMatrix();
        mm.question.position.y = 19 + Math.sin(W.gameTime * 3 + i) * 0.8;
        mm.question.updateMatrix();
        const s = 1 + Math.sin(W.gameTime * 3) * 0.08;
        mm.group.scale.setScalar(s);
      } else {
        mm.group.visible = false;
      }
    }
  },

  updateParticles() {
    const parts = Combat.particles;
    const n = Math.min(parts.length, 600);
    for (let i = 0; i < n; i++) {
      const pt = parts[i];
      let h = 0.35;
      if (pt.type === "smoke") h = 1 + (1 - pt.life) * 7;
      else if (pt.type === "fire") h = 0.8 + (1 - pt.life) * 3.5;
      else if (pt.type === "muzzle") h = 1.8;
      else if (pt.type === "flash") h = 2.4;
      this.pPos[i * 3] = pt.x;
      this.pPos[i * 3 + 1] = h;
      this.pPos[i * 3 + 2] = pt.y;
      let r = 255, g2 = 255, b2 = 255;
      if (pt.type === "blood") { r = 196; g2 = 28; b2 = 34; }
      else if (pt.type === "spark") { r = 255; g2 = 216; b2 = 92; }
      else if (pt.type === "smoke") { r = 95; g2 = 112; b2 = 135; }
      else if (pt.type === "fire") { r = 255; g2 = 112; b2 = 30; }
      else if (pt.type === "flash") { r = 255; g2 = 246; b2 = 208; }
      else if (pt.type === "muzzle") { r = 255; g2 = 224; b2 = 138; }
      this.pCol[i * 3] = r / 255; this.pCol[i * 3 + 1] = g2 / 255; this.pCol[i * 3 + 2] = b2 / 255;
    }
    this.pGeo.setDrawRange(0, n);
    this.pPosAttr.needsUpdate = true;
    this.pColAttr.needsUpdate = true;
    const bs = Combat.bullets;
    const nb = Math.min(bs.length, 320);
    for (let i = 0; i < nb; i++) {
      const b = bs[i];
      this.bPos[i * 3] = b.x;
      this.bPos[i * 3 + 1] = 1.85;
      this.bPos[i * 3 + 2] = b.y;
    }
    this.bGeo.setDrawRange(0, nb);
    this.bPosAttr.needsUpdate = true;
  },

  updateFx(dt) {
    for (let i = this.flashFxList.length - 1; i >= 0; i--) {
      const f = this.flashFxList[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        if (f.light) this.scene.remove(f.light);
        f.mesh.material.dispose();
        this.flashFxList.splice(i, 1);
        continue;
      }
      const t = 1 - f.life / f.max;
      const s = 1 + t * 5;
      f.mesh.scale.setScalar(f.r * 0.28 * s);
      f.mesh.material.opacity = f.life / f.max;
      if (f.light) f.light.intensity = (f.life / f.max) * 4.5;
    }
  },

  updateDayNight(dt, immediate) {
    const T = window.THREE;
    const p = W.player;
    const px = p ? (p.vehicle ? p.vehicle.x : p.x) : this.spawn.x;
    const pz = p ? (p.vehicle ? p.vehicle.y : p.y) : this.spawn.y;
    const light = HUD.dayLight();
    const hour = HUD.hour();
    const night = Utils.clamp((0.62 - light) / 0.5, 0, 1);
    const skyNight = Utils.clamp((0.40 - light) / 0.22, 0, 1);
    this.night = night;
    const dusk = Utils.clamp(1 - Math.abs(light - 0.45) / 0.36, 0, 1);

    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const dayTop = [0.16, 0.28, 0.44], dayMid = [0.49, 0.62, 0.76], dayBot = [0.91, 0.74, 0.52];
    const duskTop = [0.06, 0.055, 0.16], duskMid = [0.62, 0.24, 0.33], duskBot = [1.0, 0.50, 0.24];
    const nightTop = [0.012, 0.02, 0.055], nightMid = [0.04, 0.065, 0.13], nightBot = [0.16, 0.1, 0.14];
    let top = mix(dayTop, duskTop, dusk); top = mix(top, nightTop, skyNight);
    let mid = mix(dayMid, duskMid, dusk); mid = mix(mid, nightMid, skyNight);
    let bot = mix(dayBot, duskBot, dusk); bot = mix(bot, nightBot, skyNight);
    const u = this.mat.sky.uniforms;
    u.topColor.value.setRGB(top[0], top[1], top[2]);
    u.midColor.value.setRGB(mid[0], mid[1], mid[2]);
    u.bottomColor.value.setRGB(bot[0], bot[1], bot[2]);
    u.sunColor.value.setRGB(1.0, 0.54 + light * 0.26, 0.28 + light * 0.22);
    u.haze.value = 0.25 + dusk * 0.7 + light * 0.2;

    const ang = ((hour - 6) / 24) * Math.PI * 2;
    const dx = Math.cos(ang), dy = Math.sin(ang), dz = -0.3;
    const dl = Math.hypot(dx, dy, dz) || 1;
    const sx = dx / dl, sy = dy / dl, sz = dz / dl;
    u.sunDir.value.set(sx, sy, sz);
    const sunVisible = light > 0.2 && sy > -0.05;
    this.sunSprite.visible = sunVisible;
    this.moonSprite.visible = skyNight > 0.35;
    this.sunSprite.position.set(sx * 4400, sy * 4400, sz * 4400);
    this.moonSprite.position.set(-sx * 4200, Math.max(0.24, -sy) * 4200, -sz * 4200);
    this.sunSprite.updateMatrix();
    this.moonSprite.updateMatrix();
    this.mat.moon.opacity = 0.35 + skyNight * 0.65;
    this.mat.sun.opacity = 0.55 + light * 0.45;

    if (this.starPts) {
      this.starPts.visible = skyNight > 0.04;
      this.mat.star.opacity = skyNight * 0.9;
      this.starPts.rotation.y = this.elapsed * 0.003;
      this.starPts.updateMatrix();
    }
    if (this.cloudSprites) {
      this.mat.cloud.opacity = 0.10 + light * 0.18 + dusk * 0.16;
      this.mat.cloud.color.setRGB(0.66 + dusk * 0.30 + light * 0.12, 0.57 + dusk * 0.14 + light * 0.16, 0.66 + light * 0.18);
      for (let i = 0; i < this.cloudSprites.length; i++) {
        const c = this.cloudSprites[i];
        c.position.x = c.userData.baseX + Math.sin(this.elapsed * 0.006 + i) * 80;
        c.position.z = c.userData.baseZ + Math.cos(this.elapsed * 0.004 + i) * 45;
        c.updateMatrix();
      }
    }
    // 霓虹招牌轻微闪烁，高处航空灯间歇亮起
    if (this.mat.heroRoofSign) {
      const t = this.elapsed;
      const drop = (Math.sin(t * 11.3) * Math.sin(t * 2.17) > 0.955) ? 0.5 : 0;
      this.mat.heroRoofSign.opacity = 0.80 + 0.20 * (0.5 + 0.5 * Math.sin(t * 0.9)) - drop;
    }
    if (this.mat.heroSign) {
      this.mat.heroSign.opacity = 0.88 + 0.12 * (0.5 + 0.5 * Math.sin(this.elapsed * 1.3 + 1.7));
    }
    if (this.beacons.length) {
      const onNight = night > 0.22;
      for (let i = 0; i < this.beacons.length; i++) {
        const bc = this.beacons[i];
        bc.visible = onNight && Math.sin(this.elapsed * 2.0 + bc.userData.phase) > 0.15;
      }
    }
    this.skyGroup.position.set(px, 0, pz);
    this.skyGroup.updateMatrix();

    this.scene.fog.color.setRGB(mid[0] * 0.8 + bot[0] * 0.2, mid[1] * 0.8 + bot[1] * 0.2, mid[2] * 0.8 + bot[2] * 0.2);
    this.scene.fog.near = 340 - night * 120;
    this.scene.fog.far = 3000 - night * 900;
    this.scene.background.setRGB(top[0], top[1], top[2]);

    this.amb.intensity = 0.105 + light * 0.17;
    this.hemi.intensity = 0.14 + light * 0.20;
    this.sun.intensity = Math.max(0, light - 0.05) * 1.92;
    this.fill.intensity = 0.07 + night * 0.17;
    this.sun.color.setRGB(1.0, 0.50 + light * 0.30, 0.28 + light * 0.36);
    this.hemi.color.setRGB(0.24 + light * 0.20, 0.31 + light * 0.22, 0.48 + light * 0.24);
    this.hemi.groundColor.setRGB(0.19, 0.15, 0.14);
    this.sun.position.set(px + sx * 650, Math.max(60, sy * 650), pz + sz * 650);
    this.sun.target.position.set(px, 0, pz);
    this.sun.target.updateMatrixWorld();
    this.fill.position.set(px - 320, 240, pz + 300);
    this.heroLight.intensity = 0.35 + night * 2.55;
    if (this.parkLights) for (const pl of this.parkLights) pl.intensity = 0.12 + night * 1.95;
    if (this.playerLight) {
      this.playerLight.position.set(px, 6.8, pz);
      this.playerLight.intensity = 0.14 + night * 0.50;
    }

    // 夜间街灯：每帧保留玩家附近最近的 10 盏，避免上百盏点光源拖垮着色器。
    if (this.lampLights && this.lampLights.length && MapSys.data && MapSys.data.lamps) {
      const lamps = MapSys.data.lamps;
      const n = this.lampLights.length;
      const idx = this.lampIdx, dist = this.lampDist;
      for (let i = 0; i < n; i++) { idx[i] = -1; dist[i] = Infinity; }
      const R = 175, R2 = R * R;
      for (let li = 0; li < lamps.length; li++) {
        const dx = lamps[li].x - 5 - px, dz = lamps[li].y - pz;
        const dd = dx * dx + dz * dz;
        if (dd > R2) continue;
        let worst = 0;
        for (let i = 1; i < n; i++) if (dist[i] > dist[worst]) worst = i;
        if (dd < dist[worst]) { dist[worst] = dd; idx[worst] = li; }
      }
      const power = night * 2.15;
      for (let i = 0; i < n; i++) {
        const pl = this.lampLights[i];
        if (idx[i] < 0 || power < 0.02) { pl.intensity = 0; continue; }
        const lp = lamps[idx[i]];
        pl.position.set(lp.x - 5, 8.2, lp.y);
        pl.intensity = power * Utils.clamp(1 - Math.sqrt(dist[i]) / R, 0.14, 1);
      }
    }

    if (this.renderer) this.renderer.toneMappingExposure = 0.72 + light * 0.09;
    this.mat.glowWarm.opacity = 0.10 + night * 0.86;
    this.mat.neonGlow.opacity = 0.18 + night * 0.40;
    for (const fm of this.facadeMats) fm.emissiveIntensity = 0.04 + night * 0.44 + dusk * 0.10;
  },

  update(dt) {
    if (this.disabled || !this.scene || !this.camera || !W.player) return;
    if (!isFinite(dt) || dt <= 0) dt = 0.016;
    if (dt > 0.05) dt = 0.05;
    this.elapsed += dt;
    this.frameDt = dt;
    this.updateDayNight(dt);
    this.syncEntities();
    this.updateSignature(dt);
    this.syncPickups(dt);
    this.syncMarkers(dt);
    this.updateParticles();
    this.updateFx(dt);
    this.updateCamera(dt);
    this.shadowTimer += dt;
    if (this.shadowTimer >= 0.08) {
      this.shadowTimer = 0;
      if (this.renderer.shadowMap) this.renderer.shadowMap.needsUpdate = true;
    }
    try {
      this.renderer.render(this.scene, this.camera);
    } catch (e) {
      if (!this._renderWarned) console.warn("3D 渲染帧异常（已跳过该帧）", e);
      this._renderWarned = true;
    }
  },

  focusPlayer(snap) {
    const p = W.player;
    if (!p) return;
    const vehicle = p.vehicle;
    this.camYaw = (vehicle ? vehicle.heading : (p.heading || 0)) + Math.PI;
    this.camPitch = 0.17;
    this.camAim = 0;
    this.mouseIdleT = 99;
    this._camArmLen = null;
    this._camPivotX = null;
    this._camPivotZ = null;
    if (snap !== false) this.snapCamera();
  },

  snapCamera() {
    if (!this.camera) return;
    this._camArmLen = null;
    this._camPivotX = null;
    this._camPivotZ = null;
    const p = W.player;
    if (!p) {
      if (!this.camTarget) return;
      const cp = Math.cos(this.camPitch);
      const bx = Math.cos(this.camYaw), bz = Math.sin(this.camYaw);
      const d = this.zoomD;
      this.camTarget.set(this.spawn.x + bx * cp * d, 3.2 + Math.sin(this.camPitch) * d, this.spawn.y + bz * cp * d);
      this.camera.position.copy(this.camTarget);
      this.camera.lookAt(this.spawn.x, 3.2, this.spawn.y);
      this.camFov = 60;
      this.camera.fov = 60;
      if (this.camera.updateProjectionMatrix) this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();
      return;
    }
    this.updateCamera(1 / 60, true);
  },

  /* 三维弹簧臂：机位始终由角色/车辆位置刚性推导，只有角度、肩位和臂长做平滑。
   * 这样高速移动不会让镜头落后，遮挡时也不会把机位留在墙里。
   */
  updateCamera(dt, snap) {
    const p = W.player;
    if (!p || !this.camera || !this.camTarget) return;
    if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
    if (dt > 0.05) dt = 0.05;
    if (!isFinite(this.camYaw)) this.camYaw = -2.4;
    if (!isFinite(this.camPitch)) this.camPitch = 0.17;
    if (!isFinite(this.camAim)) this.camAim = 0;
    this.camPitch = Utils.clamp(this.camPitch, this.minPitch, this.maxPitch);
    this.mouseIdleT += dt;

    const vehicle = (p.vehicle && !p.dead) ? p.vehicle : null;
    const px = vehicle ? vehicle.x : p.x;
    const pz = vehicle ? vehicle.y : p.y;
    const maxSpeed = vehicle && vehicle.def && vehicle.def.maxSpeed ? vehicle.def.maxSpeed : 1;
    const speedFactor = vehicle ? Utils.clamp(Math.abs(vehicle.fs || 0) / maxSpeed, 0, 1) : 0;
    const moving = !!vehicle && (Math.abs(vehicle.fs || 0) > 6 || Math.abs(vehicle.vx || 0) + Math.abs(vehicle.vy || 0) > 8);
    if (vehicle && !vehicle.wrecked && moving && this.mouseIdleT > 1.0) {
      const rate = 3.0 + speedFactor * 4.0;
      const k = snap ? 1 : (1 - Math.exp(-rate * dt));
      this.camYaw = Utils.angleLerp(this.camYaw, vehicle.heading + Math.PI, k);
    }

    const aiming = !!(W.aiming && !vehicle && !p.dead);
    const aimK = snap ? 1 : (1 - Math.exp(-11 * dt));
    this.camAim = Utils.lerp(this.camAim, aiming ? 1 : 0, aimK);
    if (this.camAim < 0.001) this.camAim = 0;
    else if (this.camAim > 0.999) this.camAim = 1;

    const stride = vehicle ? 0 : Utils.clamp((p.moveSpeed || 0) / CFG.PLAYER.sprint, 0, 1);
    let D, pivotY, shoulder;
    const zoom = Utils.clamp(isFinite(this.camZoom) ? this.camZoom : 1, 0.72, 1.45);
    if (vehicle) {
      const defH = vehicle.def && vehicle.def.h ? vehicle.def.h : 88;
      const sizeK = Utils.clamp((defH - 70) / 110, 0, 1);
      D = Math.max(24, defH * 0.22 + 6) * zoom;
      D *= 1 + speedFactor * 0.05;
      pivotY = 2.8 + sizeK * 2.2;
      // 追车镜头略微偏到车后侧：能同时看见车尾、侧面和车轮，不再正对一块车尾板。
      shoulder = D * 0.18;
    } else {
      const idleD = Utils.clamp(this.zoomD * zoom, 10, 27);
      D = Utils.lerp(idleD, 12.5, this.camAim);
      pivotY = 3.25 + this.camAim * 0.10;
      // 肩位按距离等比缩放，屏幕上的偏移不会因为 +/- 缩放而跑掉。
      shoulder = D * (0.170 + 0.065 * this.camAim);
    }

    // 驾驶时压低俯角，把镜头拉成更接近车尾的追车视角；步行时保留原来的城市俯瞰角度。
    const camPitch = vehicle ? this.camPitch * 0.60 : this.camPitch;
    // camYaw 是“角色指向镜头”的方位角。镜头方向永远是它的反向。
    const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    const bx = Math.cos(this.camYaw), bz = Math.sin(this.camYaw);
    const fx = -bx, fz = -bz;
    const rx = bz, rz = -bx;
    const idealX = px + bx * cp * D + rx * shoulder;
    const idealZ = pz + bz * cp * D + rz * shoulder;
    const idealY = pivotY + sp * D;
    const lead = vehicle ? 10 + speedFactor * 12 : 0;
    let lookX, lookZ, lookY;
    if (vehicle) {
      lookX = px + fx * lead;
      lookZ = pz + fz * lead;
      lookY = pivotY + 0.35;
    } else {
      // 镜头和注视点使用同一个肩位，角色会被稳定地放在准星左侧。
      lookX = px + rx * shoulder;
      lookZ = pz + rz * shoulder;
      lookY = pivotY + 0.15;
    }

    // 先确定视线方向；即使弹簧臂因墙收缩，准星方向也不会跟着乱跳。
    let vx = lookX - idealX, vy = lookY - idealY, vz = lookZ - idealZ;
    let vl = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (!isFinite(vl) || vl < 0.001) {
      vx = fx; vy = -sp; vz = fz;
      vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    }
    vx /= vl; vy /= vl; vz /= vl;

    // 弹簧臂的 3D 遮挡：楼体按相机半径外扩，命中就收臂。
    let adx = idealX - px, ady = idealY - pivotY, adz = idealZ - pz;
    let armLen = Math.sqrt(adx * adx + ady * ady + adz * adz);
    if (!isFinite(armLen) || armLen < 0.01) {
      adx = 0; ady = 0; adz = 1; armLen = 1;
    }
    const ux = adx / armLen, uy = ady / armLen, uz = adz / armLen;
    const freeLen = this.cameraClearDistance(px, pivotY, pz, ux, uy, uz, armLen);
    const blocked = freeLen < armLen - 0.05;
    const wanted = Utils.clamp(freeLen, 1.8, armLen);
    const teleported = this._camPivotX != null && Utils.dist(px, pz, this._camPivotX, this._camPivotZ) > 260;
    if (snap || this._camArmLen == null || this._camArmLen <= 0 || teleported) {
      this._camArmLen = wanted;
    } else if (blocked && wanted < this._camArmLen - 0.04) {
      // 被墙挡住时必须立刻收进来，不能留几帧穿模。
      this._camArmLen = wanted;
    } else {
      const rate = wanted < this._camArmLen ? 18 : 7;
      this._camArmLen = Utils.lerp(this._camArmLen, wanted, 1 - Math.exp(-rate * dt));
    }
    this._camArmLen = Utils.clamp(this._camArmLen, 1.8, armLen);
    this._camPivotX = px;
    this._camPivotZ = pz;

    let camX = px + ux * this._camArmLen;
    let camY = pivotY + uy * this._camArmLen;
    let camZ = pz + uz * this._camArmLen;
    if (camY < 1.15) camY = 1.15;
    const maxX = (W.mapW || 5120) - 10;
    const maxZ = (W.mapH || 5120) - 10;
    camX = Utils.clamp(camX, 10, maxX);
    camZ = Utils.clamp(camZ, 10, maxZ);

    // 极轻微的步行起伏；瞄准时完全不晃，避免准星漂移。
    if (!vehicle && stride > 0.08 && this.camAim < 0.45) {
      camY += Math.sin((p.walkPhase || 0) * 2) * 0.045 * Math.min(1, stride);
    }
    this.camTarget.set(camX, camY, camZ);
    this.camera.position.copy(this.camTarget);
    this.camera.lookAt(camX + vx * 100, camY + vy * 100, camZ + vz * 100);

    const targetFov = vehicle ? (61 + speedFactor * 5) : (60 + stride * 2.2 - this.camAim * 8);
    this.camFov = snap ? targetFov : Utils.lerp(this.camFov, targetFov, 1 - Math.exp(-8 * dt));
    if (isFinite(this.camFov) && Math.abs(this.camera.fov - this.camFov) > 0.01) {
      this.camera.fov = this.camFov;
      if (this.camera.updateProjectionMatrix) this.camera.updateProjectionMatrix();
    }

    const shake = (typeof Combat !== "undefined" && Combat.shake) ? Combat.shake : 0;
    if (shake > 0.01) {
      this.camera.position.set(
        camX + Utils.rand(-shake, shake) * 0.035,
        camY + Utils.rand(-shake, shake) * 0.025,
        camZ + Utils.rand(-shake, shake) * 0.035
      );
    }

    let targetRoll = 0;
    if (vehicle && !vehicle.wrecked) {
      const srx = -Math.sin(vehicle.heading), srz = Math.cos(vehicle.heading);
      const lat = (vehicle.vx || 0) * srx + (vehicle.vy || 0) * srz;
      targetRoll = Utils.clamp(-lat / 3000, -0.035, 0.035) * speedFactor;
      if (typeof PLAYER_CTRL !== "undefined") targetRoll += PLAYER_CTRL.steer * speedFactor * 0.010;
    }
    this.camRoll = snap ? targetRoll : Utils.lerp(this.camRoll, targetRoll, 1 - Math.exp(-6 * dt));
    if (Math.abs(this.camRoll) > 0.0004) this.camera.rotateZ(this.camRoll);
    this.camera.updateMatrixWorld();

    // 镜头被挤到角色身边时隐藏角色，避免看到模型内部。
    if (this.playerMesh) {
      this.playerMesh.group.visible = !vehicle && !p.dead && this._camArmLen > 5.0;
    }

    if (vehicle && !vehicle.wrecked) {
      const hx = Math.cos(vehicle.heading), hz = Math.sin(vehicle.heading);
      this.head.position.set(vehicle.x + hx * 7, 2.8, vehicle.y + hz * 7);
      this.head.target.position.set(vehicle.x + hx * 95, 0.8, vehicle.y + hz * 95);
      this.head.target.updateMatrixWorld();
      this.head.intensity = this.night * 3.2;
    } else {
      this.head.intensity = 0;
    }
  },

  // 从角色胸口向理想机位打一条三维线段，返回不穿楼的可用臂长。
  cameraClearDistance(ox, oy, oz, dx, dy, dz, maxLen) {
    if (!isFinite(maxLen) || maxLen <= 0) return 0;
    const data = (typeof MapSys !== "undefined") ? MapSys.data : null;
    if (!data || !data.buildings) return maxLen;
    const pad = 1.35;
    let best = maxLen;
    for (let i = 0; i < data.buildings.length; i++) {
      const b = data.buildings[i];
      const minX = b.x - pad, maxX = b.x + b.w + pad;
      const minY = -pad, maxY = (b.renderH || (22 + (b.height || 0) * 44)) + pad;
      const minZ = b.y - pad, maxZ = b.y + b.h + pad;
      let t0 = 0, t1 = best;
      if (Math.abs(dx) < 1e-7) {
        if (ox < minX || ox > maxX) continue;
      } else {
        let a = (minX - ox) / dx, c = (maxX - ox) / dx;
        if (a > c) { const tmp = a; a = c; c = tmp; }
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, c);
      }
      if (Math.abs(dy) < 1e-7) {
        if (oy < minY || oy > maxY) continue;
      } else {
        let a = (minY - oy) / dy, c = (maxY - oy) / dy;
        if (a > c) { const tmp = a; a = c; c = tmp; }
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, c);
      }
      if (Math.abs(dz) < 1e-7) {
        if (oz < minZ || oz > maxZ) continue;
      } else {
        let a = (minZ - oz) / dz, c = (maxZ - oz) / dz;
        if (a > c) { const tmp = a; a = c; c = tmp; }
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, c);
      }
      if (t0 > t1 || t1 <= 0 || t0 >= best) continue;
      if (t0 < best) best = Math.max(0, t0);
    }
    if (best >= maxLen - 0.001) return maxLen;
    return Math.max(0.8, best - 0.9);
  },

  screenVecs() {
    const p = W.player;
    if (this.disabled || !p) return { ux: 0, uz: -1, rx: 1, rz: 0 };
    // 移动方向必须来自实际镜头朝向；载具前瞻、肩位偏移都不会改变 W=屏幕上方。
    if (this.camera && this.camDir) {
      this.camera.getWorldDirection(this.camDir);
      let fx = this.camDir.x, fz = this.camDir.z;
      const fl = Math.hypot(fx, fz);
      if (isFinite(fl) && fl > 1e-4) {
        fx /= fl; fz /= fl;
        return { ux: fx, uz: fz, rx: -fz, rz: fx };
      }
    }
    // 俯视到接近垂直时水平投影退化，使用 yaw 的水平基向量兜底。
    const yaw = isFinite(this.camYaw) ? this.camYaw : -2.4;
    const fx = -Math.cos(yaw), fz = -Math.sin(yaw);
    return { ux: fx, uz: fz, rx: -fz, rz: fx };
  },

  rotateCam(dyaw, dpitch) {
    if (this.disabled) return;
    if (!isFinite(dyaw) || !isFinite(dpitch)) return;
    this.camYaw = Utils.angleDiff(this.camYaw + dyaw);
    this.camPitch = Utils.clamp(this.camPitch + dpitch, this.minPitch, this.maxPitch);
    this.mouseIdleT = 0;
  },

  aimPoint() {
    const p = W.player;
    if (!p) return { x: 0, y: 0 };
    if (this.disabled || !this.camera) {
      return {
        x: p.x + ((Input.mouse.x || 0) - W.viewW / 2),
        y: p.y + ((Input.mouse.y || 0) - W.viewH / 2)
      };
    }
    const shooter = p.vehicle || p;
    try {
      this.ndc.set(0, 0);
      this.camera.updateMatrixWorld();
      this.raycaster.setFromCamera(this.ndc, this.camera);
      const hit = this.raycaster.ray.intersectPlane(this.plane, this.hitV);
      if (hit && isFinite(hit.x) && isFinite(hit.z)) {
        const dx = hit.x - shooter.x, dz = hit.z - shooter.y;
        // 极端俯视时交点可能落在角色脚下；保留一个向前的有限解，避免角色转身朝后。
        if (dx * dx + dz * dz > 1) return { x: hit.x, y: hit.z };
      }
      const rd = this.raycaster.ray.direction;
      const hl = Math.hypot(rd.x, rd.z) || 1;
      return { x: shooter.x + rd.x / hl * 160, y: shooter.y + rd.z / hl * 160 };
    } catch (e) { /* 降级环境保持有限值 */ }
    return { x: shooter.x, y: shooter.y };
  },

  disposeGroup(g) {
    if (!g) return;
    g.traverse((o) => {
      if (o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m || (m.userData && (m.userData.shared || m.userData.cache))) continue;
          m.dispose();
        }
      }
    });
  },
};
