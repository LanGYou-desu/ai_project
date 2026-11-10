import * as THREE from 'three';
import {
  addMesh,
  addBox,
  addSphere,
  clamp,
  lerp,
  mulberry32,
  randRange,
  TAU
} from '../utils.js';

const shared = {};
function getShared() {
  if (!shared.ico1) {
    shared.ico1 = new THREE.IcosahedronGeometry(1, 1);
    shared.ico0 = new THREE.IcosahedronGeometry(1, 0);
    shared.cone = new THREE.ConeGeometry(1, 1, 8, 1);
    shared.trunk = new THREE.CylinderGeometry(0.8, 1.15, 1, 7, 1);
    shared.rock = new THREE.DodecahedronGeometry(1, 0);
    shared.tuft = new THREE.ConeGeometry(0.055, 0.34, 4, 1);
    shared.flowerStem = new THREE.CylinderGeometry(0.012, 0.018, 0.27, 4, 1);
    shared.flowerBloom = new THREE.IcosahedronGeometry(0.065, 0);
  }
  return shared;
}

function makeTrunkMaterial(color = '#5e4835') {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.98, flatShading: true });
}

function createTree(lib, type, scale, seed) {
  const s = getShared();
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const sway = new THREE.Group();
  group.add(sway);
  const trunkColor = type === 'birch' ? '#c8bda5' : (type === 'pine' ? '#4e3b2d' : '#624b38');
  const trunkMat = makeTrunkMaterial(trunkColor);
  const trunkH = type === 'pine' ? 1.55 : (type === 'cypress' ? 1.3 : 1.15);
  const trunk = new THREE.Mesh(s.trunk, trunkMat);
  trunk.scale.set(0.18 * scale, trunkH * scale, 0.18 * scale);
  trunk.position.y = trunkH * scale / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);
  for (let i = 0; i < 2; i++) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.075, 0.3, 5), trunkMat);
    branch.position.set((i ? 1 : -1) * 0.16 * scale, trunkH * scale * (0.62 + i * 0.12), 0.02);
    branch.rotation.z = (i ? 1 : -1) * (0.85 + rng() * 0.25);
    branch.castShadow = true;
    group.add(branch);
  }

  if (type === 'pine') {
    const layers = 4;
    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const cone = new THREE.Mesh(s.cone, lib.leafMaterials[(i + seed) % 4]);
      const radius = (1.22 - t * 0.72) * scale;
      cone.scale.set(radius, (1.34 - t * 0.25) * scale, radius * (0.9 + rng() * 0.2));
      cone.position.set((rng() - 0.5) * 0.1 * scale, (1.25 + t * 0.72) * scale, (rng() - 0.5) * 0.1 * scale);
      cone.rotation.y = rng() * TAU;
      cone.castShadow = true;
      cone.receiveShadow = true;
      sway.add(cone);
    }
    const top = new THREE.Mesh(s.cone, lib.leafMaterials[2]);
    top.scale.set(0.24 * scale, 0.42 * scale, 0.24 * scale);
    top.position.y = 3.22 * scale;
    top.castShadow = true;
    sway.add(top);
  } else if (type === 'cypress') {
    for (let i = 0; i < 3; i++) {
      const blob = new THREE.Mesh(s.ico1, lib.leafMaterials[(i + 1 + seed) % 4]);
      blob.scale.set((0.58 - i * 0.08) * scale, (1.12 - i * 0.13) * scale, (0.58 - i * 0.08) * scale);
      blob.position.set((rng() - 0.5) * 0.18 * scale, (1.3 + i * 0.46) * scale, (rng() - 0.5) * 0.15 * scale);
      blob.rotation.set(rng(), rng() * TAU, rng());
      blob.castShadow = true;
      blob.receiveShadow = true;
      sway.add(blob);
    }
  } else {
    const paletteIndex = type === 'autumn' ? 5 + (seed % 2) : 1 + (seed % 4);
    const baseMat = lib.leafMaterials[paletteIndex % lib.leafMaterials.length];
    const altMat = lib.leafMaterials[(paletteIndex + 1) % lib.leafMaterials.length];
    const clusters = type === 'willow' ? 4 : 5;
    const canopyBase = 1.25 * scale;
    for (let i = 0; i < clusters; i++) {
      const blob = new THREE.Mesh(s.ico1, i % 2 ? baseMat : altMat);
      const a = (i / clusters) * TAU + rng() * 0.6;
      const r = (i === 0 ? 0.08 : 0.38 + rng() * 0.32) * scale;
      const rx = type === 'willow' ? 0.85 : 0.82 + rng() * 0.28;
      const ry = type === 'willow' ? 1.05 : 0.62 + rng() * 0.24;
      const rz = type === 'willow' ? 0.85 : 0.78 + rng() * 0.22;
      blob.scale.set(rx * scale, ry * scale, rz * scale);
      blob.position.set(Math.cos(a) * r, canopyBase + (i === 0 ? 0.4 : 0.02 + rng() * 0.18) * scale, Math.sin(a) * r);
      blob.rotation.set(rng() * 1.2, rng() * TAU, rng() * 1.2);
      blob.castShadow = true;
      blob.receiveShadow = true;
      sway.add(blob);
    }
    if (type === 'orchard') {
      for (let i = 0; i < 9; i++) {
        const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), i % 3 ? lib.flowerMaterials[0] : lib.flowerMaterials[1]);
        const a = rng() * TAU;
        const r = (0.4 + rng() * 0.55) * scale;
        fruit.position.set(Math.cos(a) * r, (canopyBase + 0.2 + rng() * 0.45) * scale, Math.sin(a) * r);
        sway.add(fruit);
      }
    }
    if (type === 'willow') {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + rng();
        const strand = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9 + rng() * 0.4, 5), lib.leafMaterials[3]);
        strand.position.set(Math.cos(a) * 0.85 * scale, (1.3 - rng() * 0.2) * scale, Math.sin(a) * 0.85 * scale);
        strand.rotation.z = (rng() - 0.5) * 0.2;
        strand.rotation.x = (rng() - 0.5) * 0.2;
        strand.castShadow = true;
        sway.add(strand);
      }
    }
  }
  group.userData.isTree = true;
  group.userData.sway = sway;
  group.userData.phase = rng() * TAU;
  group.userData.baseScale = scale;
  return group;
}

function addBush(lib, parent, terrain, x, z, scale, seed) {
  const s = getShared();
  const rng = mulberry32(seed);
  const y = terrain.heightAt(x, z);
  const bush = new THREE.Group();
  bush.position.set(x, y, z);
  const count = 3 + (seed % 3);
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(s.ico1, lib.leafMaterials[(seed + i) % 5]);
    const size = (0.28 + rng() * 0.25) * scale;
    m.scale.set(size, size * (0.65 + rng() * 0.3), size * (0.85 + rng() * 0.2));
    m.position.set((rng() - 0.5) * 0.62 * scale, 0.1 + (rng() * 0.23) * scale, (rng() - 0.5) * 0.52 * scale);
    m.rotation.set(rng(), rng() * TAU, rng());
    m.castShadow = true;
    m.receiveShadow = true;
    bush.add(m);
  }
  parent.add(bush);
  return bush;
}

function addFlowerPatch(lib, parent, terrain, center, radius, count, seed, colorOffset = 0) {
  const s = getShared();
  const rng = mulberry32(seed);
  const dummy = new THREE.Object3D();
  const stemMat = new THREE.MeshStandardMaterial({ color: '#587541', roughness: 0.95 });
  const stems = new THREE.InstancedMesh(s.flowerStem, stemMat, count);
  const bloomMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.72, vertexColors: false });
  const blooms = new THREE.InstancedMesh(s.flowerBloom, bloomMat, count);
  const colors = ['#e08c77', '#edce73', '#f1e7d0', '#c78caf', '#d96355', '#e6aa58'];
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU;
    const r = Math.sqrt(rng()) * radius;
    const x = center[0] + Math.cos(a) * r;
    const z = center[1] + Math.sin(a) * r;
    const y = terrain.heightAt(x, z);
    const height = 0.7 + rng() * 0.9;
    dummy.position.set(x, y + 0.13 * height, z);
    dummy.scale.setScalar(height);
    dummy.rotation.set(0, rng() * TAU, (rng() - 0.5) * 0.14);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, y + 0.28 * height, z);
    dummy.scale.setScalar(0.7 + rng() * 0.6);
    dummy.rotation.set(rng(), rng() * TAU, rng());
    dummy.updateMatrix();
    blooms.setMatrixAt(i, dummy.matrix);
    color.set(colors[(i + colorOffset) % colors.length]);
    blooms.setColorAt(i, color);
  }
  stems.castShadow = false;
  stems.receiveShadow = true;
  blooms.castShadow = false;
  parent.add(stems, blooms);
  return { stems, blooms };
}

function addGrassTufts(lib, parent, terrain, count, seed, avoid = []) {
  const s = getShared();
  const rng = mulberry32(seed);
  const mat = new THREE.MeshStandardMaterial({ color: '#779254', roughness: 0.98 });
  const inst = new THREE.InstancedMesh(s.tuft, mat, count);
  const dummy = new THREE.Object3D();
  let actual = 0;
  let guard = 0;
  while (actual < count && guard < count * 8) {
    guard++;
    const x = -16.5 + rng() * 33;
    const z = -12.2 + rng() * 24.5;
    const h = terrain.heightAt(x, z);
    if (h < 0.58) continue;
    if (z > terrain.coastAt(x) - 0.4) continue;
    let blocked = false;
    for (const a of avoid) {
      if ((x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r) { blocked = true; break; }
    }
    if (blocked) continue;
    dummy.position.set(x, h, z);
    dummy.scale.set(0.7 + rng() * 0.7, 0.75 + rng() * 1.2, 0.7 + rng() * 0.7);
    dummy.rotation.set(0, rng() * TAU, (rng() - 0.5) * 0.25);
    dummy.updateMatrix();
    inst.setMatrixAt(actual++, dummy.matrix);
  }
  inst.count = actual;
  inst.castShadow = false;
  inst.receiveShadow = true;
  parent.add(inst);
  return inst;
}

function addSteppingStones(lib, parent, terrain) {
  const t = 0.31;
  const point = terrain.riverCurve.getPointAt(t);
  const tangent = terrain.riverCurve.getTangentAt(t);
  tangent.y = 0;
  tangent.normalize();
  const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
  for (let i = 0; i < 5; i++) {
    const p = point.clone().addScaledVector(side, -0.7 + i * 0.35);
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.11, 8), i % 2 ? lib.stoneLight : lib.stone);
    stone.position.set(p.x, terrain.riverCurve.getPointAt(t).y + 0.12, p.z);
    stone.scale.set(1, 1, 0.75 + (i % 3) * 0.1);
    stone.rotation.y = i * 0.7;
    stone.castShadow = true;
    stone.receiveShadow = true;
    parent.add(stone);
  }
}

export function createNature(lib, terrain, avoid = []) {
  const group = new THREE.Group();
  group.name = 'nature';
  const rng = mulberry32(0x55aa7712);
  const used = [];
  const isFree = (x, z, radius) => {
    for (const a of avoid) {
      if ((x - a.x) ** 2 + (z - a.z) ** 2 < (a.r + radius) ** 2) return false;
    }
    for (const a of used) {
      if ((x - a.x) ** 2 + (z - a.z) ** 2 < (a.r + radius) ** 2) return false;
    }
    const h = terrain.heightAt(x, z);
    if (h < 0.66) return false;
    if (z > terrain.coastAt(x) - 0.55) return false;
    return true;
  };
  const addTreeAt = (x, z, type, scale, seed) => {
    if (!isFree(x, z, 0.6)) return null;
    const tree = createTree(lib, type, scale, seed);
    tree.position.set(x, terrain.heightAt(x, z) - 0.02, z);
    group.add(tree);
    used.push({ x, z, r: 0.82 * scale });
    return tree;
  };

  // Hand-placed landmark trees preserve clear sight lines around the plaza.
  const handTrees = [
    [-11.8, 4.9, 'round', 1.35, 1],
    [-12.8, 1.0, 'pine', 1.2, 2],
    [-8.2, -5.8, 'pine', 1.45, 3],
    [-7.2, -6.9, 'round', 1.2, 4],
    [-4.8, -6.3, 'autumn', 1.05, 5],
    [-1.9, -6.5, 'pine', 1.25, 6],
    [1.3, -6.9, 'round', 1.0, 7],
    [3.5, -6.6, 'cypress', 0.9, 8],
    [6.1, -7.0, 'pine', 1.1, 9],
    [7.2, -4.9, 'autumn', 0.95, 10],
    [11.8, -2.5, 'round', 1.0, 11],
    [13.2, -0.5, 'pine', 1.15, 12],
    [-14.6, 3.3, 'orchard', 0.9, 13],
    [-13.8, 4.4, 'orchard', 0.82, 14],
    [-12.9, 5.7, 'orchard', 0.78, 15],
    [-1.4, 8.4, 'willow', 0.92, 16],
    [2.8, 7.8, 'willow', 1.05, 17],
    [4.4, 6.9, 'round', 0.78, 18],
    [7.9, 6.2, 'pine', 0.7, 19],
    [10.2, -3.1, 'autumn', 0.84, 20],
    [-12.6, -3.7, 'pine', 1.05, 21],
    [-14.0, -1.2, 'round', 0.9, 22],
    [-6.4, 8.1, 'round', 0.92, 23],
    [-4.4, 8.3, 'pine', 0.75, 24]
  ];
  handTrees.forEach(([x, z, type, scale, seed]) => addTreeAt(x, z, type, scale, seed));

  // Scattered forests on the high ground and in pockets between buildings.
  const zones = [
    { cx: -9.2, cz: -5.5, rx: 5.2, rz: 3.9, count: 22, types: ['pine', 'round', 'autumn', 'cypress'] },
    { cx: 0.2, cz: -8.2, rx: 8.0, rz: 2.7, count: 20, types: ['pine', 'round', 'autumn', 'cypress'] },
    { cx: 10.0, cz: -6.0, rx: 4.6, rz: 3.1, count: 12, types: ['pine', 'autumn', 'round'] },
    { cx: -13.2, cz: 1.4, rx: 2.8, rz: 3.3, count: 9, types: ['orchard', 'round', 'autumn'] },
    { cx: 12.8, cz: -1.3, rx: 2.8, rz: 2.7, count: 7, types: ['pine', 'round'] },
    { cx: -2.8, cz: 7.2, rx: 4.0, rz: 1.5, count: 8, types: ['willow', 'round'] }
  ];
  zones.forEach((zone, zoneIndex) => {
    let placed = 0;
    let attempts = 0;
    while (placed < zone.count && attempts < zone.count * 15) {
      attempts++;
      const a = rng() * TAU;
      const r = Math.sqrt(rng());
      const x = zone.cx + Math.cos(a) * zone.rx * r;
      const z = zone.cz + Math.sin(a) * zone.rz * r;
      const type = zone.types[Math.floor(rng() * zone.types.length)];
      const scale = 0.72 + rng() * 0.68;
      if (addTreeAt(x, z, type, scale, 100 + zoneIndex * 50 + placed)) placed++;
    }
  });

  // Shrubs and flower beds.
  const bushSpots = [
    [-8.6, 5.2, 1.0], [-8.9, 2.2, 0.8], [-7.1, 6.4, 0.95], [-2.0, 7.6, 0.9],
    [2.2, 5.1, 0.75], [4.0, 5.9, 0.85], [5.9, 6.5, 0.7], [11.4, 5.4, 0.8],
    [12.9, 5.9, 0.7], [6.1, -4.6, 0.85], [8.1, -6.5, 0.8], [-10.6, -2.6, 0.75],
    [-11.2, 0.3, 0.7], [-5.9, -5.3, 0.8], [-3.3, 5.8, 0.75], [1.2, 2.2, 0.6],
    [9.5, 1.4, 0.7], [13.5, 2.6, 0.65], [-13.7, 6.1, 0.7], [4.1, -1.8, 0.55]
  ];
  bushSpots.forEach(([x, z, scale], i) => {
    if (terrain.heightAt(x, z) > 0.56) addBush(lib, group, terrain, x, z, scale, 500 + i);
  });

  addFlowerPatch(lib, group, terrain, [-8.9, 4.2], 1.0, 55, 700, 0);
  addFlowerPatch(lib, group, terrain, [-3.2, 5.8], 0.75, 35, 701, 2);
  addFlowerPatch(lib, group, terrain, [2.4, 5.7], 0.75, 30, 702, 1);
  addFlowerPatch(lib, group, terrain, [-12.0, 3.7], 1.5, 90, 703, 3);
  addFlowerPatch(lib, group, terrain, [5.5, -4.2], 0.7, 26, 704, 4);
  addFlowerPatch(lib, group, terrain, [11.0, 2.9], 0.5, 20, 705, 0);

  addGrassTufts(lib, group, terrain, 430, 0x8f1c, avoid);

  addSteppingStones(lib, group, terrain);
  // Logs, stumps and mossy stones.
  for (let i = 0; i < 12; i++) {
    const a = rng() * TAU;
    const r = 2 + rng() * 6;
    const x = -9 + Math.cos(a) * r;
    const z = -4 + Math.sin(a) * r * 0.8;
    const h = terrain.heightAt(x, z);
    if (h < 1.4) continue;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 + rng() * 0.38, 0), lib.stoneDark);
    rock.position.set(x, h + 0.1, z);
    rock.scale.set(1, 0.55 + rng() * 0.4, 0.8 + rng() * 0.3);
    rock.rotation.set(rng(), rng() * TAU, rng());
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
    const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(rock.scale.x * 0.25, 0), lib.leafMaterials[3]);
    moss.position.set(x + 0.1, h + 0.22, z - 0.06);
    moss.scale.set(1.6, 0.25, 1.1);
    group.add(moss);
  }
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.0, 8), lib.woodMid);
    log.position.set(-13.5 + i * 0.9, terrain.heightAt(-13.5 + i * 0.9, 2.7) + 0.16, 2.7 + (i % 2) * 0.4);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = i * 0.3;
    log.castShadow = true;
    group.add(log);
  }

  const swayTrees = [];
  group.traverse((child) => {
    if (child.userData && child.userData.sway) swayTrees.push(child);
  });
  function update(dt, elapsed) {
    for (const tree of swayTrees) {
      const sway = tree.userData.sway;
      const phase = tree.userData.phase;
      tree.rotation.z = Math.sin(elapsed * 0.45 + phase) * 0.006;
      tree.rotation.x = Math.cos(elapsed * 0.33 + phase) * 0.004;
      sway.rotation.z = Math.sin(elapsed * 0.55 + phase) * 0.012;
    }
  }
  return { group, update };
}
