"use strict";
// 3D 渲染器：基于 three.js 的世界/实体/光照/镜头/粒子渲染
const Render3D = {
  disabled: false, errorMsg: "",
  renderer: null, scene: null, camera: null,
  sun: null, amb: null, head: null,
  playerMesh: null,
  vehs: [], npcs: [], pickups: [], markers: [], flashFxList: [],
  vehSet: null, vehMap: null, npcSet: null, npcMap: null, pkSet: null, pkMap: null,
  markerList: null, lampIdx: null, lampDist: null,
  camTarget: null,
  raycaster: null, plane: null, ndc: null, hitV: null,
  pGeo: null, pPos: null, pCol: null, pPts: null,
  bGeo: null, bPos: null, bPts: null,
  lampLights: [],
  init(glCanvas, w, h) {
    this.disabled = false; this.errorMsg = "";
    if (!window.THREE) { this.disabled = true; this.errorMsg = "three.js 未加载"; console.warn("three.js 未加载，3D 渲染停用"); return; }
    const T = window.THREE;
    try {
      this.renderer = new T.WebGLRenderer({ canvas: glCanvas, antialias: true });
    } catch (e) {
      // WebGL 不可用（显卡驱动/浏览器禁用）时不能让整个游戏崩掉
      this.disabled = true;
      this.errorMsg = "WebGL 不可用：" + (e && e.message ? e.message : e);
      console.warn("WebGL 初始化失败，3D 渲染停用：", e);
      return;
    }
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(62, w / h, 0.5, 3500);
    this.camTarget = new T.Vector3(W.hospital.x - 15, 15, W.hospital.y - 15);
    this.zoomD = 20;
    this.camYaw = -Math.PI * 0.75;
    this.camPitch = 0.85;
    this.mouseIdleT = 99;
    this.minPitch = 0.5;
    this.maxPitch = 1.25;
    this.raycaster = new T.Raycaster();
    this.plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    this.ndc = new T.Vector2();
    this.hitV = new T.Vector3();
    this.scene.fog = new T.Fog(0x9ec8f0, 500, 1600);
    this.vehSet = new Set(); this.vehMap = new Map();
    this.npcSet = new Set(); this.npcMap = new Map();
    this.pkSet = new Set(); this.pkMap = new Map();
    this.markerList = [];
    this.buildWorld();
    this.buildLights();
    this.buildParticles();
    this.playerMesh = this.makeCharacter(0x3b82f6, 1.0);
    this.scene.add(this.playerMesh.group);
  },
  buildWorld() {
    const T = window.THREE;
    const d = MapSys.data;
    const W2 = d.worldW;
    // 静态世界统一放进一个组：建好后冻结矩阵，省掉每帧上千次的 matrix.compose()/matrixWorld 乘法
    const wg = new T.Group();
    const ground = new T.Mesh(new T.PlaneGeometry(W2, W2), new T.MeshLambertMaterial({ color: 0x4a453e }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    wg.add(ground);
    const roadMat = new T.MeshLambertMaterial({ color: 0x2c2c2c });
    const roadVGeo = new T.PlaneGeometry(d.road, W2);
    const roadHGeo = new T.PlaneGeometry(W2, d.road);
    for (const vx of d.roadsV) {
      const m = new T.Mesh(roadVGeo, roadMat);
      m.rotation.x = -Math.PI / 2; m.position.set(vx, 0.02, W2 / 2);
      m.receiveShadow = true; wg.add(m);
    }
    for (const hy of d.roadsH) {
      const m = new T.Mesh(roadHGeo, roadMat);
      m.rotation.x = -Math.PI / 2; m.position.set(W2 / 2, 0.02, hy);
      m.receiveShadow = true; wg.add(m);
    }
    const laneMat = new T.MeshBasicMaterial({ color: 0xd9b64a });
    const laneVGeo = new T.PlaneGeometry(0.6, 30);
    const laneHGeo = new T.PlaneGeometry(30, 0.6);
    for (const vx of d.roadsV) {
      for (let yy = 20; yy < W2; yy += 140) {
        const m = new T.Mesh(laneVGeo, laneMat);
        m.rotation.x = -Math.PI / 2; m.position.set(vx, 0.06, yy);
        wg.add(m);
      }
    }
    for (const hy of d.roadsH) {
      for (let xx = 20; xx < W2; xx += 140) {
        const m = new T.Mesh(laneHGeo, laneMat);
        m.rotation.x = -Math.PI / 2; m.position.set(xx, 0.06, hy);
        wg.add(m);
      }
    }
    const waterMat = new T.MeshLambertMaterial({ color: 0x2f7bc4, transparent: true, opacity: 0.82 });
    for (const wq of d.water) {
      const m = new T.Mesh(new T.PlaneGeometry(wq.w, wq.h), waterMat);
      m.rotation.x = -Math.PI / 2; m.position.set(wq.x + wq.w / 2, 0.04, wq.y + wq.h / 2);
      wg.add(m);
    }
    const parkMat = new T.MeshLambertMaterial({ color: 0x4e7d43 });
    for (const pk of d.parks) {
      const m = new T.Mesh(new T.PlaneGeometry(pk.w, pk.h), parkMat);
      m.rotation.x = -Math.PI / 2; m.position.set(pk.x + pk.w / 2, 0.02, pk.y + pk.h / 2);
      m.receiveShadow = true; wg.add(m);
    }
    // 按颜色复用材质（原本每栋楼一个材质，200+ 个材质对象）
    const bMats = new Map();
    const bMat = (c) => {
      let m = bMats.get(c);
      if (!m) { m = new T.MeshLambertMaterial({ color: new T.Color(c) }); bMats.set(c, m); }
      return m;
    };
    for (const b of d.buildings) {
      const hgt = 16 + b.height * 18;
      const mesh = new T.Mesh(new T.BoxGeometry(b.w, hgt, b.h), bMat(b.color));
      mesh.position.set(b.x + b.w / 2, hgt / 2, b.y + b.h / 2);
      mesh.castShadow = true; mesh.receiveShadow = true;
      wg.add(mesh);
    }
    const trunkGeo = new T.CylinderGeometry(0.9, 1.3, 4, 6);
    const crownGeo = new T.SphereGeometry(1, 8, 6);
    const trunkMat = new T.MeshLambertMaterial({ color: 0x5b3a1e });
    const crownMat = new T.MeshLambertMaterial({ color: 0x2f6b32 });
    for (const t of d.trees) {
      const g = new T.Group();
      const trunk = new T.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2;
      const crown = new T.Mesh(crownGeo, crownMat);
      crown.scale.setScalar(t.r * 0.55);
      crown.position.y = 4.5 + t.r * 0.25;
      g.add(trunk); g.add(crown);
      g.position.set(t.x, 0, t.y);
      wg.add(g);
    }
    const poleMat = new T.MeshLambertMaterial({ color: 0x22252a });
    const headMat = new T.MeshBasicMaterial({ color: 0xffe9a8 });
    const poleGeo = new T.CylinderGeometry(0.35, 0.35, 9, 6);
    const lampHeadGeo = new T.SphereGeometry(1.1, 6, 5);
    for (const lp of d.lamps) {
      const g = new T.Group();
      const pole = new T.Mesh(poleGeo, poleMat);
      pole.position.y = 4.5;
      const head = new T.Mesh(lampHeadGeo, headMat);
      head.position.y = 9.2;
      g.add(pole); g.add(head);
      g.position.set(lp.x, 0, lp.y);
      wg.add(g);
    }
    this.scene.add(wg);
    this.worldGroup = wg;
    wg.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); });
  },
  buildLights() {
    const T = window.THREE;
    this.amb = new T.AmbientLight(0x8fa3c4, 0.55);
    this.scene.add(this.amb);
    this.sun = new T.DirectionalLight(0xfff0cf, 1.15);
    this.sun.position.set(300, 400, 200);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -280; sc.right = 280; sc.top = 280; sc.bottom = -280;
    sc.near = 10; sc.far = 1000;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.head = new T.SpotLight(0xfff3c8, 0, 170, 0.55, 0.6, 1);
    this.scene.add(this.head);
    this.scene.add(this.head.target);
    this.lampLights = [];
    for (let i = 0; i < 10; i++) {
      const pl = new T.PointLight(0xffbe5c, 0, 150, 1.6);
      this.scene.add(pl);
      this.lampLights.push(pl);
    }
    // 每帧只点亮最近的 N 盏街灯，用固定数组做 top-K 选择，避免 map()+sort() 的每帧分配
    this.lampIdx = new Int32Array(this.lampLights.length);
    this.lampDist = new Float64Array(this.lampLights.length);
  },
  buildParticles() {
    const T = window.THREE;
    const MAXP = 500;
    this.pGeo = new T.BufferGeometry();
    this.pPos = new Float32Array(MAXP * 3);
    this.pCol = new Float32Array(MAXP * 3);
    this.pGeo.setAttribute("position", new T.BufferAttribute(this.pPos, 3));
    this.pGeo.setAttribute("color", new T.BufferAttribute(this.pCol, 3));
    this.pPts = new T.Points(this.pGeo, new T.PointsMaterial({ size: 2.6, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.95 }));
    this.pPts.frustumCulled = false;
    this.scene.add(this.pPts);
    const MAXB = 300;
    this.bGeo = new T.BufferGeometry();
    this.bPos = new Float32Array(MAXB * 3);
    this.bGeo.setAttribute("position", new T.BufferAttribute(this.bPos, 3));
    this.bPts = new T.Points(this.bGeo, new T.PointsMaterial({ color: 0xffdc50, size: 1.8, sizeAttenuation: true, transparent: true, opacity: 0.95 }));
    this.bPts.frustumCulled = false;
    this.scene.add(this.bPts);
    // 属性对象每帧都要用，缓存下来免得反复走 attributes.xxx 的字符串查找
    this.pPosAttr = this.pGeo.attributes.position;
    this.pColAttr = this.pGeo.attributes.color;
    this.bPosAttr = this.bGeo.attributes.position;
  },
  makeCharacter(bodyColor, scale) {
    const T = window.THREE;
    const g = new T.Group();
    const body = new T.Mesh(new T.CylinderGeometry(0.8 * scale, 0.9 * scale, 2.5 * scale, 8), new T.MeshLambertMaterial({ color: bodyColor }));
    body.position.y = 1.4 * scale;
    const head = new T.Mesh(new T.SphereGeometry(0.5 * scale, 8, 6), new T.MeshLambertMaterial({ color: 0xeab308 }));
    head.position.y = 3.0 * scale;
    const gun = new T.Mesh(new T.BoxGeometry(1.9 * scale, 0.32 * scale, 0.32 * scale), new T.MeshLambertMaterial({ color: 0x1f2937 }));
    gun.position.set(1.2 * scale, 1.9 * scale, 0);
    g.add(body); g.add(head); g.add(gun);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return { group: g, body: body, head: head, gun: gun, baseColor: bodyColor, flash: false };
  },
  makeVehicleMesh(v) {
    const T = window.THREE;
    const def = v.def;
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(def.w, 2.2, def.h), new T.MeshLambertMaterial({ color: new T.Color(v.color) }));
    body.position.y = 1.3;
    const win = new T.Mesh(new T.BoxGeometry(def.w * 0.7, 1.1, def.h * 0.22), new T.MeshLambertMaterial({ color: 0x1e3246 }));
    win.position.set(0, 2.1, -def.h * 0.16);
    const wheelMat = new T.MeshLambertMaterial({ color: 0x111318 });
    const wr = Math.max(0.45, Math.min(1.05, def.w / 7));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wm = new T.Mesh(new T.CylinderGeometry(wr, wr, 0.9, 8), wheelMat);
        wm.rotation.z = Math.PI / 2;
        wm.position.set(sx * def.w * 0.3, wr + 0.2, sz * def.h * 0.3);
        g.add(wm);
      }
    }
    g.add(body); g.add(win);
    let siren = null;
    if (v.siren) {
      siren = new T.Mesh(new T.BoxGeometry(1.2, 0.7, 1.2), new T.MeshBasicMaterial({ color: 0xef4444 }));
      siren.position.y = 2.9;
      g.add(siren);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const m = { group: g, body: body, win: win, siren: siren, wrecked: false, dead: false };
    g.position.set(v.x, 0, v.y);
    g.rotation.y = -v.heading;
    return m;
  },
  makePickupMesh(color) {
    const T = window.THREE;
    const g = new T.Group();
    const box = new T.Mesh(new T.BoxGeometry(1.7, 1.7, 1.7), new T.MeshBasicMaterial({ color: color }));
    g.add(box);
    return { group: g, box: box };
  },
  makeMarkerMesh(color) {
    const T = window.THREE;
    const g = new T.Group();
    const ring = new T.Mesh(new T.TorusGeometry(4.5, 0.7, 8, 22), new T.MeshBasicMaterial({ color: color }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4;
    const spike = new T.Mesh(new T.OctahedronGeometry(2.6, 0), new T.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.85 }));
    spike.position.y = 8;
    g.add(ring); g.add(spike);
    return { group: g, ring: ring, spike: spike };
  },
  flashFx(x, y, r) {
    if (this.disabled || !this.scene) return;
    const T = window.THREE;
    const m = new T.Mesh(new T.SphereGeometry(r * 0.35, 12, 8), new T.MeshBasicMaterial({ color: 0xfff7d6, transparent: true, opacity: 0.95 }));
    m.position.set(x, 1.5, y);
    this.scene.add(m);
    this.flashFxList.push({ mesh: m, life: 0.16, max: 0.16, r: r });
  },
  update(dt) {
    if (this.disabled || !this.scene || !this.camera || !W.player) return;
    const T = window.THREE;
    const light = HUD.dayLight();
    const p = W.player;
    const px = p.x, pz = p.y;
    const sky = light > 0.6 ? 0x9ec8f0 : light > 0.35 ? 0xe8b78a : 0x0b1026;
    if (this.scene.background) this.scene.background.setHex(sky);
    else this.scene.background = new T.Color(sky);
    this.scene.fog.color.setHex(sky);
    this.amb.intensity = 0.32 + light * 0.5;
    this.sun.intensity = 0.2 + light * 1.15;
    this.sun.position.set(px + 300, 380, pz + 200);
    this.sun.target.position.set(px, 0, pz);
    this.sun.target.updateMatrixWorld();
    const hv = p.vehicle;
    const hl = hv ? Math.max(0, 0.5 - light) * 2.4 : 0;
    this.head.intensity = hl;
    if (hv) {
      const fx = Math.cos(hv.heading), fz = Math.sin(hv.heading);
      this.head.position.set(hv.x + fx * 6, 2, hv.y + fz * 6);
      this.head.target.position.set(hv.x + fx * 70, 0.5, hv.y + fz * 70);
      this.head.target.updateMatrixWorld();
    } else {
      this.head.position.set(px, 60, pz);
    }
    const lampMul = Math.max(0, 0.55 - light) * 1.8;
    if (lampMul > 0.05) {
      // 固定数组做 top-K（最近的 K 盏街灯），零分配；原先每帧 map()+sort() 会造出上百个对象
      const lamps = MapSys.data.lamps, K = this.lampLights.length;
      const idx = this.lampIdx, dist = this.lampDist;
      let count = 0;
      for (let i = 0; i < lamps.length; i++) {
        const lp = lamps[i];
        const d2 = Utils.dist2(px, pz, lp.x, lp.y);
        if (count < K) {
          let j = count++;
          while (j > 0 && dist[j - 1] > d2) { dist[j] = dist[j - 1]; idx[j] = idx[j - 1]; j--; }
          dist[j] = d2; idx[j] = i;
        } else if (d2 < dist[K - 1]) {
          let j = K - 1;
          while (j > 0 && dist[j - 1] > d2) { dist[j] = dist[j - 1]; idx[j] = idx[j - 1]; j--; }
          dist[j] = d2; idx[j] = i;
        }
      }
      for (let i = 0; i < K; i++) {
        const pl = this.lampLights[i];
        if (i < count) { const lp = lamps[idx[i]]; pl.position.set(lp.x, 8, lp.y); pl.intensity = lampMul * 1.7; }
        else pl.intensity = 0;
      }
    } else {
      for (const pl of this.lampLights) pl.intensity = 0;
    }
    this.syncEntities();
    this.syncPickups(dt);
    this.syncMarkers(dt);
    this.updateParticles();
    this.updateFx(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  },
  syncEntities() {
    const T = window.THREE;
    const p = W.player;
    const pm = this.playerMesh;
    if (pm) {
      pm.group.visible = !p.vehicle && !p.dead;
      pm.group.position.set(p.x, 0, p.y);
      pm.group.rotation.y = -p.aim;
      pm.gun.rotation.y = 0;
      this.applyFlash(pm, p.dmgFlash > 0.2, 0x3b82f6);
    }
    // 用 Set/Map 做成员判断，替换掉原来的 indexOf 内嵌循环（O(n²) → O(n)）
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
      m.group.rotation.y = -v.heading;
      if (v.wrecked && !m.wrecked) {
        m.wrecked = true;
        m.body.material.color.setHex(0x1c1c1c);
        m.group.rotation.z = 0.22;
        m.group.rotation.x = 0.12;
      } else if (!v.wrecked && m.wrecked) {
        m.wrecked = false;
        m.body.material.color.set(new T.Color(v.color));
        m.group.rotation.z = 0;
        m.group.rotation.x = 0;
      }
      if (m.siren && v.siren) {
        const fl = Math.floor(W.gameTime * 5) % 2;
        m.siren.material.color.setHex(fl ? 0xef4444 : 0x3b82f6);
      }
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
    for (const n of W.npcs) {
      let e = nMap.get(n);
      if (!e) {
        let c = 0x94a3b8;
        if (n.police) c = 0x1e3a8a;
        else if (n.gang) c = 0x7f1d1d;
        else if (n.boss) c = 0xf8fafc;
        else c = parseInt(n.clothes.replace("#", ""), 16) || 0x94a3b8;
        const m = this.makeCharacter(c, 0.85);
        this.scene.add(m.group);
        e = { n: n, m: m };
        this.npcs.push(e); nMap.set(n, e);
      }
      const m = e.m;
      m.group.position.set(n.x, 0, n.y);
      if (n.dead) {
        if (!m.dead) {
          m.dead = true;
          m.group.rotation.x = Math.PI / 2;
          m.group.rotation.z = Utils.rand(0, Math.PI * 2);
        }
      } else {
        if (m.dead) { m.dead = false; m.group.rotation.x = 0; m.group.rotation.z = 0; }
        m.group.rotation.y = -n.heading;
        m.gun.rotation.y = -(n.aimAngle - n.heading);
        // 受击闪白后必须恢复本色，否则 NPC 会一直白着
        this.applyFlash(m, n.dmgFlash > 0.2, m.baseColor);
      }
    }
  },
  // 受击闪白：只在状态翻转时改材质颜色，避免每帧 setHex
  applyFlash(m, flashing, baseColor) {
    if (flashing) {
      if (!m.flash) { m.flash = true; m.body.material.color.setHex(0xffffff); }
    } else if (m.flash) {
      m.flash = false;
      m.body.material.color.setHex(baseColor);
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
        if (pk.type === "money") c = 0x16a34a;
        else if (pk.type === "health") c = 0xdc2626;
        else if (pk.type === "armor") c = 0x0ea5e9;
        const m = this.makePickupMesh(c);
        this.scene.add(m.group);
        e = { pk: pk, m: m };
        this.pickups.push(e); pMap.set(pk, e);
      }
      const bob = Math.sin(W.gameTime * 3 + i) * 0.6;
      e.m.group.position.set(pk.x, 1.2 + bob, pk.y);
      e.m.group.rotation.y = W.gameTime * 2 + i;
    }
  },
  syncMarkers(dt) {
    const T = window.THREE;
    // 复用同一个数组与条目对象，避免每帧 new 一批临时对象
    const list = this.markerList;
    let n = 0;
    const push = (x, y, color) => {
      let o = list[n];
      if (!o) { o = { x: 0, y: 0, color: "#ffffff" }; list[n] = o; }
      o.x = x; o.y = y; o.color = color; n++;
    };
    const cur = Missions.current;
    if (cur && cur.current && cur.current.marker && isFinite(cur.current.marker.x)) {
      push(cur.current.marker.x, cur.current.marker.y, cur.current.marker.color);
    } else {
      for (const mm of Missions.markers) {
        if (!Missions.doneIds[mm.id]) push(mm.x, mm.y, "#facc15");
      }
      if (Missions.taxiUnlocked) push(Missions.taxiStand.x, Missions.taxiStand.y, "#22c55e");
    }
    while (this.markers.length < n) {
      const m = this.makeMarkerMesh(0xfacc15);
      this.scene.add(m.group);
      this.markers.push({ m: m });
    }
    for (let i = 0; i < this.markers.length; i++) {
      const mm = this.markers[i].m;
      if (i < n) {
        mm.group.visible = true;
        mm.group.position.set(list[i].x, 0, list[i].y);
        mm.spike.material.color.set(list[i].color);
        mm.ring.material.color.set(list[i].color);
        mm.spike.rotation.y += dt * 3;
        const s = 1 + Math.sin(W.gameTime * 3) * 0.12;
        mm.ring.scale.set(s, 1, s);
      } else {
        mm.group.visible = false;
      }
    }
  },
  updateParticles() {
    const T = window.THREE;
    const parts = Combat.particles;
    const n = Math.min(parts.length, 500);
    for (let i = 0; i < n; i++) {
      const pt = parts[i];
      let h = 0.35;
      if (pt.type === "smoke") h = 1 + (1 - pt.life) * 5;
      else if (pt.type === "fire") h = 0.8 + (1 - pt.life) * 2.5;
      else if (pt.type === "muzzle") h = 1.4;
      this.pPos[i * 3] = pt.x;
      this.pPos[i * 3 + 1] = h;
      this.pPos[i * 3 + 2] = pt.y;
      let r = 255, g2 = 255, b2 = 255;
      if (pt.type === "blood") { r = 185; g2 = 28; b2 = 28; }
      else if (pt.type === "spark") { r = 253; g2 = 224; b2 = 71; }
      else if (pt.type === "smoke") { r = 100; g2 = 116; b2 = 139; }
      else if (pt.type === "fire") { r = 249; g2 = 115; b2 = 22; }
      else if (pt.type === "flash") { r = 255; g2 = 247; b2 = 214; }
      else if (pt.type === "muzzle") { r = 255; g2 = 224; b2 = 138; }
      this.pCol[i * 3] = r / 255; this.pCol[i * 3 + 1] = g2 / 255; this.pCol[i * 3 + 2] = b2 / 255;
    }
    this.pGeo.setDrawRange(0, n);
    this.pPosAttr.needsUpdate = true;
    this.pColAttr.needsUpdate = true;
    const bs = Combat.bullets;
    const nb = Math.min(bs.length, 300);
    for (let i = 0; i < nb; i++) {
      const b = bs[i];
      this.bPos[i * 3] = b.x;
      this.bPos[i * 3 + 1] = 1.2;
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
        if (f.mesh.geometry) f.mesh.geometry.dispose();
        if (f.mesh.material) f.mesh.material.dispose();
        this.flashFxList.splice(i, 1);
        continue;
      }
      const t = 1 - f.life / f.max;
      const s = 1 + t * 3;
      f.mesh.scale.set(s, s, s);
      f.mesh.material.opacity = f.life / f.max;
    }
  },
  updateCamera(dt) {
    const p = W.player;
    if (!p || !this.camTarget) return;
    if (!isFinite(this.camYaw)) this.camYaw = -Math.PI * 0.75;
    if (!isFinite(this.camPitch)) this.camPitch = 0.85;
    const px = p.vehicle ? p.vehicle.x : p.x;
    const pz = p.vehicle ? p.vehicle.y : p.y;
    const vehicle = p.vehicle;
    // 开车时镜头默认自动回正到车后；刚动过鼠标时让玩家自由观察
    this.mouseIdleT += dt;
    let targetYaw = this.camYaw;
    if (vehicle && this.mouseIdleT > 0.5) targetYaw = vehicle.heading + Math.PI;
    this.camYaw = Utils.angleLerp(this.camYaw, targetYaw, 1 - Math.exp(-3 * dt));
    const speedFactor = vehicle ? Utils.clamp(Math.abs(vehicle.fs) / vehicle.def.maxSpeed, 0, 1) : 0;
    const D = this.zoomD * (1 + speedFactor * 0.25);
    const cp = Math.cos(this.camPitch);
    const tx = px + Math.cos(this.camYaw) * cp * D;
    const tz = pz + Math.sin(this.camYaw) * cp * D;
    const ty = 1.5 + Math.sin(this.camPitch) * D;
    const k = 1 - Math.exp(-6 * dt);
    this.camTarget.x = Utils.lerp(this.camTarget.x, tx, k);
    this.camTarget.y = Utils.lerp(this.camTarget.y, ty, k);
    this.camTarget.z = Utils.lerp(this.camTarget.z, tz, k);
    // 穿楼保护：镜头落在建筑内时抬升到楼顶上方
    const bd = MapSys.data.buildings;
    for (const b of bd) {
      if (this.camTarget.x > b.x && this.camTarget.x < b.x + b.w && this.camTarget.z > b.y && this.camTarget.z < b.y + b.h) {
        const top = 16 + b.height * 18 + 8;
        if (this.camTarget.y < top) this.camTarget.y = top;
        break;
      }
    }
    this.camTarget.x = Utils.clamp(this.camTarget.x, 15, W.mapW - 15);
    this.camTarget.z = Utils.clamp(this.camTarget.z, 15, W.mapH - 15);
    const shake = Combat.shake;
    this.camera.position.set(
      this.camTarget.x + Utils.rand(-shake, shake) * 0.08,
      this.camTarget.y + Utils.rand(-shake, shake) * 0.04,
      this.camTarget.z + Utils.rand(-shake, shake) * 0.08
    );
    this.camera.lookAt(px, 1.5, pz);
  },
  // 屏幕方向 → 世界方向（地平面投影），供 WASD 使用
  screenVecs() {
    const p = W.player;
    // 3D 停用（无 WebGL）时退回固定的俯视方向，保证移动仍然可用
    if (this.disabled || !this.camTarget) return { ux: 0, uz: -1, rx: 1, rz: 0 };
    const sx = p.vehicle ? p.vehicle.x : p.x;
    const sz = p.vehicle ? p.vehicle.y : p.y;
    let fx = sx - this.camTarget.x;
    let fz = sz - this.camTarget.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl; fz /= fl;
    return { ux: fx, uz: fz, rx: -fz, rz: fx };
  },
  // 鼠标转动视角（yaw 水平 / pitch 俯仰）
  rotateCam(dyaw, dpitch) {
    if (this.disabled) return;
    if (!isFinite(dyaw) || !isFinite(dpitch)) return; // 挡住 0 尺寸画布等异常输入
    this.camYaw = Utils.angleDiff(this.camYaw + dyaw);
    this.camPitch = Utils.clamp(this.camPitch + dpitch, this.minPitch, this.maxPitch);
    this.mouseIdleT = 0;
  },
  aimPoint() {
    const p = W.player;
    // 3D 停用时用鼠标相对屏幕中心的偏移做近似瞄准
    if (this.disabled || !this.camera) {
      return { x: p.x + (Input.mouse.x - W.viewW / 2), y: p.y + (Input.mouse.y - W.viewH / 2) };
    }
    const shooter = p.vehicle || p;
    try {
      this.ndc.set(0, 0); // 准星固定屏幕中央
      this.raycaster.setFromCamera(this.ndc, this.camera);
      const hit = this.raycaster.ray.intersectPlane(this.plane, this.hitV);
      if (hit && isFinite(hit.x) && isFinite(hit.z)) return { x: hit.x, y: hit.z };
      const rd = this.raycaster.ray.direction;
      const hl = Math.hypot(rd.x, rd.z) || 1;
      return { x: shooter.x + rd.x / hl * 160, y: shooter.y + rd.z / hl * 160 };
    } catch (e) { /* ignore */ }
    return { x: shooter.x, y: shooter.y };
  },
  disposeGroup(g) {
    if (!g) return;
    g.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); }
    });
  },
};
