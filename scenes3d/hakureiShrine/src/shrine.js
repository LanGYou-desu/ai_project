import * as THREE from 'three';
import {
  PAL,
  toon,
  box,
  cylinder,
  decal,
  tube,
  addOutline,
  contactShadow,
  createPlaqueTexture,
  createShojiTexture,
  createLanternTexture,
  createRoofTexture,
  createWoodTexture,
  createRopeTexture,
  mulberry32,
} from './helpers.js';

const CACHE = {};

function textures() {
  if (!CACHE.ready) {
    CACHE.shoji = createShojiTexture(4, 7, false);
    CACHE.shojiWarm = createShojiTexture(3, 6, true);
    CACHE.roof = createRoofTexture();
    CACHE.wood = createWoodTexture();
    CACHE.rope = createRopeTexture();
    CACHE.lantern = createLanternTexture('奉納');
    CACHE.plaque = createPlaqueTexture('博麗神社', {
      width: 512,
      height: 160,
      font: 'bold 78px "Yu Mincho", "MS Mincho", serif',
    });
    CACHE.ready = true;
  }
  return CACHE;
}

const MATERIALS = {};

function materials() {
  if (MATERIALS.ready) return MATERIALS;
  const t = textures();
  MATERIALS.shoji = toon(0xffffff, { map: t.shoji });
  MATERIALS.shojiWarm = toon(0xffffff, {
    map: t.shojiWarm,
    emissive: 0xf0bd6f,
    emissiveIntensity: 0.14,
  });
  MATERIALS.roof = toon(0xffffff, {
    map: t.roof,
    side: THREE.DoubleSide,
  });
  MATERIALS.wood = toon(0xffffff, { map: t.wood });
  MATERIALS.rope = toon(0xffffff, { map: t.rope });
  MATERIALS.vermilion = toon(PAL.vermilion);
  MATERIALS.vermilionLight = toon(PAL.vermilionLight);
  MATERIALS.vermilionDeep = toon(PAL.vermilionDeep);
  MATERIALS.plaster = toon(PAL.plaster);
  MATERIALS.plasterShade = toon(PAL.plasterShade);
  MATERIALS.cream = toon(PAL.cream);
  MATERIALS.woodPlain = toon(PAL.wood);
  MATERIALS.woodLight = toon(PAL.woodLight);
  MATERIALS.woodPale = toon(PAL.woodPale);
  MATERIALS.woodDark = toon(PAL.woodDark);
  MATERIALS.woodInk = toon(PAL.woodInk);
  MATERIALS.ink = toon(PAL.ink);
  MATERIALS.gold = toon(PAL.gold);
  MATERIALS.goldLight = toon(PAL.goldLight);
  MATERIALS.stone = toon(PAL.stone);
  MATERIALS.stoneLight = toon(PAL.stoneLight);
  MATERIALS.stoneDark = toon(PAL.stoneDark);
  MATERIALS.roofDeep = toon(PAL.roofDeep);
  MATERIALS.roofEdge = toon(PAL.roofEdge);
  MATERIALS.paper = toon(PAL.paper);
  MATERIALS.interior = toon(0x3b2d28);
  MATERIALS.interiorWarm = toon(0x75553a, {
    emissive: 0xb97136,
    emissiveIntensity: 0.26,
  });
  MATERIALS.ready = true;
  return MATERIALS;
}

/* ------------------------------------------------------------------ *
 * A swept, gently upturned gable roof surface.
 * ------------------------------------------------------------------ */
function roofSurface(halfWidth, eaveZ, eaveY, ridgeY, front) {
  const segX = 34;
  const segZ = 14;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let iz = 0; iz <= segZ; iz++) {
    const t = iz / segZ;
    const z = (front ? 1 : -1) * t * eaveZ;
    for (let ix = 0; ix <= segX; ix++) {
      const u = ix / segX;
      const x = -halfWidth + u * halfWidth * 2;
      const cornerLift = Math.pow(Math.abs(x) / halfWidth, 6) * Math.pow(t, 1.45) * 0.42;
      const y = eaveY + (ridgeY - eaveY) * Math.pow(1 - t, 1.13) + cornerLift;
      positions.push(x, y, z);
      uvs.push(u, t);
    }
  }
  for (let iz = 0; iz < segZ; iz++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iz * (segX + 1) + ix;
      const b = a + 1;
      const c = a + segX + 1;
      const d = c + 1;
      if (front) {
        indices.push(a, c, b, b, c, d);
      } else {
        indices.push(a, b, c, b, d, c);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function roofFascia(parent, halfWidth, eaveZ, eaveY, front, material) {
  const segments = 12;
  const width = (halfWidth * 2) / segments;
  for (let i = 0; i < segments; i++) {
    const u = (i + 0.5) / segments;
    const x = -halfWidth + (i + 0.5) * width;
    const t = Math.abs(x) / halfWidth;
    const lift = Math.pow(t, 6) * 0.42;
    const bar = box(parent, width * 1.03, 0.15, 0.2, x, eaveY - 0.01 + lift, front * (eaveZ + 0.02), material, {
      castShadow: true,
      receiveShadow: true,
    });
    bar.rotation.z = -Math.sign(x) * Math.pow(t, 5) * 0.12;
  }
}

function eaveRafters(parent, halfWidth, eaveZ, eaveY, front, material) {
  const count = 19;
  for (let i = 0; i < count; i++) {
    const x = -halfWidth + 0.4 + (i / (count - 1)) * (halfWidth * 2 - 0.8);
    const rafter = box(parent, 0.065, 0.07, 1.12, x, eaveY - 0.18, front * (eaveZ - 0.45), material, {
      castShadow: false,
      receiveShadow: true,
    });
    rafter.rotation.x = front * 0.15;
  }
}

function addRidgeChigi(parent, materials, halfWidth, ridgeY) {
  const m = materials;
  // Ridge cap.
  const ridge = cylinder(parent, 0.14, 0.14, halfWidth * 2 + 0.32, 10, 0, ridgeY + 0.02, 0, m.roofDeep, {
    rotation: [0, 0, Math.PI / 2],
    outline: 0.016,
  });
  for (const x of [-3.25, -1.05, 1.05, 3.25]) {
    const log = cylinder(parent, 0.1, 0.1, 0.62, 8, x, ridgeY + 0.16, 0, m.roofEdge, {
      rotation: [Math.PI / 2, 0, 0],
      outline: 0.012,
    });
    for (const sz of [-1, 1]) {
      cylinder(parent, 0.11, 0.11, 0.07, 8, x, ridgeY + 0.16, sz * 0.31, m.gold);
    }
  }
  // Crossed finials at both gable ends.
  for (const sx of [-1, 1]) {
    const group = new THREE.Group();
    group.position.set(sx * (halfWidth + 0.08), ridgeY + 0.36, 0);
    parent.add(group);
    for (const dir of [-1, 1]) {
      const fin = box(group, 0.11, 1.45, 0.23, 0, 0, 0, m.roofDeep, {
        outline: 0.012,
      });
      fin.rotation.x = dir * 0.56;
    }
    const cap = box(group, 0.15, 0.16, 0.5, 0, -0.12, 0, m.roofEdge, { outline: 0.01 });
    cap.rotation.x = 0;
  }
}

/* ------------------------------------------------------------------ *
 * Door, shoji, lattice details
 * ------------------------------------------------------------------ */
function addShojiPanel(parent, x, y, z, width, height, material, group = null) {
  const frame = group ?? parent;
  box(frame, width, height, 0.06, x, y, z, material, {
    castShadow: false,
    receiveShadow: true,
  });
  // A quiet border of dark timber.
  box(frame, 0.045, height + 0.08, 0.08, x - width / 2, y, z + 0.015, MATERIALS.woodInk, {
    castShadow: false,
  });
  box(frame, 0.045, height + 0.08, 0.08, x + width / 2, y, z + 0.015, MATERIALS.woodInk, {
    castShadow: false,
  });
  box(frame, width + 0.09, 0.05, 0.08, x, y + height / 2, z + 0.015, MATERIALS.woodInk, {
    castShadow: false,
  });
  box(frame, width + 0.09, 0.05, 0.08, x, y - height / 2, z + 0.015, MATERIALS.woodInk, {
    castShadow: false,
  });
}

function addRoundWindow(parent, x, y, z, side, materials, shojiTexture) {
  const rotY = side > 0 ? Math.PI / 2 : -Math.PI / 2;
  const disk = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 24),
    toon(0xffffff, {
      map: shojiTexture,
      side: THREE.DoubleSide,
      emissive: 0xd7ab70,
      emissiveIntensity: 0.08,
    }),
  );
  disk.position.set(x, y, z);
  disk.rotation.y = rotY;
  disk.castShadow = false;
  parent.add(disk);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.065, 6, 26), materials.woodInk);
  ring.position.set(x, y, z);
  ring.rotation.y = rotY;
  parent.add(ring);
  for (let i = -1; i <= 1; i++) {
    const bar = box(parent, 0.04, 0.04, 1.02, x + side * 0.028, y, z + i * 0.27, materials.woodInk, {
      castShadow: false,
      receiveShadow: false,
    });
    bar.rotation.y = rotY;
  }
  const barV = box(parent, 0.04, 1.02, 0.04, x + side * 0.028, y, z, materials.woodInk, {
    castShadow: false,
    receiveShadow: false,
  });
  barV.rotation.y = rotY;
}

/* ------------------------------------------------------------------ *
 * Hanging lanterns & shide
 * ------------------------------------------------------------------ */
function hangingLantern(parent, x, y, z, materials, t) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);
  cylinder(pivot, 0.012, 0.012, 0.34, 4, 0, -0.17, 0, materials.ink, {
    castShadow: false,
  });
  cylinder(pivot, 0.22, 0.22, 0.5, 12, 0, -0.56, 0, materials.roofDeep, {
    castShadow: true,
  });
  const paperMat = toon(0xffffff, {
    map: t.lantern,
    emissive: 0xffbb62,
    emissiveIntensity: 0.5,
  });
  const paper = cylinder(pivot, 0.18, 0.2, 0.64, 12, 0, -0.68, 0, paperMat, {
    castShadow: true,
  });
  cylinder(pivot, 0.16, 0.16, 0.045, 12, 0, -1.01, 0, materials.roofDeep, {
    castShadow: false,
  });
  cylinder(pivot, 0.03, 0.03, 0.12, 5, 0, -1.09, 0, materials.gold, {
    castShadow: false,
  });
  const glowTex = makeGlowTexture();
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffcf86,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  glow.position.set(0, -0.67, 0.01);
  glow.scale.set(1.45, 1.45, 1);
  pivot.add(glow);
  const light = new THREE.PointLight(0xffc77d, 0.6, 3.2, 2);
  light.position.set(0, -0.7, 0.24);
  pivot.add(light);
  return {
    pivot,
    light,
    glow,
    paper,
    phase: Math.random() * Math.PI * 2,
    baseY: y,
  };
}

function shide(parent, x, y, z, materials) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);
  for (let i = 0; i < 3; i++) {
    const strip = box(
      pivot,
      0.15,
      0.19,
      0.018,
      i % 2 ? 0.06 : -0.045,
      -0.11 - i * 0.15,
      0.002,
      materials.paper,
      { castShadow: false, receiveShadow: false },
    );
    strip.rotation.z = i % 2 ? 0.16 : -0.12;
  }
  return pivot;
}

function makeGlowTexture() {
  if (CACHE.glow) return CACHE.glow;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 1, 64, 64, 62);
  g.addColorStop(0, 'rgba(255, 246, 197, 0.85)');
  g.addColorStop(0.25, 'rgba(255, 218, 137, 0.34)');
  g.addColorStop(0.62, 'rgba(255, 197, 108, 0.09)');
  g.addColorStop(1, 'rgba(255, 197, 108, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  CACHE.glow = new THREE.CanvasTexture(c);
  CACHE.glow.colorSpace = THREE.NoColorSpace;
  return CACHE.glow;
}

/* ------------------------------------------------------------------ *
 * The honden
 * ------------------------------------------------------------------ */
export function buildShrine(root) {
  const m = materials();
  const t = textures();
  const group = new THREE.Group();
  group.position.set(0, 0, -3.25);
  root.add(group);

  const terraceW = 10.95;
  const terraceD = 6.9;
  const terraceH = 0.72;

  // --- Stone terrace -------------------------------------------------
  box(group, terraceW, terraceH, terraceD, 0, terraceH / 2, 0, m.stone, {
    receiveShadow: true,
    castShadow: true,
    outline: 0.028,
  });
  // Top slab and a dark shadow reveal.
  box(group, terraceW + 0.18, 0.12, terraceD + 0.18, 0, terraceH - 0.06, 0, m.stoneLight, {
    receiveShadow: true,
    castShadow: true,
    outline: 0.018,
  });
  box(group, terraceW - 0.32, 0.055, terraceD - 0.32, 0, terraceH + 0.015, 0, m.stoneDark, {
    receiveShadow: true,
    castShadow: false,
  });
  // Broad steps down to the courtyard.
  const stepCount = 5;
  for (let i = 0; i < stepCount; i++) {
    const top = 0.14 + i * 0.118;
    const z = 4.66 - i * 0.29;
    const width = 3.85 - i * 0.09;
    box(group, width, top, 0.34, 0, top / 2, z, i % 2 ? m.stonePlain : m.stoneLight, {
      outline: 0.01,
    });
    box(group, width + 0.08, 0.03, 0.37, 0, top - 0.02, z, m.stoneDark, {
      castShadow: false,
      receiveShadow: true,
    });
  }
  // Stone cheeks to either side of the steps.
  for (const sx of [-1, 1]) {
    box(group, 0.26, 0.48, 1.55, sx * 1.99, 0.32, 4.11, m.stoneDark, {
      outline: 0.012,
    });
    box(group, 0.32, 0.16, 1.7, sx * 1.99, 0.54, 4.11, m.stoneLight, {
      outline: 0.01,
    });
  }
  // A small mossy patch on a terrace corner.
  const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 0), m.moss);
  moss.position.set(-4.72, 0.75, 2.65);
  moss.scale.set(1.4, 0.2, 0.7);
  group.add(moss);

  // --- Veranda and floor --------------------------------------------
  box(group, 9.42, 0.18, 5.82, 0, 0.82, 0.1, m.woodDark, {
    receiveShadow: true,
    castShadow: true,
    outline: 0.018,
  });
  box(group, 9.24, 0.13, 5.65, 0, 0.945, 0.1, m.wood, {
    receiveShadow: true,
    castShadow: true,
    outline: 0.014,
  });
  // Plank lines.
  for (let i = -4; i <= 4; i++) {
    box(group, 0.032, 0.018, 5.55, i * 1.02, 1.018, 0.1, m.woodDark, {
      castShadow: false,
      receiveShadow: false,
    });
  }
  // Two warm wooden steps up to the veranda.
  box(group, 3.1, 0.09, 0.38, 0, 0.79, 3.23, m.woodDark, { outline: 0.01 });
  box(group, 3.1, 0.09, 0.38, 0, 0.87, 3.52, m.woodLight, { outline: 0.01 });
  // Veranda fascia.
  box(group, 9.5, 0.2, 0.18, 0, 0.74, 3.02, m.woodInk, {
    castShadow: true,
  });

  // --- Main hall walls ----------------------------------------------
  // Building footprint is x ±4.03, z -2.55 .. 2.1.
  const wallBottom = 1.01;
  const wallTop = 4.22;
  const wallH = wallTop - wallBottom;
  // Back wall.
  box(group, 8.12, wallH, 0.18, 0, wallBottom + wallH / 2, -2.5, m.plasterShade, {
    receiveShadow: true,
    castShadow: true,
    outline: 0.016,
  });
  // Side walls.
  for (const sx of [-1, 1]) {
    box(group, 0.18, wallH, 4.42, sx * 4.03, wallBottom + wallH / 2, -0.2, m.plaster, {
      receiveShadow: true,
      castShadow: true,
      outline: 0.016,
    });
    // Timber posts along the side.
    for (const z of [-2.35, -1.15, 0.05, 1.25, 1.95]) {
      box(group, 0.145, wallH + 0.1, 0.16, sx * 4.09, wallBottom + wallH / 2, z, m.vermilionDeep, {
        outline: 0.01,
      });
    }
    box(group, 0.16, 0.14, 4.42, sx * 4.09, 1.28, -0.2, m.woodInk);
    box(group, 0.16, 0.14, 4.42, sx * 4.09, 3.35, -0.2, m.woodInk);
    addRoundWindow(group, sx * 4.14, 2.6, -0.15, sx, m, t.shoji);
    // A modest side service shutter.
    box(group, 0.05, 1.45, 1.15, sx * 4.135, 1.88, 1.1, m.woodPlain, {
      outline: 0.008,
      castShadow: false,
    });
    for (let i = 0; i < 4; i++) {
      box(group, 0.03, 1.3, 0.04, sx * 4.165, 1.9, 0.75 + i * 0.28, m.woodDark);
    }
  }
  // Front wall backing.
  box(group, 8.1, wallH, 0.16, 0, wallBottom + wallH / 2, 1.92, m.plaster, {
    receiveShadow: true,
    castShadow: true,
    outline: 0.016,
  });

  // Front facade: four bays, dark timber and cream shoji.
  const bayXs = [-3.02, -1.08, 1.08, 3.02];
  for (const x of bayXs) {
    addShojiPanel(group, x, 2.16, 2.025, 1.77, 2.18, m.shoji);
  }
  // Dark structural grid in front of the paper panels.
  for (const x of [-4.04, -2.05, 0, 2.05, 4.04]) {
    box(group, 0.18, 3.45, 0.2, x, 2.67, 2.08, m.vermilionDeep, {
      outline: 0.014,
    });
    box(group, 0.23, 0.18, 0.24, x, 1.24, 2.1, m.ink, { outline: 0.008 });
    box(group, 0.24, 0.15, 0.26, x, 4.12, 2.1, m.woodInk, { outline: 0.008 });
  }
  box(group, 8.28, 0.2, 0.24, 0, 3.42, 2.085, m.vermilion, { outline: 0.014 });
  box(group, 8.34, 0.18, 0.25, 0, 1.2, 2.085, m.woodInk, { outline: 0.012 });
  // Transom vents.
  for (let i = -6; i <= 6; i++) {
    box(group, 0.045, 0.42, 0.05, i * 0.56, 3.78, 2.11, m.woodInk, {
      castShadow: false,
      receiveShadow: false,
    });
  }
  box(group, 8.1, 0.12, 0.12, 0, 3.53, 2.11, m.woodInk, { castShadow: false });
  box(group, 8.1, 0.12, 0.12, 0, 4.04, 2.11, m.woodInk, { castShadow: false });

  // Central doors.
  box(group, 2.15, 2.55, 0.12, 0, 2.18, 2.11, m.interior, {
    receiveShadow: false,
    castShadow: false,
  });
  for (const sx of [-1, 1]) {
    const door = box(group, 1.02, 2.45, 0.09, sx * 0.53, 2.13, 2.18, m.shojiWarm, {
      outline: 0.012,
    });
    door.rotation.y = sx * -0.06;
    // Door framing.
    box(group, 0.07, 2.5, 0.11, sx * 0.03, 2.13, 2.21, m.vermilionDeep);
    box(group, 0.07, 2.5, 0.11, sx * 1.02, 2.13, 2.21, m.vermilionDeep);
    const crest = new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), m.gold);
    crest.position.set(sx * 0.65, 2.63, 2.24);
    group.add(crest);
    const crestInner = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), m.vermilionDeep);
    crestInner.position.set(sx * 0.65, 2.63, 2.245);
    group.add(crestInner);
  }
  box(group, 2.34, 0.14, 0.15, 0, 3.32, 2.24, m.vermilion, { outline: 0.012 });
  // Name plaque above the doors.
  const plaque = decal(group, 1.72, 0.48, 0, 3.79, 2.12, t.plaque, {
    transparent: true,
    depthWrite: false,
  });
  plaque.renderOrder = 3;

  // --- Veranda columns and railings ---------------------------------
  const columnXs = [-4.53, -2.35, 2.35, 4.53];
  for (const x of columnXs) {
    const col = cylinder(group, 0.165, 0.19, 3.65, 10, x, 2.83, 2.91, m.vermilion, {
      outline: 0.018,
    });
    cylinder(group, 0.23, 0.23, 0.12, 10, x, 1.08, 2.91, m.ink);
    cylinder(group, 0.205, 0.205, 0.1, 10, x, 2.49, 2.91, m.gold);
    // Bracket stack under the eave.
    box(group, 0.55, 0.16, 0.46, x, 4.52, 2.91, m.vermilionDeep, { outline: 0.011 });
    box(group, 0.83, 0.14, 0.53, x, 4.66, 2.91, m.vermilion, { outline: 0.01 });
    box(group, 0.62, 0.07, 0.6, x, 4.77, 2.91, m.gold, { castShadow: false });
    // Gold collar at top.
    cylinder(group, 0.2, 0.2, 0.06, 10, x, 4.38, 2.91, m.gold);
  }
  box(group, 9.32, 0.22, 0.23, 0, 4.25, 2.92, m.vermilionDeep, { outline: 0.014 });
  box(group, 9.5, 0.16, 0.18, 0, 4.46, 2.92, m.woodInk, { outline: 0.01 });

  // Front railings to either side of the steps.
  for (const dir of [-1, 1]) {
    for (const x of [1.94, 3.24, 4.51]) {
      const post = box(group, 0.12, 0.65, 0.12, dir * x, 1.33, 3.0, m.vermilion, {
        outline: 0.008,
      });
      cylinder(group, 0.09, 0.09, 0.08, 8, dir * x, 1.67, 3.0, m.gold, {
        castShadow: false,
      });
    }
    box(group, 2.72, 0.1, 0.12, dir * 3.23, 1.58, 3.0, m.vermilion, { outline: 0.009 });
    box(group, 2.72, 0.07, 0.09, dir * 3.23, 1.22, 3.0, m.woodDark);
  }
  // Side railings.
  for (const sx of [-1, 1]) {
    for (const z of [0.0, 1.15, 2.25, 3.0]) {
      box(group, 0.12, 0.63, 0.12, sx * 4.58, 1.34, z, m.vermilion, {
        outline: 0.008,
      });
    }
    box(group, 0.1, 0.1, 3.08, sx * 4.58, 1.6, 1.5, m.vermilion, { outline: 0.008 });
    box(group, 0.08, 0.07, 3.08, sx * 4.58, 1.22, 1.5, m.woodDark);
  }

  // --- Swept gable roof ---------------------------------------------
  const roofHalfWidth = 5.55;
  const eaveZ = 3.75;
  const eaveY = 4.8;
  const ridgeY = 7.05;
  const frontRoof = new THREE.Mesh(
    roofSurface(roofHalfWidth, eaveZ, eaveY, ridgeY, true),
    m.roof,
  );
  frontRoof.castShadow = true;
  frontRoof.receiveShadow = true;
  group.add(frontRoof);
  const backRoof = new THREE.Mesh(
    roofSurface(roofHalfWidth, eaveZ, eaveY, ridgeY, false),
    m.roof,
  );
  backRoof.castShadow = true;
  backRoof.receiveShadow = true;
  group.add(backRoof);
  addOutline(frontRoof, 0.038);
  addOutline(backRoof, 0.038);

  // Dark underside so the wide eave feels solid from below.
  const underA = box(group, 10.8, 0.08, 1.85, 0, 4.63, 2.65, m.roofDeep, {
    castShadow: false,
    receiveShadow: true,
  });
  const underB = box(group, 10.8, 0.08, 1.85, 0, 4.63, -2.65, m.roofDeep, {
    castShadow: false,
    receiveShadow: true,
  });
  underA.rotation.x = 0.11;
  underB.rotation.x = -0.11;
  roofFascia(group, roofHalfWidth, eaveZ, eaveY, 1, m.roofDeep);
  roofFascia(group, roofHalfWidth, eaveZ, eaveY, -1, m.roofDeep);
  eaveRafters(group, roofHalfWidth, eaveZ, eaveY, 1, m.woodInk);
  eaveRafters(group, roofHalfWidth, eaveZ, eaveY, -1, m.woodInk);
  addRidgeChigi(group, m, roofHalfWidth, ridgeY);

  // Gable-end panels and bargeboards.
  for (const sx of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-2.36, 0);
    shape.lineTo(2.36, 0);
    shape.lineTo(0, 2.78);
    shape.closePath();
    const gable = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      toon(0xffffff, { map: t.shoji, side: THREE.DoubleSide }),
    );
    gable.rotation.y = Math.PI / 2;
    gable.position.set(sx * 4.035, 4.22, -0.2);
    gable.castShadow = true;
    gable.receiveShadow = true;
    group.add(gable);
    // Decorative timber on the gable.
    box(group, 0.08, 0.13, 2.9, sx * 4.08, 4.56, -0.2, m.woodInk);
    box(group, 0.1, 2.2, 0.12, sx * 4.08, 5.3, -0.2, m.woodInk);
    box(group, 0.08, 0.08, 1.55, sx * 4.08, 5.7, -0.2, m.woodInk);
    const crest = new THREE.Mesh(new THREE.CircleGeometry(0.21, 20), m.gold);
    crest.position.set(sx * 4.095, 5.45, -0.2);
    crest.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(crest);

    // Bargeboards along both roof edges.
    for (const sz of [-1, 1]) {
      const length = Math.hypot(eaveZ, ridgeY - eaveY) + 0.35;
      const board = box(group, 0.17, 0.22, length, sx * (roofHalfWidth + 0.04), (eaveY + ridgeY) / 2, sz * eaveZ / 2, m.roofDeep, {
        outline: 0.01,
      });
      board.rotation.x = sz * Math.atan((ridgeY - eaveY) / eaveZ);
      const tip = box(group, 0.2, 0.18, 0.6, sx * (roofHalfWidth + 0.04), eaveY + 0.38, sz * (eaveZ + 0.15), m.roofEdge);
      tip.rotation.z = sx * 0.08;
    }
  }

  // Under-eave beams and tiny gold flecks.
  box(group, 10.15, 0.16, 0.17, 0, 4.6, 3.67, m.roofDeep);
  box(group, 10.15, 0.16, 0.17, 0, 4.6, -3.67, m.roofDeep);
  for (const x of [-4.8, -3.2, -1.6, 0, 1.6, 3.2, 4.8]) {
    const pendant = box(group, 0.1, 0.2, 0.1, x, 4.46, 3.72, m.gold, {
      castShadow: false,
    });
    pendant.rotation.z = Math.PI / 4;
  }

  // --- Shimenawa, shide, bell, lanterns -----------------------------
  const ropeSag = [
    new THREE.Vector3(-3.92, 3.55, 3.02),
    new THREE.Vector3(-2.6, 3.4, 3.11),
    new THREE.Vector3(0, 3.31, 3.15),
    new THREE.Vector3(2.6, 3.4, 3.11),
    new THREE.Vector3(3.92, 3.55, 3.02),
  ];
  const rope = tube(group, ropeSag, 0.115, 9, m.rope, { segments: 46 });
  // Braid ridges.
  for (let i = 0; i < 26; i++) {
    const tt = i / 25;
    const point = catmull(ropeSag, tt);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 4, 8), m.rope);
    ring.position.copy(point);
    ring.rotation.y = Math.PI / 2;
    ring.rotation.z = 0.3;
    ring.castShadow = false;
    group.add(ring);
  }
  const shidePivots = [];
  for (const x of [-2.9, -1.0, 1.0, 2.9]) {
    const y = 3.35 - Math.pow(Math.abs(x) / 3.92, 1.5) * 0.12;
    const pivot = shide(group, x, y, 3.12, m);
    pivot.userData.dynamic = true;
    shidePivots.push(pivot);
  }

  // Bell and pull rope.
  const bellPivot = new THREE.Group();
  bellPivot.position.set(0, 3.26, 3.2);
  group.add(bellPivot);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), m.goldLight);
  bell.scale.y = 0.92;
  bell.position.y = -0.02;
  bell.castShadow = true;
  bellPivot.add(bell);
  cylinder(bellPivot, 0.3, 0.3, 0.045, 18, 0, 0.08, 0, m.gold);
  const slit = box(bellPivot, 0.36, 0.025, 0.02, 0, -0.04, 0.27, m.ink, {
    castShadow: false,
  });
  const bellRope = new THREE.Group();
  bellRope.position.set(0, 3.15, 3.25);
  bellRope.userData.dynamic = true;
  group.add(bellRope);
  const ropeSegments = 12;
  for (let i = 0; i < ropeSegments; i++) {
    const seg = cylinder(
      bellRope,
      0.045,
      0.05,
      0.15,
      7,
      0,
      -0.08 - i * 0.145,
      0,
      i % 2 ? m.paper : m.vermilion,
      { castShadow: false },
    );
  }
  for (let i = 0; i < 5; i++) {
    const tassel = box(bellRope, 0.028, 0.42, 0.028, (i - 2) * 0.035, -1.92, 0, m.vermilion, {
      castShadow: false,
    });
    tassel.rotation.z = (i - 2) * 0.06;
  }
  box(bellRope, 0.16, 0.12, 0.15, 0, -1.78, 0, m.gold, { castShadow: false });

  const lanterns = [
    hangingLantern(group, -3.5, 4.5, 3.23, m, t),
    hangingLantern(group, 3.5, 4.5, 3.23, m, t),
  ];
  for (const lantern of lanterns) lantern.pivot.userData.dynamic = true;

  // Interior glow, just barely visible through the warm paper doors.
  const interiorGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      color: 0xf3bd6c,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  interiorGlow.position.set(0, 2.2, 2.28);
  interiorGlow.scale.set(5.5, 3.2, 1);
  group.add(interiorGlow);

  // Potted evergreens at either end of the veranda.
  for (const sx of [-1, 1]) {
    const pot = cylinder(group, 0.16, 0.2, 0.3, 9, sx * 4.24, 1.12, 2.45, m.woodPlain, {
      outline: 0.01,
    });
    cylinder(group, 0.17, 0.17, 0.04, 9, sx * 4.24, 1.28, 2.45, m.woodDark);
    const shrub = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.25, 0),
      toon(sx > 0 ? PAL.leafLight : PAL.leaf),
    );
    shrub.position.set(sx * 4.24, 1.48, 2.45);
    shrub.scale.set(1, 0.8, 1);
    shrub.castShadow = true;
    group.add(shrub);
  }

  // Side storage details: boxes, a bucket, a lantern stand.
  const boxGroup = new THREE.Group();
  boxGroup.position.set(5.0, 0, 0.45);
  group.add(boxGroup);
  box(boxGroup, 0.7, 0.48, 0.55, 0, 0.24, 0, m.woodPlain, { outline: 0.012 });
  box(boxGroup, 0.62, 0.38, 0.5, 0.1, 0.66, -0.05, m.woodDark, { outline: 0.012 });
  cylinder(boxGroup, 0.19, 0.17, 0.36, 10, 0.74, 0.18, 0.2, m.woodPale, {
    outline: 0.01,
  });
  cylinder(boxGroup, 0.23, 0.23, 0.05, 10, 0.74, 0.38, 0.2, m.woodDark);
  // A little wooden sign standing near the side steps.
  box(group, 0.07, 0.9, 0.07, 4.95, 0.45, 1.2, m.woodDark);
  const sideSign = decal(
    group,
    0.48,
    0.9,
    4.95,
    0.87,
    1.18,
    createPlaqueTexture('御朱印', {
      width: 240,
      height: 540,
      vertical: true,
      background: '#3c2d24',
      foreground: '#dec797',
      border: '#ad915d',
      font: 'bold 58px "Yu Mincho", serif',
    }),
    { transparent: true, depthWrite: false },
  );
  sideSign.rotation.y = -0.2;
  sideSign.renderOrder = 3;

  contactShadow(root, 0, -3.25, 13.4, 9.2, 0.31, 0.045);

  // A random seed for subtle secondary motion.
  const rand = mulberry32(0x7711);

  function update(t) {
    // Lanterns swing only a hair, and their flames breathe.
    for (const lantern of lanterns) {
      lantern.pivot.rotation.z = Math.sin(t * 0.82 + lantern.phase) * 0.022;
      lantern.pivot.rotation.x = Math.cos(t * 0.63 + lantern.phase) * 0.014;
      lantern.light.intensity =
        0.54 + Math.sin(t * 2.8 + lantern.phase) * 0.08 + Math.sin(t * 6.2 + lantern.phase * 2) * 0.025;
      lantern.glow.material.opacity = 0.27 + Math.sin(t * 2.1 + lantern.phase) * 0.05;
      lantern.glow.scale.setScalar(1.4 + Math.sin(t * 1.5 + lantern.phase) * 0.08);
    }
    // Bell rope sways ever so slightly.
    bellRope.rotation.z = Math.sin(t * 0.73) * 0.028;
    bellRope.rotation.x = Math.sin(t * 0.48 + 0.4) * 0.012;
    // Paper streamers flutter.
    for (let i = 0; i < shidePivots.length; i++) {
      const pivot = shidePivots[i];
      pivot.rotation.z = Math.sin(t * 1.32 + i * 0.8) * 0.08;
      pivot.rotation.x = Math.sin(t * 1.05 + i * 0.55) * 0.05;
    }
    // Faint changes in the interior light.
    interiorGlow.material.opacity = 0.12 + Math.sin(t * 0.8) * 0.018;
  }

  return {
    group,
    update,
    terraceTop: terraceH,
    stairsTopWorldZ: group.position.z + 4.66,
    lanterns,
  };
}

function catmull(points, t) {
  const p = (t * (points.length - 1));
  const i = Math.floor(p);
  const f = p - i;
  const a = points[Math.max(0, i - 1)];
  const b = points[Math.min(points.length - 1, i)];
  const c = points[Math.min(points.length - 1, i + 1)];
  const d = points[Math.min(points.length - 1, i + 2)];
  const tt = f;
  const v = new THREE.Vector3();
  v.x = 0.5 * ((2 * b.x) + (-a.x + c.x) * tt + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * tt * tt + (-a.x + 3 * b.x - 3 * c.x + d.x) * tt * tt * tt);
  v.y = 0.5 * ((2 * b.y) + (-a.y + c.y) * tt + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * tt * tt + (-a.y + 3 * b.y - 3 * c.y + d.y) * tt * tt * tt);
  v.z = 0.5 * ((2 * b.z) + (-a.z + c.z) * tt + (2 * a.z - 5 * b.z + 4 * c.z - d.z) * tt * tt + (-a.z + 3 * b.z - 3 * c.z + d.z) * tt * tt * tt);
  return v;
}
