import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  addMesh,
  addBox,
  addCylinder,
  addSphere,
  addWire,
  lineBetween,
  clamp,
  lerp,
  mulberry32,
  canvasTexture,
  TAU
} from '../utils.js';
import { createMarketStall } from './buildings.js';

function addGlow(parent, lib, x, y, z, scale) {
  const s = new THREE.Sprite(lib.glowMaterial);
  s.position.set(x, y, z);
  s.scale.setScalar(scale);
  parent.add(s);
  return s;
}

function createLamp(lib, height = 2.1, style = 'iron') {
  const group = new THREE.Group();
  addBox(group, 0.42, 0.16, 0.42, lib.stoneDark, 0, 0.08, 0, 0.03);
  addCylinder(group, 0.06, 0.085, height, 7, lib.blackIron, 0, height / 2 + 0.12, 0);
  addCylinder(group, 0.14, 0.18, 0.16, 8, lib.blackIron, 0, height + 0.06, 0);
  const lantern = new THREE.Group();
  lantern.position.y = height + 0.12;
  group.add(lantern);
  addBox(lantern, 0.37, 0.43, 0.37, lib.blackIron, 0, 0.24, 0, 0.02);
  const glass = addBox(lantern, 0.26, 0.32, 0.26, lib.lampMaterial, 0, 0.24, 0, 0.015);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.23, 4), lib.blackIron);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 0.55;
  roof.castShadow = true;
  lantern.add(roof);
  addSphere(lantern, 0.055, lib.brass, 0, 0.7, 0, 8, 6, false);
  addGlow(group, lib, 0, height + 0.36, 0.1, 1.3);
  if (style === 'stone') {
    addBox(group, 0.33, height * 0.45, 0.33, lib.stone, 0, height * 0.23, 0, 0.03);
  }
  group.userData.lightY = height + 0.36;
  return group;
}

function createBench(lib) {
  const group = new THREE.Group();
  addBox(group, 1.7, 0.1, 0.45, lib.woodMid, 0, 0.48, 0, 0.03);
  addBox(group, 1.7, 0.12, 0.12, lib.woodDark, 0, 0.82, -0.2, 0.02);
  addBox(group, 1.7, 0.08, 0.34, lib.woodMid, 0, 0.62, -0.2, 0.025);
  for (const x of [-0.68, 0.68]) {
    addBox(group, 0.1, 0.48, 0.1, lib.blackIron, x, 0.24, 0.14, 0.015);
    addBox(group, 0.1, 0.65, 0.08, lib.blackIron, x, 0.48, -0.19, 0.015);
    addBox(group, 0.35, 0.06, 0.08, lib.blackIron, x, 0.02, 0, 0.01);
  }
  return group;
}

function createTableSet(lib) {
  const group = new THREE.Group();
  addCylinder(group, 0.045, 0.06, 0.7, 6, lib.blackIron, 0, 0.35, 0);
  addCylinder(group, 0.48, 0.48, 0.06, 16, lib.woodLight, 0, 0.72, 0);
  addCylinder(group, 0.22, 0.22, 0.035, 16, lib.clothCream, 0, 0.76, 0);
  for (const a of [0.3, 2.5, 4.4]) {
    const chair = new THREE.Group();
    chair.position.set(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8);
    chair.rotation.y = -a + Math.PI;
    group.add(chair);
    addBox(chair, 0.32, 0.07, 0.32, lib.woodLight, 0, 0.44, 0, 0.025);
    addBox(chair, 0.3, 0.42, 0.06, lib.woodMid, 0, 0.66, -0.15, 0.02);
    for (const x of [-0.12, 0.12]) {
      for (const z of [-0.13, 0.13]) addBox(chair, 0.035, 0.42, 0.035, lib.blackIron, x, 0.22, z, 0.005);
    }
  }
  // parasol
  addCylinder(group, 0.022, 0.025, 2.2, 6, lib.woodDark, 0, 1.1, 0);
  const umbrella = new THREE.Mesh(new THREE.ConeGeometry(1.18, 0.38, 12, 1, true), lib.clothCream);
  umbrella.position.y = 2.02;
  umbrella.rotation.y = 0.3;
  umbrella.castShadow = true;
  umbrella.material.side = THREE.DoubleSide;
  group.add(umbrella);
  return group;
}

function createGazebo(lib) {
  const group = new THREE.Group();
  addCylinder(group, 1.55, 1.75, 0.2, 8, lib.stoneLight, 0, 0.1, 0);
  addCylinder(group, 1.35, 1.55, 0.13, 8, lib.stone, 0, 0.25, 0);
  addBox(group, 0.9, 0.12, 0.5, lib.stoneLight, 0, 0.16, 1.55, 0.04);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const x = Math.cos(a) * 1.34;
    const z = Math.sin(a) * 1.34;
    addCylinder(group, 0.065, 0.085, 1.65, 6, lib.woodDark, x, 1.13, z);
    addBox(group, 0.16, 0.1, 0.16, lib.stoneLight, x, 0.31, z, 0.02);
  }
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * TAU + Math.PI / 6;
    const a1 = ((i + 1) / 6) * TAU + Math.PI / 6;
    const x0 = Math.cos(a0) * 1.34;
    const z0 = Math.sin(a0) * 1.34;
    const x1 = Math.cos(a1) * 1.34;
    const z1 = Math.sin(a1) * 1.34;
    if (i !== 0) {
      const rail = addBox(group, Math.hypot(x1 - x0, z1 - z0), 0.07, 0.07, lib.woodDark, (x0 + x1) / 2, 1.0, (z0 + z1) / 2, 0.015);
      rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      const lower = addBox(group, Math.hypot(x1 - x0, z1 - z0), 0.045, 0.045, lib.woodDark, (x0 + x1) / 2, 0.56, (z0 + z1) / 2, 0.008);
      lower.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    }
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.12, 8), lib.roofs.teal);
  roof.position.y = 2.63;
  roof.rotation.y = Math.PI / 8;
  roof.castShadow = true;
  group.add(roof);
  addCylinder(group, 1.95, 1.95, 0.09, 8, lib.woodDark, 0, 2.09, 0);
  addSphere(group, 0.1, lib.brass, 0, 3.25, 0, 8, 6, false);
  addCylinder(group, 0.025, 0.03, 0.45, 5, lib.brass, 0, 3.45, 0);
  addBox(group, 0.9, 0.09, 0.35, lib.woodMid, 0, 0.62, -0.92, 0.02);
  addBox(group, 0.9, 0.35, 0.08, lib.woodMid, 0, 0.83, -1.08, 0.015);
  addCylinder(group, 0.018, 0.02, 0.16, 4, lib.blackIron, 0, 2.28, 0.85);
  addBox(group, 0.24, 0.28, 0.24, lib.lampMaterial, 0, 2.15, 0.85, 0.02);
  addGlow(group, lib, 0, 2.15, 1.0, 0.8);
  const telescope = new THREE.Group();
  telescope.position.set(-0.68, 0.32, 0.55);
  telescope.rotation.y = -0.7;
  group.add(telescope);
  addCylinder(telescope, 0.025, 0.035, 0.7, 5, lib.blackIron, -0.1, 0.35, 0);
  addCylinder(telescope, 0.025, 0.035, 0.7, 5, lib.blackIron, 0.1, 0.35, 0);
  addCylinder(telescope, 0.06, 0.08, 1.0, 8, lib.brass, 0, 0.96, 0).rotation.x = 1.08;
  addSphere(telescope, 0.07, lib.blackIron, 0, 1.34, 0.35, 7, 5, false);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), lib.leafMaterials[(i + 2) % 4]);
    flower.position.set(Math.cos(a) * 1.7, 0.36, Math.sin(a) * 1.7);
    group.add(flower);
  }
  return group;
}

function addBarrel(parent, lib, x, y, z, scale = 1) {
  const barrel = new THREE.Group();
  barrel.position.set(x, y, z);
  parent.add(barrel);
  addCylinder(barrel, 0.22 * scale, 0.25 * scale, 0.52 * scale, 10, lib.woodMid, 0, 0.26 * scale, 0);
  addCylinder(barrel, 0.235 * scale, 0.235 * scale, 0.035 * scale, 10, lib.blackIron, 0, 0.1 * scale, 0);
  addCylinder(barrel, 0.235 * scale, 0.235 * scale, 0.035 * scale, 10, lib.blackIron, 0, 0.42 * scale, 0);
  return barrel;
}

function createDock(lib, terrain) {
  const group = new THREE.Group();
  const x = 9.0;
  const z = 6.78;
  const deckY = 0.45;
  group.position.set(x, deckY, z);
  const length = 3.7;
  const width = 1.7;
  for (let i = 0; i < 10; i++) {
    const plank = addBox(group, width, 0.08, 0.31, i % 2 ? lib.woodMid : lib.woodLight, 0, 0, -length / 2 + i * (length / 10) + 0.1, 0.018);
    plank.rotation.y = (i % 3 - 1) * 0.006;
  }
  for (const sx of [-width / 2 + 0.12, width / 2 - 0.12]) {
    for (let i = 0; i < 4; i++) {
      const pz = -length / 2 + 0.25 + i * 1.05;
      const piling = addCylinder(group, 0.08, 0.1, 1.35, 7, lib.woodDark, sx, -0.7, pz);
      piling.castShadow = true;
    }
  }
  addBox(group, width + 0.1, 0.13, 0.16, lib.woodDark, 0, 0.06, length / 2 - 0.05, 0.02);
  // rail on one side
  for (const pz of [-1.45, -0.25, 0.95, 1.55]) {
    addBox(group, 0.07, 0.95, 0.07, lib.woodDark, -width / 2 + 0.08, 0.49, pz, 0.012);
  }
  addBox(group, 0.07, 0.07, 3.2, lib.woodDark, -width / 2 + 0.08, 0.94, 0.02, 0.012);
  addBox(group, 0.055, 0.055, 3.2, lib.woodDark, -width / 2 + 0.08, 0.55, 0.02, 0.01);
  addBox(group, 0.22, 0.75, 0.22, lib.stoneDark, width / 2 - 0.35, 0.37, -length / 2 + 0.36, 0.03);
  addBarrel(group, lib, 0.45, 0.05, 0.35, 0.9);
  addBarrel(group, lib, 0.56, 0.05, -0.1, 0.8);
  const crate = addBox(group, 0.6, 0.5, 0.6, lib.woodLight, -0.2, 0.3, 1.1, 0.03);
  const crate2 = addBox(group, 0.42, 0.38, 0.42, lib.woodMid, -0.28, 0.22, 0.47, 0.025);
  crate2.rotation.y = 0.4;
  const lamp = createLamp(lib, 1.35);
  lamp.position.set(width / 2 - 0.14, 0.08, length / 2 - 0.2);
  group.add(lamp);
  // rope coil
  const ropeMat = new THREE.MeshStandardMaterial({ color: '#b99d6c', roughness: 0.95 });
  for (let i = 0; i < 3; i++) {
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 5, 18), ropeMat);
    rope.rotation.x = Math.PI / 2;
    rope.position.set(-0.42, 0.11 + i * 0.04, 1.4);
    group.add(rope);
  }
  // little crane
  addBox(group, 0.13, 2.2, 0.13, lib.woodDark, 0.45, 1.25, -1.45, 0.02);
  const arm = addBox(group, 1.7, 0.12, 0.12, lib.woodDark, 1.18, 2.16, -1.45, 0.02);
  arm.rotation.z = -0.08;
  addCylinder(group, 0.02, 0.02, 1.4, 4, lib.blackIron, 1.87, 1.45, -1.45);
  addBox(group, 0.42, 0.42, 0.42, lib.woodLight, 1.87, 0.68, -1.45, 0.025);
  group.userData.lamp = lamp;
  return group;
}

function createHull(lib, length, width, depth) {
  const group = new THREE.Group();
  const top = 0.28;
  const sections = [
    { z: -length / 2, w: 0.08, d: 0.45 },
    { z: -length * 0.36, w: 0.72, d: 0.86 },
    { z: -length * 0.1, w: 1.0, d: 1.0 },
    { z: length * 0.28, w: 0.94, d: 0.92 },
    { z: length * 0.47, w: 0.56, d: 0.7 },
    { z: length / 2, w: 0.16, d: 0.38 }
  ];
  const profile = [-1, -0.78, -0.5, -0.2, 0.2, 0.5, 0.78, 1];
  const positions = [];
  const indices = [];
  const rimCurves = [[], []];
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const halfW = width * sec.w * 0.5;
    for (let j = 0; j < profile.length; j++) {
      const u = profile[j];
      const x = u * halfW;
      const y = top - depth * sec.d * (1 - u * u) * 0.92;
      positions.push(x, y, sec.z);
      if (j === 0 || j === profile.length - 1) rimCurves[j === 0 ? 0 : 1].push(new THREE.Vector3(x, top + 0.015, sec.z));
    }
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < profile.length - 1; j++) {
      const a = i * profile.length + j;
      const b = a + 1;
      const c = a + profile.length;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const hullMat = new THREE.MeshStandardMaterial({ color: '#654832', roughness: 0.68, side: THREE.DoubleSide });
  const hull = new THREE.Mesh(geometry, hullMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  // Inner boards and thwarts make the open boat read clearly from above.
  addBox(group, width * 0.54, 0.055, length * 0.58, lib.woodLight, 0, top - 0.11, 0, 0.035);
  addBox(group, width * 0.7, 0.07, 0.18, lib.woodLight, 0, top - 0.02, -length * 0.19, 0.025);
  addBox(group, width * 0.72, 0.07, 0.18, lib.woodLight, 0, top - 0.02, length * 0.2, 0.025);
  addBox(group, width * 0.54, 0.05, 0.2, lib.woodPale, 0, top + 0.01, -length * 0.43, 0.03);

  // Wale rails trace the hull rim.
  rimCurves.forEach((pts, index) => {
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.035, 5, false);
    const rail = new THREE.Mesh(geo, lib.woodDark);
    rail.castShadow = true;
    group.add(rail);
    const stripe = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => p.clone().setY(p.y - 0.09))), 24, 0.014, 4, false), lib.brass);
    group.add(stripe);
  });
  const bell = addSphere(group, 0.045, lib.brass, 0, top + 0.13, -length * 0.42, 7, 5, false);
  return group;
}

function makeSailTexture(lib, colorA, colorB) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = colorA;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(101,76,47,0.28)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i / 6) * c.height);
    ctx.lineTo(c.width, (i / 6) * c.height);
    ctx.stroke();
  }
  ctx.fillStyle = colorB;
  ctx.fillRect(0, c.height * 0.8, c.width, c.height * 0.09);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSailboat(lib, seed = 1) {
  const boat = createHull(lib, 2.7, 1.16, 0.54);
  addCylinder(boat, 0.045, 0.065, 2.75, 6, lib.woodDark, 0, 1.55, 0.16);
  const sailTex = makeSailTexture(lib, '#f0e4ca', '#b8614c');
  const sailMat = new THREE.MeshStandardMaterial({ map: sailTex, roughness: 0.9, side: THREE.DoubleSide });
  const sailGeo = new THREE.BufferGeometry();
  const sailVerts = new Float32Array([0, 0.66, 0.2, 0, 2.9, 0.2, 1.32, 0.92, 0.2]);
  const sailUVs = new Float32Array([0, 0, 0, 1, 1, 0]);
  sailGeo.setAttribute('position', new THREE.BufferAttribute(sailVerts, 3));
  sailGeo.setAttribute('uv', new THREE.BufferAttribute(sailUVs, 2));
  sailGeo.setIndex([0, 1, 2]);
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, sailMat);
  sail.castShadow = true;
  boat.add(sail);
  const jibGeo = new THREE.BufferGeometry();
  jibGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 1.02, -0.18, 0, 2.45, -0.18, -0.78, 0.72, -0.18]), 3));
  jibGeo.setIndex([0, 1, 2]);
  jibGeo.computeVertexNormals();
  const jib = new THREE.Mesh(jibGeo, sailMat);
  jib.castShadow = true;
  boat.add(jib);
  addCylinder(boat, 0.035, 0.04, 1.46, 5, lib.woodDark, 0.52, 0.86, 0.2).rotation.z = Math.PI / 2;
  addCylinder(boat, 0.032, 0.038, 1.8, 5, lib.woodDark, -0.35, 0.66, -0.18).rotation.z = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    addBox(boat, 1.08, 0.023, 0.025, lib.woodLight, 0.45, 1.1 + i * 0.4, 0.18, 0.005, false, false).rotation.z = -0.25;
  }
  addBox(boat, 0.42, 0.18, 0.55, lib.woodLight, 0.05, 0.33, -0.65, 0.03);
  addCylinder(boat, 0.1, 0.12, 0.32, 7, lib.brass, 0.08, 0.53, -0.65);
  addBox(boat, 0.13, 0.16, 0.13, lib.lampMaterial, 0, 0.44, 1.0, 0.02);
  addGlow(boat, lib, 0, 0.48, 1.1, 0.48);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.22), boatFlagMat(lib));
  flag.position.set(0.22, 2.94, 0.16);
  boat.add(flag);
  boat.userData = { phase: seed * 1.7, baseY: 0.015, roll: 0.035, motion: { cx: 8.15, cz: 9.55, rx: 2.1, rz: 0.82, speed: 0.055, phase: seed * 0.9 } };
  return boat;
}

function boatFlagMat(lib) {
  return new THREE.MeshStandardMaterial({ color: '#e8d7b8', roughness: 0.9, side: THREE.DoubleSide });
}

function createRowboat(lib, seed = 2) {
  const boat = createHull(lib, 1.75, 0.82, 0.34);
  const oarMat = lib.woodLight;
  for (const side of [-1, 1]) {
    const oar = addBox(boat, 0.055, 0.055, 1.58, oarMat, side * 0.48, 0.34, 0.04, 0.01);
    oar.rotation.x = 0.12;
    oar.rotation.z = side * 0.45;
  }
  addBox(boat, 0.48, 0.2, 0.32, lib.woodLight, 0.12, 0.31, -0.48, 0.03);
  addSphere(boat, 0.13, lib.woodMid, -0.3, 0.35, 0.48, 7, 5, true);
  addCylinder(boat, 0.12, 0.13, 0.16, 7, lib.blackIron, -0.26, 0.47, 0.48);
  boat.userData = { phase: seed * 2.1, baseY: 0.02, roll: 0.06 };
  return boat;
}

function createFishingBoat(lib, seed = 3) {
  const boat = createHull(lib, 2.35, 1.1, 0.5);
  addBox(boat, 0.88, 0.62, 0.82, lib.walls.ivory, 0, 0.63, -0.32, 0.055);
  addBox(boat, 0.56, 0.32, 0.04, lib.windowMaterial, 0, 0.75, 0.09, 0.02);
  addBox(boat, 0.98, 0.1, 0.9, lib.roofs.teal, 0, 0.98, -0.32, 0.03);
  addBox(boat, 0.15, 0.18, 0.15, lib.lampMaterial, -0.33, 0.53, 0.88, 0.02);
  addGlow(boat, lib, -0.33, 0.58, 0.98, 0.5);
  addCylinder(boat, 0.028, 0.04, 1.34, 5, lib.blackIron, 0.2, 1.12, 0.6);
  addBox(boat, 0.42, 0.025, 0.42, lib.clothCream, 0.35, 1.77, 0.6, 0.005);
  const net = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.015, 4, 18), lib.woodLight);
  net.rotation.x = Math.PI / 2;
  net.position.set(0.2, 0.38, 0.1);
  boat.add(net);
  const buoy = createBuoy(lib, 0.7);
  buoy.position.set(-0.55, 0.34, 0.6);
  boat.add(buoy);
  boat.userData = { phase: seed * 1.3, baseY: 0.025, roll: 0.04 };
  return boat;
}

function createBuoy(lib, scale = 1) {
  const group = new THREE.Group();
  addCylinder(group, 0.13 * scale, 0.17 * scale, 0.34 * scale, 8, lib.redLighthouse, 0, 0.17 * scale, 0);
  addCylinder(group, 0.13 * scale, 0.13 * scale, 0.08 * scale, 8, lib.whiteLighthouse, 0, 0.3 * scale, 0);
  addCylinder(group, 0.018, 0.018, 0.4 * scale, 4, lib.blackIron, 0, 0.48 * scale, 0);
  addBox(group, 0.23 * scale, 0.16 * scale, 0.02, lib.clothRed, 0.11 * scale, 0.61 * scale, 0, 0.005);
  addSphere(group, 0.04 * scale, lib.brass, 0, 0.69 * scale, 0, 6, 4, false);
  const glow = new THREE.Sprite(lib.glowMaterial);
  glow.position.set(0, 0.35 * scale, 0);
  glow.scale.setScalar(0.55 * scale);
  group.add(glow);
  group.userData.noMerge = true;
  return group;
}

function createCableCar(lib, terrain) {
  const group = new THREE.Group();
  const groundA = terrain.heightAt(13.15, 4.25);
  const groundB = terrain.heightAt(7.45, -6.55);
  const lower = new THREE.Vector3(13.15, groundA + 4.35, 4.25);
  const upper = new THREE.Vector3(7.45, groundB + 4.9, -6.55);
  const mid = lower.clone().lerp(upper, 0.5);
  mid.y -= 0.55;
  const curve = new THREE.QuadraticBezierCurve3(lower, mid, upper);
  const cableMat = new THREE.MeshStandardMaterial({ color: '#bba987', roughness: 0.42, metalness: 0.45, emissive: '#5f482d', emissiveIntensity: 0.25 });
  const cableGeo = new THREE.TubeGeometry(curve, 60, 0.028, 5, false);
  const cable = new THREE.Mesh(cableGeo, cableMat);
  cable.castShadow = false;
  group.add(cable);
  const cable2 = cable.clone();
  cable2.position.z += 0.16;
  group.add(cable2);
  for (let i = 0; i < 6; i++) {
    const p = curve.getPointAt(0.12 + i * 0.155);
    addSphere(group, 0.05, lib.lampMaterial, p.x, p.y - 0.08, p.z, 7, 5, false);
    const glow = new THREE.Sprite(lib.glowMaterial);
    glow.position.set(p.x, p.y - 0.08, p.z);
    glow.scale.setScalar(0.5);
    group.add(glow);
  }
  // slim support pylon, midway under the span
  const pylonX = 11.1;
  const pylonZ = -1.1;
  const pylonGround = terrain.heightAt(pylonX, pylonZ);
  const pylonTop = curve.getPointAt(0.5).y - 0.08;
  const pylon = new THREE.Group();
  pylon.position.set(pylonX, pylonGround, pylonZ);
  group.add(pylon);
  addBox(pylon, 0.16, pylonTop - pylonGround, 0.16, lib.blackIron, 0, (pylonTop - pylonGround) / 2, 0, 0.02);
  addBox(pylon, 1.1, 0.1, 0.12, lib.blackIron, -0.5, pylonTop - pylonGround, 0, 0.02);
  for (const x of [-0.44, 0.44]) {
    addBox(pylon, 0.07, 0.55, 0.07, lib.blackIron, x, 0.3, 0.1, 0.01);
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 5, 14), lib.brass);
  wheel.rotation.y = Math.PI / 2;
  wheel.position.set(0.1, pylonTop - pylonGround, -0.15);
  pylon.add(wheel);
  // lower station
  const stationA = new THREE.Group();
  stationA.position.set(lower.x, terrain.heightAt(lower.x, lower.z), lower.z);
  group.add(stationA);
  addBox(stationA, 1.8, 0.16, 1.7, lib.stoneLight, 0, 0.08, 0, 0.03);
  addBox(stationA, 1.25, 0.65, 1.18, lib.walls.cream, 0, 0.48, 0, 0.04);
  addBox(stationA, 1.45, 0.12, 1.35, lib.roofs.teal, 0, 0.92, 0, 0.02);
  addBox(stationA, 1.55, 0.09, 1.45, lib.woodDark, 0, 0.99, 0, 0.01);
  addBox(stationA, 0.52, 0.45, 0.05, lib.windowMaterial, 0, 0.55, 0.61, 0.02);
  addBox(stationA, 0.2, 0.64, 0.2, lib.blackIron, 0.2, 1.32, 0, 0.025);
  const wheelA = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 6, 18), lib.blackIron);
  wheelA.rotation.y = Math.PI / 2;
  wheelA.position.set(0.2, 1.5, 0);
  stationA.add(wheelA);
  const mastA = 4.35 - 0.92;
  for (const sx of [-0.48, 0.48]) {
    addBox(stationA, 0.08, mastA, 0.08, lib.blackIron, sx, 0.92 + mastA / 2, 0, 0.01);
    addBox(stationA, 0.055, 1.18, 0.055, lib.blackIron, sx * 0.6, 1.18, 0, 0.008);
  }
  addBox(stationA, 1.04, 0.08, 0.08, lib.blackIron, 0, 4.35, 0, 0.01);
  addBox(stationA, 0.84, 0.06, 0.06, lib.blackIron, 0, 2.88, 0, 0.01);
  const highWheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 5, 16), lib.brass);
  highWheel.rotation.y = Math.PI / 2;
  highWheel.position.set(0.1, 4.23, 0);
  stationA.add(highWheel);
  const stationLamp = addBox(stationA, 0.18, 0.24, 0.18, lib.lampMaterial, 0, 1.15, 0.66, 0.02);
  addGlow(stationA, lib, 0, 1.15, 0.77, 0.7);
  // upper station
  const stationB = new THREE.Group();
  stationB.position.set(upper.x, terrain.heightAt(upper.x, upper.z), upper.z);
  group.add(stationB);
  addBox(stationB, 1.5, 1.4, 1.4, lib.stone, 0, 0.7, 0, 0.05);
  addBox(stationB, 1.65, 0.12, 1.55, lib.roofs.rust, 0, 1.45, 0, 0.02);
  addBox(stationB, 0.85, 0.55, 0.04, lib.windowMaterial, 0, 0.86, 0.71, 0.02);
  addBox(stationB, 0.2, 0.9, 0.2, lib.blackIron, 0.1, 1.9, 0, 0.025);
  const mastB = 4.9 - 1.45;
  for (const sx of [-0.42, 0.42]) {
    addBox(stationB, 0.07, mastB, 0.07, lib.blackIron, sx, 1.45 + mastB / 2, 0, 0.01);
    addBox(stationB, 0.05, 1.3, 0.05, lib.blackIron, sx * 0.6, 1.7, 0, 0.008);
  }
  addBox(stationB, 0.92, 0.08, 0.08, lib.blackIron, 0, 4.9, 0, 0.01);
  addBox(stationB, 0.72, 0.06, 0.06, lib.blackIron, 0, 3.28, 0, 0.01);
  const upperWheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 5, 16), lib.brass);
  upperWheel.rotation.y = Math.PI / 2;
  upperWheel.position.set(0.1, 4.78, 0);
  stationB.add(upperWheel);
  addBox(stationB, 0.18, 0.24, 0.18, lib.lampMaterial, 0, 1.38, 0.68, 0.02);
  addGlow(stationB, lib, 0, 1.38, 0.78, 0.7);
  // cabin
  function makeCabin() {
    const root = new THREE.Group();
    const arm = new THREE.Group();
    root.add(arm);
    addBox(arm, 0.06, 0.58, 0.06, lib.blackIron, 0, 0.3, 0, 0.008);
    addBox(arm, 0.65, 0.08, 0.22, lib.blackIron, 0, 0.03, 0, 0.01);
    const wheelT = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 5, 10), lib.brass);
    wheelT.rotation.x = Math.PI / 2;
    wheelT.position.y = 0.04;
    arm.add(wheelT);
    const cabin = new THREE.Group();
    cabin.position.y = -0.28;
    root.add(cabin);
    addBox(cabin, 0.76, 0.66, 0.6, lib.walls.cream, 0, -0.1, 0, 0.055);
    addBox(cabin, 0.62, 0.36, 0.62, lib.windowMaterial, 0, 0.0, 0.02, 0.02);
    addBox(cabin, 0.84, 0.1, 0.7, lib.roofs.rust, 0, 0.32, 0, 0.03);
    addBox(cabin, 0.08, 0.22, 0.08, lib.blackIron, 0, -0.41, 0, 0.01);
    addBox(cabin, 0.12, 0.16, 0.12, lib.lampMaterial, 0.26, -0.28, 0.31, 0.02);
    addGlow(cabin, lib, 0.26, -0.28, 0.37, 0.55);
    return { root, cabin };
  }
  const cab1 = makeCabin();
  const cab2 = makeCabin();
  cab1.root.scale.setScalar(1.25);
  cab2.root.scale.setScalar(1.25);
  group.add(cab1.root, cab2.root);
  function update(dt, elapsed, night) {
    [cab1, cab2].forEach((cab, index) => {
      const cycle = (elapsed * 0.026 + index * 0.5) % 2;
      const t = cycle <= 1 ? cycle : 2 - cycle;
      const eased = t * t * (3 - 2 * t);
      const point = curve.getPointAt(clamp(eased, 0.03, 0.97));
      const tangent = curve.getTangentAt(clamp(eased, 0.03, 0.97));
      cab.root.position.copy(point);
      cab.root.position.y -= 0.05;
      cab.root.rotation.y = Math.atan2(tangent.x, tangent.z);
      cab.cabin.rotation.z = Math.sin(elapsed * 1.25 + index * 2.3) * 0.035;
      cab.cabin.rotation.x = Math.cos(elapsed * 0.9 + index) * 0.02;
    });
  }
  return { group, update };
}

function createBalloon(lib) {
  const group = new THREE.Group();
  const texture = canvasTexture(512, 256, (ctx, w, h) => {
    const colors = ['#c56b56', '#edd8b1', '#54817c', '#d6a44d', '#e6c8ae'];
    const stripe = w / 10;
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(i * stripe, 0, stripe + 1, h);
    }
    ctx.fillStyle = 'rgba(255,239,205,0.28)';
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(45 + i * 70, 72 + (i % 3) * 40, 10 + (i % 2) * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(53,41,32,0.25)';
    ctx.fillRect(0, h - 16, w, 16);
  }, { repeat: [1, 1], color: true });
  const envelopeMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7, metalness: 0.02, emissive: new THREE.Color('#c47a43'), emissiveIntensity: 0 });
  const envelope = new THREE.Mesh(new THREE.SphereGeometry(1.38, 28, 18), envelopeMat);
  envelope.scale.set(1, 1.13, 1);
  envelope.position.y = 1.6;
  envelope.castShadow = true;
  group.add(envelope);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.35, 8), lib.woodDark);
  top.position.y = 3.25;
  group.add(top);
  const basket = new THREE.Group();
  basket.position.y = -0.42;
  group.add(basket);
  addBox(basket, 0.62, 0.48, 0.58, lib.woodMid, 0, 0, 0, 0.06);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    const x = Math.cos(a) * 0.29;
    const z = Math.sin(a) * 0.29;
    addCylinder(basket, 0.02, 0.02, 1.9, 4, lib.woodDark, x * 0.9, 1.18, z * 0.9);
    addWire(group, [[x * 0.75, 0.25, z * 0.72], [Math.cos(a) * 0.25, 2.7, Math.sin(a) * 0.25]], lib.woodDark, 0.012, 8);
  }
  addBox(basket, 0.8, 0.08, 0.75, lib.woodDark, 0, 0.26, 0, 0.02);
  addBox(basket, 0.18, 0.35, 0.18, lib.lampMaterial, 0.34, 0.46, 0.2, 0.02);
  const burnerGlow = new THREE.SpriteMaterial({
    map: lib.textures.glow,
    color: '#ffd27e',
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const glow = new THREE.Sprite(burnerGlow);
  glow.position.set(0, -0.05, 0);
  glow.scale.setScalar(1.2);
  group.add(glow);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.28), lib.clothRed);
  flag.position.set(0.3, 3.0, 0);
  group.add(flag);
  const lantern = new THREE.PointLight('#ffbb70', 0, 6, 2);
  lantern.position.set(0, 0.1, 0);
  group.add(lantern);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * TAU + 0.5;
    const glowSprite = new THREE.Sprite(lib.glowMaterial);
    glowSprite.position.set(Math.cos(angle) * 0.95, 1.0, Math.sin(angle) * 0.95);
    glowSprite.scale.setScalar(0.65);
    group.add(glowSprite);
  }
  group.userData = { burnerGlow, envelopeMat, lantern };
  return group;
}

function createPerson(lib, palette, scale = 1) {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: palette.skin || '#d8aa86', roughness: 0.9 });
  const clothMat = new THREE.MeshStandardMaterial({ color: palette.cloth, roughness: 0.92 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: palette.pants || '#34464a', roughness: 0.95 });
  const hairMat = new THREE.MeshStandardMaterial({ color: palette.hair || '#5e4234', roughness: 0.95 });
  const legL = addBox(group, 0.09, 0.22, 0.1, pantsMat, -0.075, 0.11, 0, 0.02);
  const legR = addBox(group, 0.09, 0.22, 0.1, pantsMat, 0.075, 0.11, 0, 0.02);
  addCylinder(group, 0.14, 0.19, 0.3, 7, clothMat, 0, 0.36, 0);
  addSphere(group, 0.135, clothMat, 0, 0.31, 0, 10, 7, true);
  const armL = addBox(group, 0.065, 0.28, 0.07, clothMat, -0.19, 0.39, 0, 0.018);
  armL.rotation.z = -0.25;
  const armR = addBox(group, 0.065, 0.28, 0.07, clothMat, 0.19, 0.39, 0, 0.018);
  armR.rotation.z = 0.25;
  addSphere(group, 0.115, skinMat, 0, 0.63, 0, 10, 8, true);
  const hair = addSphere(group, 0.12, hairMat, 0, 0.67, -0.01, 10, 7, true);
  hair.scale.set(1, 0.65, 1);
  if (palette.hat) {
    addCylinder(group, 0.16, 0.18, 0.035, 10, new THREE.MeshStandardMaterial({ color: palette.hat, roughness: 0.9 }), 0, 0.73, 0);
    addCylinder(group, 0.1, 0.13, 0.12, 8, new THREE.MeshStandardMaterial({ color: palette.hat, roughness: 0.9 }), 0, 0.79, 0);
  }
  if (palette.scarf) {
    const scarfMat = new THREE.MeshStandardMaterial({ color: palette.scarf, roughness: 0.9 });
    addCylinder(group, 0.13, 0.14, 0.06, 8, scarfMat, 0, 0.54, 0);
    addBox(group, 0.06, 0.22, 0.055, scarfMat, 0.1, 0.42, 0.1, 0.01);
  }
  group.scale.setScalar(scale);
  group.userData = { legL, legR, armL, armR, phase: Math.random() * 10 };
  return group;
}

function createCat(lib) {
  const group = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: '#bb8c5e', roughness: 0.95 });
  const darkFur = new THREE.MeshStandardMaterial({ color: '#6f4f38', roughness: 0.95 });
  addBox(group, 0.28, 0.18, 0.42, fur, 0, 0.22, 0, 0.07);
  addSphere(group, 0.13, fur, 0, 0.35, 0.24, 10, 8, true);
  for (const x of [-0.07, 0.07]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 4), fur);
    ear.position.set(x, 0.48, 0.24);
    ear.rotation.z = x > 0 ? -0.16 : 0.16;
    group.add(ear);
  }
  addSphere(group, 0.035, darkFur, -0.045, 0.37, 0.36, 6, 4, false);
  addSphere(group, 0.035, darkFur, 0.045, 0.37, 0.36, 6, 4, false);
  const tail = addCylinder(group, 0.035, 0.045, 0.42, 6, darkFur, 0, 0.38, -0.25);
  tail.rotation.x = -0.7;
  tail.rotation.z = 0.35;
  for (const x of [-0.09, 0.09]) {
    for (const z of [-0.13, 0.14]) {
      addCylinder(group, 0.025, 0.03, 0.2, 5, fur, x, 0.1, z);
    }
  }
  return group;
}

function createStringLights(lib, group, terrain, specs) {
  const bulbGeo = new THREE.SphereGeometry(0.055, 6, 5);
  const positions = [];
  specs.forEach((spec) => {
    const points = [];
    const count = 7;
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const x = lerp(spec.a[0], spec.b[0], t);
      const z = lerp(spec.a[1], spec.b[1], t);
      const y = lerp(spec.ya, spec.yb, t) - Math.sin(t * Math.PI) * spec.sag;
      points.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.012, 4, false), lib.blackIron);
    group.add(wire);
    for (let i = 1; i < 18; i++) {
      const p = curve.getPointAt(i / 18);
      positions.push(p);
    }
    for (const end of [spec.a, spec.b]) {
      const x = end[0];
      const z = end[1];
      const yGround = terrain.heightAt(x, z);
      addCylinder(group, 0.05, 0.075, 2.55, 7, lib.blackIron, x, yGround + 1.27, z);
      addBox(group, 0.21, 0.08, 0.21, lib.stoneDark, x, yGround + 0.04, z, 0.02);
    }
  });
  const inst = new THREE.InstancedMesh(bulbGeo, lib.stringLightMaterial, positions.length);
  const dummy = new THREE.Object3D();
  positions.forEach((p, i) => {
    dummy.position.copy(p);
    dummy.position.y -= 0.05;
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  });
  inst.castShadow = false;
  group.add(inst);
  return inst;
}

function createRoadSign(lib, group, terrain, x, z) {
  const y = terrain.heightAt(x, z);
  const root = new THREE.Group();
  root.position.set(x, y, z);
  group.add(root);
  addCylinder(root, 0.05, 0.075, 2.0, 6, lib.woodDark, 0, 1.0, 0);
  const labels = [['港口', 1.62, 0.3, '#365347'], ['风车丘', 1.28, -0.3, '#79553a'], ['广场', 0.94, 0.3, '#4c5c6b']];
  labels.forEach(([text, y, zOff, bg], i) => {
    const tex = makeSimpleLabel(text, bg);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.28), mat);
    board.position.set(0, y, zOff);
    board.rotation.y = i % 2 ? 0.35 : -0.3;
    board.castShadow = true;
    root.add(board);
  });
  addSphere(root, 0.075, lib.brass, 0, 2.03, 0, 8, 6, false);
  return root;
}

function makeSimpleLabel(text, bg) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 80);
  ctx.strokeStyle = '#d7c095';
  ctx.lineWidth = 3;
  ctx.strokeRect(7, 7, 242, 66);
  ctx.fillStyle = '#f3e8d1';
  ctx.font = '600 37px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 42);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createProps(lib, terrain) {
  const group = new THREE.Group();
  group.name = 'props';
  const rng = mulberry32(0x1234abcd);
  const updateables = [];
  const nightLights = [];
  const walkers = [];
  const flags = [];
  const lampPositions = [
    [-1.25, 4.65, 2.15, true], [-7.65, 4.8, 2.15, true], [-8.8, 0.5, 1.9, false],
    [-3.2, 0.7, 1.85, false], [4.55, 4.8, 2.0, true], [7.15, -3.2, 1.8, false],
    [8.85, -2.2, 1.8, false], [11.35, 3.3, 2.0, true], [12.55, 5.0, 1.8, false],
    [-10.6, 6.3, 1.8, false], [-11.2, 0.3, 1.8, false], [13.1, 2.8, 1.75, false]
  ];
  lampPositions.forEach(([x, z, h, lit], i) => {
    const lamp = createLamp(lib, h, i % 3 === 0 ? 'stone' : 'iron');
    lamp.position.set(x, terrain.heightAt(x, z), z);
    group.add(lamp);
    if (lit) {
      const light = new THREE.PointLight('#ffc77b', 0, 7.5, 2);
      light.position.set(x, terrain.heightAt(x, z) + h + 0.35, z);
      group.add(light);
      nightLights.push(light);
    }
  });

  // string lights between posts
  const stringGroup = new THREE.Group();
  group.add(stringGroup);
  createStringLights(lib, stringGroup, terrain, [
    { a: [-8.5, 4.5], b: [-1.1, 4.9], ya: 1.06 + 2.4, yb: 1.06 + 2.3, sag: 0.5 },
    { a: [-7.45, 0.9], b: [-2.1, 1.1], ya: 1.06 + 2.45, yb: 1.06 + 2.45, sag: 0.6 }
  ]);

  // market stalls
  const stalls = [
    { x: -6.0, z: 3.6, rot: 0.35, awning: 'cream', banner: '果', color: '#a85543' },
    { x: -2.3, z: 5.05, rot: -0.2, awning: 'teal', banner: '鱼', color: '#416e6b' },
    { x: 11.2, z: 3.2, rot: 1.1, awning: 'gold', banner: '花', color: '#a47a35' }
  ];
  stalls.forEach((s) => {
    const stall = createMarketStall(lib, { awning: s.awning, banner: s.banner, bannerColor: s.color });
    stall.position.set(s.x, terrain.heightAt(s.x, s.z) + 0.02, s.z);
    stall.rotation.y = s.rot;
    group.add(stall);
  });

  // plaza furniture
  const bench1 = createBench(lib);
  bench1.position.set(-6.2, terrain.heightAt(-6.2, 5.0) + 0.02, 5.0);
  bench1.rotation.y = -0.2;
  group.add(bench1);
  const bench2 = createBench(lib);
  bench2.position.set(10.7, 0.56, 5.1);
  bench2.rotation.y = 0.6;
  group.add(bench2);
  const tableSet = createTableSet(lib);
  tableSet.position.set(-5.4, terrain.heightAt(-5.4, 4.2) + 0.02, 4.2);
  group.add(tableSet);
  const tableSet2 = createTableSet(lib);
  tableSet2.position.set(6.1, terrain.heightAt(6.1, 5.3) + 0.02, 5.3);
  tableSet2.scale.setScalar(0.8);
  group.add(tableSet2);
  const gazebo = createGazebo(lib);
  gazebo.position.set(13.1, terrain.heightAt(13.1, -3.9) + 0.02, -3.9);
  group.add(gazebo);

  // dock and boats
  const dock = createDock(lib, terrain);
  group.add(dock);
  const boats = [
    { mesh: createSailboat(lib, 1), x: 8.15, z: 9.55, rot: -0.4 },
    { mesh: createRowboat(lib, 2), x: 11.55, z: 8.15, rot: 0.8 },
    { mesh: createFishingBoat(lib, 3), x: 4.1, z: 10.45, rot: -0.65 },
    { mesh: createRowboat(lib, 4), x: 10.15, z: 7.75, rot: 0.15 }
  ];
  boats.forEach((b) => {
    b.mesh.userData.noMerge = true;
    b.mesh.position.set(b.x, 0.34 + b.mesh.userData.baseY, b.z);
    b.mesh.rotation.y = b.rot;
    group.add(b.mesh);
  });
  const buoys = [];
  [[2.7, 9.1, 1.0], [6.7, 11.15, 0.9], [11.0, 11.6, 1.1], [15.2, 9.95, 0.85], [12.8, 7.1, 0.7]].forEach(([x, z, scale], i) => {
    const buoy = createBuoy(lib, scale);
    buoy.position.set(x, 0.28, z);
    buoy.userData.phase = i * 1.4;
    group.add(buoy);
    buoys.push(buoy);
  });

  // Road signs
  createRoadSign(lib, group, terrain, 1.2, 5.0);
  createRoadSign(lib, group, terrain, 11.65, 4.0);

  // Bicycle leaning near the cafe.
  const bike = new THREE.Group();
  bike.position.set(2.0, terrain.heightAt(2.0, 5.55) + 0.03, 5.55);
  bike.rotation.y = -0.45;
  bike.rotation.z = 0.1;
  group.add(bike);
  const wheelMat = lib.blackIron;
  for (const z of [-0.45, 0.45]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.025, 6, 16), wheelMat);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.z = z;
    wheel.position.y = 0.31;
    bike.add(wheel);
    for (let s = 0; s < 5; s++) {
      const spoke = addBox(bike, 0.012, 0.56, 0.012, wheelMat, 0, 0.31, z, 0.004, false, false);
      spoke.rotation.x = (s / 5) * Math.PI;
    }
  }
  addWire(bike, [[0, 0.31, -0.45], [0, 0.68, 0], [0, 0.31, 0.45]], lib.woodLight, 0.02, 12);
  addWire(bike, [[0, 0.31, -0.45], [0.07, 0.62, -0.18], [0, 0.62, 0.28]], lib.woodLight, 0.02, 12);
  addBox(bike, 0.11, 0.06, 0.25, lib.woodDark, 0, 0.73, -0.22, 0.02);
  addBox(bike, 0.22, 0.12, 0.3, lib.woodMid, 0, 0.62, -0.45, 0.02);

  // Crops and garden frames in the left meadow.
  const garden = new THREE.Group();
  group.add(garden);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const x = -14.15 + col * 0.42;
      const z = 3.4 + row * 0.55;
      const y = terrain.heightAt(x, z);
      addBox(garden, 0.34, 0.08, 0.34, lib.woodMid, x, y + 0.04, z, 0.02);
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), lib.leafMaterials[(row + col) % 3]);
      leaf.position.set(x, y + 0.18, z);
      leaf.scale.y = 1.2;
      garden.add(leaf);
    }
  }
  addWire(garden, [[-14.6, 3.7, 2.9], [-12.9, 3.9, 2.9]], lib.woodLight, 0.026, 4);

  // Fountain is created separately from the plaza.

  // Tiny residents: static and wandering.
  const peoplePalettes = [
    { cloth: '#6e8191', pants: '#333c47', hat: '#d0b98b', scarf: '#a95a4e' },
    { cloth: '#a45e4d', pants: '#4a4038', hat: '#4d5c4f' },
    { cloth: '#d7bf8b', pants: '#4f5363', scarf: '#3e6f6b' },
    { cloth: '#4b7164', pants: '#363b3d', hat: '#8a5d3d' },
    { cloth: '#88556d', pants: '#3e3943', scarf: '#dcc28d' }
  ];
  const staticPeople = [
    [-3.2, 4.2, 0.2], [-6.5, 3.1, 1.7], [11.6, 3.8, -0.5], [2.0, 3.2, 2.6], [9.7, 5.3, 0.4]
  ];
  staticPeople.forEach(([x, z, rot], i) => {
    const person = createPerson(lib, peoplePalettes[i % peoplePalettes.length], 0.92);
    person.position.set(x, terrain.heightAt(x, z) + 0.02, z);
    person.rotation.y = rot;
    group.add(person);
  });
  const walkRoutes = [
    { pts: [[-1.8, 4.2], [-1.4, 2.7], [-3.0, 1.1], [-5.8, 1.0], [-7.2, 2.2], [-7.0, 4.0], [-4.6, 4.8], [-2.6, 4.6]], speed: 0.015, palette: 0 },
    { pts: [[11.0, 3.8], [12.7, 4.4], [13.5, 5.2], [12.0, 5.7], [10.4, 4.9], [9.6, 4.0]], speed: 0.012, palette: 1 },
    { pts: [[3.4, 4.1], [5.0, 4.35], [7.3, 4.3], [8.1, 3.1], [6.4, 2.6], [4.9, 3.0]], speed: 0.014, palette: 2 }
  ];
  const tempCurveCache = [];
  walkRoutes.forEach((route, routeIndex) => {
    const pts = route.pts.map(([x, z]) => new THREE.Vector3(x, terrain.heightAt(x, z) + 0.02, z));
    const curve = new THREE.CatmullRomCurve3(pts, true);
    tempCurveCache.push(curve);
    for (let k = 0; k < 2; k++) {
      const person = createPerson(lib, peoplePalettes[(route.palette + 2 + k) % peoplePalettes.length], 0.86 + k * 0.08);
      person.userData.noMerge = true;
      group.add(person);
      walkers.push({
        mesh: person,
        curve,
        t: (k * 0.47 + routeIndex * 0.19) % 1,
        speed: route.speed * (0.8 + k * 0.35),
        phase: Math.random() * 10
      });
    }
  });
  const cat = createCat(lib);
  cat.position.set(-1.9, terrain.heightAt(-1.9, 4.0) + 0.02, 4.0);
  cat.rotation.y = 1.3;
  group.add(cat);

  // Cable car and balloon
  const cable = createCableCar(lib, terrain);
  cable.group.name = 'cable-car';
  cable.group.userData.noMerge = true;
  group.add(cable.group);
  const balloon = createBalloon(lib);
  balloon.name = 'hot-air-balloon';
  balloon.userData.noMerge = true;
  balloon.scale.setScalar(1.05);
  group.add(balloon);

  // Flags on the harbour and plaza poles; the cloth is animated in update.
  function makeFlag(x, y, z, color, rotation = 0, scale = 1) {
    const flagRoot = new THREE.Group();
    flagRoot.position.set(x, y, z);
    flagRoot.rotation.y = rotation;
    const geometry = new THREE.PlaneGeometry(0.8, 0.5, 8, 4);
    geometry.translate(0.4, 0, 0);
    const mat = new THREE.MeshStandardMaterial({ map: color === 'red' ? lib.textures.awningCream : lib.textures.awningTeal, side: THREE.DoubleSide, roughness: 0.9, color: color === 'red' ? '#c56d57' : '#8ab8ac' });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.userData.noMerge = true;
    mesh.position.x = 0.04;
    mesh.castShadow = true;
    flagRoot.add(mesh);
    group.add(flagRoot);
    const basePositions = geometry.attributes.position.array.slice();
    flags.push({ mesh, basePositions, phase: rng() * 10, scale });
  }
  makeFlag(8.7, terrain.heightAt(8.7, 6.3) + 2.9, 6.3, 'red', 0.3, 1);
  makeFlag(12.4, terrain.heightAt(12.4, 3.2) + 2.8, 3.2, 'teal', -0.4, 1);
  makeFlag(-3.0, 1.06 + 3.4, 5.1, 'red', 0.1, 0.8);

  // A small weathervane-like spinner on the dock.
  const spinner = new THREE.Group();
  spinner.userData.noMerge = true;
  spinner.position.set(9.75, 1.62, 6.3);
  group.add(spinner);
  addCylinder(spinner, 0.02, 0.02, 0.75, 4, lib.blackIron, 0, 0.37, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const blade = addBox(spinner, 0.35, 0.18, 0.02, lib.brass, Math.cos(a) * 0.22, 0.75, Math.sin(a) * 0.22, 0.01);
    blade.rotation.y = -a;
    blade.rotation.z = 0.2;
  }

  function update(dt, elapsed, state) {
    cable.update(dt, elapsed, state.nightFactor);
    boats.forEach((b) => {
      const phase = b.mesh.userData.phase;
      const bob = Math.sin(elapsed * 1.05 + phase) * 0.035;
      if (b.mesh.userData.motion) {
        const motion = b.mesh.userData.motion;
        const angle = elapsed * motion.speed + motion.phase;
        const x = motion.cx + Math.cos(angle) * motion.rx;
        const z = motion.cz + Math.sin(angle) * motion.rz;
        b.mesh.position.set(x, 0.34 + b.mesh.userData.baseY + bob, z);
        b.mesh.rotation.y = Math.atan2(-Math.sin(angle) * motion.rx, Math.cos(angle) * motion.rz);
      } else {
        b.mesh.position.y = 0.34 + b.mesh.userData.baseY + bob;
      }
      b.mesh.rotation.z = Math.sin(elapsed * 0.83 + phase) * b.mesh.userData.roll;
      b.mesh.rotation.x = Math.cos(elapsed * 0.64 + phase) * b.mesh.userData.roll * 0.7;
    });
    buoys.forEach((buoy) => {
      buoy.position.y = 0.28 + Math.sin(elapsed * 1.25 + buoy.userData.phase) * 0.045;
      buoy.rotation.z = Math.sin(elapsed * 0.95 + buoy.userData.phase) * 0.05;
    });
    walkers.forEach((w) => {
      w.t = (w.t + dt * w.speed) % 1;
      const p = w.curve.getPointAt(w.t);
      const tangent = w.curve.getTangentAt(w.t);
      w.mesh.position.set(p.x, p.y + Math.abs(Math.sin(elapsed * 6 + w.phase)) * 0.025, p.z);
      w.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
      const stride = Math.sin(elapsed * 7.5 + w.phase) * 0.45;
      w.mesh.userData.legL.rotation.x = stride;
      w.mesh.userData.legR.rotation.x = -stride;
      w.mesh.userData.armL.rotation.x = -stride * 0.55;
      w.mesh.userData.armR.rotation.x = stride * 0.55;
    });
    const balloonT = elapsed * 0.035;
    const bx = 1.0 + Math.cos(balloonT) * 6.0;
    const bz = -0.8 + Math.sin(balloonT) * 4.5;
    balloon.position.set(bx, 10.6 + Math.sin(elapsed * 0.4) * 0.45, bz);
    balloon.rotation.y = -balloonT + Math.PI / 2;
    balloon.rotation.z = Math.sin(elapsed * 0.37) * 0.025;
    balloon.userData.burnerGlow.opacity = 0.52 + Math.sin(elapsed * 3.2) * 0.12 + state.nightFactor * 0.2;
    balloon.userData.envelopeMat.emissiveIntensity = state.nightFactor * 0.135;
    balloon.userData.lantern.intensity = state.nightFactor * 1.6;
    flags.forEach((flag) => {
      const pos = flag.mesh.geometry.attributes.position;
      const base = flag.basePositions;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const y = base[i * 3 + 1];
        const wave = Math.sin(x * 8.5 + elapsed * 4.2 + flag.phase) * 0.09 + Math.sin(y * 5.0 + elapsed * 3.7) * 0.025;
        pos.array[i * 3 + 2] = wave * (0.2 + x / 0.8);
      }
      pos.needsUpdate = true;
      flag.mesh.geometry.computeVertexNormals();
    });
    spinner.rotation.y = elapsed * 0.4;
    nightLights.forEach((light) => {
      light.intensity = state.nightFactor * 2.4;
    });
  }

  return { group, update, boats, buoys, walkers, balloon, cable, nightLights, dock };
}
