import * as THREE from 'three';
import { addMesh, addBox, addSphere, addCylinder, addTube, clamp, lerp, smoothstep, mulberry32, TAU } from '../core/utils.js';

function newColor(hex) { return new THREE.Color(hex); }

function createTopColors(positions, normals, radii, options, rng) {
  const colors = new Float32Array(positions.length);
  const grassA = newColor(options.grassA || '#6f9564');
  const grassB = newColor(options.grassB || '#9bb27b');
  const grassC = newColor(options.grassC || '#b3b47b');
  const moss = newColor(options.mossColor || '#5c7a58');
  const soil = newColor(options.soilColor || '#6f5a41');
  const c = new THREE.Color();
  for (let i = 0; i < positions.length / 3; i++) {
    const x = positions[i * 3];
    const z = positions[i * 3 + 2];
    const y = positions[i * 3 + 1];
    const r = radii[i];
    const ny = normals[i * 3 + 1];
    const noise = Math.sin(x * 1.27 + z * 0.83 + options.seed * 0.01) * 0.5 + Math.sin(x * 0.47 - z * 1.31) * 0.5;
    c.copy(grassA).lerp(grassB, clamp(0.25 + noise * 0.22 + y * 0.1, 0, 1));
    c.lerp(grassC, smoothstep(0.64, 0.95, r) * 0.24);
    c.lerp(moss, smoothstep(0.39, 0.76, 1 - ny) * 0.65);
    c.lerp(soil, smoothstep(0.9, 1.01, r) * 0.68);
    const patch = Math.sin(x * 0.25 + z * 0.41 + y * 1.7) * 0.5 + 0.5;
    c.offsetHSL(0, 0.01 * (patch - 0.5), (patch - 0.5) * 0.035);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  return colors;
}

export function createFloatingIsland(materials, options) {
  const group = new THREE.Group();
  group.name = options.name || 'floating-island';
  group.position.set(options.center[0], options.center[1], options.center[2]);
  const rng = mulberry32(options.seed || 123);
  const rx = options.radius[0];
  const rz = options.radius[1];
  const segments = options.segments || 112;
  const rings = options.rings || 26;
  const baseHeight = options.baseHeight ?? 0.28;
  const rimDrop = options.rimDrop ?? 0.2;
  const undersideDepth = options.undersideDepth || 7.0;
  const flats = options.flats || [];
  const bumps = options.bumps || [];
  const phase1 = rng() * TAU;
  const phase2 = rng() * TAU;
  const phase3 = rng() * TAU;
  const edgeFactor = (a) => 1 + 0.068 * Math.sin(a * 3 + phase1) + 0.038 * Math.sin(a * 7 + phase2) + 0.022 * Math.sin(a * 13 + phase3);
  const centerShift = options.centerShift || [0, 0];

  function surfaceHeight(x, z) {
    const rr = Math.sqrt((x / rx) ** 2 + (z / rz) ** 2);
    let h = baseHeight + 0.24 * (1 - smoothstep(0.04, 1.02, Math.min(1.02, rr)));
    h += 0.045 * Math.sin(x * 0.65 + z * 0.27 + phase1) * (1 - rr * 0.5);
    h += 0.022 * Math.sin(z * 1.3 - x * 0.7 + phase2);
    for (const bump of bumps) {
      const dx = (x - bump.x) / bump.r;
      const dz = (z - bump.z) / bump.r;
      h += bump.amp * Math.exp(-(dx * dx + dz * dz) * 1.5);
    }
    for (const flat of flats) {
      const d = Math.sqrt(((x - flat.x) / (flat.rx || flat.r)) ** 2 + ((z - flat.z) / (flat.rz || flat.r)) ** 2);
      if (d < 1.35) {
        const mask = 1 - smoothstep(0.62, 1.22, d);
        h = lerp(h, flat.y, mask);
      }
    }
    h -= smoothstep(0.86, 1.03, rr) * rimDrop;
    return h;
  }

  const heightAtLocal = (x, z) => surfaceHeight(x, z);
  const heightAtWorld = (x, z) => options.center[1] + surfaceHeight(x - options.center[0], z - options.center[2]);

  const positions = [];
  const uvs = [];
  const radii = [];
  const indices = [];
  const ringStart = [];
  const centerY = surfaceHeight(0, 0);
  positions.push(0, centerY, 0);
  uvs.push(0.5, 0.5);
  radii.push(0);
  for (let j = 1; j <= rings; j++) {
    ringStart[j] = positions.length / 3;
    const r = j / rings;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * TAU;
      const edge = edgeFactor(a);
      const shift = smoothstep(0.2, 1, r);
      const x = Math.cos(a) * rx * r * edge + centerShift[0] * shift;
      const z = Math.sin(a) * rz * r * edge + centerShift[1] * shift;
      const y = surfaceHeight(x, z) + (rng() - 0.5) * 0.008 * r;
      positions.push(x, y, z);
      uvs.push(x / rx * 0.5 + 0.5, z / rz * 0.5 + 0.5);
      radii.push(r);
    }
  }
  // Center fan.
  const firstStart = ringStart[1];
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(0, firstStart + next, firstStart + i);
  }
  // Radial annulus.
  for (let j = 1; j < rings; j++) {
    const aStart = ringStart[j];
    const bStart = ringStart[j + 1];
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      const a = aStart + i;
      const b = aStart + next;
      const c = bStart + i;
      const d = bStart + next;
      indices.push(a, d, c, a, b, d);
    }
  }
  const topGeometry = new THREE.BufferGeometry();
  topGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  topGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  topGeometry.setIndex(indices);
  topGeometry.computeVertexNormals();
  const normals = topGeometry.attributes.normal.array;
  const colors = createTopColors(positions, normals, radii, { ...options, seed: options.seed || 1 }, rng);
  topGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const topMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    map: materials.textures.grass,
    roughness: 0.98,
    metalness: 0
  });
  const topMesh = new THREE.Mesh(topGeometry, topMaterial);
  topMesh.receiveShadow = true;
  topMesh.castShadow = true;
  group.add(topMesh);

  // Grab the irregular outer rim, which becomes both the grass overhang and the cliff top.
  const rim = [];
  const rimStart = ringStart[rings];
  for (let i = 0; i < segments; i++) {
    const idx = rimStart + i;
    rim.push({ x: positions[idx * 3], y: positions[idx * 3 + 1], z: positions[idx * 3 + 2], a: (i / segments) * TAU });
  }

  const underPositions = [];
  const underColors = [];
  const underUVs = [];
  const underIndices = [];
  const levels = [
    { scale: 1.0, depth: 0 },
    { scale: 0.968, depth: 0.42 },
    { scale: 0.9, depth: 1.35 },
    { scale: 0.79, depth: 2.6 },
    { scale: 0.65, depth: 3.9 },
    { scale: 0.5, depth: 5.15 },
    { scale: 0.34, depth: 6.25 },
    { scale: 0.18, depth: 7.1 },
    { scale: 0.06, depth: 7.7 }
  ];
  const scaledDepth = undersideDepth / 7.7;
  const topRock = newColor(options.rockTop || '#a38e72');
  const midRock = newColor(options.rockMid || '#8b8c78');
  const deepRock = newColor(options.rockDeep || '#6a7972');
  const mossRock = newColor(options.mossColor || '#7b9268');
  const temp = new THREE.Color();
  for (let j = 0; j < levels.length; j++) {
    const lev = levels[j];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * TAU;
      const r = rim[i];
      const wobble = 1 + (j === 0 ? 0 : (0.045 * Math.sin(a * 5.0 + phase1 + j * 0.7) + 0.025 * Math.sin(a * 11.0 + phase2 - j * 0.5)));
      const shift = j / (levels.length - 1);
      const x = r.x * lev.scale * wobble + centerShift[0] * 0.65 * shift;
      const z = r.z * lev.scale * wobble + centerShift[1] * 0.65 * shift;
      const y = r.y - lev.depth * scaledDepth + (j === 0 ? 0 : (rng() - 0.5) * 0.22);
      underPositions.push(x, y, z);
      underUVs.push((i / segments) * 4.5, j * 0.42);
      const t = j / (levels.length - 1);
      if (j <= 1) {
        temp.copy(topRock).lerp(mossRock, j === 0 ? 0.58 : 0.26);
      } else {
        temp.copy(midRock).lerp(deepRock, smoothstep(0.38, 0.98, t));
        temp.lerp(newColor('#b7a98a'), (0.5 + 0.5 * Math.sin(a * 3.6 + j * 1.3)) * 0.3);
        temp.lerp(newColor('#526c62'), (j % 3 === 0 ? 0.17 : 0) + ((j <= 3 && Math.sin(a * 5.2 + j) > 0.4) ? 0.16 : 0));
      }
      underColors.push(temp.r, temp.g, temp.b);
    }
  }
  for (let j = 0; j < levels.length - 1; j++) {
    const aStart = j * segments;
    const bStart = (j + 1) * segments;
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      const a = aStart + i;
      const b = aStart + next;
      const c = bStart + i;
      const d = bStart + next;
      underIndices.push(a, b, c, b, d, c);
    }
  }
  const tipIndex = underPositions.length / 3;
  underPositions.push(centerShift[0] * 0.8, -undersideDepth - 0.5, centerShift[1] * 0.8);
  underUVs.push(2.5, 5.1);
  const tipColor = deepRock.clone().multiplyScalar(0.74);
  underColors.push(tipColor.r, tipColor.g, tipColor.b);
  const lastStart = (levels.length - 1) * segments;
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    underIndices.push(lastStart + i, lastStart + next, tipIndex);
  }
  const underGeometry = new THREE.BufferGeometry();
  underGeometry.setAttribute('position', new THREE.Float32BufferAttribute(underPositions, 3));
  underGeometry.setAttribute('color', new THREE.Float32BufferAttribute(underColors, 3));
  underGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(underUVs, 2));
  underGeometry.setIndex(underIndices);
  underGeometry.computeVertexNormals();
  const underMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide
  });
  const underMesh = new THREE.Mesh(underGeometry, underMaterial);
  underMesh.castShadow = true;
  underMesh.receiveShadow = true;
  group.add(underMesh);

  // Dark hanging rock spires underneath.
  for (let i = 0; i < (options.spires ?? 5); i++) {
    const a = (i / (options.spires ?? 5)) * TAU + rng();
    const rad = 2.0 + rng() * (rx * 0.38);
    const y = -2.0 - rng() * (undersideDepth * 0.45);
    const height = 1.2 + rng() * 2.4;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.25 + rng() * 0.5, height, 6), materials.rockDark);
    spike.rotation.z = Math.PI;
    spike.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad * 0.8);
    spike.castShadow = true;
    group.add(spike);
  }

  // Boulder clusters and moss on the rim.
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < (options.boulders ?? 18); i++) {
    const a = rng() * TAU;
    const r = rim[Math.floor(((a / TAU) * segments)) % segments];
    const s = 0.25 + rng() * 0.9;
    const rock = new THREE.Mesh(rockGeo, rng() > 0.4 ? materials.rockDark : materials.rock);
    rock.position.set(r.x * (0.91 + rng() * 0.13), r.y - 0.2 - rng() * 1.4, r.z * (0.91 + rng() * 0.13));
    rock.scale.set(s * (0.7 + rng() * 0.8), s * (0.55 + rng() * 0.7), s * (0.8 + rng() * 0.7));
    rock.rotation.set(rng() * 2, rng() * TAU, rng() * 2);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
    if (rng() > 0.48) {
      const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.46, 0), materials.leafJade);
      moss.scale.y = 0.35;
      moss.position.copy(rock.position).y += s * 0.45;
      moss.rotation.y = rng() * TAU;
      group.add(moss);
    }
  }

  // Narrow rock shelves interrupt the long cliff faces.
  const ledgeGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < (options.ledges ?? 9); i++) {
    const ri = Math.floor(rng() * segments);
    const r = rim[ri];
    const t = 0.18 + rng() * 0.42;
    const factor = 1 - t * 0.56;
    const ledge = new THREE.Mesh(ledgeGeo, rng() > 0.4 ? materials.rock : materials.rockDark);
    ledge.position.set(r.x * factor * (0.98 + rng() * 0.1), r.y - undersideDepth * t, r.z * factor * (0.98 + rng() * 0.1));
    ledge.scale.set(0.55 + rng() * 1.2, 0.16 + rng() * 0.22, 0.4 + rng() * 0.85);
    ledge.rotation.set(rng() * 0.5, rng() * TAU, (rng() - 0.5) * 0.5);
    ledge.castShadow = true;
    ledge.receiveShadow = true;
    group.add(ledge);
  }

  // Small crystal seams glow faintly on the underside after dark.
  for (let i = 0; i < (options.crystals ?? 4); i++) {
    const ri = Math.floor(rng() * segments);
    const r = rim[ri];
    const drop = 1.0 + rng() * Math.min(3.2, undersideDepth * 0.42);
    const factor = 1 - drop / undersideDepth * 0.5;
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 + rng() * 0.16, 0), materials.crystalMaterial);
    crystal.position.set(r.x * factor * 1.01, r.y - drop, r.z * factor * 1.01);
    crystal.scale.set(0.7, 1.8 + rng() * 1.2, 0.7);
    crystal.rotation.set(rng() * 0.8, rng() * TAU, rng() * 0.8);
    group.add(crystal);
    const glow = new THREE.Sprite(materials.seamGlow);
    glow.position.copy(crystal.position);
    glow.scale.setScalar(0.62 + rng() * 0.4);
    group.add(glow);
  }

  // A few vines trail from the grass lip.
  for (let i = 0; i < (options.vines ?? 14); i++) {
    const r = rim[Math.floor(rng() * segments)];
    const len = 0.7 + rng() * 2.5;
    const pts = [];
    for (let k = 0; k < 4; k++) {
      const t = k / 3;
      pts.push(new THREE.Vector3(
        r.x * (1.01 - 0.04 * t) + Math.sin(r.a * 5 + i) * 0.12 * t,
        r.y - t * len,
        r.z * (1.01 - 0.04 * t) + Math.cos(r.a * 3 + i) * 0.12 * t
      ));
    }
    const vine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.018, 4, false), materials.leafDeep);
    group.add(vine);
    for (let k = 0; k < 4; k++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06 + rng() * 0.08, 0), materials.leafJade);
      leaf.position.copy(pts[1 + Math.floor(rng() * 3)]);
      leaf.position.x += (rng() - 0.5) * 0.18;
      leaf.position.z += (rng() - 0.5) * 0.18;
      group.add(leaf);
    }
  }

  return {
    group,
    topMesh,
    underMesh,
    heightAtLocal,
    heightAtWorld,
    rim,
    radiusX: rx,
    radiusZ: rz,
    options
  };
}
