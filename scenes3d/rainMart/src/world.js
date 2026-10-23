import * as THREE from 'three';
import {
  COLORS,
  MAT,
  toon,
  box,
  mesh,
  plane,
  cylinder,
  applyEdges,
  addWire,
  canvasTexture,
  getGlowTexture,
  makeReflectionTexture,
  rand,
} from './utils.js';
import {
  makeAsphaltTexture,
  makeAsphaltRoughnessTexture,
  makeSidewalkTexture,
  makeTactileTexture,
  makePaintTexture,
  makeDrainTexture,
  makeNameplateTexture,
  makeRoadTextTexture,
  makeParkingSignTexture,
} from './textures.js';

export const LAYOUT = {
  BASE: 28,
  HALF: 14,
  ROAD_Y: 0,
  WALK_Y: 0.16,
  CURB_Y: 0.03,
  STORE: { x0: -7.5, x1: 2.5, z0: -10.5, z1: 1.8 },
  NEIGHBOR: { x0: -13.4, x1: -9.7, z0: -10.3, z1: 1.8 },
  ALLEY: { x0: -9.7, x1: -7.5, z0: -10.3, z1: 1.8 },
  SIDEWALK_SOUTH_Z1: 5.8,
  ROAD_EAST_X0: 5.8,
};

function makeEnvironmentMap() {
  const tex = canvasTexture(1024, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#050b14');
    g.addColorStop(0.42, '#162835');
    g.addColorStop(0.49, '#3a4b54');
    g.addColorStop(0.53, '#15212a');
    g.addColorStop(1, '#060b10');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // soft wet neon smears in the environment, used by puddles & car paint
    ctx.filter = 'blur(38px)';
    const lights = [
      [0.23, 0.54, 180, 70, 'rgba(255,200,125,0.62)'],
      [0.28, 0.53, 110, 55, 'rgba(255,233,185,0.5)'],
      [0.63, 0.57, 120, 42, 'rgba(122,214,224,0.35)'],
      [0.73, 0.54, 70, 28, 'rgba(232,104,84,0.28)'],
      [0.86, 0.46, 80, 24, 'rgba(125,146,191,0.22)'],
    ];
    for (const [fx, fy, rw, rh, color] of lights) {
      const lg = ctx.createRadialGradient(fx * w, fy * h, 0, fx * w, fy * h, rw);
      lg.addColorStop(0, color);
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg;
      ctx.save();
      ctx.translate(fx * w, fy * h);
      ctx.scale(1, rh / rw);
      ctx.beginPath();
      ctx.arc(0, 0, rw, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.filter = 'none';
    // a thin moonlit break in the clouds
    ctx.globalAlpha = 0.11;
    ctx.fillStyle = '#bcd7ed';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.18, w * 0.25, 14, -0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

function addBase(root) {
  const base = new THREE.Group();
  base.name = 'collectible-base';
  root.add(base);

  const woodMat = new THREE.MeshToonMaterial({ color: 0x3e2b25 });
  const woodTrimMat = new THREE.MeshToonMaterial({ color: 0x1e2c31 });
  const brassMat = new THREE.MeshToonMaterial({ color: 0x9b7b45, emissive: 0x2b1c08, emissiveIntensity: 0.2 });
  const plinthMat = new THREE.MeshToonMaterial({ color: 0x1d292f });

  const bottom = box(base, 29.5, 0.34, 29.5, woodMat, {
    y: -1.92,
    edge: true,
    edgeThreshold: 20,
    castShadow: false,
  });
  bottom.name = 'base-lower';
  box(base, 29.0, 0.68, 29.0, woodMat, { y: -1.41, edge: true, castShadow: true });
  box(base, 29.16, 0.055, 29.16, brassMat, { y: -1.065, edge: false });
  box(base, 28.55, 0.38, 28.55, woodTrimMat, { y: -0.85, edge: true });
  box(base, 28.0, 0.56, 28.0, plinthMat, { y: -0.38, edge: true, castShadow: true });
  // subtle brass line just under the street
  box(base, 28.06, 0.035, 28.06, brassMat, { y: -0.09, edge: false });

  const asphaltMap = makeAsphaltTexture();
  const asphaltRough = makeAsphaltRoughnessTexture();
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: asphaltMap,
    roughnessMap: asphaltRough,
    color: 0xb2bbc0,
    roughness: 0.82,
    metalness: 0.22,
    envMapIntensity: 0.8,
  });
  asphaltMat.name = 'wet-asphalt';

  const street = new THREE.Mesh(new THREE.PlaneGeometry(28, 28), asphaltMat);
  street.rotation.x = -Math.PI / 2;
  street.position.y = 0.002;
  street.receiveShadow = true;
  base.add(street);

  // physical plaque on the front face of the plinth
  const plaqueTex = makeNameplateTexture();
  const plaqueMat = new THREE.MeshBasicMaterial({ map: plaqueTex, toneMapped: false });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.44), plaqueMat);
  plaque.position.set(0, -1.42, 14.51);
  base.add(plaque);
  const plaqueBack = box(base, 3.7, 0.55, 0.06, brassMat, {
    x: 0,
    y: -1.42,
    z: 14.49,
    edge: true,
    castShadow: false,
  });
  plaqueBack.position.z = 14.49;
  plaque.position.z = 14.523;

  // a faint under-glow makes the model feel like it floats in rainy air
  const glowTex = canvasTexture(512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(91,139,163,0.38)');
    g.addColorStop(0.4, 'rgba(63,105,132,0.16)');
    g.addColorStop(1, 'rgba(20,38,53,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 52),
    new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -2.35;
  base.add(halo);

  return { group: base, asphaltMat };
}

function addSidewalkSlab(root, x0, x1, z0, z1, repX, repY, opts = {}) {
  const w = x1 - x0;
  const d = z1 - z0;
  const h = opts.height ?? 0.16;
  const sideMat = new THREE.MeshStandardMaterial({
    color: opts.sideColor ?? 0x435058,
    roughness: 0.85,
    metalness: 0.05,
  });
  const g = new THREE.Group();
  root.add(g);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sideMat);
  body.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
  body.receiveShadow = true;
  g.add(body);
  applyEdges(body, 30);

  const map = makeSidewalkTexture().clone();
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repX, repY);
  map.needsUpdate = true;
  const topMat = new THREE.MeshStandardMaterial({
    map,
    color: opts.color ?? 0xd2dbdc,
    roughness: 0.46,
    metalness: 0.12,
    envMapIntensity: 0.55,
  });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), topMat);
  top.rotation.x = -Math.PI / 2;
  top.position.set((x0 + x1) / 2, h + 0.002, (z0 + z1) / 2);
  top.receiveShadow = true;
  g.add(top);
  return g;
}

function addCurbs(root) {
  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x8c9699,
    roughness: 0.48,
    metalness: 0.05,
    envMapIntensity: 0.4,
  });
  const parts = [
    // south curb, split at zebra crossing
    [-14, 2.08, 5.71, 5.91],
    [4.87, 5.82, 5.71, 5.91],
    // east curb, split at zebra crossing
    [5.71, 5.91, -14, 3.18],
    [5.71, 5.91, 5.05, 5.82],
  ];
  parts.forEach(([x0, x1, z0, z1], i) => {
    const w = x1 - x0;
    const d = z1 - z0;
    const h = 0.28;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), curbMat);
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    m.castShadow = true;
    applyEdges(m, 32);
    root.add(m);
    // darker gutter seam
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(i < 2 ? w : 0.09, i < 2 ? 0.09 : d),
      new THREE.MeshBasicMaterial({ color: 0x172126, transparent: true, opacity: 0.55 }),
    );
    g.rotation.x = -Math.PI / 2;
    if (i < 2) g.position.set((x0 + x1) / 2, 0.006, 5.99);
    else g.position.set(6.01, 0.006, (z0 + z1) / 2);
    root.add(g);
  });

  // rounded-ish corner blocks
  const corner = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 10), curbMat);
  corner.position.set(5.81, 0.14, 5.81);
  corner.castShadow = true;
  applyEdges(corner, 36);
  root.add(corner);
}

function addTactile(root) {
  const tactile = makeTactileTexture();
  const addStrip = (x, z, w, d, rot = 0) => {
    const map = tactile.clone();
    map.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({
      map,
      color: 0xe1c886,
      roughness: 0.65,
      metalness: 0.02,
    });
    const geo = new THREE.PlaneGeometry(w, d);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rot;
    m.position.set(x, 0.166, z);
    m.receiveShadow = true;
    root.add(m);
  };
  addStrip(3.45, 5.29, 2.55, 0.62);
  addStrip(5.31, 4.16, 0.62, 1.85, Math.PI / 2);
  // guidance line along the shop front
  addStrip(-2.3, 3.02, 13.3, 0.3);
  addStrip(3.24, 0.1, 0.3, 8.8);
}

function addRoadMarkings(root) {
  const paintMap = makePaintTexture();
  const whiteMat = new THREE.MeshStandardMaterial({
    map: paintMap,
    color: 0xe7e8dd,
    roughness: 0.34,
    metalness: 0.1,
    transparent: true,
    opacity: 0.86,
    envMapIntensity: 0.8,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const change = new THREE.MeshStandardMaterial({
    map: paintMap,
    color: 0xf1e6c0,
    roughness: 0.4,
    transparent: true,
    opacity: 0.7,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const flatPlane = (w, d, mat, x, z, rot = 0, y = 0.012) => {
    const geo = new THREE.PlaneGeometry(w, d);
    const m = new THREE.Mesh(geo, mat);
    m.geometry.rotateX(-Math.PI / 2);
    m.rotation.y = rot;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    root.add(m);
    return m;
  };

  // zebra across the south road
  for (let i = 0; i < 10; i++) {
    flatPlane(2.42, 0.34, whiteMat, 3.47, 6.16 + i * 0.8);
  }
  // zebra across the east road
  for (let i = 0; i < 10; i++) {
    flatPlane(0.34, 1.78, whiteMat, 6.18 + i * 0.78, 4.12);
  }
  // stop bars
  flatPlane(2.6, 0.2, whiteMat, 3.45, 13.55);
  flatPlane(0.2, 3.2, whiteMat, 13.3, 4.12);

  // dashed center lines
  for (let i = 0; i < 10; i++) {
    flatPlane(1.25, 0.1, change, -13.1 + i * 2.55, 9.9);
  }
  for (let i = 0; i < 6; i++) {
    flatPlane(0.1, 1.25, change, 9.9, -12.8 + i * 2.5);
  }
  // road edge lines
  flatPlane(19.2, 0.08, whiteMat, -4.5, 6.22);
  flatPlane(0.08, 19.7, whiteMat, 6.22, -4.02);
  flatPlane(0.08, 7.05, whiteMat, 13.55, -10.5);

  // parking bays on the far side of the east street
  for (let i = 0; i < 5; i++) {
    flatPlane(3.4, 0.09, whiteMat, 12.1, -10.2 + i * 2.5);
  }
  flatPlane(0.09, 10.0, whiteMat, 10.4, -5.2);
  flatPlane(0.09, 10.0, whiteMat, 13.8, -5.2);
  // wheel stops at the head of the bays
  const stopMat = new THREE.MeshStandardMaterial({ color: 0x6a7476, roughness: 0.8 });
  for (const z of [-8.95, -6.45, -3.95]) {
    const stop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 1.35), stopMat);
    stop.position.set(13.58, 0.05, z);
    stop.castShadow = true;
    applyEdges(stop, 35);
    root.add(stop);
  }

  // worn Japanese road lettering
  const stopTex = makeRoadTextTexture();
  const stopPaint = new THREE.MeshBasicMaterial({
    map: stopTex,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    toneMapped: true,
  });
  const stopGeo = new THREE.PlaneGeometry(2.7, 1.35);
  stopGeo.rotateX(-Math.PI / 2);
  const stopText = new THREE.Mesh(stopGeo, stopPaint);
  stopText.position.set(8.1, 0.016, 1.05);
  stopText.rotation.y = Math.PI;
  root.add(stopText);

  // parking legend P
  flatPlane(1.0, 1.4, whiteMat, 12.3, -6.0);

  return { whiteMat, changeMat: change };
}

function addGratesAndLids(root) {
  const drainTex = makeDrainTexture();
  const drainMat = new THREE.MeshStandardMaterial({
    map: drainTex,
    roughness: 0.38,
    metalness: 0.58,
    color: 0xb6c3c4,
  });
  const addGrate = (x, z, w, d, rot = 0) => {
    const geo = new THREE.PlaneGeometry(w, d);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, drainMat);
    m.position.set(x, 0.011, z);
    m.rotation.y = rot;
    m.receiveShadow = true;
    root.add(m);
    const recess = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 0.16, d + 0.16),
      new THREE.MeshBasicMaterial({ color: 0x0b1115 }),
    );
    recess.rotation.x = -Math.PI / 2;
    recess.position.set(x, 0.006, z);
    recess.rotation.z = rot;
    root.add(recess);
  };
  addGrate(4.85, 6.04, 1.1, 0.5);
  addGrate(-3.7, 6.02, 1.2, 0.5);
  addGrate(6.02, -1.2, 0.5, 1.25, Math.PI / 2);
  addGrate(6.02, -8.2, 0.5, 1.1, Math.PI / 2);
  addGrate(-10.8, 5.0, 0.75, 0.42);
  addGrate(3.9, 1.9, 0.42, 0.75, Math.PI / 2);

  // manhole covers
  const lidMat = new THREE.MeshStandardMaterial({
    color: 0x2c3a3e,
    roughness: 0.5,
    metalness: 0.75,
  });
  const lidMats = new THREE.MeshStandardMaterial({
    color: 0x5a6766,
    roughness: 0.4,
    metalness: 0.75,
  });
  for (const [x, z, r] of [[1.3, 8.6, 0.56], [8.5, -3.3, 0.48], [11.2, 7.6, 0.44]]) {
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.026, 30), lidMat);
    lid.position.set(x, 0.013, z);
    lid.receiveShadow = true;
    root.add(lid);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.62, 0.035, 6, 28), lidMats);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.027, z);
    root.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.34, 0.022, 5, 22), lidMats);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.set(x, 0.028, z);
    root.add(ring2);
  }
}

function makePuddleMesh(mat, x, z, radiusX, radiusZ, y, seed = 1) {
  const geo = new THREE.CircleGeometry(1, 34);
  const pos = geo.attributes.position;
  let s = seed * 12.9898;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const rr = Math.hypot(px, py);
    if (rr > 0.01) {
      s = Math.sin(s) * 43758.5453;
      const n = 1 + (s - Math.floor(s) - 0.5) * 0.09;
      pos.setXY(i, px * n, py * n);
    }
  }
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(radiusX, 1, radiusZ);
  m.renderOrder = 2;
  m.receiveShadow = false;
  return m;
}

function addPuddles(root) {
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x09141c,
    roughness: 0.035,
    metalness: 0.65,
    transparent: true,
    opacity: 0.78,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    envMapIntensity: 1.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const puddles = [];
  const data = [
    // [x, z, rx, rz, sidewalk?]
    [-3.2, 3.5, 0.82, 0.38, true, 1],
    [1.35, 4.18, 1.15, 0.52, true, 2],
    [-11.1, 4.05, 1.15, 0.42, true, 3],
    [4.25, -2.9, 0.5, 1.1, true, 4],
    [4.45, -7.4, 0.65, 0.42, true, 5],
    [3.15, 3.55, 0.45, 0.28, true, 6],
    [2.1, 8.15, 1.25, 0.58, false, 7],
    [8.8, 9.5, 1.9, 0.82, false, 8],
    [7.2, 1.75, 0.88, 0.53, false, 9],
    [12.4, 7.6, 0.72, 0.38, false, 10],
    [-6.2, 9.3, 0.95, 0.48, false, 11],
    [-8.65, 0.2, 0.42, 0.95, true, 12],
    [-8.8, -4.0, 0.5, 0.72, true, 13],
    [-1.4, -12.4, 0.8, 0.36, true, 14],
    [8.9, -8.5, 0.62, 0.33, false, 15],
    [9.0, -11.9, 0.7, 0.32, false, 16],
  ];
  for (const [x, z, rx, rz, sidewalk, seed] of data) {
    const y = sidewalk ? 0.168 : 0.012;
    const m = makePuddleMesh(waterMat, x, z, rx, rz, y, seed);
    root.add(m);
    puddles.push({ mesh: m, x, z, rx, rz, y });
  }

  // subtle glints inside puddles, wet-paint style
  const glintTex = getGlowTexture();
  for (const p of puddles) {
    const mat = new THREE.MeshBasicMaterial({
      map: glintTex,
      color: p.x > 6 ? 0xbfe3ff : 0xffd797,
      transparent: true,
      opacity: p.y > 0.1 ? 0.11 : 0.085,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(p.rx * 2.2, p.rz * 2.3), mat);
    g.rotation.x = -Math.PI / 2;
    g.position.set(p.x + p.rx * 0.1, p.y + 0.002, p.z);
    g.renderOrder = 4;
    root.add(g);
    p.glint = g;
  }
  return { waterMat, puddles };
}

function makeStorefrontReflectionTexture() {
  return canvasTexture(512, 1024, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);

    // A soft pool that fades away from the shop front.
    const pool = ctx.createLinearGradient(0, 0, 0, h);
    pool.addColorStop(0, 'rgba(255,196,116,0)');
    pool.addColorStop(0.16, 'rgba(255,196,116,0.2)');
    pool.addColorStop(0.55, 'rgba(255,174,96,0.1)');
    pool.addColorStop(1, 'rgba(255,174,96,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, w, h);

    // Vertical window bands, smeared by the wet asphalt.
    const bands = [
      { x: 0.07, w: 0.09, color: '#ffd99c' },
      { x: 0.2, w: 0.07, color: '#8ed8cf' },
      { x: 0.33, w: 0.1, color: '#ffe8b0' },
      { x: 0.49, w: 0.07, color: '#e98a68' },
      { x: 0.62, w: 0.09, color: '#ffe0a1' },
      { x: 0.78, w: 0.08, color: '#b8e6d7' },
      { x: 0.9, w: 0.05, color: '#ffd28c' },
    ];
    ctx.filter = 'blur(13px)';
    for (const b of bands) {
      const g = ctx.createLinearGradient(0, 60, 0, h * 0.9);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.12, b.color);
      g.addColorStop(0.7, 'rgba(255,190,112,0.18)');
      g.addColorStop(1, 'rgba(255,190,112,0)');
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = g;
      ctx.fillRect(b.x * w, 55, b.w * w, h * 0.82);
    }

    // Broken vertical glints, like rain-rippled neon.
    ctx.filter = 'blur(4px)';
    for (let i = 0; i < 26; i++) {
      const x = 18 + Math.random() * (w - 36);
      const top = h * (0.12 + Math.random() * 0.26);
      const len = h * (0.18 + Math.random() * 0.42);
      const cw = 2 + Math.random() * 8;
      const g = ctx.createLinearGradient(0, top, 0, top + len);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.35, i % 3 === 0 ? 'rgba(171,239,224,0.5)' : 'rgba(255,232,180,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 0.18 + Math.random() * 0.22;
      ctx.fillStyle = g;
      ctx.fillRect(x, top, cw, len);
    }

    // A few horizontal ripple interruptions.
    ctx.filter = 'blur(3px)';
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#fff3d0';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const y = h * (0.2 + Math.random() * 0.68);
      ctx.beginPath();
      ctx.moveTo(w * (0.05 + Math.random() * 0.18), y);
      ctx.lineTo(w * (0.55 + Math.random() * 0.4), y + (Math.random() - 0.5) * 7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
  }, { colorSpace: THREE.SRGBColorSpace });
}

function addLightSpills(root) {
  const animated = [];

  const spill = (x, z, w, d, color, opacity, texture = null, rot = 0, y = 0.022) => {
    const tex = texture ?? getGlowTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const geo = new THREE.PlaneGeometry(w, d);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = rot;
    m.renderOrder = 5;
    root.add(m);
    return m;
  };
  const walkY = LAYOUT.WALK_Y + 0.012;

  // warm window and sign spill on the front sidewalk
  const windowTex = makeReflectionTexture('#ffd393', '#e47256');
  const signTex = makeReflectionTexture('#fff1c9', '#e1b459');
  const vendingTex = makeReflectionTexture('#a8f4fb', '#5d9aa6');
  const coolTex = makeReflectionTexture('#b7d8ef', '#637b9a');
  const redTex = makeReflectionTexture('#ffb2a0', '#d66b56');

  spill(-1.4, 3.42, 11.6, 3.3, 0xffcf8d, 0.8, windowTex, 0, walkY);
  spill(-3.4, 2.55, 10.3, 1.75, 0xffe2a7, 0.72, signTex, 0, walkY);
  spill(-9.6, 3.3, 4.8, 2.7, 0xffc073, 0.38, signTex, 0, walkY);
  // broad warm pools where the windows wash the pavement
  spill(-2.5, 3.3, 12.4, 4.1, 0xffb872, 0.3);
  spill(0.35, 3.05, 4.8, 2.7, 0xffca88, 0.38);

  // vending machine light pools on east pavement
  spill(4.36, -4.55, 1.75, 4.2, 0xc6fbff, 0.5, vendingTex, Math.PI / 2, walkY);
  spill(4.8, -3.9, 3.8, 1.5, 0xb0f7ff, 0.32, vendingTex, Math.PI / 2, walkY);

  // streetlight reflected on the wet road
  spill(-8.3, 7.6, 6.7, 3.8, 0x99c9ea, 0.25, coolTex, Math.PI / 2);
  spill(-7.1, 9.4, 8.2, 2.4, 0x6e8ca9, 0.15, coolTex);

  // convenience store reflection on the road, faint but long
  const storefrontTex = makeStorefrontReflectionTexture();
  spill(-2.0, 8.1, 10.4, 6.2, 0xffffff, 0.58, storefrontTex);
  spill(0.6, 8.1, 8.6, 4.6, 0xffd89e, 0.22, signTex);

  // warm alley lantern spill
  spill(-8.65, 2.4, 2.5, 1.8, 0xffaa72, 0.5, redTex, 0, walkY);

  // cool traffic light glint is animated by the effects module
  const signalReflection = spill(11.4, 8.6, 2.2, 4.9, 0x68e6b0, 0.14, coolTex, Math.PI / 2);
  animated.push(signalReflection);

  return { meshes: animated, textures: { windowTex, signTex, vendingTex, coolTex, redTex } };
}

function addStreetSheen(root) {
  // very soft horizontal streaks: the road reflects a sliver of the night sky
  const sheenTex = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(160,195,218,0)');
    g.addColorStop(0.45, 'rgba(169,206,227,0.23)');
    g.addColorStop(0.6, 'rgba(120,160,190,0.11)');
    g.addColorStop(1, 'rgba(160,195,218,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.filter = 'blur(3px)';
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = `rgba(220,238,248,${0.02 + Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 25 + Math.random() * 100, 1);
    }
  });
  const mat = new THREE.MeshBasicMaterial({
    map: sheenTex,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const positions = [
    [0, 10.8, 20, 2.6, 0.04],
    [9.2, 1.2, 1.6, 9, 0.03],
    [-6.5, 7.0, 10, 1.2, 0.03],
    [7.8, 12.4, 8.5, 1.5, 0.03],
  ];
  positions.forEach(([x, z, w, d]) => {
    const geo = new THREE.PlaneGeometry(w, d);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0.017, z);
    m.rotation.y = 0.07;
    root.add(m);
  });
}

function addStreetFurnitureBack(root) {
  // rear boundary — a quiet cutaway with a fence and hedge so the back is not empty
  const fenceMat = new THREE.MeshToonMaterial({ color: 0x2e3b3a });
  const hedgeMat = new THREE.MeshToonMaterial({ color: 0x162c2a });

  for (let i = 0; i < 23; i++) {
    const x = -13.3 + i * 0.72;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.05 + (i % 3) * 0.08, 0.055), fenceMat);
    m.position.set(x, 0.55, -13.72);
    m.castShadow = true;
    root.add(m);
  }
  for (const y of [0.38, 0.95]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.06, 0.07), fenceMat);
    rail.position.set(-5.1, y, -13.72);
    root.add(rail);
  }
  // dark hedge behind the fence
  const hedge = new THREE.Mesh(new THREE.BoxGeometry(16.1, 0.95, 0.55), hedgeMat);
  hedge.position.set(-5.1, 0.55, -13.96);
  hedge.castShadow = true;
  applyEdges(hedge, 40);
  root.add(hedge);
}

export function createWorld(scene, renderer) {
  const envMap = makeEnvironmentMap();
  scene.environment = envMap;
  if ('environmentIntensity' in scene) scene.environmentIntensity = 0.62;
  scene.environmentRotation = new THREE.Euler(0, 2.4, 0);

  const root = new THREE.Group();
  root.name = 'rain-mart-world';
  scene.add(root);

  const { asphaltMat } = addBase(root);

  addSidewalkSlab(root, -13.85, 5.8, 1.8, 5.8, 8.2, 1.6);
  addSidewalkSlab(root, 2.5, 5.8, -13.85, 1.8, 1.3, 6.4);
  addSidewalkSlab(root, -13.45, 2.5, -13.85, -10.5, 6.8, 1.35, {
    height: 0.11,
    sideColor: 0x4a565a,
    color: 0xc7d0d0,
  });
  // alley floor slightly lower and darker
  const alleyMap = makeSidewalkTexture().clone();
  alleyMap.wrapS = alleyMap.wrapT = THREE.RepeatWrapping;
  alleyMap.repeat.set(0.85, 5.2);
  alleyMap.needsUpdate = true;
  const alleyMat = new THREE.MeshStandardMaterial({
    map: alleyMap,
    color: 0x778383,
    roughness: 0.58,
    metalness: 0.08,
    envMapIntensity: 0.35,
  });
  const alley = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 12.1), alleyMat);
  alley.position.set(-8.6, 0.06, -4.25);
  alley.receiveShadow = true;
  root.add(alley);

  addCurbs(root);
  addTactile(root);
  const paint = addRoadMarkings(root);
  addGratesAndLids(root);
  const { puddles, waterMat } = addPuddles(root);
  const spill = addLightSpills(root);
  addStreetSheen(root);
  addStreetFurnitureBack(root);

  return {
    root,
    asphaltMat,
    waterMat,
    puddles,
    lightSpills: spill.meshes,
    reflectionTextures: spill.textures,
    paint,
    envMap,
  };
}
