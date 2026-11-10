import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  clamp,
  lerp,
  smoothstep,
  addMesh,
  addBox,
  addCylinder,
  groupAt,
  setShadows,
  canvasTexture,
  mulberry32
} from '../utils.js';
import { createWaterMaterial, createRiverRibbon, createWaterfallPlane } from '../water.js';

const SIZE_X = 35.45;
const SIZE_Z = 27.05;
const SEA_LEVEL = 0.34;

function roundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  shape.closePath();
  return shape;
}

function roundedRectPath(width, height, radius) {
  const path = new THREE.Path();
  const x = -width / 2;
  const y = -height / 2;
  path.moveTo(x + radius, y);
  path.lineTo(x + width - radius, y);
  path.quadraticCurveTo(x + width, y, x + width, y + radius);
  path.lineTo(x + width, y + height - radius);
  path.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  path.lineTo(x + radius, y + height);
  path.quadraticCurveTo(x, y + height, x, y + height - radius);
  path.lineTo(x, y + radius);
  path.quadraticCurveTo(x, y, x + radius, y);
  path.closePath();
  return path;
}

function ellipseRingGeometry(rx, rz, inner = 0.96, segments = 96, y = 0) {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(a) * rx, y, Math.sin(a) * rz);
    positions.push(Math.cos(a) * rx * inner, y, Math.sin(a) * rz * inner);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makePathMesh(points, width, lift, material, uvScale, heightAt, segments = 100) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], 0, p[1])), false, 'catmullrom', 0.3);
  const vertices = [];
  const uvs = [];
  const indices = [];
  let distance = 0;
  let last = null;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    tangent.y = 0;
    tangent.normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const left = p.clone().addScaledVector(side, width * 0.5);
    const right = p.clone().addScaledVector(side, -width * 0.5);
    left.y = heightAt(left.x, left.z) + lift;
    right.y = heightAt(right.x, right.z) + lift;
    if (last) distance += p.distanceTo(last);
    last = p.clone();
    vertices.push(left.x, left.y, left.z, right.x, right.y, right.z);
    uvs.push(0, distance * uvScale, 1, distance * uvScale);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.renderOrder = 1;
  return { mesh, curve };
}

function makeShadowTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(8,10,9,0.36)');
    grad.addColorStop(0.5, 'rgba(8,10,9,0.2)');
    grad.addColorStop(0.8, 'rgba(8,10,9,0.05)');
    grad.addColorStop(1, 'rgba(8,10,9,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}

export function createTerrain(materials) {
  const group = new THREE.Group();
  group.name = 'terrain';
  const rng = mulberry32(0x9a71c2);
  const palette = {
    grassLow: new THREE.Color('#819b61'),
    grassHigh: new THREE.Color('#a7b67a'),
    grassGold: new THREE.Color('#a4a267'),
    sand: new THREE.Color('#c0aa7d'),
    wetSand: new THREE.Color('#8f7e5d'),
    rock: new THREE.Color('#888170'),
    mud: new THREE.Color('#665c4a')
  };

  const coastAt = (x) => 7.2 + Math.sin(x * 0.29 + 0.35) * 0.5 - 2.1 * Math.exp(-Math.pow((x - 10.2) / 4.5, 2));

  const riverPoints = [
    [-3.9, 0.98, -3.0],
    [-3.4, 0.95, -1.5],
    [-2.7, 0.9, 0.2],
    [-1.9, 0.86, 1.5],
    [-0.7, 0.8, 2.7],
    [0.8, 0.72, 3.6],
    [2.4, 0.64, 4.4],
    [3.9, 0.55, 5.5],
    [4.8, 0.45, 6.2],
    [5.8, 0.35, 6.9]
  ];
  const riverCurve = new THREE.CatmullRomCurve3(riverPoints.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.35);
  const riverSamples = riverCurve.getSpacedPoints(150).map((p) => new THREE.Vector3(p.x, p.y, p.z));

  const flatSpots = [
    { x: -4.3, z: 2.0, rx: 5.15, rz: 4.15, y: 1.06, blend: 1.36 },
    { x: 6.15, z: 2.8, rx: 3.25, rz: 3.0, y: 1.06, blend: 1.25 },
    { x: 11.1, z: 4.15, rx: 2.25, rz: 1.45, y: 0.57, blend: 0.85 },
    { x: 9.6, z: -5.7, rx: 2.15, rz: 2.05, y: 3.12, blend: 1.1 },
    { x: -11.45, z: -4.8, rx: 2.4, rz: 2.3, y: 5.02, blend: 1.15 }
  ];

  function naturalHeight(x, z) {
    const hillA = 4.55 * Math.exp(-(Math.pow((x + 9.4) / 5.2, 2) + Math.pow((z + 4.2) / 4.7, 2)));
    const hillB = 2.2 * Math.exp(-(Math.pow((x - 9.7) / 5.35, 2) + Math.pow((z + 6.3) / 3.7, 2)));
    const ridge = 0.92 * Math.exp(-(Math.pow((x - 0.5) / 10.5, 2) + Math.pow((z + 10.6) / 3.1, 2)));
    const leftRise = 0.62 * Math.exp(-(Math.pow((x + 13.1) / 4.0, 2) + Math.pow((z - 2.2) / 4.6, 2)));
    let h = 0.48 + hillA + hillB + ridge + leftRise;
    h += 0.075 * Math.sin(x * 0.7 + z * 0.5) * Math.cos(z * 0.6 - 0.4);
    h += 0.028 * Math.sin(x * 2.1 + z * 1.35);
    return h;
  }

  function nearestRiver(x, z) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < riverSamples.length; i++) {
      const p = riverSamples[i];
      const dx = x - p.x;
      const dz = z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return { point: best, distance: Math.sqrt(bestD) };
  }

  function heightAt(x, z) {
    let h = naturalHeight(x, z);
    for (const spot of flatSpots) {
      const dx = (x - spot.x) / spot.rx;
      const dz = (z - spot.z) / spot.rz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 1.9) {
        const mask = 1 - smoothstep(0.58, 1.22, d);
        h = lerp(h, spot.y, mask);
      }
    }
    const coast = coastAt(x);
    const seaD = z - coast;
    if (seaD > -1.0) {
      const seaMask = smoothstep(-0.68, 2.05, seaD);
      const floor = -1.05 + 0.08 * Math.sin(x * 0.8) + 0.04 * Math.cos(z * 1.4);
      h = lerp(h, floor, seaMask);
    }
    const river = nearestRiver(x, z);
    if (river.distance < 1.7) {
      const waterY = river.point.y;
      const bed = waterY - 0.24;
      const bank = waterY - 0.02 + Math.max(0, river.distance - 0.42) * 0.42;
      const blend = 1 - smoothstep(0.8, 1.7, river.distance);
      h = lerp(h, Math.min(h, bank, bed + Math.max(0, river.distance - 0.36) * 0.32), blend);
    }
    return h;
  }

  // A wooden display plinth and raised frame keep the miniature world contained.
  const plinthMat = new THREE.MeshStandardMaterial({ color: '#38281f', roughness: 0.62, metalness: 0.08 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#694932', roughness: 0.66, metalness: 0.035 });
  const frameEdgeMat = new THREE.MeshStandardMaterial({ color: '#3a281f', roughness: 0.72, metalness: 0.025 });
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(39.8, 1.55, 31.2, 4, 0.55), plinthMat);
  plinth.position.set(0, -1.7, 0);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const lowerTrim = new THREE.Mesh(new RoundedBoxGeometry(40.5, 0.36, 31.9, 3, 0.35), frameEdgeMat);
  lowerTrim.position.set(0, -2.42, 0);
  lowerTrim.castShadow = true;
  lowerTrim.receiveShadow = true;
  group.add(lowerTrim);

  const footGeo = new RoundedBoxGeometry(3.1, 0.42, 2.3, 3, 0.18);
  const footPositions = [[-16.2, 13.1], [16.2, 13.1], [-16.2, -13.1], [16.2, -13.1]];
  footPositions.forEach(([x, z]) => {
    const foot = new THREE.Mesh(footGeo, frameEdgeMat);
    foot.position.set(x, -2.75, z);
    foot.castShadow = true;
    foot.receiveShadow = true;
    group.add(foot);
  });

  const frameOuter = roundedRectShape(38.25, 29.8, 1.06);
  frameOuter.holes.push(roundedRectPath(35.45, 27.05, 0.48));
  const frameGeo = new THREE.ExtrudeGeometry(frameOuter, {
    depth: 1.28,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.1,
    bevelThickness: 0.075,
    curveSegments: 14
  });
  const frame = new THREE.Mesh(frameGeo, [frameMat, frameEdgeMat]);
  frame.rotation.x = -Math.PI / 2;
  frame.position.y = -0.73;
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const inlayPoints = [];
  const inlayW = 36.9;
  const inlayD = 28.45;
  const ir = 0.58;
  const corners = [
    [inlayW / 2 - ir, inlayD / 2 - ir],
    [-inlayW / 2 + ir, inlayD / 2 - ir],
    [-inlayW / 2 + ir, -inlayD / 2 + ir],
    [inlayW / 2 - ir, -inlayD / 2 + ir]
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const steps = 18;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      inlayPoints.push(new THREE.Vector3(lerp(a[0], b[0], t), 0.585, lerp(a[1], b[1], t)));
    }
  }
  const inlayCurve = new THREE.CatmullRomCurve3(inlayPoints, true);
  const inlay = new THREE.Mesh(new THREE.TubeGeometry(inlayCurve, 160, 0.055, 5, true), materials.brass);
  inlay.castShadow = false;
  group.add(inlay);
  const outerInlayPoints = [];
  const outerCorners = [[18.1, 14.1], [-18.1, 14.1], [-18.1, -14.1], [18.1, -14.1]];
  for (let i = 0; i < 4; i++) {
    const a = outerCorners[i];
    const b = outerCorners[(i + 1) % 4];
    for (let s = 0; s < 16; s++) {
      const t = s / 16;
      outerInlayPoints.push(new THREE.Vector3(lerp(a[0], b[0], t), 0.59, lerp(a[1], b[1], t)));
    }
  }
  const outerInlayCurve = new THREE.CatmullRomCurve3(outerInlayPoints, true);
  const outerInlay = new THREE.Mesh(new THREE.TubeGeometry(outerInlayCurve, 170, 0.028, 4, true), materials.brass);
  outerInlay.castShadow = false;
  group.add(outerInlay);
  const rivetGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.035, 10);
  for (const [x, z] of [[18.1, 7.1], [-18.1, 7.1], [18.1, -7.1], [-18.1, -7.1], [9.2, 14.1], [-9.2, 14.1]]) {
    const rivet = new THREE.Mesh(rivetGeo, materials.brass);
    rivet.position.set(x, 0.59, z);
    rivet.castShadow = false;
    group.add(rivet);
  }

  const plaqueCanvas = materials.textures.plaque;
  const plaqueBack = new THREE.Mesh(new RoundedBoxGeometry(5.55, 1.16, 0.18, 3, 0.06), materials.brass);
  plaqueBack.position.set(0, -0.06, 14.94);
  plaqueBack.castShadow = true;
  plaqueBack.receiveShadow = true;
  group.add(plaqueBack);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(5.22, 1.02), new THREE.MeshStandardMaterial({
    map: plaqueCanvas,
    roughness: 0.42,
    metalness: 0.22,
    emissive: '#3d2c16',
    emissiveIntensity: 0.22
  }));
  plaque.position.set(0, -0.06, 15.04);
  group.add(plaque);

  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 39),
    new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false, opacity: 0.7 })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -2.9;
  group.add(contact);

  // Sculpted grassy island with coastal falloff and carved river channel.
  const segmentsX = 168;
  const segmentsZ = 128;
  const heights = new Float32Array((segmentsX + 1) * (segmentsZ + 1));
  const positions = [];
  const uvs = [];
  const indices = [];
  const dx = SIZE_X / segmentsX;
  const dz = SIZE_Z / segmentsZ;
  for (let iz = 0; iz <= segmentsZ; iz++) {
    const z = -SIZE_Z / 2 + (iz / segmentsZ) * SIZE_Z;
    for (let ix = 0; ix <= segmentsX; ix++) {
      const x = -SIZE_X / 2 + (ix / segmentsX) * SIZE_X;
      const y = heightAt(x, z);
      heights[iz * (segmentsX + 1) + ix] = y;
      positions.push(x, y, z);
      uvs.push(ix / segmentsX, iz / segmentsZ);
    }
  }
  for (let iz = 0; iz < segmentsZ; iz++) {
    for (let ix = 0; ix < segmentsX; ix++) {
      const a = iz * (segmentsX + 1) + ix;
      const b = a + 1;
      const c = a + segmentsX + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const colors = new Float32Array(heights.length * 3);
  const tempColor = new THREE.Color();
  for (let iz = 0; iz <= segmentsZ; iz++) {
    const z = -SIZE_Z / 2 + (iz / segmentsZ) * SIZE_Z;
    for (let ix = 0; ix <= segmentsX; ix++) {
      const x = -SIZE_X / 2 + (ix / segmentsX) * SIZE_X;
      const index = iz * (segmentsX + 1) + ix;
      const h = heights[index];
      const hL = heights[iz * (segmentsX + 1) + Math.max(0, ix - 1)];
      const hR = heights[iz * (segmentsX + 1) + Math.min(segmentsX, ix + 1)];
      const hU = heights[Math.max(0, iz - 1) * (segmentsX + 1) + ix];
      const hD = heights[Math.min(segmentsZ, iz + 1) * (segmentsX + 1) + ix];
      const slope = (Math.abs(hR - hL) / (2 * dx) + Math.abs(hD - hU) / (2 * dz)) * 0.62;
      const roll = Math.sin(x * 1.37 + z * 0.87) * 0.5 + Math.sin(x * 0.42 - z * 1.71) * 0.5;
      const alt = clamp((h - 0.45) / 4.8, 0, 1);
      tempColor.copy(palette.grassLow).lerp(palette.grassHigh, alt * 0.72);
      tempColor.lerp(palette.grassGold, smoothstep(0.25, 0.9, roll) * 0.15);
      tempColor.offsetHSL(0, 0, roll * 0.018);
      const sandMix = (1 - smoothstep(0.38, 0.84, h)) * 0.94;
      tempColor.lerp(palette.sand, clamp(sandMix, 0, 1));
      tempColor.lerp(palette.wetSand, (1 - smoothstep(-0.1, 0.38, h)) * 0.5);
      tempColor.lerp(palette.mud, (1 - smoothstep(-0.55, 0.08, h)) * 0.55);
      const rockMix = smoothstep(0.28, 0.96, slope) * (0.35 + 0.45 * smoothstep(0.7, 2.2, h));
      tempColor.lerp(palette.rock, clamp(rockMix, 0, 0.7));
      colors[index * 3] = tempColor.r;
      colors[index * 3 + 1] = tempColor.g;
      colors[index * 3 + 2] = tempColor.b;
    }
  }

  const terrainGeometry = new THREE.BufferGeometry();
  terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  terrainGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  terrainGeometry.setIndex(indices);
  terrainGeometry.computeVertexNormals();
  const terrainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: materials.textures.grass,
    roughness: 0.97,
    metalness: 0
  });
  const land = new THREE.Mesh(terrainGeometry, terrainMaterial);
  land.receiveShadow = true;
  land.castShadow = false;
  group.add(land);

  // Sea and river both use the same animated shader family.
  const seaMaterial = createWaterMaterial({
    deep: '#1f5b68',
    shallow: '#55a196',
    sky: '#9ac3be',
    opacity: 0.9,
    waveScale: 1
  });
  const seaGeometry = new THREE.PlaneGeometry(SIZE_X + 0.2, SIZE_Z + 0.2, 110, 92);
  seaGeometry.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeometry, seaMaterial);
  sea.position.y = SEA_LEVEL;
  sea.renderOrder = 2;
  sea.receiveShadow = false;
  sea.castShadow = false;
  group.add(sea);

  // Lace-like foam traces the shoreline without hiding the animated water.
  const foamMaterials = [];
  function addFoamBand(offset, width, opacity, vRepeat) {
    const verts = [];
    const uvs = [];
    const idx = [];
    const steps = 150;
    for (let i = 0; i <= steps; i++) {
      const x = -17.4 + (i / steps) * 34.8;
      const coast = coastAt(x);
      const y = SEA_LEVEL + 0.032;
      verts.push(x, y, coast + offset, x, y, coast + offset + width);
      uvs.push((i / steps) * vRepeat, 0, (i / steps) * vRepeat, 1);
      if (i < steps) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({
      map: materials.textures.foam,
      color: '#effbf7',
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 4;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    foamMaterials.push({ material: mat, base: opacity });
  }
  addFoamBand(0.02, 0.36, 0.47, 8);
  addFoamBand(0.72, 0.2, 0.2, 5.5);


  const riverMaterial = createWaterMaterial({
    deep: '#2a6b6a',
    shallow: '#6cb5a7',
    sky: '#b9d8ce',
    opacity: 0.82,
    waveScale: 0.55
  });
  const river = createRiverRibbon(riverPoints, 1.18, riverMaterial, { segments: 96, vRepeat: 4 });
  river.mesh.receiveShadow = true;
  group.add(river.mesh);

  // Riverbank pebbles and broken stone edging.
  const bankStoneGeo = new THREE.DodecahedronGeometry(0.24, 0);
  for (let i = 0; i < 58; i++) {
    const t = 0.02 + rng() * 0.96;
    const point = riverCurve.getPointAt(t);
    const tangent = riverCurve.getTangentAt(t);
    tangent.y = 0;
    tangent.normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const s = rng() > 0.5 ? 1 : -1;
    const width = 0.56 + rng() * 0.22;
    const pos = point.clone().addScaledVector(side, s * width);
    const rock = new THREE.Mesh(bankStoneGeo, rng() > 0.25 ? materials.stoneDark : materials.stone);
    rock.position.set(pos.x, heightAt(pos.x, pos.z) + 0.05, pos.z);
    rock.scale.set(0.7 + rng() * 0.8, 0.5 + rng() * 0.5, 0.7 + rng() * 0.6);
    rock.rotation.set(rng() * 0.7, rng() * Math.PI, rng() * 0.5);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  // Waterfall and a small mossy spring at the edge of the upper slope.
  const waterfallGroup = new THREE.Group();
  waterfallGroup.position.set(-4.15, 0, -3.32);
  group.add(waterfallGroup);
  const sourceY = Math.max(1.55, heightAt(-4.2, -4.0) + 0.05);
  const fallBottom = 0.88;
  const fallHeight = Math.max(1.0, sourceY - fallBottom);
  const fallMat = new THREE.MeshBasicMaterial({
    map: materials.textures.waterFall,
    transparent: true,
    opacity: 0.86,
    side: THREE.DoubleSide,
    depthWrite: false,
    color: '#cfeee9',
    toneMapped: false
  });
  const fall = createWaterfallPlane(1.12, fallHeight, fallMat);
  fall.position.set(0, fallBottom + fallHeight / 2, 0.28);
  waterfallGroup.add(fall);
  const foamMat = new THREE.SpriteMaterial({
    map: materials.textures.smoke,
    color: '#effffb',
    transparent: true,
    opacity: 0.25,
    depthWrite: false
  });
  const mistSprites = [];
  for (let i = 0; i < 5; i++) {
    const mist = new THREE.Sprite(foamMat.clone());
    mist.position.set((rng() - 0.5) * 1.5, fallBottom + 0.1 + rng() * 0.25, 0.44 + rng() * 0.35);
    mist.scale.setScalar(0.65 + rng() * 0.6);
    mist.material.opacity = 0.12 + rng() * 0.12;
    waterfallGroup.add(mist);
    mistSprites.push({ sprite: mist, phase: rng() * 10 });
  }
  const poolMat = new THREE.MeshPhysicalMaterial({
    color: '#68ada6',
    transparent: true,
    opacity: 0.82,
    roughness: 0.18,
    metalness: 0.02,
    clearcoat: 0.8
  });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.95, 28), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(-0.05, sourceY - 0.02, -0.62);
  waterfallGroup.add(pool);
  const springRocks = [];
  for (let i = 0; i < 13; i++) {
    const rockGeo = new THREE.DodecahedronGeometry(0.34 + rng() * 0.35, 0);
    const rock = new THREE.Mesh(rockGeo, i % 3 === 0 ? materials.stone : materials.stoneDark);
    const a = rng() * Math.PI * 2;
    const r = 0.7 + rng() * 0.95;
    rock.position.set(Math.cos(a) * r, sourceY - 0.2 + rng() * 0.2, -0.55 + Math.sin(a) * r * 0.55);
    rock.scale.set(0.8 + rng() * 0.7, 0.55 + rng() * 0.6, 0.65 + rng() * 0.8);
    rock.rotation.set(rng() * 2, rng() * 3, rng() * 2);
    rock.castShadow = true;
    rock.receiveShadow = true;
    waterfallGroup.add(rock);
    springRocks.push(rock);
  }

  // Main plaza: cobbled ellipse, darker curb, inlaid rings.
  const plazaCenter = { x: -4.25, z: 2.02, rx: 4.5, rz: 3.5 };
  const plazaY = heightAt(plazaCenter.x, plazaCenter.z) + 0.045;
  const plazaGeo = new THREE.CircleGeometry(1, 80);
  plazaGeo.rotateX(-Math.PI / 2);
  const plaza = new THREE.Mesh(plazaGeo, materials.cobble);
  plaza.scale.set(plazaCenter.rx, 1, plazaCenter.rz);
  plaza.position.set(plazaCenter.x, plazaY, plazaCenter.z);
  plaza.receiveShadow = true;
  plaza.castShadow = false;
  group.add(plaza);
  const plazaCurb = new THREE.Mesh(ellipseRingGeometry(plazaCenter.rx, plazaCenter.rz, 0.955, 96, 0), materials.stoneDark);
  plazaCurb.position.set(plazaCenter.x, plazaY + 0.018, plazaCenter.z);
  plazaCurb.receiveShadow = true;
  group.add(plazaCurb);
  const plazaInner = new THREE.Mesh(ellipseRingGeometry(1.55, 1.2, 0.87, 64, 0), materials.stoneLight);
  plazaInner.position.set(-3.55, plazaY + 0.025, 2.72);
  plazaInner.receiveShadow = true;
  group.add(plazaInner);

  // The paths are ribbons draped over the sculpted terrain.
  const pathMaterial = materials.cobble.clone();
  pathMaterial.map = materials.textures.cobble.clone();
  pathMaterial.map.repeat.set(1, 1);
  pathMaterial.map.needsUpdate = true;
  pathMaterial.color = new THREE.Color('#c6aa85');
  pathMaterial.roughness = 0.93;
  const borderMaterial = materials.stoneDark.clone();
  borderMaterial.color = new THREE.Color('#706c5e');
  const pathSets = [
    { points: [[-12.8, 7.6], [-11.0, 6.7], [-9.2, 6.0], [-7.4, 5.4], [-5.7, 5.0], [-4.0, 4.6], [-2.8, 4.2], [-1.35, 3.9]], width: 2.05, uv: 0.20 },
    { points: [[3.35, 3.9], [5.0, 4.15], [6.7, 4.2], [8.2, 4.1], [9.7, 3.9], [11.2, 3.7]], width: 2.05, uv: 0.20 },
    { points: [[-1.35, 3.9], [-2.25, 3.35], [-3.15, 2.95], [-4.2, 3.0]], width: 1.35, uv: 0.22 },
    { points: [[-7.5, 5.3], [-9.1, 4.85], [-10.7, 3.9], [-12.05, 2.55], [-12.35, 1.05], [-11.4, -0.45], [-10.2, -1.45], [-10.35, -2.8], [-10.85, -3.85]], width: 1.42, uv: 0.26 },
    { points: [[7.4, 4.25], [7.9, 2.6], [8.35, 0.7], [8.4, -1.2], [8.65, -3.2], [9.35, -4.75]], width: 1.2, uv: 0.28 },
    { points: [[11.15, 3.75], [12.5, 4.25], [13.5, 5.05], [13.75, 5.85]], width: 1.35, uv: 0.25 },
    { points: [[3.45, 3.95], [4.15, 2.5], [4.8, 1.0], [4.7, -0.8], [3.75, -2.2], [3.0, -3.25]], width: 1.1, uv: 0.28 },
    { points: [[8.65, -3.2], [9.8, -3.55], [11.2, -3.8], [12.55, -3.9]], width: 0.9, uv: 0.3 }
  ];
  pathSets.forEach((path) => {
    const under = makePathMesh(path.points, path.width + 0.3, 0.045, borderMaterial, path.uv, heightAt, 110);
    under.mesh.renderOrder = 1;
    group.add(under.mesh);
    const over = makePathMesh(path.points, path.width, 0.075, pathMaterial, path.uv, heightAt, 110);
    over.mesh.renderOrder = 2;
    group.add(over.mesh);
  });

  // A small plaza-to-harbour stair flight adds a deliberate level change.
  function addStairs(start, end, width, count, mat) {
    const dir = new THREE.Vector2(end[0] - start[0], end[1] - start[1]);
    const len = dir.length();
    dir.normalize();
    const angle = Math.atan2(dir.x, dir.y);
    const startY = heightAt(start[0], start[1]) + 0.08;
    const endY = heightAt(end[0], end[1]) + 0.08;
    const stairs = new THREE.Group();
    stairs.position.set(start[0], 0, start[1]);
    stairs.rotation.y = angle;
    const run = len / count;
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / count;
      const stepH = (endY - startY) * t;
      const step = new THREE.Mesh(new RoundedBoxGeometry(width, 0.16, run * 1.03, 2, 0.025), mat);
      step.position.set(0, startY + (startY < endY ? stepH : stepH), i * run + run / 2);
      step.castShadow = true;
      step.receiveShadow = true;
      stairs.add(step);
    }
    group.add(stairs);
    return stairs;
  }
  addStairs([-7.78, 4.6], [-9.36, 5.55], 1.0, 7, materials.stoneLight);
  addStairs([8.72, 3.98], [9.75, 4.42], 1.05, 6, materials.stoneLight);

  // Stone bridge with a real arched opening, parapets and lantern posts.
  function addBridge(cx, cz, riverY) {
    const bridge = new THREE.Group();
    bridge.position.set(cx, 0, cz);
    const halfSpan = 2.35;
    const wallHeight = 0.39;
    const archRadius = 0.76;
    const profile = new THREE.Shape();
    profile.moveTo(-halfSpan, 0);
    profile.lineTo(-halfSpan, wallHeight);
    profile.lineTo(halfSpan, wallHeight);
    profile.lineTo(halfSpan, 0);
    profile.lineTo(archRadius, 0);
    profile.absarc(0, 0, archRadius, 0, Math.PI, false);
    profile.lineTo(-halfSpan, 0);
    profile.closePath();
    const wallGeo = new THREE.ExtrudeGeometry(profile, {
      depth: 0.18,
      bevelEnabled: true,
      bevelSize: 0.018,
      bevelThickness: 0.018,
      bevelSegments: 1,
      steps: 1,
      curveSegments: 20
    });
    const wallY = riverY - 0.1;
    const front = new THREE.Mesh(wallGeo, materials.stone);
    front.position.set(0, wallY, 0.94);
    front.castShadow = true;
    front.receiveShadow = true;
    bridge.add(front);
    const back = front.clone();
    back.position.z = -1.12;
    bridge.add(back);
    const deck = new THREE.Mesh(new RoundedBoxGeometry(4.95, 0.16, 2.16, 3, 0.07), materials.stoneLight);
    deck.position.set(0, wallY + wallHeight + 0.06, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    bridge.add(deck);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(4.55, 1.5), pathMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, wallY + wallHeight + 0.145, 0);
    road.receiveShadow = true;
    bridge.add(road);
    const parapetGeo = new RoundedBoxGeometry(4.8, 0.26, 0.16, 3, 0.05);
    for (const z of [-0.93, 0.93]) {
      const parapet = new THREE.Mesh(parapetGeo, materials.stone);
      parapet.position.set(0, wallY + wallHeight + 0.25, z);
      parapet.castShadow = true;
      parapet.receiveShadow = true;
      bridge.add(parapet);
    }
    const postGeo = new RoundedBoxGeometry(0.28, 0.52, 0.28, 2, 0.04);
    for (const x of [-2.25, 2.25]) {
      for (const z of [-0.88, 0.88]) {
        const post = new THREE.Mesh(postGeo, materials.stoneLight);
        post.position.set(x, wallY + wallHeight + 0.38, z);
        post.castShadow = true;
        bridge.add(post);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), materials.lampMaterial);
        lamp.position.set(x, wallY + wallHeight + 0.68, z);
        bridge.add(lamp);
        const glow = new THREE.Sprite(materials.glowMaterial);
        glow.position.copy(lamp.position);
        glow.scale.setScalar(0.85);
        bridge.add(glow);
      }
    }
    group.add(bridge);
    return bridge;
  }
  const bridgeCenter = riverCurve.getPointAt(0.51);
  addBridge(1.05, 3.9, 0.7);

  // Waterfront quay: broad stone landing and a lip above the water.
  const quay = new THREE.Mesh(new RoundedBoxGeometry(5.1, 0.28, 2.3, 3, 0.1), materials.stoneLight);
  quay.position.set(10.9, 0.54, 4.32);
  quay.rotation.y = -0.12;
  quay.castShadow = true;
  quay.receiveShadow = true;
  group.add(quay);
  const quayEdge = new THREE.Mesh(new RoundedBoxGeometry(5.35, 0.19, 0.35, 2, 0.06), materials.stoneDark);
  quayEdge.position.set(10.9, 0.49, 5.42);
  quayEdge.rotation.y = -0.12;
  quayEdge.castShadow = true;
  group.add(quayEdge);

  // A few exposed boulders frame the coastline and the waterfall.
  const boulderGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 26; i++) {
    const x = -16 + rng() * 32;
    const coast = coastAt(x);
    const z = coast + 0.2 + rng() * 1.2;
    const y = heightAt(x, z);
    if (y > 0.58) continue;
    const rock = new THREE.Mesh(boulderGeo, rng() > 0.45 ? materials.stoneDark : materials.stone);
    rock.position.set(x, y + 0.16, z);
    rock.scale.set(0.35 + rng() * 0.8, 0.25 + rng() * 0.6, 0.35 + rng() * 0.75);
    rock.rotation.set(rng() * 1.3, rng() * Math.PI, rng() * 0.6);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  const updateHandles = {
    mistSprites,
    sourceY
  };

  function update(dt, elapsed, state) {
    seaMaterial.uniforms.uTime.value = elapsed;
    riverMaterial.uniforms.uTime.value = elapsed;
    const night = state.nightFactor || 0;
    const daylight = state.daylight ?? 1;
    for (const mat of [seaMaterial, riverMaterial]) {
      mat.uniforms.uSunDirection.value.copy(state.sunDirection);
      mat.uniforms.uSunIntensity.value = 0.16 + daylight * 1.15;
      const isSea = mat === seaMaterial;
      mat.uniforms.uDeep.value.copy(isSea ? new THREE.Color('#1f5b68') : new THREE.Color('#2a6b6a')).lerp(new THREE.Color('#071929'), night * 0.88);
      mat.uniforms.uShallow.value.copy(isSea ? new THREE.Color('#55a196') : new THREE.Color('#6cb5a7')).lerp(new THREE.Color('#183849'), night * 0.84);
      mat.uniforms.uSky.value.copy(state.horizonColor).lerp(new THREE.Color('#203354'), night * 0.72);
      mat.uniforms.uSunColor.value.copy(state.sunColor);
    }
    if (fallMat.map) {
      fallMat.map.offset.y -= dt * 0.6;
      if (fallMat.map.offset.y < -10) fallMat.map.offset.y += 10;
    }
    mistSprites.forEach((entry, i) => {
      const t = elapsed * 0.8 + entry.phase;
      entry.sprite.position.y = fallBottom + 0.15 + Math.sin(t) * 0.15;
      entry.sprite.position.x = Math.sin(t * 0.7 + i) * 0.45;
      entry.sprite.scale.setScalar(0.75 + Math.sin(t * 0.55 + i) * 0.22);
      entry.sprite.material.opacity = 0.1 + (Math.sin(t * 0.75 + i) * 0.5 + 0.5) * 0.13;
    });
    poolMat.opacity = 0.74 + night * 0.1;
    foamMaterials.forEach((entry, index) => {
      entry.material.opacity = entry.base * (0.72 + Math.sin(elapsed * 0.55 + index * 2.1) * 0.06) * (1 - night * 0.45);
      entry.material.color.set(daylight > 0.5 ? '#effbf7' : '#c0dade');
    });
  }

  return {
    group,
    heightAt,
    coastAt,
    riverCurve,
    plazaCenter,
    bridgeCenter,
    updateHandles,
    update,
    seaLevel: SEA_LEVEL
  };
}
