import * as THREE from 'three';
import {
  addMesh, addBox, addCylinder, addSphere, addTube, addRope, group,
  clamp, lerp, smoothstep, TAU, mulberry32, rounded
} from '../core/utils.js';

function mesh(parent, geometry, material, x = 0, y = 0, z = 0, cast = true, receive = true) {
  return addMesh(parent, geometry, material, { position: [x, y, z], cast, receive });
}

export function createStoneLantern(materials, options = {}) {
  const g = new THREE.Group();
  g.name = 'stone-lantern';
  const s = options.scale || 1;
  const stone = options.mossy ? materials.stoneMoss : materials.stonePale;
  const base = new THREE.CylinderGeometry(0.27 * s, 0.34 * s, 0.14 * s, 6);
  mesh(g, base, stone, 0, 0.07 * s, 0);
  mesh(g, new THREE.CylinderGeometry(0.11 * s, 0.15 * s, 0.62 * s, 6), stone, 0, 0.45 * s, 0);
  mesh(g, new THREE.CylinderGeometry(0.25 * s, 0.18 * s, 0.12 * s, 6), stone, 0, 0.8 * s, 0);
  // Light chamber: a warm volume inside four stone corner posts.
  const glowCore = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.17 * s, 0.26 * s, 6), materials.lampMaterial);
  glowCore.position.y = 1.02 * s;
  g.add(glowCore);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    addBox(g, 0.045 * s, 0.3 * s, 0.045 * s, stone, Math.cos(a) * 0.21 * s, 1.02 * s, Math.sin(a) * 0.21 * s, 0.01);
  }
  mesh(g, new THREE.CylinderGeometry(0.38 * s, 0.31 * s, 0.09 * s, 6), stone, 0, 1.23 * s, 0);
  mesh(g, new THREE.CylinderGeometry(0.31 * s, 0.11 * s, 0.23 * s, 6), stone, 0, 1.37 * s, 0);
  addSphere(g, 0.065 * s, materials.brass, 0, 1.53 * s, 0, 6, 5);
  if (options.glow !== false) {
    const glow = new THREE.Sprite(materials.glow);
    glow.position.set(0, 1.03 * s, 0);
    glow.scale.setScalar(1.6 * s);
    g.add(glow);
  }
  g.position.set(options.position?.[0] || 0, options.position?.[1] || 0, options.position?.[2] || 0);
  g.rotation.y = options.rotation || 0;
  return g;
}

export function createHangingLantern(materials, options = {}) {
  const g = new THREE.Group();
  g.name = 'hanging-lantern';
  const s = options.scale || 1;
  const drop = options.drop ?? 0.75;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008 * s, 0.008 * s, drop * s, 4), materials.iron);
  string.position.y = -drop * s / 2;
  g.add(string);
  const capTop = new THREE.CylinderGeometry(0.07 * s, 0.14 * s, 0.06 * s, 8);
  mesh(g, capTop, materials.woodDark, 0, -drop * s - 0.02, 0);
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.19 * s, 0.36 * s, 12), materials.lampMaterial);
  paper.position.y = -drop * s - 0.24 * s;
  g.add(paper);
  mesh(g, new THREE.CylinderGeometry(0.14 * s, 0.09 * s, 0.05 * s, 8), materials.woodDark, 0, -drop * s - 0.44 * s, 0);
  const glow = new THREE.Sprite(materials.glow);
  glow.position.y = -drop * s - 0.24 * s;
  glow.scale.setScalar(1.3 * s);
  g.add(glow);
  return g;
}

export function createWindChime(materials, options = {}) {
  const g = new THREE.Group();
  g.name = 'wind-chime';
  g.userData.noMerge = true;
  const s = options.scale || 1;
  const disc = new THREE.CylinderGeometry(0.2 * s, 0.22 * s, 0.035 * s, 12);
  mesh(g, disc, materials.brassDark, 0, 0, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const len = (0.3 + (i % 3) * 0.12) * s;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * s, 0.014 * s, len, 5), materials.brass);
    rod.position.set(Math.cos(a) * (0.09 + i * 0.02) * s, -len / 2 - 0.04 * s, Math.sin(a) * (0.09 + i * 0.02) * s);
    g.add(rod);
  }
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.085 * s, 0.15 * s, 8, 1, true), materials.brass);
  bell.rotation.x = Math.PI;
  bell.position.y = -0.48 * s;
  g.add(bell);
  return g;
}

function createPagodaRoof(materials, options = {}) {
  const radius = options.radius || 2.7;
  const height = options.height || 0.95;
  const corners = options.corners || 6;
  const up = options.upturn || 0.24;
  const segments = options.segments || 90;
  const rings = 8;
  const positions = [];
  const uvs = [];
  const indices = [];
  const profile = [0, 0.16, 0.34, 0.54, 0.72, 0.86, 0.95, 1.0];
  for (let j = 0; j < rings; j++) {
    const rFrac = profile[j];
    const r = rFrac * radius;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * TAU;
      const cornerLift = Math.pow(Math.max(0, Math.cos(corners * a)), 5) * up * smoothstep(0.45, 1, rFrac);
      const y = height * (1 - Math.pow(rFrac, 1.22)) + cornerLift - (j === 0 ? height : 0);
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uvs.push(i / segments * 4, rFrac * 2.2);
    }
  }
  // The first ring is degenerate; collapse it to a single apex vertex for clean normals.
  const apexY = height - height;
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(0, next, i);
  }
  // Rebuild with an apex to avoid overlapping ring 0.
  const verts = [0, apexY + height * 0.72, 0];
  const uv2 = [0.5, 0];
  for (let j = 1; j < rings; j++) {
    const rFrac = profile[j];
    const r = rFrac * radius;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * TAU;
      const cornerLift = Math.pow(Math.max(0, Math.cos(corners * a)), 5) * up * smoothstep(0.45, 1, rFrac);
      verts.push(Math.cos(a) * r, height * (1 - Math.pow(rFrac, 1.22)) + cornerLift - height, Math.sin(a) * r);
      uv2.push(i / segments * 4, rFrac * 2.2);
    }
  }
  // Strange apex position was intentionally avoided; use top height directly.
  verts[1] = height;
  const ringStart = [];
  for (let j = 1; j < rings; j++) ringStart[j] = 1 + (j - 1) * segments;
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(0, 1 + next, 1 + i);
  }
  for (let j = 1; j < rings - 1; j++) {
    const a0 = ringStart[j];
    const b0 = ringStart[j + 1];
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      const a = a0 + i, b = a0 + next, c = b0 + i, d = b0 + next;
      indices.push(a, d, c, a, b, d);
    }
  }
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv2, 2));
  roofGeo.setIndex(indices);
  roofGeo.computeVertexNormals();
  const mat = materials.roofTeal.clone ? materials.roofTeal.clone() : materials.roofTeal;
  mat.side = THREE.DoubleSide;
  const roof = new THREE.Mesh(roofGeo, mat);
  roof.castShadow = true;
  roof.receiveShadow = true;
  const g = new THREE.Group();
  g.add(roof);

  // Curved eave edge.
  const eavePoints = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * TAU;
    const lift = Math.pow(Math.max(0, Math.cos(corners * a)), 5) * up;
    eavePoints.push(new THREE.Vector3(Math.cos(a) * radius, lift - height, Math.sin(a) * radius));
  }
  const eave = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(eavePoints, true), 160, 0.035, 5, true), materials.woodDark);
  eave.castShadow = true;
  g.add(eave);

  // Ridge beams to each upturned corner.
  for (let i = 0; i < corners; i++) {
    const a = (i / corners) * TAU;
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const rFrac = k / 6;
      const rr = rFrac * radius;
      const y = height * (1 - Math.pow(rFrac, 1.22)) + Math.pow(Math.max(0, Math.cos(corners * a)), 5) * up * smoothstep(0.45, 1, rFrac) - height;
      pts.push(new THREE.Vector3(Math.cos(a) * rr, y + 0.015, Math.sin(a) * rr));
    }
    addTube(g, pts, 0.025, materials.woodDark, false, 18, 4);
  }
  return g;
}

export function createPavilion(materials, options = {}) {
  const g = new THREE.Group();
  g.name = 'wind-pavilion';
  const radius = options.radius || 2.65;
  const stone = materials.stonePale;
  const platform = new THREE.CylinderGeometry(radius + 0.22, radius + 0.38, 0.22, 6);
  mesh(g, platform, materials.paving, 0, 0.11, 0);
  const step = new THREE.CylinderGeometry(radius + 0.58, radius + 0.7, 0.12, 6);
  mesh(g, step, materials.stoneMoss, 0, 0.06, 0);
  // Columns
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const x = Math.cos(a) * radius * 0.78;
    const z = Math.sin(a) * radius * 0.78;
    mesh(g, new THREE.CylinderGeometry(0.075, 0.09, 2.25, 7), materials.woodDark, x, 1.35, z);
    mesh(g, new THREE.CylinderGeometry(0.14, 0.17, 0.09, 7), materials.stoneMoss, x, 0.26, z);
    mesh(g, new THREE.CylinderGeometry(0.12, 0.1, 0.08, 7), materials.brassDark, x, 2.46, z);
  }
  // Low benches and railings, leaving the east entrance open.
  for (let i = 0; i < 6; i++) {
    if (i === 0) continue;
    const a0 = (i / 6) * TAU;
    const a1 = ((i + 1) / 6) * TAU;
    const steps = 7;
    for (let k = 0; k < steps; k++) {
      const t = k / (steps - 1);
      const a = lerp(a0, a1, t);
      const x = Math.cos(a) * radius * 0.78;
      const z = Math.sin(a) * radius * 0.78;
      if (k % 2 === 0) {
        mesh(g, new THREE.CylinderGeometry(0.035, 0.045, 0.62, 5), materials.woodDark, x, 0.78, z);
      }
    }
    const midA = (a0 + a1) / 2;
    const mid = new THREE.Vector3(Math.cos(midA) * radius * 0.78, 0.83, Math.sin(midA) * radius * 0.78);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, radius * 0.78 * 2 * Math.sin(Math.PI / 6) + 0.12, 5), materials.wood);
    rail.position.copy(mid);
    rail.rotation.z = Math.PI / 2;
    rail.rotation.y = -midA;
    g.add(rail);
    // Bench
    const bench = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.78 * 2 * Math.sin(Math.PI / 6) - 0.08, 0.08, 0.38), materials.wood);
    bench.position.set(Math.cos(midA) * radius * 0.6, 0.58, Math.sin(midA) * radius * 0.6);
    bench.rotation.y = -midA;
    bench.castShadow = true;
    g.add(bench);
  }
  // Roof
  const roof = createPagodaRoof(materials, { radius: radius + 0.12, height: 1.18, upturn: 0.3, corners: 6 });
  roof.position.y = 2.62;
  g.add(roof);
  // Finial
  mesh(g, new THREE.CylinderGeometry(0.035, 0.05, 0.75, 6), materials.brass, 0, 4.1, 0);
  addSphere(g, 0.12, materials.brass, 0, 4.48, 0, 8, 6);
  addSphere(g, 0.055, materials.starGold, 0, 4.6, 0, 6, 4);
  // A central hanging lantern
  const lantern = createHangingLantern(materials, { drop: 0.55, scale: 1.1 });
  lantern.position.y = 3.15;
  g.add(lantern);
  const chime = createWindChime(materials, { scale: 1 });
  chime.position.set(Math.cos(Math.PI * 0.32) * radius * 0.55, 2.6, Math.sin(Math.PI * 0.32) * radius * 0.55);
  g.add(chime);
  // A small tea table
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.08, 12), materials.woodLight);
  table.position.y = 1.12;
  table.castShadow = true;
  g.add(table);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.55, 8), materials.woodDark);
  leg.position.y = 0.84;
  g.add(leg);
  g.userData.windChime = chime;
  return g;
}

function createPagodaBellRoof(materials, radius) {
  return createPagodaRoof(materials, { radius, height: 0.7, upturn: 0.18, corners: 4 });
}

export function createBellShrine(materials, options = {}) {
  const g = new THREE.Group();
  g.name = 'bell-shrine';
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.75, 0.24, 4), materials.paving);
  base.rotation.y = Math.PI / 4;
  base.position.y = 0.12;
  base.receiveShadow = true;
  g.add(base);
  const posts = [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]];
  for (const [x, z] of posts) {
    mesh(g, new THREE.CylinderGeometry(0.07, 0.09, 2.3, 6), materials.woodDark, x, 1.28, z);
    mesh(g, new THREE.CylinderGeometry(0.14, 0.16, 0.09, 6), materials.brassDark, x, 2.42, z);
  }
  const roof = createPagodaBellRoof(materials, 1.55);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.66;
  g.add(roof);
  mesh(g, new THREE.CylinderGeometry(0.035, 0.05, 0.55, 5), materials.brass, 0, 3.55, 0);
  addSphere(g, 0.1, materials.starGold, 0, 3.85, 0, 8, 6);
  // Suspended bronze bell.
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.33, 0.55, 16, 1, true), materials.brassDark);
  bell.position.y = 1.9;
  g.add(bell);
  const bellLip = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 5, 20), materials.brass);
  bellLip.rotation.x = Math.PI / 2;
  bellLip.position.y = 1.63;
  g.add(bellLip);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.8, 5), materials.rope);
  rope.position.y = 2.5;
  g.add(rope);
  const clapper = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 0.24, 6), materials.brass);
  clapper.position.y = 1.55;
  g.add(clapper);
  const chime = createWindChime(materials, { scale: 0.75 });
  chime.position.set(0.9, 2.3, 0.75);
  g.add(chime);
  // Two carved standing stones.
  for (const s of [-1, 1]) {
    const stele = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.8, 0.16), materials.stoneMoss);
    stele.position.set(s * 1.55, 1.0, 0.15);
    stele.rotation.z = s * 0.035;
    stele.castShadow = true;
    g.add(stele);
    const glyph = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 4, 12), materials.starGold);
    glyph.position.set(s * 1.55, 1.16, 0.255);
    g.add(glyph);
  }
  g.userData.windChime = chime;
  return g;
}

export function createMiniTorii(materials, options = {}) {
  const g = new THREE.Group();
  g.name = 'mini-sky-shrine';
  const s = options.scale || 1;
  mesh(g, new THREE.BoxGeometry(1.65 * s, 0.12 * s, 0.7 * s), materials.stoneMoss, 0, 0.06 * s, 0);
  for (const side of [-1, 1]) {
    const x = side * 0.61 * s;
    mesh(g, new THREE.CylinderGeometry(0.09 * s, 0.12 * s, 1.55 * s, 7), materials.lacquer, x, 0.82 * s, 0);
    mesh(g, new THREE.CylinderGeometry(0.14 * s, 0.14 * s, 0.08 * s, 7), materials.iron, x, 1.63 * s, 0);
    mesh(g, new THREE.CylinderGeometry(0.13 * s, 0.16 * s, 0.08 * s, 7), materials.brassDark, x, 0.12 * s, 0);
  }
  mesh(g, new THREE.BoxGeometry(1.75 * s, 0.1 * s, 0.13 * s), materials.lacquer, 0, 1.2 * s, 0);
  const topPoints = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = lerp(-1.0, 1.0, t) * s;
    const y = (1.58 + Math.pow(Math.abs(t - 0.5) * 2, 2) * 0.15) * s;
    topPoints.push(new THREE.Vector3(x, y, 0));
  }
  addTube(g, topPoints, 0.075 * s, materials.lacquer, false, 32, 6);
  mesh(g, new THREE.BoxGeometry(0.34 * s, 0.48 * s, 0.05 * s), materials.starGold, 0, 1.34 * s, 0.04 * s);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.28 * s, 4), materials.rope);
  rope.position.set(0, 1.47 * s, 0);
  g.add(rope);
  const bell = new THREE.Mesh(new THREE.TorusGeometry(0.08 * s, 0.02 * s, 4, 12), materials.brass);
  bell.position.set(0, 1.34 * s, 0);
  bell.rotation.x = 0.3;
  g.add(bell);
  return g;
}

export function createMoonGate(materials, options = {}) {
  const g = new THREE.Group();
  g.name = 'moon-gate';
  const ringRadius = options.radius || 2.08;
  const stoneRing = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.17, 8, 80), materials.stonePale);
  stoneRing.position.y = ringRadius + 0.16;
  stoneRing.castShadow = true;
  stoneRing.receiveShadow = true;
  g.add(stoneRing);
  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(ringRadius + 0.16, 0.035, 5, 96), materials.brass);
  outerRing.position.y = ringRadius + 0.16;
  g.add(outerRing);
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(ringRadius - 0.17, 0.024, 4, 96), materials.brassDark);
  innerRing.position.y = ringRadius + 0.16;
  g.add(innerRing);
  // Star nodes around the front face.
  const rng = mulberry32(0x5a1c);
  for (let i = 0; i < 17; i++) {
    const a = rng() * TAU;
    const rr = ringRadius + (rng() - 0.5) * 0.11;
    const y = ringRadius + 0.16 + Math.sin(a) * rr;
    const x = Math.cos(a) * rr;
    const z = 0.18;
    addSphere(g, 0.018 + rng() * 0.022, materials.starGold, x, y, z, 6, 4);
  }
  // Threshold stone
  const threshold = new THREE.Mesh(new THREE.BoxGeometry(ringRadius * 1.25, 0.12, 0.95), materials.paving);
  threshold.position.y = 0.04;
  threshold.receiveShadow = true;
  g.add(threshold);
  const threshold2 = new THREE.Mesh(new THREE.BoxGeometry(ringRadius * 1.65, 0.1, 1.35), materials.stoneMoss);
  threshold2.position.y = -0.01;
  g.add(threshold2);
  // Small buttresses.
  for (const s of [-1, 1]) {
    const x = s * (ringRadius - 0.1);
    const butt = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.72), materials.stoneWarm);
    butt.position.set(x, 0.2, 0.05);
    butt.castShadow = true;
    g.add(butt);
  }
  // Vines on one shoulder of the ring.
  const vinePts = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.35 + i * 0.065;
    vinePts.push(new THREE.Vector3(Math.cos(a) * (ringRadius + 0.12), ringRadius + 0.16 + Math.sin(a) * (ringRadius + 0.02), 0.06 + Math.sin(i * 1.2) * 0.08));
  }
  addTube(g, vinePts, 0.018, materials.leafDeep, false, 24, 4);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.4 + i * 0.03;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 + rng() * 0.05, 0), materials.leafJade);
    leaf.position.set(Math.cos(a) * (ringRadius + 0.16), ringRadius + 0.16 + Math.sin(a) * (ringRadius + 0.05), 0.09);
    leaf.scale.y = 0.55;
    g.add(leaf);
  }
  // Hanging lanterns from the ring shoulders.
  for (const s of [-1, 1]) {
    const lantern = createHangingLantern(materials, { drop: 0.55, scale: 0.8 });
    lantern.position.set(s * (ringRadius - 0.25), ringRadius + 0.2, 0.17);
    g.add(lantern);
  }
  g.position.set(options.position?.[0] || 0, options.position?.[1] || 0, options.position?.[2] || 0);
  return g;
}

export function createOrrery(materials, options = {}) {
  const g = new THREE.Group();
  g.name = 'orrery';
  // Three stepped stone rings form the pool dais.
  mesh(g, new THREE.CylinderGeometry(1.25, 1.35, 0.1, 48), materials.stoneMoss, 0, 0.05, 0);
  mesh(g, new THREE.CylinderGeometry(1.02, 1.12, 0.12, 48), materials.stonePale, 0, 0.16, 0);
  const chart = new THREE.Mesh(new THREE.CircleGeometry(0.9, 64), new THREE.MeshStandardMaterial({
    map: materials.textures.starChart,
    roughness: 0.35,
    metalness: 0.06,
    emissive: new THREE.Color('#154643'),
    emissiveIntensity: 0.22
  }));
  chart.rotation.x = -Math.PI / 2;
  chart.position.y = 0.225;
  chart.receiveShadow = true;
  g.add(chart);
  // Central brass column and arms.
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.09, 0.92, 8), materials.brass);
  column.position.y = 0.65;
  column.castShadow = true;
  g.add(column);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * TAU;
    const pts = [
      new THREE.Vector3(0, 0.42, 0),
      new THREE.Vector3(Math.cos(angle) * 0.22, 1.15, Math.sin(angle) * 0.22),
      new THREE.Vector3(Math.cos(angle) * 0.86, 1.62, Math.sin(angle) * 0.86)
    ];
    addTube(g, pts, 0.028, materials.brass, false, 16, 5);
  }
  const centerY = 2.05;
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 2), materials.crystalMaterial);
  orb.position.y = centerY;
  orb.castShadow = true;
  orb.userData.noMerge = true;
  g.add(orb);
  const orbGlow = new THREE.Sprite(materials.coolGlow);
  orbGlow.position.y = centerY;
  orbGlow.scale.setScalar(3.4);
  g.add(orbGlow);
  // Brushed brass halo ring around the orb.
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.024, 5, 64), materials.brass);
  halo.position.y = centerY;
  halo.rotation.x = 0.9;
  g.add(halo);
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 3.5, 6), materials.brassDark);
  axis.position.y = centerY;
  axis.rotation.z = 0.22;
  g.add(axis);
  // A fixed meridian ring gives the instrument a clearer silhouette.
  const meridian = new THREE.Mesh(new THREE.TorusGeometry(1.92, 0.055, 6, 96), materials.brassDark);
  meridian.position.y = centerY;
  meridian.rotation.x = 0.08;
  meridian.castShadow = true;
  g.add(meridian);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.048, 6, 4), materials.starGold);
    star.position.set(Math.cos(a) * 1.92, centerY + Math.sin(a) * 1.92, 0);
    g.add(star);
  }
  // Three independently rotating armillary rings.
  const ringGroups = [];
  const ringConfigs = [
    { radius: 1.28, tiltX: Math.PI / 2 - 0.12, tiltZ: 0.18, speed: 0.07, tube: 0.045 },
    { radius: 1.48, tiltX: 0.42, tiltZ: 0.72, speed: -0.045, tube: 0.048 },
    { radius: 1.72, tiltX: 1.26, tiltZ: 0.12, speed: 0.032, tube: 0.06 }
  ];
  ringConfigs.forEach((cfg, index) => {
    const pivot = new THREE.Group();
    pivot.position.y = centerY;
    pivot.rotation.set(cfg.tiltX, 0, cfg.tiltZ);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(cfg.radius, cfg.tube, 6, 80), index === 2 ? materials.brassDark : materials.brass);
    ring.castShadow = true;
    pivot.add(ring);
    // Star markers along the ring.
    const count = index === 2 ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const star = new THREE.Mesh(new THREE.SphereGeometry(index === 2 ? 0.055 : 0.038, 6, 4), materials.starGold);
      star.position.set(Math.cos(a) * cfg.radius, Math.sin(a) * cfg.radius, 0);
      pivot.add(star);
    }
    pivot.userData.noMerge = true;
    pivot.userData.speed = cfg.speed;
    pivot.userData.axis = index;
    g.add(pivot);
    ringGroups.push(pivot);
  });
  // Tiny orbiting motes around the crystal.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const mote = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), materials.orbMaterial);
    mote.position.set(Math.cos(a) * 0.9, centerY + Math.sin(a) * 0.35, Math.sin(a) * 0.65);
    g.add(mote);
  }
  const light = new THREE.PointLight('#8fe6d1', 0.0, 7, 2);
  light.position.y = centerY;
  g.add(light);
  g.position.set(options.position?.[0] || 0, options.position?.[1] || 0, options.position?.[2] || 0);
  return { group: g, rings: ringGroups, orb, orbGlow, light };
}

export function createRopeBridge(materials, start, end, options = {}) {
  const g = new THREE.Group();
  g.name = 'rope-bridge';
  const startV = start.clone();
  const endV = end.clone();
  const mid = startV.clone().add(endV).multiplyScalar(0.5);
  mid.y -= options.sag ?? 0.58;
  const curve = new THREE.CatmullRomCurve3([startV, mid, endV]);
  const planks = options.planks || 18;
  const width = options.width || 1.05;
  const deckMat = materials.wood;
  const plankMats = [materials.wood, materials.woodLight, materials.woodDark];
  for (let i = 0; i < planks; i++) {
    const t = (i + 0.5) / planks;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(width, 0.065, 0.34), plankMats[i % 3]);
    plank.position.copy(p);
    plank.rotation.y = Math.atan2(tan.x, tan.z);
    plank.rotation.z = Math.sin(t * Math.PI) * 0.018;
    plank.castShadow = true;
    plank.receiveShadow = true;
    g.add(plank);
  }
  // Side ropes and rails.
  for (const side of [-1, 1]) {
    const railPts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const lateral = new THREE.Vector3(tan.z, 0, -tan.x).normalize().multiplyScalar(width * 0.56 * side);
      railPts.push(p.clone().add(lateral).add(new THREE.Vector3(0, 0.64 + Math.sin(t * Math.PI) * 0.12, 0)));
    }
    addRope(g, railPts, 0.025, materials.rope, false, 48);
    const lowerPts = railPts.map((p, i) => p.clone().setY(p.y - 0.36));
    addRope(g, lowerPts, 0.017, materials.rope, false, 48);
    // Vertical cords.
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const lateral = new THREE.Vector3(tan.z, 0, -tan.x).normalize().multiplyScalar(width * 0.56 * side);
      const bottom = p.clone().add(lateral);
      const top = bottom.clone().add(new THREE.Vector3(0, 0.68, 0));
      addTube(g, [bottom, top], 0.012, materials.rope, false, 1, 4);
    }
  }
  // End posts and stone footings.
  for (const p of [startV, endV]) {
    for (const side of [-1, 1]) {
      const offset = new THREE.Vector3(0, 0, 0);
      const towardCenter = endV.clone().sub(startV).normalize();
      offset.set(towardCenter.z, 0, -towardCenter.x).multiplyScalar(width * 0.68 * side);
      const x = p.x + offset.x;
      const z = p.z + offset.z;
      mesh(g, new THREE.CylinderGeometry(0.18, 0.24, 0.16, 6), materials.stoneMoss, x, p.y + 0.02, z);
      mesh(g, new THREE.CylinderGeometry(0.06, 0.085, 1.05, 6), materials.woodDark, x, p.y + 0.55, z);
      addSphere(g, 0.08, materials.brassDark, x, p.y + 1.1, z, 6, 4);
    }
  }
  // A tiny wind-chime at the midpoint, suspended under the deck.
  const chime = createWindChime(materials, { scale: 0.62 });
  chime.position.copy(curve.getPoint(0.5)).add(new THREE.Vector3(0, 0.92, 0));
  g.add(chime);
  g.userData.chime = chime;
  return g;
}
