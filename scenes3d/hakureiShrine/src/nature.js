import * as THREE from 'three';
import {
  PAL,
  toon,
  addOutline,
  applyWind,
  updateWindState,
  contactShadow,
  mulberry32,
  clamp,
  mergeStaticMeshes,
} from './helpers.js';

const UP = new THREE.Vector3(0, 1, 0);

/* ------------------------------------------------------------------ *
 * Tree construction
 * ------------------------------------------------------------------ */
function branch(parent, a, b, r1, r2, material, outline = 0.02) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r2, r1, len, 7, 1);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  addOutline(mesh, outline);
  return mesh;
}

function foliageCluster(radius, material, segments = 0) {
  const geo = segments
    ? new THREE.IcosahedronGeometry(radius, segments)
    : new THREE.DodecahedronGeometry(radius, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.scale.set(1 + (Math.random() - 0.5) * 0.25, 0.8 + Math.random() * 0.22, 1 + (Math.random() - 0.5) * 0.22);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, 0.035);
  return mesh;
}

function buildTree(root, options) {
  const {
    x,
    z,
    height = 6.5,
    canopy = 'green',
    spread = 2.4,
    seed = 1,
    blossom = false,
  } = options;
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  root.add(group);

  const bark = toon(0x6b4f3d);
  const barkDark = toon(0x503a2f);
  const baseY = 0.02;

  // Root flare.
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + rnd() * 0.6;
    branch(
      group,
      new THREE.Vector3(0, baseY + 0.18, 0),
      new THREE.Vector3(Math.cos(angle) * (0.38 + rnd() * 0.35), baseY, Math.sin(angle) * (0.38 + rnd() * 0.35)),
      0.12,
      0.05,
      barkDark,
      0.012,
    );
  }

  // Trunk with a gentle, natural bend.
  const trunkPoints = [
    new THREE.Vector3(0, baseY, 0),
    new THREE.Vector3((rnd() - 0.5) * 0.18, height * 0.22, (rnd() - 0.5) * 0.18),
    new THREE.Vector3((rnd() - 0.5) * 0.3, height * 0.45, (rnd() - 0.5) * 0.25),
    new THREE.Vector3((rnd() - 0.5) * 0.42, height * 0.65, (rnd() - 0.5) * 0.3),
    new THREE.Vector3((rnd() - 0.5) * 0.5, height * 0.78, (rnd() - 0.5) * 0.3),
  ];
  for (let i = 0; i < trunkPoints.length - 1; i++) {
    const t = i / (trunkPoints.length - 1);
    branch(
      group,
      trunkPoints[i],
      trunkPoints[i + 1],
      0.37 * (1 - t * 0.72),
      0.3 * (1 - t * 0.8),
      i % 2 ? bark : barkDark,
      0.018,
    );
  }

  const foliagePalettes = {
    green: [0x617a50, 0x728c5d, 0x849d6a, 0x536d4c, 0x94a675],
    deep: [0x4c6546, 0x5d764f, 0x6d8459, 0x3f5741, 0x7d9166],
    cherry: [PAL.blossom, PAL.blossomLight, PAL.blossomDeep, 0xddb6b8, 0xf0c7c4],
    mixed: [0x70895b, PAL.blossom, 0x889c6a, PAL.blossomDeep],
  };
  const colours = foliagePalettes[canopy] ?? foliagePalettes.green;
  const foliageMats = colours.map((c) => toon(c));
  const canopyRoot = new THREE.Group();
  group.add(canopyRoot);

  const clusterCount = blossom ? 30 : 25;
  for (let i = 0; i < clusterCount; i++) {
    const angle = (i / clusterCount) * Math.PI * 2 + rnd() * 0.8;
    const radius = spread * (0.22 + rnd() * 0.85);
    const yy = height * (0.55 + rnd() * 0.35);
    const pos = new THREE.Vector3(
      Math.cos(angle) * radius,
      yy,
      Math.sin(angle) * radius * 0.8,
    );
    if (i === 0) pos.set(0, height * 0.9, 0);
    if (i === 1) pos.set(0, height * 0.71, 0);
    const rad = (blossom ? 0.42 : 0.5) + rnd() * 0.3;
    const cluster = foliageCluster(rad, foliageMats[i % foliageMats.length]);
    cluster.position.copy(pos);
    canopyRoot.add(cluster);
    // Connect the cluster to the trunk with a visible branch for larger limbs.
    if (yy < height * 0.78 && radius > spread * 0.6) {
      branch(
        group,
        new THREE.Vector3(pos.x * 0.25, height * 0.55, pos.z * 0.25),
        new THREE.Vector3(pos.x * 0.78, yy - 0.15, pos.z * 0.78),
        0.08,
        0.03,
        barkDark,
        0.01,
      );
    }
  }

  // A handful of bright little leaf tips catches the sun.
  for (let i = 0; i < 9; i++) {
    const tip = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.14 + rnd() * 0.18, 0),
      foliageMats[(i + 2) % foliageMats.length],
    );
    const a = rnd() * Math.PI * 2;
    tip.position.set(
      Math.cos(a) * spread * (0.65 + rnd() * 0.5),
      height * (0.7 + rnd() * 0.28),
      Math.sin(a) * spread * (0.5 + rnd() * 0.5),
    );
    tip.castShadow = true;
    canopyRoot.add(tip);
  }

  // Fold the hundreds of little leaf forms into a handful of batched meshes,
  // then let that whole crown breathe as one soft mass.
  mergeStaticMeshes(canopyRoot);
  canopyRoot.userData.dynamic = true;

  contactShadow(root, x, z, spread * 3.2, spread * 2.6, 0.26, 0.035);
  return {
    group,
    canopy: canopyRoot,
    height,
    spread,
    blossom,
    phase: rnd() * Math.PI * 2,
  };
}

/* ------------------------------------------------------------------ *
 * Shrubs and rocks
 * ------------------------------------------------------------------ */
function buildShrub(root, x, z, scale, seed, colours = [0x6f865b, 0x7d9366, 0x8fa070]) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  root.add(group);
  const mats = colours.map((c) => toon(c, { flatShading: true }));
  for (let i = 0; i < 5; i++) {
    const geo = new THREE.DodecahedronGeometry((0.28 + rnd() * 0.25) * scale, 0);
    const m = new THREE.Mesh(geo, mats[i % mats.length]);
    m.position.set((rnd() - 0.5) * 0.7 * scale, (0.25 + rnd() * 0.2) * scale, (rnd() - 0.5) * 0.55 * scale);
    m.scale.y = 0.7 + rnd() * 0.3;
    m.rotation.y = rnd() * Math.PI;
    m.castShadow = true;
    m.receiveShadow = true;
    addOutline(m, 0.02);
    group.add(m);
  }
  contactShadow(root, x, z, 1.4 * scale, 1.1 * scale, 0.2, 0.03);
  return group;
}

function buildRock(root, x, z, scale, seed, moss = true) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  root.add(group);
  const rockMat = toon(0x8b8e82, { flatShading: true });
  const rockDark = toon(0x6f746e, { flatShading: true });
  const geo = new THREE.DodecahedronGeometry(0.48 * scale, 0);
  const rock = new THREE.Mesh(geo, rnd() > 0.5 ? rockMat : rockDark);
  rock.position.y = 0.24 * scale;
  rock.scale.set(1.15, 0.7 + rnd() * 0.3, 0.9);
  rock.rotation.set(rnd() * 0.4, rnd() * Math.PI, rnd() * 0.3);
  rock.castShadow = true;
  rock.receiveShadow = true;
  addOutline(rock, 0.022);
  group.add(rock);

  if (moss) {
    const mossMat = toon(rnd() > 0.5 ? PAL.moss : PAL.mossLight, { flatShading: true });
    for (let i = 0; i < 3; i++) {
      const patch = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13 * scale, 0), mossMat);
      patch.position.set((rnd() - 0.5) * 0.55 * scale, 0.4 * scale, (rnd() - 0.5) * 0.38 * scale);
      patch.scale.y = 0.22;
      patch.castShadow = false;
      group.add(patch);
    }
  }
  contactShadow(root, x, z, 1.4 * scale, 1.1 * scale, 0.2, 0.035);
  return group;
}

/* ------------------------------------------------------------------ *
 * Grass
 * ------------------------------------------------------------------ */
function buildGrass(root, groundHeightAt, treeAreas) {
  const rnd = mulberry32(0x9912);
  const count = 560;
  const positions = [];
  const uvs = [];
  // Three slim blades per tuft, arranged like a little star. The origin of
  // each blade is at y=0 so the wind shader can bend it from the root.
  for (let b = 0; b < 3; b++) {
    const angle = (b / 3) * Math.PI * 2 + 0.3;
    const dx = Math.cos(angle) * 0.06;
    const dz = Math.sin(angle) * 0.06;
    const px = -Math.sin(angle) * 0.038;
    const pz = Math.cos(angle) * 0.038;
    const tipX = dx + Math.cos(angle + 0.2) * 0.06;
    const tipZ = dz + Math.sin(angle + 0.2) * 0.06;
    const h = 0.3 + (b % 3) * 0.035;
    positions.push(
      dx - px, 0, dz - pz,
      dx + px, 0, dz + pz,
      tipX, h, tipZ,
    );
    uvs.push(0, 0, 1, 0, 0.5, 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    toneMapped: true,
  });
  const wind = applyWind(material, { strength: 0.16, speed: 1.55 });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  root.add(mesh);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const grassColours = [0x74875a, 0x849769, 0x93a176, 0x677b56, 0xa4ab7c, 0x8a9a6b];
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 12) {
    attempts++;
    const x = (rnd() * 2 - 1) * 9.4;
    const z = (rnd() * 2 - 1) * 9.4;
    // Keep grass out of the main approach and the shrine platform.
    if (Math.abs(x) < 1.82 && z > 1.2 && z < 9.6) continue;
    if (x > -5.9 && x < 5.9 && z < 0.5 && z > -7.1) continue;
    if (x > 4.2 && x < 9.3 && z < 0.3 && z > -6.7) continue;
    // Leave the chozuya and ema racks relatively clear.
    if (x < -5.0 && z > 2.6 && z < 6.2) continue;
    if (x > 4.8 && z > 3.5 && z < 6.4) continue;
    let nearTree = false;
    for (const area of treeAreas) {
      if (Math.hypot(x - area.x, z - area.z) < area.r * 0.3) nearTree = true;
    }
    if (nearTree && rnd() > 0.6) continue;
    const h = groundHeightAt(x, z);
    dummy.position.set(x, h - 0.006, z);
    const s = 0.4 + rnd() * 0.9;
    dummy.scale.set(0.76 + rnd() * 0.5, s, 0.76 + rnd() * 0.5);
    dummy.rotation.set(0, rnd() * Math.PI, (rnd() - 0.5) * 0.12);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    color.setHex(grassColours[Math.floor(rnd() * grassColours.length)]);
    mesh.setColorAt(placed, color);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return { mesh, wind };
}

/* ------------------------------------------------------------------ *
 * Flowers, fallen leaves and petals
 * ------------------------------------------------------------------ */
function buildFlowers(root, groundHeightAt) {
  const rnd = mulberry32(0x6c11);
  const petalMat = toon(0xf2dfb4);
  const yellowMat = toon(0xe8c56b);
  const stemMat = toon(0x71845a);
  const group = new THREE.Group();
  root.add(group);
  const patches = [
    [-4.2, 8.4, 0.9],
    [4.1, 8.25, 0.8],
    [-7.9, 2.1, 0.9],
    [7.7, 6.9, 0.8],
    [2.8, 2.7, 0.7],
    [-2.8, 7.9, 0.7],
  ];
  for (const [cx, cz, spread] of patches) {
    for (let i = 0; i < 11; i++) {
      const x = cx + (rnd() - 0.5) * spread * 1.6;
      const z = cz + (rnd() - 0.5) * spread * 1.4;
      const y = groundHeightAt(x, z);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.01, 0.16, 4), stemMat);
      stem.position.set(x, y + 0.08, z);
      group.add(stem);
      for (let p = 0; p < 4; p++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.038, 5, 4), petalMat);
        const a = (p / 4) * Math.PI * 2;
        petal.position.set(x + Math.cos(a) * 0.047, y + 0.18, z + Math.sin(a) * 0.047);
        petal.scale.set(1, 0.45, 0.75);
        petal.rotation.y = a;
        group.add(petal);
      }
      const centre = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), yellowMat);
      centre.position.set(x, y + 0.19, z);
      group.add(centre);
    }
  }
  return group;
}

function buildGroundLeaves(root, groundHeightAt) {
  const rnd = mulberry32(0x1eaf);
  const palette = [0xbd8247, 0xa66a3d, 0xd0a05e, 0xc78654, 0x9e6c43, 0xca9d6a, 0xd9aaa8, 0xc98d8d];
  const leaves = [];
  const leafGeo = new THREE.CircleGeometry(0.1, 6);
  leafGeo.scale(1, 0.55, 1);

  const spawn = (x, z, color) => {
    const mat = toon(color, { side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(leafGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    const pivot = new THREE.Group();
    pivot.position.set(x, groundHeightAt(x, z) + 0.012, z);
    pivot.rotation.y = rnd() * Math.PI * 2;
    pivot.userData.dynamic = true;
    pivot.add(mesh);
    root.add(pivot);
    leaves.push({
      pivot,
      mesh,
      x,
      z,
      vx: 0,
      vz: 0,
      spin: 0,
      angle: pivot.rotation.y,
      home: new THREE.Vector2(x, z),
      baseScale: 0.7 + rnd() * 0.8,
      drift: rnd() * Math.PI * 2,
    });
    pivot.scale.setScalar(0.7 + rnd() * 0.8);
    return pivot;
  };

  // A few natural piles near the courtyard edges and under the cherry tree.
  const spots = [
    [-2.4, 3.4, 5],
    [2.7, 4.8, 6],
    [-3.8, 5.8, 4],
    [3.6, 7.0, 4],
    [-6.8, 2.9, 4],
    [1.3, 8.0, 3],
    [2.9, 5.6, 4],
    [-1.9, 5.5, 4],
    [1.6, 3.8, 3],
  ];
  for (const [cx, cz, count] of spots) {
    for (let i = 0; i < count; i++) {
      spawn(
        cx + (rnd() - 0.5) * 1.15,
        cz + (rnd() - 0.5) * 1.05,
        palette[Math.floor(rnd() * palette.length)],
      );
    }
  }
  // A handful of loose leaves directly in Reimu's courtyard.
  for (let i = 0; i < 8; i++) {
    spawn(-2.0 + (rnd() - 0.5) * 4.7, 3.2 + (rnd() - 0.5) * 2.6, palette[i % palette.length]);
  }

  function pushAt(x, z, dx, dz, strength = 1) {
    for (const leaf of leaves) {
      const d = Math.hypot(leaf.x - x, leaf.z - z);
      if (d > 1.65) continue;
      const falloff = 1 - d / 1.65;
      // Only nudge leaves on the leading side of the broom.
      const side = (leaf.x - x) * dx + (leaf.z - z) * dz;
      if (side < -0.55) continue;
      const kick = (0.7 + side * 0.22) * falloff * strength;
      leaf.vx += dx * kick + (rnd() - 0.5) * 0.24;
      leaf.vz += dz * kick + (rnd() - 0.5) * 0.24;
      leaf.spin += (rnd() - 0.5) * 4.5;
    }
  }

  function update(dt, t) {
    for (const leaf of leaves) {
      if (Math.abs(leaf.vx) + Math.abs(leaf.vz) < 0.003) continue;
      leaf.x += leaf.vx * dt;
      leaf.z += leaf.vz * dt;
      leaf.angle += leaf.spin * dt;
      leaf.vx *= Math.pow(0.035, dt);
      leaf.vz *= Math.pow(0.035, dt);
      leaf.spin *= Math.pow(0.02, dt);
      leaf.x = clamp(leaf.x, -8.9, 8.9);
      leaf.z = clamp(leaf.z, 1.2, 9.35);
      leaf.pivot.position.set(leaf.x, groundHeightAt(leaf.x, leaf.z) + 0.012, leaf.z);
      leaf.pivot.rotation.y = leaf.angle;
    }
  }

  return { leaves, pushAt, update };
}

function buildFallingPetals(root) {
  const rnd = mulberry32(0x3e22);
  const count = 58;
  const geometry = new THREE.PlaneGeometry(0.075, 0.12);
  const material = new THREE.MeshToonMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.94,
    gradientMap: toon(0xffffff).gradientMap,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  root.add(mesh);
  const palette = [0xf1c4c1, 0xe6acb5, 0xf7d8cf, 0xdc9cac, 0xf4cabf];
  const color = new THREE.Color();
  const dummy = new THREE.Object3D();
  const petals = [];
  for (let i = 0; i < count; i++) {
    const petal = {
      x: -8 + rnd() * 16,
      y: 1.0 + rnd() * 6.5,
      z: -7 + rnd() * 16,
      speed: 0.15 + rnd() * 0.23,
      sway: 0.2 + rnd() * 0.55,
      phase: rnd() * Math.PI * 2,
      spin: 0.5 + rnd() * 1.5,
      angle: rnd() * Math.PI * 2,
      scale: 0.7 + rnd() * 0.8,
    };
    petals.push(petal);
    color.setHex(palette[Math.floor(rnd() * palette.length)]);
    mesh.setColorAt(i, color);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  function update(t, dt) {
    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      p.y -= p.speed * dt;
      p.x += Math.sin(t * 0.7 + p.phase) * p.sway * dt * 0.55;
      p.z += Math.cos(t * 0.52 + p.phase * 1.3) * p.sway * dt * 0.35;
      p.angle += p.spin * dt;
      if (p.y < 0.16) {
        p.y = 5.8 + rnd() * 2.8;
        p.x = -8 + rnd() * 16;
        p.z = -7 + rnd() * 16;
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.angle * 0.6, p.angle, p.angle * 0.4);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { mesh, update };
}

function buildSpiritMotes(root) {
  const rnd = mulberry32(0xf00d);
  const count = 36;
  const positions = new Float32Array(count * 3);
  const motes = [];
  for (let i = 0; i < count; i++) {
    const angle = rnd() * Math.PI * 2;
    const radius = 1.8 + rnd() * 7.8;
    const m = {
      angle,
      radius,
      y: 0.7 + rnd() * 4.4,
      speed: 0.04 + rnd() * 0.08,
      bob: rnd() * Math.PI * 2,
      phase: rnd() * Math.PI * 2,
    };
    motes.push(m);
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = m.y;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
  g.addColorStop(0, 'rgba(255, 250, 216, 0.9)');
  g.addColorStop(0.25, 'rgba(255, 231, 159, 0.45)');
  g.addColorStop(1, 'rgba(255, 215, 121, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.NoColorSpace;
  const material = new THREE.PointsMaterial({
    map,
    color: 0xffe6a4,
    size: 0.23,
    transparent: true,
    opacity: 0.54,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  root.add(points);

  function update(t) {
    const attr = geometry.attributes.position;
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      const angle = m.angle + t * m.speed;
      const x = Math.cos(angle) * m.radius;
      const z = Math.sin(angle) * m.radius;
      const y = m.y + Math.sin(t * 0.45 + m.bob) * 0.5;
      attr.setXYZ(i, x, y, z);
    }
    attr.needsUpdate = true;
    material.opacity = 0.42 + Math.sin(t * 0.35) * 0.05;
  }
  return { points, update };
}

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */
export function buildNature(root, groundHeightAt) {
  const trees = [
    buildTree(root, { x: -7.35, z: -5.8, height: 8.0, spread: 2.8, seed: 0x901, canopy: 'cherry', blossom: true }),
    buildTree(root, { x: 7.3, z: -7.4, height: 8.7, spread: 2.95, seed: 0x902, canopy: 'deep' }),
    buildTree(root, { x: -7.9, z: 0.0, height: 6.4, spread: 2.1, seed: 0x903, canopy: 'green' }),
  ];

  const shrubs = [
    [-4.8, -7.85, 1.0, 0xa1],
    [-2.3, -7.95, 1.15, 0xa2],
    [1.2, -8.0, 0.95, 0xa3],
    [4.5, -7.8, 1.1, 0xa4],
    [8.0, 6.9, 0.9, 0xa5],
    [-8.1, 7.2, 0.85, 0xa6],
    [-4.6, 8.5, 0.7, 0xa7],
    [4.6, 8.4, 0.72, 0xa8],
    [7.6, 1.4, 0.7, 0xa9],
    [-8.6, -2.1, 0.82, 0xaa],
  ];
  for (const [x, z, s, seed] of shrubs) {
    buildShrub(root, x, z, s, seed);
  }

  const rocks = [
    [-8.6, 8.2, 0.75, 0xb1],
    [8.8, -1.4, 0.6, 0xb2],
    [-7.9, -8.3, 0.9, 0xb3],
    [5.6, 8.8, 0.48, 0xb4],
    [-3.2, 8.7, 0.5, 0xb5],
    [7.0, 7.6, 0.54, 0xb6],
    [-8.5, 4.2, 0.5, 0xb7],
  ];
  for (const [x, z, s, seed] of rocks) {
    buildRock(root, x, z, s, seed);
  }

  const treeAreas = trees.map((tree) => ({
    x: tree.group.position.x,
    z: tree.group.position.z,
    r: tree.spread,
  }));
  const grass = buildGrass(root, groundHeightAt, treeAreas);
  const flowers = buildFlowers(root, groundHeightAt);
  const groundLeaves = buildGroundLeaves(root, groundHeightAt);
  const petals = buildFallingPetals(root);
  const motes = buildSpiritMotes(root);

  const fallingSeeds = [];

  function update(t, dt) {
    // Tree crowns bend a little more than trunks, with a long, slow period.
    for (const tree of trees) {
      const sway = Math.sin(t * 0.52 + tree.phase) * 0.006 + Math.sin(t * 1.15 + tree.phase * 0.8) * 0.0018;
      tree.canopy.rotation.z = sway;
      tree.canopy.rotation.x = Math.cos(t * 0.39 + tree.phase) * 0.0035;
    }
    updateWindState(grass.wind, t);
    groundLeaves.update(dt, t);
    petals.update(t, dt);
    motes.update(t);
  }

  return {
    trees,
    shrubs,
    grass,
    petals,
    groundLeaves,
    update,
  };
}
