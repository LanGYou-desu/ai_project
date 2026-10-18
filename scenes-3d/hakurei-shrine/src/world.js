import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  PAL,
  toon,
  box,
  cylinder,
  plane,
  decal,
  tube,
  addOutline,
  contactShadow,
  makeCloud,
  mulberry32,
  createGroundTexture,
  createStoneTexture,
  createPaverTexture,
  createWoodTexture,
  createRoofTexture,
  createPlaqueTexture,
  createLanternTexture,
  createNoticeTexture,
  createEmaTexture,
  createWaterTexture,
  createRopeTexture,
  createShojiTexture,
} from './helpers.js';

const CACHE = {};

function textures() {
  if (!CACHE.ground) {
    CACHE.ground = createGroundTexture();
    CACHE.stone = createStoneTexture();
    CACHE.paver = createPaverTexture();
    CACHE.wood = createWoodTexture();
    CACHE.woodDark = createWoodTexture(512, 128, true);
    CACHE.roof = createRoofTexture();
    CACHE.shoji = createShojiTexture(4, 7, false);
    CACHE.water = createWaterTexture();
    CACHE.rope = createRopeTexture();
    CACHE.notice = createNoticeTexture();
    CACHE.toriiPlaque = createPlaqueTexture('博麗神社', {
      width: 512,
      height: 180,
      font: 'bold 82px "Yu Mincho", "MS Mincho", serif',
    });
    CACHE.basePlaque = createPlaqueTexture('博麗神社', {
      width: 512,
      height: 140,
      font: 'bold 68px "Yu Mincho", "MS Mincho", serif',
    });
    CACHE.officePlaque = createPlaqueTexture('社務所', {
      width: 360,
      height: 150,
      font: 'bold 72px "Yu Mincho", "MS Mincho", serif',
    });
    CACHE.chozyaPlaque = createPlaqueTexture('手水舎', {
      width: 360,
      height: 140,
      font: 'bold 66px "Yu Mincho", "MS Mincho", serif',
    });
    CACHE.ema = Array.from({ length: 5 }, (_, i) => createEmaTexture(i));
    CACHE.lantern = createLanternTexture('奉納');
    CACHE.lanternSmall = createLanternTexture('御神燈');
  }
  return CACHE;
}

const MATS = {};

function materials() {
  if (MATS.ready) return MATS;
  const t = textures();
  MATS.ground = toon(0xffffff, { map: t.ground });
  MATS.stone = toon(0xe5e1d4, { map: t.stone });
  MATS.paverA = toon(0xf2efe4, { map: t.paver });
  MATS.paverB = toon(0xe7e5db, { map: t.paver });
  MATS.paverC = toon(0xdadbd2, { map: t.paver });
  MATS.wood = toon(0xffffff, { map: t.wood });
  MATS.woodDark = toon(0xd2b596, { map: t.woodDark });
  MATS.roof = toon(0xffffff, { map: t.roof });
  MATS.shoji = toon(0xffffff, { map: t.shoji });
  MATS.water = toon(0xffffff, {
    map: t.water,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });
  MATS.rope = toon(0xffffff, { map: t.rope });
  MATS.vermilion = toon(PAL.vermilion);
  MATS.vermilionDeep = toon(PAL.vermilionDeep);
  MATS.red = toon(PAL.redMuted);
  MATS.woodPlain = toon(PAL.wood);
  MATS.woodLight = toon(PAL.woodLight);
  MATS.woodPale = toon(PAL.woodPale);
  MATS.woodInk = toon(PAL.woodInk);
  MATS.plaster = toon(PAL.plaster);
  MATS.plasterShade = toon(PAL.plasterShade);
  MATS.ink = toon(PAL.ink);
  MATS.gold = toon(PAL.gold);
  MATS.goldLight = toon(PAL.goldLight);
  MATS.stonePlain = toon(PAL.stone);
  MATS.stoneLight = toon(PAL.stoneLight);
  MATS.stoneDark = toon(PAL.stoneDark);
  MATS.stoneBlue = toon(PAL.stoneBlue);
  MATS.moss = toon(PAL.moss);
  MATS.mossLight = toon(PAL.mossLight);
  MATS.roofDeep = toon(PAL.roofDeep);
  MATS.roofEdge = toon(PAL.roofEdge);
  MATS.indigo = toon(PAL.indigo);
  MATS.leaf = toon(PAL.leaf);
  MATS.paper = toon(PAL.paper);
  MATS.ready = true;
  return MATS;
}

/* ------------------------------------------------------------------ *
 * Base, ground, paving and steps
 * ------------------------------------------------------------------ */
function buildBase(root) {
  const t = textures();
  const m = materials();

  const underShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(31, 31),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.2,
      color: 0x686b62,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  // A radial gradient gives the tiny island a soft, floating shadow.
  const shadowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 126);
    g.addColorStop(0, 'rgba(66,64,59,0.5)');
    g.addColorStop(0.45, 'rgba(66,64,59,0.22)');
    g.addColorStop(1, 'rgba(66,64,59,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
  })();
  underShadow.material.map = shadowTex;
  underShadow.material.needsUpdate = true;
  underShadow.rotation.x = -Math.PI / 2;
  underShadow.position.y = -2.5;
  underShadow.renderOrder = 0;
  root.add(underShadow);

  // Stone core.
  const stoneCore = new THREE.Mesh(
    new RoundedBoxGeometry(20.36, 1.34, 20.36, 5, 0.32),
    m.stone,
  );
  stoneCore.position.y = -0.87;
  stoneCore.castShadow = true;
  stoneCore.receiveShadow = true;
  addOutline(stoneCore, 0.036);
  root.add(stoneCore);

  // Dark foot.
  const foot = new THREE.Mesh(
    new RoundedBoxGeometry(20.22, 0.2, 20.22, 5, 0.22),
    m.woodDark,
  );
  foot.position.y = -1.58;
  foot.receiveShadow = true;
  foot.castShadow = true;
  addOutline(foot, 0.026);
  root.add(foot);

  // Warm wooden interlayer.
  const belt = new THREE.Mesh(
    new RoundedBoxGeometry(20.57, 0.24, 20.57, 5, 0.24),
    m.wood,
  );
  belt.position.y = -0.66;
  belt.castShadow = true;
  belt.receiveShadow = true;
  addOutline(belt, 0.024);
  root.add(belt);

  // Slim upper stone lip and the top wooden frame around the garden.
  const upperLip = new THREE.Mesh(
    new RoundedBoxGeometry(20.43, 0.15, 20.43, 5, 0.23),
    m.stoneLight,
  );
  upperLip.position.y = -0.19;
  upperLip.castShadow = true;
  upperLip.receiveShadow = true;
  addOutline(upperLip, 0.022);
  root.add(upperLip);

  const frame = new THREE.Mesh(
    new RoundedBoxGeometry(20.4, 0.11, 20.4, 5, 0.2),
    m.woodDark,
  );
  frame.position.y = -0.035;
  frame.castShadow = true;
  frame.receiveShadow = true;
  root.add(frame);

  // The ground surface itself.
  const ground = plane(
    root,
    19.99,
    19.99,
    0,
    0.032,
    0,
    m.ground,
    [-Math.PI / 2, 0, 0],
  );
  ground.receiveShadow = true;

  // Stone quoins emphasise the masonry at each corner.
  const quoinMat = m.stoneLight;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const q = box(
          root,
          0.33,
          0.23,
          0.35,
          sx * 10.06,
          -1.35 + i * 0.27,
          sz * 10.06,
          i % 2 ? quoinMat : m.stonePlain,
          { castShadow: true, receiveShadow: true },
        );
        q.rotation.y = 0;
      }
    }
  }

  // Iron studs along the wooden belt.
  for (let i = -4; i <= 4; i++) {
    for (const sz of [-1, 1]) {
      const stud = box(root, 0.08, 0.1, 0.08, i * 2.15, -0.66, sz * 10.31, m.ink, {
        castShadow: false,
      });
      stud.rotation.x = Math.PI / 2;
    }
  }

  // Front nameplate, a tiny collectible detail.
  const plaque = decal(root, 2.3, 0.63, 0, -0.66, 10.305, t.basePlaque, {
    transparent: true,
    depthWrite: false,
    toneMapped: true,
  });
  plaque.renderOrder = 3;

  // A whisper of moss along the bottom edge.
  const rnd = mulberry32(0xa1b);
  for (let i = 0; i < 70; i++) {
    const side = Math.floor(rnd() * 4);
    const u = -9.4 + rnd() * 18.8;
    const edge = 10.12;
    let x;
    let z;
    if (side === 0) { x = u; z = edge; }
    else if (side === 1) { x = u; z = -edge; }
    else if (side === 2) { x = edge; z = u; }
    else { x = -edge; z = u; }
    const clump = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.11 + rnd() * 0.3, 0),
      rnd() > 0.5 ? m.moss : m.mossLight,
    );
    clump.position.set(x, -1.46 + rnd() * 0.1, z);
    clump.scale.y = 0.4;
    clump.rotation.y = rnd() * Math.PI;
    clump.castShadow = false;
    root.add(clump);
  }

  return { underShadow };
}

function buildPaving(root) {
  const m = materials();
  const rnd = mulberry32(0x10ab);
  const slabs = [];

  const stoneMats = [m.paverA, m.paverB, m.paverC, m.paverA];

  function slab(x, z, w, d, top, rot = 0, material = stoneMats[Math.floor(rnd() * stoneMats.length)]) {
    const mesh = box(root, w, 0.075, d, x, top - 0.0375, z, material, {
      rounded: true,
      castShadow: true,
      receiveShadow: true,
    });
    mesh.rotation.y = rot;
    // Slight bevel is faked with a thin darker under-sill.
    const sill = box(root, w + 0.06, 0.025, d + 0.06, x, top - 0.085, z, m.stoneDark, {
      castShadow: false,
      receiveShadow: true,
    });
    sill.rotation.y = rot;
    slabs.push({ x, z, w, d, top });
    return mesh;
  }

  // The main approach: irregular hand-cut slabs with a soft central crown.
  let z = 9.22;
  let row = 0;
  while (z > 1.65) {
    const depth = 0.58 + rnd() * 0.12;
    const width = 2.4 + Math.sin(row * 0.7) * 0.1 + rnd() * 0.17;
    slab(
      (rnd() - 0.5) * 0.06,
      z,
      width,
      depth,
      0.075 + (row % 3 === 0 ? 0.006 : 0),
      (rnd() - 0.5) * 0.012,
      stoneMats[row % stoneMats.length],
    );
    z -= depth + 0.07;
    row++;
  }

  // Trodden flagstones widening around the steps.
  slab(0, 1.55, 3.55, 0.55, 0.074, 0, m.paverB);
  slab(0, 1.08, 3.9, 0.46, 0.072, 0, m.paverA);

  // A few flags spill out on either side, making the courtyard feel used.
  const sideFlags = [
    [-2.35, 6.4, 1.2, 0.8, 0.06, 0.12],
    [2.55, 6.55, 1.0, 0.72, 0.058, -0.17],
    [-2.55, 4.6, 1.0, 0.9, 0.06, 0.2],
    [2.72, 4.3, 1.1, 0.68, 0.058, -0.08],
    [-2.75, 2.8, 0.9, 0.7, 0.056, -0.1],
  ];
  for (const [x, sz, w, d, top, rot] of sideFlags) {
    slab(x, sz, w, d, top, rot, stoneMats[Math.floor(rnd() * stoneMats.length)]);
  }

  // A stepping-stone path towards the purification pavilion.
  const stones = [
    [-2.4, 5.4, 0.48],
    [-3.1, 5.0, 0.43],
    [-3.9, 4.7, 0.46],
    [-4.75, 4.55, 0.4],
    [-5.45, 4.3, 0.42],
  ];
  for (const [x, sz, r] of stones) {
    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 1.05, 0.07, 8),
      m.stoneLight,
    );
    stone.position.set(x, 0.037, sz);
    stone.rotation.y = rnd() * Math.PI;
    stone.receiveShadow = true;
    stone.castShadow = true;
    root.add(stone);
    slabs.push({ x, z: sz, w: r * 1.6, d: r * 1.6, top: 0.072 });
  }

  // A little path towards the shrine office on the right.
  for (let i = 0; i < 4; i++) {
    const x = 5.02 + i * 0.68;
    const sz = 0.8 - i * 0.62;
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.07, 7), m.stonePlain);
    stone.position.set(x, 0.035, sz);
    stone.rotation.y = rnd() * Math.PI;
    stone.receiveShadow = true;
    root.add(stone);
    slabs.push({ x, z: sz, w: 0.54, d: 0.54, top: 0.07 });
  }

  return slabs;
}

function buildGroundDetails(root) {
  const m = materials();
  const rnd = mulberry32(0xe4a1);

  // Low mossy stones, fallen leaves and tiny weeds soften the path edges.
  const pebbleMats = [m.stoneDark, m.stonePlain, m.stoneBlue];
  for (let i = 0; i < 34; i++) {
    const x = (rnd() > 0.5 ? 1 : -1) * (2.8 + rnd() * 3.8);
    const z = -0.6 + rnd() * 9.2;
    if (Math.abs(x) < 2.55) continue;
    const stone = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.08 + rnd() * 0.2, 0),
      pebbleMats[Math.floor(rnd() * pebbleMats.length)],
    );
    stone.position.set(x, 0.05 + rnd() * 0.03, z);
    stone.scale.set(1.2, 0.38 + rnd() * 0.25, 0.85);
    stone.rotation.y = rnd() * Math.PI;
    stone.castShadow = true;
    stone.receiveShadow = true;
    root.add(stone);
  }

  // A softly irregular stone edging runs down both sides of the approach.
  for (const side of [-1, 1]) {
    let z = 1.9;
    while (z < 9.35) {
      const x = side * (1.48 + rnd() * 0.18);
      const stone = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.09 + rnd() * 0.1, 0),
        rnd() > 0.5 ? m.stonePlain : m.stoneDark,
      );
      stone.position.set(x, 0.055, z);
      stone.scale.set(1.1, 0.62, 0.9);
      stone.rotation.y = rnd() * Math.PI;
      stone.castShadow = true;
      stone.receiveShadow = true;
      root.add(stone);
      z += 0.38 + rnd() * 0.22;
    }
  }

  // Small moss cushions between slabs.
  for (let i = 0; i < 44; i++) {
    const side = rnd() > 0.5 ? 1 : -1;
    const x = side * (1.62 + rnd() * 0.34);
    const z = 1.8 + rnd() * 7.0;
    const moss = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.07 + rnd() * 0.15, 0),
      rnd() > 0.6 ? m.mossLight : m.moss,
    );
    moss.position.set(x, 0.045, z);
    moss.scale.y = 0.24;
    moss.rotation.y = rnd() * Math.PI;
    moss.castShadow = false;
    root.add(moss);
  }
}

/* ------------------------------------------------------------------ *
 * Torii gate
 * ------------------------------------------------------------------ */
function curvedTop(root, y, z, halfWidth, material) {
  const count = 13;
  const step = (halfWidth * 2) / count;
  const segmentMaterial = material;
  let previous = null;
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) / count;
    const x = -halfWidth + step * (i + 0.5);
    const t = Math.abs(x) / halfWidth;
    const yy = y + Math.pow(t, 4.4) * 0.32 + (1 - t) * 0.015;
    const slope = Math.sign(x) * Math.pow(t, 3.4) * 0.22;
    const seg = box(
      root,
      step * 1.13,
      0.24,
      0.34,
      x,
      yy,
      z,
      segmentMaterial,
      { castShadow: true, receiveShadow: true },
    );
    seg.rotation.z = -Math.atan(slope);
    previous = seg;
    if (i === 0 || i === count - 1) {
      const cap = box(root, step * 1.14, 0.29, 0.42, x, yy, z, material, {
        castShadow: true,
        receiveShadow: true,
      });
      cap.rotation.z = -Math.atan(slope);
    }
  }
  return previous;
}

function buildTorii(root) {
  const m = materials();
  const t = textures();
  const group = new THREE.Group();
  group.position.set(0, 0, 7.35);
  root.add(group);

  const z = 0;
  const pillarX = 2.45;
  const pillarHeight = 3.7;
  for (const sx of [-1, 1]) {
    // Footing.
    box(group, 0.72, 0.18, 0.72, sx * pillarX, 0.09, z, m.stoneDark, {
      castShadow: true,
      receiveShadow: true,
    });
    box(group, 0.52, 0.16, 0.52, sx * pillarX, 0.24, z, m.stoneLight, {
      castShadow: true,
      receiveShadow: true,
    });
    const pillar = cylinder(
      group,
      0.165,
      0.195,
      pillarHeight,
      12,
      sx * pillarX,
      0.3 + pillarHeight / 2,
      z,
      m.vermilion,
      { outline: 0.024 },
    );
    // Dark metal collars.
    cylinder(group, 0.205, 0.205, 0.1, 12, sx * pillarX, 0.46, z, m.ink, { outline: false });
    cylinder(group, 0.195, 0.195, 0.09, 12, sx * pillarX, 3.34, z, m.ink, { outline: false });
    // A slight inward lean reads as a traditional torii silhouette.
    pillar.rotation.z = sx * 0.017;
  }

  // Lower tie beam.
  box(group, 5.62, 0.22, 0.26, 0, 2.84, z, m.vermilion, { outline: 0.024 });
  box(group, 6.12, 0.16, 0.31, 0, 3.36, z, m.roofDeep, { outline: 0.018 });
  curvedTop(group, 3.62, z, 3.36, m.roofDeep);

  // Central strut and name plaque.
  box(group, 0.28, 0.62, 0.24, 0, 3.07, z, m.vermilionDeep, { outline: 0.018 });
  const plaque = decal(group, 1.28, 0.46, 0, 3.06, z + 0.151, t.toriiPlaque, {
    transparent: true,
    depthWrite: false,
  });
  plaque.renderOrder = 3;

  // A small shimenawa tied beneath the gate.
  tube(
    group,
    [
      new THREE.Vector3(-2.1, 2.68, z + 0.12),
      new THREE.Vector3(-1.1, 2.55, z + 0.16),
      new THREE.Vector3(0, 2.5, z + 0.16),
      new THREE.Vector3(1.1, 2.55, z + 0.16),
      new THREE.Vector3(2.1, 2.68, z + 0.12),
    ],
    0.085,
    8,
    m.rope,
    { segments: 30 },
  );
  for (const x of [-1.3, 0, 1.3]) {
    for (let i = 0; i < 3; i++) {
      const shide = box(group, 0.1, 0.17, 0.02, x, 2.37 - i * 0.13, z + 0.2, m.paper, {
        castShadow: false,
      });
      shide.rotation.z = i % 2 ? 0.2 : -0.2;
    }
  }

  contactShadow(root, 0, 7.35, 4.2, 1.7, 0.28, 0.045);
  return group;
}

/* ------------------------------------------------------------------ *
 * Stone lanterns
 * ------------------------------------------------------------------ */
function buildStoneLantern(root, x, z, scale = 1, lit = true) {
  const m = materials();
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  root.add(group);

  box(group, 0.76, 0.16, 0.76, 0, 0.08, 0, m.stoneDark, { outline: 0.016 });
  box(group, 0.6, 0.13, 0.6, 0, 0.225, 0, m.stoneLight);
  cylinder(group, 0.2, 0.27, 0.8, 8, 0, 0.69, 0, m.stonePlain, { outline: 0.016 });
  box(group, 0.66, 0.13, 0.66, 0, 1.13, 0, m.stoneLight, { outline: 0.014 });

  // Fire chamber.
  const chamber = box(group, 0.49, 0.5, 0.49, 0, 1.44, 0, m.stoneDark, { outline: 0.016 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(group, 0.075, 0.51, 0.075, sx * 0.23, 1.44, sz * 0.23, m.stoneLight);
    }
  }
  const fireMat = toon(0xf6d89d, { emissive: 0xffbc66, emissiveIntensity: 1.4 });
  const fire = box(group, 0.3, 0.31, 0.3, 0, 1.43, 0, fireMat, { castShadow: false });
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeLanternGlow(),
      color: 0xffd28b,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  glow.position.set(0, 1.43, 0.32);
  glow.scale.set(1.7, 1.7, 1);
  group.add(glow);

  // Pyramidal roof.
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.3, 4), m.stoneBlue);
  cap.position.y = 1.82;
  cap.rotation.y = Math.PI / 4;
  cap.castShadow = true;
  group.add(cap);
  addOutline(cap, 0.016);
  cylinder(group, 0.045, 0.08, 0.18, 8, 0, 2.03, 0, m.stoneLight);
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), m.stoneLight);
  jewel.position.y = 2.14;
  jewel.castShadow = true;
  group.add(jewel);

  let light = null;
  if (lit) {
    light = new THREE.PointLight(0xffc978, 0.55, 3.6, 2);
    light.position.set(0, 1.5, 0.2);
    group.add(light);
  }

  contactShadow(root, x, z, 1.2 * scale, 1.2 * scale, 0.26, 0.04);
  return { group, light, glow, chamber, basePhase: x * 0.7 + z * 0.3 };
}

let lanternGlowTexture;
function makeLanternGlow() {
  if (!lanternGlowTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 1, 64, 64, 62);
    g.addColorStop(0, 'rgba(255, 242, 188, 0.9)');
    g.addColorStop(0.3, 'rgba(255, 218, 137, 0.4)');
    g.addColorStop(1, 'rgba(255, 201, 111, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    lanternGlowTexture = new THREE.CanvasTexture(c);
    lanternGlowTexture.colorSpace = THREE.NoColorSpace;
  }
  return lanternGlowTexture;
}

/* ------------------------------------------------------------------ *
 * Purification pavilion (chōzuya)
 * ------------------------------------------------------------------ */
function buildChozya(root) {
  const m = materials();
  const t = textures();
  const group = new THREE.Group();
  group.position.set(-6.55, 0, 4.35);
  group.rotation.y = 0.12;
  root.add(group);

  box(group, 2.65, 0.12, 2.1, 0, 0.06, 0, m.stoneLight, { outline: 0.016 });
  for (let i = 0; i < 3; i++) {
    box(group, 2.3 - i * 0.12, 0.045, 0.32, 0, 0.13, 0.66 - i * 0.57, m.stonePlain, {
      castShadow: false,
      receiveShadow: true,
    });
  }

  // Posts and beams.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(group, 0.14, 2.22, 0.14, sx * 1.03, 1.2, sz * 0.77, m.woodInk, {
        outline: 0.014,
      });
    }
  }
  box(group, 2.3, 0.15, 0.16, 0, 2.28, 0.77, m.woodDark, { outline: 0.014 });
  box(group, 2.3, 0.15, 0.16, 0, 2.28, -0.77, m.woodDark, { outline: 0.014 });
  box(group, 0.16, 0.15, 1.65, -1.03, 2.28, 0, m.woodDark);
  box(group, 0.16, 0.15, 1.65, 1.03, 2.28, 0, m.woodDark);

  // Gabled roof.
  const roofMat = m.roof;
  const roofA = box(group, 2.95, 0.1, 1.48, 0, 2.61, 0.54, roofMat, {
    outline: 0.014,
    rounded: false,
  });
  roofA.rotation.x = 0.45;
  const roofB = box(group, 2.95, 0.1, 1.48, 0, 2.61, -0.54, roofMat, {
    outline: 0.014,
    rounded: false,
  });
  roofB.rotation.x = -0.45;
  box(group, 3.18, 0.13, 0.14, 0, 2.9, 0, m.roofDeep, { outline: 0.012 });
  for (const sx of [-1, 1]) {
    const barge = box(group, 0.12, 0.2, 2.02, sx * 1.49, 2.64, 0, m.roofDeep);
    barge.rotation.x = 0;
  }

  // Stone water basin.
  const basinY = 0.26;
  box(group, 1.23, 0.56, 0.78, 0, basinY, 0.05, m.stoneDark, { outline: 0.016 });
  box(group, 1.05, 0.46, 0.61, 0, basinY + 0.03, 0.05, m.stonePlain);
  // Four low stone lips, leaving the water open in the middle.
  for (const sx of [-1, 1]) {
    box(group, 0.09, 0.08, 0.85, sx * 0.58, basinY + 0.29, 0.05, m.stoneLight, {
      castShadow: false,
      receiveShadow: true,
    });
  }
  for (const sz of [-1, 1]) {
    box(group, 1.25, 0.08, 0.09, 0, basinY + 0.29, 0.05 + sz * 0.39, m.stoneLight, {
      castShadow: false,
      receiveShadow: true,
    });
  }
  const water = plane(
    group,
    1.06,
    0.63,
    0,
    basinY + 0.285,
    0.05,
    m.water,
    [-Math.PI / 2, 0, 0],
  );
  water.renderOrder = 2;
  water.userData.dynamic = true;

  // Bamboo spout.
  cylinder(group, 0.055, 0.06, 1.62, 7, -0.74, 0.98, -0.28, m.mossLight, {
    rotation: [0.16, 0, -0.1],
  });
  cylinder(group, 0.052, 0.055, 0.62, 7, -0.43, 1.53, -0.22, m.mossLight, {
    rotation: [0, 0, Math.PI / 2.7],
  });
  const waterStream = cylinder(group, 0.012, 0.018, 0.85, 5, -0.18, 1.1, -0.17, m.water, {
    castShadow: false,
    openEnded: true,
  });
  waterStream.rotation.z = 0.03;
  // Dipper.
  cylinder(group, 0.035, 0.04, 0.7, 7, 0.41, 0.63, 0.28, m.woodPale, {
    rotation: [0, 0, 1.05],
  });
  cylinder(group, 0.09, 0.08, 0.09, 10, 0.72, 0.32, 0.28, m.woodPale);

  // Small sign.
  box(group, 0.07, 1.35, 0.07, 1.34, 0.68, 0.62, m.woodDark);
  const sign = decal(group, 0.53, 0.24, 1.34, 1.22, 0.66, t.chozyaPlaque, {
    transparent: true,
    depthWrite: false,
  });
  sign.renderOrder = 3;

  // Bamboo fence at the back.
  for (let i = 0; i < 5; i++) {
    cylinder(group, 0.035, 0.04, 1.05, 6, -1.35, 0.55, -1.2 + i * 0.32, m.woodPale);
  }
  box(group, 0.08, 0.08, 1.55, -1.35, 0.8, -0.56, m.woodDark);

  contactShadow(root, -6.55, 4.35, 3.8, 3.0, 0.24, 0.042);
  return { group, water, waterStream };
}

/* ------------------------------------------------------------------ *
 * Ema and omikuji racks
 * ------------------------------------------------------------------ */
function buildEmaRack(root) {
  const m = materials();
  const t = textures();
  const group = new THREE.Group();
  group.position.set(6.35, 0, 5.1);
  group.rotation.y = -0.13;
  root.add(group);

  box(group, 2.5, 0.12, 1.1, 0, 0.06, 0, m.stonePlain, { outline: false });
  for (const sx of [-1, 1]) {
    box(group, 0.12, 2.08, 0.12, sx * 1.1, 1.08, 0, m.woodDark, { outline: 0.014 });
    box(group, 0.42, 0.1, 0.5, sx * 1.1, 0.06, 0.15, m.stoneDark);
  }
  box(group, 2.35, 0.12, 0.13, 0, 2.05, 0, m.wood, { outline: 0.012 });
  box(group, 2.22, 0.09, 0.1, 0, 1.49, 0.02, m.woodLight);
  // A narrow tiled cap, deliberately shallow so the plaques stay readable.
  const cap = box(group, 2.8, 0.09, 0.52, 0, 2.17, 0.02, m.roof, { outline: 0.012 });
  cap.rotation.x = 0.08;
  box(group, 2.88, 0.1, 0.1, 0, 2.24, 0.26, m.roofDeep);
  box(group, 2.88, 0.08, 0.08, 0, 2.15, -0.22, m.roofDeep);

  const emaPlaques = [];
  for (let i = 0; i < 5; i++) {
    const x = -0.84 + i * 0.42;
    const tex = t.ema[i % t.ema.length];
    const plaque = decal(group, 0.37, 0.33, x, 1.62 - (i % 2) * 0.07, 0.12, tex, {
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    plaque.rotation.z = (i % 2 ? -1 : 1) * 0.035;
    const string = cylinder(group, 0.006, 0.006, 0.18, 4, x, 1.84, 0.12, m.woodDark, {
      castShadow: false,
    });
    string.rotation.z = plaque.rotation.z;
    string.userData.dynamic = true;
    emaPlaques.push({ mesh: plaque, string, phase: i * 1.1 });
  }

  const omikuji = new THREE.Group();
  omikuji.position.set(1.72, 0, 0.02);
  group.add(omikuji);
  box(omikuji, 0.72, 0.56, 0.48, 0, 0.31, 0, m.wood, { outline: 0.012 });
  box(omikuji, 0.78, 0.08, 0.54, 0, 0.61, 0, m.woodDark);
  const omikujiSign = decal(
    omikuji,
    0.35,
    0.2,
    0,
    0.4,
    0.251,
    createPlaqueTexture('御神籤', {
      width: 320,
      height: 160,
      font: 'bold 58px "Yu Mincho", serif',
    }),
    { transparent: true, depthWrite: false },
  );
  omikujiSign.renderOrder = 3;
  for (let i = 0; i < 5; i++) {
    const strip = box(omikuji, 0.035, 0.3 + (i % 3) * 0.06, 0.008, -0.23 + i * 0.115, 0.84 + (i % 2) * 0.03, 0.12, m.paper, {
      castShadow: false,
      receiveShadow: false,
    });
    strip.rotation.z = (i % 2 ? -1 : 1) * 0.04;
  }
  tube(
    omikuji,
    [
      new THREE.Vector3(-0.38, 0.88, 0.12),
      new THREE.Vector3(0, 0.84, 0.13),
      new THREE.Vector3(0.38, 0.88, 0.12),
    ],
    0.008,
    4,
    m.woodDark,
    { castShadow: false, segments: 14 },
  );

  contactShadow(root, 6.35, 5.1, 3.5, 2.1, 0.2, 0.044);
  return { group, emaPlaques };
}

/* ------------------------------------------------------------------ *
 * Notice board
 * ------------------------------------------------------------------ */
function buildNoticeBoard(root) {
  const m = materials();
  const t = textures();
  const group = new THREE.Group();
  group.position.set(-4.2, 0, 8.25);
  group.rotation.y = 0.32;
  root.add(group);
  for (const sx of [-1, 1]) {
    box(group, 0.12, 1.85, 0.12, sx * 0.69, 0.93, 0, m.woodInk, { outline: 0.014 });
    box(group, 0.38, 0.1, 0.4, sx * 0.69, 0.05, 0.05, m.stonePlain);
  }
  const board = box(group, 1.55, 1.45, 0.11, 0, 1.15, 0.02, m.woodDark, {
    outline: 0.014,
  });
  const paper = decal(group, 1.27, 1.24, 0, 1.17, 0.082, t.notice, {
    transparent: true,
    depthWrite: false,
  });
  paper.renderOrder = 2;
  const roof = box(group, 1.91, 0.1, 0.58, 0, 1.99, 0.07, m.roof, { outline: 0.01 });
  roof.rotation.x = 0.1;
  box(group, 1.98, 0.12, 0.12, 0, 2.08, 0.31, m.roofDeep);
  contactShadow(root, -4.2, 8.25, 2.2, 1.2, 0.2, 0.04);
  return group;
}

/* ------------------------------------------------------------------ *
 * Shrine office / storage building
 * ------------------------------------------------------------------ */
function buildOffice(root) {
  const m = materials();
  const t = textures();
  const group = new THREE.Group();
  group.position.set(7.42, 0, -4.95);
  group.rotation.y = -0.06;
  root.add(group);

  box(group, 3.65, 0.2, 3.05, 0, 0.1, 0, m.stoneDark, { outline: 0.018 });
  box(group, 3.45, 0.16, 2.85, 0, 0.23, 0, m.stoneLight, { outline: 0.012 });
  box(group, 3.2, 2.35, 2.55, 0, 1.42, 0, m.plaster, { outline: 0.026 });
  // Dark timber frame.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(group, 0.13, 2.4, 0.13, sx * 1.55, 1.42, sz * 1.23, m.woodInk, {
        outline: 0.012,
      });
    }
  }
  box(group, 3.22, 0.15, 0.15, 0, 2.51, 1.25, m.woodInk);
  box(group, 3.22, 0.15, 0.15, 0, 2.51, -1.25, m.woodInk);
  box(group, 3.22, 0.13, 0.13, 0, 1.42, 1.26, m.woodInk);
  box(group, 0.15, 2.4, 0.15, 0, 1.42, 1.26, m.woodInk);
  // Sliding door and window.
  box(group, 1.06, 1.72, 0.08, -0.58, 1.06, 1.285, m.shoji, { outline: 0.012 });
  box(group, 0.9, 1.38, 0.08, 0.93, 1.24, 1.285, m.shoji, { outline: 0.012 });
  box(group, 1.15, 0.1, 0.12, -0.58, 1.94, 1.32, m.woodDark);
  // Small roof.
  const roofA = box(group, 4.1, 0.12, 1.9, 0, 2.89, 0.6, m.roof, {
    outline: 0.016,
    rounded: false,
  });
  roofA.rotation.x = 0.4;
  const roofB = box(group, 4.1, 0.12, 1.9, 0, 2.89, -0.6, m.roof, {
    outline: 0.016,
    rounded: false,
  });
  roofB.rotation.x = -0.4;
  box(group, 4.34, 0.16, 0.16, 0, 3.26, 0, m.roofDeep, { outline: 0.012 });
  for (const sx of [-1, 1]) {
    box(group, 0.12, 0.3, 2.55, sx * 2.04, 2.99, 0, m.roofDeep);
  }
  // Sign above door.
  const officeSign = decal(group, 0.8, 0.34, -0.58, 2.14, 1.34, t.officePlaque, {
    transparent: true,
    depthWrite: false,
  });
  officeSign.renderOrder = 3;

  // A small step and a service lantern.
  box(group, 1.35, 0.1, 0.55, -0.58, 0.16, 1.56, m.stonePlain);
  box(group, 0.3, 0.32, 0.3, 1.35, 0.4, 1.44, m.stoneDark);
  const officeLantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.38, 8),
    toon(0xf0d7a6, { emissive: 0xffc774, emissiveIntensity: 1 }),
  );
  officeLantern.position.set(1.35, 0.72, 1.44);
  group.add(officeLantern);
  const officeLight = new THREE.PointLight(0xffc778, 0.4, 2.4, 2);
  officeLight.position.set(1.35, 0.8, 1.55);
  group.add(officeLight);

  contactShadow(root, 7.42, -4.95, 4.5, 3.7, 0.24, 0.04);
  return { group, officeLight, officeLantern };
}

/* ------------------------------------------------------------------ *
 * Fences, banners, props
 * ------------------------------------------------------------------ */
function fenceSection(root, x, z, width, rotation = 0) {
  const m = materials();
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  root.add(group);
  const count = Math.max(2, Math.round(width / 0.52));
  const spacing = width / count;
  for (let i = 0; i < count; i++) {
    const px = -width / 2 + spacing * (i + 0.5);
    const h = 0.85 + (i % 3 === 0 ? 0.1 : 0);
    box(group, 0.075, h, 0.075, px, 0.12 + h / 2, 0, m.woodLight, { outline: false });
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.13, 4), m.woodLight);
    tip.position.set(px, 0.12 + h + 0.06, 0);
    group.add(tip);
  }
  box(group, width + 0.3, 0.08, 0.09, 0, 0.58, 0, m.woodDark);
  box(group, width + 0.3, 0.08, 0.09, 0, 0.92, 0, m.woodDark);
  for (const sx of [-1, 1]) {
    box(group, 0.16, 1.1, 0.16, sx * (width / 2 + 0.1), 0.65, 0, m.woodDark, {
      outline: 0.012,
    });
  }
}

function buildFences(root) {
  fenceSection(root, -8.88, -4.3, 5.8, Math.PI / 2);
  fenceSection(root, 8.9, -2.1, 4.2, Math.PI / 2);
  fenceSection(root, -1.0, -8.95, 9.2, 0);
  fenceSection(root, 6.45, 8.8, 2.8, 0.08);
  fenceSection(root, -8.55, 5.8, 2.5, Math.PI / 2);
}

function buildBanner(root) {
  const m = materials();
  const group = new THREE.Group();
  group.position.set(8.45, 0, 4.25);
  group.rotation.y = -0.18;
  root.add(group);
  cylinder(group, 0.045, 0.06, 3.35, 7, 0, 1.68, 0, m.woodDark);
  box(group, 0.86, 0.06, 0.06, -0.38, 2.93, 0, m.woodDark);
  const clothTex = createPlaqueTexture('博麗神社', {
    background: '#b34848',
    foreground: '#f0e3c7',
    border: '#e7d3ad',
    vertical: true,
    width: 220,
    height: 700,
    font: 'bold 62px "Yu Mincho", serif',
  });
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 2.1, 5, 8),
    new THREE.MeshToonMaterial({
      map: clothTex,
      color: 0xffffff,
      side: THREE.DoubleSide,
      gradientMap: (m.vermilion.gradientMap ?? null),
      transparent: true,
    }),
  );
  cloth.position.set(-0.38, 1.72, 0.02);
  cloth.castShadow = true;
  cloth.userData.dynamic = true;
  group.add(cloth);
  for (let i = 0; i < 4; i++) {
    box(group, 0.05, 0.05, 0.05, 0.16, 3.2 - i * 0.41, 0, m.gold, {
      castShadow: false,
    });
  }
  contactShadow(root, 8.45, 4.25, 1.2, 0.8, 0.18, 0.035);
  const state = { group, cloth, base: cloth.geometry.attributes.position.array.slice() };
  return state;
}

function buildSaisenbako(root) {
  const m = materials();
  const group = new THREE.Group();
  group.position.set(0, 0, 2.02);
  root.add(group);
  box(group, 2.35, 0.13, 1.02, 0, 0.1, 0, m.stoneDark, { outline: 0.014 });
  box(group, 2.15, 0.64, 0.86, 0, 0.45, 0, m.woodDark, { outline: 0.024 });
  // Horizontal slats.
  for (let i = 0; i < 5; i++) {
    box(group, 2.12, 0.055, 0.05, 0, 0.24 + i * 0.1, 0.445, m.wood, {
      castShadow: false,
    });
  }
  box(group, 2.22, 0.12, 0.94, 0, 0.79, 0, m.wood, { outline: 0.014 });
  // Coin slot.
  box(group, 1.05, 0.045, 0.1, 0, 0.86, 0.03, m.ink, { castShadow: false });
  box(group, 0.18, 0.15, 0.16, -0.74, 0.49, 0.455, m.gold, { outline: 0.01 });
  box(group, 0.1, 0.19, 0.03, -0.74, 0.49, 0.55, m.ink);
  const label = decal(
    group,
    0.82,
    0.22,
    0,
    0.64,
    0.462,
    createPlaqueTexture('奉 納', {
      width: 360,
      height: 120,
      font: 'bold 62px "Yu Mincho", serif',
      background: '#3b2b22',
      foreground: '#d5b575',
    }),
    { transparent: true, depthWrite: false },
  );
  label.renderOrder = 3;
  contactShadow(root, 0, 2.02, 2.9, 1.4, 0.24, 0.04);
  return group;
}

function buildKomainu(root, x, z, mirror = 1) {
  const m = materials();
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = mirror > 0 ? -0.18 : 0.18;
  root.add(group);

  box(group, 0.62, 0.18, 0.54, 0, 0.09, 0, m.stoneDark, { outline: 0.012 });
  box(group, 0.48, 0.3, 0.44, 0, 0.32, 0, m.stoneLight, { outline: 0.012 });
  const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 0), m.stonePlain);
  body.position.set(0, 0.62, 0.02);
  body.scale.set(1, 0.88, 1.2);
  body.castShadow = true;
  body.receiveShadow = true;
  addOutline(body, 0.013);
  group.add(body);

  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), m.stoneLight);
  head.position.set(0, 0.84, 0.2);
  head.scale.set(1, 0.9, 0.92);
  head.castShadow = true;
  addOutline(head, 0.012);
  group.add(head);

  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), m.stonePlain);
    ear.position.set(sx * 0.15, 1.0, 0.16);
    ear.rotation.z = sx * -0.25;
    ear.castShadow = true;
    group.add(ear);
    box(group, 0.075, 0.27, 0.1, sx * 0.16, 0.47, 0.19, m.stonePlain, {
      outline: 0.008,
    });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), m.ink);
    eye.position.set(sx * 0.09, 0.87, 0.38);
    group.add(eye);
  }
  // Curled tail.
  cylinder(group, 0.045, 0.06, 0.3, 6, 0, 0.72, -0.28, m.stonePlain, {
    rotation: [0.4, 0, 0],
    outline: 0.008,
  });
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), m.stoneLight);
  tailTip.position.set(0, 0.92, -0.34);
  tailTip.castShadow = true;
  group.add(tailTip);
  // A tiny carved bib.
  box(group, 0.22, 0.16, 0.06, 0, 0.68, 0.28, m.stoneDark, {
    castShadow: false,
    receiveShadow: false,
  });
  contactShadow(root, x, z, 0.9, 0.8, 0.2, 0.032);
  return group;
}

function buildBench(root) {
  const m = materials();
  const group = new THREE.Group();
  group.position.set(-7.15, 0, 8.05);
  group.rotation.y = 0.22;
  root.add(group);
  box(group, 1.7, 0.11, 0.46, 0, 0.44, 0, m.wood, { outline: 0.012 });
  box(group, 1.45, 0.06, 0.34, 0, 0.52, 0.02, m.vermilionDeep, {
    castShadow: false,
    receiveShadow: true,
  });
  for (const sx of [-1, 1]) {
    box(group, 0.1, 0.42, 0.1, sx * 0.7, 0.22, 0.15, m.woodDark, { outline: 0.008 });
    box(group, 0.1, 0.42, 0.1, sx * 0.7, 0.22, -0.15, m.woodDark, { outline: 0.008 });
    box(group, 0.1, 0.8, 0.1, sx * 0.72, 0.65, -0.23, m.woodDark, { outline: 0.008 });
  }
  box(group, 1.62, 0.11, 0.09, 0, 0.82, -0.23, m.wood, { outline: 0.01 });
  box(group, 1.62, 0.07, 0.07, 0, 1.04, -0.23, m.wood, { outline: 0.008 });
  for (const sx of [-1, 1]) {
    box(group, 0.08, 0.08, 0.42, sx * 0.76, 0.65, -0.03, m.woodDark);
  }
  contactShadow(root, -7.15, 8.05, 2.1, 1.1, 0.18, 0.035);
  return group;
}

function buildProps(root) {
  const m = materials();
  const rnd = mulberry32(0xb7c1);

  // Sake barrels near the shrine side.
  const barrels = new THREE.Group();
  barrels.position.set(5.25, 0, -1.28);
  root.add(barrels);
  for (let i = 0; i < 2; i++) {
    const b = cylinder(barrels, 0.42, 0.46, 0.82, 14, i * 0.92, 0.43, i * 0.18, m.woodPale, {
      outline: 0.018,
    });
    b.rotation.z = i ? 0.03 : -0.02;
    for (const y of [0.24, 0.63]) {
      cylinder(barrels, 0.455, 0.455, 0.07, 14, i * 0.92, y, i * 0.18, m.vermilionDeep);
    }
    const lid = cylinder(barrels, 0.43, 0.43, 0.05, 14, i * 0.92, 0.86, i * 0.18, m.woodDark);
  }

  // Wooden crates.
  for (let i = 0; i < 3; i++) {
    box(
      root,
      0.6 + i * 0.04,
      0.42 + i * 0.05,
      0.55,
      6.8 + i * 0.05,
      0.21 + i * 0.02,
      1.75 - i * 0.05,
      m.wood,
      { outline: 0.013 },
    );
    box(root, 0.62, 0.035, 0.57, 6.8, 0.44, 1.75, m.woodDark, { castShadow: false });
  }

  // A spare broom leaning against the office wall.
  const broom = new THREE.Group();
  broom.position.set(5.86, 0, -3.82);
  broom.rotation.z = 0.22;
  broom.rotation.y = 0.2;
  root.add(broom);
  cylinder(broom, 0.035, 0.04, 1.75, 6, 0, 0.9, 0, m.woodPale, { outline: 0.01 });
  const bristles = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), m.straw ?? m.woodPale);
  bristles.position.y = 0.22;
  broom.add(bristles);
  for (let i = 0; i < 7; i++) {
    cylinder(broom, 0.012, 0.02, 0.45, 4, (rnd() - 0.5) * 0.22, 0.18, (rnd() - 0.5) * 0.08, m.woodDark, {
      castShadow: false,
    });
  }

  // A small stone water basin / offering place beside the path.
  box(root, 0.65, 0.35, 0.5, -2.7, 0.175, 8.05, m.stoneDark, { outline: 0.012 });
  box(root, 0.5, 0.1, 0.35, -2.7, 0.39, 8.05, m.stoneBlue);

  // A few scattered tied paper fortunes near the omikuji rack.
  for (let i = 0; i < 6; i++) {
    const strip = box(
      root,
      0.035,
      0.24,
      0.006,
      7.1 + (rnd() - 0.5) * 1.0,
      0.06,
      3.1 + (rnd() - 0.5) * 1.2,
      m.paper,
      { castShadow: false, receiveShadow: false },
    );
    strip.rotation.y = rnd() * Math.PI;
  }

  // Small stacked stones by the courtyard edge.
  const stack = new THREE.Group();
  stack.position.set(-3.1, 0, 9.0);
  root.add(stack);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.2 - i * 0.045, 0),
      [m.stoneDark, m.stonePlain, m.stoneLight][i],
    );
    s.position.y = 0.12 + i * 0.14;
    s.scale.y = 0.6;
    s.rotation.y = i * 0.6;
    s.castShadow = true;
    stack.add(s);
  }
}

function buildClouds(root) {
  const cloudData = [
    [-13, 7.8, -14, 13, 0.34],
    [9, 8.8, -16, 15, 0.3],
    [-14, 5.8, 3, 9, 0.28],
    [14, 6.9, 8, 9, 0.24],
  ];
  return cloudData.map(([x, y, z, scale, opacity]) => {
    const cloud = makeCloud(root, x, y, z, scale, opacity);
    cloud.userData.baseX = x;
    cloud.userData.baseOpacity = opacity;
    cloud.userData.speed = 0.045 + Math.random() * 0.03;
    cloud.userData.phase = Math.random() * Math.PI * 2;
    return cloud;
  });
}

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */
export function buildWorld(root) {
  const clouds = buildClouds(root);
  buildBase(root);
  const slabs = buildPaving(root);
  buildGroundDetails(root);
  buildTorii(root);
  const lanterns = [
    buildStoneLantern(root, -3.05, 3.45, 1.0, true),
    buildStoneLantern(root, 3.05, 3.45, 1.0, true),
  ];
  const chozya = buildChozya(root);
  const emaRack = buildEmaRack(root);
  buildNoticeBoard(root);
  const office = buildOffice(root);
  buildFences(root);
  const banner = buildBanner(root);
  buildSaisenbako(root);
  buildKomainu(root, -2.65, 1.62, 1);
  buildKomainu(root, 2.65, 1.62, -1);
  buildBench(root);
  buildProps(root);

  function groundHeightAt(x, z) {
    let height = 0.02;
    for (const s of slabs) {
      if (
        Math.abs(x - s.x) <= s.w / 2 + 0.05 &&
        Math.abs(z - s.z) <= s.d / 2 + 0.05
      ) {
        height = Math.max(height, s.top);
      }
    }
    return height;
  }

  function update(t, dt) {
    // Lantern glow breathes, never enough to look like a campfire.
    for (const lantern of lanterns) {
      if (lantern.light) {
        const p = lantern.basePhase;
        lantern.light.intensity = 0.46 + Math.sin(t * 2.1 + p) * 0.08 + Math.sin(t * 5.3 + p * 2.4) * 0.025;
      }
      if (lantern.glow) {
        lantern.glow.material.opacity = 0.32 + Math.sin(t * 1.8 + lantern.basePhase) * 0.06;
        lantern.glow.scale.setScalar(1.65 + Math.sin(t * 1.7 + lantern.basePhase) * 0.08);
      }
    }
    office.officeLight.intensity = 0.36 + Math.sin(t * 2.4 + 0.7) * 0.04;
    // Ema plaques and strings answer the breeze.
    for (const e of emaRack.emaPlaques) {
      const sway = Math.sin(t * 1.25 + e.phase) * 0.04 + Math.sin(t * 0.52 + e.phase) * 0.02;
      e.mesh.rotation.z = (e.phase > 2 ? -1 : 1) * 0.03 + sway;
      e.string.rotation.z = e.mesh.rotation.z;
    }
    // Water surface drifts a little.
    if (chozya.water?.material?.map) {
      chozya.water.material.map.offset.x = t * 0.012;
      chozya.water.material.map.offset.y = Math.sin(t * 0.3) * 0.01;
    }
    // The banner wakes up in the wind.
    banner.cloth.rotation.z = Math.sin(t * 1.1) * 0.025;
    banner.cloth.rotation.x = Math.sin(t * 0.8 + 0.3) * 0.012;
    // Distant clouds truly take their time.
    for (const cloud of clouds) {
      cloud.position.x = cloud.userData.baseX + Math.sin(t * cloud.userData.speed + cloud.userData.phase) * 2.2 + Math.sin(t * 0.025 + 0.8) * 1.4;
      cloud.material.opacity = cloud.userData.baseOpacity * (0.9 + Math.sin(t * 0.12 + cloud.userData.phase) * 0.1);
    }
  }

  return { groundHeightAt, update, slabs, lanterns };
}
