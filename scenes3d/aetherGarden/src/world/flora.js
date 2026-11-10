import * as THREE from 'three';
import { addMesh, addTube, mulberry32, TAU, clamp, lerp, smoothstep } from '../core/utils.js';

const BLOB_GEOMETRY = new THREE.IcosahedronGeometry(1, 2);

function blob(materials, position, scale, rotation, colorMaterial, parent) {
  const mesh = new THREE.Mesh(BLOB_GEOMETRY, colorMaterial);
  mesh.position.copy(position);
  mesh.scale.copy(scale);
  mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function trunkCurve(points, radius, material, parent) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.28);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, radius, 7, false), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function createCloudPine(materials, options = {}) {
  const rng = mulberry32(options.seed || 7);
  const g = new THREE.Group();
  g.name = 'cloud-pine';
  const height = options.height || 3.8;
  const spread = options.spread || 1.0;
  const bend = (rng() - 0.5) * 0.8;
  const base = new THREE.Vector3(0, 0, 0);
  const trunkPoints = [
    base,
    new THREE.Vector3(bend * 0.35, height * 0.26, 0.05),
    new THREE.Vector3(bend * 0.6 + (rng() - 0.5) * 0.28, height * 0.53, (rng() - 0.5) * 0.23),
    new THREE.Vector3(bend * 0.9 + (rng() - 0.5) * 0.4, height * 0.79, (rng() - 0.5) * 0.3),
    new THREE.Vector3(bend + (rng() - 0.5) * 0.5, height, (rng() - 0.5) * 0.28)
  ];
  trunkCurve(trunkPoints, 0.13 * (options.scale || 1), materials.woodDark, g);
  // Root flare.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + rng();
    const root = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 5), materials.woodDark);
    root.position.set(Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.2);
    root.rotation.z = Math.PI / 2 + Math.sin(a) * 0.12;
    root.rotation.y = -a;
    g.add(root);
  }
  const pads = [];
  const branches = [
    { y: 0.56, a: -0.4, dist: 1.35 },
    { y: 0.67, a: 1.75, dist: 1.55 },
    { y: 0.77, a: 3.55, dist: 1.25 },
    { y: 0.88, a: 5.2, dist: 1.0 },
    { y: 0.44, a: 2.8, dist: 1.2 },
    { y: 0.71, a: 5.85, dist: 0.9 },
    { y: 0.83, a: 0.9, dist: 0.75 }
  ];
  const splash = [materials.leafJade, materials.leafDeep, materials.leafPale];
  branches.forEach((branch, index) => {
    const y = height * branch.y;
    const end = new THREE.Vector3(Math.cos(branch.a) * branch.dist * spread, y + (rng() - 0.5) * 0.2, Math.sin(branch.a) * branch.dist * spread);
    const start = new THREE.Vector3(bend * branch.y * 0.8, y - 0.2, 0.05);
    trunkCurve([start, start.clone().lerp(end, 0.6).add(new THREE.Vector3(0, 0.14, 0)), end], 0.038, materials.woodDark, g);
    const padCount = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < padCount; p++) {
      const along = 0.58 + rng() * 0.5;
      const pos = start.clone().lerp(end, along).add(new THREE.Vector3((rng() - 0.5) * 0.8 * spread, (rng() - 0.5) * 0.2, (rng() - 0.5) * 0.8 * spread));
      const mat = splash[(index + p) % splash.length];
      const size = (0.26 + rng() * 0.23) * (options.scale || 1);
      const m = blob(materials, pos, new THREE.Vector3(size * 1.25, size * 0.48, size * 0.95), new THREE.Euler(rng() * 0.3, rng() * TAU, (rng() - 0.5) * 0.3), mat, g);
      pads.push(m);
    }
  });
  // A crown tuft.
  for (let i = 0; i < 5; i++) {
    const pos = new THREE.Vector3(bend * 1.05 + (rng() - 0.5) * 0.8, height * (0.91 + rng() * 0.12), (rng() - 0.5) * 0.8);
    const size = (0.22 + rng() * 0.17) * (options.scale || 1);
    blob(materials, pos, new THREE.Vector3(size * 1.2, size * 0.55, size), new THREE.Euler(0, rng() * TAU, 0), i % 2 ? materials.leafPale : materials.leafJade, g);
  }
  return g;
}

export function createBlossomTree(materials, options = {}) {
  const rng = mulberry32(options.seed || 19);
  const g = new THREE.Group();
  g.name = 'blossom-tree';
  const height = options.height || 3.4;
  const scale = options.scale || 1;
  const bend = new THREE.Vector3((rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.3);
  const trunkPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bend.x + 0.08, height * 0.32, bend.z),
    new THREE.Vector3(bend.x - 0.14, height * 0.56, bend.z + 0.12),
    new THREE.Vector3(bend.x + 0.24, height * 0.72, bend.z - 0.1),
    new THREE.Vector3(bend.x - 0.1, height * 0.82, bend.z + 0.1)
  ];
  trunkCurve(trunkPoints, 0.12 * scale, materials.woodDark, g);
  const crownCenter = new THREE.Vector3(bend.x, height * 0.76, bend.z);
  const blossomMats = [materials.blossomPink, materials.blossomPale, materials.blossomWhite];
  const branches = 7;
  for (let i = 0; i < branches; i++) {
    const a = (i / branches) * TAU + rng() * 0.4;
    const dist = 1.5 + rng() * 1.25;
    const up = height * (0.62 + rng() * 0.32);
    const end = new THREE.Vector3(crownCenter.x + Math.cos(a) * dist, up, crownCenter.z + Math.sin(a) * dist * 0.8);
    const start = new THREE.Vector3(bend.x * 0.4, height * 0.48, bend.z * 0.4);
    trunkCurve([start, start.clone().lerp(end, 0.55).add(new THREE.Vector3(0, 0.3, 0)), end], 0.04 * scale, materials.woodDark, g);
    const count = 4 + Math.floor(rng() * 3);
    for (let p = 0; p < count; p++) {
      const pos = end.clone().add(new THREE.Vector3((rng() - 0.5) * 1.45, (rng() - 0.5) * 0.65, (rng() - 0.5) * 1.35));
      const size = (0.2 + rng() * 0.23) * scale;
      blob(materials, pos, new THREE.Vector3(size * 1.1, size * 0.9, size), new THREE.Euler(rng(), rng() * TAU, rng() * 0.3), blossomMats[(i + p) % 3], g);
    }
  }
  // A few low branches with blossoms hanging closer to the trunk.
  for (let i = 0; i < 8; i++) {
    const a = rng() * TAU;
    const pos = new THREE.Vector3(Math.cos(a) * (0.4 + rng() * 0.95), height * (0.4 + rng() * 0.28), Math.sin(a) * (0.4 + rng() * 0.95));
    const size = (0.18 + rng() * 0.2) * scale;
    blob(materials, pos, new THREE.Vector3(size, size * 0.85, size * 0.9), new THREE.Euler(0, rng() * TAU, 0), blossomMats[i % 3], g);
  }
  g.userData.crown = crownCenter.clone();
  return g;
}

export function createFir(materials, options = {}) {
  const rng = mulberry32(options.seed || 83);
  const g = new THREE.Group();
  g.name = 'mountain-fir';
  const h = options.height || 4.0;
  const s = options.scale || 1;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.14 * s, h * 0.8, 6), materials.woodDark);
  trunk.position.y = h * 0.4;
  trunk.castShadow = true;
  g.add(trunk);
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const radius = (1.15 - t * 0.82) * s;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, 1.25 * s, 7), i % 2 ? materials.leafDeep : materials.leafJade);
    cone.position.y = h * (0.25 + t * 0.68);
    cone.rotation.y = rng() * TAU;
    cone.castShadow = true;
    cone.receiveShadow = true;
    g.add(cone);
    // A second smaller skirt breaks the perfect cone outline.
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.9, 0.5 * s, 7), materials.leafPale);
    skirt.position.y = cone.position.y - 0.25 * s;
    skirt.rotation.y = rng() * TAU;
    g.add(skirt);
  }
  return g;
}

export function createMaple(materials, options = {}) {
  const rng = mulberry32(options.seed || 23);
  const g = new THREE.Group();
  g.name = 'maple';
  const height = options.height || 3.2;
  const scale = options.scale || 1;
  const points = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.18, height * 0.3, 0.04),
    new THREE.Vector3(-0.15, height * 0.58, 0.12),
    new THREE.Vector3(0.1, height * 0.78, -0.05)
  ];
  trunkCurve(points, 0.1 * scale, materials.woodDark, g);
  const center = new THREE.Vector3(0.1, height * 0.74, -0.05);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + rng();
    const dist = 1.2 + rng() * 1.1;
    const end = new THREE.Vector3(center.x + Math.cos(a) * dist, height * (0.62 + rng() * 0.32), center.z + Math.sin(a) * dist);
    trunkCurve([new THREE.Vector3(0.05, height * 0.48, 0), end], 0.035 * scale, materials.woodDark, g);
    for (let k = 0; k < 3; k++) {
      const pos = end.clone().add(new THREE.Vector3((rng() - 0.5) * 0.7, (rng() - 0.5) * 0.3, (rng() - 0.5) * 0.7));
      const size = (0.23 + rng() * 0.22) * scale;
      blob(materials, pos, new THREE.Vector3(size * 1.05, size * 0.75, size), new THREE.Euler(rng(), rng() * TAU, 0), i % 2 ? materials.leafAutumn : materials.leafGolden, g);
    }
  }
  return g;
}

export function createWillow(materials, options = {}) {
  const rng = mulberry32(options.seed || 37);
  const g = new THREE.Group();
  g.name = 'willow';
  const height = options.height || 3.2;
  const scale = options.scale || 1;
  trunkCurve([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.15, height * 0.28, 0.07),
    new THREE.Vector3(0.14, height * 0.55, -0.08),
    new THREE.Vector3(-0.06, height * 0.72, 0)
  ], 0.12 * scale, materials.woodDark, g);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU + rng() * 0.5;
    const dist = 1.4 + rng() * 1.35;
    const start = new THREE.Vector3(0, height * (0.62 + rng() * 0.16), 0);
    const mid = new THREE.Vector3(Math.cos(a) * dist, height * (0.62 + rng() * 0.22), Math.sin(a) * dist);
    const end = mid.clone().add(new THREE.Vector3(Math.cos(a) * 0.45, -0.75 - rng() * 0.8, Math.sin(a) * 0.45));
    trunkCurve([start, mid, end], 0.018 * scale, materials.leafDeep, g);
    for (let k = 0; k < 6; k++) {
      const t = k / 5;
      const pos = new THREE.Vector3().lerpVectors(mid, end, t).add(new THREE.Vector3((rng() - 0.5) * 0.35, 0, (rng() - 0.5) * 0.35));
      const size = (0.14 + rng() * 0.16) * scale;
      blob(materials, pos, new THREE.Vector3(size, size * 0.38, size * 1.45), new THREE.Euler(0, rng() * TAU, (rng() - 0.5) * 0.4), k % 2 ? materials.leafPale : materials.leafJade, g);
    }
  }
  return g;
}

export function createBambooGrove(materials, options = {}) {
  const rng = mulberry32(options.seed || 41);
  const g = new THREE.Group();
  g.name = 'bamboo-grove';
  const count = options.count || 9;
  const height = options.height || 3.2;
  for (let i = 0; i < count; i++) {
    const x = (rng() - 0.5) * 1.9;
    const z = (rng() - 0.5) * 1.9;
    const h = height * (0.7 + rng() * 0.45);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, h, 5), materials.bamboo);
    stalk.position.set(x, h / 2, z);
    stalk.rotation.z = (rng() - 0.5) * 0.06;
    stalk.castShadow = true;
    g.add(stalk);
    // Node rings.
    for (let n = 1; n < 4; n++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.007, 3, 8), materials.leafDeep);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, h * (n / 4), z);
      g.add(ring);
    }
    for (let l = 0; l < 5; l++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.45, 3), l % 2 ? materials.leafPale : materials.leafJade);
      leaf.position.set(x + (rng() - 0.5) * 0.7, h * (0.52 + rng() * 0.45), z + (rng() - 0.5) * 0.7);
      leaf.rotation.z = 0.9 + rng() * 0.7;
      leaf.rotation.y = rng() * TAU;
      g.add(leaf);
    }
  }
  return g;
}

export function createShrub(materials, options = {}) {
  const rng = mulberry32(options.seed || 53);
  const g = new THREE.Group();
  g.name = 'shrub';
  const s = options.scale || 1;
  const mainMat = options.flower ? materials.blossomPink : (rng() > 0.5 ? materials.leafJade : materials.leafDeep);
  for (let i = 0; i < 4; i++) {
    const pos = new THREE.Vector3((rng() - 0.5) * 0.65 * s, (0.16 + rng() * 0.28) * s, (rng() - 0.5) * 0.65 * s);
    const size = (0.32 + rng() * 0.22) * s;
    blob(materials, pos, new THREE.Vector3(size, size * 0.7, size), new THREE.Euler(0, rng() * TAU, 0), i === 0 ? mainMat : (rng() > 0.5 ? materials.leafPale : materials.leafJade), g);
  }
  if (options.flower || rng() > 0.6) {
    for (let i = 0; i < 4; i++) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.045 * s, 5, 4), materials.flowerMaterials[i % materials.flowerMaterials.length]);
      flower.position.set((rng() - 0.5) * 0.85 * s, (0.43 + rng() * 0.2) * s, (rng() - 0.5) * 0.85 * s);
      g.add(flower);
    }
  }
  return g;
}

function makeTuftGeometry() {
  const positions = [];
  const normals = [];
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI;
    const dx = Math.cos(a) * 0.05;
    const dz = Math.sin(a) * 0.05;
    const cx = Math.cos(a + Math.PI / 2) * 0.015;
    const cz = Math.sin(a + Math.PI / 2) * 0.015;
    const tipX = Math.cos(a) * 0.06;
    const tipZ = Math.sin(a) * 0.06;
    positions.push(-dx, 0, -dz, dx, 0, dz, tipX + cx, 0.28, tipZ + cz);
    positions.push(dx, 0, dz, -dx, 0, -dz, tipX - cx, 0.28, tipZ - cz);
    for (let k = 0; k < 6; k++) normals.push(0, 1, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

function addGrassInstances(parent, island, materials, options = {}) {
  const rng = mulberry32(options.seed || 77);
  const count = options.count || 520;
  const geometry = makeTuftGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 1,
    side: THREE.DoubleSide,
    vertexColors: false
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const colors = ['#789b66', '#8ba56f', '#6e8b5e', '#9aac75'];
  const minRadius = options.minRadius ?? 0;
  const maxRadius = options.maxRadius ?? 1;
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 8) {
    attempts++;
    const a = rng() * TAU;
    const rr = minRadius + Math.sqrt(rng()) * (maxRadius - minRadius);
    const x = Math.cos(a) * island.radiusX * rr * 0.94 + (options.offsetX || 0);
    const z = Math.sin(a) * island.radiusZ * rr * 0.94 + (options.offsetZ || 0);
    const y = island.heightAtLocal(x, z);
    if (y < -0.2) continue;
    dummy.position.set(x, y + 0.01, z);
    dummy.rotation.y = rng() * TAU;
    dummy.scale.set(0.65 + rng() * 0.75, 0.55 + rng() * 0.75, 0.65 + rng() * 0.75);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    color.set(colors[Math.floor(rng() * colors.length)]);
    mesh.setColorAt(placed, color);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  parent.add(mesh);
  return mesh;
}

function addFlowers(parent, island, materials, options = {}) {
  const rng = mulberry32(options.seed || 91);
  const count = options.count || 64;
  const meshes = materials.flowerMaterials.map((material, index) => {
    const geo = new THREE.SphereGeometry(0.065, 5, 4);
    const m = new THREE.InstancedMesh(geo, material, Math.ceil(count / 5) + 4);
    m.castShadow = false;
    m.receiveShadow = true;
    parent.add(m);
    return { mesh: m, used: 0 };
  });
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU;
    const rr = (options.minRadius ?? 0.64) + rng() * (options.radiusRange ?? 0.28);
    const x = Math.cos(a) * island.radiusX * rr * 0.94 + (options.offsetX || 0);
    const z = Math.sin(a) * island.radiusZ * rr * 0.94 + (options.offsetZ || 0);
    const y = island.heightAtLocal(x, z);
    if (y < -0.2) continue;
    const target = meshes[i % meshes.length];
    if (target.used >= target.mesh.instanceMatrix.count) continue;
    dummy.position.set(x, y + 0.16 + rng() * 0.15, z);
    dummy.rotation.set(0, rng() * TAU, 0);
    const scale = 0.6 + rng() * 0.9;
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    target.mesh.setMatrixAt(target.used++, dummy.matrix);
  }
  meshes.forEach(({ mesh, used }) => {
    mesh.count = used;
    mesh.instanceMatrix.needsUpdate = true;
  });
}

function addMossyBoulder(parent, materials, x, z, y, scale, rng) {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), rng() > 0.45 ? materials.rock : materials.stoneMoss);
  rock.position.set(x, y + scale * 0.35, z);
  rock.scale.set(1.0 + rng() * 0.5, 0.55 + rng() * 0.5, 0.8 + rng() * 0.5);
  rock.rotation.set(rng() * 0.4, rng() * TAU, rng() * 0.3);
  rock.castShadow = true;
  rock.receiveShadow = true;
  parent.add(rock);
  if (rng() > 0.35) {
    const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(scale * 0.55, 0), rng() > 0.5 ? materials.leafJade : materials.leafPale);
    moss.scale.y = 0.25;
    moss.position.set(x + (rng() - 0.5) * 0.2, y + scale * 0.72, z + (rng() - 0.5) * 0.2);
    moss.rotation.y = rng() * TAU;
    parent.add(moss);
  }
}

export function createFlora(materials, islands) {
  const main = islands.main;
  const left = islands.left;
  const right = islands.right;
  const shrine = islands.shrine;
  const rng = mulberry32(0x1eaf7);
  const petalSources = [];

  function place(object, island, worldX, worldZ, yOffset = 0) {
    const localX = worldX - island.group.position.x;
    const localZ = worldZ - island.group.position.z;
    object.position.set(localX, island.heightAtLocal(localX, localZ) + yOffset, localZ);
    island.group.add(object);
    return object;
  }

  // Main island trees.
  const pine = createCloudPine(materials, { height: 4.5, spread: 1.0, scale: 0.9, seed: 11 });
  place(pine, main, -6.15, -1.6);
  const pine2 = createCloudPine(materials, { height: 3.0, spread: 0.8, scale: 0.7, seed: 12 });
  pine2.rotation.y = 2.4;
  place(pine2, main, 5.8, -3.65);

  const cherry = createBlossomTree(materials, { height: 3.4, scale: 0.78, seed: 21 });
  place(cherry, main, -5.75, 2.5);
  petalSources.push(new THREE.Vector3(-5.75, main.heightAtWorld(-5.75, 2.5) + 2.7, 2.5));
  const cherry2 = createBlossomTree(materials, { height: 2.6, scale: 0.65, seed: 23 });
  cherry2.rotation.y = 3.1;
  place(cherry2, main, 6.1, -4.0);
  petalSources.push(new THREE.Vector3(6.1, main.heightAtWorld(6.1, -4.0) + 2.0, -4.0));

  const willow = createWillow(materials, { height: 3.0, scale: 0.8, seed: 31 });
  place(willow, main, -5.4, -3.85);

  const bamboo = createBambooGrove(materials, { count: 10, height: 3.1, seed: 41 });
  place(bamboo, main, 5.9, -1.65);

  const fir = createFir(materials, { height: 4.2, scale: 0.9, seed: 84 });
  place(fir, main, 2.6, -5.4);
  const fir2 = createFir(materials, { height: 3.1, scale: 0.7, seed: 85 });
  place(fir2, main, -3.3, -5.9);

  // Satellite trees.
  const maple = createMaple(materials, { height: 3.8, scale: 1.05, seed: 51 });
  place(maple, left, -16.25, 5.9);
  const leftPine = createCloudPine(materials, { height: 2.9, spread: 0.76, scale: 0.72, seed: 52 });
  leftPine.rotation.y = 1.2;
  place(leftPine, left, -11.3, 2.0);
  const leftFir = createFir(materials, { height: 3.3, scale: 0.72, seed: 86 });
  place(leftFir, left, -16.0, 2.5);

  const rightPine = createCloudPine(materials, { height: 3.7, spread: 0.86, scale: 0.92, seed: 61 });
  rightPine.rotation.y = 4.0;
  place(rightPine, right, 16.25, -1.55);
  const rightMaple = createMaple(materials, { height: 2.6, scale: 0.78, seed: 62 });
  place(rightMaple, right, 12.6, -4.5);
  const rightFir = createFir(materials, { height: 3.6, scale: 0.78, seed: 87 });
  place(rightFir, right, 16.1, -4.2);

  const shrinePine = createCloudPine(materials, { height: 3.1, spread: 1.0, scale: 0.8, seed: 71 });
  shrinePine.rotation.y = -0.4;
  place(shrinePine, shrine, -5.7, -12.4);
  const shrineFir = createFir(materials, { height: 3.0, scale: 0.62, seed: 88 });
  place(shrineFir, shrine, -4.4, -13.2);

  // Shrubs near the paths and pool.
  const shrubSpots = [
    [-3.1, 3.75, 0.8, true], [3.3, 0.85, 0.7, false], [-4.0, -2.7, 0.65, false],
    [4.6, -0.15, 0.55, true], [-6.7, 0.3, 0.7, false], [2.3, -5.2, 0.5, true],
    [-2.7, -5.7, 0.7, false], [6.9, 3.4, 0.55, false]
  ];
  shrubSpots.forEach(([x, z, s, flower], i) => {
    const shrub = createShrub(materials, { scale: s, flower, seed: 100 + i });
    place(shrub, main, x, z);
  });
  for (let i = 0; i < 4; i++) {
    const a = rng() * TAU;
    const rr = 2.0 + rng() * 1.5;
    const shrub = createShrub(materials, { scale: 0.55 + rng() * 0.35, flower: i === 0, seed: 150 + i });
    place(shrub, left, left.group.position.x + Math.cos(a) * rr, left.group.position.z + Math.sin(a) * rr * 0.75);
  }
  for (let i = 0; i < 4; i++) {
    const a = rng() * TAU;
    const rr = 1.8 + rng() * 1.4;
    const shrub = createShrub(materials, { scale: 0.45 + rng() * 0.3, flower: i === 2, seed: 170 + i });
    place(shrub, right, right.group.position.x + Math.cos(a) * rr, right.group.position.z + Math.sin(a) * rr * 0.7);
  }
  for (let i = 0; i < 3; i++) {
    const shrub = createShrub(materials, { scale: 0.35 + rng() * 0.25, flower: i === 1, seed: 190 + i });
    place(shrub, shrine, shrine.group.position.x + (rng() - 0.5) * 2.5, shrine.group.position.z + (rng() - 0.5) * 1.8);
  }

  // Mossy boulders in the lawn.
  const boulderSpots = [
    [-4.2, 2.6, 0.45], [4.35, -2.2, 0.38], [6.4, 1.5, 0.32], [-5.6, -0.7, 0.28],
    [2.7, 5.8, 0.32], [-2.4, -3.9, 0.25], [7.0, -3.0, 0.3]
  ];
  boulderSpots.forEach(([x, z, s]) => {
    const y = main.heightAtLocal(x, z);
    addMossyBoulder(main.group, materials, x, z, y, s, rng);
  });
  addMossyBoulder(left.group, materials, 2.8, 1.6, left.heightAtLocal(2.8, 1.6), 0.36, rng);
  addMossyBoulder(right.group, materials, -2.2, 1.3, right.heightAtLocal(-2.2, 1.3), 0.3, rng);

  // Instanced ground cover and flowers.
  addGrassInstances(main.group, main, materials, { count: 1600, minRadius: 0.46, maxRadius: 0.98, seed: 201 });
  addGrassInstances(left.group, left, materials, { count: 380, minRadius: 0.3, maxRadius: 0.95, seed: 202 });
  addGrassInstances(right.group, right, materials, { count: 300, minRadius: 0.28, maxRadius: 0.95, seed: 203 });
  addGrassInstances(shrine.group, shrine, materials, { count: 120, minRadius: 0.15, maxRadius: 0.94, seed: 204 });
  addFlowers(main.group, main, materials, { count: 120, minRadius: 0.52, radiusRange: 0.43, seed: 211 });
  addFlowers(left.group, left, materials, { count: 38, minRadius: 0.45, radiusRange: 0.5, seed: 212 });
  addFlowers(right.group, right, materials, { count: 30, minRadius: 0.45, radiusRange: 0.5, seed: 213 });

  // Petals shed beneath the two blossom trees.
  function addFallenPetals(island, worldX, worldZ, radius, count, seed) {
    const rng2 = mulberry32(seed);
    const geo = new THREE.CircleGeometry(0.075, 5);
    const mat = new THREE.MeshStandardMaterial({ color: '#eab0bd', roughness: 0.95, side: THREE.DoubleSide });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = rng2() * TAU;
      const rr = Math.sqrt(rng2()) * radius;
      const lx = worldX - island.group.position.x + Math.cos(a) * rr;
      const lz = worldZ - island.group.position.z + Math.sin(a) * rr;
      const y = island.heightAtLocal(lx, lz) + 0.025;
      dummy.position.set(lx, y, lz);
      dummy.rotation.set(-Math.PI / 2, 0, rng2() * TAU);
      dummy.scale.setScalar(0.45 + rng2() * 0.9);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.receiveShadow = true;
    island.group.add(inst);
  }
  addFallenPetals(main, -5.75, 2.5, 1.8, 85, 301);
  addFallenPetals(main, 6.1, -4.0, 1.4, 55, 302);

  // Fine flower bed near the moon gate (deliberate clusters).
  for (let i = 0; i < 24; i++) {
    const side = i % 2 ? -1 : 1;
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.055 + rng() * 0.03, 5, 4), materials.flowerMaterials[i % 5]);
    const x = side * (2.15 + rng() * 0.55);
    const z = 3.65 + rng() * 1.3;
    flower.position.set(x, main.heightAtLocal(x, z) + 0.13 + rng() * 0.12, z);
    main.group.add(flower);
  }

  return { petalSources };
}
